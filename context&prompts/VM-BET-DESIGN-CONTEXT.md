# VM Bet — Design Context

## Æstetisk retning
**Heritage Sports Badge** — americana/vintage sports møder moderne webapp.
Tænk gamle fodboldklubber, håndtegnede badges, sporty typografi med karakter.
Referencer: The Athletic, Brooklyn Bows & Arrows badge, Vaquero Caffe logo.

Nøgleord: **Karakterfuld. Overskuelig. Seriøs. Lidt rå. Ikke casino.**

---

## Farvepalette

```css
:root {
  /* Baggrunde */
  --bg-primary: #F5F0E8;       /* Creme — primær baggrund */
  --bg-secondary: #EDE8DF;     /* Lidt mørkere creme — kort/flader */
  --bg-dark: #1B3A2D;          /* Dyb skovgrøn — hero, navbar, accenter */

  /* Tekst */
  --text-primary: #1A1A1A;     /* Næsten sort */
  --text-secondary: #5C5C4A;   /* Varm grå */
  --text-inverted: #F5F0E8;    /* Creme på mørk baggrund */

  /* Accent */
  --accent-red: #C8392B;       /* Vintage rød — vigtige actions, badges */
  --accent-green: #1B3A2D;     /* Dyb grøn — primær knap */
  --accent-gold: #C9A84C;      /* Guld — leaderboard, trofæer, 1. plads */

  /* Borders */
  --border: #D4CFC4;           /* Varm grå border */
  --border-dark: #2E5040;      /* Mørkegrøn border på mørk baggrund */
}
```

---

## Typografi

```css
/* Installer via Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Barlow+Condensed:wght@400;600;700&family=Barlow:wght@400;500;600&display=swap');

/* Display / Headings — karakterfuld serif */
--font-display: 'Playfair Display', serif;
/* Bruges til: sidetitler, leaderboard tal, store tal, kamptitler */

/* Kondenseret / Labels — sporty */
--font-condensed: 'Barlow Condensed', sans-serif;
/* Bruges til: holdnavne, rundebetegnelser, badges, tal i tabeller */

/* Body — læsbar og ren */
--font-body: 'Barlow', sans-serif;
/* Bruges til: beskrivelser, brødtekst, input labels */
```

### Typografi regler
- **Store tal** (point, odds) bruger `font-condensed` med `font-weight: 700` — sporty og markant
- **Sidetitler** bruger `font-display` — giver karakter
- **Holdnavne og labels** bruger `font-condensed` — kompakt og sporty
- **Al brødtekst** bruger `font-body`
- Letter-spacing på labels og badges: `letter-spacing: 0.08em; text-transform: uppercase;`

---

## Spacing & Layout

```css
/* Skarpe kanter — ingen runde hjørner undtagen badges */
--radius-none: 0px;
--radius-sm: 2px;      /* Meget lille afrunding på knapper */
--radius-badge: 4px;   /* Badges og tags */

/* Spacing skala */
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 40px;
--space-2xl: 64px;
```

---

## Komponenter

### Kort / Cards
```
Baggrund: var(--bg-secondary)
Border: 1px solid var(--border)
Border-radius: var(--radius-sm)
Padding: 20px 24px
Ingen box-shadow — brug border i stedet
```

### Primær knap
```
Baggrund: var(--accent-green)
Tekst: var(--text-inverted), font-condensed, uppercase, letter-spacing
Border: none
Border-radius: var(--radius-sm)
Padding: 12px 24px
Hover: opacity 0.85
```

### Sekundær knap / outline
```
Baggrund: transparent
Border: 1.5px solid var(--text-primary)
Tekst: var(--text-primary), font-condensed, uppercase
Hover: baggrund var(--text-primary), tekst var(--text-inverted)
```

### Danger knap
```
Baggrund: var(--accent-red)
Tekst: var(--text-inverted)
```

### Navbar
```
Baggrund: var(--bg-dark)
Tekst: var(--text-inverted)
Logo: font-display eller custom badge SVG
Border-bottom: 2px solid var(--border-dark)
```

### Leaderboard række
```
Layout: grid med kolonner — placering / navn / point
Highlight (nuværende bruger): baggrund var(--bg-dark), tekst var(--text-inverted)
1. plads: accent-gold farve på placering
Dividers: 1px solid var(--border) mellem rækker
Font: font-condensed til tal, font-body til navne
```

