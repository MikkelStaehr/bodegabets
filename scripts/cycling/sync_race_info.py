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

import re
import time
import argparse

import httpx
from bs4 import BeautifulSoup
from supabase import Client
from postgrest.exceptions import APIError

from helpers import PCS_BASE, PCS_HEADERS, REQUEST_DELAY, init_supabase, pcs_get, _log, _warn

PROFILE_MAP = {
    "p1": "flat",
    "p2": "hilly",
    "p3": "mountain",
    "p4": "cobbled",
    "p5": "itt",
}

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

    # Strategy 1: <ul class="infolist"> (legacy PCS)
    infolist = soup.find("ul", class_="infolist")
    if infolist:
        for li in infolist.find_all("li"):
            divs = li.find_all("div")
            if len(divs) >= 2:
                label = divs[0].get_text(strip=True).lower()
                value = divs[1].get_text(strip=True)
                _extract_field(info, label, value, divs[1])

    # Strategy 2: <ul class="list keyvalueList ..."> (current PCS layout)
    if not info or len(info) <= 1:
        for ul in soup.find_all("ul", class_=re.compile(r"keyvalueList")):
            for li in ul.find_all("li"):
                divs = li.find_all("div")
                if len(divs) >= 2:
                    label = divs[0].get_text(strip=True).rstrip(":").lower()
                    value = divs[1].get_text(strip=True)
                    _extract_field(info, label, value, divs[1])

    # Strategy 3: look for "Distance:" in a div.title (one-day race pages)
    if "distance_km" not in info:
        for div in soup.find_all("div", class_="title"):
            text = div.get_text(strip=True).lower()
            if "distance" in text:
                # Value is usually in the next sibling or parent's next div
                parent = div.parent
                if parent:
                    full_text = parent.get_text(strip=True)
                    m = re.search(r"([\d.]+)\s*km", full_text)
                    if m:
                        info["distance_km"] = float(m.group(1))

    # Strategy 3: udled profile fra profile_score (mere robust end PCS span-klasser
    # som de har ændret semantik på flere gange).
    #   < 25  → flat
    #   25-99 → hilly
    #   ≥ 100 → mountain
    ps = info.get("profile_score")
    if ps is not None:
        if ps < 25:
            info["profile"] = "flat"
        elif ps < 100:
            info["profile"] = "hilly"
        else:
            info["profile"] = "mountain"

    return info


def _extract_field(info: dict, label: str, value: str, element=None) -> None:
    """Extract a single field from a label/value pair."""
    label = label.rstrip(":").strip()

    if "distance" in label:  # matches "Distance" and "Total distance"
        m = re.search(r"([\d.]+)", value)
        if m:
            info["distance_km"] = float(m.group(1))

    elif "departure" in label:
        if value:
            info["departure"] = value

    elif "arrival" in label:
        if value:
            info["arrival"] = value

    elif "profilescore" in label:
        m = re.search(r"(\d+)", value)
        if m:
            info["profile_score"] = int(m.group(1))

    elif "vertical" in label:
        clean = value.replace(",", "").replace(".", "")
        m = re.search(r"(\d+)", clean)
        if m:
            info["vertical_meters"] = int(m.group(1))

    elif "gradient" in label and "final" in label:
        m = re.search(r"([\d.]+)", value)
        if m:
            info["gradient_final_km"] = float(m.group(1))

    elif "won how" in label:
        if value and value != "-":
            info["won_how"] = value

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
            # One-day races: /result page has the most info
            url = f"{PCS_BASE}/race/{slug}/{year}/result"
        elif stage_num == 0:
            url = f"{PCS_BASE}/race/{slug}/{year}/prologue"
        else:
            url = f"{PCS_BASE}/race/{slug}/{year}/stage-{stage_num}"

        _log(f"  {slug} stage {stage_num}: {url}")
        soup = pcs_get(url, client)
        time.sleep(REQUEST_DELAY)

        info = parse_race_info(soup)

        # Fallback: for one-day races, try the overview page if /result failed
        if not info and race_type == "one_day":
            fallback_url = f"{PCS_BASE}/race/{slug}/{year}"
            _log(f"    Fallback: {fallback_url}")
            soup = pcs_get(fallback_url, client)
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
        if "won_how" in info:
            update["won_how"] = info["won_how"]
        if "gradient_final_km" in info:
            update["gradient_final_km"] = info["gradient_final_km"]
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

    supabase = init_supabase()

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
