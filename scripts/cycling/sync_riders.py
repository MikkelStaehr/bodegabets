"""
sync_riders.py — Scrape UCI road rankings from PCS and store in cycling_riders.

Usage:
    python scripts/cycling/sync_riders.py                # scrape + upload
    python scripts/cycling/sync_riders.py --scrape-only  # only write data/riders.json
    python scripts/cycling/sync_riders.py --upload-only  # only read JSON and upsert

Flow:
    Step 1: Scrape https://www.procyclingstats.com/rankings/me/individual
            Parse rider name, team, ranking. Assign category by ranking bracket.
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
# Step 1: Scrape PCS rankings
# ---------------------------------------------------------------------------


def scrape_rankings() -> list[dict]:
    """
    Scrape PCS individual rankings. Paginates through offset=0, 100, 200, ...
    until no more riders are found.

    PCS rankings table structure:
      <tr>
        <td>1</td>                          ← ranking position
        <td>...</td>                        ← prev position
        <td class="ridername">
          <a href="rider/{slug}">
            <span class="uppercase">LASTNAME</span> Firstname
          </a>
        </td>
        ...
        <td><a href="team/{slug}/{year}">Team Name</a></td>
        <td>12345</td>                      ← points
      </tr>
    """
    riders: list[dict] = []
    offset = 0
    rider_re = re.compile(r"^rider/([\w-]+)$")

    with httpx.Client(headers=PCS_HEADERS) as client:
        while True:
            url = f"{RANKINGS_URL}?offset={offset}" if offset > 0 else RANKINGS_URL
            _log(f"  Fetching: {url}")

            try:
                resp = client.get(url, timeout=30, follow_redirects=True)
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                _die(f"PCS returned HTTP {e.response.status_code} for {url}")
            except httpx.HTTPError as e:
                _die(f"HTTP error fetching rankings: {e}")

            soup = BeautifulSoup(resp.text, "html.parser")
            page_riders = _parse_rankings_page(soup, rider_re)

            if not page_riders:
                break

            riders.extend(page_riders)
            _log(f"    Parsed {len(page_riders)} riders (total: {len(riders)})")

            # PCS shows 100 riders per page
            if len(page_riders) < 100:
                break

            offset += 100
            time.sleep(REQUEST_DELAY)

    # Assign categories
    for rider in riders:
        rider["category"] = ranking_to_category(rider["uci_ranking"])

    return riders


def _parse_rankings_page(soup: BeautifulSoup, rider_re: re.Pattern) -> list[dict]:
    """Parse a single page of PCS rankings."""
    riders: list[dict] = []
    seen_slugs: set[str] = set()

    for a in soup.find_all("a", href=rider_re):
        href: str = a["href"]
        m = rider_re.match(href)
        if not m:
            continue

        pcs_slug = m.group(1)
        if pcs_slug in seen_slugs:
            continue
        seen_slugs.add(pcs_slug)

        # Parse name: <span class="uppercase">LASTNAME</span> Firstname
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
            # Fallback: assume "LASTNAME Firstname" format
            parts = full_name.split()
            upper_parts = [p for p in parts if p.isupper()]
            if upper_parts:
                last_name = " ".join(upper_parts)
                first_name = " ".join(p for p in parts if not p.isupper())
            else:
                last_name = parts[-1] if parts else ""
                first_name = " ".join(parts[:-1]) if len(parts) > 1 else ""

        # Get ranking from first <td> in parent row
        row = a.find_parent("tr")
        ranking = len(riders) + 1  # fallback
        team_name = ""

        if row:
            cells = row.find_all("td")
            if cells:
                pos_text = re.sub(r"[^\d]", "", cells[0].get_text(strip=True))
                if pos_text.isdigit():
                    ranking = int(pos_text)

            # Team is in a link with href starting with "team/"
            team_link = row.find("a", href=re.compile(r"^team/"))
            if team_link:
                team_name = team_link.get_text(strip=True)

        riders.append({
            "pcs_slug": pcs_slug,
            "first_name": first_name,
            "last_name": last_name,
            "team_name": team_name,
            "uci_ranking": ranking,
        })

    return riders


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
        description="Scrape PCS rider rankings and store in cycling_riders."
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
    args = parser.parse_args()

    load_dotenv_local()
    os.makedirs(DATA_DIR, exist_ok=True)

    # --- Step 1: Scrape ---
    if not args.upload_only:
        _log("→ Step 1: Scraping PCS rankings...")
        riders = scrape_rankings()
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

    result = {
        "ok": len(errors) == 0,
        "riders_scraped": len(riders),
        "upserted": upserted,
        "errors": errors,
        "by_category": dict(sorted(by_cat.items())),
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
