"""
sync_results.py — Scrape race results from PCS and store in cycling_results.

Usage:
    python scripts/cycling/sync_results.py

Runs both steps automatically — no flags needed.

Step 1 — Find active/finished races and scrape results:
    - Fetches races with status=active or finished from Supabase
    - For one_day races: scrape top 25 from /race/{slug}/{year}
    - For stage_race: scrape top 25 per stage missing results
    - Saves per-race JSON to data/results_{slug}_{stage}.json

Step 2 — Match riders and upload:
    - Matches rider names against cycling_riders in Supabase
    - Upserts to cycling_results
    - Updates results_uploaded_at on races/stages
    - Logs to cycling_sync_log with sync_type=results_sync

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
TOP_N = 25
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
            _die(f"PCS returned HTTP {e.response.status_code} for {url}")
        except httpx.HTTPError as e:
            _die(f"HTTP error for {url}: {e}")
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


def scrape_race_results(slug: str, client: httpx.Client) -> list[dict]:
    """Scrape top N results from a one-day race or GC."""
    url = f"{PCS_BASE}/race/{slug}/{YEAR}"
    _log(f"    Fetching: {url}")
    soup = pcs_get(url, client)
    time.sleep(REQUEST_DELAY)
    return _parse_results_table(soup)


def scrape_stage_results(slug: str, stage_num: int, client: httpx.Client) -> list[dict]:
    """Scrape top N results from a specific stage."""
    if stage_num == 0:
        url = f"{PCS_BASE}/race/{slug}/{YEAR}/prologue"
    else:
        url = f"{PCS_BASE}/race/{slug}/{YEAR}/stage-{stage_num}"
    _log(f"    Fetching: {url}")
    soup = pcs_get(url, client)
    time.sleep(REQUEST_DELAY)
    return _parse_results_table(soup)


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
    Parse PCS results page. Structure:
      <tr>
        <td>1</td>                    ← position
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

        if row:
            cells = row.find_all("td")
            if cells:
                pos_text = cells[0].get_text(strip=True)
                if pos_text.lower() in ("dnf", "dns", "otl", "dsq"):
                    dnf = True
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
            # Use .string or direct text to avoid doubled text from nested elements.
            if len(cells) >= 4:
                last_td = cells[-1]
                # Prefer .string (leaf text) to avoid concatenation of child texts
                raw = last_td.string
                if raw is None:
                    # Fallback: join direct text nodes only (skip nested tags' text)
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
        })

        if len(results) >= TOP_N:
            break

    return results


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
    Scrape startlist from PCS for a single race.

    PCS startlist URL: /race/{slug}/{year}/startlist
    Structure: table rows with
      <td>bib number</td>
      <td><a href="rider/{slug}">LASTNAME Firstname</a></td>
    """
    url = f"{PCS_BASE}/race/{slug}/{year}/startlist"
    _log(f"    Fetching startlist: {url}")
    soup = pcs_get(url, client)
    time.sleep(REQUEST_DELAY)

    rider_re = re.compile(r"^rider/([\w-]+)$")
    entries: list[dict] = []
    seen: set[str] = set()

    for a in soup.find_all("a", href=rider_re):
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

        # Get bib number from parent row
        bib = None
        row = a.find_parent("tr")
        if row:
            first_td = row.find("td")
            if first_td:
                bib_text = first_td.get_text(strip=True)
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
    # Get race IDs that already have startlist entries
    try:
        resp = supabase.table("cycling_startlists").select("race_id").execute()
        has_startlist: set[str] = set()
        for row in resp.data or []:
            has_startlist.add(row["race_id"])
    except APIError as e:
        _warn(f"Failed to fetch existing startlists: {e}")
        has_startlist = set()

    total_upserted = 0

    for race in races:
        if race["id"] in has_startlist:
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

        rows.append({
            "race_id": race_id,
            "rider_id": rider_id,
            "stage_number": stage_number,
            "position": r["position"],
            "time_gap_seconds": r["time_gap_seconds"],
            "dnf": r["dnf"],
        })

    if not rows:
        return 0, unmatched

    try:
        supabase.table("cycling_results").upsert(
            rows, on_conflict="race_id,rider_id,stage_number"
        ).execute()
    except APIError as e:
        _warn(f"    Upsert failed: {e}")
        return 0, unmatched

    return len(rows), unmatched


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
    load_dotenv_local()
    os.makedirs(DATA_DIR, exist_ok=True)

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

    # Fetch stages for stage races
    stage_races_ids = [r["id"] for r in races if r["race_type"] == "stage_race"]
    stages_by_race: dict[int, list[dict]] = {}
    if stage_races_ids:
        try:
            resp = (
                supabase.table("cycling_stages")
                .select("id, race_id, stage_number, results_uploaded_at")
                .in_("race_id", stage_races_ids)
                .is_("results_uploaded_at", "null")
                .order("stage_number", desc=False)
                .execute()
            )
            for s in resp.data or []:
                stages_by_race.setdefault(s["race_id"], []).append(s)
        except APIError as e:
            _warn(f"Failed to fetch stages: {e}")

    # ── Startlists: scrape for races missing them ──────────────
    _log("\n→ Syncing startlists for races without entries...")
    with httpx.Client(headers=PCS_HEADERS) as client:
        total_startlists = sync_startlists(races, rider_index, client, supabase)
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
                results = scrape_race_results(race["pcs_slug"], client)
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

                    results = scrape_stage_results(
                        race["pcs_slug"], stage_num, client,
                    )
                    if not results:
                        _warn(f"    No results for stage {stage_num}")
                        continue

                    filename = f"results_{race['pcs_slug']}_stage{stage_num}.json"
                    save_json(os.path.join(DATA_DIR, filename), results)
                    _log(f"    Parsed {len(results)} results")

                    upserted, unmatched = upload_results(
                        results, race["id"], stage_num, rider_index, supabase,
                    )
                    total_upserted += upserted
                    total_unmatched += unmatched
                    _log(f"    Upserted {upserted}, unmatched {unmatched}")

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
