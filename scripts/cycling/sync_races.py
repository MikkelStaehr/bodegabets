"""
sync_races.py — Define cycling races and store in cycling_races.

Usage:
    python scripts/cycling/sync_races.py                # generate JSON + upload
    python scripts/cycling/sync_races.py --generate-only # only write data/races.json
    python scripts/cycling/sync_races.py --upload-only   # only read JSON and upsert

Flow:
    Step 1: Hardcoded list of 29 races with metadata.
            Save to data/races.json.
    Step 2: Read data/races.json and upsert to cycling_races in Supabase on pcs_slug.

Environment variables (loaded from .env.local or shell):
    NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""

import sys
import os
import json
import argparse

from supabase import create_client, Client
from postgrest.exceptions import APIError

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
RACES_JSON = os.path.join(DATA_DIR, "races.json")

# ---------------------------------------------------------------------------
# Environment helpers
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


def _log(msg: str) -> None:
    print(msg, flush=True)


# ---------------------------------------------------------------------------
# Step 1: Race definitions
# ---------------------------------------------------------------------------

RACES = [
    # Grand Tours
    {"name": "Tour de France", "pcs_slug": "tour-de-france", "race_type": "stage_race", "profile": "mountain", "start_date": "2026-07-04"},
    {"name": "Giro d'Italia", "pcs_slug": "giro-d-italia", "race_type": "stage_race", "profile": "mountain", "start_date": "2026-05-09"},
    {"name": "Vuelta a España", "pcs_slug": "vuelta-a-espana", "race_type": "stage_race", "profile": "mountain", "start_date": "2026-08-15"},

    # Stage races
    {"name": "Paris-Nice", "pcs_slug": "paris-nice", "race_type": "stage_race", "profile": "mixed", "start_date": "2026-03-08"},
    {"name": "Tirreno-Adriatico", "pcs_slug": "tirreno-adriatico", "race_type": "stage_race", "profile": "mixed", "start_date": "2026-03-11"},
    {"name": "Volta a Catalunya", "pcs_slug": "volta-a-catalunya", "race_type": "stage_race", "profile": "mountain", "start_date": "2026-03-23"},
    {"name": "Tour de Romandie", "pcs_slug": "tour-de-romandie", "race_type": "stage_race", "profile": "mountain", "start_date": "2026-04-28"},
    {"name": "Tour de Suisse", "pcs_slug": "tour-de-suisse", "race_type": "stage_race", "profile": "mountain", "start_date": "2026-06-14"},
    {"name": "Critérium du Dauphiné", "pcs_slug": "criterium-du-dauphine", "race_type": "stage_race", "profile": "mountain", "start_date": "2026-06-07"},
    {"name": "Itzulia Basque Country", "pcs_slug": "itzulia-basque-country", "race_type": "stage_race", "profile": "hilly", "start_date": "2026-04-06"},

    # Monuments
    {"name": "Milano-Sanremo", "pcs_slug": "milano-sanremo", "race_type": "one_day", "profile": "flat", "start_date": "2026-03-21"},
    {"name": "Ronde van Vlaanderen", "pcs_slug": "ronde-van-vlaanderen", "race_type": "one_day", "profile": "cobbled", "start_date": "2026-04-05"},
    {"name": "Paris-Roubaix", "pcs_slug": "paris-roubaix", "race_type": "one_day", "profile": "cobbled", "start_date": "2026-04-12"},
    {"name": "Liège-Bastogne-Liège", "pcs_slug": "liege-bastogne-liege", "race_type": "one_day", "profile": "hilly", "start_date": "2026-04-26"},
    {"name": "Il Lombardia", "pcs_slug": "il-lombardia", "race_type": "one_day", "profile": "hilly", "start_date": "2026-10-10"},

    # Championships
    {"name": "World Championships", "pcs_slug": "world-championship", "race_type": "one_day", "profile": "mixed", "start_date": "2026-09-20"},
    {"name": "European Championships", "pcs_slug": "european-championship", "race_type": "one_day", "profile": "mixed", "start_date": "2026-09-13"},

    # Classics — cobbled
    {"name": "Omloop Het Nieuwsblad", "pcs_slug": "omloop-het-nieuwsblad", "race_type": "one_day", "profile": "cobbled", "start_date": "2026-02-28"},
    {"name": "Strade Bianche", "pcs_slug": "strade-bianche", "race_type": "one_day", "profile": "mixed", "start_date": "2026-03-07"},
    {"name": "E3 Classic", "pcs_slug": "e3-saxo-bank-classic", "race_type": "one_day", "profile": "cobbled", "start_date": "2026-03-27"},
    {"name": "Gent-Wevelgem", "pcs_slug": "gent-wevelgem", "race_type": "one_day", "profile": "cobbled", "start_date": "2026-03-29"},
    {"name": "Dwars door Vlaanderen", "pcs_slug": "dwars-door-vlaanderen", "race_type": "one_day", "profile": "cobbled", "start_date": "2026-04-01"},

    # Classics — hilly/other
    {"name": "Eschborn-Frankfurt", "pcs_slug": "eschborn-frankfurt", "race_type": "one_day", "profile": "hilly", "start_date": "2026-05-01"},
    {"name": "Amstel Gold Race", "pcs_slug": "amstel-gold-race", "race_type": "one_day", "profile": "hilly", "start_date": "2026-04-19"},
    {"name": "La Flèche Wallonne", "pcs_slug": "la-fleche-wallonne", "race_type": "one_day", "profile": "hilly", "start_date": "2026-04-22"},
    {"name": "San Sebastián", "pcs_slug": "san-sebastian", "race_type": "one_day", "profile": "hilly", "start_date": "2026-08-01"},
    {"name": "Bretagne Classic", "pcs_slug": "bretagne-classic", "race_type": "one_day", "profile": "hilly", "start_date": "2026-08-29"},
    {"name": "GP Québec", "pcs_slug": "gp-quebec", "race_type": "one_day", "profile": "hilly", "start_date": "2026-09-11"},
    {"name": "GP Montréal", "pcs_slug": "gp-montreal", "race_type": "one_day", "profile": "hilly", "start_date": "2026-09-13"},
]


def generate_races() -> list[dict]:
    """Return the hardcoded race list."""
    return [dict(r) for r in RACES]


# ---------------------------------------------------------------------------
# Step 2: Upload to Supabase
# ---------------------------------------------------------------------------


def upload_races(races: list[dict], supabase: Client) -> int:
    """Upsert races to cycling_races. Returns count upserted."""
    try:
        supabase.table("cycling_races").upsert(
            races, on_conflict="pcs_slug"
        ).execute()
    except APIError as e:
        _die(f"cycling_races upsert failed: {e}")
    return len(races)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Define cycling races and store in cycling_races."
    )
    parser.add_argument(
        "--generate-only",
        action="store_true",
        help="Only generate data/races.json, skip Supabase upload",
    )
    parser.add_argument(
        "--upload-only",
        action="store_true",
        help="Only read data/races.json and upload to Supabase",
    )
    args = parser.parse_args()

    load_dotenv_local()
    os.makedirs(DATA_DIR, exist_ok=True)

    # --- Step 1: Generate ---
    if not args.upload_only:
        _log("→ Step 1: Generating race definitions...")
        races = generate_races()
        _log(f"✓ Defined {len(races)} races")

        with open(RACES_JSON, "w") as f:
            json.dump(races, f, ensure_ascii=False, indent=2)
        _log(f"✓ Saved to {RACES_JSON}")

        if args.generate_only:
            _log("Done (generate-only mode)")
            return
    else:
        if not os.path.exists(RACES_JSON):
            _die(f"{RACES_JSON} not found. Run without --upload-only first.")
        with open(RACES_JSON) as f:
            races = json.load(f)
        _log(f"→ Loaded {len(races)} races from {RACES_JSON}")

    # --- Step 2: Upload ---
    _log("→ Step 2: Uploading to Supabase...")
    supabase_url = require_env("NEXT_PUBLIC_SUPABASE_URL")
    service_key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(supabase_url, service_key)

    upserted = upload_races(races, supabase)
    _log(f"✓ Upserted {upserted} races")

    # Summary
    by_type: dict[str, int] = {}
    by_profile: dict[str, int] = {}
    for r in races:
        by_type[r["race_type"]] = by_type.get(r["race_type"], 0) + 1
        by_profile[r["profile"]] = by_profile.get(r["profile"], 0) + 1

    _log(f"  By type: {by_type}")
    _log(f"  By profile: {by_profile}")

    result = {
        "ok": True,
        "races_defined": len(races),
        "upserted": upserted,
        "by_type": by_type,
        "by_profile": by_profile,
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
