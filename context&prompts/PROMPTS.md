# VM Bet — Cursor Prompts v2

Kør disse prompts i rækkefølge. Læs CONTEXT.md før du starter.

---

## Prompt 1 — Projektopsætning

```
Jeg bygger en social fodbold betting platform kaldet VM Bet.
Læs CONTEXT.md for fuld projektbeskrivelse før du starter.

Stack: Next.js 14 (App Router), Supabase, Tailwind CSS, TypeScript.

Opret et nyt Next.js projekt med følgende mappestruktur:

/app
  /page.tsx                        (forside + globalt leaderboard)
  /login/page.tsx
  /register/page.tsx
  /dashboard/page.tsx
  /games
    /new/page.tsx
    /[id]/page.tsx
    /[id]/rounds/[roundId]/page.tsx
  /admin/page.tsx
  /api
    /admin
      /sync-schedule/route.ts
      /sync-result/route.ts
      /calculate-round/route.ts
    /games
      /create/route.ts
      /join/route.ts
    /cron
      /update-rounds/route.ts
/components
/lib
  /supabase.ts
  /scoring.ts
  /scraper.ts
/types
  /index.ts

Opret .env.local med placeholders:
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_SECRET=
CRON_SECRET=
```

---

## Prompt 2 — Database (kør i Supabase SQL Editor)

```sql
-- Profiler (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  points integer not null default 0,
  is_admin boolean not null default false,
  created_at timestamptz default now()
);

-- Spilrum
create table public.games (
  id serial primary key,
  name text not null,
  description text,
  host_id uuid references public.profiles not null,
  invite_code text unique not null,
  sport text not null default 'football',
  status text not null default 'active',
  created_at timestamptz default now()
);

-- Spilmedlemmer (bruger ↔ game)
create table public.game_members (
  id serial primary key,
  game_id integer references public.games on delete cascade not null,
  user_id uuid references public.profiles on delete cascade not null,
  points integer not null default 1000,
  joined_at timestamptz default now(),
  unique(game_id, user_id)
);

-- Spillerunder
create table public.rounds (
  id serial primary key,
  game_id integer references public.games on delete cascade not null,
  name text not null,
  stage text not null default 'custom',
  betting_opens_at timestamptz,
  betting_closes_at timestamptz,
  status text not null default 'upcoming',
  created_at timestamptz default now()
);

-- Kampe
create table public.matches (
  id serial primary key,
  round_id integer references public.rounds on delete cascade not null,
  home_team text not null,
  away_team text not null,
  kickoff_at timestamptz not null,
  home_score integer,
  away_score integer,
  home_ht_score integer,
  away_ht_score integer,
  yellow_cards integer,
  red_cards integer,
  first_scorer text,
  odds_home numeric,
  odds_draw numeric,
  odds_away numeric,
  status text not null default 'scheduled',
  source_url text
);

-- Side-bet definitioner per kamp
create table public.match_sidebet_options (
  id serial primary key,
  match_id integer references public.matches on delete cascade not null,
  bet_type text not null
);

-- Brugerens bets
create table public.bets (
  id serial primary key,
  user_id uuid references public.profiles on delete cascade not null,
  match_id integer references public.matches on delete cascade not null,
  game_id integer references public.games on delete cascade not null,
  prediction text not null,
  bet_type text not null default 'match_result',
  stake integer not null default 0,
  potential_win integer,
  result text,
  points_delta integer,
  created_at timestamptz default now(),
  unique(user_id, match_id, bet_type)
);

-- Point per runde per bruger per spil
create table public.round_scores (
  id serial primary key,
  user_id uuid references public.profiles on delete cascade not null,
  round_id integer references public.rounds on delete cascade not null,
  game_id integer references public.games on delete cascade not null,
  points_earned integer not null default 0,
  created_at timestamptz default now(),
  unique(user_id, round_id)
);

-- RLS
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_members enable row level security;
alter table public.bets enable row level security;
alter table public.round_scores enable row level security;

-- Profiles
create policy "Profiles are public" on public.profiles for select using (true);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Games
create policy "Games are public" on public.games for select using (true);
create policy "Authenticated users can create games" on public.games for insert with check (auth.uid() = host_id);
create policy "Host can update game" on public.games for update using (auth.uid() = host_id);

-- Game members
create policy "Members are public" on public.game_members for select using (true);
create policy "Users can join games" on public.game_members for insert with check (auth.uid() = user_id);

-- Bets
create policy "Users see own bets" on public.bets for select using (auth.uid() = user_id);
create policy "Users insert own bets" on public.bets for insert with check (auth.uid() = user_id);
create policy "Users update own bets" on public.bets for update using (auth.uid() = user_id);

-- Round scores
create policy "Round scores are public" on public.round_scores for select using (true);
```

