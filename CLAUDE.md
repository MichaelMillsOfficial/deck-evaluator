# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Magic: The Gathering Deck Evaluator -- a Next.js (TypeScript) web app for importing and analyzing MTG decklists. The UI follows the **Astral** design system (cosmic dark theme, Spectral serif headings, JetBrains Mono eyebrows, gradient accent), and routes the user through a four-stage journey: **import → ritual → reading → sub-route**.

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Start development server
npm run build      # Production build
npm run start      # Run production server
npm run lint       # Run ESLint
npm test             # Run all tests (e2e + unit)
npm run test:e2e     # Run only browser/API e2e tests
npm run test:unit    # Run only pure function unit tests (fast, no dev server)
npm run test:headed  # Run e2e tests with visible browser
npm run test:ui      # Open Playwright interactive e2e UI
```

### Docker

The app is containerized with a multi-stage Dockerfile (`node:20-alpine`, standalone output). Use docker-compose for local or production runs:

```bash
docker compose up              # Build & start (foreground, logs visible)
docker compose up -d           # Build & start (detached/background)
docker compose up --build      # Force rebuild after code changes
docker compose down            # Stop and remove containers
docker compose logs -f         # Tail logs from running container
```

The app is served on port **3000** (`http://localhost:3000`).

## Architecture

```
src/
├── app/
│   ├── globals.css                # Astral tokens import + base body styles
│   ├── layout.tsx                 # Root layout: cosmos background, top nav, providers
│   ├── page.tsx                   # Home: import hero + DeckImportSection
│   ├── ritual/page.tsx            # Cosmic loader (held until enrichment terminates)
│   ├── reading/
│   │   ├── layout.tsx             # Redirect gate (no session → /)
│   │   ├── page.tsx               # /reading verdict landing (ReadingHero + tile grid)
│   │   └── (shell)/               # Route group: persistent sidebar + drawer
│   │       ├── layout.tsx         # DeckReadingShell + CandidatesProvider
│   │       ├── cards/page.tsx
│   │       ├── composition/page.tsx
│   │       ├── synergy/page.tsx
│   │       ├── interactions/page.tsx
│   │       ├── hands/page.tsx
│   │       ├── goldfish/page.tsx
│   │       ├── suggestions/page.tsx
│   │       ├── add/page.tsx
│   │       ├── compare/page.tsx
│   │       └── share/page.tsx
│   ├── shared/page.tsx            # Decode share URL → setPayload → push /reading
│   ├── crucible/
│   │   ├── layout.tsx             # Mounts CrucibleSessionProvider
│   │   └── page.tsx               # The Crucible: pile import → triage workbench
│   ├── compare/page.tsx           # Standalone two-deck comparison
│   ├── preview/page.tsx           # Design-system component preview
│   └── api/
│       ├── deck/                  # GET — Archidekt URL fetch
│       ├── deck-parse/            # POST — text decklist parser
│       ├── deck-enrich/           # POST — Scryfall enrichment
│       ├── deck-combos/           # POST — Commander Spellbook lookup
│       ├── card-autocomplete/
│       ├── card-suggestions/
│       ├── commander-rules/
│       └── export-image/
├── components/
│   ├── reading/                   # New journey chrome
│   │   ├── DeckReadingShell.tsx   # Persistent sidebar + drawer wrapper
│   │   ├── ReadingOverview.tsx    # /reading verdict landing
│   │   ├── ReadingHero.tsx        # Hero block (eyebrow + title + tagline + tiles)
│   │   └── SectionHeader.tsx      # Per-route eyebrow + serif h1 + italic tagline
│   ├── ritual/CosmicLoader.tsx    # Pulsing orb + incantation phrases
│   ├── crucible/                  # Workbench, lens switcher, triage rows, tracker rail, insight panels
│   ├── shell/                     # Top nav + cosmos background
│   ├── DeckSidebar.tsx            # Route-aware nav (usePathname → activeTab)
│   ├── DeckMobileTopBar.tsx
│   ├── DeckInput.tsx              # 3-tab import form
│   ├── DeckImportSection.tsx
│   ├── DeckList.tsx
│   ├── EnrichedCardRow.tsx
│   ├── ManaCost.tsx · ManaSymbol.tsx · OracleText.tsx · CardTags.tsx
│   └── ...                        # Analysis components (Synergy, Goldfish, etc.)
├── contexts/
│   ├── DeckSessionContext.tsx     # sessionStorage-backed deck + enrichment state
│   ├── CrucibleSessionContext.tsx # /crucible pile triage state (own sessionStorage key)
│   └── CandidatesContext.tsx      # /reading/add candidate state (shell-scoped)
└── lib/
    ├── types.ts                   # DeckData, DeckCard, EnrichedCard
    ├── deck-session.ts            # sessionStorage codec + payload schema
    ├── deck-codec.ts              # v1/v2 share-URL gzip+base64 encoder/decoder
    ├── deck-tagline.ts            # Heuristic deck → italic tagline
    ├── view-tabs.ts               # ViewTab union, TAB_ROUTES, tabFromPathname
    ├── archidekt.ts · moxfield.ts · scryfall.ts
    ├── decklist-parser.ts · mana.ts · oracle.ts · card-tags.ts
    ├── crucible-session.ts · crucible-grouping.ts · cut-suggestions.ts
    └── ...                        # Synergy, combos, simulation, export
```

