# Bodega Bets — Design System Reference

This document describes the design system **as it exists** in the codebase.
All values come from `globals.css`, `layout.tsx`, and the UI component library.
Use this as the single source of truth when building or modifying components.

---

## 1. Colors

### Tailwind theme colors (defined in `@theme` block in `globals.css`)

| Token              | Hex       | Tailwind class        | Usage                                |
| ------------------ | --------- | --------------------- | ------------------------------------ |
| `cream`            | `#F5F0E8` | `bg-cream`            | Page background, light surfaces      |
| `cream-dark`       | `#EDE8DF` | `bg-cream-dark`       | Card backgrounds, secondary surfaces |
| `forest`           | `#1B3A2D` | `bg-forest`           | Primary buttons, dark backgrounds    |
| `forest-light`     | `#2E5040` | `bg-forest-light`     | Dark borders, hover states on dark   |
| `vintage-red`      | `#C8392B` | `text-vintage-red`    | Danger, error states, closed badges  |
| `gold`             | `#C9A84C` | `text-gold`           | Accent, highlights, upcoming badges  |
| `warm-gray`        | `#5C5C4A` | `text-warm-gray`      | Secondary text, helper text          |
| `warm-border`      | `#D4CFC4` | `border-warm-border`  | Default border color                 |
| `ink`              | `#1A1A1A` | `text-ink`            | Primary text on light backgrounds    |

### CSS custom properties (`:root` in `globals.css`)

```
--bg-primary:      #F5F0E8
--bg-secondary:    #EDE8DF
--bg-dark:         #1B3A2D
--text-primary:    #1A1A1A
--text-secondary:  #5C5C4A
--text-inverted:   #F5F0E8
--accent-red:      #C8392B
--accent-green:    #1B3A2D
--accent-gold:     #C9A84C
--border:          #D4CFC4
--border-dark:     #2E5040
```

### Rules

- Always use Tailwind color classes (`bg-forest`, `text-gold`, etc.) or CSS variables.
- **Never** use inline hex values. If a color is not in the palette above, add it to `globals.css` first.

---

## 2. Typography

### Font families

| Role       | Family            | CSS variable       | Tailwind class    | Weights      | Usage                                    |
| ---------- | ----------------- | ------------------- | ----------------- | ------------ | ---------------------------------------- |
| Display    | Playfair Display  | `--ff-display`      | `font-display`    | 700, 900     | Section headings, hero titles            |
| Condensed  | Barlow Condensed  | `--ff-condensed`    | `font-condensed`  | 400, 600, 700 | Labels, badges, stats, uppercase text   |
| Body       | Barlow            | `--ff-body`         | `font-body`       | 400, 500, 600 | Paragraphs, form labels, general text   |
| Brand      | Lobster           | --                  | --                | 400          | Logo "B" only                            |
| Brand      | Pacifico          | --                  | --                | 400          | Logo "odega Bets" only                   |

### Helper classes (defined in `globals.css`)

| Class          | Definition                                                                 |
| -------------- | -------------------------------------------------------------------------- |
| `.label-caps`  | `font-condensed`, 600 weight, 11px, `tracking: 0.1em`, uppercase          |
| `.stat-number` | `font-condensed`, 700 weight, `font-variant-numeric: tabular-nums`        |

### Letter spacing tokens in use

| Tailwind class       | Value     | Usage                           |
| -------------------- | --------- | ------------------------------- |
| `tracking-[0.06em]`  | 0.06em    | Tighter condensed labels        |
| `tracking-[0.08em]`  | 0.08em    | Buttons, standard labels        |
| `tracking-[0.14em]`  | 0.14em    | Eyebrow / section labels        |
| `tracking-widest`    | 0.1em     | Badge text                      |

---

## 3. Spacing

### Approved spacing scale

Use **only** these spacing values for padding, margin, and gap:

| Token   | Value    | Tailwind classes           | Usage                                 |
| ------- | -------- | -------------------------- | ------------------------------------- |
| `2`     | 0.5rem   | `p-2`, `gap-2`, `m-2`     | Tight: icon padding, small gaps       |
| `3`     | 0.75rem  | `p-3`, `gap-3`, `m-3`     | Standard: card inner padding, gaps    |
| `4`     | 1rem     | `p-4`, `gap-4`, `m-4`     | Comfortable: section padding, gaps    |
| `5`     | 1.25rem  | `p-5`, `gap-5`            | Card body padding                     |
| `6`     | 1.5rem   | `p-6`, `gap-6`            | Large card padding (desktop)          |
| `8`     | 2rem     | `p-8`                     | Large card padding (desktop, lg size) |

### Component padding conventions

| Component         | Padding                   |
| ----------------- | ------------------------- |
| Button (sm)       | `px-4 py-2`               |
| Button (md)       | `px-6 py-3`               |
| Button (lg)       | `px-8 py-4`               |
| Input             | `px-4 py-3`               |
| Card (sm)         | `p-4`                     |
| Card (md/default) | `p-5 sm:p-6`              |
| Card (lg)         | `p-6 sm:p-8`              |
| Card header       | `px-5 py-4`               |
| Badge             | `px-2.5 py-0.5`           |

