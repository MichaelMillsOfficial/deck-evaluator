# Commander Spellbook Integration

## Context

The deck evaluator's Synergy tab currently detects combos using a hardcoded registry in `src/lib/known-combos.ts`, which contains approximately 20 manually curated combos. This is a useful starting point but inherently limited: the Commander Spellbook database catalogs thousands of verified combos across the entire Commander card pool, and the local registry will never keep pace.

Commander Spellbook exposes a public API at `POST https://backend.commanderspellbook.com/find-my-combos/` that accepts a decklist (card names + quantities, with commanders separated) and returns categorized combos: exact matches where all cards are present in the deck, and near-misses where only 1-2 cards are missing. The response includes rich metadata: which cards each combo uses, what the combo produces (infinite mana, infinite damage, etc.), zone requirements, mana needed, bracket classification, and legality information.

The integration strategy is: build a new API route that proxies to Commander Spellbook, normalize the response into internal types, display verified combos and near-combos in the Synergy tab, and fall back gracefully to the existing local registry when the external API is unavailable.

### Intended Outcome

The Synergy tab displays Commander Spellbook verified combos in a dedicated section above the existing local combos. Exact combos show all participating cards. Near-combos highlight the missing card(s) so players can see what additions would complete a combo line. When the Commander Spellbook API is unreachable, the UI silently falls back to local combo detection with no user-facing error.

## Why

- Commander Spellbook has thousands of verified combos; the local registry has ~20
- Near-combo detection ("you're 1 card away from an infinite combo") is high-value deck-building guidance that cannot be replicated locally without maintaining a massive registry
- The API is free, public, and purpose-built for this exact use case
- Graceful fallback means zero regression risk -- the feature only adds capability

## Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| `src/lib/known-combos.ts` | Exists | Fallback combo detection; `findCombosInDeck()`, `KnownCombo` type |
| `src/lib/types.ts` | Exists | `DeckData`, `DeckCard`, `EnrichedCard`, `SynergyPair`, `DeckSynergyAnalysis` |
| `src/lib/synergy-engine.ts` | Exists | `analyzeDeckSynergy()` calls `findCombosInDeck()` and returns `knownCombos` in analysis |
| `src/components/SynergySection.tsx` | Exists | Renders combos from `analysis.topSynergies` and `analysis.knownCombos` |
| `src/components/SynergyPairList.tsx` | Exists | Expandable combo/synergy pair list with card images |
| `src/components/DeckViewTabs.tsx` | Exists | Manages Synergy tab rendering, passes `synergyAnalysis` and `cardMap` |
| `src/components/DeckImportSection.tsx` | Exists | Manages async data fetching (enrichment pattern to replicate) |
| `src/app/api/deck-enrich/route.ts` | Exists | Pattern for external API proxy route with validation and error handling |

No new npm packages needed. No dependencies on unbuilt features.

## Existing Patterns to Reuse

| Pattern | Source | Application |
|---------|--------|-------------|
| External API proxy route | `src/app/api/deck-enrich/route.ts` | POST validation, external fetch with timeout, error normalization, 502 on failure |
| Pure lib module with types | `src/lib/scryfall.ts` | API types, fetch function, normalization function exported from lib |
| Async background fetch | `src/components/DeckImportSection.tsx` | `enrichDeck()` pattern: abort controller, loading/error state, fires after deck import |
| Combo display | `src/components/SynergyPairList.tsx` | Expandable list items with card images, "Combo" badge |
| Stat cards | `src/components/SynergyStats.tsx` | Expandable stat card with chevron, detail list |
| Unit test helpers | `tests/unit/synergy-engine.spec.ts` | `mockCard()`, `mockDeck()` patterns |
| E2E mocked enrichment | `e2e/deck-analysis.spec.ts` | `page.route("**/api/...")` to mock API responses |
| Fallback to local data | General pattern | When API fails, use synchronous local computation |

---

