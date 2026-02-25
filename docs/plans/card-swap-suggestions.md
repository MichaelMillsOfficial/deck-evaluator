# Card Swap Suggestions

## Context

Commander deckbuilding is an iterative process. After importing a deck and viewing the Composition Scorecard, a player knows *which* functional categories are underserved (e.g., "Ramp: 3 cards, need 10-12") and can see per-card synergy scores on the Synergy tab. The natural next question is: **"What should I swap in, and what should I swap out?"**

No existing tool connects gap analysis directly to actionable card recommendations within the same workflow. EDHREC shows popular cards per commander but does not perform gap-driven recommendations. Moxfield and Archidekt have no composition validation at all. This feature closes the loop between diagnosis and action.

This feature adds a **Card Swap Suggestions** system that generates three types of recommendations:

1. **Category Fill** -- When the Composition Scorecard identifies a category as "low" or "critical," suggest cards from Scryfall's Search API that match the deck's color identity and fulfill that functional role.
2. **Weak Card Identification** -- Flag cards with low synergy scores (below 35) that also lack a unique functional tag role, making them prime swap-out candidates.
3. **Upgrade Suggestions** -- For existing cards with moderate synergy scores (35-55), suggest alternatives that fill the same functional role at equal or lower mana cost.

The feature surfaces as a new **"Suggestions"** tab in `DeckViewTabs`, powered by client-side pure functions for weak card identification and a server-side API route that queries Scryfall Search for category fill and upgrade recommendations.

### Intended Outcome

After importing and enriching a deck, players switch to the Suggestions tab and immediately see: which cards are underperforming, which categories need reinforcement, and concrete card names to consider swapping in -- all without leaving the app.

## Why

1. **Completes the evaluation loop** -- The app already tells players *what is wrong* (Composition Scorecard shows gaps, synergy scores show low-performers); this feature tells them *how to fix it*.
2. **High engagement potential** -- Card recommendations are the most actionable output a deck evaluator can provide. Players will return specifically for swap suggestions.
3. **Leverages existing infrastructure** -- Builds on `generateTags()` from `src/lib/card-tags.ts`, `analyzeDeckSynergy()` from `src/lib/synergy-engine.ts`, `findCombosInDeck()` from `src/lib/known-combos.ts`, `resolveCommanderIdentity()` from `src/lib/color-distribution.ts`, and the Scryfall API client in `src/lib/scryfall.ts`.
4. **Differentiator** -- No competitor performs gap-driven, synergy-aware, color-identity-scoped card recommendations automatically.

## Dependencies

| Dependency | Module | What It Provides | Status |
|-----------|--------|------------------|--------|
| **Deck Composition Scorecard** | `src/lib/deck-composition.ts` | `computeCompositionScorecard(deck, cardMap, template)` returning `CompositionScorecardResult` with per-category `status` ("good"/"low"/"high"/"critical"), `count`, `min`, `max`, `cards[]`; `AVAILABLE_TEMPLATES`; `CategoryResult`, `CompositionTemplate` types | **HARD DEPENDENCY -- must be complete before implementation begins** |
| Card tags | `src/lib/card-tags.ts` | `generateTags(card): string[]` -- 10 functional categories | Exists |
| Synergy engine | `src/lib/synergy-engine.ts` | `analyzeDeckSynergy(deck, cardMap)` returning `DeckSynergyAnalysis` with `cardScores` | Exists |
| Known combos | `src/lib/known-combos.ts` | `findCombosInDeck(cardNames): KnownCombo[]` for combo membership detection | Exists |
| Scryfall API client | `src/lib/scryfall.ts` | `fetchCardByName()`, `fetchCardCollection()`, `normalizeToEnrichedCard()`, rate-limit retry logic | Exists |
| Color identity | `src/lib/color-distribution.ts` | `resolveCommanderIdentity(deck, cardMap): Set<MtgColor>` | Exists |
| Types | `src/lib/types.ts` | `DeckData`, `DeckCard`, `EnrichedCard`, `DeckSynergyAnalysis`, `CardSynergyScore` | Exists |
| DeckViewTabs | `src/components/DeckViewTabs.tsx` | Tab container with `ViewTab` union type, `tabs` array, tabpanel rendering | Exists |

