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

### `sync_all.py` — Sæsonstart & vedligeholdelse

Kører automatisk begge steps uden flags. Brug ved sæsonstart og når hold/ryttere ændrer sig.

```bash
python scripts/cycling/sync_all.py
```

**Step 1 — Scrape & generér data:**
- **Ryttere**: Henter alle WorldTour holdlister fra PCS + UCI rankings → `data/riders.json`
- **Løb**: 29 hardcodede løb (Grand Tours, monumenter, klassikere) → `data/races.json`
- **Etaper**: For hvert etapeløb scrapes etapeliste fra PCS → `data/stages.json`

**Step 2 — Upload til Supabase:**
- `cycling_riders` på `pcs_slug`
- `cycling_races` på `pcs_slug`
- `cycling_stages` på `(race_id, stage_number)`
- Logger til `cycling_sync_log` med `sync_type=full_sync`

Kategori-tildeling baseret på UCI ranking:

| Ranking | Kategori |
|---------|----------|
| 1–24    | 1        |
| 25–49   | 2        |
| 50–99   | 3        |
| 100–199 | 4        |
| 200+    | 5        |

### `sync_results.py` — Efter hvert løb/etape

Kører automatisk begge steps uden flags. Brug manuelt efter et løb er færdigt.

```bash
python scripts/cycling/sync_results.py
```

**Step 1 — Hent resultater:**
- Henter løb med status `active` eller `finished` fra Supabase
- Endagsløb: scraper top 25 fra PCS
- Etapeløb: scraper top 25 per etape der mangler resultater
- Parser placering, rytternavn, hold, tidsgab, DNF
- Gemmer per-løb JSON i `data/results_{slug}_{stage}.json`

**Step 2 — Match & upload:**
- Matcher ryttere mod `cycling_riders` via `pcs_slug`
- Upserter til `cycling_results`
- Opdaterer `results_uploaded_at` på løb/etaper
- Logger til `cycling_sync_log` med `sync_type=results_sync`

## Rækkefølge

```bash
# Sæsonstart (kør én gang):
python scripts/cycling/sync_all.py

# Efter hvert løb (kør manuelt):
# 1. Sæt løb-status til "active" eller "finished" i admin panelet
# 2. Kør results sync:
python scripts/cycling/sync_results.py
```

## Data

JSON-filer gemmes i `data/` og kan inspiceres manuelt. De gitignores automatisk.