### Section spacing

| Context                  | Class                              |
| ------------------------ | ---------------------------------- |
| Page section vertical    | `py-12 lg:py-24`                   |
| Page section horizontal  | `px-6 lg:px-8`                     |
| Vertical stacking        | `space-y-3` or `space-y-6`         |
| Between form fields      | `space-y-3`                        |
| Between page sections    | `space-y-6`                        |

---

## 4. Border Radius

### Rules

| Element                        | Class           | Value    |
| ------------------------------ | --------------- | -------- |
| Cards, inputs, buttons, badges | `rounded-sm`    | 2px      |
| Pills, avatars, status dots    | `rounded-full`  | 9999px   |

**Do not use** `rounded-md`, `rounded-lg`, `rounded-xl`, or `rounded-2xl` on any element.
The design language is sharp/editorial with intentionally tight corners.

---

## 5. Layout & Containers

### Container widths

| Context              | Class         | Max width |
| -------------------- | ------------- | --------- |
| Standard content     | `max-w-5xl`   | 960px     |
| Hero / wide sections | `max-w-6xl`   | 1152px    |
| Narrow content       | `max-w-[640px]`| 640px    |
| Forms / auth         | `max-w-sm`    | 384px     |

All containers use `mx-auto` for centering.

### Breakpoints

| Prefix | Breakpoint | Usage                              |
| ------ | ---------- | ---------------------------------- |
| (none) | < 640px    | Mobile-first base styles           |
| `sm:`  | >= 640px   | Tablet adjustments                 |
| `lg:`  | >= 1024px  | Desktop layouts                    |

**Do not use** `md:`, `xl:`, or `2xl:` breakpoints. The design uses a two-breakpoint system only.

### Common grid patterns

```
grid grid-cols-1 lg:grid-cols-2                    /* Two-column responsive */
grid grid-cols-1 lg:grid-cols-[1fr_340px]          /* Content + sidebar */
grid grid-cols-2 lg:grid-cols-4                    /* Four-column grid */
```

---

## 6. Component Variants

### Button (`components/ui/Button.tsx`)

| Variant     | Background             | Text          | Border                 |
| ----------- | ---------------------- | ------------- | ---------------------- |
| `primary`   | `bg-forest`            | `text-cream`  | none                   |
| `secondary` | transparent            | `text-forest` | `border-forest`        |
| `danger`    | `bg-vintage-red`       | `text-cream`  | none                   |
| `ghost`     | transparent            | `text-forest` | none                   |

All buttons: `font-condensed font-semibold uppercase tracking-[0.08em]`
Hover: `opacity-85`
Disabled: `opacity-40 cursor-not-allowed`

### Badge (`components/ui/Badge.tsx`)

| Variant     | Background         | Text            |
| ----------- | ------------------ | --------------- |
| `upcoming`  | `bg-gold`          | `text-ink`      |
| `open`      | `bg-forest`        | `text-cream`    |
| `active`    | `bg-forest`        | `text-cream`    |
| `closed`    | `bg-vintage-red`   | `text-cream`    |
| `finished`  | `bg-warm-border`   | `text-warm-gray`|

All badges: `font-condensed font-600 text-[11px] uppercase tracking-widest px-2 py-0.5 rounded-sm`

### Input (`components/ui/Input.tsx`)

- Base: `bg-white border-[1.5px] border-warm-border text-ink rounded-sm px-4 py-3`
- Focus: `focus:border-forest`
- Error: `border-vintage-red`
- Label: `font-condensed font-600 text-xs uppercase tracking-[0.08em] mb-1.5`

### Card (`components/ui/Card.tsx`)

- Base: `bg-cream-dark border border-warm-border rounded-sm`
- Padding sizes: sm (`p-4`), md (`p-5 sm:p-6`), lg (`p-6 sm:p-8`)

---

## 7. Animations

### Defined keyframes (in `globals.css`)

| Name              | Duration | Easing                          | Usage                    |
| ----------------- | -------- | ------------------------------- | ------------------------ |
| `fadeSlideIn`     | 300ms    | ease                            | Toast entrance           |
| `slideInRight`    | 300ms    | ease                            | Panel entrance           |
| `fadeUp`          | 800ms    | `cubic-bezier(0.22,1,0.36,1)`  | Landing hero entrance    |
| `pulse-ring`      | 2.5s    | ease-in-out infinite            | CTA emphasis             |
| `rivalryFlicker`  | 1.5s    | ease-in-out infinite alternate  | Rivalry card fire effect |

### Transition defaults

- Standard: `transition-colors duration-300`
- Quick interactions: `transition-colors duration-200`
- Use `transition-all` sparingly.

---

## 8. Dark surfaces

When building on dark backgrounds (`bg-forest`, navbar, game ticker):

| Element          | Class / value                                |
| ---------------- | -------------------------------------------- |
| Background       | `bg-forest` or `#1A3329`                     |
| Text primary     | `text-cream`                                 |
| Text secondary   | `text-cream/70` (70% opacity)                |
| Border           | `border-forest-light` or `rgba(255,255,255,0.08)` |
| Card surface     | `bg-forest-light`                            |
