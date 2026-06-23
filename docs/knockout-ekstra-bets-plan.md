# Knockout: ekstra-bets for forlænget spilletid — implementeringsplan

*Skrevet 23/6 2026. Klar til at bygge når VM-gruppespillet er ved at være slut
(knockout starter med 1/16-finalerne). Ingen kode skrevet endnu.*

## Koncept

Knockout-kampe kan ikke ende uafgjort. På 1/X/2 betyder **"X" = uafgjort efter
ordinær tid → forlænget spilletid**. Når en spiller vælger X på en knockout-kamp,
folder to ekstra-valg sig ud:

1. **Hvem går videre?** → Hjemme / Ude
2. **Hvordan afgøres det?** → Forlænget spilletid / Straffespark

Det er spejlvendingen af de nuværende ekstra-bets (goals_3plus / clean_sheet /
win_margin), som *skjules* på X — disse nye vises **kun** på X.

## Datagrundlag (verificeret 23/6 2026)

- Alle 32 knockout-kampe kommer gennem **samme Bold-endpoint** som gruppekampene
  (`aggregator/v1/apps/page/matches`). De ligger allerede der (skemalagt, med
  pladsholdere som "2A v 2B").
- Pr. kamp får vi: **slutresultat (mål) + `status_short`**.
- Forventet mapping (BEKRÆFTES på første rigtige knockout — ingen spillet endnu):
  - `FT` → afgjort i ordinær tid
  - `AET` → afgjort i forlænget spilletid
  - `Pen.` (e.l.) → afgjort på straffe
- **GAP:** ved straffe står slutresultatet lige (fx 1-1), og endpointet giver
  **ikke** straffesparks-vinderen. Intet brugbart detalje-/straffe-endpoint
  findes (`/match?match_id=` returnerer kun en side-skabelon).

## Datamodel

**`matches`** — nye kolonner:
- `is_knockout boolean default false` — sættes ud fra round-navn ved sync/seed
  (1/16-finale, ottendedelsfinale, kvartfinale, semifinale, bronze, finale).
- `ko_method text` (`null` | `'et'` | `'pen'`) — sættes af sync ud fra `status_short`.
- `ko_advanced text` (`null` | `'1'` | `'2'`) — hvem gik videre. Ved `'et'` udledes
  det af resultatet (sync); ved `'pen'` indtastes det manuelt af admin.

**`bets.bet_type`** — to nye typer (kun på `is_knockout`-kampe, kun gyldige når
brugerens `match_result` = `'X'` på samme kamp):
- `ko_advance` — prediction `'1'`/`'2'` (hjemme/ude går videre).
- `ko_method` — prediction `'et'`/`'pen'`.

## UI (`components/games/AfgivBets.tsx`)

- For `is_knockout`-kampe: når brugeren vælger **X**, vis de to ekstra-valg under
  kampen (samme stil som de eksisterende ekstra-bets). Skjul igen ved skift til 1/2.
- Server-validering (`submit-bets`): `ko_advance`/`ko_method` kun tilladt når
  kampen er knockout OG brugerens `match_result` på kampen er `'X'`.
- De eksisterende ekstra-bets (goals_3plus/clean_sheet/win_margin) er uændrede —
  de gælder fortsat et 1/2-pick på 90-min-resultatet.

## Scoring (`lib/calculatePoints.ts` + sync)

Knockout-resultat udledes af `status_short` + slutresultat:
- **match_result**: `FT` + hjemme>ude → `'1'`; `FT` + ude>hjemme → `'2'`;
  `AET`/`Pen.` → `'X'` (stod lige efter 90).
- **ko_method**: `AET` → `'et'`; `Pen.` → `'pen'`.
- **ko_advance**:
  - `'et'`: vinder = højeste slutresultat (kendt). Score automatisk.
  - `'pen'`: vinder = `matches.ko_advanced` (admin-indtastet). Indtil det er sat
    forbliver bettet **pending** (scores ikke).
- **Odds**: samme model som de eksisterende **ekstra-bets** (ikke hoved-bettet):
  konsensus i intervallet **1.2–1.5** via `max(1.2, 1.5 − pct·0.3)`, sat ved lås.
  ko_advance og ko_method får hver deres konsensus ud fra fordelingen af valg.

## 🔥 On fire-kamp (dobbelt odds)