## Implementation Tasks

### Phase 1: Commander Spellbook Types and Client (`src/lib/commander-spellbook.ts`)

- [ ] Create `src/lib/commander-spellbook.ts` with API request/response types:
  - `SpellbookCardRequest` -- `{ card: string; quantity: number }`
  - `SpellbookDeckRequest` -- `{ main: SpellbookCardRequest[]; commanders: SpellbookCardRequest[] }`
  - `SpellbookCard` -- `{ id: number; name: string; oracleId: string | null; typeLine: string; oracleText: string; manaValue: number; identity: string }`
  - `SpellbookFeature` -- `{ feature: { id: number; name: string }; quantity: number }`
  - `SpellbookCardInVariant` -- `{ card: SpellbookCard; zoneLocations: string[]; battlefieldCardState: string; mustBeCommander: boolean; quantity: number }`
  - `SpellbookTemplateInVariant` -- `{ template: { id: number; name: string; scryfallQuery: string | null }; zoneLocations: string[]; quantity: number }`
  - `SpellbookVariant` -- `{ id: string; status: string; uses: SpellbookCardInVariant[]; requires: SpellbookTemplateInVariant[]; produces: SpellbookFeature[]; identity: string; manaNeeded: string; manaValueNeeded: number; description: string; bracketTag: string; prices: { tcgplayer: string; cardkingdom: string; cardmarket: string } }`
  - `SpellbookFindMyCombosResponse` -- `{ results: { identity: string; included: SpellbookVariant[]; almostIncluded: SpellbookVariant[]; almostIncludedByAddingColors: SpellbookVariant[]; includedByChangingCommanders: SpellbookVariant[]; almostIncludedByChangingCommanders: SpellbookVariant[]; almostIncludedByAddingColorsAndChangingCommanders: SpellbookVariant[] } }`
- [ ] Implement `buildSpellbookRequest(deck: DeckData): SpellbookDeckRequest` -- map commanders and mainboard to API format, exclude sideboard
- [ ] Implement `fetchSpellbookCombos(request: SpellbookDeckRequest): Promise<SpellbookFindMyCombosResponse>` -- POST to `https://backend.commanderspellbook.com/find-my-combos/`, 15-second timeout, throw on non-200
- [ ] Define normalized internal types:
  - `SpellbookCombo` -- `{ id: string; cards: string[]; description: string; produces: string[]; missingCards: string[]; templateRequirements: string[]; manaNeeded: string; bracketTag: string; identity: string; type: "exact" | "near" }`
- [ ] Implement `normalizeVariant(variant: SpellbookVariant, deckCardNames: Set<string>): SpellbookCombo` -- extract card names from `uses`, compute `missingCards` by diffing against deck card set, map `produces` to readable strings, determine `type` from missing count
- [ ] Implement `normalizeSpellbookResponse(response: SpellbookFindMyCombosResponse, deckCardNames: Set<string>): { exactCombos: SpellbookCombo[]; nearCombos: SpellbookCombo[] }` -- normalize `included` as exact, normalize `almostIncluded` as near, sort exact by card count ascending, sort near by missing count ascending then card count ascending, cap near-combos at 20 results

### Phase 2: Unit Tests (`tests/unit/commander-spellbook.spec.ts`)

- [ ] `buildSpellbookRequest`: maps commanders to `commanders` array, mainboard to `main` array, excludes sideboard, handles empty commanders, handles quantity > 1
- [ ] `normalizeVariant`: extracts card names, computes missing cards, maps feature names to produces array, sets type based on missing count (0 = exact, >0 = near), preserves combo ID and description
- [ ] `normalizeSpellbookResponse`: separates included from almostIncluded, sorts exact combos by card count, sorts near combos by missing count then card count, caps near combos at 20, handles empty response
- [ ] `normalizeVariant` with template requirements: includes template name in `templateRequirements` array
- [ ] Edge cases: variant with 0 uses, variant with status "NW" (not working) filtered out, duplicate card names in uses handled