---

## Prompt 3 — TypeScript typer

```
Opret /types/index.ts med følgende typer der matcher databaseskemaet:

export type Profile = {
  id: string
  username: string
  points: number
  is_admin: boolean
  created_at: string
}

export type Game = {
  id: number
  name: string
  description: string | null
  host_id: string
  invite_code: string
  sport: string
  status: 'active' | 'finished'
  created_at: string
}

export type GameMember = {
  id: number
  game_id: number
  user_id: string
  points: number
  joined_at: string
}

export type Round = {
  id: number
  game_id: number
  name: string
  stage: string
  betting_opens_at: string | null
  betting_closes_at: string | null
  status: 'upcoming' | 'open' | 'closed' | 'finished'
  created_at: string
}

export type Match = {
  id: number
  round_id: number
  home_team: string
  away_team: string
  kickoff_at: string
  home_score: number | null
  away_score: number | null
  home_ht_score: number | null
  away_ht_score: number | null
  yellow_cards: number | null
  red_cards: number | null
  first_scorer: string | null
  odds_home: number | null
  odds_draw: number | null
  odds_away: number | null
  status: 'scheduled' | 'finished'
  source_url: string | null
}

export type Bet = {
  id: number
  user_id: string
  match_id: number
  game_id: number
  prediction: string
  bet_type: 'match_result' | 'first_scorer' | 'total_goals' | 'yellow_cards' | 'red_cards' | 'btts' | 'halftime'
  stake: number
  potential_win: number | null
  result: 'win' | 'loss' | 'pending' | null
  points_delta: number | null
  created_at: string
}

export type RoundScore = {
  id: number
  user_id: string
  round_id: number
  game_id: number
  points_earned: number
  created_at: string
}

Opsæt også /lib/supabase.ts med browser- og server-klient til Next.js App Router.
```

---

## Prompt 4 — Auth: Register & Login

```
Byg register og login flow. Ingen invitationskode påkrævet — alle kan registrere sig frit.
Man joiner spil via invitationskode i stedet.

Register (/app/register/page.tsx):
- Formular: brugernavn, email, password
- supabase.auth.signUp()
- Indsæt profil i public.profiles med username og points = 0
- Redirect til /dashboard

Login (/app/login/page.tsx):
- Email + password
- supabase.auth.signInWithPassword()
- Redirect til /dashboard

Design: rent og moderne, grøn/mørkegrå farvetema, mobilvenligt.
Ingen casino-æstetik — tænk mere moderne sports app.
```

---

## Prompt 5 — Forside & Globalt Leaderboard

```
Byg /app/page.tsx — offentlig forside der er synlig for alle, også ikke-indloggede.

Siden skal indeholde:

1. HERO SEKTION
   - Kort præsentation af platformen
   - "Log ind" og "Opret profil" knapper (hvis ikke logget ind)
   - "Gå til dashboard" knap (hvis logget ind)

2. GLOBALT LEADERBOARD
   - Hent alle profiler fra public.profiles sorteret efter points DESC
   - Vis top 20 spillere: placering, brugernavn, samlede point
   - Delte pladser ved pointlighed
   - Highlight den indloggede bruger hvis de er på listen

Design: imponerende og indbydende — dette er platformens ansigt udadtil.
Server-side rendered. Brug Supabase server client.
```

---

## Prompt 6 — Dashboard

