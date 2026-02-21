# MTG Deck Evaluator

A web application for importing, parsing, and analyzing Magic: The Gathering decklists. Built with Next.js and TypeScript.

Import decks via manual text entry, Moxfield export, or Archidekt URL. Cards are automatically enriched with data from the Scryfall API, including mana costs rendered as official MTG symbols, oracle text with inline symbol images, heuristic card tags (Ramp, Removal, Card Draw, etc.), and expandable card detail rows.

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Docker

```bash
docker compose up
```

Open [http://localhost:3000](http://localhost:3000). Use `docker compose up --build` to rebuild after code changes.

```bash
docker compose up -d           # Run in background
docker compose down            # Stop and remove containers
docker compose logs -f         # Tail logs
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run Playwright E2E tests (headless) |
| `npm run test:headed` | Run tests with visible browser |
| `npm run test:ui` | Open Playwright interactive UI |

## Project Structure

```
src/
├── app/
│   ├── globals.css                # Dark slate theme, Tailwind CSS
│   ├── layout.tsx                 # Root layout with navigation bar
│   ├── page.tsx                   # Home page: header, deck input, features section
│   ├── error.tsx                  # Error boundary
│   ├── not-found.tsx              # 404 page
│   └── api/
│       ├── deck/route.ts          # GET  — fetch deck by Archidekt URL
│       ├── deck-parse/route.ts    # POST — parse pasted decklist text
│       └── deck-enrich/route.ts   # POST — enrich card names via Scryfall API
├── components/
│   ├── DeckInput.tsx              # 3-tab import form (Manual/Moxfield/Archidekt)
│   ├── DeckImportSection.tsx      # Import section wrapper
│   ├── DeckList.tsx               # Renders parsed deck by section (table or list)
│   ├── EnrichedCardRow.tsx        # Expandable card row with chevron, mana cost, tags
│   ├── ManaCost.tsx               # Mana cost display with Scryfall SVG symbols
│   ├── ManaSymbol.tsx             # Single MTG symbol <img> from Scryfall CDN
│   ├── OracleText.tsx             # Oracle text with inline symbol images
│   └── CardTags.tsx               # Heuristic card tag pills (Ramp, Removal, etc.)
└── lib/
    ├── types.ts                   # DeckData, DeckCard, EnrichedCard, API types
    ├── archidekt.ts               # Archidekt API client + card normalization
    ├── moxfield.ts                # Moxfield API types
    ├── scryfall.ts                # Scryfall API helpers (card enrichment)
    ├── decklist-parser.ts         # Text-based decklist parser
    ├── mana.ts                    # Mana cost parsing utilities
    ├── oracle.ts                  # Oracle text tokenizer (text + symbol segments)
    └── card-tags.ts               # Heuristic tag generation from card data
```

## Testing

This project uses [Playwright](https://playwright.dev/) for end-to-end testing. Tests live in the `e2e/` directory and run against the Next.js dev server (started automatically via `webServer` in `playwright.config.ts`).

### Running Tests

```bash
npm test                                          # Run all tests headless
npm run test:headed                               # Run with a visible browser
npm run test:ui                                   # Open Playwright interactive UI
npx playwright test e2e/deck-import.spec.ts       # Run a single test file
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

- Import `test` and `expect` from `./fixtures` (not from `@playwright/test` directly) to get the `deckPage` fixture automatically.
- Use `deckPage` methods (`goto()`, `fillDecklist()`, `submitImport()`, `waitForDeckDisplay()`) to express tests as user intent.
- Use `deckPage.deckDisplay` to scope assertions to the rendered deck panel.
- Add new page-object methods to `DeckPage` in `fixtures.ts` when new UI elements are introduced.
- API tests can use Playwright's `request` fixture directly with `@playwright/test` imports.
- Focus on functional behavior, not styling or visual assertions.

### TDD Workflow

All new features follow test-driven development:

1. **Write failing tests first** -- add tests in `e2e/` that describe the expected behavior. Run `npm test` to confirm they fail.
2. **Implement the feature** -- write the minimum code to make the tests pass.
3. **Refactor** -- clean up while keeping tests green.
4. **All tests must pass before committing** -- run `npm test` and verify 0 failures.

## Tech Stack

- **Framework** -- Next.js 16 (App Router)
- **Language** -- TypeScript
- **Styling** -- Tailwind CSS 4
- **Testing** -- Playwright
- **Runtime** -- Node.js 20 (Alpine in Docker)
