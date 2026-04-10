"""
helpers.py — Shared utilities for all cycling scraper scripts.

Provides: load_dotenv_local, require_env, init_supabase,
          pcs_get, _log, _warn, PCS constants.
"""

import sys
import os
import time

import httpx
from bs4 import BeautifulSoup
from supabase import create_client, Client

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
YEAR = 2026

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------


def load_dotenv_local() -> None:
    """Load .env.local from project root into os.environ."""
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
    """Get required environment variable or exit."""
    value = os.environ.get(name)
    if not value:
        print(f"ERROR: Missing {name}", file=sys.stderr)
        sys.exit(1)
    return value


def init_supabase() -> Client:
    """Load .env.local and create Supabase admin client."""
    load_dotenv_local()
    return create_client(
        require_env("NEXT_PUBLIC_SUPABASE_URL"),
        require_env("SUPABASE_SERVICE_ROLE_KEY"),
    )


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------


def _log(msg: str) -> None:
    print(msg, flush=True)


def _warn(msg: str) -> None:
    print(f"WARNING: {msg}", file=sys.stderr)


# ---------------------------------------------------------------------------
# PCS HTTP
# ---------------------------------------------------------------------------


def pcs_get(url: str, client: httpx.Client, retries: int = 2) -> BeautifulSoup:
    """Fetch a PCS page with retries on 5xx errors. Returns empty soup on failure."""
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
            _warn(f"HTTP {e.response.status_code} for {url} — skipping")
            return BeautifulSoup("", "html.parser")
        except httpx.HTTPError as e:
            _warn(f"HTTP error for {url}: {e} — skipping")
            return BeautifulSoup("", "html.parser")
    return BeautifulSoup("", "html.parser")
