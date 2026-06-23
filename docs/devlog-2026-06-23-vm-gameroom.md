# Devlog — 23. juni 2026 (VM-gameroom & admin)

Et langt forløb i VM-gameroomet (game 58, season 25) parallelt med Bold-sporet
([devlog-2026-06-23.md](devlog-2026-06-23.md)). Det dækker Blok Bets-feature'ens
fulde liv (bygget → tunet → fjernet igen), en gennemgribende omskrivning af Losers
Luck, en stribe øgenavn-fixes, blok-vinder-selvheling, en komplet plan for
knockout-bets, en admin-fix til mesterskabsspillet, og en del manuelle
prod-operationer (ny bruger, blok-vinder-rettelse, sene bets).

For tidligere arbejde se [devlog-2026-06-23.md](devlog-2026-06-23.md) (Bold) og
[devlog-2026-06-03.md](devlog-2026-06-03.md).

---

## Indholdsfortegnelse

1. [Blok Bets — bygget, tunet og fjernet igen](#1-blok-bets--bygget-tunet-og-fjernet-igen)
2. [Losers Luck omskrevet](#2-losers-luck-omskrevet)
3. [Øgenavne (helt/klovn) — flere fixes](#3-øgenavne-heltklovn--flere-fixes)
4. [Inaktive spillere altid nederst](#4-inaktive-spillere-altid-nederst)
5. [Blok-vinder selv-heler](#5-blok-vinder-selv-heler)
6. [Knockout-bets — plan klar](#6-knockout-bets--plan-klar)
7. [Admin: mesterskabs-runder tabte sæson ved gem](#7-admin-mesterskabs-runder-tabte-sæson-ved-gem)
8. [Manuelle prod-operationer](#8-manuelle-prod-operationer)
9. [Kendte issues / til senere](#9-kendte-issues--til-senere)

---

## 1. Blok Bets — bygget, tunet og fjernet igen

"Blok Bets" = bets på HELE blokken samlet (mål i blokken, dominans, clean sheets,
målfest). Featuren blev bygget færdig og finpudset over flere iterationer:

- **Markeder + scoring + placerings-API + UI** på kuponen, og afgjorte blok-bets
  foldet ind i leaderboardet (point/profit/blok-vinder).
- **Budget-model skiftede tre gange:** delte de 1000 → kort et separat låst 250 →
  endeligt **frigivet til ét fælles 1250-budget** pr. blok (PR #383, #386).
- **Markeder gjort ensidede** (kun Over/Ja — "Under 22.5 mål" gav ikke mening) (#385).
- **Odds → konsensus** i stedet for faste "random" odds, samme limits som
  ekstra-bets (#387).
- **Panel flyttet ind i kuponen** i stedet for som top-banner (#384), + nyheds-popup (#382).

**Men featuren blev fjernet igen (PR #399).** Diagnose: der var **0 blok-bets i
hele databasen** — placeringen persisterede aldrig (rute + DB + panel virkede
isoleret, men i praksis blev intet gemt; sandsynligvis fordi kampe nåede at låse
før gem). Ingen havde brugt det. UI fjernet (`BlockBetsPanel` +
`BlockBetsAnnouncement` slettet), bagenden efterladt i **dvale** (rute, scoring,
leaderboard-maps — 0 effekt med 0 bets, kan genaktiveres). **Budgettet beholdt på
1250** (3 spillere havde allerede brugt 1250 på kamp-bets → revert til 1000 ville
sætte dem over loftet; de ekstra 250 er nu blot kamp-credits).

Se [memory: vm-block-bets] for fuld historik hvis featuren genoptages.

---

## 2. Losers Luck omskrevet

🍀 Losers Luck (+20% på vundne bets for de nederste) var forkert: **Louise**
(midterplacering, 0 blok-sejre) fik det pga. en blok-sejre-først-rangering, og
**Morten** (var holdt op med at spille, 0 bets i blok 2-4) fik det blok efter blok.

Reglerne er nu (PR #389 → #391, se [memory: vm-losers-luck]):

1. **Bedøm på placeringen i den FORRIGE blok** — kun dens runders point, ikke
   samlede sæson-point og ikke blok-sejre. Så **blok-vinderen får aldrig
   comeback-hjælp** (Nikolaj vandt blok 3 → ikke losers luck i blok 4).
2. **Kun spillere der deltog i forrige blok** rangeres — inaktive er slet ikke med.
3. **Antallet skalerer med feltet:** 1 modtager ved ≤4 aktive deltagere, ellers 2.

Eksempel blok 4 endte med kun Stæhr (lavest i blok 3 blandt 4 aktive).

---

## 3. Øgenavne (helt/klovn) — flere fixes

Den positive helt (4 rigtige i en runde) og klovnen ("Null æg" for 0 point):

- **Vises nu på den AKTIVE (næste) blok** — båret fremad som badge — i stedet for
  retroaktivt på blokken hvor de blev tjent. Default-blok = aktiv blok (#389).
- **Klovn kræver deltagelse:** kun spillere der faktisk lagde bets i runden kan
  blive "Null æg" — en der sad over scorede ikke 0, han var der ikke (#393).
- **Navne varierer pr. runde** (seedet på rundens id) og er **unikke pr. visning**
  (`getTauntUnique`/`getHeroUnique` — to spillere deler aldrig navn) (#394).
- Kort eksperiment med løbende rotation hvert 5. sek (#395) — **rullet tilbage**
  igen (#397): navnet er nu fast pr. runde, ikke konstant flippende.
- **Hover-tip** forklarer hvorfor man har navnet (begge slags) (#394).
- **Klippes ikke længere af** — lange navne ombryder, spiller-kolonnen bredere (#396).

---

## 4. Inaktive spillere altid nederst

En spiller der er holdt op med at spille (ingen bets i seneste afsluttede blok
eller den aktive blok) kunne ligge over aktive spillere via gamle point. Nu
sorteres inaktive **altid sidst** i alle leaderboard-faner, uanset sortértal
(PR #392, `getLeaderboardTabs`).

---

## 5. Blok-vinder selv-heler

To leaderboards viste forskellige blok 6-vindere: den lagrede `block_winners`
sagde Nikolaj (1176), den live-beregnede sagde Louise (1310). Årsag: Louises sene
bets blev scoret EFTER blokken var gjort op, og `evaluateFinishedBlocks` var
idempotent (sprang blokke med en gemt vinder over).

Fix (PR #402): `evaluateFinishedBlocks` sammenligner nu lagret vinder med den
aktuelt beregnede og **opdaterer hvis de afviger** — selv-helende ved sene
point-ændringer, uden flip-flop. (Blok 6-dataen blev også rettet manuelt til Louise.)

**Læring:** sene/manuelle bets på en allerede-afsluttet blok kan ændre blok-vinderen.

---

## 6. Knockout-bets — plan klar

Planlagt til knockout-fasen (ingen kode endnu) — [docs/knockout-ekstra-bets-plan.md](knockout-ekstra-bets-plan.md):

- **Forlænget-spilletid-bets:** vælger man X på en knockout-kamp, folder
  "hvem går videre" + "forlænget/straffe" sig ud. Ekstra-bet-odds (1.2-1.5).
- **🔥 On fire-kamp:** én tilfældig knockout-kamp pr. blok giver dobbelt odds,
  låst + synlig ved blok-start.
- **Afslutnings-popup** ("Knald eller fald") når sidste gruppespils-runde er spillet.

**Data-feasibility undersøgt:** Bolds liste-endpoint giver slutresultat +
`status_short`. Vi kan score forlænget (score viser vinder) og metode (status_short),
men **ikke straffesparks-vinderen** (slutstillingen er lige, shootout-vinder
mangler) → **manuel admin-indtastning** for straffe-kampe. De eksakte status_short-
koder (AET/Pen.) bekræftes på første rigtige knockout-kamp.

---

## 7. Admin: mesterskabs-runder tabte sæson ved gem

Ved opbygning af 2026/27-mesterskabet forsvandt en runde efter gem. Årsag: gem =
**slet + genopret**, og POST-ruten satte ikke `season` → den genoprettede runde
fik DB-default (`2025/26`) og forsvandt fra 2026/27-listen (PR #406).

- **Fix:** UI sender nu `season` med; POST-ruten sætter den.
- **Data genoprettet:** de to ramte runder (Runde 1 m. 5 kampe + Runde 3 m. 9 kampe)
  flyttet tilbage til 2026/27 — sæsonen har igen alle 43 runder.

---

## 8. Manuelle prod-operationer

Ikke-kode-ændringer mod prod (via service-role + scripts):

- **Ny bruger "Villads" oprettet uden email** — Supabase admin-API med placeholder-
  email (`Villads@bodega-bets.com`) + password, `subscription_status: 'comped'`,
  `onboarding_completed: true`. Tilføjet til game 58 (efter en runde hvor han
  midlertidigt blev taget ud igen).
- **Blok 6-vinder rettet** til Louise (1310) i `block_winners` — se sektion 5.
- **Villads' Portugal-bet-saga:** på din anmodning lagde jeg 4 bets for ham på en
  live-kamp (Portugal 5-0, alle vandt, +300) — som du efterfølgende bad om at
  **rulle helt tilbage**: bets fjernet, rundescore slettet, `profiles.points`
  nulstillet (300→0), og hans oprindelige 1250-kupon gendannet. Endte på 1250/1250
  uden Portugal-spor.
- **Louises sene bet** (Spanien-Saudi) lagt før kickoff med matchende konsensus-odds.

**Læring:** late/manuelle bets via DB får ikke automatisk konsensus-odds (kampen
er allerede låst) og fanges ikke af den automatiske scoring hvis kampen allerede
er afgjort — begge skal sættes/afgøres manuelt.

---

## 9. Kendte issues / til senere

- **Blok Bets-bagenden ligger i dvale** — kan genaktiveres hvis vi finder ud af
  hvorfor placeringen aldrig persisterede, evt. sammen med hjørne/kort-markeder (fase 2).
- **Knockout-bets skal bygges** når gruppespillet er slut (8-trins rækkefølge i
  plan-doc'en) — inkl. verifikation af Bolds status_short-koder på første knockout-kamp.
- **Villads er 250 "gæld" fri** — hans budget er i balance (1250/1250), men husk at
  late/manuelle bets på en allerede-afsluttet blok kan flytte en kåret blok-vinder.