**Implementation CANNOT begin until the Deck Composition Scorecard feature is complete and merged.** The scorecard provides the gap analysis that drives category fill recommendations and the sole-provider protection logic for weak card identification.

## Existing Patterns to Reuse

| Pattern | Source File | How It Applies |
|---------|-------------|----------------|
| Pure computation function signature | `src/lib/land-base-efficiency.ts` | `(deck, cardMap) => Result` pattern for `identifyWeakCards()`, `selectUpgradeCandidates()` |
| API route with validation + external fetch | `src/app/api/deck-enrich/route.ts` | POST body parsing, field validation, Scryfall API calls with error handling, 502 on upstream failure |
| Scryfall API rate limiting | `src/lib/scryfall.ts` | `BATCH_DELAY_MS = 100`, `fetchBatchWithRetry()` with 429 retry |
| Tab addition | `src/components/DeckViewTabs.tsx` | Extend `ViewTab` union, add to `tabs` array, add `<div role="tabpanel">` |
| Score badge coloring | `src/components/CardSynergyTable.tsx` | `scoreBadgeClasses(score)` returns color-coded Tailwind classes |
| Expandable disclosure | `src/components/EnrichedCardRow.tsx` | `aria-expanded`, `aria-controls`, chevron, Escape key handler |
| `mockCard()` / `mockDeck()` test helpers | `tests/unit/synergy-engine.spec.ts` | Minimal `EnrichedCard` and `DeckData` builders |
| Mock API interception in e2e | `e2e/deck-enrichment.spec.ts` | `page.route("**/api/...")` pattern |
| Page-object fixture | `e2e/fixtures.ts` | `DeckPage` class with `selectDeckViewTab()`, `waitForAnalysisPanel()` |
| Tag pill rendering | `src/components/CardTags.tsx` | Color-coded pills using `TAG_COLORS` |

---

## Implementation Tasks

### Phase 1: Core Types and Pure Logic (`src/lib/card-suggestions.ts`)

**Prerequisite: Deck Composition Scorecard must be complete and merged.**

- [ ] **1.1** Create `src/lib/card-suggestions.ts` with type definitions:
  - `WEAK_CARD_THRESHOLD = 35`
  - `MAX_WEAK_CARDS = 10`
  - `UPGRADE_SCORE_MIN = 35`, `UPGRADE_SCORE_MAX = 55`
  - `MAX_UPGRADE_CANDIDATES = 8`
  - `MAX_QUERY_EXCLUSIONS = 20`
  - `RESULTS_PER_CATEGORY = 5`, `RESULTS_PER_UPGRADE = 3`
  - `SEARCH_DELAY_MS = 100`
  - `CardSuggestion` -- `{ cardName, reason, category, scryfallUri, imageUri, manaCost, cmc, typeLine }`
  - `CategoryFillRecommendation` -- `{ tag, label, status, currentCount, targetMin, gap, suggestions[] }`
  - `WeakCard` -- `{ cardName, synergyScore, tags, reason }`
  - `UpgradeSuggestion` -- `{ existingCard, existingCmc, existingTags, upgrades[] }`
  - `SwapSuggestionsResult` -- `{ categoryFills[], weakCards[], upgrades[] }`
  - `SuggestionsApiRequest` -- `{ gaps[], colorIdentity[], deckCardNames[], upgradeCandidates[] }`
  - `SuggestionsApiResponse` -- `{ categoryFills[], upgrades[], error? }`

- [ ] **1.2** Define `TAG_TO_SCRYFALL_QUERY` constant mapping each functional tag to a Scryfall search query fragment:
  - "Ramp" -> mana rocks + land search
  - "Card Draw" -> draw card effects
  - "Removal" -> destroy/exile target
  - "Board Wipe" -> destroy/exile all
  - "Counterspell" -> counter target spell
  - "Tutor" -> search your library
  - "Cost Reduction" -> cost less to cast
  - "Protection" -> hexproof/indestructible/ward
  - "Recursion" -> return from graveyard