### Phase 3: API Route (`src/app/api/deck-combos/route.ts`)

- [ ] Create `POST /api/deck-combos` route following `deck-enrich/route.ts` validation pattern
- [ ] Validate request body: require `cardNames` (string array) and optional `commanders` (string array)
- [ ] Deduplicate and clean card names (reuse same pattern as deck-enrich)
- [ ] Build `SpellbookDeckRequest` from cleaned names
- [ ] Call `fetchSpellbookCombos`, normalize response
- [ ] Return `{ exactCombos: SpellbookCombo[], nearCombos: SpellbookCombo[] }`
- [ ] On fetch failure: return `{ exactCombos: [], nearCombos: [], error: "Commander Spellbook unavailable" }` with status 200 (not 502) -- the route always succeeds, just with empty combos on API failure, enabling client-side fallback without error handling
- [ ] Add `MAX_CARD_NAMES = 250` guard consistent with deck-enrich

### Phase 4: API E2E Tests (`e2e/api-deck-combos.spec.ts`)

- [ ] `POST /api/deck-combos` with valid cardNames returns 200 with `exactCombos` and `nearCombos` arrays (shape validation only -- real API may return 0 combos)
- [ ] `POST /api/deck-combos` with missing `cardNames` returns 400
- [ ] `POST /api/deck-combos` with empty `cardNames` returns 400
- [ ] `POST /api/deck-combos` with non-array `cardNames` returns 400
- [ ] `POST /api/deck-combos` response shape: `exactCombos[].cards` is string array, `exactCombos[].description` is string, `exactCombos[].produces` is string array, `exactCombos[].type` is "exact"
- [ ] `POST /api/deck-combos` with combo-known cards (e.g. `["Thassa's Oracle", "Demonic Consultation"]` + filler) returns at least 1 exact combo (integration test, may skip on network failure)

### Phase 5: Client-Side Combo Fetching in `DeckImportSection.tsx`

- [ ] Add state: `spellbookCombos: { exactCombos: SpellbookCombo[]; nearCombos: SpellbookCombo[] } | null`, `spellbookLoading: boolean`
- [ ] Add `fetchSpellbookCombos` callback (parallels `enrichDeck` pattern): fires after deck import alongside enrichment, uses `AbortController`, 15-second timeout, on failure sets combos to null (triggers fallback in UI)
- [ ] Call `fetchSpellbookCombos` inside `handleImport` alongside `enrichDeck` -- both fire concurrently after deck is parsed
- [ ] Pass `spellbookCombos` and `spellbookLoading` as new props through `DeckViewTabs` to `SynergySection`

### Phase 6: Prop Threading (`DeckViewTabs.tsx`)

- [ ] Add `spellbookCombos` and `spellbookLoading` to `DeckViewTabsProps`
- [ ] Forward to `SynergySection` alongside existing `analysis` and `cardMap` props

### Phase 7: Verified Combos Component (`src/components/VerifiedCombos.tsx`)

- [ ] Create `VerifiedCombos` component accepting `{ exactCombos: SpellbookCombo[]; nearCombos: SpellbookCombo[]; loading: boolean; cardMap: Record<string, EnrichedCard> }`
- [ ] Loading state: show subtle shimmer placeholder (same pattern as enrichment loading)
- [ ] Exact combos section: heading "Verified Combos" with Commander Spellbook attribution text, expandable list using same disclosure pattern as `SynergyPairList`
  - Each combo shows: card names joined by " + ", description, produces list as small pills, bracketTag badge
  - Expanded state: card images (same as `SynergyPairList` expanded pattern), zone/state requirements if non-trivial, mana needed, template requirements
- [ ] Near combos section: heading "Almost There" (combos 1-2 cards away)
  - Same layout as exact combos but missing cards highlighted with a distinct style (e.g. `text-amber-400` with "Missing:" prefix)
  - Missing card names rendered as amber-colored text with a dashed border pill