```
Byg /app/dashboard/page.tsx — kræver login, redirect til /login hvis ikke autentificeret.

Siden skal vise:

1. DINE SPIL
   - Hent alle games hvor brugeren er game_member
   - Vis hvert spil som et kort: navn, antal deltagere, brugerens lokale point, status
   - Knap på hvert kort: "Gå til spil" → /games/[id]

2. JOIN SPIL
   - Inputfelt til invitationskode
   - Knap "Join" → kalder /api/games/join
   - Fejlbesked hvis koden ikke findes eller brugeren allerede er med

3. OPRET SPIL
   - Knap "Opret nyt spil" → /games/new

Server-side rendered. Brug Supabase server client.
```

---

## Prompt 7 — Opret & Join spil

```
Byg /app/games/new/page.tsx og to API routes.

SIDE: /app/games/new/page.tsx
- Formular: navn på spil, beskrivelse (valgfrit)
- Submit → POST /api/games/create
- Redirect til /games/[id] ved succes

API ROUTE: /app/api/games/create/route.ts
- Kræver autentificering
- Generer en unik 6-tegns invitationskode (store bogstaver + tal)
- Indsæt i public.games med host_id = nuværende bruger
- Indsæt host som game_member med 1000 startpoint
- Returnér game id og invite_code

API ROUTE: /app/api/games/join/route.ts
- Kræver autentificering
- Request body: { invite_code: string }
- Find game med den invite_code
- Tjek at brugeren ikke allerede er medlem
- Indsæt i game_members med 1000 startpoint
- Returnér game id
```

---

## Prompt 8 — Spilrum

```
Byg /app/games/[id]/page.tsx — kræver login + at brugeren er game_member.

Siden skal vise:

1. SPIL HEADER
   - Spillets navn og beskrivelse
   - Invitationskode synlig (så host kan dele den)
   - Antal deltagere

2. LOKALT LEADERBOARD
   - Hent alle game_members for dette spil
   - Join med profiles for at få username
   - Sorter efter game_members.points DESC
   - Vis placering, brugernavn, point
   - Highlight den indloggede bruger
   - Delte pladser ved pointlighed
   - Udvid med point per runde (fra round_scores hvor game_id matcher)

3. RUNDER
   - Vis alle runder for dette spil
   - For åben runde (status = 'open'): vis "Afgiv bets" knap → /games/[id]/rounds/[roundId]
   - For lukkede/færdige runder: vis resultat og brugerens point
   - For kommende runder: vis hvornår betting åbner

Server-side rendered. Brug Supabase server client.
```

---

## Prompt 9 — Bet-side

```
Byg /app/games/[id]/rounds/[roundId]/page.tsx
Kræver login + at brugeren er game_member i dette spil.

For HVER kamp i runden:

1. KAMP HEADER
   - Hjemmehold vs Udehold
   - Avspark tidspunkt

2. 1-X-2 VALG (obligatorisk)
   - Tre knapper: 1 / X / 2
   - Vis odds og potentielle point: Math.round(100 * odds)
   - Fremhæv valgt option

3. SIDE-BETS (kun hvis admin har aktiveret dem for kampen)
   - Hent aktive bet-typer fra match_sidebet_options
   - first_scorer: tekstinput
   - total_goals: talinput
   - yellow_cards: talinput
   - red_cards: talinput
   - btts: ja/nej toggle
   - halftime: 1/X/2 valg
   - Indsats inputfelt per side-bet + vis potentiel gevinst = indsats * 2

4. GEM ALLE BETS (én knap for hele runden)
   - Kun muligt hvis runden har status = 'open'
   - Validér at brugeren har nok lokale point (game_members.points) til alle side-bet indsatser
   - Gem i public.bets med game_id
   - Vis eksisterende bets read-only hvis allerede afgivet

Brug brugerens game_members.points (lokale point) til validering — ikke profiles.points.
```

---

# VM Bet — Cursor Prompts v3

Kør disse prompts i rækkefølge. Læs CONTEXT.md og DESIGN-CONTEXT.md før du starter.

---