- [ ] **1.3** Implement `buildScryfallSearchQuery(tag, colorIdentity, excludeNames): string`:
  1. Look up query fragment from `TAG_TO_SCRYFALL_QUERY`
  2. Prepend color identity filter (`id<=...`)
  3. Append card exclusions (`-!"CardName"`, capped at `MAX_QUERY_EXCLUSIONS`)
  4. Append `format:commander`

- [ ] **1.4** Implement `identifyWeakCards(deck, cardMap, cardScores, scorecard): WeakCard[]`:
  - Score < `WEAK_CARD_THRESHOLD` (35)
  - NOT sole provider of any tag in a low/critical category
  - NOT part of a known combo
  - NOT a commander
  - NOT a land
  - Sorted by score ascending, capped at `MAX_WEAK_CARDS`

- [ ] **1.5** Implement `selectUpgradeCandidates(deck, cardMap, cardScores)`:
  - Score between `UPGRADE_SCORE_MIN` and `UPGRADE_SCORE_MAX`
  - Has at least one functional tag
  - Not commander, not land
  - Sorted by score ascending, capped at `MAX_UPGRADE_CANDIDATES`

- [ ] **1.6** Implement `deriveGapsFromScorecard(scorecard)`:
  - Filter categories with status "low" or "critical"
  - Exclude "Lands" tag

### Phase 2: Unit Tests (`tests/unit/card-suggestions.spec.ts`)

- [ ] **2.1** Create test file with `mockCard()`, `mockDeck()`, and `mockScorecard()` helpers
- [ ] **2.2** Test `identifyWeakCards()`: flags low-synergy card with no unique functional role
- [ ] **2.3** Test `identifyWeakCards()`: preserves sole provider of a critical category
- [ ] **2.4** Test `identifyWeakCards()`: preserves combo piece regardless of score
- [ ] **2.5** Test `identifyWeakCards()`: commanders never flagged
- [ ] **2.6** Test `identifyWeakCards()`: lands never flagged
- [ ] **2.7** Test `identifyWeakCards()`: sorted by score ascending, capped at MAX_WEAK_CARDS
- [ ] **2.8** Test `identifyWeakCards()`: card not in cardScores/cardMap silently skipped
- [ ] **2.9** Test `identifyWeakCards()`: empty deck returns empty array
- [ ] **2.10** Test `buildScryfallSearchQuery()`: correct color identity filter for Sultai
- [ ] **2.11** Test `buildScryfallSearchQuery()`: excludes deck card names
- [ ] **2.12** Test `buildScryfallSearchQuery()`: caps exclusions at MAX_QUERY_EXCLUSIONS
- [ ] **2.13** Test `buildScryfallSearchQuery()`: unknown tag returns empty string
- [ ] **2.14** Test `buildScryfallSearchQuery()`: colorless commander uses `id<=C`
- [ ] **2.15** Test `buildScryfallSearchQuery()`: appends `format:commander`
- [ ] **2.16** Test `selectUpgradeCandidates()`: selects cards in score range with tags
- [ ] **2.17** Test `selectUpgradeCandidates()`: excludes cards with no functional tags
- [ ] **2.18** Test `selectUpgradeCandidates()`: excludes commanders and lands
- [ ] **2.19** Test `selectUpgradeCandidates()`: sorted ascending, capped at MAX_UPGRADE_CANDIDATES
- [ ] **2.20** Test `selectUpgradeCandidates()`: empty deck returns empty array
- [ ] **2.21** Test `deriveGapsFromScorecard()`: returns only "low" and "critical" categories
- [ ] **2.22** Test `deriveGapsFromScorecard()`: excludes "Lands" tag
- [ ] **2.23** Test `deriveGapsFromScorecard()`: returns empty when all categories "good"/"high"

### Phase 3: API Route (`src/app/api/card-suggestions/route.ts`)

- [ ] **3.1** Create `POST /api/card-suggestions` route with `export const dynamic = "force-dynamic"`
- [ ] **3.2** Validate request body: `gaps` array, `colorIdentity` array, `deckCardNames` array, `upgradeCandidates` array
- [ ] **3.3** Implement Scryfall Search for category fills: for each gap, build query, fetch, take first `RESULTS_PER_CATEGORY`, handle 404/429/500+
- [ ] **3.4** Implement Scryfall Search for upgrades: for each candidate, use primary tag query + `cmc<=` filter
- [ ] **3.5** Assemble and return `SuggestionsApiResponse`
- [ ] **3.6** Global error handler: 502 with descriptive error
- [ ] **3.7** Add `SEARCH_DELAY_MS` between Scryfall calls

