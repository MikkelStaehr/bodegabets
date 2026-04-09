"""
sync_race_info.py — Scrape "Race information" from PCS for all stages.

Usage:
    python scripts/cycling/sync_race_info.py
    python scripts/cycling/sync_race_info.py --only-missing

SQL migration (run once):
    ALTER TABLE cycling_stages ADD COLUMN IF NOT EXISTS distance_km numeric;
    ALTER TABLE cycling_stages ADD COLUMN IF NOT EXISTS departure text;
    ALTER TABLE cycling_stages ADD COLUMN IF NOT EXISTS arrival text;
    ALTER TABLE cycling_stages ADD COLUMN IF NOT EXISTS profile_score integer;
    ALTER TABLE cycling_stages ADD COLUMN IF NOT EXISTS vertical_meters integer;

Scrapes from each stage/race page on PCS:
  - Distance (km)
  - Departure city
  - Arrival city
  - ProfileScore
  - Vertical meters
  - Parcours type (updates profile column)

For one-day races: /race/{slug}/{year}
For stage races:   /race/{slug}/{year}/stage-{N}
"""

import sys
import os
import re
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

PROFILE_MAP = {
    "p1": "flat",
    "p2": "hilly",
    "p3": "mountain",
    "p4": "cobbled",
    "p5": "itt",
}

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
        print(f"ERROR: Missing {name}", file=sys.stderr)
        sys.exit(1)
    return value


def _log(msg: str) -> None:
    print(msg, flush=True)


def _warn(msg: str) -> None:
    print(f"WARNING: {msg}", file=sys.stderr)


def pcs_get(url: str, client: httpx.Client) -> BeautifulSoup:
    try:
        resp = client.get(url, timeout=30, follow_redirects=True)
        if resp.status_code == 404:
            return BeautifulSoup("", "html.parser")
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "html.parser")
    except httpx.HTTPStatusError as e:
        _warn(f"HTTP {e.response.status_code} for {url} — skipping")
        return BeautifulSoup("", "html.parser")
    except httpx.HTTPError as e:
        _warn(f"HTTP error for {url}: {e} — skipping")
        return BeautifulSoup("", "html.parser")


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------


def parse_race_info(soup: BeautifulSoup) -> dict:
    """
    Parse the "Race information" section from a PCS race/stage page.

    PCS typically uses <ul class="infolist"> with <li> items containing
    <div> pairs for label and value. Also sometimes a plain <div> with
    labeled children.

    Returns dict with keys: distance_km, departure, arrival,
    profile_score, vertical_meters, profile
    """
    info: dict = {}

    # Strategy 1: <ul class="infolist"> — most common on PCS
    infolist = soup.find("ul", class_="infolist")
    if infolist:
        for li in infolist.find_all("li"):
            divs = li.find_all("div")
            if len(divs) >= 2:
                label = divs[0].get_text(strip=True).lower()
                value = divs[1].get_text(strip=True)
                _extract_field(info, label, value, divs[1])

    # Strategy 2: look for labeled text anywhere in Race information section
    # Some PCS pages use a different layout
    if not info:
        for div in soup.find_all("div", class_=re.compile(r"(raceinfo|race-info|info)")):
            text = div.get_text("\n", strip=True)
            for line in text.split("\n"):
                parts = line.split(":", 1)
                if len(parts) == 2:
                    label = parts[0].strip().lower()
                    value = parts[1].strip()
                    _extract_field(info, label, value)

    # Strategy 3: parse profile from span classes (same as sync_results.py)
    if "profile" not in info:
        for span in soup.find_all("span", class_=re.compile(r"profile")):
            classes = " ".join(span.get("class", []))
            for pclass, pname in PROFILE_MAP.items():
                if pclass in classes:
                    info["profile"] = pname
                    break
            if "profile" in info:
                break

    return info


