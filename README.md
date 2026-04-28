# MTG Deck Evaluator

A web application for importing and analyzing Magic: The Gathering decklists. Built with Next.js and TypeScript.

Import a deck (paste, Moxfield export, or Archidekt URL) and the app walks you through a four-stage **journey** — *import → ritual → reading → sub-route*. The reading lands on a verdict hero (bracket, power level, top theme), then fans out across ten sub-routes for cards, composition, synergy, interactions, opening hands, goldfish simulation, suggestions, candidate finder, deck-vs-deck compare, and share/export. Cards are automatically enriched via Scryfall (mana costs as official MTG symbols, oracle text with inline symbols, heuristic tags), and combos are detected via Commander Spellbook.

See [Promises to You](./PROMISES.md) for how this tool handles your data and what drives the analysis.

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

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Import surface (paste · Moxfield · Archidekt) |
| `/ritual` | Cosmic loader, held until enrichment terminates |
| `/reading` | Verdict hero + reading-overview tile grid |
| `/reading/cards` | Full card list, grouped by section |
| `/reading/composition` | Mana curve, color pie, type breakdown |
| `/reading/synergy` | Synergy axes + pair detector |
| `/reading/interactions` | Removal / protection / chains |
| `/reading/hands` | Opening-hand keep simulator |
| `/reading/goldfish` | Monte Carlo goldfish stats |
| `/reading/suggestions` | Cut/add/swap recommendations |
| `/reading/add` | Candidate finder (typeahead → analysis) |
| `/reading/compare` | Deck-vs-deck redirect to `/compare` |
| `/reading/share` | Share URL · PNG · Discord · Markdown · JSON |
| `/shared` | Decode share URL → forward to `/reading` |
| `/compare` | Standalone two-deck comparison |
| `/preview` | Design-system component preview |

State flows through `DeckSessionContext` (sessionStorage-backed) so navigation between sub-routes does not refetch the deck or re-enrich cards. `CandidatesContext` is mounted at the `/reading/(shell)` layout so candidate state on `/reading/add` survives tab switches.

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                  # Root layout: Astral tokens, top nav, providers
│   ├── page.tsx                    # Import home
│   ├── ritual/page.tsx             # Cosmic loader
│   ├── reading/
│   │   ├── layout.tsx              # Session redirect gate
│   │   ├── page.tsx                # Verdict landing
│   │   └── (shell)/                # Shared sidebar + drawer + candidates
│   │       ├── layout.tsx
│   │       └── <slug>/page.tsx     # 10 sub-routes
│   ├── shared/page.tsx             # Decode share URL → /reading
│   ├── compare/                    # Standalone two-deck compare
│   ├── preview/                    # Design-system component preview
│   └── api/                        # /deck, /deck-parse, /deck-enrich, /deck-combos, ...
├── components/
│   ├── reading/                    # Shell, hero, overview, section header
│   ├── ritual/CosmicLoader.tsx
│   ├── shell/                      # Top nav, cosmos background
│   ├── DeckSidebar.tsx             # Route-aware nav
│   ├── DeckMobileTopBar.tsx
│   ├── DeckInput.tsx · DeckList.tsx · EnrichedCardRow.tsx
│   └── ManaCost.tsx · ManaSymbol.tsx · OracleText.tsx · CardTags.tsx
├── contexts/
│   ├── DeckSessionContext.tsx      # sessionStorage-backed deck + enrichment
│   └── CandidatesContext.tsx       # /reading/add candidate state
└── lib/
    ├── types.ts                    # DeckData, DeckCard, EnrichedCard
    ├── deck-session.ts             # sessionStorage codec + payload schema
    ├── deck-codec.ts               # Share-URL gzip+base64 codec
    ├── deck-tagline.ts             # Heuristic deck → tagline
    ├── view-tabs.ts                # ViewTab union, TAB_ROUTES, tabFromPathname
    └── ...                         # Parsers, enrichment, synergy, simulation
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
