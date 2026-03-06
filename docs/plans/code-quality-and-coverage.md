# Code Quality, Performance & Test Coverage Plan

## Context

A comprehensive code review identified 8 actionable areas for improvement across performance, error handling, and test coverage. This plan addresses them in priority order — critical safety/correctness issues first, then performance, then coverage gaps.

---

## Implementation Tasks

### Phase 1: Error Handling & Safety (Critical)

- [ ] **1.1 Add error handling to `deck-codec.ts` compression/decompression**
  - Wrap `compressGzip()` and `decompressGzip()` in try-catch blocks
  - Replace `data.buffer as ArrayBuffer` unsafe cast with proper `ArrayBuffer` extraction
  - Return descriptive errors on malformed base64url input in `decodeDeckPayload()`
  - **Edge cases**: empty input, truncated gzip stream, invalid base64url characters, `ArrayBuffer` detachment

- [ ] **1.2 Add pagination safety to `/api/commander-rules`**
  - Add a max-iteration guard (e.g., 20 pages) to the `while (url)` pagination loop
  - Add 429 rate-limit handling with `Retry-After` header parsing (match `scryfall.ts` pattern)
  - Add fetch timeout (10s, matching other routes)
  - **Edge cases**: `next_page` URL loops back to same page, `has_more: true` with missing `next_page`, 429 during pagination

- [ ] **1.3 Add response caching to `/api/commander-rules`**
  - Add module-level in-memory cache with 4-hour TTL (banned list changes are rare)
  - Add `Cache-Control: public, max-age=14400` header to response
  - Guard against concurrent requests triggering duplicate Scryfall fetches (promise deduplication)
  - **Edge cases**: cache invalidation on server restart, concurrent first-requests racing to populate cache

### Phase 2: Performance Optimizations

- [ ] **2.1 Memoize `generateTags()` results across the analysis pipeline**
  - Add a `buildTagCache(cardMap: Record<string, EnrichedCard>): Map<string, string[]>` function to `card-tags.ts`
  - Pre-compute tags for all cards once at the start of `analyzeDeckComposite()` in `deck-analysis-aggregate.ts`
  - Thread the tag cache through analysis functions that call `generateTags()` in loops:
    - `bracket-estimator.ts` (line 142)
    - `hypergeometric.ts` (line 184)
    - `deck-composition.ts` (line 275)
    - `synergy-engine.ts` (line 187)
    - `power-level.ts` (line 90)
    - `mana-recommendations.ts` (lines 122, 435)
    - `candidate-analysis.ts` (lines 168, 185, 281)
    - `opening-hand.ts` (lines 184, 200)
    - `budget-analysis.ts` (line 200)
  - Each module gets an optional `tagCache?: Map<string, string[]>` parameter; falls back to direct `generateTags()` call if not provided (backward compatible)
  - **Edge cases**: card name not in cache (new card added after cache built), empty cardMap

- [ ] **2.2 Optimize synergy pair generation in `synergy-engine.ts`**
  - Build a `Map<string, SynergyAxisDefinition>` from `SYNERGY_AXES` once before the pair loop, replacing repeated `SYNERGY_AXES.find()` calls at lines 114 and 152
  - Pre-group cards by axis ID into a `Map<axisId, cardName[]>` so only cards sharing an axis are compared (eliminates pairs with zero overlap)
  - **Edge cases**: axis with 0 cards (empty group), axis with 1 card (no pairs possible), card with no axis scores