### Phase 4: Scryfall Search Helper (`src/lib/scryfall.ts`)

- [ ] **4.1** Add `fetchScryfallSearch()` export with 404 handling (returns empty), 429 retry, timeout

### Phase 5: UI Components

- [ ] **5.1** Create `src/components/SuggestionCard.tsx` -- single card recommendation with name (linked to Scryfall), mana cost, type, reason
- [ ] **5.2** Create `src/components/CategoryFillList.tsx` -- category gap list with status badges and suggestion grids; empty state with green checkmark
- [ ] **5.3** Create `src/components/WeakCardList.tsx` -- weak card list with synergy score badges and reasons; empty state message
- [ ] **5.4** Create `src/components/UpgradeList.tsx` -- upgrade opportunities with existing card and alternatives
- [ ] **5.5** Create `src/components/SuggestionsPanel.tsx` -- top-level container:
  - Computes `weakCards` via `identifyWeakCards()` (client-side)
  - Derives `gaps` via `deriveGapsFromScorecard()`
  - Calls `POST /api/card-suggestions` when gaps or upgradeCandidates exist
  - Shows loading/error states
  - Renders CategoryFillList, WeakCardList, UpgradeList

### Phase 6: Tab Integration (`src/components/DeckViewTabs.tsx`)

- [ ] **6.1** Extend `ViewTab` union to include `"suggestions"`
- [ ] **6.2** Add `{ key: "suggestions", label: "Suggestions" }` to tabs array
- [ ] **6.3** Import and compute scorecard via `useMemo`
- [ ] **6.4** Add tabpanel for suggestions with `SuggestionsPanel`
- [ ] **6.5** Update disabled and keyboard logic to include `"suggestions"`

### Phase 7: Fixtures and E2E Tests

- [ ] **7.1** Update `e2e/fixtures.ts`: widen `selectDeckViewTab`, add `waitForSuggestionsPanel()`, add `suggestionsPanel` locator
- [ ] **7.2** Create `e2e/card-suggestions.spec.ts` with mock enrichment and suggestion API responses
- [ ] **7.3** Test: "Suggestions tab appears, disabled before enrichment"
- [ ] **7.4** Test: "Suggestions tab shows panel after enrichment"
- [ ] **7.5** Test: "Shows loading state while fetching"
- [ ] **7.6** Test: "Category fill section shows gap recommendations"
- [ ] **7.7** Test: "Weak card list shows low-synergy cards"
- [ ] **7.8** Test: "Upgrade list shows alternatives"
- [ ] **7.9** Test: "Empty state when all categories healthy"
- [ ] **7.10** Test: "Error state when suggestion API fails"
- [ ] **7.11** Test: "Proper ARIA structure"

### Phase 8: Refinement

