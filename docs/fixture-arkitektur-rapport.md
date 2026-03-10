# Fixture-arkitektur rapport — Bodega Bets

**Dato:** 4. marts 2025  
**Formål:** Dokumentation af nuværende fixture-import og -flow før evt. migration til Bold.dk API.

> **Bemærk:** Kør SQL-forespørgslerne i afsnit 2.1 i Supabase SQL Editor og indsæt output her, hvis du vil have fuld database-dokumentation. Skemaet i 2.2 er infereret fra migrations og kode.

---

## 1. Nuværende fixture-flow

### 1.1 Flowdiagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ EKSTERNE KILDER                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  fixturedownload.com          Bold.dk API (api.bold.dk)                          │
│  /feed/csv/{slug}             aggregator/v1/apps/page/matches                    │
│  (returnerer JSON!)           getFixtures() + getResults()                        │
└──────────────┬──────────────────────────────────┬───────────────────────────────┘
               │                                   │
               ▼                                   ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ IMPORT / SYNC                                                                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│  lib/fixtureDownload.ts          lib/boldApi.ts                                   │
│  - fetchFixtures(slug)           - getFixtures(leagueSlug)                       │
│  - syncLeagueFixtures(leagueId)  - getResults(leagueSlug)                        │
│                                                                                   │
│  app/api/admin/upload-fixtures/route.ts  (CSV manuel upload)                      │
│  - parseFixtureCSV() → league_matches upsert                                     │
└──────────────┬──────────────────────────────────┬───────────────────────────────┘
               │                                   │
               └───────────────┬───────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ league_matches (central kampdata per liga)                                        │
│ UNIQUE: league_id, home_team, away_team, kickoff_at                               │
│ Kolonner: id, league_id, round_name, home_team, away_team, kickoff_at,           │
│           home_score, away_score, status, bold_match_id, updated_at                │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ lib/syncLeagueMatches.ts                                                          │
│ - buildGameRounds(gameId, leagueId) → opretter rounds + matches fra league_matches│
│ - syncResults(leagueId, boldSlug) → opdaterer scores i league_matches             │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ rounds + matches (spilrum-specifikke)                                              │
│ rounds: game_id, league_id, name, stage, status, betting_closes_at, betting_opens_at│
│ matches: round_id, league_match_id, home_team, away_team, kickoff_at, scores, ... │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ UI / API                                                                          │
├──────────────────────────────────────────────────────────────────────────────────┤
│  current_rounds (view)     → Aktuel runde per liga (first_kickoff, round_status)  │
│  app/games/[id]/page.tsx   → Spilrum med RoundSlider, AfgivBets                    │
│  app/games/[id]/rounds/[roundId]/page.tsx → Bet-siden med kampliste                 │
│  components/AfgivBets.tsx  → Renderer kampe + bet-formularer                      │
│  components/LiveMatches.tsx, LiveMatchesTicker → Live-score visning                │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Involverede filer og tabeller

| Lag | Filer | Tabeller |
|-----|-------|----------|
| **Import** | `lib/fixtureDownload.ts`, `lib/boldApi.ts`, `app/api/admin/upload-fixtures/route.ts` | — |
| **Sync-triggers** | `app/api/admin/sync-league/route.ts`, `app/api/admin/sync-league-client/route.ts`, `app/api/admin/sync-schedule/route.ts`, `app/api/admin/sync-result/route.ts`, `app/api/cron/sync-fixtures/route.ts`, `app/api/cron/sync-results/route.ts` | — |
| **Central data** | `lib/syncLeagueMatches.ts` | `league_matches` |
| **Spilrum-data** | `lib/syncLeagueMatches.ts`, `lib/syncMatchesForRound.ts` | `rounds`, `matches` |
| **Aktiv runde** | `supabase/migrations/20250307_current_rounds_view.sql` | `current_rounds` (view) |
| **UI** | `app/games/[id]/page.tsx`, `app/games/[id]/rounds/[roundId]/page.tsx`, `components/AfgivBets.tsx`, `components/LiveMatches.tsx`, `components/RoundSlider.tsx` | — |

---

## 2. Database-skema

### 2.1 SQL-forespørgsler (kør i Supabase SQL Editor)

```sql
-- Alle tabeller med kolonner og typer
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
JOIN information_schema.tables t
  ON c.table_name = t.table_name AND t.table_schema = 'public'
WHERE c.table_schema = 'public'
ORDER BY c.table_name, c.ordinal_position;

-- Foreign key relationer
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS references_table,
  ccu.column_name AS references_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';

-- Antal rækker per tabel
SELECT tablename, n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- Sample af rounds
SELECT * FROM rounds ORDER BY id DESC LIMIT 10;

-- Sample af league_matches med alle kolonner
SELECT * FROM league_matches LIMIT 5;
```

