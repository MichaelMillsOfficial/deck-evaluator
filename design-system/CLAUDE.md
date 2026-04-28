# CLAUDE.md — Astral handoff

You are picking up Astral, a cosmic deck-reading app, and rebuilding it as a
production Next.js application. This file tells you what to build, what to
match, and what to ignore.

## Status — April 2026

The Astral journey shipped across 5 phases (PRs #105 → merged into master).
The four-stage `/ → /ritual → /reading → /reading/<sub>` flow is live and
covered by 408 e2e tests + 2473 unit tests. Mark these as done in the
"Build order" section below:

- ✅ Foundations — tokens.css imported via `globals.css`; Spectral / Inter / JetBrains
  Mono wired through `next/font/google`.
- ✅ Cosmos shell — `<CosmosBackground>` + top nav landed in
  `src/components/shell/`.
- ✅ Primitives — `<Button>`, `<Card>`, `<Eyebrow>`, `<StatTile>`, `<Sheet>`,
  `<Tag>` exposed via `src/components/ui/`.
- ✅ Domain components — `<ManaCost>`, `<ColorPie>`, `<CurveConstellation>`,
  `<CardRow>`, `<DeckHero>` exposed via `src/components/deck/`.
- ✅ Screens — every route below the table now exists, including the
  ritual loader (`/ritual`), the verdict hero on `/reading`, and the ten
  shell sub-routes under `/reading/(shell)/`.
- ✅ `prefers-reduced-motion` honored across CosmicLoader, ReadingOverview,
  DeckReadingShell, DeckSidebar, share page, and CosmosBackground.

### Deltas from the original plan

- The loader route is `/ritual`, not `/loading`, and is held by a
  `MIN_RITUAL_MS` floor (with a `window.__SKIP_RITUAL_FLOOR__` test
  escape hatch) until enrichment terminates.
- The `/reading` shell uses Next.js's `(shell)` route group so the URL
  stays flat (`/reading/cards`, not `/reading/(shell)/cards`).
- Four extra reading sub-routes were needed for parity with the existing
  analysis surface: `/reading/composition`, `/reading/synergy`,
  `/reading/interactions`, `/reading/hands`.
- Cross-route React state lives in providers mounted at the shell
  layout: `DeckSessionContext` (sessionStorage-backed) and
  `CandidatesContext` (in-memory, scoped to a single reading session).
- The original `--space-9, --space-11, --space-13…` half-steps are NOT
  defined in `tokens.css`. Using them silently drops the value. Treat
  the scale as `{0,1,2,3,4,5,6,7,8,10,12,14,16,20,24,32}` only.

## Source material

| Path | What it is | Use as |
|---|---|---|
| `Astral - Journey v2.html`     | The HTML prototype (live, interactive) | **Reference for behavior + flow** |
| `app/*.jsx`                    | Prototype React (Babel inline)         | Reference for component anatomy |
| `app/data.js`                  | Mock deck data                         | Sample fixtures for Storybook |
| `design-system/tokens.css`     | Canonical tokens                       | **Import into Next.js layout** |
| `design-system/tokens.json`    | Same tokens, JSON                      | Tailwind config / native export |
| `design-system/preview.html`   | Visual reference                       | Compare your build against this |
| `design-system/README.md`      | Component specs + patterns             | **Read this first** |

## Stack

- **Next.js 14+** with App Router
- **TypeScript** strict
- **Tailwind** (optional — CSS variables alone are sufficient; pick what fits)
- **No CSS-in-JS runtime** — variables + Tailwind, or CSS Modules
- **React 19** when stable, 18 otherwise

## Build order

1. **Foundations**
   - Drop `tokens.css` into `app/styles/tokens.css`, import in `app/layout.tsx`.
   - Set up Inter, Spectral, JetBrains Mono via `next/font/google`. Map to
     `--font-sans`, `--font-serif`, `--font-mono` (override what's in tokens.css).
   - Base body styles: bg `--bg-base`, color `--ink-primary`, font sans 13.

2. **Cosmos shell**
   - Build the fixed background (3 radial gradients + twinkling SVG stars).
   - Build the top nav (brand mark + tabs + right meta) — see `app/styles.css` lines 70–93.
   - Build the responsive viewport router (desktop ≥ 768, mobile < 768).

3. **Primitives** (`components/ui/`)
   - `<Button>` — variants per spec
   - `<Input>` / `<Textarea>`
   - `<Card>` / `<Panel>`
   - `<Tag>` / `<CardTag>` (tag with role-mapped color)
   - `<Eyebrow>` — convenience for the mono uppercase pattern
   - `<StatTile>` — mono label + big serif number
   - `<Sheet>` — bottom drawer (mobile primary, desktop modal fallback)

4. **Domain components** (`components/deck/`)
   - `<ManaCost>` — render ["2","U","G"] as colored pips. Use `--mana-*` tokens.
   - `<ColorPie>` — SVG donut for color distribution
   - `<CurveConstellation>` — mana-curve viz (planet-sized circles per CMC)
   - `<CardRow>` — list row · qty · name · cost · tag · price
   - `<DeckHero>` — hero verdict block (eyebrow + title + tagline + power dial)

5. **Screens** (`app/(routes)/`)
   - `/` → import (paste / URL tabs)
   - `/loading` → loader animation (~12s simulated)
   - `/reading` → overview (the deck verdict)
   - `/reading/cards` → full card list
   - `/reading/goldfish` → simulation results
   - `/reading/suggestions` → cut/add/swap recommendations
   - `/reading/add` → candidate finder
   - `/reading/compare` → A vs B
   - `/reading/share` → share card

   Mobile uses the same routes — responsive layouts collapse the desktop
   side-by-side panels into single-column with a bottom sheet pattern.

## Strict requirements

- **Use semantic tokens, never raw values.** `var(--accent)`, not `#a78bfa`.
  If you need a new value, add a raw scale step in `tokens.css` first, then
  expose a semantic alias.
- **No emoji as iconography.** The prototype uses Unicode glyphs (◯ ▤ ↳) as
  placeholders. Replace with a real icon set (Lucide is fine) at build time.
- **No new fonts.** Spectral / Inter / JetBrains Mono only.
- **The eyebrow pattern is sacred.** Every section starts with a mono
  uppercase 0.22em-tracked label in `--accent`. Don't skip it.
- **Honor `prefers-reduced-motion`** — already wired in `tokens.css`.
- **Mobile-first responsive** — design works at 375 wide. Don't ship anything
  that breaks below 360.

## Where the prototype takes shortcuts (you must fix)

- **Hard-coded mock data** in `app/data.js`. Replace with a fixture loader and
  a typed schema. Ultimately the deck source comes from a paste-parser or
  Moxfield/Archidekt API.
- **Placeholder card art** (diagonal stripe pattern). Wire to Scryfall image API
  or a CDN; cache aggressively.
- **No goldfish engine.** The simulation numbers are static. Build (or wire) the
  real Monte Carlo simulator — that's a separate workstream.
- **Tweaks panel** is a prototype-only artifact. Strip it from production.
- **Inline styles everywhere.** The prototype uses inline styles for speed of
  iteration. Move to Tailwind classes or CSS Modules in the production build.
- **No accessibility audit yet.** Ensure: focus rings on every interactive,
  ARIA labels on icon buttons, semantic landmark elements, color contrast ≥4.5.

## What "done" looks like

- `pnpm dev` boots, loads, every route navigates, every screen renders with
  real data shape.
- `pnpm test` passes — at minimum: token import smoke, primitive snapshot tests.
- Storybook (or `/preview` route) renders every primitive in every state.
- Lighthouse mobile ≥ 90 for Performance, Accessibility, Best Practices.
- `prefers-reduced-motion` actually disables the cosmos animation.
- Light theme stub'd but not active (`data-theme="light"` does nothing yet —
  that's expected; it's TODO).

## Out of scope for v1

- Light theme (placeholder only)
- Real auth / user accounts
- Server-side simulation engine
- Mobile native apps (web-responsive only)
- Compare flow (it's wireframed but the diff engine isn't real)

## Questions to ask before starting

- Is there an existing Astral codebase, or is this greenfield?
- Goldfish engine — wrap an existing tool, or build from scratch?
- Auth / persistence — Supabase, Clerk, or none yet?
- Does the team have a preferred icon set?
- Tailwind or vanilla CSS?

If unsure, default to: **greenfield · Lucide icons · Tailwind + CSS vars · no auth v1**.
