# Bodega Bets — Cykling Fantasy Spec

> **Status:** Baseline design — ikke implementeret  
> **Sidst opdateret:** April 2026  
> **Formål:** Definere regler, pointsystem og datamodel for cykling-modulet i Bodega Bets

---

## Overblik

Bodega Bets udvides med et cykling fantasy-modul. I modsætning til fodbold-modulet (1/X/2 betting) er cykling baseret på en **rolle- og trup-mekanik** der belønner taktisk forståelse af løbsdynamik — ikke bare at picke vinderen.

Spillet er organiseret i **blocks** (ligesom fodbold), og spillerne sammensætter en brutto trup ved block-start og justerer deres aktive hold løb for løb.

---

## Trup-struktur

### Brutto trup — 25 mand (sættes ved block-start)

Brutto truppen er låst inden for en block. Spilleren kan kun vælge aktive ryttere fra denne pulje.

| Kategori | UCI ranglisteplads | Max antal |
|---|---|---|
| Kat 1 | 1–24 | 3 |
| Kat 2 | 25–49 | 5 |
| Kat 3 | 49–99 | 5 |
| Kat 4 | 100–199 | 5 |
| Lykkeriddere | 200+ | 7 |
| **Total** | | **25** |

**Hold-regel:** Max 3 ryttere fra samme professionelle hold i brutto truppen. De 3 skal være i **forskellige kategorier**.

---

### Aktiv trup — 8 mand (justeres mellem hvert løb)

Spilleren vælger 8 ryttere fra brutto truppen til hvert løb. Roller tildeles per løb og kan ændres frit inden lock.

**Bekræftet-filter:** Ryttere kan vælges fra hele brutto truppen, men kan filtreres på "bekræftet til løbet" baseret på PCS startliste (polles dagligt). Har man en ikke-bekræftet rytter i aktiv trup ved lock, er holdet ugyldigt og skal redigeres.

---

## Roller

Hver rytter i den aktive trup tildeles **én rolle** per løb. Roller tildeles frit — samme rytter kan have forskellig rolle fra løb til løb.

### Kaptajn
- Tilgængelig for alle kategorier
- Scorer på placering × kategori-multiplikator
- Kan kombineres med solo angreb-bonus hvis kaptajnen vinder solo

### Solo angreb
- Tilgængelig for alle kategorier
- Scorer bonus hvis løbet ender med "Won how: Solo" (PCS-data)
- Bonus gælder kun top 5 placeringer

### Sprint assist
- Kun tilgængelig for **Kat 1–3**
- Scorer hvis rytteren ender top 25 **og** er på samme hold som løbets vinder i en massespurt
- Massespurt detekteres via tidsgab-analyse (alle top-20 inden for få sekunder)

### Domestik
- Kun tilgængelig for **Kat 4**
- Scorer 8p hvis:
  - Rytteren ender top 40–50, **og**
  - Kaptajnen ender top 10 **eller** sprinter på samme hold vinder løbet
- Kan dække både bjerg- og spurt-scenarier

---

## Pointsystem

### Basispoints — kaptajn placering

| Placering | Points |
|---|---|
| Sejr | 50p |
| Top 3 | 30p |
| Top 5 | 20p |
| Top 10 | 10p |
| Top 20 | 5p |

### Rolle-bonus (lægges oveni basispoints)

| Rolle | Sejr | Top 3 | Top 5 | Top 10 | Top 25/40-50 |
|---|---|---|---|---|---|
| Solo angreb | +30p | +20p | +15p | — | — |
| Sprint assist | — | — | — | — | +10p (top 25) |
| Domestik | — | — | — | — | +8p (top 40-50) |

### Kategori-multiplikator

Gælder for **basispoints + rolle-bonus** samlet.

| Kategori | Multiplikator |
|---|---|
| Kat 1 | ×1.0 |
| Kat 2 | ×1.3 |
| Kat 3 | ×1.7 |
| Kat 4 | ×2.2 |
| Lykkeridder | ×3.5 |

**Eksempel:** Lykkeridder vinder solo angreb → (50 + 30) × 3.5 = **280p**

### Trøje-points (etapeløb)

Fast point per dag rytteren bærer trøjen. Gælder uanset kategori.

| Trøje | Points/dag |
|---|---|
| Gul (samlet) | 8p |
| Grøn (point) | 5p |
| Prikket (bjerg) | 5p |
| Hvid (ungt rytter) | 3p |

### Hold-bonus

+5p per rytter i den **aktive trup** der er på samme hold som løbets vinder.  
Max 3 hold-ryttere i brutto truppen → max **+15p** hold-bonus per løb.

---

## Straffe

### Bænkestraf
Udløses hvis en rytter **i brutto truppen men ikke i aktiv trup** præsterer:
- Top 3 placering
- Bærer en trøje den pågældende dag

**Straf:** −70% af hvad rytteren ville have scoret (placering + rolle-bonus + trøje).

### DNF-straf
Udgår en rytter fra løbet (abandon):
- **−20p** uanset om rytteren er aktiv eller på bænken
- Gælder alle kategorier

---

## Datagrundlag

### Scraper-kilder
| Data | Kilde | Tilgængelighed |
|---|---|---|
| UCI verdensrangliste | PCS rankings | ✅ Scrapes allerede |
| Startlister | PCS race pages | ✅ Polles dagligt |
| Løbsresultater + placering | PCS result pages | ✅ Scrapes allerede |
| Tidsgab per rytter | PCS result table | ⚠️ Skal tilføjes til scraper |
| Won how (Solo/Sprint/Group) | PCS race overview | ⚠️ Skal tilføjes til scraper |
| Hold per rytter | PCS / Holdet.dk | ✅ Tilgængeligt |
| Trøje-bærere per etape | PCS stage results | ⚠️ Skal verificeres |
| Attack km (udbrud-proxy) | PCS statistics | ⚠️ Skal undersøges |
| DNF/abandon tracking | PCS result pages | ⚠️ Skal tilføjes |

### Finish-type inferens
Massespurt detekteres hvis top-20 alle er inden for ~5 sekunder af hinanden.  
Solo angreb detekteres via "Won how: Solo" på PCS race overview-siden.

---

## Åbne spørgsmål

- [ ] Hvornår starter og slutter en block i cykling-kontekst?
- [ ] Multipliceres trøje-points også med kategori-multiplikator?
- [ ] Præcis top 40 eller top 50 grænse for domestik?
- [ ] Skal der være en scraper i Bodega Bets repo, eller hentes data fra CykelProAnalytics?
- [ ] Supabase-skema: sport-agnostisk eller separate tabeller for cykling?