### 2.2 Infereret skema (fra migrations og kode)

#### league_matches

| Kolonne | Type | Nullable | Beskrivelse |
|---------|------|----------|-------------|
| id | integer | NO | PK |
| league_id | integer | NO | FK → leagues(id) |
| round_name | text | — | fx "31. runde" |
| home_team | text | — | Holdnavn |
| away_team | text | — | Holdnavn |
| kickoff_at | timestamptz | — | ISO 8601 UTC |
| home_score | integer | YES | |
| away_score | integer | YES | |
| status | text | — | scheduled, live, halftime, finished |
| bold_match_id | bigint | YES | Bold.dk kamp-ID (scripts/add-bold-match-id-league-matches.sql) |
| updated_at | timestamptz | — | |

**UNIQUE:** (league_id, home_team, away_team, kickoff_at)

#### rounds

| Kolonne | Type | Nullable | Beskrivelse |
|---------|------|----------|-------------|
| id | integer | NO | PK |
| game_id | integer | NO | FK → games(id) |
| league_id | integer | — | FK → leagues(id) |
| name | text | — | fx "31. runde" |
| stage | text | — | fx "Grundspil" |
| status | text | — | upcoming, open, active, finished |
| betting_closes_at | timestamptz | YES | |
| betting_opens_at | timestamptz | YES | |

#### matches

| Kolonne | Type | Nullable | Beskrivelse |
|---------|------|----------|-------------|
| id | integer | NO | PK |
| round_id | integer | NO | FK → rounds(id) |
| league_match_id | integer | YES | FK → league_matches(id) |
| home_team | text | — | |
| away_team | text | — | |
| kickoff_at | timestamptz | — | |
| home_score | integer | YES | |
| away_score | integer | YES | |
| home_ht_score | integer | YES | Halvlegsresultat |
| away_ht_score | integer | YES | |
| status | text | — | scheduled, live, halftime, finished |
| bold_match_id | bigint | YES | |
| is_excluded | boolean | YES | |
| excluded_reason | text | YES | |
| excluded_at | timestamptz | YES | |

**UNIQUE:** (round_id, home_team, away_team)

### 2.3 Foreign key-diagram (tekstbaseret)

```
league_matches.league_id     → leagues.id
matches.league_match_id      → league_matches.id
matches.round_id             → rounds.id
rounds.game_id               → games.id
rounds.league_id             → leagues.id
```

### 2.4 Forældede/ubrugte kolonner

- **league_matches:** Ingen `home_bold_team_id` / `away_bold_team_id` — hold-ID'er hentes via `team_xref` (bb_team_name → bold_team_id).
- **matches:** `home_ht_score`, `away_ht_score` — bruges i UI/types, men syncResults opdaterer kun `home_score`, `away_score`, `status`. Halvlegsresultater kommer ikke fra nuværende sync.
- **matches:** `yellow_cards`, `red_cards`, `first_scorer`, `odds_*` — bruges i types/select, men fyldes ikke af fixture-import.

---

## 3. downloadfixtures — præcis dokumentation

### 3.1 Filer og routes

| Navn | Type | Sti |
|------|------|-----|
| fixtureDownload (JSON) | Lib | `lib/fixtureDownload.ts` |
| fixtureDownload (CSV) | API | `app/api/admin/upload-fixtures/route.ts` |
| sync-league | API | `app/api/admin/sync-league/route.ts` |
| sync-league-client | API | `app/api/admin/sync-league-client/route.ts` |

### 3.2 Inputformat

#### A) fixturedownload.com (JSON)

- **URL:** `https://fixturedownload.com/feed/csv/{slug}` (returnerer JSON trods "csv" i URL)
- **Eksempel:** `https://fixturedownload.com/feed/csv/premier-league-2025`

```json
[
  {
    "MatchNumber": 1,
    "RoundNumber": 1,
    "DateUtc": "2025-08-15 19:00:00Z",
    "Location": "Anfield",
    "HomeTeam": "Liverpool",
    "AwayTeam": "Bournemouth",
    "Group": null,
    "HomeTeamScore": null,
    "AwayTeamScore": null
  }
]
```

#### B) CSV-upload (manuel)

- **Format:** `Round Number,Date,Location,Home Team,Away Team,Result`
- **Eksempel:** `1,09/08/2025 12:30,Anfield,Liverpool,Bournemouth,4 - 2`
- **Dato:** `DD/MM/YYYY HH:mm`
- **Result:** `4 - 2` eller `4-2` → home_score, away_score, status=finished