- [ ] Empty state: when no combos found, show "No verified combos found in Commander Spellbook" message
- [ ] Accessibility: expandable items use `aria-expanded`, `aria-controls`, Escape to collapse, proper heading hierarchy
- [ ] `data-testid` attributes: `verified-combos-section`, `verified-combo-item-{i}`, `near-combo-item-{i}`, `missing-card-{name}`, `combo-produces`

### Phase 8: Integration into SynergySection

- [ ] Add `spellbookCombos` and `spellbookLoading` props to `SynergySectionProps`
- [ ] Render `VerifiedCombos` above the existing "Known Combos" section (from local registry)
- [ ] When `spellbookCombos` has exact combos, rename local combos section header from "Known Combos" to "Local Combos" to distinguish sources
- [ ] When `spellbookCombos` is null (API failed or not yet loaded), show only local combos with no visible change from current behavior -- this is the graceful fallback
- [ ] Update `SynergyStats` combo count: when spellbook combos are available, show `spellbookCombos.exactCombos.length` in the stat card; fallback to `analysis.knownCombos.length`; add `data-testid="stat-near-combo-count"` for near-combo count

### Phase 9: Synergy Engine Integration (Optional Enhancement)

- [ ] Add optional `spellbookCombos` parameter to `analyzeDeckSynergy` signature
- [ ] When provided, convert spellbook exact combos to `SynergyPair[]` with `type: "combo"` and merge into `knownCombos` result
- [ ] Deduplicate: if a local combo and spellbook combo share the same card set, prefer the spellbook version (richer description)
- [ ] Spellbook combo cards receive the same `COMBO_BONUS` scoring as local combos

### Phase 10: E2E Tests (`e2e/spellbook-combos.spec.ts`)

Mock both `/api/deck-enrich` and `/api/deck-combos` via `page.route()`:

- [ ] "Verified Combos section appears in Synergy tab when spellbook returns combos"
- [ ] "Exact combos display card names, description, and produces"
- [ ] "Near combos display with missing cards highlighted"
- [ ] "Expanding a verified combo shows card images"
- [ ] "Combo count stat card reflects spellbook combo count"
- [ ] "Graceful fallback: when spellbook API fails, local combos still display"
- [ ] "Loading state shown while spellbook request is pending"
- [ ] "Near combo missing card has distinct visual treatment"
- [ ] "Empty state when no combos found"

### Phase 11: Fixture Updates (`e2e/fixtures.ts`)