Per **knockout-blok** udvælges **én tilfældig kamp** som "on fire" — alle bets på
den kamp giver **dobbelt odds** (odds × 2 → dobbelt gevinst).

- **Omfang**: alle bet-typer på kampen (match_result + ekstra-bets +
  ko_advance/ko_method). Kun i knockout-fasen.
- **Udvælgelse**: tilfældig blandt blokkens knockout-kampe, **låst ved blok-start**
  (cron'en der åbner blokken vælger én kamp og sætter et flag). Deterministisk/gemt
  så den ikke kan game'es eller skifte undervejs.
- **Synlighed**: vises med et 🔥-badge på kampen **fra blok-start**, så spillerne
  kan se den og satse derefter (det er hele pointen).
- **Datamodel**: `matches.is_on_fire boolean default false` (sættes når blokken
  åbner; nulstilles aldrig for spillede blokke).
- **Scoring**: for bets på on-fire-kampen ganges gevinsten med 2
  (`points_earned = stake × odds × 2` ved gevinst). Selve konsensus-oddsene er
  uændrede — multiplikatoren lægges oveni ved scoring.

## Admin-felt: straffesparks-vinder

- For kampe med `ko_method = 'pen'` og `ko_advanced = null`: en lille admin-handling
  "Hvem gik videre?" → `'1'`/`'2'`. Knap i admin-panelet eller et lille script.
- Få kampe pr. turnering (typisk 2-5 ud af 32).
- Når sat → scoring afgør de ventende `ko_advance`-bets.

## Verifikation før knockout

- Når **første 1/16-finale** er spillet: bekræft Bolds faktiske `status_short`-koder
  for forlænget/straffe og justér mapping. Evt. en `/schedule`-kørsel der logger
  `status_short` for den første knockout-kamp.

## Afslutnings-popup: "Knald eller fald" (når gruppespillet er slut)

Engangs-popup i **samme stil** som `VmRulesAnnouncement` (forest-header med
guld-eyebrow, cream-body, `RuleItem`-rækker, side-indikator) der forklarer alle
knockout-nyhederne — vist når **sidste gruppespils-runde er spillet**.

- **Komponent**: `components/games/KnockoutAnnouncement.tsx`, mountet i
  `app/games/[id]/page.tsx` ved siden af `VmRulesAnnouncement` (kun blok-spil).
- **Trigger**: vises ÉN gang pr. browser (localStorage-nøgle, fx
  `bodega_vm_knockout_seen_v1`), men **kun når knockout-fasen er begyndt** — gates
  på at gruppespillet er færdigt (alle gruppe-runder finished / aktiv blok er en
  knockout-blok). Så den popper ikke op under gruppespillet, og ikke før feature'en
  er relevant.
- **Indhold (3 sider)**:
  1. **"Knald eller fald"** 🏆 — knockout starter; herfra kan kampe ikke ende
     uafgjort.
  2. **Kryds = forlænget** 🔄 — vælger du X, tager du stilling til *hvem der går
     videre* + *forlænget eller straffe* (giver ekstra-odds).
  3. **🔥 On fire-kampen** — én tilfældig kamp pr. blok giver **dobbelt odds**;
     hold øje med 🔥-badget.

## Edge cases

- Knockout afgjort i ordinær tid (`FT`): et X-bet + ET-ekstra-bets taber.
- Bronzekamp + finale er også knockout (ingen uafgjort).
- Hvis Bold mod forventning eksponerer straffe-vinderen et sted → drop den manuelle
  indtastning og udled `ko_advanced` automatisk.

## Byggerækkefølge

1. Schema: `is_knockout`, `ko_method`, `ko_advanced`, `is_on_fire`, de to bet-typer.
2. Sync: sæt `is_knockout` (round-navn) + `ko_method`/`ko_advanced` (status_short) i `syncMatchScores`.
3. On fire: vælg + sæt `is_on_fire` på én tilfældig knockout-kamp når blokken åbner (block-aware åbnings-logik i `railway/index.ts`).
4. UI: X-foldout + 🔥-badge i `AfgivBets` + server-validering i `submit-bets`.
5. Scoring: de to nye bet-typer (ekstra-bet-odds 1.2–1.5) + ×2-multiplikator for on-fire-kampen.
6. Admin-felt for straffesparks-vinder.
7. Afslutnings-popup `KnockoutAnnouncement` (gated på knockout-fase-start).
8. Verifikation på første rigtige knockout-kamp.