### Data Flow (the journey)

1. **Import** (`/`): User pastes / fetches a decklist via `DeckImportSection`.
   On submit, the form calls `setPayload(payload)` on the deck session
   context (which persists to sessionStorage) and navigates to `/ritual`.
2. **Ritual** (`/ritual`): `CosmicLoader` plays. The page watches
   `DeckSessionContext` for `cardMap !== null || enrichError !== null` and
   for the `MIN_RITUAL_MS` floor to elapse, then forwards to `/reading`.
   Test escape hatch: `window.__SKIP_RITUAL_FLOOR__ = true`.
3. **Reading** (`/reading`): `ReadingOverview` renders the verdict hero +
   tile grid. The shell layout (`/reading/(shell)/layout.tsx`) wraps
   every sub-route in `DeckReadingShell` + `CandidatesProvider`, giving
   persistent sidebar nav and shared candidate state.
4. **Sub-routes** (`/reading/<slug>`): Each page reads `payload` from
   `useDeckSession()` and renders its analysis component inside a
   `<SectionHeader>` + `tabpanel` wrapper. Soft `<Link>` navigation
   keeps the shell mounted across switches.

**Alternate entry - The Crucible** (`/crucible`): a deck-building workbench
that accepts an arbitrary pile of cards (no deck structure), enriches it in
chunks behind the `CosmicLoader` treatment, and guides keep/cut/undecided
triage across lenses down to a legal 100-card EDH deck. State lives in
`CrucibleSessionContext` (its own sessionStorage key, coexisting with the
reading session). "Seal the Deck" builds a normal `DeckData` (kept cards as
mainboard, cuts as sideboard so `/reading/add` still sees them), calls
`setPayload`, and hands off to the untouched `/ritual` → `/reading` journey.
Design details: `docs/plans/crucible-deck-builder.md`.

### API endpoints

- `GET  /api/deck` — Archidekt URL → `DeckData`
- `POST /api/deck-parse` — raw text → `DeckData`
- `POST /api/deck-enrich` — card names → `EnrichedCard` map (Scryfall)
- `POST /api/deck-combos` — card names → Commander Spellbook combos
- `GET  /api/card-autocomplete` — typeahead for `/reading/add`
- `GET  /api/card-suggestions` — themed candidate suggestions

### Key Types

- `DeckCard` -- `{ name: string; quantity: number }`
- `DeckData` -- `{ name, source, url, commanders[], mainboard[], sideboard[] }`
- `EnrichedCard` -- Full card data from Scryfall (mana cost, oracle text, type line, keywords, power/toughness, etc.)
- `DeckSessionPayload` -- `{ id, deck, cardMap?, parseWarnings, notFoundCount, ... }`
- `ViewTab` -- union of 10 sub-route keys; `TAB_ROUTES[tab]` → `/reading/<slug>`
- Source can be `"moxfield" | "archidekt" | "text"`