def _extract_field(info: dict, label: str, value: str, element=None) -> None:
    """Extract a single field from a label/value pair."""

    if "distance" in label:
        # "220 km" → 220
        m = re.search(r"([\d.]+)", value)
        if m:
            info["distance_km"] = float(m.group(1))

    elif "departure" in label:
        info["departure"] = value

    elif "arrival" in label:
        info["arrival"] = value

    elif "profilescore" in label:
        m = re.search(r"(\d+)", value)
        if m:
            info["profile_score"] = int(m.group(1))

    elif "vertical" in label:
        m = re.search(r"([\d,.]+)", value.replace(",", ""))
        if m:
            info["vertical_meters"] = int(float(m.group(1)))

    elif "parcours" in label:
        # Parcours type — check for profile icon in the element
        if element is not None:
            for span in element.find_all("span", class_=re.compile(r"profile|icon")):
                classes = " ".join(span.get("class", []))
                for pclass, pname in PROFILE_MAP.items():
                    if pclass in classes:
                        info["profile"] = pname
                        return
        # Fallback: parse text
        val_lower = value.lower()
        if "mountain" in val_lower:
            info["profile"] = "mountain"
        elif "hill" in val_lower:
            info["profile"] = "hilly"
        elif "flat" in val_lower:
            info["profile"] = "flat"
        elif "cobble" in val_lower:
            info["profile"] = "cobbled"
        elif "time trial" in val_lower or "itt" in val_lower:
            info["profile"] = "itt"


# ---------------------------------------------------------------------------
# Main sync
# ---------------------------------------------------------------------------


def sync_race_info(supabase: Client, client: httpx.Client, only_missing: bool = False) -> dict:
    """Scrape race info for all stages and update Supabase."""
    _log("\n─ Syncing race information from PCS ─")

    # Fetch all stages joined with their race
    try:
        query = supabase.table("cycling_stages").select(
            "id, race_id, stage_number, distance_km, departure, arrival, "
            "profile_score, vertical_meters, "
            "cycling_races!inner(pcs_slug, race_type, year)"
        )

        if only_missing:
            # Only fetch stages missing info
            query = query.is_("distance_km", "null")

        resp = query.execute()
        stages = resp.data or []
    except APIError as e:
        _warn(f"Failed to fetch stages: {e}")
        return {"updated": 0, "errors": [str(e)]}

    _log(f"  {len(stages)} stages to process")

    updated = 0
    errors: list[str] = []

    for stage in stages:
        race = stage.get("cycling_races")
        if not race:
            continue

        slug = race["pcs_slug"]
        year = race.get("year", 2026)
        race_type = race["race_type"]
        stage_num = stage["stage_number"]

        # Build URL
        if race_type == "one_day":
            url = f"{PCS_BASE}/race/{slug}/{year}"
        elif stage_num == 0:
            url = f"{PCS_BASE}/race/{slug}/{year}/prologue"
        else:
            url = f"{PCS_BASE}/race/{slug}/{year}/stage-{stage_num}"

        _log(f"  {slug} stage {stage_num}: {url}")
        soup = pcs_get(url, client)
        time.sleep(REQUEST_DELAY)

        info = parse_race_info(soup)
        if not info:
            _warn(f"    No race info found")
            continue

        _log(f"    → {info}")

        # Build update payload
        update: dict = {}
        if "distance_km" in info:
            update["distance_km"] = info["distance_km"]
        if "departure" in info:
            update["departure"] = info["departure"]
        if "arrival" in info:
            update["arrival"] = info["arrival"]
        if "profile_score" in info:
            update["profile_score"] = info["profile_score"]
        if "vertical_meters" in info:
            update["vertical_meters"] = info["vertical_meters"]
        if "profile" in info:
            update["profile"] = info["profile"]

        if not update:
            continue

        try:
            supabase.table("cycling_stages").update(update).eq("id", stage["id"]).execute()
            updated += 1
        except APIError as e:
            err = f"Failed to update stage {stage['id']}: {e}"
            _warn(f"    {err}")
            errors.append(err)

    return {"updated": updated, "errors": errors}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape race info from PCS.")
    parser.add_argument(
        "--only-missing",
        action="store_true",
        default=False,
        help="Only scrape stages where distance_km IS NULL",
    )
    args = parser.parse_args()

    load_dotenv_local()

    supabase_url = require_env("NEXT_PUBLIC_SUPABASE_URL")
    service_key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(supabase_url, service_key)

    _log("=" * 60)
    _log("  CYCLING RACE INFO SYNC")
    _log("=" * 60)

    with httpx.Client(headers=PCS_HEADERS) as client:
        result = sync_race_info(supabase, client, only_missing=args.only_missing)

    _log("\n" + "=" * 60)
    _log("  RACE INFO SYNC COMPLETE")
    _log("=" * 60)
    _log(f"  Updated: {result['updated']}")
    if result["errors"]:
        _log(f"  Errors:  {len(result['errors'])}")


if __name__ == "__main__":
    main()
