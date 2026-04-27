# Astral · Design System

> Cosmic deck-reading app. Dark, editorial, mono-eyebrows, gradient accents.

This package defines the visual language for Astral. It is **definition only** —
adopting it requires wiring `tokens.css` into your app and replacing hard-coded
values with semantic tokens.

## What's in here

| File | Purpose |
|---|---|
| `tokens.css`     | Source of truth · CSS variables (raw scale + semantic aliases) |
| `tokens.json`    | DTCG-style · for Tailwind / Style Dictionary / native |
| `preview.html`   | Visual reference · every token + every component, all states |
| `components/`    | JSX reference implementations (Button, Card, Tag, Input, Sheet, StatTile) |
| `CLAUDE.md`      | Handoff brief — read this if you're Claude Code |

## Foundations

### Color
Two layers:
- **Raw scale** — `--violet-400`, `--ink-200`, `--space-8`. Pure values.
- **Semantic** — `--accent`, `--ink-primary`, `--surface-1`. What components use.

Always reference **semantic tokens** in components. Raw scales exist so a future
brand variant or light theme can remap without touching component code.

Brand spine: **violet 400 → aura 400** as a 135° gradient. Used only on primary
CTAs, hero score numbers, and one-off accent moments. Don't gradient-bomb the UI.

Status: `--status-ok` (green), `--status-watch` (amber), `--status-warn` (rose).
Each has a soft fill (`-soft` suffix) at 10% opacity for filled badges.

### Type
- **Spectral** (serif) — display, page titles, hero numbers, italic pull-quotes
- **Inter** (sans) — body, UI, buttons
- **JetBrains Mono** — eyebrows, stat labels, prices, codes

The eyebrow pattern: `font-mono · 10px · uppercase · 0.22em tracked · accent color`. It
appears above almost every section. Don't skip it.

### Space
8-step soft scale — 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 64.
Padding inside cards: 24. Sheet padding: 18 (mobile) / 24 (desktop).

### Radius
- 6/8 — buttons, inputs
- 12/14 — cards, panels
- 18 — sheets, hero cards
- 999 — chips, tags, pills

### Motion
- Default ease: `--ease-out` (`cubic-bezier(0.2, 0.8, 0.2, 1)`)
- Default duration: `--dur-base` (180ms)
- Reveal entrance: `--dur-reveal` (600ms) on first paint, then never again
- Bottom sheets: 280ms, ease-out
- Honors `prefers-reduced-motion`

## Components

Each component below is specified as: **anatomy → states → reference impl** in
`components/`. The reference is JSX with inline styles using semantic tokens.

### Button
**Variants:** `primary` · `secondary` · `ghost` · `icon`
**States:** default, hover, focus-visible, active, disabled
**Sizes:** sm (32h), md (40h), lg (48h)

- Primary: gradient bg, `--ink-on-accent` text, glow on hover (`--glow-md`)
- Secondary: `--surface-2` bg, `--border` outline, ink-primary
- Ghost: transparent, accent text, no chrome
- Icon: 32×32 square, secondary chrome, accent on hover

### Input (text + textarea)
**States:** default, focus, filled, error, disabled
- Bg `--input-bg` (rgba black 0.40), 1px `--input-border`, radius `--input-radius`
- Mono font for code-like content (deck lists, URLs)

### Card / Panel
**Variants:** `surface-1` (default) · `accent-soft` (highlighted) · `outline`
**Anatomy:** optional eyebrow → optional title → content → optional footer
**Padding:** 24 desktop / 18 mobile
**Border:** 1px `--border` (or `--border-accent` for `accent-soft`)
**Backdrop:** `blur(8px)` if floating over cosmos bg

### Tag / Chip
**Variants:** by status — `accent` · `cyan` · `gold` · `ok` · `warn` · `ghost`
- Mono · 10px · 0.10em tracked · uppercase
- Pill radius
- Soft bg + 40% border in same hue

Special: `<CardTag>` for deck roles (RAMP/DRAW/REMOVAL/WINCON/ENGINE/COMMANDER) —
maps role to color via fixed lookup.

### Sheet (bottom drawer, mobile)
**Anatomy:** scrim → grabber → header (icon + title + close) → content → actions
- Scrim `--surface-scrim`, blur 8px, fade 180ms
- Sheet slides up 280ms `--ease-out`
- Top corners `--sheet-radius` (18), bottom flush
- Max-height 80vh, content scrolls

### StatTile
A repeated unit across overview / goldfish / share screens.
**Anatomy:** mono label (eyebrow style) → big serif number → optional sub
**Size:** number is `--text-h2` (28) or larger; label is `--text-caption` (9)
**Bg:** `--surface-2` with `--border` outline, radius `--radius-xl`

## Patterns (composition)

These aren't components — they're recipes the app uses repeatedly.

- **Eyebrow + serif title + italic tagline** — top of every screen.
  ```
  <Eyebrow>READING · 04.27.26</Eyebrow>
  <h1 className="serif">Slogurk, the Overslime</h1>
  <p className="serif italic">"A landfall engine that wins decisively."</p>
  ```

- **Cosmos background** — one fixed layer, `position: fixed; inset: 0; z-index: 0`,
  with three radial gradients (violet TL, aura BR, cyan center) and twinkling stars.
  Sits behind everything. Don't repeat per-screen.

- **Reveal-on-mount** — all top-level sections fade in + 8px translate over 600ms,
  staggered 60–80ms. Done once per route, not on re-renders.

## Next.js usage

```tsx
// app/layout.tsx
import "@/design-system/tokens.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// component example — semantic tokens only
<button
  style={{
    background: "var(--accent-gradient)",
    color: "var(--ink-on-accent)",
    padding: "var(--space-5) var(--space-10)",
    borderRadius: "var(--btn-radius)",
    fontWeight: "var(--weight-semibold)",
  }}
>
  Read this deck
</button>
```

### With Tailwind
Wire the JSON into `tailwind.config.ts` via Style Dictionary or import directly:

```ts
import tokens from "./design-system/tokens.json";

export default {
  theme: {
    extend: {
      colors: {
        accent: "var(--accent)",
        ink: { 1: "var(--ink-primary)", 2: "var(--ink-secondary)" },
      },
      fontFamily: {
        serif: tokens.typography.font.serif.value.split(", "),
        sans:  tokens.typography.font.sans.value.split(", "),
        mono:  tokens.typography.font.mono.value.split(", "),
      },
    },
  },
};
```

## Don'ts
- **No new colors.** If you need one, add a raw scale step first, then map it.
- **No drop-shadow on the cosmos bg.** Use `--glow-*` for accent moments only.
- **No emoji as iconography.** Glyphs only (◯ ▤ ↳ ✦ +) or proper SVG icons.
- **No more than 2 gradient elements per screen.** Reserve for hero score + 1 CTA.
- **Don't skip the eyebrow.** Every section needs one — that's the rhythm.

## Roadmap
- [ ] Light theme (stub'd in `tokens.css` — needs surface remap + shadow rework)
- [ ] Icon set (currently glyphs as placeholder)
- [ ] Real Mana SVG (currently CSS pip approximation)
- [ ] Motion library (currently inline `@keyframes`)
- [ ] Native iOS / Android token export via Style Dictionary