### 3.3 Kolonne-mapping til database

| Kilde | league_matches |
|-------|----------------|
| RoundNumber | round_name → "{n}. runde" |
| DateUtc / Date | kickoff_at (ISO 8601) |
| HomeTeam / Home Team | home_team |
| AwayTeam / Away Team | away_team |
| HomeTeamScore / Result | home_score |
| AwayTeamScore / Result | away_score |
| — | status (scheduled/finished) |
| — | league_id (fra request) |
| — | updated_at |

### 3.4 Transformationslogik

- **Dato:** fixturedownload: `"2025-08-15 19:00:00Z"` → `"2025-08-15T19:00:00Z"`. CSV: `09/08/2025 12:30` → `2025-08-09T12:30:00Z`.
- **Runde:** `RoundNumber` → `"{n}. runde"`.
- **Status:** `HomeTeamScore != null && AwayTeamScore != null` → finished, ellers scheduled.
- **Holdnavne:** Ingen normalisering ved import. `lib/teamNameNormalizer.ts` bruges ved syncResults til navne-matching mod Bold.

### 3.5 Hvornår og hvordan kaldes det?

| Trigger | Route/kilde | Beskrivelse |
|---------|-------------|-------------|
| Manuelt (admin) | Sync-knap i LeagueHubClient | `POST /api/admin/sync-league` eller `sync-league-client` |
| Manuelt (admin) | CSV-upload i LeagueHubClient | `POST /api/admin/upload-fixtures` |
| Cron | `GET /api/cron/sync-fixtures` | Dagligt kl. 06:00 (vercel.json) |
| Cron | `GET /api/cron/sync-results` | Hvert minut (kun Bold-ligaer) |
| Ved spil-oprettelse | `buildGameRounds` | Efter upload-fixtures eller sync |

### 3.6 Kendte begrænsninger

- fixturedownload returnerer JSON, ikke CSV, trods URL.
- Ingen hold-ID'er i fixturedownload — live scores kræver `team_xref` mapping.
- Bold.dk bruges som fallback når `fixturedownload_slug` mangler.
- CSV-upload kræver specifik kolonne-rækkefølge.

---

## 4. getLiveScores — nuværende tilstand

### 4.1 Hvad gør lib/getLiveScores.ts?

- Henter live scores fra Bold API for `league_match`-IDs.
- Bruger `team_xref` (bb_team_name → bold_team_id) og `leagues.bold_phase_id`.
- Bold API: `GET .../matches?team_ids={home_bold_team_id}&phase_ids={bold_phase_id}&limit=50`.
- Matcher kamp via `away_team.id === away_bold_team_id`.
- Returnerer: `league_match_id`, `home_score`, `away_score`, `status`, `minute`, `bold_match_id`.

### 4.2 Hvad virker, hvad virker ikke?

| Aspekt | Status | Bemærkning |
|--------|--------|------------|
| getLiveScores() | Implementeret | Virker med team_xref + bold_phase_id |
| /api/live-scores | **Ubrugt** | Ingen komponent kalder denne route |
| Live-ticker | Virker | Læser fra `matches` via `/api/rounds/[id]/live-matches` |
| Live-data kilde | `matches` | Opdateres af sync-results → buildGameRounds, ikke getLiveScores |

**Konklusion:** `getLiveScores` og `/api/live-scores` er i praksis dead code. Live-scores kommer fra `sync-results` cron, der opdaterer `league_matches` via Bold `getResults()`, og `buildGameRounds` propagerer til `matches`. UI læser direkte fra `matches`.

### 4.3 Kolonner der ikke eksisterer

- `league_matches` har **ikke** `home_bold_team_id` eller `away_bold_team_id`.
- Hold-ID'er kommer fra `team_xref` (bb_team_name → bold_team_id).
- `LiveTestTab.tsx` forventer `home_bold_team_id`, `away_bold_team_id` i API-svar, men `/api/admin/live-test` returnerer dem ikke — de vises som "—".

---

## 5. Vurdering: Kan Bold.dk API erstatte downloadfixtures?

### 5.1 Hvad skal migreres

1. **Import-kilde:** Fra fixturedownload + CSV til kun Bold API.
2. **syncLeagueFixtures:** Skal bruge Bold `getFixtures` + `getResults` i stedet for fixturedownload.
3. **Runde-format:** Bold returnerer `round` som streng — skal matche `round_name` i `league_matches` (fx "31. runde").
4. **Holdnavne:** Bold og fixturedownload kan afvige — `team_xref` / `teamNameNormalizer` skal stadig bruges.