## ✅ Prompt 1 — Projektopsætning (DONE)
## ✅ Prompt 2 — Database (DONE)
## ✅ Prompt 3 — TypeScript typer (DONE)
## ✅ Prompt 4 — Auth (DONE)
## ✅ Prompt 5 — Forside + globalt leaderboard (DONE)
## ✅ Prompt 6 — Dashboard (DONE)
## ✅ Prompt 7 — Opret & Join spil (DONE)
## ✅ Prompt 8 — Spilrum (DONE)
## ✅ Prompt 9 — Bet-side (DONE)

---

## Prompt 10a — Leagues tabel + seed data (KØR FØRST i Supabase SQL Editor)

```sql
-- Leagues tabel
create table public.leagues (
  id serial primary key,
  name text not null,
  country text not null,
  sofascore_tournament_id text not null,
  sofascore_season_id text,
  is_active boolean not null default true
);

-- Seed med kendte ligaer
insert into public.leagues (name, country, sofascore_tournament_id, sofascore_season_id) values
  ('FIFA World Cup 2026', 'World', '16', '58210'),
  ('Superliga', 'Denmark', '383', null),
  ('Premier League', 'England', '17', null),
  ('La Liga', 'Spain', '8', null),
  ('Bundesliga', 'Germany', '35', null),
  ('Serie A', 'Italy', '23', null),
  ('Ligue 1', 'France', '34', null),
  ('UEFA Champions League', 'Europe', '7', null);

-- Tilføj league_id til games tabellen
alter table public.games add column league_id integer references public.leagues;

-- RLS
alter table public.leagues enable row level security;
create policy "Leagues are public" on public.leagues for select using (true);
```

---

## Prompt 10b — Sofascore API Integration

```
Opdater /types/index.ts med League type:

export type League = {
  id: number
  name: string
  country: string
  sofascore_tournament_id: string
  sofascore_season_id: string | null
  is_active: boolean
}

Byg /lib/sofascore.ts med følgende funktioner.
Sofascore har et uofficielt JSON API — ingen nøgle påkrævet.
Tilføj altid denne header for at undgå blokering:
'User-Agent': 'Mozilla/5.0 (compatible; VMBet/1.0)'

BASE_URL = 'https://api.sofascore.com/api/v1'

---

FUNKTION 1: fetchSchedule(tournamentId: string, seasonId: string): Promise<SofascoreEvent[]>
Endpoint: GET {BASE_URL}/tournament/{tournamentId}/season/{seasonId}/events/next/0
Returnér raw events array fra response.events

---

FUNKTION 2: fetchEventDetails(eventId: string): Promise<SofascoreEventDetail>
Endpoint: GET {BASE_URL}/event/{eventId}
Returnér raw event objekt fra response.event

---

FUNKTION 3: fetchIncidents(eventId: string): Promise<SofascoreIncident[]>
Endpoint: GET {BASE_URL}/event/{eventId}/incidents
Returnér raw incidents array fra response.incidents

---

FUNKTION 4: mapEventToMatch(event: SofascoreEvent, roundId: number): Partial<Match>
Mapper et Sofascore event til vores Match type:
- home_team: event.homeTeam.name
- away_team: event.awayTeam.name
- kickoff_at: new Date(event.startTimestamp * 1000).toISOString()
- sofascore_event_id: String(event.id)
- source_url: https://www.sofascore.com/event/{event.id}
- round_id: roundId
- status: 'scheduled'

---

FUNKTION 5: mapIncidentsToResult(incidents: SofascoreIncident[]): Partial<Match>
Mapper incidents til kampstatistik:
- yellow_cards: tæl incidents hvor incidentType === 'card' && cardType === 'yellow'
- red_cards: tæl incidents hvor incidentType === 'card' && (cardType === 'red' || cardType === 'yellowRed')
- first_scorer: find første incident hvor incidentType === 'goal', returnér incident.player?.name

---

Byg nu to API routes:

ROUTE 1: /app/api/admin/sync-schedule/route.ts
Beskyt med: Authorization: Bearer ADMIN_SECRET
Request body: { round_id: number, game_id: number }

Logik:
1. Hent runden fra Supabase, join med games for at få league_id
2. Hent ligaen fra leagues tabellen for tournament_id og season_id
3. Kald fetchSchedule(tournamentId, seasonId)
4. Filtrer events: kun kampe der ikke er startet (event.status.type === 'notstarted')
5. For hver kamp: kald mapEventToMatch og upsert i public.matches
   (upsert på sofascore_event_id for at undgå dubletter)
6. Returnér { synced: antal kampe }

ROUTE 2: /app/api/admin/sync-result/route.ts
Beskyt med: Authorization: Bearer ADMIN_SECRET
Request body: { match_id: number }

Logik:
1. Hent kampen fra Supabase for at få sofascore_event_id
2. Kald fetchEventDetails(sofascore_event_id)
3. Opdater matches med:
   - home_score: event.homeScore.current
   - away_score: event.awayScore.current
   - home_ht_score: event.homeScore.period1
   - away_ht_score: event.awayScore.period1
   - status: 'finished'
4. Kald fetchIncidents(sofascore_event_id)
5. Kald mapIncidentsToResult(incidents) og opdater matches
6. Returnér opdaterede kampdata

Brug Supabase service role key til alle database-operationer.
```

