# Code Analysis & Refactor Plan

## Context

After a period of rapid feature development (v0.1.0 → v0.2.1), the codebase has accumulated technical debt across library modules, components, API routes, and tests. This plan documents a comprehensive analysis and prioritized refactoring roadmap to improve code quality, performance, maintainability, and test coverage.

## Current Health Baseline

| Metric | Status |
|--------|--------|
| **Unit tests** | 1,004 passing (14s) |
| **ESLint** | 15 errors, 38 warnings (53 total) |
| **Production build** | Passes (font fetch fails in offline env only) |
| **Source files** | 86 TS/TSX files, ~18,900 lines |
| **Lib modules** | 29 modules, 9,709 lines |
| **Components** | 45+ components, 8,471 lines |
| **Largest file** | `opening-hand.ts` at 1,467 lines |

---

## Findings

### 1. Code Duplication (HIGH)

#### 1a. `getAllDeckCards()` / card collection pattern — 15+ locations
Scattered across `synergy-engine.ts`, `deck-analysis-aggregate.ts`, `power-level.ts`, `bracket-estimator.ts`, `budget-analysis.ts`, `deck-composition.ts`, `hypergeometric.ts`, and more. Two explicit `getAllCardNames()` implementations exist with different styles:
- `synergy-engine.ts:33-41` (loop-based)
- `deck-analysis-aggregate.ts:70-76` (spread-based)

#### 1b. `isLand()` type check — 8+ locations
`card.typeLine.includes("Land")` or equivalent appears in `color-distribution.ts`, `land-base-efficiency.ts`, `mana-recommendations.ts`, `budget-analysis.ts`, `candidate-analysis.ts`, `opening-hand.ts`, `cedh-staples.ts`, `deck-composition.ts`.

#### 1c. Commander resolution loop — 4× in `synergy-engine.ts`
Identical 4-line block at lines 293-297, 368-372, 432-436, 615-619.

#### 1d. `countTaggedCards()` — duplicated across modules
- `power-level.ts:78-97` (`countTaggedCards`)
- `bracket-estimator.ts:125-150` (`countCardsWithTag`)
Nearly identical functions with different signatures.

#### 1e. Score clamping — 10+ locations
`Math.max(0, Math.min(100, score))` repeated throughout scoring modules.

#### 1f. Autocomplete components — ~60% duplicate
`CommanderInput.tsx` (259 lines) and `CardSearchInput.tsx` (219 lines) share nearly identical debounce, dropdown, keyboard navigation, and outside-click logic.

#### 1g. API input validation — duplicated across routes
Card name validation and deduplication logic duplicated between `deck-enrich/route.ts` (lines 99-122) and `deck-combos/route.ts` (lines 37-65).

### 2. Oversized Modules (MEDIUM-HIGH)

| File | Lines | Issue |
|------|-------|-------|
| `opening-hand.ts` | 1,467 | 5 distinct responsibilities: mana system, hand scoring, ability analysis, weight computation, Monte Carlo simulation |
| `mana-recommendations.ts` | 663 | 6 check functions + nested helpers + ramp analysis |
| `synergy-engine.ts` | 635 | Pair generation, anti-synergy, tribal/supertype/keyword boosts, theme detection |
| `export-report.ts` | 573 | Discord, Markdown, and JSON formatters in one file |
| `power-level.ts` | 571 | 8 weighted scoring factors |
| `DeckClassification.tsx` | 525 | 6 color mapping functions + cascade builder + rendering |
| `DeckImportSection.tsx` | 481 | 13 useState hooks, orchestration + enrichment + combos + validation + sharing |
| `DeckCompositionScorecard.tsx` | 476 | 7 utility functions that belong in lib/ |

### 3. Performance Concerns (MEDIUM)

#### 3a. `SYNERGY_AXES.find()` called 7× in synergy-engine.ts
Lines 114, 152, 165, 304, 379, 466, 540 — linear search each time instead of a pre-built Map.

#### 3b. Anti-synergy pair generation O(N² × axes × conflicts)
`synergy-engine.ts:140-178` — nested loops with repeated `.find()` calls.

#### 3c. Tag regeneration in opening hand simulation
`generateTags()` runs 40+ regex patterns per card and is called again during 1,000-iteration simulation instead of using cached results.

#### 3d. Bracket estimator multiple passes
`bracket-estimator.ts:217-289` loops through deck cards 5 separate times for different constraint types.

#### 3e. Missing `React.memo()` / `useMemo()`
- `ManaSymbol.tsx` — pure presentational, rendered frequently in tables
- `DeckAnalysis.tsx:80-92` — `typeCounts` recomputed every render
- `HandSimulator.tsx:54-70` — `pool`, `context`, `buildCardCache` recreated every render

#### 3f. No dynamic imports for heavy components
Recharts (8.3MB in node_modules) loaded statically. Charts, modals, and analysis panels could use `next/dynamic` or `React.lazy()`.