- [ ] **8.1** Add result caching in `SuggestionsPanel` (keyed by deck name + template + identity)
- [ ] **8.2** Add "Refresh Suggestions" button (`data-testid="refresh-suggestions"`)
- [ ] **8.3** Ensure `motion-reduce:transition-none` on disclosure transitions
- [ ] **8.4** Verify 44px min touch targets on all interactive elements
- [ ] **8.5** Ensure suggestion card links open in new tab with `rel="noopener noreferrer"`

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/card-suggestions.ts` | Create | Types, constants, TAG_TO_SCRYFALL_QUERY, identifyWeakCards(), buildScryfallSearchQuery(), selectUpgradeCandidates(), deriveGapsFromScorecard() |
| `src/lib/scryfall.ts` | Modify | Add `fetchScryfallSearch()` function |
| `src/app/api/card-suggestions/route.ts` | Create | POST route querying Scryfall Search for fills and upgrades |
| `src/components/SuggestionCard.tsx` | Create | Single card recommendation display |
| `src/components/CategoryFillList.tsx` | Create | Category gap list with suggestions |
| `src/components/WeakCardList.tsx` | Create | Weak card list with synergy scores |
| `src/components/UpgradeList.tsx` | Create | Upgrade opportunities with alternatives |
| `src/components/SuggestionsPanel.tsx` | Create | Top-level container: weak cards + API call + rendering |
| `src/components/DeckViewTabs.tsx` | Modify | Add "suggestions" tab, compute scorecard, update disabled logic |
| `tests/unit/card-suggestions.spec.ts` | Create | 23 unit tests |
| `e2e/card-suggestions.spec.ts` | Create | 9 E2E tests with mocked APIs |
| `e2e/fixtures.ts` | Modify | Add suggestions panel helpers |

**No changes to**: `package.json`, `src/lib/card-tags.ts`, `src/lib/synergy-engine.ts`, `src/lib/known-combos.ts`, `src/lib/deck-composition.ts`, `src/lib/types.ts`, `src/components/DeckAnalysis.tsx`.

---

## Edge Cases

| Edge Case | Expected Behavior |
|-----------|-------------------|
| All composition categories "good" or "high" | `categoryFills` is empty; UI shows "All functional categories are on target" |
| No cards with synergy score < 35 | `weakCards` is empty; UI shows "No weak cards identified" |
| No cards in score range 35-55 with tags | `upgradeCandidates` is empty; UI shows "No upgrade suggestions available" |
| Both gaps and upgradeCandidates are empty | API call is skipped; only client-side `weakCards` shown |
| Commander has no color identity (colorless) | `buildScryfallSearchQuery()` uses `id<=C` |
| 5-color commander | Color filter is `id<=BGRUW`; all colors eligible |
| Deck has no commanders | `resolveCommanderIdentity()` returns empty set; uses `id<=C` |
| Scryfall returns 0 results | That category's suggestions are empty; UI shows "No suggestions found" |
| Scryfall rate limited (429) | Retry once after `Retry-After`; if still 429, skip category |
| Scryfall completely down | API route returns 502; UI shows error; weak cards still render (client-side) |
| Card not in cardMap (enrichment failed) | Silently skipped |
| Card with score < 35 but sole provider of critical tag | NOT flagged as weak |
| Card with score < 35 but part of known combo | NOT flagged as weak |
| Card with multiple tags, sole provider of one | NOT flagged (sole provider of ANY critical/low tag protects) |
| Quantity > 1 | Processed once by name; quantity doesn't affect classification |
| Very large deck (200+ cards) | deckCardNames capped at 250; query exclusions capped at 20 |
| Same card suggested for multiple categories | Acceptable; each category lists independently |
| Suggested card already in deck | Excluded via `-!"CardName"` in query |
| "Lands" category is critical | Excluded from gap-driven suggestions |

## E2E User Scenarios

1. **Gap-driven discovery**: Sultai deck light on Ramp (3/10-12) -> Suggestions tab -> "Ramp" flagged critical with 5 recommended cards in Sultai colors
2. **Weak card identification**: Vanilla creature with synergy 18 listed as swap-out candidate with reason
3. **Combo piece protection**: Thassa's Oracle with score 28 NOT flagged because it's in a known combo
4. **Upgrade path**: Divination (3 CMC, score 42) -> suggestions show Preordain, Night's Whisper, Brainstorm as cheaper alternatives
5. **Healthy deck**: All categories good, no weak cards -> three green-checkmark empty states
6. **API failure**: Scryfall down -> weak cards still render -> error shown for fills/upgrades
7. **Template impact**: Command Zone Template (min 10 ramp) shows more gaps than 8x8 Theory (min 7 ramp) for the same deck

## Verification

1. `npx playwright test --config playwright.unit.config.ts tests/unit/card-suggestions.spec.ts` -- all 23 unit tests pass
2. `npx playwright test e2e/card-suggestions.spec.ts` -- all 9 E2E tests pass
3. `npm test` -- full test suite green
4. `npm run build` -- no TypeScript errors
5. Manual: import a Commander deck with known gaps -> Suggestions tab shows category fills, weak cards, and upgrades -> verify Scryfall results are color-identity-scoped -> verify combo pieces are protected -> verify empty states for healthy decks
