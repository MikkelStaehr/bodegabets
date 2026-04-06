"""
sync_all.py — Full sync of cycling data: riders, races, and stages.

Usage:
    python scripts/cycling/sync_all.py

Runs both steps automatically — no flags needed.

Step 1 — Scrape & generate data:
    a) WorldTour team rosters + UCI rankings → data/riders.json
    b) Hardcoded 29 races → data/races.json
    c) For each stage_race: scrape stage list from PCS → data/stages.json

Step 2 — Upload to Supabase:
    a) cycling_riders on pcs_slug
    b) cycling_races on pcs_slug
    c) cycling_stages on (race_id, stage_number)
    d) Log to cycling_sync_log with sync_type=full_sync

Environment variables (loaded from .env.local or shell):
    NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""

import sys
import os
import re
import json
import time
import traceback
from datetime import datetime

import httpx
from bs4 import BeautifulSoup
from supabase import create_client, Client
from postgrest.exceptions import APIError

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PCS_BASE = "https://www.procyclingstats.com"
TEAMS_URL = f"{PCS_BASE}/teams.php?year=2026&circuit=1"
RANKINGS_BASE = f"{PCS_BASE}/rankings.php?p=me&s=individual&filter=Filter"

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
RIDERS_JSON = os.path.join(DATA_DIR, "riders.json")
RACES_JSON = os.path.join(DATA_DIR, "races.json")
STAGES_JSON = os.path.join(DATA_DIR, "stages.json")

YEAR = 2026

# ---------------------------------------------------------------------------
# Race definitions
# ---------------------------------------------------------------------------

RACES = [
    # Grand Tours
    {"name": "Tour de France", "pcs_slug": "tour-de-france", "race_type": "stage_race", "profile": "mountain", "year": YEAR, "start_date": "2026-07-04", "end_date": "2026-07-26"},
    {"name": "Giro d'Italia", "pcs_slug": "giro-d-italia", "race_type": "stage_race", "profile": "mountain", "year": YEAR, "start_date": "2026-05-09", "end_date": "2026-05-31"},
    {"name": "Vuelta a España", "pcs_slug": "vuelta-a-espana", "race_type": "stage_race", "profile": "mountain", "year": YEAR, "start_date": "2026-08-15", "end_date": "2026-09-06"},
    # Stage races
    {"name": "Paris-Nice", "pcs_slug": "paris-nice", "race_type": "stage_race", "profile": "mixed", "year": YEAR, "start_date": "2026-03-08", "end_date": "2026-03-15"},
    {"name": "Tirreno-Adriatico", "pcs_slug": "tirreno-adriatico", "race_type": "stage_race", "profile": "mixed", "year": YEAR, "start_date": "2026-03-11", "end_date": "2026-03-17"},
    {"name": "Volta a Catalunya", "pcs_slug": "volta-a-catalunya", "race_type": "stage_race", "profile": "mountain", "year": YEAR, "start_date": "2026-03-23", "end_date": "2026-03-29"},
    {"name": "Tour de Romandie", "pcs_slug": "tour-de-romandie", "race_type": "stage_race", "profile": "mountain", "year": YEAR, "start_date": "2026-04-28", "end_date": "2026-05-03"},
    {"name": "Tour de Suisse", "pcs_slug": "tour-de-suisse", "race_type": "stage_race", "profile": "mountain", "year": YEAR, "start_date": "2026-06-14", "end_date": "2026-06-22"},
    {"name": "Critérium du Dauphiné", "pcs_slug": "dauphine", "race_type": "stage_race", "profile": "mountain", "year": YEAR, "start_date": "2026-06-07", "end_date": "2026-06-14"},
    {"name": "Itzulia Basque Country", "pcs_slug": "itzulia-basque-country", "race_type": "stage_race", "profile": "hilly", "year": YEAR, "start_date": "2026-04-06", "end_date": "2026-04-11"},
    # Monuments (one_day: end_date = start_date)
    {"name": "Milano-Sanremo", "pcs_slug": "milano-sanremo", "race_type": "one_day", "profile": "flat", "year": YEAR, "start_date": "2026-03-21", "end_date": "2026-03-21"},
    {"name": "Ronde van Vlaanderen", "pcs_slug": "ronde-van-vlaanderen", "race_type": "one_day", "profile": "cobbled", "year": YEAR, "start_date": "2026-04-05", "end_date": "2026-04-05"},
    {"name": "Paris-Roubaix", "pcs_slug": "paris-roubaix", "race_type": "one_day", "profile": "cobbled", "year": YEAR, "start_date": "2026-04-12", "end_date": "2026-04-12"},
    {"name": "Liège-Bastogne-Liège", "pcs_slug": "liege-bastogne-liege", "race_type": "one_day", "profile": "hilly", "year": YEAR, "start_date": "2026-04-26", "end_date": "2026-04-26"},
    {"name": "Il Lombardia", "pcs_slug": "il-lombardia", "race_type": "one_day", "profile": "hilly", "year": YEAR, "start_date": "2026-10-10", "end_date": "2026-10-10"},
    # Championships
    {"name": "World Championships", "pcs_slug": "world-championship", "race_type": "one_day", "profile": "mixed", "year": YEAR, "start_date": "2026-09-20", "end_date": "2026-09-20"},
    {"name": "European Championships", "pcs_slug": "uec-road-european-championships", "race_type": "one_day", "profile": "mixed", "year": YEAR, "start_date": "2026-09-13", "end_date": "2026-09-13"},
    # Classics — cobbled
    {"name": "Omloop Het Nieuwsblad", "pcs_slug": "omloop-het-nieuwsblad", "race_type": "one_day", "profile": "cobbled", "year": YEAR, "start_date": "2026-02-28", "end_date": "2026-02-28"},
    {"name": "Strade Bianche", "pcs_slug": "strade-bianche", "race_type": "one_day", "profile": "mixed", "year": YEAR, "start_date": "2026-03-07", "end_date": "2026-03-07"},
    {"name": "E3 Classic", "pcs_slug": "e3-harelbeke", "race_type": "one_day", "profile": "cobbled", "year": YEAR, "start_date": "2026-03-27", "end_date": "2026-03-27"},
    {"name": "Gent-Wevelgem", "pcs_slug": "gent-wevelgem", "race_type": "one_day", "profile": "cobbled", "year": YEAR, "start_date": "2026-03-29", "end_date": "2026-03-29"},
    {"name": "Dwars door Vlaanderen", "pcs_slug": "dwars-door-vlaanderen", "race_type": "one_day", "profile": "cobbled", "year": YEAR, "start_date": "2026-04-01", "end_date": "2026-04-01"},
    # Classics — hilly/other
    {"name": "Eschborn-Frankfurt", "pcs_slug": "eschborn-frankfurt", "race_type": "one_day", "profile": "hilly", "year": YEAR, "start_date": "2026-05-01", "end_date": "2026-05-01"},
    {"name": "Amstel Gold Race", "pcs_slug": "amstel-gold-race", "race_type": "one_day", "profile": "hilly", "year": YEAR, "start_date": "2026-04-19", "end_date": "2026-04-19"},
    {"name": "La Flèche Wallonne", "pcs_slug": "la-fleche-wallonne", "race_type": "one_day", "profile": "hilly", "year": YEAR, "start_date": "2026-04-22", "end_date": "2026-04-22"},
    {"name": "San Sebastián", "pcs_slug": "san-sebastian", "race_type": "one_day", "profile": "hilly", "year": YEAR, "start_date": "2026-08-01", "end_date": "2026-08-01"},
    {"name": "Bretagne Classic", "pcs_slug": "bretagne-classic", "race_type": "one_day", "profile": "hilly", "year": YEAR, "start_date": "2026-08-29", "end_date": "2026-08-29"},
    {"name": "GP Québec", "pcs_slug": "gp-quebec", "race_type": "one_day", "profile": "hilly", "year": YEAR, "start_date": "2026-09-11", "end_date": "2026-09-11"},
    {"name": "GP Montréal", "pcs_slug": "gp-montreal", "race_type": "one_day", "profile": "hilly", "year": YEAR, "start_date": "2026-09-13", "end_date": "2026-09-13"},
]

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


def ranking_to_category(ranking: int) -> int:
    if ranking <= 24:
        return 1
    elif ranking <= 49:
        return 2
    elif ranking <= 99:
        return 3
    elif ranking <= 199:
        return 4
    else:
        return 5


def save_json(path: str, data: object) -> None:
    with open(path, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    _log(f"  Saved {path}")


# ---------------------------------------------------------------------------
# Step 1a: Scrape riders
# ---------------------------------------------------------------------------


def scrape_teams(client: httpx.Client) -> list[dict]:
    _log(f"  Fetching teams: {TEAMS_URL}")
    soup = pcs_get(TEAMS_URL, client)
    time.sleep(REQUEST_DELAY)

    team_re = re.compile(r"^team/([\w-]+-\d{4})$")
    teams: list[dict] = []
    seen: set[str] = set()

    for a in soup.find_all("a", href=team_re):
        m = team_re.match(a["href"])
        if not m:
            continue
        slug = m.group(1)
        if slug in seen:
            continue
        seen.add(slug)
        teams.append({
            "team_slug": slug,
            "team_name": a.get_text(strip=True),
            "team_url": f"{PCS_BASE}/{a['href']}",
        })

    return teams


def scrape_team_logo(soup: BeautifulSoup) -> str | None:
    """Extract team jersey/shirt image URL from PCS team page.

    The shirt image is an <img> with src containing 'images/shirts/'
    inside a <div class="value">.
    """
    for div in soup.find_all("div", class_="value"):
        img = div.find("img", src=re.compile(r"images/shirts/"))
        if img and img.get("src"):
            src = img["src"]
            return f"{PCS_BASE}/{src}" if not src.startswith("http") else src

    return None


def scrape_team_riders(team: dict, client: httpx.Client) -> tuple[list[dict], str | None]:
    url = team["team_url"]
    _log(f"    Fetching: {url}")
    soup = pcs_get(url, client)
    time.sleep(REQUEST_DELAY)

    # Extract team logo
    logo_url = scrape_team_logo(soup)
    if logo_url:
        _log(f"    Logo: {logo_url[:80]}")
    else:
        _warn(f"    No logo found for {team['team_name']}")

    roster_ul = soup.find("ul", class_="teamlist")
    if not roster_ul:
        _warn(f"No <ul class='teamlist'> for {team['team_name']}, falling back to full page")
        roster_ul = soup

    # Build rider photo lookup: find all <img> with src containing 'images/riders/'
    rider_photos: dict[str, str] = {}
    for img in soup.find_all("img", src=re.compile(r"images/riders/")):
        src = img.get("src", "")
        # Find the closest <a href="rider/slug"> parent or sibling
        parent_a = img.find_parent("a", href=re.compile(r"^rider/([\w-]+)$"))
        if parent_a:
            slug_match = re.match(r"^rider/([\w-]+)$", parent_a["href"])
            if slug_match:
                photo_url = f"{PCS_BASE}/{src}" if not src.startswith("http") else src
                rider_photos[slug_match.group(1)] = photo_url

    rider_re = re.compile(r"^rider/([\w-]+)$")
    riders: list[dict] = []
    seen: set[str] = set()

    for a in roster_ul.find_all("a", href=rider_re):
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

        full_name = " ".join(name_parts)
        parts = full_name.split()
        upper_parts = [p for p in parts if p.isupper() and len(p) > 1]
        if upper_parts:
            last_name = " ".join(upper_parts)
            first_name = " ".join(p for p in parts if p not in upper_parts)
        else:
            last_name = parts[-1] if parts else ""
            first_name = " ".join(parts[:-1]) if len(parts) > 1 else ""

        riders.append({
            "pcs_slug": pcs_slug,
            "first_name": first_name,
            "last_name": last_name,
            "team_name": team["team_name"],
            "team_logo_url": logo_url,
            "photo_url": rider_photos.get(pcs_slug),
        })

    return riders, logo_url


def scrape_race_profile_image(pcs_slug: str, year: int, client: httpx.Client) -> str | None:
    """Extract route profile image from PCS race page.

    Looks for an <img> whose src contains 'images/profiles/' or 'profile'.
    """
    url = f"{PCS_BASE}/race/{pcs_slug}/{year}"
    soup = pcs_get(url, client)
    time.sleep(REQUEST_DELAY)

    for img in soup.find_all("img", src=re.compile(r"images/profiles/|profile")):
        src = img.get("src", "")
        if not src:
            continue
        return f"{PCS_BASE}/{src}" if not src.startswith("http") else src

    return None


def scrape_rankings_index(client: httpx.Client, target_slugs: set[str]) -> dict[str, int]:
    index: dict[str, int] = {}
    offset = 0
    rider_re = re.compile(r"^rider/([\w-]+)$")

    while True:
        url = f"{RANKINGS_BASE}&offset={offset}"
        _log(f"  Fetching rankings: offset={offset}")
        soup = pcs_get(url, client)
        time.sleep(REQUEST_DELAY)

        page_count = 0
        for tr in soup.find_all("tr"):
            a = tr.find("a", href=rider_re)
            if not a:
                continue
            m = rider_re.match(a["href"])
            if not m:
                continue
            pcs_slug = m.group(1)
            if pcs_slug in index:
                continue
            cells = tr.find_all("td")
            if not cells:
                continue
            pos_text = re.sub(r"[^\d]", "", cells[0].get_text(strip=True))
            if pos_text.isdigit():
                index[pcs_slug] = int(pos_text)
                page_count += 1

        _log(f"    Indexed {page_count} new riders (total: {len(index)})")

        if page_count == 0:
            break

        remaining = target_slugs - set(index.keys())
        if not remaining:
            _log(f"  All {len(target_slugs)} target riders found in rankings")
            break

        offset += 100

    return index


def scrape_all_riders(client: httpx.Client) -> list[dict]:
    _log("  Fetching WorldTour teams...")
    teams = scrape_teams(client)
    _log(f"  Found {len(teams)} teams")

    if not teams:
        _die("No WorldTour teams found. PCS page structure may have changed.")

    all_riders: list[dict] = []
    for i, team in enumerate(teams, 1):
        _log(f"  [{i}/{len(teams)}] {team['team_name']}")
        team_riders, _logo = scrape_team_riders(team, client)
        _log(f"    → {len(team_riders)} riders")
        all_riders.extend(team_riders)

    _log(f"  Total riders from team pages: {len(all_riders)}")

    # Deduplicate on pcs_slug — keep last occurrence (active team)
    seen: dict[str, int] = {}
    for i, rider in enumerate(all_riders):
        seen[rider["pcs_slug"]] = i
    unique_indices = sorted(seen.values())
    dupes = len(all_riders) - len(unique_indices)
    if dupes > 0:
        _log(f"  Removed {dupes} duplicate riders")
    all_riders = [all_riders[i] for i in unique_indices]
    _log(f"  Unique riders: {len(all_riders)}")

    # Enrich with rankings
    target_slugs = {r["pcs_slug"] for r in all_riders}
    _log(f"  Building UCI rankings index for {len(target_slugs)} riders...")
    rankings = scrape_rankings_index(client, target_slugs)
    _log(f"  Rankings index: {len(rankings)} riders")

    ranked = 0
    for rider in all_riders:
        ranking = rankings.get(rider["pcs_slug"])
        if ranking is not None:
            rider["uci_ranking"] = ranking
            rider["category"] = ranking_to_category(ranking)
            ranked += 1
        else:
            rider["uci_ranking"] = None
            rider["category"] = 5

    _log(f"  Matched rankings for {ranked}/{len(all_riders)} riders")
    return all_riders


# ---------------------------------------------------------------------------
# Step 1c: Scrape stages for stage races
# ---------------------------------------------------------------------------


def scrape_stages(client: httpx.Client) -> list[dict]:
    """Scrape stage lists for all stage_race entries in RACES."""
    stage_races = [r for r in RACES if r["race_type"] == "stage_race"]
    all_stages: list[dict] = []

    for race in stage_races:
        slug = race["pcs_slug"]
        url = f"{PCS_BASE}/race/{slug}/{YEAR}"
        _log(f"  Fetching stages: {slug}")
        soup = pcs_get(url, client)
        time.sleep(REQUEST_DELAY)

        stages = _parse_stages(soup, slug)
        _log(f"    → {len(stages)} stages")
        all_stages.extend(stages)

    return all_stages


def _parse_stages(soup: BeautifulSoup, race_slug: str) -> list[dict]:
    """
    Parse stages from PCS race page using two sources:

    1. Stage links: href="race/{slug}/{year}/stage-{N}" with text like
       "Stage 1 (TTT) | Barcelona - Barcelona"

    2. Stages table (first <table>): rows with format
       Date | Day | Stage Name | KM
       "04/07 | Saturday | Stage 1 (TTT) | Barcelona - Barcelona | 19"
    """
    # Strategy 1: Parse stage links (reliable for stage number + name)
    stage_link_re = re.compile(
        rf"^race/{re.escape(race_slug)}/{YEAR}/(stage-(\d+)|prologue)$"
    )

    stages: list[dict] = []
    seen_nums: set[int] = set()

    for a in soup.find_all("a", href=stage_link_re):
        m = stage_link_re.match(a["href"])
        if not m:
            continue

        if m.group(1) == "prologue":
            stage_num = 0
        else:
            stage_num = int(m.group(2))

        if stage_num in seen_nums:
            continue
        seen_nums.add(stage_num)

        # Text format: "Stage 1 (TTT) | Barcelona - Barcelona"
        text = a.get_text(strip=True)
        # Split on " | " to get stage name/route
        parts = text.split(" | ", 1)
        stage_name = parts[1] if len(parts) > 1 else text

        stages.append({
            "race_pcs_slug": race_slug,
            "stage_number": stage_num,
            "date": None,
            "name": stage_name,
            "profile": "mixed",
        })

    stages.sort(key=lambda s: s["stage_number"])

    # Strategy 2: Enrich with dates from stages table
    # Table rows: Date | Day | Stage description | KM
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue

        # Check if first row header contains "Date" or "KM"
        header = rows[0].get_text(strip=True).lower()
        if "date" not in header and "km" not in header:
            continue

        stage_idx = 0
        for tr in rows[1:]:
            cells = tr.find_all("td")
            if len(cells) < 3:
                continue

            # First cell is date (DD/MM format)
            date_text = cells[0].get_text(strip=True)
            date_match = re.match(r"(\d{1,2})/(\d{1,2})", date_text)

            # Find which stage this row belongs to by looking for stage link
            stage_link = tr.find("a", href=stage_link_re)
            if stage_link:
                m2 = stage_link_re.match(stage_link["href"])
                if m2:
                    sn = 0 if m2.group(1) == "prologue" else int(m2.group(2))
                    # Find matching stage and set date
                    if date_match:
                        day = int(date_match.group(1))
                        month = int(date_match.group(2))
                        for s in stages:
                            if s["stage_number"] == sn and s["date"] is None:
                                s["date"] = f"{YEAR}-{month:02d}-{day:02d}"
                                break

        break  # Only process first matching table

    return stages


# ---------------------------------------------------------------------------
# Step 2: Upload to Supabase
# ---------------------------------------------------------------------------


def upsert_batch(supabase: Client, table: str, rows: list[dict],
                 conflict: str, batch_size: int = 50) -> tuple[int, list[str]]:
    errors: list[str] = []
    upserted = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        try:
            supabase.table(table).upsert(batch, on_conflict=conflict).execute()
            upserted += len(batch)
        except APIError as e:
            err = f"{table} batch {i // batch_size + 1} failed: {e}"
            _warn(err)
            errors.append(err)
    return upserted, errors


def upload_all(
    riders: list[dict],
    races: list[dict],
    stages: list[dict],
    supabase: Client,
) -> dict:
    results: dict = {"errors": []}

    # Riders
    _log("  Upserting cycling_riders...")
    count, errs = upsert_batch(supabase, "cycling_riders", riders, "pcs_slug")
    results["riders_upserted"] = count
    results["errors"].extend(errs)
    _log(f"  → {count} riders")

    # Races
    _log("  Upserting cycling_races...")
    count, errs = upsert_batch(supabase, "cycling_races", races, "pcs_slug")
    results["races_upserted"] = count
    results["errors"].extend(errs)
    _log(f"  → {count} races")

    # Stages — need race_id from DB
    if stages:
        _log("  Resolving race IDs for stages...")
        slug_to_id = _resolve_race_ids(supabase)

        stage_rows = []
        for s in stages:
            race_id = slug_to_id.get(s["race_pcs_slug"])
            if not race_id:
                _warn(f"No race_id for {s['race_pcs_slug']} stage {s['stage_number']}")
                continue
            stage_rows.append({
                "race_id": race_id,
                "stage_number": s["stage_number"],
                "start_date": s["date"],
                "name": s["name"],
                "profile": s["profile"],
            })

        _log(f"  Upserting {len(stage_rows)} stages...")
        count, errs = upsert_batch(
            supabase, "cycling_stages", stage_rows, "race_id,stage_number"
        )
        results["stages_upserted"] = count
        results["errors"].extend(errs)
        _log(f"  → {count} stages")
    else:
        results["stages_upserted"] = 0

    return results


def _resolve_race_ids(supabase: Client) -> dict[str, str]:
    try:
        resp = supabase.table("cycling_races").select("id, pcs_slug").execute()
        return {r["pcs_slug"]: r["id"] for r in (resp.data or [])}
    except APIError as e:
        _warn(f"Failed to resolve race IDs: {e}")
        return {}


def log_sync(supabase: Client, results: dict) -> None:
    total = (
        results.get("riders_upserted", 0)
        + results.get("races_upserted", 0)
        + results.get("stages_upserted", 0)
    )
    status = "success" if not results["errors"] else "error"
    message = (
        f"riders={results.get('riders_upserted', 0)}, "
        f"races={results.get('races_upserted', 0)}, "
        f"stages={results.get('stages_upserted', 0)}"
    )
    if results["errors"]:
        message += f" | {len(results['errors'])} error(s)"

    try:
        supabase.table("cycling_sync_log").insert({
            "sync_type": "full_sync",
            "records_affected": total,
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
    parser = argparse.ArgumentParser(description="Full cycling data sync.")
    parser.add_argument(
        "--debug-stages",
        type=str,
        default=None,
        metavar="SLUG",
        help="Fetch a race page (e.g. tour-de-france) and dump stage-related links + raw HTML, then exit",
    )
    parser.add_argument(
        "--debug-logo",
        action="store_true",
        help="Fetch INEOS Grenadiers team page and dump all <img> tags, then exit",
    )
    parser.add_argument(
        "--debug-race-logo",
        action="store_true",
        help="Fetch Paris-Roubaix race page and dump all <img> tags, then exit",
    )
    args = parser.parse_args()

    load_dotenv_local()
    os.makedirs(DATA_DIR, exist_ok=True)

    if args.debug_logo:
        url = f"{PCS_BASE}/team/ineos-grenadiers-2026"
        _log(f"Fetching: {url}")
        with httpx.Client(headers=PCS_HEADERS) as client:
            resp = client.get(url, timeout=30, follow_redirects=True)
            _log(f"Status: {resp.status_code}")
            _log(f"Final URL: {resp.url}")
            soup = BeautifulSoup(resp.text, "html.parser")
            imgs = soup.find_all("img")
            _log(f"\nAll <img> tags: {len(imgs)}\n")
            for i, img in enumerate(imgs):
                src = img.get("src", "")
                alt = img.get("alt", "")
                cls = " ".join(img.get("class", []))
                parent_cls = " ".join(img.parent.get("class", [])) if img.parent else ""
                _log(f"  [{i}] src={src}")
                _log(f"       alt={alt}")
                _log(f"       class={cls}")
                _log(f"       parent_tag={img.parent.name if img.parent else ''} parent_class={parent_cls}")
                _log("")
        return

    if args.debug_race_logo:
        url = f"{PCS_BASE}/race/paris-roubaix/{YEAR}"
        _log(f"Fetching: {url}")
        with httpx.Client(headers=PCS_HEADERS) as client:
            resp = client.get(url, timeout=30, follow_redirects=True)
            _log(f"Status: {resp.status_code}")
            _log(f"Final URL: {resp.url}")
            soup = BeautifulSoup(resp.text, "html.parser")
            imgs = soup.find_all("img")
            _log(f"\nAll <img> tags: {len(imgs)}\n")
            for i, img in enumerate(imgs):
                src = img.get("src", "")
                alt = img.get("alt", "")
                cls = " ".join(img.get("class", []))
                parent_cls = " ".join(img.parent.get("class", [])) if img.parent else ""
                _log(f"  [{i}] src={src}")
                _log(f"       alt={alt}")
                _log(f"       class={cls}")
                _log(f"       parent_tag={img.parent.name if img.parent else ''} parent_class={parent_cls}")
                _log("")
        return

    if args.debug_stages:
        slug = args.debug_stages
        with httpx.Client(headers=PCS_HEADERS) as client:
            # Try main race page
            url = f"{PCS_BASE}/race/{slug}/{YEAR}"
            _log(f"Fetching: {url}")
            resp = client.get(url, timeout=30, follow_redirects=True)
            _log(f"Status: {resp.status_code}")
            _log(f"Final URL: {resp.url}")
            _log(f"Content-Length: {len(resp.text)}")

            soup = BeautifulSoup(resp.text, "html.parser")

            # All links containing "stage" in href
            stage_links = soup.find_all("a", href=re.compile(r"stage", re.I))
            _log(f"\nLinks with 'stage' in href: {len(stage_links)}")
            seen_hrefs: set[str] = set()
            for a in stage_links:
                href = a.get("href", "")
                if href in seen_hrefs:
                    continue
                seen_hrefs.add(href)
                text = a.get_text(strip=True)[:60]
                _log(f"  href={href}  text={text}")

            # Also check /stages subpage
            stages_url = f"{PCS_BASE}/race/{slug}/{YEAR}/stages"
            _log(f"\nFetching stages subpage: {stages_url}")
            resp2 = client.get(stages_url, timeout=30, follow_redirects=True)
            _log(f"Status: {resp2.status_code}")
            _log(f"Final URL: {resp2.url}")

            soup2 = BeautifulSoup(resp2.text, "html.parser")
            stage_links2 = soup2.find_all("a", href=re.compile(r"stage", re.I))
            seen2: set[str] = set()
            _log(f"Links with 'stage' in href: {len(stage_links2)}")
            for a in stage_links2:
                href = a.get("href", "")
                if href in seen2:
                    continue
                seen2.add(href)
                text = a.get_text(strip=True)[:60]
                _log(f"  href={href}  text={text}")

            # Table rows
            tables = soup2.find_all("table")
            _log(f"\nTables on stages page: {len(tables)}")
            for i, table in enumerate(tables):
                rows = table.find_all("tr")
                _log(f"  Table {i}: {len(rows)} rows")
                for tr in rows[:3]:
                    _log(f"    {tr.get_text(' | ', strip=True)[:120]}")

            _log("\n--- Raw HTML main page (first 2000 chars) ---")
            print(resp.text[:2000])
        return

    _log("=" * 60)
    _log("  CYCLING FULL SYNC")
    _log("=" * 60)

    # ── Step 1: Scrape & generate ────────────────────────────────
    _log("\n→ Step 1: Scraping data from PCS...")

    with httpx.Client(headers=PCS_HEADERS) as client:
        # 1a. Riders
        _log("\n─ 1a. Riders ─")
        riders = scrape_all_riders(client)
        save_json(RIDERS_JSON, riders)

        # 1b. Races + profile images
        _log("\n─ 1b. Races ─")
        races = [dict(r) for r in RACES]
        _log(f"  Defined {len(races)} races")
        _log("  Scraping race profile images...")
        for race in races:
            img_url = scrape_race_profile_image(race["pcs_slug"], race["year"], client)
            race["profile_image_url"] = img_url
            if img_url:
                _log(f"    {race['pcs_slug']}: {img_url[:70]}")
            else:
                _warn(f"    {race['pcs_slug']}: no profile image found")
        save_json(RACES_JSON, races)

        # 1c. Stages
        _log("\n─ 1c. Stages ─")
        stages = scrape_stages(client)
        _log(f"  Total stages: {len(stages)}")
        save_json(STAGES_JSON, stages)

    # ── Step 2: Upload to Supabase ───────────────────────────────
    _log("\n→ Step 2: Uploading to Supabase...")

    supabase_url = require_env("NEXT_PUBLIC_SUPABASE_URL")
    service_key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(supabase_url, service_key)

    results = upload_all(riders, races, stages, supabase)

    # Log
    log_sync(supabase, results)

    # Summary
    _log("\n" + "=" * 60)
    _log("  SYNC COMPLETE")
    _log("=" * 60)
    _log(f"  Riders: {results['riders_upserted']}")
    _log(f"  Races:  {results['races_upserted']}")
    _log(f"  Stages: {results['stages_upserted']}")

    if results["errors"]:
        _warn(f"\n  {len(results['errors'])} error(s):")
        for err in results["errors"]:
            _warn(f"    {err}")

    print(json.dumps(results, ensure_ascii=False))


if __name__ == "__main__":
    main()
