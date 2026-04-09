"""
sync_results.py — Scrape race results from PCS and store in cycling_results.

Usage:
    python scripts/cycling/sync_results.py

Runs both steps automatically — no flags needed.

Step 1 — Find active/finished races and scrape results:
    - Fetches races with status=active or finished from Supabase
    - For one_day races: scrape ALL riders from /race/{slug}/{year}
    - For stage_race: scrape ALL riders per stage missing results
    - Parses jersey holders (yellow/green/polka/white) per stage
    - Parses abandon_type (DNF/DNS/DSQ) separately
    - Saves per-race JSON to data/results_{slug}_{stage}.json

Step 2 — Match riders and upload:
    - Matches rider names against cycling_riders in Supabase
    - Upserts to cycling_results (incl. jersey, abandon_type)
    - Updates results_uploaded_at on races/stages
    - Updates cycling_stages.profile from PCS stage pages
    - Logs to cycling_sync_log with sync_type=results_sync

SQL migration (run once):
    ALTER TABLE cycling_results ADD COLUMN IF NOT EXISTS jersey text;
    ALTER TABLE cycling_results ADD COLUMN IF NOT EXISTS abandon_type text;

Environment variables (loaded from .env.local or shell):
    NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""

import sys
import os
import re
import json
import time
import unicodedata
from datetime import datetime

import httpx
from bs4 import BeautifulSoup
from supabase import create_client, Client
from postgrest.exceptions import APIError

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PCS_BASE = "https://www.procyclingstats.com"

PCS_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

REQUEST_DELAY = 1.5
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
YEAR = 2026

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def load_dotenv_local() -> None:
    env_path = os.path.normpath(
        os.path.join(os.path.dirname(__file__), "..", "..", ".env.local")
    )
    if not os.path.exists(env_path):
        return
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            k = k.strip()
            if k and k not in os.environ:
                os.environ[k] = v.strip()


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        _die(f"Missing required environment variable: {name}")
    return value  # type: ignore[return-value]


def _die(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def _warn(msg: str) -> None:
    print(f"WARNING: {msg}", file=sys.stderr)


def _log(msg: str) -> None:
    print(msg, flush=True)


def pcs_get(url: str, client: httpx.Client, retries: int = 2) -> BeautifulSoup:
    for attempt in range(retries + 1):
        try:
            resp = client.get(url, timeout=30, follow_redirects=True)
            if resp.status_code == 404:
                return BeautifulSoup("", "html.parser")
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "html.parser")
        except httpx.HTTPStatusError as e:
            if attempt < retries and e.response.status_code >= 500:
                _warn(f"HTTP {e.response.status_code} for {url} — retrying in 3s")
                time.sleep(3)
                continue
            _warn(f"PCS returned HTTP {e.response.status_code} for {url} — skipping")
            return BeautifulSoup("", "html.parser")
        except httpx.HTTPError as e:
            _warn(f"HTTP error for {url}: {e} — skipping")
            return BeautifulSoup("", "html.parser")
    return BeautifulSoup("", "html.parser")


def normalize_name(s: str) -> str:
    """Normalize a rider name for fuzzy matching."""
    s = s.upper()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("'", "").replace("-", " ").replace("Đ", "D")
    return " ".join(s.split())


def save_json(path: str, data: object) -> None:
    with open(path, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Step 1: Scrape results from PCS
# ---------------------------------------------------------------------------


def scrape_race_results(slug: str, client: httpx.Client) -> tuple[list[dict], str | None]:
    """Scrape ALL results from a one-day race using /result endpoint.
    Returns (results, won_how).
    """
    url = f"{PCS_BASE}/race/{slug}/{YEAR}/result"
    _log(f"    Fetching: {url}")
    soup = pcs_get(url, client)
    time.sleep(REQUEST_DELAY)
    return _parse_results_table(soup), _parse_won_how(soup)


def scrape_stage_results(slug: str, stage_num: int, client: httpx.Client) -> tuple[list[dict], dict[str, list[str]], str | None, str | None]:
    """Scrape ALL results from a specific stage.
    Uses /stage-{N} page for jerseys and profile, then fetches
    /stage-{N}/result for the full results table.
    Returns (results, jersey_holders, stage_profile, won_how).
    """
    if stage_num == 0:
        base = f"{PCS_BASE}/race/{slug}/{YEAR}/prologue"
    else:
        base = f"{PCS_BASE}/race/{slug}/{YEAR}/stage-{stage_num}"

    # Fetch stage page for jerseys + profile
    _log(f"    Fetching: {base}")
    soup = pcs_get(base, client)
    time.sleep(REQUEST_DELAY)

    jerseys = _parse_jerseys(soup)
    profile = _parse_stage_profile(soup)
    won_how = _parse_won_how(soup)

    # Fetch full results from /result sub-page
    result_url = f"{base}/result"
    _log(f"    Fetching full results: {result_url}")
    result_soup = pcs_get(result_url, client)
    time.sleep(REQUEST_DELAY)

    results = _parse_results_table(result_soup)

    # Also try won_how from result page if not found on stage page
    if not won_how:
        won_how = _parse_won_how(result_soup)

    # Fallback: if /result returned fewer than the stage page, use stage page
    stage_results = _parse_results_table(soup)
    if len(stage_results) > len(results):
        _log(f"    Fallback: stage page had {len(stage_results)} vs /result {len(results)}")
        results = stage_results

    return results, jerseys, profile, won_how


def parse_time_to_seconds(text: str) -> int | None:
    """
    Parse PCS time gap strings to seconds. Examples:
      "4:32:10" → 16330
      "0:03:54" → 234
      "+0:03:54" → 234
      "4h 32' 10\"" → 16330
      ",," or empty → None
    """
    if not text:
        return None
    text = text.strip().lstrip("+").strip()
    if not text or text in (",,", "-"):
        return None

    # Format: H:MM:SS or M:SS
    m = re.match(r"^(\d+):(\d{1,2}):(\d{2})$", text)
    if m:
        return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3))

    # Format: M:SS (no hours)
    m = re.match(r"^(\d+):(\d{2})$", text)
    if m:
        return int(m.group(1)) * 60 + int(m.group(2))

    # Format: Xh YY' ZZ"
    m = re.match(r"^(\d+)h\s*(\d+)['\u2019]\s*(\d+)", text)
    if m:
        return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3))

    # Just seconds
    m = re.match(r"^(\d+)[\"s]?$", text)
    if m:
        return int(m.group(1))

    return None


def _parse_results_table(soup: BeautifulSoup) -> list[dict]:
    """
    Parse PCS results page — ALL riders, no limit.
    Structure:
      <tr>
        <td>1</td>                    ← position (or DNF/DNS/DSQ)
        <td class="ridername">
          <a href="rider/{slug}">LASTNAME Firstname</a>
        </td>
        <td>Team Name</td>
        <td>4h 32' 10"</td>          ← time
      </tr>
    """
    rider_re = re.compile(r"^rider/([\w-]+)$")
    results: list[dict] = []
    seen_slugs: set[str] = set()

    for a in soup.find_all("a", href=rider_re):
        m = rider_re.match(a["href"])
        if not m:
            continue

        pcs_slug = m.group(1)
        if pcs_slug in seen_slugs:
            continue

        name = " ".join(a.stripped_strings)
        if not name:
            continue
        seen_slugs.add(pcs_slug)

        row = a.find_parent("tr")
        position = len(results) + 1
        team = ""
        time_gap_seconds: int | None = None
        dnf = False
        abandon_type: str | None = None

        if row:
            cells = row.find_all("td")
            if cells:
                pos_text = cells[0].get_text(strip=True).lower()
                if pos_text in ("dnf", "dns", "otl", "dsq"):
                    dnf = True
                    abandon_type = pos_text.upper()
                    if pos_text == "otl":
                        abandon_type = "OTL"  # outside time limit
                    position = None  # type: ignore[assignment]
                else:
                    pos_num = re.sub(r"[^\d]", "", pos_text)
                    if pos_num.isdigit():
                        position = int(pos_num)

            # Team link
            team_link = row.find("a", href=re.compile(r"^team/"))
            if team_link:
                team = team_link.get_text(strip=True)

            # Time gap — find last td with time-like content.
            if len(cells) >= 4:
                last_td = cells[-1]
                raw = last_td.string
                if raw is None:
                    raw = "".join(last_td.find_all(string=True, recursive=False)).strip()
                else:
                    raw = raw.strip()
                time_gap_seconds = parse_time_to_seconds(raw)

        results.append({
            "pcs_slug": pcs_slug,
            "name": name,
            "team": team,
            "position": position,
            "time_gap_seconds": time_gap_seconds,
            "dnf": dnf,
            "abandon_type": abandon_type,
        })

    return results


def _parse_jerseys(soup: BeautifulSoup) -> dict[str, list[str]]:
    """
    Parse jersey holders from PCS stage page.
    PCS shows jersey classifications in sections/tables after the stage result.
    Look for known classification keywords and map to jersey types.
    Returns { rider_pcs_slug: ['yellow', 'green', ...] }
    """
    rider_re = re.compile(r"^rider/([\w-]+)$")
    jerseys: dict[str, list[str]] = {}

    # Map PCS classification keywords to jersey types
    classification_map = {
        "general": "yellow",
        "gc": "yellow",
        "leader": "yellow",
        "points": "green",
        "sprint": "green",
        "mountain": "polka",
        "kom": "polka",
        "climber": "polka",
        "young": "white",
        "youth": "white",
        "u25": "white",
    }

    # Look for classification sections — PCS uses <h3> or <div> headers
    # followed by result tables. The first rider in each classification is the leader.
    for header in soup.find_all(["h3", "h4", "div"], class_=re.compile(r"(sub)?head")):
        text = header.get_text(strip=True).lower()

        jersey_type = None
        for keyword, jtype in classification_map.items():
            if keyword in text:
                jersey_type = jtype
                break

        if not jersey_type:
            continue

        # Find the next table or list after this header
        sibling = header.find_next("table")
        if not sibling:
            continue

        # First rider link in the table is the jersey holder
        first_rider = sibling.find("a", href=rider_re)
        if first_rider:
            rm = rider_re.match(first_rider["href"])
            if rm:
                slug = rm.group(1)
                if slug not in jerseys:
                    jerseys[slug] = []
                if jersey_type not in jerseys[slug]:
                    jerseys[slug].append(jersey_type)

    return jerseys


def _parse_stage_profile(soup: BeautifulSoup) -> str | None:
    """
    Parse stage profile from PCS stage page.
    PCS uses profile icon classes or text indicators:
    - 'p1' / 'flat' → flat
    - 'p2' / 'hills' / 'hilly' → hilly
    - 'p3' / 'mountain' → mountain
    - 'p4' / 'cobbles' / 'cobbled' → cobbled
    - 'p5' / 'itt' / 'time trial' → itt
    """
    # Strategy 1: look for profile icon spans with classes like 'icon profile p1'
    for span in soup.find_all("span", class_=re.compile(r"profile")):
        classes = " ".join(span.get("class", []))
        if "p1" in classes:
            return "flat"
        if "p2" in classes:
            return "hilly"
        if "p3" in classes:
            return "mountain"
        if "p4" in classes:
            return "cobbled"
        if "p5" in classes:
            return "itt"

    # Strategy 2: look for text content with profile keywords
    for tag in soup.find_all(["span", "div"], class_=re.compile(r"(stage|info)")):
        text = tag.get_text(strip=True).lower()
        if "time trial" in text or "itt" in text or "ttt" in text:
            return "itt"
        if "mountain" in text:
            return "mountain"
        if "hilly" in text or "hills" in text:
            return "hilly"
        if "flat" in text:
            return "flat"
        if "cobble" in text:
            return "cobbled"

    return None


def _parse_won_how(soup: BeautifulSoup) -> str | None:
    """Parse 'Won how' from PCS race/stage page (keyvalueList)."""
    for ul in soup.find_all("ul", class_=re.compile(r"keyvalueList")):
        for li in ul.find_all("li"):
            divs = li.find_all("div")
            if len(divs) >= 2:
                label = divs[0].get_text(strip=True).lower().rstrip(":")
                if "won how" in label:
                    value = divs[1].get_text(strip=True)
                    if value and value != "-":
                        return value
    return None


# ---------------------------------------------------------------------------
# Auto status update
# ---------------------------------------------------------------------------


def auto_update_race_statuses(supabase: Client) -> int:
    """
    Automatically update race statuses based on dates:
    - One-day races with start_date < today and status=upcoming → finished
    - Stage races with end_date < today and status in (upcoming, active) → finished
    - Stage races with start_date <= today and end_date >= today and status=upcoming → active
    Returns number of races updated.
    """
    today = datetime.utcnow().strftime("%Y-%m-%d")
    updated = 0

    try:
        resp = (
            supabase.table("cycling_races")
            .select("id, name, race_type, status, start_date, end_date")
            .in_("status", ["upcoming", "active"])
            .execute()
        )
        races = resp.data or []
    except APIError as e:
        _warn(f"Failed to fetch races for status update: {e}")
        return 0

    for race in races:
        start = race.get("start_date") or ""
        end = race.get("end_date") or start  # one-day races: end = start
        old_status = race["status"]
        new_status = old_status

        if race["race_type"] == "one_day":
            if start and start < today and old_status == "upcoming":
                new_status = "finished"
        else:
            # Stage race
            if end and end < today and old_status in ("upcoming", "active"):
                new_status = "finished"
            elif start and start <= today and (not end or end >= today) and old_status == "upcoming":
                new_status = "active"

        if new_status != old_status:
            try:
                supabase.table("cycling_races").update(
                    {"status": new_status}
                ).eq("id", race["id"]).execute()
                _log(f"  {race['name']}: {old_status} → {new_status}")
                updated += 1
            except APIError as e:
                _warn(f"  Failed to update {race['name']}: {e}")

    return updated


# ---------------------------------------------------------------------------
# Startlist scraping
# ---------------------------------------------------------------------------


def scrape_startlist(slug: str, year: int, client: httpx.Client) -> list[dict]:
    """
    Scrape startlist from PCS for a single race (men elite only).

    PCS startlist URL: /race/{slug}/{year}/startlist
    The men's roster is inside <ul class="startlist_v4">.
    Each <li> is a team with rider links and bib numbers embedded in text.
    """
    url = f"{PCS_BASE}/race/{slug}/{year}/startlist"
    _log(f"    Fetching startlist: {url}")
    soup = pcs_get(url, client)
    time.sleep(REQUEST_DELAY)

    # Only parse riders from startlist_v4 (men elite roster)
    startlist_ul = soup.find("ul", class_="startlist_v4")
    if not startlist_ul:
        _warn(f"    No <ul class='startlist_v4'> found, falling back to full page")
        startlist_ul = soup

    rider_re = re.compile(r"^rider/([\w-]+)$")
    entries: list[dict] = []
    seen: set[str] = set()

    for a in startlist_ul.find_all("a", href=rider_re):
        m = rider_re.match(a["href"])
        if not m:
            continue

        pcs_slug = m.group(1)
        name_parts = list(a.stripped_strings)
        if not name_parts:
            continue
        if pcs_slug in seen:
            continue
        seen.add(pcs_slug)

        # Bib number: the text node immediately before the rider name link
        # PCS format inside <li>: "1POGAČAR Tadej" where "1" is a text node
        # or in a <span> before the <a>
        bib = None
        prev = a.previous_sibling
        if prev and isinstance(prev, str):
            bib_text = prev.strip()
            if bib_text.isdigit():
                bib = int(bib_text)

        entries.append({
            "pcs_slug": pcs_slug,
            "name": " ".join(name_parts),
            "bib_number": bib,
        })

    return entries


def sync_startlists(
    races: list[dict],
    rider_index: dict[str, int],
    client: httpx.Client,
    supabase: Client,
) -> int:
    """
    For each race, check if cycling_startlists has entries.
    If not, scrape and upsert. Returns total entries upserted.
    """
    total_upserted = 0

    for race in races:
        # Skip finished races — startlists don't change after a race is done
        if race.get("status") == "finished":
            continue

        _log(f"  Scraping startlist for {race['name']}...")
        entries = scrape_startlist(race["pcs_slug"], YEAR, client)

        if not entries:
            _log(f"    No startlist available")
            continue

        save_json(
            os.path.join(DATA_DIR, f"startlist_{race['pcs_slug']}.json"),
            entries,
        )

        # Match and build upsert rows
        now = datetime.utcnow().isoformat()
        rows: list[dict] = []
        unmatched = 0
        for entry in entries:
            rider_id = rider_index.get(entry["pcs_slug"])
            if not rider_id:
                unmatched += 1
                continue
            rows.append({
                "race_id": race["id"],
                "rider_id": rider_id,
                "bib_number": entry["bib_number"],
                "confirmed": True,
                "updated_at": now,
            })

        if rows:
            try:
                supabase.table("cycling_startlists").upsert(
                    rows, on_conflict="race_id,rider_id"
                ).execute()
                total_upserted += len(rows)
                _log(f"    → {len(rows)} entries upserted")
            except APIError as e:
                _warn(f"    Startlist upsert failed: {e}")

        if unmatched:
            _log(f"    {unmatched} riders not found in cycling_riders")

        # Update startlist_total on the race
        try:
            supabase.table("cycling_races").update(
                {"startlist_total": len(entries)}
            ).eq("id", race["id"]).execute()
            _log(f"    startlist_total={len(entries)}")
        except APIError as e:
            _warn(f"    Failed to update startlist_total: {e}")

    return total_upserted


# ---------------------------------------------------------------------------
# Step 2: Match & upload
# ---------------------------------------------------------------------------


def build_rider_index(supabase: Client) -> dict[str, int]:
    """Build pcs_slug → rider_id index from cycling_riders."""
    try:
        resp = supabase.table("cycling_riders").select("id, pcs_slug").execute()
        return {r["pcs_slug"]: r["id"] for r in (resp.data or [])}
    except APIError as e:
        _die(f"Failed to fetch cycling_riders: {e}")
        return {}


def upload_results(
    results: list[dict],
    race_id: int,
    stage_number: int,
    rider_index: dict[str, int],
    supabase: Client,
    jersey_holders: dict[str, list[str]] | None = None,
) -> tuple[int, int]:
    """Match and upsert results. Returns (upserted, unmatched).
    stage_number=0 for one-day races and GC classification."""
    rows: list[dict] = []
    unmatched = 0

    for r in results:
        rider_id = rider_index.get(r["pcs_slug"])
        if rider_id is None:
            unmatched += 1
            _warn(f"    Unmatched: {r['name']} ({r['pcs_slug']})")
            continue

        # Jersey for this rider (comma-separated if multiple)
        jersey = None
        if jersey_holders and r["pcs_slug"] in jersey_holders:
            jersey = ",".join(jersey_holders[r["pcs_slug"]])

        row: dict = {
            "race_id": race_id,
            "rider_id": rider_id,
            "stage_number": stage_number,
            "position": r["position"],
            "time_gap_seconds": r["time_gap_seconds"],
            "dnf": r["dnf"],
            "abandon_type": r.get("abandon_type"),
        }
        if jersey:
            row["jersey"] = jersey

        rows.append(row)

    if not rows:
        return 0, unmatched

    # Batch upsert in chunks to avoid payload limits
    batch_size = 200
    total = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        try:
            supabase.table("cycling_results").upsert(
                batch, on_conflict="race_id,rider_id,stage_number"
            ).execute()
            total += len(batch)
        except APIError as e:
            _warn(f"    Upsert failed (batch {i // batch_size + 1}): {e}")

    return total, unmatched


def update_results_timestamp(supabase: Client, table: str, record_id: int) -> None:
    now = datetime.utcnow().isoformat()
    try:
        supabase.table(table).update({"results_uploaded_at": now}).eq("id", record_id).execute()
    except APIError:
        pass


def log_sync(supabase: Client, total_upserted: int, total_unmatched: int, total_startlists: int, errors: list[str]) -> None:
    status = "success" if not errors else "error"
    message = f"startlists={total_startlists}, results={total_upserted}, unmatched={total_unmatched}"
    if errors:
        message += f" | {len(errors)} error(s)"

    try:
        supabase.table("cycling_sync_log").insert({
            "sync_type": "results_sync",
            "records_affected": total_upserted + total_startlists,
            "status": status,
            "message": message,
        }).execute()
    except APIError as e:
        _warn(f"Failed to write sync log: {e}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Cycling results sync.")
    parser.add_argument(
        "--debug-startlist",
        type=str,
        default=None,
        metavar="SLUG",
        help="Fetch a startlist page and dump HTML structure, then exit",
    )
    parser.add_argument(
        "--debug-results",
        type=str,
        default=None,
        metavar="SLUG",
        help="Fetch result pages for a race and compare rider counts, then exit",
    )
    args = parser.parse_args()

    load_dotenv_local()
    os.makedirs(DATA_DIR, exist_ok=True)

    if args.debug_results:
        slug = args.debug_results
        with httpx.Client(headers=PCS_HEADERS) as client:
            rider_re = re.compile(r"^rider/([\w-]+)$")

            # Test different URL patterns
            urls = [
                f"{PCS_BASE}/race/{slug}/{YEAR}",
                f"{PCS_BASE}/race/{slug}/{YEAR}/result",
                f"{PCS_BASE}/race/{slug}/{YEAR}/result/result",
                f"{PCS_BASE}/race/{slug}/{YEAR}?offset=0",
            ]
            for url in urls:
                _log(f"\nFetching: {url}")
                resp = client.get(url, timeout=30, follow_redirects=True)
                _log(f"  Status: {resp.status_code}, Final URL: {resp.url}")
                if resp.status_code != 200:
                    continue
                soup = BeautifulSoup(resp.text, "html.parser")
                riders = set()
                for a in soup.find_all("a", href=rider_re):
                    m = rider_re.match(a["href"])
                    if m and a.find_parent("tr"):
                        riders.add(m.group(1))
                _log(f"  Unique riders in <tr>: {len(riders)}")

                # Check for pagination or "show all" links
                for a in soup.find_all("a", href=True):
                    href = a.get("href", "")
                    text = a.get_text(strip=True).lower()
                    if any(kw in text for kw in ["all", "alle", "more", "full", "next"]):
                        _log(f"  Pagination link: href={href} text={text}")
                    if "offset" in href or "limit" in href or "page" in href:
                        _log(f"  Pagination link: href={href} text={text}")
        return

    if args.debug_startlist:
        slug = args.debug_startlist
        url = f"{PCS_BASE}/race/{slug}/{YEAR}/startlist"
        with httpx.Client(headers=PCS_HEADERS) as client:
            _log(f"Fetching: {url}")
            resp = client.get(url, timeout=30, follow_redirects=True)
            _log(f"Status: {resp.status_code}")
            _log(f"Content-Length: {len(resp.text)}")

            soup = BeautifulSoup(resp.text, "html.parser")

            # Find all headings and section markers
            for tag in soup.find_all(["h1", "h2", "h3", "h4", "div", "span"], class_=True):
                text = tag.get_text(strip=True)
                cls = " ".join(tag.get("class", []))
                if text and len(text) < 80 and any(kw in text.lower() for kw in ["men", "women", "elite", "u23", "junior", "startlist"]):
                    _log(f"  <{tag.name} class=\"{cls}\"> {text}")

            # Count rider links per section
            rider_re = re.compile(r"^rider/([\w-]+)$")
            all_riders = soup.find_all("a", href=rider_re)
            seen = set()
            for a in all_riders:
                m = rider_re.match(a["href"])
                if m and a.get_text(strip=True):
                    seen.add(m.group(1))
            _log(f"\nTotal unique rider links with text: {len(seen)}")

            # Look for ul.startlist_v4 or similar list containers
            for ul in soup.find_all("ul", class_=True):
                cls = " ".join(ul.get("class", []))
                rider_count = len(ul.find_all("a", href=rider_re))
                if rider_count > 5:
                    _log(f"  <ul class=\"{cls}\">: {rider_count} rider links")

            _log("\n--- Raw HTML (first 3000 chars) ---")
            print(resp.text[:3000])
        return

    _log("=" * 60)
    _log("  CYCLING RESULTS SYNC")
    _log("=" * 60)

    supabase_url = require_env("NEXT_PUBLIC_SUPABASE_URL")
    service_key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(supabase_url, service_key)

    # ── Auto-update race statuses based on dates ─────────────
    _log("\n→ Auto-updating race statuses...")
    status_updates = auto_update_race_statuses(supabase)
    _log(f"  Updated {status_updates} race(s)")

    # Fetch active/finished races
    _log("\n→ Fetching active/finished races from Supabase...")
    try:
        resp = (
            supabase.table("cycling_races")
            .select("id, name, pcs_slug, race_type, status")
            .in_("status", ["active", "finished"])
            .order("start_date", desc=False)
            .execute()
        )
        races = resp.data or []
    except APIError as e:
        _die(f"Failed to fetch races: {e}")

    if not races:
        _log("  No active/finished races found. Nothing to sync.")
        return

    _log(f"  Found {len(races)} races to process")

    # Build rider index
    _log("  Building rider index...")
    rider_index = build_rider_index(supabase)
    _log(f"  {len(rider_index)} riders in index")

    # Fetch stages for stage races and find which ones lack results
    stage_races_ids = [r["id"] for r in races if r["race_type"] == "stage_race"]
    stages_by_race: dict[str, list[dict]] = {}
    if stage_races_ids:
        try:
            # Get all stages for these races
            resp = (
                supabase.table("cycling_stages")
                .select("id, race_id, stage_number")
                .in_("race_id", stage_races_ids)
                .order("stage_number", desc=False)
                .execute()
            )
            all_stages = resp.data or []

            # Get existing results to find which stages already have them
            resp2 = (
                supabase.table("cycling_results")
                .select("race_id, stage_number")
                .in_("race_id", stage_races_ids)
                .execute()
            )
            has_results: set[tuple[str, int]] = set()
            for r in resp2.data or []:
                has_results.add((r["race_id"], r["stage_number"]))

            # Only keep stages without results
            for s in all_stages:
                if (s["race_id"], s["stage_number"]) not in has_results:
                    stages_by_race.setdefault(s["race_id"], []).append(s)

            total_stages = sum(len(v) for v in stages_by_race.values())
            _log(f"  {len(all_stages)} total stages, {total_stages} pending (no results)")
        except APIError as e:
            _warn(f"Failed to fetch stages: {e}")

    # ── Startlists: scrape for upcoming + active races ──────────
    _log("\n→ Fetching upcoming/active races for startlist sync...")
    try:
        sl_resp = (
            supabase.table("cycling_races")
            .select("id, name, pcs_slug, race_type, status")
            .in_("status", ["upcoming", "active"])
            .order("start_date", desc=False)
            .execute()
        )
        startlist_races = sl_resp.data or []
    except APIError as e:
        _warn(f"Failed to fetch upcoming/active races: {e}")
        startlist_races = []

    _log(f"  Found {len(startlist_races)} upcoming/active races")
    with httpx.Client(headers=PCS_HEADERS) as client:
        total_startlists = sync_startlists(startlist_races, rider_index, client, supabase)
    _log(f"  Startlist entries upserted: {total_startlists}")

    # ── Results: scrape and upload per race ───────────────────
    _log("\n→ Syncing results...")
    total_upserted = 0
    total_unmatched = 0
    errors: list[str] = []

    with httpx.Client(headers=PCS_HEADERS) as client:
        for race in races:
            _log(f"\n─ {race['name']} ({race['status']}) ─")

            if race["race_type"] == "one_day":
                # Scrape one-day race
                results, won_how = scrape_race_results(race["pcs_slug"], client)
                if not results:
                    _warn(f"  No results found for {race['name']}")
                    continue

                filename = f"results_{race['pcs_slug']}.json"
                save_json(os.path.join(DATA_DIR, filename), results)
                _log(f"  Parsed {len(results)} results")

                upserted, unmatched = upload_results(
                    results, race["id"], 0, rider_index, supabase,
                )
                total_upserted += upserted
                total_unmatched += unmatched
                _log(f"  Upserted {upserted}, unmatched {unmatched}")

                # Update won_how on stage (stage_number=1 for one-day)
                if won_how:
                    try:
                        supabase.table("cycling_stages").update(
                            {"won_how": won_how}
                        ).eq("race_id", race["id"]).eq("stage_number", 1).execute()
                        _log(f"  Won how: {won_how}")
                    except APIError as e:
                        _warn(f"  Failed to update won_how: {e}")

                update_results_timestamp(supabase, "cycling_races", race["id"])

            elif race["race_type"] == "stage_race":
                pending_stages = stages_by_race.get(race["id"], [])
                if not pending_stages:
                    _log("  No pending stages")
                    continue

                _log(f"  {len(pending_stages)} stages to process")

                for stage in pending_stages:
                    stage_num = stage["stage_number"]
                    _log(f"  Stage {stage_num}:")

                    results, jerseys, stage_profile, won_how = scrape_stage_results(
                        race["pcs_slug"], stage_num, client,
                    )
                    if not results:
                        _warn(f"    No results for stage {stage_num}")
                        continue

                    filename = f"results_{race['pcs_slug']}_stage{stage_num}.json"
                    save_json(os.path.join(DATA_DIR, filename), results)
                    _log(f"    Parsed {len(results)} results")

                    if jerseys:
                        _log(f"    Jerseys: {jerseys}")

                    upserted, unmatched = upload_results(
                        results, race["id"], stage_num, rider_index, supabase,
                        jersey_holders=jerseys,
                    )
                    total_upserted += upserted
                    total_unmatched += unmatched
                    _log(f"    Upserted {upserted}, unmatched {unmatched}")

                    # Update stage profile + won_how if parsed
                    stage_update: dict = {}
                    if stage_profile:
                        stage_update["profile"] = stage_profile
                    if won_how:
                        stage_update["won_how"] = won_how
                    if stage_update:
                        try:
                            supabase.table("cycling_stages").update(
                                stage_update
                            ).eq("id", stage["id"]).execute()
                            if stage_profile:
                                _log(f"    Profile: {stage_profile}")
                            if won_how:
                                _log(f"    Won how: {won_how}")
                        except APIError as e:
                            _warn(f"    Failed to update stage info: {e}")

                    update_results_timestamp(supabase, "cycling_stages", stage["id"])

    # Log
    log_sync(supabase, total_upserted, total_unmatched, total_startlists, errors)

    # Summary
    _log("\n" + "=" * 60)
    _log("  RESULTS SYNC COMPLETE")
    _log("=" * 60)
    _log(f"  Startlists:     {total_startlists}")
    _log(f"  Results:        {total_upserted}")
    _log(f"  Unmatched:      {total_unmatched}")

    result = {
        "ok": True,
        "startlists_upserted": total_startlists,
        "results_upserted": total_upserted,
        "total_unmatched": total_unmatched,
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