---

## Prompt 11 — Opdater "Opret spil" til at vælge liga

```
Opdater /app/games/new/page.tsx og /app/api/games/create/route.ts

SIDE: /app/games/new/page.tsx
- Tilføj liga-dropdown til formularen
- Hent alle aktive ligaer fra public.leagues (server-side)
- Vis som: "VM 2026 (World)", "Superliga (Denmark)" osv.
- Liga valg er obligatorisk

API ROUTE: /app/api/games/create/route.ts
- Tilføj league_id til INSERT i public.games fra request body
- league_id er påkrævet
```

---

## Prompt 12 — Pointberegning

```
Byg /lib/scoring.ts og /app/api/admin/calculate-round/route.ts

Beskyt routen med: Authorization: Bearer ADMIN_SECRET
Request body: { round_id: number, game_id: number }

Logik:
1. Hent alle kampe i runden med status = 'finished'
2. Hent alle bets for disse kampe inden for dette game_id

3. Match result bets:
   - Faktisk resultat: home > away → '1', home === away → 'X', home < away → '2'
   - Korrekt: points_delta = Math.round(100 * relevant_odds)
   - Forkert: points_delta = 0
   - Opdater bet.result og bet.points_delta

4. Side-bets:
   - first_scorer: prediction.toLowerCase().trim() === first_scorer?.toLowerCase().trim()
   - total_goals: parseInt(prediction) === (home_score + away_score)
   - yellow_cards: parseInt(prediction) === yellow_cards
   - red_cards: parseInt(prediction) === red_cards
   - btts: ('ja'/'nej') === (home_score > 0 && away_score > 0 ? 'ja' : 'nej')
   - halftime: samme logik som match_result med ht scores
   - Korrekt: points_delta = +stake
   - Forkert: points_delta = -stake

5. For hver bruger i game_id:
   - Beregn sum af alle points_delta for denne runde
   - Upsert i round_scores
   - Opdater game_members.points += sum
   - Opdater profiles.points += Math.max(0, sum) (kun positive bidrag globalt)

Returnér: { results: [{ username, points_delta, new_total }] }
```

---

## Prompt 13 — Admin Panel