### Badge / Status tags
```
Uppercase, font-condensed, letter-spacing: 0.1em
Open: grøn baggrund + hvid tekst
Closed: rød baggrund + hvid tekst
Upcoming: guld baggrund + mørk tekst
Finished: grå baggrund + grå tekst
Border-radius: var(--radius-badge)
Padding: 2px 8px
Font-size: 11px
```

### Input felter
```
Baggrund: white
Border: 1.5px solid var(--border)
Border-radius: var(--radius-sm)
Padding: 10px 14px
Font: font-body
Focus: border-color var(--accent-green)
```

### 1-X-2 vælger
```
Tre knapper side om side, fyldt bredde
Ikke valgt: outline stil (border + transparent baggrund)
Valgt: var(--accent-green) baggrund + hvid tekst
Font: font-condensed, stor, bold
Odds vist som lille tekst under tallet
```

---

## Logo / Brand

Logoet skal være et **badge** — oval eller skjold form.
Indeholder:
- Platformens navn (når valgt)
- Et fodbold-relateret ikon eller monogram
- Evt. "EST. 2026" som detalje

Stil: håndtegnet/vintage, ligner de vedhæftede referencer.
Farver: --bg-dark (grøn) og --text-inverted (creme) eller --accent-red og creme.

Til navbar: brug en tekst-baseret logo løsning med Playfair Display indtil badge SVG er klar.

---

## Side-specifikke noter

### Forside (/)
- Hero med mørk grøn baggrund (--bg-dark) og creme tekst
- Globalt leaderboard under hero på creme baggrund
- Platformen skal føles eksklusiv og seriøs

### Dashboard (/dashboard)
- Spilkort med tydelig lokal point-visning
- Invitationskode synlig som et badge/stempel

### Spilrum (/games/[id])
- Leaderboard dominerer siden
- Runder listet nedenunder med klar status

### Bet-side (/games/[id]/rounds/[roundId])
- Kompakt kampkort per kamp
- 1-X-2 vælger stor og tydelig
- Side-bets foldet ind under kampen

### Admin (/admin)
- Mørkere, mere utility-præget
- Samme farver men mere tabel-baseret layout
- Funktionalitet over æstetik her

---

## Tailwind config

Tilføj dette til tailwind.config.ts:

```js
theme: {
  extend: {
    colors: {
      cream: '#F5F0E8',
      'cream-dark': '#EDE8DF',
      forest: '#1B3A2D',
      'forest-border': '#2E5040',
      'vintage-red': '#C8392B',
      gold: '#C9A84C',
      'text-warm': '#5C5C4A',
      border: '#D4CFC4',
    },
    fontFamily: {
      display: ['Playfair Display', 'serif'],
      condensed: ['Barlow Condensed', 'sans-serif'],
      body: ['Barlow', 'sans-serif'],
    },
    borderRadius: {
      DEFAULT: '2px',
      badge: '4px',
      none: '0px',
    },
  }
}
```

---

## Design Prompt til Cursor

```
Inden vi bygger siderne, opsæt det globale design system baseret på DESIGN-CONTEXT.md.

1. Installer Google Fonts i /app/layout.tsx:
   - Playfair Display (700, 900)
   - Barlow Condensed (400, 600, 700)
   - Barlow (400, 500, 600)
   - Anvend som CSS variabler via next/font/google

2. Opdater tailwind.config.ts med farver og fonte fra DESIGN-CONTEXT.md

3. Opdater /app/globals.css med:
   - CSS custom properties (alle farver og fonte)
   - Body: baggrund cream (#F5F0E8), font Barlow, tekst #1A1A1A
   - Basis typografi styles

4. Byg /components/ui/ med disse genbrugelige komponenter:
   - Button.tsx (primary, secondary, danger varianter)
   - Card.tsx (standard kort med border)
   - Badge.tsx (status tags: open, closed, upcoming, finished)
   - Input.tsx (standard inputfelt)
   - Navbar.tsx (mørk grøn, platformsnavn i Playfair Display, bruger-info)

Alle komponenter skal følge designsystemet præcist.
Ingen tailwind defaults som rounded-lg, shadow-md osv. — hold det skarpt og konsistent.
```