### 5.2 Hvad mangler i Bold API vs. nuværende

| Behov | fixturedownload | Bold API |
|-------|-----------------|----------|
| Kampprogram | ✅ JSON | ✅ getFixtures() |
| Resultater | ✅ i samme feed | ✅ getResults() |
| Runde-info | RoundNumber | round (streng) |
| Hold-ID'er | ❌ | ✅ home_team.id, away_team.id |
| Live scores | ❌ (kun via team_xref) | ✅ i getResults + getLiveScores |
| Phase/sæson | ❌ | ✅ phase_ids (leagues.bold_phase_id) |

Bold API dækker mere end fixturedownload. Mangler evt.:

- Konsistent runde-navngivning på tværs af ligaer.
- Historiske kampe længere tilbage end 60 dage (getResults bruger -60 dage).

### 5.3 Mindste mulige ændring for runde 31

1. Sæt `bold_slug` for alle relevante ligaer (hvis ikke allerede).
2. Sæt `bold_phase_id` for sæsonen (fx 2024/25).
3. Fjern eller deaktiver `fixturedownload_slug` for ligaer der skal bruge Bold.
4. `syncLeagueFixtures` bruger allerede Bold når `fixturedownload_slug` mangler — ingen kodeændring nødvendig for import.
5. Verificer at `sync-results` cron kører (hvert minut) for Bold-ligaer.
6. Verificer at `buildGameRounds` kører efter sync (sker allerede via cron og admin-sync).

---

## 6. Teknisk gæld relateret til fixtures

### 6.1 Ubrugt kode

| Fil | Linje | Beskrivelse |
|-----|-------|-------------|
| `app/api/live-scores/route.ts` | hele filen | Kaldes ikke fra nogen komponent |
| `lib/getLiveScores.ts` | hele filen | Kun brugt af /api/live-scores |
| `components/admin/tabs/LiveTestTab.tsx` | 15–16, 179–180 | Forventer `home_bold_team_id`, `away_bold_team_id` som API returnerer dem ikke |

### 6.2 Forældede/ubrugte kolonner

| Tabel | Kolonne | Status |
|-------|---------|--------|
| matches | home_ht_score, away_ht_score | Selectet men ikke opdateret af sync |
| matches | yellow_cards, red_cards, first_scorer, odds_* | I types/select, ikke fyldt |
| league_matches | — | Ingen home/away_bold_team_id (korrekt — bruger team_xref) |

### 6.3 Scripts uden for migrations

| Fil | Formål |
|-----|--------|
| `scripts/add-bold-match-id-league-matches.sql` | Skal køres manuelt — bold_match_id |
| `scripts/add-bold-match-id.sql` | bold_match_id på matches |
| `scripts/add-bold-match-logs.sql` | bold_match_logs tabel |
| `scripts/add-rls-rounds-matches.sql` | RLS for rounds/matches |

### 6.4 API-routes der ikke kaldes

- `GET /api/live-scores?round_id=X` — ingen referencer i kodebase.

---

## Bilag A: Cron-oversigt (vercel.json)

```json
{
  "crons": [
    { "path": "/api/cron/sync-fixtures", "schedule": "0 6 * * *" },
    { "path": "/api/cron/sync-results", "schedule": "* * * * *" },
    { "path": "/api/cron/update-rounds", "schedule": "*/30 * * * *" },
    { "path": "/api/cron/calculate-points", "schedule": "*/5 * * * *" }
  ]
}
```

- **sync-fixtures:** Daglig kl. 06:00 — `runLeagueSync()` (fixturedownload + Bold).
- **sync-results:** Hvert minut — `runSyncResultsOnly()` (kun Bold-ligaer).
- **update-rounds:** Hvert 30. minut — opdaterer round status.
- **calculate-points:** Hvert 5. minut — pointberegning.

---

## Bilag B: current_rounds view

View'en `current_rounds` beregner aktuel runde per liga ud fra `league_matches`:

- `first_kickoff`, `last_kickoff`, `next_kickoff` fra `min/max(lm.kickoff_at)`.
- `round_status`: `active` (kamp i gang), `upcoming` (fremtidig), `finished`.
- Vælger én runde per liga (prioritet: active > upcoming > finished).

Bruges i: `app/games/[id]/page.tsx`, `app/dashboard/page.tsx`, `app/api/games/create/route.ts`, `app/api/admin/games/search/route.ts`, `app/api/admin/leagues/overview/route.ts`.
