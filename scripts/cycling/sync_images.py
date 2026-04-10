"""
sync_images.py — Scrape profile images and rider photos from PCS.

Usage:
    python scripts/cycling/sync_images.py
    python scripts/cycling/sync_images.py --only races
    python scripts/cycling/sync_images.py --only stages
    python scripts/cycling/sync_images.py --only riders

SQL migration (run once):
    ALTER TABLE cycling_races ADD COLUMN IF NOT EXISTS profile_image_url text;
    ALTER TABLE cycling_stages ADD COLUMN IF NOT EXISTS profile_image_url text;
    -- cycling_riders.photo_url already exists

Scrapes three types of images:
  1. Race route profiles — from /race/{slug}/{year}
  2. Stage route profiles — from /race/{slug}/{year}/stage-{N}
  3. Rider photos — from /rider/{slug}

Only scrapes rows where the image column IS NULL.
"""

import re
import time

import httpx
from postgrest.exceptions import APIError

from helpers import PCS_BASE, PCS_HEADERS, REQUEST_DELAY, YEAR, init_supabase, pcs_get, _log, _warn


def find_profile_image(soup: BeautifulSoup) -> str | None:
    """Find route profile image on a PCS race/stage page."""
    for img in soup.find_all("img", src=re.compile(r"images/profiles/|profile")):
        src = img.get("src", "")
        if not src:
            continue
        if src.startswith("//"):
            return f"https:{src}"
        if src.startswith("http"):
            return src
        return f"{PCS_BASE}/{src}"
    return None


def find_rider_photo(soup: BeautifulSoup) -> str | None:
    """Find rider photo on a PCS rider page."""
    for img in soup.find_all("img", src=re.compile(r"images/riders/")):
        src = img.get("src", "")
        if not src:
            continue
        if src.startswith("//"):
            return f"https:{src}"
        if src.startswith("http"):
            return src
        return f"{PCS_BASE}/{src}"
    return None


# ---------------------------------------------------------------------------
# Scrapers
# ---------------------------------------------------------------------------


def sync_race_profiles(client: httpx.Client, supabase: Client) -> int:
    """Scrape route profile images for races missing them."""
    _log("\n─ Race profile images ─")

    try:
        resp = (
            supabase.table("cycling_races")
            .select("id, pcs_slug, name")
            .is_("profile_image_url", "null")
            .execute()
        )
        races = resp.data or []
    except APIError as e:
        _warn(f"Failed to fetch races: {e}")
        return 0

    _log(f"  {len(races)} races missing profile image")
    count = 0

    for race in races:
        url = f"{PCS_BASE}/race/{race['pcs_slug']}/{YEAR}"
        _log(f"  {race['name']}: {url}")
        soup = pcs_get(url, client)
        time.sleep(REQUEST_DELAY)

        img_url = find_profile_image(soup)
        if not img_url:
            _warn(f"    No profile image found")
            continue

        try:
            supabase.table("cycling_races").update(
                {"profile_image_url": img_url}
            ).eq("id", race["id"]).execute()
            _log(f"    → {img_url[:70]}")
            count += 1
        except APIError as e:
            _warn(f"    Update failed: {e}")

    return count


def sync_stage_profiles(client: httpx.Client, supabase: Client) -> int:
    """Scrape route profile images for stages missing them."""
    _log("\n─ Stage profile images ─")

    try:
        resp = (
            supabase.table("cycling_stages")
            .select("id, race_id, stage_number, name")
            .is_("profile_image_url", "null")
            .execute()
        )
        stages = resp.data or []
    except APIError as e:
        _warn(f"Failed to fetch stages: {e}")
        return 0

    if not stages:
        _log("  No stages missing profile image")
        return 0

    # Get race slugs
    race_ids = list({s["race_id"] for s in stages})
    try:
        resp = supabase.table("cycling_races").select("id, pcs_slug, name").in_("id", race_ids).execute()
        slug_map = {r["id"]: r["pcs_slug"] for r in (resp.data or [])}
        name_map = {r["id"]: r["name"] for r in (resp.data or [])}
    except APIError as e:
        _warn(f"Failed to fetch race slugs: {e}")
        return 0

    _log(f"  {len(stages)} stages missing profile image")
    count = 0

    for stage in stages:
        slug = slug_map.get(stage["race_id"])
        if not slug:
            continue

        sn = stage["stage_number"]
        if sn == 0:
            url = f"{PCS_BASE}/race/{slug}/{YEAR}/prologue"
        else:
            url = f"{PCS_BASE}/race/{slug}/{YEAR}/stage-{sn}"

        race_name = name_map.get(stage["race_id"], slug)
        _log(f"  {race_name} stage {sn}: {url}")
        soup = pcs_get(url, client)
        time.sleep(REQUEST_DELAY)

        img_url = find_profile_image(soup)
        if not img_url:
            _warn(f"    No profile image found")
            continue

        try:
            supabase.table("cycling_stages").update(
                {"profile_image_url": img_url}
            ).eq("id", stage["id"]).execute()
            _log(f"    → {img_url[:70]}")
            count += 1
        except APIError as e:
            _warn(f"    Update failed: {e}")

    return count


def sync_rider_photos(client: httpx.Client, supabase: Client) -> int:
    """Scrape rider photos for riders missing them. Kat 1-2 first."""
    _log("\n─ Rider photos ─")

    try:
        resp = (
            supabase.table("cycling_riders")
            .select("id, pcs_slug, first_name, last_name, category")
            .is_("photo_url", "null")
            .order("category", desc=False)
            .execute()
        )
        riders = resp.data or []
    except APIError as e:
        _warn(f"Failed to fetch riders: {e}")
        return 0

    _log(f"  {len(riders)} riders missing photo (kat 1-2 first)")
    count = 0

    for rider in riders:
        url = f"{PCS_BASE}/rider/{rider['pcs_slug']}"
        _log(f"  [{rider['category']}] {rider['last_name']} {rider['first_name']}: {url}")
        soup = pcs_get(url, client)
        time.sleep(REQUEST_DELAY)

        img_url = find_rider_photo(soup)
        if not img_url:
            _warn(f"    No photo found")
            continue

        try:
            supabase.table("cycling_riders").update(
                {"photo_url": img_url}
            ).eq("id", rider["id"]).execute()
            _log(f"    → {img_url[:70]}")
            count += 1
        except APIError as e:
            _warn(f"    Update failed: {e}")

    return count


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Scrape images from PCS.")
    parser.add_argument(
        "--only",
        type=str,
        choices=["races", "stages", "riders"],
        default=None,
        help="Only scrape one type of image",
    )
    args = parser.parse_args()

    supabase = init_supabase()

    _log("=" * 60)
    _log("  CYCLING IMAGE SYNC")
    _log("=" * 60)

    race_count = 0
    stage_count = 0
    rider_count = 0

    with httpx.Client(headers=PCS_HEADERS) as client:
        if args.only is None or args.only == "races":
            race_count = sync_race_profiles(client, supabase)

        if args.only is None or args.only == "stages":
            stage_count = sync_stage_profiles(client, supabase)

        if args.only is None or args.only == "riders":
            rider_count = sync_rider_photos(client, supabase)

    _log("\n" + "=" * 60)
    _log("  IMAGE SYNC COMPLETE")
    _log("=" * 60)
    _log(f"  Race profiles:  {race_count}")
    _log(f"  Stage profiles: {stage_count}")
    _log(f"  Rider photos:   {rider_count}")


if __name__ == "__main__":
    main()
