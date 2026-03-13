# Bodega Bets — Changelog

Kronologisk log over alle væsentlige ændringer, beslutninger og sessioner.
Format: `[DATO] Kategori — Beskrivelse`

---

## [2026-03-13] Lintfejl og konfiguration

- **Rettet stavefejl i sync-scores import** (`app/api/cron/sync-scores/route.ts`)
  - `@/lib/syncMatchScoes` → `@/lib/syncMatchScores`

- **Fjernet ugyldig `eslint`-property fra `next.config.ts`**
  - `eslint.ignoreDuringBuilds` er ikke en gyldig `NextConfig`-property i Next.js 16
  - Fjernet blokken — ESLint-konfiguration håndteres via `.eslintrc` eller CLI

- **`middleware.ts` → `proxy.ts` (udestående)**
  - Next.js 16 deprecerer `middleware`-konventionen til fordel for `proxy`
  - Advarsel observeret i build-output — tages i separat session

---

## [2026-03-13] Sikkerhed & Teknisk Gæld — Fuld gennemgang

### Sikkerhed
- **Fjernet ADMIN_SECRET Bearer-token** (`lib/adminAuth.ts`)
  - Fjernet `isBearerAuthorized()` funktionen og dens brug i `requireAdmin()`
  - Admin-adgang kræver nu udelukkende Supabase session (cookies)
  - Slettet `ADMIN_SECRET` fra `.env.local` og Vercel environment variables
  - Verificeret: `curl` med falsk Bearer token returnerer 401

- **Fjernet ADMIN_EMAILS fallback** (`lib/adminAuth.ts`)
  - Fjernet skjult mekanisme hvor email i env-variabel gav admin-adgang uden `is_admin = true` i DB
  - Admin-status afgøres nu udelukkende af `profiles.is_admin`
  - Slettet `ADMIN_EMAILS` fra `.env.local` og Vercel environment variables

### Ydeevne
- **Optimeret middleware til ét DB-kald** (`middleware.ts`)
  - Erstattet to separate `profiles`-queries (suspend-tjek + admin-tjek) med ét enkelt kald
  - `SELECT 'is_suspended, is_admin'` hentes én gang og bruges til begge tjek
  - Sparer ~100-200ms latency per beskyttet page load

### Teknisk gæld
- **Fjernet `pg` dependency** (`package.json`)
  - PostgreSQL-driveren var listet men aldrig brugt direkte — Supabase-klienten håndterer al DB-kommunikation
  - Kørt: `npm uninstall pg`

- **Slettet 4 ubrugte debug API-routes**
  - `app/api/admin/scrape-test/` — ingen referencer
  - `app/api/admin/debug-league/` — ingen referencer
  - `app/api/admin/sync-result/` — ingen aktive API-kald (kun tekstlabel i UI)
  - `app/api/admin/sync-schedule/` — ingen referencer
  - Beholdt: `live-test` (bruges af `LiveTestTab.tsx`) og `sync-test` (bruges af `SyncTesterClient.tsx`)

- **Opdateret `@supabase/supabase-js` i Railway** (`railway/package.json`)
  - Opgraderet fra `^2.49.1` til latest for at matche Next.js-projektet (`^2.98.0`)
  - Kørt: `cd railway && npm install @supabase/supabase-js@latest`

- **Dokumenteret cron-routes som manuelle fallbacks** (`app/api/cron/`)
  - Tilføjet JSDoc-kommentar øverst i alle 5 cron-routes der forklarer at Railway er primær kilde
  - Berørte filer: `sync-scores`, `sync-fixtures`, `update-rounds`, `calculate-points`, `send-reminders`

---

## [2026-03-13] End-to-End Test Setup — PL 30. runde

### Testmiljø oprettet
- Spilrum: `game_id=38` — "PL E2E Test", invite-kode `V5AQYS`
- Runde: `round_id=920` — "30. runde", `betting_closes_at = 2026-03-14 15:00 UTC`
- 10 kampe indlæst (`match_id` 8724–8733): lørdag 14/3, søndag 15/3 og mandag 16/3