### Design System (Astral)

Tokens live in `design-system/tokens.css` and are imported via `globals.css`.
**Always use semantic tokens, never raw values.**

- **Background** — `var(--bg-base)` cosmic dark, layered with `<CosmosBackground>`
- **Accent** — `var(--accent)` and `var(--accent-gradient)` for primary actions
- **Surfaces** — `var(--card-bg)` + `var(--border)` panels with `var(--blur-sm)`
- **Type** — `--font-serif` (Spectral) for headings, `--font-sans` (Inter) for body, `--font-mono` (JetBrains) for eyebrows
- **Eyebrow pattern (sacred)** — every section opens with mono uppercase
  `var(--text-eyebrow)` size + `var(--tracking-eyebrow)` letter-spacing in
  `var(--accent)`. Use `<SectionHeader>` to enforce.
- **Spacing scale** — `--space-{0,1,2,3,4,5,6,7,8,10,12,14,16,20,24,32}` only.
  **9, 11, 13, 15… are NOT defined** — using them silently drops the value.
- **Reduced motion** — every animated component must gate with
  `@media (prefers-reduced-motion: reduce) { transition: none; transform: none }`.
  When the preference is needed in JS (e.g. chart animations), use the shared
  `usePrefersReducedMotion()` hook from `src/hooks/usePrefersReducedMotion.ts`
  instead of rolling a per-component `matchMedia` listener.
- MTG symbols: Scryfall CDN SVGs (`https://svgs.scryfall.io/card-symbols/{SYMBOL}.svg`)

### Reuse design-system components — do NOT recreate them

When adding or modifying any UI, **first check `src/components/ui/` and the
existing `src/components/reading/` chrome for a component that already covers
the need.** Reuse it. Do not invent a new component, do not inline raw Tailwind
that duplicates an existing primitive, and do not write bespoke CSS for
something the system already ships.

Inventory of primitives that must be reused (current as of this writing — run
`ls src/components/ui/` to confirm latest):

| Need | Use |
|---|---|
| Panel / surface / bordered container | `<Card>` from `src/components/ui/Card.tsx` — never raw `rounded-xl border bg-slate-800/50` |
| Modal / drawer / focus-trapped overlay | `<Sheet>` from `src/components/ui/Sheet.tsx` — never a hand-rolled `<dialog>` |
| Anchored, non-modal dropdown / filterable list popover | `<Popover>` from `src/components/ui/Popover.tsx` — never a hand-rolled absolutely-positioned dropdown |
| Mono uppercase label / kicker | `<Eyebrow>` from `src/components/ui/Eyebrow.tsx` |
| Pill / chip / category label | `<Tag>` from `src/components/ui/Tag.tsx` (or `<CardTag>` for card-tag-specific styling) |
| Button (primary / secondary / ghost) | `<Button>` from `src/components/ui/Button.tsx` |
| Text input | `<Input>` from `src/components/ui/Input.tsx` |
| Multi-line text input | `<Textarea>` from `src/components/ui/Textarea.tsx` |
| Stat tile (label + value pair) | `<StatTile>` from `src/components/ui/StatTile.tsx` |
| Card autocomplete search | `<CardSearchInput>` from `src/components/CardSearchInput.tsx` |
| Section opener (eyebrow + title + tagline) | `<SectionHeader>` from `src/components/reading/SectionHeader.tsx` |

If the existing component is missing a feature (e.g. a new variant or a prop),
**extend the existing component** — add the variant, add the prop, update its
module.css with new tokens. Do not fork it. The Astral system depends on a
single source of truth per primitive.

If you genuinely need a new primitive (something the system has never had):
1. Justify it in your plan / PR description — what existing component did you
   consider, and why is it not extendable?
2. Place it in `src/components/ui/` next to its peers, with an accompanying
   `.module.css` using only semantic tokens.