```
Byg /app/admin/page.tsx — kun tilgængeligt for brugere med is_admin = true.
Beskyt med middleware der checker is_admin server-side.

Fire faner:

1. RUNDER
   - Vælg spil fra dropdown (alle aktive games med ligaens navn)
   - Opret ny runde: navn, stage dropdown, betting_opens_at, betting_closes_at
   - Vis alle runder for valgt spil med status badge
   - Skift status: upcoming → open → closed → finished
   - Ved 'finished': auto-sæt betting_opens_at på næste 'upcoming' runde = now() + 24t

2. KAMPE
   - Vælg runde fra dropdown
   - Knap "Hent kampprogram fra Sofascore"
     → POST /api/admin/sync-schedule med { round_id, game_id }
   - Vis alle kampe i runden: hold, avspark, status
   - Per kamp med status 'scheduled': knap "Hent resultat"
     → POST /api/admin/sync-result med { match_id }
   - Mulighed for manuelt at rette scores i et edit-felt

3. SIDE-BETS
   - Vælg runde → vis kampe
   - Per kamp: checkboxes for aktive side-bet typer
   - first_scorer / total_goals / yellow_cards / red_cards / btts / halftime
   - Gem i match_sidebet_options

4. OPGØRELSE
   - Vælg spil + runde
   - Vis antal kampe finished vs total
   - Knap "Beregn point" → POST /api/admin/calculate-round
   - Vis resultat: liste over brugere med point ændringer

Alle API-kald sender: Authorization: Bearer ADMIN_SECRET header.
```

---

## Prompt 14 — Design System

```
Læs DESIGN-CONTEXT.md grundigt før du starter.

Implementer det fulde design system:

1. Installer Google Fonts i /app/layout.tsx via next/font/google:
   - Playfair Display (700, 900)
   - Barlow Condensed (400, 600, 700)
   - Barlow (400, 500, 600)

2. Opdater tailwind.config.ts:
   - Farver: cream, cream-dark, forest, forest-border, vintage-red, gold, text-warm, border
   - Fonte: display (Playfair Display), condensed (Barlow Condensed), body (Barlow)
   - Border radius: DEFAULT 2px, badge 4px

3. Opdater /app/globals.css med CSS custom properties

4. Byg /components/ui/:
   - Button.tsx (primary, secondary, danger)
   - Card.tsx
   - Badge.tsx (open, closed, upcoming, finished)
   - Input.tsx
   - Navbar.tsx (forest baggrund, Playfair Display logo)

5. Anvend designsystemet på ALLE eksisterende sider:
   - / (forside)
   - /login og /register
   - /dashboard
   - /games/new
   - /games/[id]
   - /games/[id]/rounds/[roundId]
   - /admin

Husk: skarpe kanter, heritage æstetik, creme baggrund, ingen casino-look.
```

---

## Prompt 15 — Cron & Automatisk rundestyring

```
Byg /app/api/cron/update-rounds/route.ts

Kører hvert 30. minut via Vercel cron.
Beskyt med: Authorization: Bearer CRON_SECRET

Logik:
1. Find runder med status = 'upcoming' hvor betting_opens_at <= now()
   → Sæt status = 'open'

2. Find runder med status = 'open' hvor betting_closes_at <= now()
   → Sæt status = 'closed'

Opret vercel.json i roden:
{
  "crons": [
    {
      "path": "/api/cron/update-rounds",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

---

## Prompt 16 — Deploy

```
Forbered til deployment på Vercel med subdomain på stæhrs.dk.

1. Tilføj environment variables i Vercel:
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   ADMIN_SECRET
   CRON_SECRET

2. Vercel → Domains → tilføj vm.stæhrs.dk
   Følg Vercel's CNAME instruktioner

3. Supabase → Authentication → URL Configuration:
   - Site URL: https://vm.stæhrs.dk
   - Redirect URLs: https://vm.stæhrs.dk/**

4. Opret admin bruger via Supabase SQL Editor:
   update public.profiles set is_admin = true where username = 'dit-brugernavn';

5. Test end-to-end:
   - Opret spil med VM 2026 liga
   - Opret runde + hent kampprogram fra Sofascore
   - Join med en anden bruger
   - Afgiv bets
   - Hent resultat + beregn point
   - Tjek lokalt og globalt leaderboard
```

---

## Samlet rækkefølge

- ✅ Prompt 1-9 — Grundstruktur done
- ⏳ **Nu:** Prompt 10a (SQL i Supabase) → Prompt 10b (Sofascore API)
- Prompt 11 — Opdater opret spil
- Prompt 12 — Pointberegning
- Prompt 13 — Admin panel
- Prompt 14 — Design system
- Prompt 15 — Cron
- Prompt 16 — Deploy