### 4. Test Coverage Gaps (MEDIUM)

#### 4a. Missing unit tests for critical modules
| Module | Lines | Risk |
|--------|-------|------|
| `scryfall.ts` | 280 | Core data enrichment, batching, retry logic, DFC handling |
| `archidekt.ts` | 86 | User-facing deck import, card normalization |

#### 4b. Missing API route tests
| Route | Status |
|-------|--------|
| `GET /api/deck` (Archidekt) | No tests at all |
| `GET /api/commander-rules` | No tests at all |
| `GET /api/card-autocomplete` | Only 4 basic tests |

#### 4c. Missing edge case tests
- Duplicate card entries in deck parse
- Special characters in card names (DFC split names)
- Commander quantity > 1
- Non-string items in cardNames arrays
- Scryfall rate limit / timeout handling

### 5. ESLint Issues (LOW-MEDIUM)

- **15 errors**: 3× `@typescript-eslint/no-explicit-any` in `creature-types.spec.ts:212,233,249`; 12 other errors in test files
- **38 warnings**: Unused variables/imports across `mana.ts:46`, `scryfall.ts:245`, `synergy-engine.ts:378`, and multiple test files

### 6. Inconsistencies (LOW)

- API error message formatting varies (`"Failed to..."` vs `"...unavailable"`)
- Console error prefixes inconsistent (`[deck API]` vs `[deck-enrich]`)
- HTTP status codes for similar failures differ (200 with error body vs 502)
- E2e test mock setup duplicated 8× (should be in page-object helper)

---

## Implementation Tasks

### Phase 1: Shared Utilities & DRY Refactor

- [ ] Create `src/lib/deck-utils.ts` with shared helpers:
  - `getAllDeckCards(deck): DeckCard[]`
  - `getAllCardNames(deck): string[]`
  - `resolveCommanders(deck, cardMap): EnrichedCard[]`
  - `isLand(typeLine): boolean`
  - `clampScore(score, min?, max?): number`
- [ ] Replace all 15+ inline card-collection patterns with `getAllDeckCards()` / `getAllCardNames()`
- [ ] Replace 8+ inline `isLand()` checks with shared helper
- [ ] Replace 4× commander resolution loops in `synergy-engine.ts` with `resolveCommanders()`
- [ ] Consolidate `countTaggedCards()` (power-level.ts) and `countCardsWithTag()` (bracket-estimator.ts) into one shared function
- [ ] Replace 10+ inline `Math.max(0, Math.min(100, ...))` with `clampScore()`
- [ ] Extract shared API validation utility (`src/lib/api-validation.ts`): `validateAndDeduplicateCardNames()`
- [ ] Replace duplicated validation in `deck-enrich/route.ts` and `deck-combos/route.ts`

### Phase 2: Module Splitting

- [ ] Split `opening-hand.ts` (1,467 lines) into:
  - `opening-hand-mana.ts` — pip parsing, canCast, mana producers
  - `opening-hand-scoring.ts` — scoreRamp, scoreCA, scoreInteraction, tempo weights
  - `opening-hand.ts` — simulation engine, hand evaluation, public API (re-exports)
- [ ] Extract `opening-hand-scoring.ts` helper patterns:
  - Parameterized `computeTempoWeight(cmc, thresholds)`
  - Parameterized `scoreByThreshold(count, thresholds, fallback)`
  - Extract "best commander" selection pattern (eliminates ~100 lines of duplication)
- [ ] Extract presentation utilities from components to lib/:
  - `DeckCompositionScorecard.tsx` status/color functions → `src/lib/status-styling.ts`
  - `DeckClassification.tsx` bracket/power color functions → same or adjacent module

### Phase 3: Performance Optimizations

- [ ] Pre-build `axisMap` in `synergy-engine.ts`: `new Map(SYNERGY_AXES.map(a => [a.id, a]))` — eliminates 7× `.find()` calls
- [ ] Refactor `generateAntiSynergyPairs()` to use pre-built conflict map instead of nested `.find()` loops
- [ ] Ensure tag caching is used consistently in opening-hand simulation paths
- [ ] Add `React.memo()` to `ManaSymbol`, `CardTags`, `DeckThemes`, `TypeFilterBar`
- [ ] Add `useMemo()` for expensive computations in `DeckAnalysis`, `HandSimulator`
- [ ] Add `next/dynamic` lazy loading for Recharts-based chart components

### Phase 4: Component Deduplication

- [ ] Create reusable `Autocomplete.tsx` component with configurable fetch function
- [ ] Refactor `CommanderInput.tsx` and `CardSearchInput.tsx` to use shared `Autocomplete`
- [ ] Extract mock enrichment helper into `e2e/fixtures.ts` page-object (`mockEnrichment()` method)
- [ ] Consolidate duplicate mock response constants in `deck-enrichment.spec.ts`

### Phase 5: Test Coverage