### Brugere og bets
- 4 brugere tilknyttet: Mikkel (via UI), test1/test2/test3 (via SQL INSERT)
- Alle 4 brugere har afgivet 10 bets på runde 30 (`game_id=38`, `round_id=920`)
- `game_members` oprettet for alle 4 brugere via SQL

### Dokumentation
- Oprettet `BodegaBets_E2E_Test.docx` med observationslog, SQL-tjekliste og evalueringsskema

---

## [2026-03-13] Event-drevet Pointberegning

### Arkitekturbeslutning
- **Fjernet daglig `calculate-points` cron** fra `railway/index.ts`
- `calculateRoundPoints(roundId)` trigges nu direkte fra `syncMatchScores.ts` når en kamp skifter status til `finished`
- Effekt: points beregnes sekunder efter kampslut — ikke næste dag kl. 09:00

### Ændringer
- `lib/syncMatchScores.ts`: tracker `finishedRoundIds` og kalder `calculateRoundPoints()` per runde efter sync-løkken
- `railway/index.ts`: fjernet `calculate-points` cron schedule

---

## [2026-03-12] UI Bugfixes — Spilrum og Leaderboard

- **`computeRoundStatus` ignorerede DB-status for `upcoming` runder**
  - Funktion returnerede `open` for runder markeret `upcoming` i DB
  - Fix: tidlig return på `round.status === 'upcoming'`

- **`roundBets` hentede via `match_ids` i stedet for `round_id`**
  - Omskrevet til direkte query på `game_id` + `round_id`
  - Bruger nu `supabaseAdmin` for at omgå RLS

- **RLS blokerede læsning af andre brugeres bets**
  - Ændret fra `supabase` til `supabaseAdmin` i `roundBets`-query
  - Effekt: alle 4 brugere vises nu korrekt med "Bets afgivet" i leaderboard

---

## [2026-03-11] Railway Cron Server

- Opsat Express-server på Railway (`railway/index.ts`) som primær cron-kilde
- Cron-jobs: `sync-scores` (hvert 5. min), `sync-fixtures` (hvert 30. min), `update-rounds` (dagligt 08:00), `send-reminders` (dagligt 10:00)
- Railway bruger `CRON_SECRET` til autentificering af kald til Next.js API-routes

---

## [2026-03-10] Databasemigrationer — Blokstruktur

Fem migrationer udført i Supabase:
1. Oprettet `blocks`-tabel (sæson → blokke → runder hierarki)
2. Oprettet `rivalries`-tabel med 47 derby-rækker
3. Tilføjet `betting_balance` og `earnings` kolonner til `game_members`
4. Tilføjet `earnings_delta` til `round_scores`
5. Tilføjet `wildcard_match_id` til `rounds`

---

## Arkitektur — Hurtig Reference

| Komponent | Teknologi | Formål |
|---|---|---|
| Frontend | Next.js 16 + React 19 | UI og API routes |
| Database | Supabase (PostgreSQL) | Al data |
| Cron | Railway (node-cron) | Automatiske jobs |
| Hosting | Vercel | Frontend deploy |
| Scores API | Bold.dk intern aggregator | Live kampdata |
| Auth | Supabase Auth + cookies | Session-baseret |

### Miljøvariabler (aktive)
| Variabel | Bruges af | Formål |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Next.js + Railway | Supabase endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Next.js | Offentlig Supabase nøgle |
| `SUPABASE_SERVICE_ROLE_KEY` | Next.js + Railway | Admin DB-adgang |
| `CRON_SECRET` | Railway → Next.js | Auth til cron-endpoints |
| `NEXT_PUBLIC_APP_URL` | Next.js | App URL til links |

### Vigtige IDs
| Ressource | ID |
|---|---|
| Supabase projekt | `lbpoqbmdawmnsspnxbew` |
| Vercel URL | `bodegabets-git-claude-review-s-614c8e-mikkels-projects-5f70c149.vercel.app` |
| Railway URL | `bodegabets-production.up.railway.app` |
| GitHub repo | `github.com/MikkelStaehr/bodegabets` |
| E2E test spilrum | `game_id=38`, `round_id=920` |