3. Export it from `src/components/ui/index.ts` so future authors find it.

**Lint check before opening a PR:** grep your new code for `rgba(`, `#[0-9a-f]`,
inlined `<dialog>`, raw `<button class="bg-…">`, or hardcoded color
hex/rgb/hsl values. Each is a smell that you bypassed the system.

### Component Patterns

- **SectionHeader**: every `/reading/*` sub-route opens with
  `<SectionHeader slug="…" eyebrow="…" title="…" tagline="…" />`.
- **DeckSidebar**: route-aware via `usePathname()` + `tabFromPathname()`.
  Active tab is derived from URL, not held in component state.
- **DeckSessionContext**: hydrates from sessionStorage on mount with a
  `pending` → `hydrated` / `absent` lifecycle. `/reading/layout.tsx`
  redirects to `/` when status is `absent`.
- **CandidatesProvider**: lifted to the shell layout so candidate state
  on `/reading/add` survives navigation to other tabs.
- **ManaSymbol**: `<img>` tags with explicit `width`/`height`,
  `aria-hidden="true"`, `shrink-0 inline-block align-text-bottom`. The
  parent carries the accessible label.
- **ManaCost**: container `<span>` carries `aria-label` with the
  human-readable cost description; individual symbols are `aria-hidden`.
- **EnrichedCardRow**: expandable disclosure with `aria-expanded`,
  `aria-controls`, and Escape support. Chevron rotation respects
  `motion-reduce:transition-none`.

## Testing

This project uses **Playwright** for end-to-end testing. Tests live in the `e2e/` directory and run against the Next.js dev server (started automatically via the `webServer` config in `playwright.config.ts`).

### Running Tests

```bash
npm test                           # Run all tests (e2e + unit)
npm run test:e2e                   # Run only browser/API e2e tests
npm run test:unit                  # Run only pure function unit tests (fast)
npm run test:headed                # Run e2e with a visible browser
npm run test:ui                    # Interactive Playwright e2e UI
npx playwright test --config playwright.config.ts e2e/deck-import.spec.ts  # Single e2e file
npx playwright test --config playwright.unit.config.ts tests/unit/mana-parsers.spec.ts  # Single unit file
```

### Test Structure

```
e2e/                                # Browser & API tests (require dev server)
├── fixtures.ts                     # DeckPage page-object, sample decklists, custom test export
├── deck-import.spec.ts             # Manual decklist import user flows
├── tab-navigation.spec.ts          # Tab switching, Load Example, form state persistence
├── deck-display.spec.ts            # Rendered deck sections, card counts, source label
├── api-deck-parse.spec.ts          # POST /api/deck-parse API contract tests
├── api-deck-enrich.spec.ts         # POST /api/deck-enrich API contract tests
├── deck-enrichment.spec.ts         # Enriched card UI: symbols, chevrons, expand/collapse
└── ...
tests/unit/                         # Pure function tests (no browser, no dev server)
├── mana-parsers.spec.ts            # Mana cost & type line parsing
├── oracle-parser.spec.ts           # Oracle text tokenizer
├── card-tags.spec.ts               # Heuristic card tag generation
├── mana-curve.spec.ts              # Mana curve computation
├── color-distribution.spec.ts      # Color distribution & mana base metrics
├── known-combos.spec.ts            # Known combo registry & detection
├── synergy-axes.spec.ts            # Synergy axis detectors
├── synergy-engine.spec.ts          # Synergy engine scoring
├── crucible-session.spec.ts        # Pile session model, statuses, final-deck builder
├── crucible-grouping.spec.ts       # Lens grouping functions
├── cut-suggestions.spec.ts         # Ranked cut recommender
└── ...
```

### Writing Tests

