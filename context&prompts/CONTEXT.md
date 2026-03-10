# Bodega Bets — Arkitektur

> Dette dokument er den absolutte sandhed om applikationen.
> Opdateres efter hver session. Bruges som kontekst til Cursor.

---

## Hvad er det?

En social fodbold betting platform hvor brugere opretter eller tilmelder sig private spilrum og konkurrerer mod hinanden om point. Ingen rigtige penge — kun point og prestige.

---

## Stack

Next.js 16 (App Router), Supabase (PostgreSQL + Auth), Tailwind v4, TypeScript, Vercel

---

## Datakilder

- **Kampe/fixtures**: fixturedownload.com (JSON feed) via `lib/fixtureDownload.ts`
- **Resultater**: Bold.dk aggregator API via `lib/boldApi.ts`
- Sofascore er fjernet

**Bold.dk** bruges som fallback når ligaen ikke har `fixturedownload_slug` — både kommende kampe og resultater hentes fra aggregator API (`api.bold.dk`). Understøtter live scores, pauseresultater og slutresultater.

**Dataflow:**
```
fixturedownload / Bold.dk
    ↓  (syncLeagueFixtures / syncResults)
league_matches          ← central kampdata per liga
    ↓  (buildGameRounds)
rounds + matches        ← spilrum-specifikke runder og kampe
    ↓
bets                    ← brugerens bud
    ↓  (calculateRoundPoints)
round_scores            ← beregnede point per runde
```

---

## Pointberegning

Ét system: `lib/calculatePoints.ts`

Formel: `stake × konsensus_faktor × historisk_faktor × streak_bonus`

- **konsensus_faktor**: beregnes efter deadline baseret på % der valgte samme udfald
- **historisk_faktor**: beregnes fra league_matches (win rate, form, position, h2h)
- **streak_bonus**: konsekutive korrekte bets på tværs af runder

---

## Bet-typer

Defineret i `lib/betTypes.ts`:

| bet_type    | prediction-værdier      |
|-------------|-------------------------|
| match_result| 1 / X / 2               |
| btts        | yes / no                |
| over_under  | over / under            |
| halvleg     | h1 / h2 / draw         |
| malforskel   | 2plus / 1goal / udraw   |

---

## Cron jobs (vercel.json)

- `/api/cron/sync-fixtures`     → 06:00 dagligt
- `/api/cron/update-rounds`    → hvert 30. minut
- `/api/cron/calculate-points` → hvert 15. minut

---

## Database

Primære tabeller: `games`, `game_members`, `rounds`, `matches`, `bets`, `league_matches`, `leagues`

- **league_matches**: central kampdata per liga (UNIQUE: league_id, home_team, away_team, kickoff_at)
- **matches**: spilrum-specifikke kampe med `league_match_id` → league_matches
- **bets**: brugerens bud med `round_id`, `match_id`, `game_id`, `bet_type`, `prediction`, `stake`