- [ ] **2.3 Add `React.memo` to list-rendered components**
  - Wrap `EnrichedCardRow` in `React.memo()`
  - Wrap `CandidateCardRow` in `React.memo()` if it exists as a standalone component
  - **Edge cases**: props containing object references that change identity on re-render (ensure parent doesn't create new objects inline)

### Phase 3: Test Coverage — Missing Unit Tests

- [ ] **3.1 Add unit tests for `decklist-parser.ts`**
  - Create `tests/unit/decklist-parser.spec.ts`
  - Test `parseDecklist()`:
    - Zone header detection (`COMMANDER:`, `MAINBOARD:`, `SIDEBOARD:`)
    - Card line parsing (`1 Sol Ring`, `1x Sol Ring`, `Sol Ring`)
    - Quantity parsing (1, 4, 0, negative)
    - Unparseable lines → warnings array
    - Empty input → empty deck
    - Cards with special characters (apostrophes, commas, hyphens)
  - Test `inferCommanders()`:
    - Last 1-2 cards after blank line → moved to commanders
    - No blank line → no inference
    - 3+ cards after blank line → no inference (only 1-2 supported)
    - Multiple blank lines → uses last group
  - Test `reconstructDecklist()`:
    - Round-trip: parse → reconstruct → parse yields same DeckData
    - Sections in correct order (COMMANDER, MAINBOARD, SIDEBOARD)
    - Empty sections omitted
  - **Edge cases**: Windows line endings (`\r\n`), trailing whitespace, tab-separated quantities, duplicate card names across zones

- [ ] **3.2 Add unit tests for `archidekt.ts`**
  - Create `tests/unit/archidekt.spec.ts`
  - Test `isArchidektUrl()`:
    - Valid: `https://archidekt.com/decks/12345`, `http://www.archidekt.com/decks/99`
    - Invalid: `https://moxfield.com/decks/abc`, `https://archidekt.com/` (no deck ID), empty string, non-URL strings
  - Test `extractArchidektDeckId()`:
    - Numeric IDs, IDs with trailing path segments, null/undefined input
  - Test `normalizeArchidektCards()`:
    - Standard deck with commanders, mainboard, sideboard
    - Cards without `oracleCard.name` → skipped
    - Duplicate entries → separate DeckCard entries
    - Empty categories → empty arrays
    - Mixed category membership
  - **Edge cases**: URL with query parameters, URL with hash fragment, deck ID at integer boundary

- [ ] **3.3 Add unit tests for `scryfall.ts` normalization**
  - Create `tests/unit/scryfall.spec.ts`
  - Test `normalizeToEnrichedCard()` (pure function, no network needed):
    - Standard single-faced card
    - Double-faced card (card_faces array)
    - Missing optional fields (prices null, power/toughness absent)
    - Price parsing: string prices, null prices, `"0.00"` prices
    - Color identity mapping
    - Keyword extraction
  - **Edge cases**: card with no mana cost (lands), card with `{X}` in cost, split cards, adventure cards, card_faces with different mana costs

### Phase 4: Test Coverage — Missing API & Integration Tests

- [ ] **4.1 Add e2e tests for `/api/commander-rules`**
  - Create `e2e/api-commander-rules.spec.ts`
  - Test successful response structure: `{ banned: [...], gameChangers: [...] }`
  - Test that `banned` array contains known banned cards (e.g., `"Balance"`)
  - Test response shape: each entry has `name` and `scryfallId` fields
  - Use `test.skip()` pattern if Scryfall is unreachable (match `api-deck-enrich.spec.ts` pattern)
  - **Edge cases**: Scryfall rate-limited (429), Scryfall down (502)

- [ ] **4.2 Add unit tests for `deck-codec.ts` round-trip**
  - Create `tests/unit/deck-codec.spec.ts`
  - Test `encodeDeckPayload()` → `decodeDeckPayload()` round-trip
  - Test with minimal deck (1 card), full deck (100 cards), deck with special characters
  - Test error cases: malformed base64url input, truncated payload, wrong version byte
  - **Edge cases**: card names with Unicode characters, very long deck names, empty commander/sideboard arrays

### Phase 5: Code Quality Refactors

- [ ] **5.1 Consolidate `DeckImportSection` state with `useReducer`**
  - Define a `DeckImportState` type and `DeckImportAction` union
  - Replace 15 `useState` calls with a single `useReducer`
  - Define named action types: `IMPORT_START`, `IMPORT_SUCCESS`, `IMPORT_ERROR`, `ENRICH_START`, `ENRICH_SUCCESS`, `ENRICH_ERROR`, `RESET`, `SET_TAB`, `TOGGLE_MODAL`, `SET_SHARE_URL`
  - Extract reducer to a separate function for testability
  - **Edge cases**: state transitions during abort (enrichAbortRef), concurrent imports (reset while enriching), modal open during loading

---

## Files to Create/Modify

| File | Action | Phase |
|------|--------|-------|
| `src/lib/deck-codec.ts` | Modify — add try-catch, fix unsafe cast | 1.1 |
| `src/app/api/commander-rules/route.ts` | Modify — pagination guard, caching, rate limiting | 1.2, 1.3 |
| `src/lib/card-tags.ts` | Modify — add `buildTagCache()` export | 2.1 |
| `src/lib/deck-analysis-aggregate.ts` | Modify — build tag cache, thread through pipeline | 2.1 |
| `src/lib/bracket-estimator.ts` | Modify — accept optional tagCache | 2.1 |
| `src/lib/hypergeometric.ts` | Modify — accept optional tagCache | 2.1 |
| `src/lib/deck-composition.ts` | Modify — accept optional tagCache | 2.1 |
| `src/lib/synergy-engine.ts` | Modify — accept optional tagCache, optimize pair gen | 2.1, 2.2 |
| `src/lib/power-level.ts` | Modify — accept optional tagCache | 2.1 |
| `src/lib/mana-recommendations.ts` | Modify — accept optional tagCache | 2.1 |
| `src/lib/candidate-analysis.ts` | Modify — accept optional tagCache | 2.1 |
| `src/lib/opening-hand.ts` | Modify — accept optional tagCache | 2.1 |
| `src/lib/budget-analysis.ts` | Modify — accept optional tagCache | 2.1 |
| `src/components/EnrichedCardRow.tsx` | Modify — wrap in React.memo | 2.3 |
| `tests/unit/decklist-parser.spec.ts` | Create | 3.1 |
| `tests/unit/archidekt.spec.ts` | Create | 3.2 |
| `tests/unit/scryfall.spec.ts` | Create | 3.3 |
| `tests/unit/deck-codec.spec.ts` | Create | 4.2 |
| `e2e/api-commander-rules.spec.ts` | Create | 4.1 |
| `src/components/DeckImportSection.tsx` | Modify — useReducer refactor | 5.1 |

---

## Verification

After each phase:
1. Run `npm run test:unit` — all unit tests pass (including new ones)
2. Run `npm run test:e2e` — all e2e tests pass (including new ones)
3. Run `npm run build` — production build succeeds with no TypeScript errors
4. Run `npm run lint` — no new lint warnings

Final verification:
- `npm test` — full test suite green
- Manual spot-check: import a deck, verify enrichment and analysis still work end-to-end
