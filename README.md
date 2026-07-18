# MTG Deck Evaluator

A web application for importing and analyzing Magic: The Gathering decklists. Built with Next.js and TypeScript.

Import a deck (paste, Moxfield export, or Archidekt URL) and the app walks you through a four-stage **journey** — *import → ritual → reading → sub-route*. The reading lands on a verdict hero (bracket, power level, top theme), then fans out across ten sub-routes for cards, composition, synergy, interactions, opening hands, goldfish simulation, suggestions, candidate finder, deck-vs-deck compare, and share/export. Cards are automatically enriched via Scryfall (mana costs as official MTG symbols, oracle text with inline symbols, heuristic tags), and combos are detected via Commander Spellbook.

Don't have a finished deck yet? **The Crucible** (`/crucible`) is a deck-building workbench: pour in any pile of cards, organize it through lenses (category, synergy axis, type line, mana value, color identity, game changers), triage each card as keep/cut/undecided with an explicit commander pick, and seal a legal 100-card Commander deck that flows straight into the reading journey (cuts are kept as sideboard candidates).

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
| `npm test` | Run all tests (e2e + unit, headless) |
| `npm run test:e2e` | Run only browser/API e2e tests |
| `npm run test:unit` | Run only pure function unit tests (fast, no dev server) |
| `npm run test:headed` | Run e2e tests with visible browser |
| `npm run test:ui` | Open Playwright interactive e2e UI |

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
| `/crucible` | The Crucible: pile triage workbench → seal a legal EDH deck |
| `/compare` | Standalone two-deck comparison |
| `/preview` | Design-system component preview |

State flows through `DeckSessionContext` (sessionStorage-backed) so navigation between sub-routes does not refetch the deck or re-enrich cards. `CandidatesContext` is mounted at the `/reading/(shell)` layout so candidate state on `/reading/add` survives tab switches. The Crucible keeps its own `CrucibleSessionContext` under a separate sessionStorage key, so a pile in progress coexists with a reading session.

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
│   ├── crucible/                   # The Crucible pile triage workbench
│   ├── compare/                    # Standalone two-deck compare
│   ├── preview/                    # Design-system component preview
│   └── api/                        # /deck, /deck-parse, /deck-enrich, /deck-combos, ...
├── components/
│   ├── reading/                    # Shell, hero, overview, section header
│   ├── crucible/                   # Workbench, lenses, triage rows, tracker rail
│   ├── ritual/CosmicLoader.tsx
│   ├── shell/                      # Top nav, cosmos background
│   ├── DeckSidebar.tsx             # Route-aware nav
│   ├── DeckMobileTopBar.tsx
│   ├── DeckInput.tsx · DeckList.tsx · EnrichedCardRow.tsx
│   └── ManaCost.tsx · ManaSymbol.tsx · OracleText.tsx · CardTags.tsx
├── contexts/
│   ├── DeckSessionContext.tsx      # sessionStorage-backed deck + enrichment
│   ├── CrucibleSessionContext.tsx  # /crucible pile triage state
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

This project uses [Playwright](https://playwright.dev/) for two test suites: browser/API e2e tests in `e2e/` (run against the Next.js dev server, started automatically via `webServer` in `playwright.config.ts`) and pure function unit tests in `tests/unit/` (no browser, no dev server, run under `playwright.unit.config.ts`).

### Running Tests

```bash
npm test                                          # Run all tests (e2e + unit) headless
npm run test:e2e                                  # Run only browser/API e2e tests
npm run test:unit                                 # Run only pure function unit tests (fast)
npm run test:headed                               # Run e2e tests with a visible browser
npm run test:ui                                   # Open Playwright interactive e2e UI
npx playwright test --config playwright.config.ts e2e/deck-import.spec.ts  # Single e2e file
```

For the full test structure, conventions for writing tests, and the TDD workflow, see the Testing section of [CLAUDE.md](./CLAUDE.md).

## Tech Stack

- **Framework** -- Next.js 16 (App Router)
- **Language** -- TypeScript
- **Styling** -- Tailwind CSS 4
- **Testing** -- Playwright
- **Runtime** -- Node.js 20 (Alpine in Docker)