- [ ] Add unit tests for `scryfall.ts` (batch chunking, retry logic, DFC handling, price parsing)
- [ ] Add unit tests for `archidekt.ts` (card normalization, commander extraction, error cases)
- [ ] Add e2e API tests for `GET /api/deck` (Archidekt URL validation, error handling)
- [ ] Add e2e API tests for `GET /api/commander-rules` (pagination, rate limits)
- [ ] Add edge case tests for deck-parse (duplicate cards, special characters, mixed case, comments)
- [ ] Add edge case tests for deck-enrich (non-string items, null prices, empty oracle text)

### Phase 6: ESLint Cleanup

- [ ] Fix 3× `@typescript-eslint/no-explicit-any` in `creature-types.spec.ts` with proper types
- [ ] Remove unused variable `CARD_TYPES` in `mana.ts:46`
- [ ] Remove unused variable `_cardType` in `scryfall.ts:245`
- [ ] Remove unused variable `anchorSet` in `synergy-engine.ts:378`
- [ ] Clean up unused imports/variables in test files (38 warnings)

### Phase 7: Polish & Consistency

- [ ] Standardize API error response format (consistent message style and HTTP status codes)
- [ ] Standardize console error prefixes across API routes
- [ ] Address TODO: add server-side LRU cache for Scryfall card data (`scryfall.ts:178`)
- [ ] Add caching headers to `commander-rules` API route (data changes infrequently)

---

## Files to Create/Modify

| Action | File | Phase |
|--------|------|-------|
| **Create** | `src/lib/deck-utils.ts` | 1 |
| **Create** | `src/lib/api-validation.ts` | 1 |
| **Create** | `src/lib/opening-hand-mana.ts` | 2 |
| **Create** | `src/lib/opening-hand-scoring.ts` | 2 |
| **Create** | `src/lib/status-styling.ts` | 2 |
| **Create** | `src/components/Autocomplete.tsx` | 4 |
| **Create** | `tests/unit/scryfall.spec.ts` | 5 |
| **Create** | `tests/unit/archidekt.spec.ts` | 5 |
| **Create** | `e2e/api-deck.spec.ts` | 5 |
| **Create** | `e2e/api-commander-rules.spec.ts` | 5 |
| **Modify** | `src/lib/synergy-engine.ts` | 1, 3 |
| **Modify** | `src/lib/power-level.ts` | 1 |
| **Modify** | `src/lib/bracket-estimator.ts` | 1 |
| **Modify** | `src/lib/budget-analysis.ts` | 1 |
| **Modify** | `src/lib/deck-composition.ts` | 1 |
| **Modify** | `src/lib/color-distribution.ts` | 1 |
| **Modify** | `src/lib/land-base-efficiency.ts` | 1 |
| **Modify** | `src/lib/mana-recommendations.ts` | 1 |
| **Modify** | `src/lib/candidate-analysis.ts` | 1 |
| **Modify** | `src/lib/opening-hand.ts` | 1, 2 |
| **Modify** | `src/lib/cedh-staples.ts` | 1 |
| **Modify** | `src/lib/hypergeometric.ts` | 1 |
| **Modify** | `src/lib/deck-analysis-aggregate.ts` | 1 |
| **Modify** | `src/app/api/deck-enrich/route.ts` | 1 |
| **Modify** | `src/app/api/deck-combos/route.ts` | 1 |
| **Modify** | `src/app/api/commander-rules/route.ts` | 7 |
| **Modify** | `src/components/CommanderInput.tsx` | 4 |
| **Modify** | `src/components/CardSearchInput.tsx` | 4 |
| **Modify** | `src/components/ManaSymbol.tsx` | 3 |
| **Modify** | `src/components/CardTags.tsx` | 3 |
| **Modify** | `src/components/DeckAnalysis.tsx` | 3 |
| **Modify** | `src/components/HandSimulator.tsx` | 3 |
| **Modify** | `src/components/DeckCompositionScorecard.tsx` | 2 |
| **Modify** | `src/components/DeckClassification.tsx` | 2 |
| **Modify** | `src/lib/mana.ts` | 6 |
| **Modify** | `src/lib/scryfall.ts` | 6, 7 |
| **Modify** | `tests/unit/creature-types.spec.ts` | 6 |
| **Modify** | Multiple test files | 6 |
| **Modify** | `e2e/fixtures.ts` | 4 |
| **Modify** | `e2e/deck-enrichment.spec.ts` | 4 |

---

## Verification

After each phase:
1. Run `npm run test:unit` — all 1,004+ tests must pass
2. Run `npm run lint` — error count must decrease, no new errors
3. Run `npm run build` — must compile without type errors
4. Run `npm run test:e2e` — all e2e tests must pass (when dev server available)

Final verification:
- ESLint: 0 errors, <10 warnings
- All existing tests green
- New tests for previously-uncovered modules passing
- No behavioral changes to any public API or UI