- [ ] Add mock `MOCK_SPELLBOOK_RESPONSE` constant with sample exact and near combos
- [ ] Add mock `MOCK_SPELLBOOK_EMPTY_RESPONSE` for empty state testing
- [ ] Add `waitForSynergySection()` enhancement if needed (already exists)
- [ ] Add `get verifiedCombosSection` locator

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/commander-spellbook.ts` | Create | API types, fetch function, normalization to internal types |
| `src/app/api/deck-combos/route.ts` | Create | POST endpoint proxying to Commander Spellbook API |
| `src/components/VerifiedCombos.tsx` | Create | Verified combos and near-combos display component |
| `src/components/DeckImportSection.tsx` | Modify | Add spellbook combo fetching alongside enrichment |
| `src/components/DeckViewTabs.tsx` | Modify | Thread spellbook props to SynergySection |
| `src/components/SynergySection.tsx` | Modify | Integrate VerifiedCombos above local combos |
| `src/components/SynergyStats.tsx` | Modify | Update combo count stat to prefer spellbook data |
| `src/lib/synergy-engine.ts` | Modify | Optional: accept spellbook combos, merge, deduplicate |
| `src/lib/types.ts` | Modify | Add `SpellbookCombo` type (or re-export from commander-spellbook.ts) |
| `tests/unit/commander-spellbook.spec.ts` | Create | Unit tests for request building and response normalization |
| `e2e/api-deck-combos.spec.ts` | Create | API route contract tests |
| `e2e/spellbook-combos.spec.ts` | Create | Browser E2E tests with mocked API |
| `e2e/fixtures.ts` | Modify | Add spellbook mock data and locator helpers |

---

## Edge Cases

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Commander Spellbook API down | Route returns `{ exactCombos: [], nearCombos: [], error: "..." }` with 200; UI falls back to local combos silently |
| Commander Spellbook API slow (>15s) | AbortSignal.timeout fires; same graceful fallback as API down |
| Deck has no combos in Spellbook | `exactCombos: []`, `nearCombos: []`; show "No verified combos found" message; local combos still display if any |
| Same combo in both Spellbook and local registry | Spellbook version displayed in "Verified Combos"; deduplicated from local section to avoid double-display |
| Very large deck (250 unique cards) | MAX_CARD_NAMES=250 guard in API route; Spellbook API accepts up to 600 cards |
| Commander not specified (text import) | `commanders` array empty in Spellbook request; API still works (returns combos without commander-specific filtering) |
| Spellbook returns combos with template requirements | Template name shown as italicized requirement text (e.g. "Requires: A creature with ETB effect") |
| Near combo has 3+ missing cards | Filter out: only show combos missing 1-2 cards (`almostIncluded` already handles this) |
| Variant with status "NW" (Not Working) | Filtered out during normalization; not displayed |
| Card names with special characters (apostrophes, commas) | URL-encoded in request body; Commander Spellbook handles canonical names |
| Network error during concurrent fetch (enrichment + spellbook) | Each has independent AbortController; one failing does not affect the other |
| Deck with only lands | Spellbook returns 0 combos; local registry returns 0; empty state shown |
| Rate limiting (429) | Caught in fetch error handler; returns graceful empty response |
| Paginated response (count > page size) | For v1, use only first page results; add note about pagination support in future |

## E2E User Scenarios

1. **Happy path with combos**: Import a deck containing Thassa's Oracle + Demonic Consultation -> Synergy tab -> "Verified Combos" section shows the combo with "Wins the game" in produces -> expand to see card images and zone requirements
2. **Near-combo discovery**: Import a deck with Dramatic Reversal but no Isochron Scepter -> "Almost There" section shows "Dramatic Reversal + Isochron Scepter" with "Missing: Isochron Scepter" highlighted in amber
3. **API failure fallback**: Commander Spellbook API unreachable -> Synergy tab shows local "Known Combos" section as before, no error visible to user, no "Verified Combos" section rendered
4. **No combos at all**: Import a deck with no combo pieces -> Synergy tab shows "No verified combos found" and local combo list is empty -> synergy pairs and themes still display normally
5. **Loading state**: Import deck -> switch to Synergy tab -> brief loading shimmer in "Verified Combos" area while Spellbook request is in flight -> combos appear when loaded
6. **Concurrent loading**: Import deck -> enrichment and spellbook requests fire simultaneously -> enrichment completes first, Synergy tab becomes available -> spellbook combos fill in when their request completes

## Verification

1. `npx playwright test --config playwright.unit.config.ts tests/unit/commander-spellbook.spec.ts` -- all normalization unit tests pass
2. `npx playwright test e2e/api-deck-combos.spec.ts` -- API contract tests pass
3. `npx playwright test e2e/spellbook-combos.spec.ts` -- browser E2E tests pass with mocked API
4. `npm test` -- full suite green, no regressions in existing synergy/combo tests
5. `npm run build` -- no TypeScript errors
6. Manual: import a Commander deck with known combos (e.g. Thoracle + Consultation) -> Synergy tab -> verify "Verified Combos" section shows spellbook results with proper card names, descriptions, and produces -> verify near-combos highlight missing cards -> disable network -> re-import -> verify fallback to local combos only
