# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Magic: The Gathering Deck Evaluator -- a Next.js (TypeScript) web app for importing, parsing, and analyzing MTG decklists. Features a dark-themed UI with purple accents, 3-tab deck import (Manual / Moxfield / Archidekt), Scryfall card enrichment, heuristic card tagging, and official MTG symbol rendering.

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Start development server
npm run build      # Production build
npm run start      # Run production server
npm run lint       # Run ESLint
npm test           # Run Playwright E2E tests (headless)
npm run test:headed  # Run tests with visible browser
npm run test:ui      # Open Playwright interactive UI
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
│   ├── globals.css                # Dark slate theme, Tailwind CSS
│   ├── layout.tsx                 # Root layout with nav bar (sparkle icon + branding)
│   ├── page.tsx                   # Home page: header, DeckInput, features section
│   ├── error.tsx                  # Error boundary
│   ├── not-found.tsx              # 404 page
│   └── api/
│       ├── deck/route.ts          # GET  — fetch deck by Archidekt URL
│       ├── deck-parse/route.ts    # POST — parse pasted decklist text
│       └── deck-enrich/route.ts   # POST — enrich card names via Scryfall API
├── components/
│   ├── DeckInput.tsx              # 3-tab import form (Manual/Moxfield/Archidekt)
│   ├── DeckImportSection.tsx      # Import section wrapper
│   ├── DeckList.tsx               # Renders parsed deck by section (table or list view)
│   ├── EnrichedCardRow.tsx        # Expandable card row with chevron, mana cost, tags
│   ├── ManaCost.tsx               # Mana cost display with Scryfall SVG symbols
│   ├── ManaSymbol.tsx             # Single MTG symbol <img> from Scryfall CDN
│   ├── OracleText.tsx             # Oracle text with inline symbol images
│   └── CardTags.tsx               # Heuristic card tag pills (Ramp, Removal, etc.)
└── lib/
    ├── types.ts                   # DeckData, DeckCard, EnrichedCard, API types
    ├── archidekt.ts               # Archidekt API client + card normalization
    ├── moxfield.ts                # Moxfield API types (fetch support TBD)
    ├── scryfall.ts                # Scryfall API helpers (card enrichment)
    ├── decklist-parser.ts         # Text-based decklist parser
    ├── mana.ts                    # Mana cost parsing utilities
    ├── oracle.ts                  # Oracle text tokenizer (text + symbol segments)
    └── card-tags.ts               # Heuristic tag generation from card data
```

### Data Flow

1. **URL import** (`/api/deck`): Accepts an Archidekt URL -> extracts deck ID -> fetches from Archidekt API -> normalizes to `DeckData`
2. **Text import** (`/api/deck-parse`): Accepts raw decklist text -> parses via `decklist-parser.ts` -> returns `DeckData`
3. **Card enrichment** (`/api/deck-enrich`): Accepts card names -> fetches from Scryfall API -> returns `EnrichedCard` map
4. All three UI tabs (Manual, Moxfield, Archidekt) currently route through the text parser; direct Moxfield API fetching is not yet implemented

### Key Types

- `DeckCard` -- `{ name: string; quantity: number }`
- `DeckData` -- `{ name, source, url, commanders[], mainboard[], sideboard[] }`
- `EnrichedCard` -- Full card data from Scryfall (mana cost, oracle text, type line, keywords, power/toughness, etc.)
- Source can be `"moxfield" | "archidekt" | "text"`

### Design System

- Dark theme: slate gradient background (`from-slate-950 via-slate-900 to-slate-800`)
- Purple accent for primary actions (`bg-purple-600`)
- Card panels: `bg-slate-800/50 border-slate-700 rounded-xl`
- Tab bar: `bg-slate-900` with `bg-slate-600` active state
- Text: `text-white` headings, `text-slate-300` body, `text-slate-400` secondary
- MTG symbols: Scryfall CDN SVGs (`https://svgs.scryfall.io/card-symbols/{SYMBOL}.svg`)

### Component Patterns

- **ManaSymbol**: Always use `<img>` tags with explicit `width`/`height` HTML attributes, `aria-hidden="true"`, and `shrink-0 inline-block align-text-bottom` for proper layout. The parent container carries the accessible label.
- **ManaCost**: Container `<span>` carries `aria-label` with human-readable cost description. Individual symbols are `aria-hidden`.
- **EnrichedCardRow**: Expandable disclosure pattern with `aria-expanded`, `aria-controls`, and Escape key support. Chevron rotates on expand with `motion-reduce:transition-none`.
- **Table layout**: Use `table-auto` with `whitespace-nowrap` on fixed-content columns (Qty, Cost, Type). The Name column fills remaining space with `min-w-0` for truncation.

## Testing

This project uses **Playwright** for end-to-end testing. Tests live in the `e2e/` directory and run against the Next.js dev server (started automatically via the `webServer` config in `playwright.config.ts`).

### Running Tests

```bash
npm test                           # Run all tests headless
npm run test:headed                # Run with a visible browser
npm run test:ui                    # Interactive Playwright UI
npx playwright test e2e/deck-import.spec.ts  # Run a single test file
```

### Test Structure

```
e2e/
├── fixtures.ts                 # DeckPage page-object, sample decklists, custom test export
├── deck-import.spec.ts         # Manual decklist import user flows
├── tab-navigation.spec.ts      # Tab switching, Load Example, form state persistence
├── deck-display.spec.ts        # Rendered deck sections, card counts, source label
├── api-deck-parse.spec.ts      # POST /api/deck-parse API contract tests
├── api-deck-enrich.spec.ts     # POST /api/deck-enrich API contract tests
├── deck-enrichment.spec.ts     # Enriched card UI: symbols, chevrons, expand/collapse
├── card-tags.spec.ts           # Heuristic card tag rendering
├── mana-parsers.spec.ts        # Unit tests for mana cost parsing
└── oracle-parser.spec.ts       # Unit tests for oracle text tokenizer
```

### Writing Tests

- **Import `test` and `expect` from `./fixtures`** (not from `@playwright/test` directly) to get the `deckPage` fixture automatically.
- **Use `deckPage` methods** (`goto()`, `fillDecklist()`, `submitImport()`, `waitForDeckDisplay()`) to express tests as user intent.
- **Use `deckPage.deckDisplay`** to scope assertions to the rendered deck panel and avoid strict-mode violations with the textarea.
- **Add new page-object methods to `DeckPage`** in `fixtures.ts` when new UI elements are introduced.
- **API tests** can use Playwright's `request` fixture directly with `@playwright/test` imports.
- **Pure utility tests** (e.g., `oracle-parser.spec.ts`, `mana-parsers.spec.ts`) import functions directly from `src/lib/` and do not need the `deckPage` fixture.
- Focus on **functional behavior**, not styling or visual assertions.

### TDD Workflow

**All new features must follow test-driven development:**

1. **Write failing tests first** -- before implementing any feature, add tests in `e2e/` that describe the expected behavior. Run `npm test` to confirm they fail.
2. **Implement the feature** -- write the minimum code to make the tests pass.
3. **Refactor** -- clean up while keeping tests green.
4. **All tests must pass before committing** -- run `npm test` and verify 0 failures before every commit.

When working on a feature, the test file should be created or updated _before_ the implementation code. This ensures the test suite always describes the intended behavior and catches regressions.

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
