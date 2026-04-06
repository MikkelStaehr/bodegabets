# Cycling Fantasy — Data Scripts

Scripts til at populere Supabase-tabeller for cykling-fantasy.

## Opsætning

```bash
cd scripts/cycling
pip install -r requirements.txt
```

Kræver `.env.local` i projekt-roden med:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Scripts

### 1. `sync_races.py` — Kør først

Definerer de 29 løb vi tracker (Grand Tours, monumenter, klassikere, mesterskaber).
Ingen scraping — data er hardcodet.

```bash
python scripts/cycling/sync_races.py                # generér JSON + upload til Supabase
python scripts/cycling/sync_races.py --generate-only # kun skriv data/races.json
python scripts/cycling/sync_races.py --upload-only   # kun læs JSON og upsert
```

Upserter til `cycling_races` på `pcs_slug`.

### 2. `sync_riders.py` — Kør efter races

Scraper PCS individuelle rankings (alle sider). Parser rytternavn, team, ranking.
Tildeler kategori baseret på ranking:

| Ranking | Kategori |
|---------|----------|
| 1–24    | 1        |
| 25–49   | 2        |
| 50–99   | 3        |
| 100–199 | 4        |
| 200+    | 5        |

```bash
python scripts/cycling/sync_riders.py                # scrape + upload
python scripts/cycling/sync_riders.py --scrape-only  # kun skriv data/riders.json
python scripts/cycling/sync_riders.py --upload-only  # kun læs JSON og upsert
```

Upserter til `cycling_riders` på `pcs_slug`. Respekterer 1.5s delay mellem requests.

## Rækkefølge

```bash
python scripts/cycling/sync_races.py    # 1. Races først (ingen afhængigheder)
python scripts/cycling/sync_riders.py   # 2. Riders derefter
```

## Data

JSON-filer gemmes i `data/` mappen og kan inspiceres/redigeres manuelt mellem step 1 og 2.