- **Import `test` and `expect` from `./fixtures`** (not from `@playwright/test` directly) to get the `deckPage` fixture automatically.
- **Use `deckPage` methods** (`goto()`, `fillDecklist()`, `submitImport()`, `waitForDeckDisplay()`) to express tests as user intent.
- **Use `deckPage.deckDisplay`** to scope assertions to the rendered deck panel and avoid strict-mode violations with the textarea.
- **Add new page-object methods to `DeckPage`** in `fixtures.ts` when new UI elements are introduced.
- **API tests** can use Playwright's `request` fixture directly with `@playwright/test` imports.
- **Pure utility tests** live in `tests/unit/` and import functions directly from `src/lib/`. They run under `playwright.unit.config.ts` (no browser, no dev server) and do not need the `deckPage` fixture.
- Focus on **functional behavior**, not styling or visual assertions.

### TDD Workflow

**All new features must follow test-driven development:**

1. **Write failing tests first** -- before implementing any feature, add tests in `e2e/` that describe the expected behavior. Run `npm test` to confirm they fail.
2. **Implement the feature** -- write the minimum code to make the tests pass.
3. **Refactor** -- clean up while keeping tests green.
4. **All tests must pass before committing** -- run `npm test` and verify 0 failures before every commit.

When working on a feature, the test file should be created or updated _before_ the implementation code. This ensures the test suite always describes the intended behavior and catches regressions.

## Skills (Slash Commands)

Skills live in `.claude/commands/` and are invoked with `/skill-name`. They fall into two categories:

### Code-Pattern Skills

These enforce consistent patterns when adding new code to the codebase:

| Skill | Purpose | Invoked As |
|-------|---------|------------|
| `add-api-route` | Scaffold a new Next.js API route with validation patterns | `/add-api-route` |
| `add-component` | Create a React component following dark theme + a11y patterns | `/add-component` |
| `add-lib-module` | Create a pure TypeScript module in `src/lib/` | `/add-lib-module` |
| `add-e2e-test` | Create or extend a Playwright e2e test | `/add-e2e-test` |
| `add-card-tag` | Add a new heuristic card tag to `card-tags.ts` | `/add-card-tag` |
| `add-synergy-axis` | Add a new synergy detection axis to `synergy-axes.ts` | `/add-synergy-axis` |
| `add-known-combo` | Add a new combo to the known combo registry | `/add-known-combo` |
| `write-plan` | Create an implementation plan in `docs/plans/` | `/write-plan` |
| `run-tests` | Run tests and report results with diagnostics | `/run-tests` |

### MTG Domain Knowledge Skills

These provide Magic: The Gathering expertise for card analysis and deck evaluation:

| Skill | Purpose | Invoked As |
|-------|---------|------------|
| `mtg-card-expert` | Card lookup via Scryfall, oracle text interpretation, play pattern analysis, card interaction reasoning | `/mtg-card-expert` |
| `evaluate-detection` | Audit tag/synergy regex accuracy against real cards, find false positives/negatives | `/evaluate-detection` |
| `review-deck-analysis` | Holistic deck evaluation tying together all analysis modules | `/review-deck-analysis` |
| `l3-judge` | L3 Judge-level rules review for type system, mechanics modeling, and interaction accuracy | `/l3-judge` |

### When to Use Which Skill

- Adding a new feature? Start with `/write-plan`, then use the appropriate `add-*` skill for each piece
- Need to understand a card's mechanics? Use `/mtg-card-expert`
- Suspect tags or synergy detection is wrong for certain cards? Use `/evaluate-detection`
- Need to validate rules accuracy of type definitions or game mechanics? Use `/l3-judge`
- Want to validate that the analysis pipeline produces sensible results for a deck? Use `/review-deck-analysis`
- Adding a new combo to the registry? Use `/add-known-combo`

## Plans

All implementation plans live in `docs/plans/` as Markdown files. When generating a plan:

- Place the file in `docs/plans/<descriptive-name>.md`
- Include a **Context** section explaining the problem and intended outcome
- Include an **Implementation Tasks** section with checkboxes (`- [ ]`) for each discrete task
- Tasks should be specific enough for another agent to execute independently
- Include a **Files to Create/Modify** table listing all affected files
- Include a **Verification** section or task describing how to test the changes end-to-end
- Mark tasks as completed (`- [x]`) as they are finished
- Commit the plan file before beginning implementation
