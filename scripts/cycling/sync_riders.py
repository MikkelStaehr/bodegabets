"""
sync_riders.py — Scrape UCI WorldTour team rosters from PCS and store in cycling_riders.

Usage:
    python scripts/cycling/sync_riders.py                # scrape + upload
    python scripts/cycling/sync_riders.py --scrape-only  # only write data/riders.json
    python scripts/cycling/sync_riders.py --upload-only  # only read JSON and upsert

Flow:
    Step 1: Scrape WorldTour teams from
            https://www.procyclingstats.com/teams.php?year=2026&circuit=1
            For each team, fetch the team page and parse all riders (name, pcs_slug).
            Then scrape the individual rankings page to look up UCI ranking for each rider.
            Assign category based on ranking: 1-24→1, 25-49→2, 50-99→3, 100-199→4, 200+→5.
            Save to data/riders.json.
    Step 2: Read data/riders.json and upsert to cycling_riders in Supabase on pcs_slug.

Environment variables (loaded from .env.local or shell):
    NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""

import sys
import os
import re
import json
import time
import argparse

import httpx
from bs4 import BeautifulSoup
from supabase import create_client, Client
from postgrest.exceptions import APIError

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PCS_BASE = "https://www.procyclingstats.com"
TEAMS_URL = f"{PCS_BASE}/teams.php?year=2026&circuit=1"
RANKINGS_URL = f"{PCS_BASE}/rankings/me/individual"

PCS_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

REQUEST_DELAY = 1.5  # seconds between PCS requests
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
RIDERS_JSON = os.path.join(DATA_DIR, "riders.json")

# ---------------------------------------------------------------------------
# Environment helpers
# ---------------------------------------------------------------------------


def load_dotenv_local() -> None:
    """Load .env.local from project root (two levels up from this script)."""
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


# ---------------------------------------------------------------------------
# PCS fetch helper
# ---------------------------------------------------------------------------


def pcs_get(url: str, client: httpx.Client, retries: int = 2) -> BeautifulSoup:
    """Fetch a PCS URL and return a BeautifulSoup object, with retry on 5xx."""
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


# ---------------------------------------------------------------------------
# Category assignment
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Step 1a: Scrape WorldTour team rosters
# ---------------------------------------------------------------------------


def scrape_teams(client: httpx.Client) -> list[dict]:
    """
    Fetch the WT teams page and return a list of
    {"team_slug": str, "team_name": str, "team_url": str}.

    PCS teams page structure:
      <div class="teams"> or <ul class="list">
        <a href="team/{slug}/{year}">Team Name</a>
    """
    _log(f"  Fetching teams: {TEAMS_URL}")
    soup = pcs_get(TEAMS_URL, client)
    time.sleep(REQUEST_DELAY)

    # PCS team hrefs are "team/{slug-with-year}" e.g. "team/uae-team-emirates-xrg-2026"
    team_re = re.compile(r"^team/([\w-]+-\d{4})$")
    teams: list[dict] = []
    seen: set[str] = set()

    for a in soup.find_all("a", href=team_re):
        href: str = a["href"]
        m = team_re.match(href)
        if not m:
            continue

        slug = m.group(1)
        if slug in seen:
            continue
        seen.add(slug)

        teams.append({
            "team_slug": slug,
            "team_name": a.get_text(strip=True),
            "team_url": f"{PCS_BASE}/{href}",
        })

    return teams


def scrape_team_riders(team: dict, client: httpx.Client) -> list[dict]:
    """
    Fetch a team page and parse all riders.

    PCS team page rider structure:
      <a href="rider/{slug}">
        <span class="uppercase">LASTNAME</span> Firstname
      </a>
    """
    url = team["team_url"]
    _log(f"    Fetching: {url}")
    soup = pcs_get(url, client)
    time.sleep(REQUEST_DELAY)

    rider_re = re.compile(r"^rider/([\w-]+)$")
    riders: list[dict] = []
    seen: set[str] = set()

    for a in soup.find_all("a", href=rider_re):
        href: str = a["href"]
        m = rider_re.match(href)
        if not m:
            continue

        pcs_slug = m.group(1)
        if pcs_slug in seen:
            continue
        seen.add(pcs_slug)

        name_parts = list(a.stripped_strings)
        if not name_parts:
            continue
        full_name = " ".join(name_parts)

        # Split into last/first: the uppercase span contains the last name
        uppercase_span = a.find("span", class_="uppercase")
        if uppercase_span:
            last_name = uppercase_span.get_text(strip=True)
            first_name = full_name.replace(last_name, "").strip()
        else:
            parts = full_name.split()
            upper_parts = [p for p in parts if p.isupper()]
            if upper_parts:
                last_name = " ".join(upper_parts)
                first_name = " ".join(p for p in parts if not p.isupper())
            else:
                last_name = parts[-1] if parts else ""
                first_name = " ".join(parts[:-1]) if len(parts) > 1 else ""

        riders.append({
            "pcs_slug": pcs_slug,
            "first_name": first_name,
            "last_name": last_name,
            "team_name": team["team_name"],
        })

    return riders


# ---------------------------------------------------------------------------
# Step 1b: Scrape rankings to look up UCI ranking per rider
# ---------------------------------------------------------------------------


def scrape_rankings_index(client: httpx.Client) -> dict[str, int]:
    """
    Scrape PCS individual rankings and build a slug → ranking lookup.
    Paginates through all pages to cover riders outside the top 100.
    """
    index: dict[str, int] = {}
    offset = 0
    rider_re = re.compile(r"^rider/([\w-]+)$")

    while True:
        url = f"{RANKINGS_URL}?offset={offset}" if offset > 0 else RANKINGS_URL
        _log(f"  Fetching rankings: {url}")

        soup = pcs_get(url, client)
        time.sleep(REQUEST_DELAY)

        page_count = 0
        for a in soup.find_all("a", href=rider_re):
            href: str = a["href"]
            m = rider_re.match(href)
            if not m:
                continue

            pcs_slug = m.group(1)
            if pcs_slug in index:
                continue

            row = a.find_parent("tr")
            if not row:
                continue

            cells = row.find_all("td")
            if not cells:
                continue

            pos_text = re.sub(r"[^\d]", "", cells[0].get_text(strip=True))
            if pos_text.isdigit():
                index[pcs_slug] = int(pos_text)
                page_count += 1

        if page_count == 0:
            break

        _log(f"    Indexed {page_count} riders (total: {len(index)})")

        if page_count < 100:
            break

        offset += 100

    return index


# ---------------------------------------------------------------------------
# Step 1: Combined scrape
# ---------------------------------------------------------------------------


def scrape_all_riders() -> list[dict]:
    """Scrape WT team rosters, then enrich with UCI rankings."""
    all_riders: list[dict] = []

    with httpx.Client(headers=PCS_HEADERS) as client:
        # 1a. Get team list
        _log("  Fetching WorldTour teams...")
        teams = scrape_teams(client)
        _log(f"  Found {len(teams)} teams")

        if not teams:
            _die("No WorldTour teams found. PCS page structure may have changed.")

        # 1b. Get riders from each team
        for i, team in enumerate(teams, 1):
            _log(f"  [{i}/{len(teams)}] {team['team_name']}")
            team_riders = scrape_team_riders(team, client)
            _log(f"    → {len(team_riders)} riders")
            all_riders.extend(team_riders)

        _log(f"  Total riders from team pages: {len(all_riders)}")

        # 1c. Scrape rankings index
        _log("  Building UCI rankings index...")
        rankings = scrape_rankings_index(client)
        _log(f"  Rankings index: {len(rankings)} riders")

    # 1d. Enrich riders with ranking + category
    ranked = 0
    for rider in all_riders:
        ranking = rankings.get(rider["pcs_slug"])
        if ranking is not None:
            rider["uci_ranking"] = ranking
            rider["category"] = ranking_to_category(ranking)
            ranked += 1
        else:
            rider["uci_ranking"] = None
            rider["category"] = 5  # unranked riders get lowest category

    _log(f"  Matched rankings for {ranked}/{len(all_riders)} riders")

    return all_riders


# ---------------------------------------------------------------------------
# Step 2: Upload to Supabase
# ---------------------------------------------------------------------------


def upload_riders(riders: list[dict], supabase: Client) -> tuple[int, list[str]]:
    """Upsert riders to cycling_riders. Returns (upserted_count, errors)."""
    errors: list[str] = []
    upserted = 0

    # Upsert in batches of 50
    batch_size = 50
    for i in range(0, len(riders), batch_size):
        batch = riders[i : i + batch_size]
        try:
            supabase.table("cycling_riders").upsert(
                batch, on_conflict="pcs_slug"
            ).execute()
            upserted += len(batch)
        except APIError as e:
            err = f"Batch {i // batch_size + 1} failed: {e}"
            _warn(err)
            errors.append(err)

    return upserted, errors


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scrape PCS WorldTour team rosters and store in cycling_riders."
    )
    parser.add_argument(
        "--scrape-only",
        action="store_true",
        help="Only scrape and save to data/riders.json, skip Supabase upload",
    )
    parser.add_argument(
        "--upload-only",
        action="store_true",
        help="Only read data/riders.json and upload to Supabase",
    )
    parser.add_argument(
        "--debug-html",
        action="store_true",
        help="Fetch the teams page and print the first 2000 chars of raw HTML, then exit",
    )
    args = parser.parse_args()

    load_dotenv_local()
    os.makedirs(DATA_DIR, exist_ok=True)

    # --- Debug mode: dump raw HTML ---
    if args.debug_html:
        with httpx.Client(headers=PCS_HEADERS) as client:
            _log(f"Fetching: {TEAMS_URL}")
            resp = client.get(TEAMS_URL, timeout=30, follow_redirects=True)
            _log(f"Status: {resp.status_code}")
            _log(f"Final URL: {resp.url}")
            _log(f"Content-Length: {len(resp.text)}")
            _log("--- Raw HTML (first 2000 chars) ---")
            print(resp.text[:2000])
        return

    # --- Step 1: Scrape ---
    if not args.upload_only:
        _log("→ Step 1: Scraping WorldTour team rosters + rankings...")
        riders = scrape_all_riders()
        _log(f"✓ Scraped {len(riders)} riders")

        with open(RIDERS_JSON, "w") as f:
            json.dump(riders, f, ensure_ascii=False, indent=2)
        _log(f"✓ Saved to {RIDERS_JSON}")

        if args.scrape_only:
            _log("Done (scrape-only mode)")
            return
    else:
        if not os.path.exists(RIDERS_JSON):
            _die(f"{RIDERS_JSON} not found. Run without --upload-only first.")
        with open(RIDERS_JSON) as f:
            riders = json.load(f)
        _log(f"→ Loaded {len(riders)} riders from {RIDERS_JSON}")

    # --- Step 2: Upload ---
    _log("→ Step 2: Uploading to Supabase...")
    supabase_url = require_env("NEXT_PUBLIC_SUPABASE_URL")
    service_key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(supabase_url, service_key)

    upserted, errors = upload_riders(riders, supabase)
    _log(f"✓ Upserted {upserted} riders")

    if errors:
        _warn(f"{len(errors)} error(s):")
        for err in errors:
            _warn(f"  {err}")

    # Category breakdown
    by_cat: dict[int, int] = {}
    for r in riders:
        c = r.get("category", 5)
        by_cat[c] = by_cat.get(c, 0) + 1
    _log(f"  Categories: {dict(sorted(by_cat.items()))}")

    # Team breakdown
    by_team: dict[str, int] = {}
    for r in riders:
        t = r.get("team_name", "?")
        by_team[t] = by_team.get(t, 0) + 1
    _log(f"  Teams: {len(by_team)} ({', '.join(f'{t}: {n}' for t, n in sorted(by_team.items()))})")

    result = {
        "ok": len(errors) == 0,
        "riders_scraped": len(riders),
        "upserted": upserted,
        "errors": errors,
        "by_category": dict(sorted(by_cat.items())),
        "teams": len(by_team),
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
