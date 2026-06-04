# Sæsonovergang (Fodbold)

Hvordan vi håndterer overgangen mellem fodbold-sæsoner — fx Superligaen 2025/26 → 2026/27.

## Designvalg

Eksisterende fodbold-gamerooms **arkiveres automatisk** når sidste runde i sæsonen er færdig (samme mønster som cykel-gamerooms). Spillerne kan stadig se historik og slut-placering. Nye gamerooms for næste sæson oprettes separat.

Begrundelse: standings, blok-sejre og round-points er sæson-bundne. At fortsætte et gameroom på tværs af sæsoner ville kræve enten reset af alle tællere (forvirrende) eller akkumulering (gør sæson-sejren betydningsløs).

## Datamodel

```
seasons
├─ id
├─ tournament_id  → tournaments.id
├─ name            "2025/26", "2026/27"
└─ bold_phase_ids  "24470" eller multi: "22620,22621,..."

game_seasons    (mange-til-mange)
├─ game_id        → games.id
└─ season_id      → seasons.id

games
├─ status         active → finished (arkiveret)
└─ archive_warning_sent_at  (push-varsel)
```

Hvert game kan have **flere** seasons (game_seasons-tabel) — historisk brugt til Champions League-spil med både liga + CL. Pr. dags dato har vi 1 game-season-link i hele systemet (VM 2026), så vi er reelt i greenfield.

## Hvordan en sæson tilføjes

1. **Find phase_id** på Bold.dk: scan `https://api.bold.dk/aggregator/v1/apps/page/matches?phase_ids=<id>` og match på `tournament_id` (Superligaen = 115)
2. **INSERT i `seasons`-tabellen** med tournament_id, name og bold_phase_ids
3. **Cron-jobs synker automatisk**:
   - `batch-sync` (hver 3. time) henter alle fixtures
   - `update-rounds` (dagligt 07:00 UTC) markerer runder finished/open + sætter deadlines

Eksempel-migration: [supabase/migrations/20260604_superliga_2627.sql](../supabase/migrations/20260604_superliga_2627.sql)

## Auto-arkivering

`/football-archive-check` (Railway cron, dagligt 08:10 UTC):

1. Find aktive fodbold-gamerooms (status='active')
2. For hver: hent alle runder via `game_seasons → seasons → rounds`
3. **Hvis ALLE runder er 'finished'** OG **seneste kamp er > 14 dage gammel** → arkivér:
   - `games.status = 'finished'`
   - Push-notifikation til medlemmer
4. **7-dages varsel**: hvis seneste kamp er 7-14 dage gammel, sender vi varsel én gang (`archive_warning_sent_at`):
   - Værten: "Tilføj næste sæson via 'Tilføj sæson'"
   - Andre: "Spilrum arkiveres om X dage"

Spejler `/cycling-archive-check`-mønstret 1:1.

## Hvad spillerne ser efter arkivering

- Gameroom står som "Arkiveret" i dashboardet
- Standings, blok-sejre, round-points bevares uændret
- Lineup-builder er låst (race/round er finished)
- Ingen ny aktivitet — sæsonen er forbi

## Når en ny sæson tilføjes til EKSISTERENDE gameroom (fremtidig udvidelse)

**Ikke implementeret pr. nu.** Hvis vi senere ønsker at lade værter "fortsætte" et gameroom ind i næste sæson, skal vi designe:

- Skal gamle standings nulstilles eller akkumulere?
- Skal blok-sejre fra forrige sæson tælle i sejr-totalen?
- Hvordan håndteres spillere der har forladt gameroom'et?

Tag det op når vi rent faktisk har gamerooms der vil videreføres.
