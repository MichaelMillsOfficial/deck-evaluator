# Deck Comparison

## Context

Commander players frequently want to compare two decklists to understand how they differ -- whether comparing an updated version against the original, evaluating two decks in the same archetype, or analyzing a friend's build against their own. Currently, the app supports importing and analyzing a single deck at a time. Players must mentally track differences by switching between two browser tabs, which is error-prone for 100-card singleton decks.

This feature adds a dedicated `/compare` page with a two-column side-by-side layout. Each column contains an independent deck import slot. Once both decks are imported and enriched, the page computes and displays: card overlap (Venn-diagram counts), metric differences (mana curve, color distribution, land base efficiency), tag composition comparison, and unique-to-each-deck card lists. All analysis reuses the existing pure computation modules, called once per deck.

### Intended Outcome

After navigating to `/compare`, players import two decks (one per column). The page automatically computes the comparison once both decks are enriched. Players immediately see which cards are shared, which are unique to each deck, and how key metrics differ -- all in a single, scrollable view. This eliminates the manual process of cross-referencing two separate analyses.

## Why

1. **High user demand** -- Deck comparison is one of the most common requests in Commander deckbuilding communities. EDHREC offers comparison but only against aggregate "average" decks, not user-to-user comparison.
2. **Leverages existing infrastructure** -- All analysis modules (`computeManaCurve`, `computeColorDistribution`, `computeManaBaseMetrics`, `computeLandBaseEfficiency`, `generateTags`) are pure functions that accept `(deck, cardMap)`. Calling them twice requires zero refactoring.
3. **Isolated architecture** -- A separate `/compare` route avoids state-lifting complexity in the existing single-deck page. The `DeckImportSection` component already encapsulates all import + enrichment state; a lighter-weight variant can be extracted for the comparison slots.
4. **Independent deliverable** -- No dependencies on unbuilt features. Ships with the currently implemented analysis modules.

## Dependencies

**Existing code this builds on:**

| Dependency | Module | What It Provides |
|-----------|--------|------------------|
| Deck types | `src/lib/types.ts` | `DeckData`, `DeckCard`, `EnrichedCard` |
| Mana curve | `src/lib/mana-curve.ts` | `computeManaCurve()`, `ManaCurveBucket` |
| Color distribution | `src/lib/color-distribution.ts` | `computeColorDistribution()`, `computeManaBaseMetrics()`, `resolveCommanderIdentity()` |
| Land base efficiency | `src/lib/land-base-efficiency.ts` | `computeLandBaseEfficiency()`, `LandBaseEfficiencyResult` |
| Card tags | `src/lib/card-tags.ts` | `generateTags()`, `TAG_COLORS` |
| Synergy engine | `src/lib/synergy-engine.ts` | `analyzeDeckSynergy()` (optional, can include synergy theme comparison) |
| Deck import UI | `src/components/DeckInput.tsx` | Tab-based import form |
| Enrichment flow | `src/components/DeckImportSection.tsx` | Pattern for `handleImport` + `enrichDeck` + state management |
| Chart components | `src/components/ManaCurveChart.tsx`, `ColorDistributionChart.tsx` | Recharts chart patterns, `ChartContainer` wrapper |
| API routes | `src/app/api/deck-parse/route.ts`, `src/app/api/deck-enrich/route.ts` | Parsing and enrichment endpoints (reused as-is) |

**No dependencies on unbuilt features.** Works better with more analysis modules (Deck Composition Scorecard, Power Level Estimator) if they exist at build time, but none are required.

## Existing Patterns to Reuse

| Pattern | Source File | How It Applies |
|---------|-------------|----------------|
| Pure computation function signature | `src/lib/land-base-efficiency.ts` | `(deck: DeckData, cardMap: Record<string, EnrichedCard>) => Result` |
| `makeCard()` / `makeDeck()` test helpers | `tests/unit/mana-curve.spec.ts` | Reuse in unit tests for comparison logic |
| Container component with import state | `src/components/DeckImportSection.tsx` | Pattern for `handleImport`, `enrichDeck`, abort controller, loading/error states |
| Section heading + subtitle + content | `src/components/DeckAnalysis.tsx` | `<section aria-labelledby>` with uppercase tracking-wide h3 |
| Score color functions | `src/components/LandBaseEfficiency.tsx` | `getScoreColor()`, `getBadgeClasses()`, `getBarColor()` for metric difference display |
| Chart with `ChartContainer` wrapper | `src/components/ManaCurveChart.tsx` | Recharts `BarChart` inside `ResponsiveContainer` with `role="img"` and `aria-label` |
| Stacked bar chart with custom tooltip | `src/components/ManaCurveChart.tsx` | Grouped/overlaid bar patterns for overlay chart |
| Mock enrichment in e2e tests | `e2e/deck-analysis.spec.ts` | `MOCK_ANALYSIS_RESPONSE` / `MOCK_COMMANDER_RESPONSE` patterns |
| Page-object fixture | `e2e/fixtures.ts` | `DeckPage` class pattern; create `ComparePage` equivalent |
| `data-testid` attributes | `src/components/LandBaseEfficiency.tsx` | Test hook naming conventions |
| Dark theme card panel | `src/components/DeckInput.tsx` | `bg-slate-800/50 border-slate-700 rounded-xl p-6` |
| Nav link styling | `src/app/layout.tsx` | Purple accent links, `focus-visible:ring-2 focus-visible:ring-purple-400` |

---

## Implementation Tasks

### Phase 1: Core Comparison Logic (`src/lib/deck-comparison.ts`)

- [ ] **1.1** Create `src/lib/deck-comparison.ts` with type definitions:

  ```typescript
  export interface CardOverlap {
    shared: { name: string; quantityA: number; quantityB: number }[];
    uniqueToA: { name: string; quantity: number }[];
    uniqueToB: { name: string; quantity: number }[];
    sharedCount: number;
    uniqueToACount: number;
    uniqueToBCount: number;
    overlapPercentage: number;
  }

  export interface MetricDiff {
    label: string;
    valueA: number;
    valueB: number;
    diff: number;
    diffLabel: string;
    unit?: string;
  }

  export interface TagComparison {
    tag: string;
    countA: number;
    countB: number;
    diff: number;
  }

  export interface ManaCurveOverlayBucket {
    cmc: string;
    totalA: number;
    totalB: number;
  }

  export interface DeckComparisonResult {
    cardOverlap: CardOverlap;
    metricDiffs: MetricDiff[];
    tagComparison: TagComparison[];
    curveOverlay: ManaCurveOverlayBucket[];
  }
  ```

- [ ] **1.2** Implement `computeCardOverlap(deckA, deckB): CardOverlap`:
  1. Collect all card names from each deck: `[...deck.commanders, ...deck.mainboard, ...deck.sideboard]`.
  2. Build `Map<string, number>` for each deck mapping card name to total quantity.
  3. Compute the union of all card names across both decks.
  4. For each name in the union: if present in both maps, add to `shared`; if only in A, add to `uniqueToA`; if only in B, add to `uniqueToB`.
  5. `overlapPercentage = (shared.length / unionSize) * 100`.
  6. Sort each list alphabetically by card name.

- [ ] **1.3** Implement `computeMetricDiffs(deckA, cardMapA, deckB, cardMapB): MetricDiff[]`:
  1. Compute `computeManaBaseMetrics(deck, cardMap)` for both decks.
  2. Compute `computeLandBaseEfficiency(deck, cardMap)` for both decks.
  3. Build `MetricDiff[]` for: land count, land percentage, average CMC, land base efficiency overall score.
  4. For each metric, `diff = valueB - valueA`; format `diffLabel` with sign prefix.

- [ ] **1.4** Implement `computeTagComparison(deckA, cardMapA, deckB, cardMapB): TagComparison[]`:
  1. For each deck, iterate all cards, call `generateTags()` on each enriched card, accumulate counts per tag (multiply by `card.quantity`).
  2. Build union of all tags found across both decks.
  3. For each tag, produce `{ tag, countA, countB, diff: countB - countA }`.
  4. Sort by `Math.abs(diff)` descending, then alphabetically for ties.

- [ ] **1.5** Implement `computeCurveOverlay(deckA, cardMapA, deckB, cardMapB): ManaCurveOverlayBucket[]`:
  1. Call `computeManaCurve(deck, cardMap)` for both decks.
  2. Merge into `ManaCurveOverlayBucket[]` for each CMC bucket.

- [ ] **1.6** Implement `computeDeckComparison()` -- orchestrator calling 1.2 through 1.5.

### Phase 2: Unit Tests (`tests/unit/deck-comparison.spec.ts`)

- [ ] **2.1** Create `tests/unit/deck-comparison.spec.ts` with `makeCard()` and `makeDeck()` helpers
- [ ] **2.2** Test `computeCardOverlap`: identical decks -> all shared, 0 unique, 100% overlap
- [ ] **2.3** Test `computeCardOverlap`: completely different decks -> 0 shared, all unique to each, 0% overlap
- [ ] **2.4** Test `computeCardOverlap`: partial overlap -> correct shared/unique counts and percentage
- [ ] **2.5** Test `computeCardOverlap`: cards with different quantities in each deck -> shared list includes both quantities
- [ ] **2.6** Test `computeCardOverlap`: empty deck A -> all cards unique to B
- [ ] **2.7** Test `computeCardOverlap`: both decks empty -> 0 shared, 0 unique, 0% overlap (no division by zero)
- [ ] **2.8** Test `computeCardOverlap`: cards spread across commanders/mainboard/sideboard are all considered
- [ ] **2.9** Test `computeMetricDiffs`: two decks with known metrics -> correct diff values and labels
- [ ] **2.10** Test `computeMetricDiffs`: identical decks -> all diffs are 0
- [ ] **2.11** Test `computeTagComparison`: deck A heavy on ramp, deck B heavy on removal -> correct counts and diffs
- [ ] **2.12** Test `computeTagComparison`: cards not in cardMap skipped gracefully
- [ ] **2.13** Test `computeCurveOverlay`: two decks with known curve shapes -> correct bucket totals
- [ ] **2.14** Test `computeCurveOverlay`: empty decks -> all buckets 0
- [ ] **2.15** Test `computeDeckComparison`: integration test verifying all sub-results are populated

### Phase 3: Compare Import Slot Component (`src/components/CompareImportSlot.tsx`)

- [ ] **3.1** Create `"use client"` component that encapsulates one deck's import + enrichment state
- [ ] **3.2** Internally manages: `deckData`, `cardMap`, `loading`, `enrichLoading`, `error`, `enrichError`
- [ ] **3.3** Renders a `DeckInput` component (reuse existing) for the import form
- [ ] **3.4** On successful import + enrichment, calls `onDeckReady(deck, cardMap)` to notify parent
- [ ] **3.5** Includes a "Clear" button that resets state and calls `onDeckCleared()`
- [ ] **3.6** Shows a condensed deck summary when imported: deck name, card count, source badge
- [ ] **3.7** Style: `bg-slate-800/50 border-slate-700 rounded-xl p-4`, with slot label as a heading
- [ ] **3.8** Add `data-testid="compare-slot-a"` / `data-testid="compare-slot-b"` for test hooks

### Phase 4: Comparison Results Components

#### 4A: Comparison Overview (`src/components/ComparisonOverview.tsx`)

- [ ] **4A.1** Create component receiving `CardOverlap` as props
- [ ] **4A.2** Display Venn-diagram-style summary: three stat cards showing "Shared (N)", "Only in Deck A (N)", "Only in Deck B (N)"
- [ ] **4A.3** Display overlap percentage with a progress bar (`role="progressbar"`)
- [ ] **4A.4** Three expandable lists: shared cards, unique to A, unique to B
- [ ] **4A.5** Add `data-testid` attributes: `comparison-overview`, `shared-count`, `unique-a-count`, `unique-b-count`

#### 4B: Metric Comparison Table (`src/components/MetricComparisonTable.tsx`)

- [ ] **4B.1** Create component receiving `MetricDiff[]` as props
- [ ] **4B.2** Render a table with columns: Metric, Deck A, Deck B, Difference
- [ ] **4B.3** Color-code difference column: green for improvements, red for regressions, neutral for no change
- [ ] **4B.4** Style: `table-auto w-full`, dark theme rows
- [ ] **4B.5** Add `data-testid="metric-comparison-table"`, `data-testid="metric-row"` per row

#### 4C: Mana Curve Overlay Chart (`src/components/ManaCurveOverlay.tsx`)

- [ ] **4C.1** Create component receiving `ManaCurveOverlayBucket[]` and deck labels as props
- [ ] **4C.2** Render a grouped `BarChart` (not stacked) with two bars per CMC bucket: one for Deck A (purple), one for Deck B (cyan/teal)
- [ ] **4C.3** Use `ChartContainer` wrapper with appropriate `ariaLabel`
- [ ] **4C.4** Custom tooltip showing both deck values per bucket
- [ ] **4C.5** Legend with deck labels and color swatches
- [ ] **4C.6** Respect `prefers-reduced-motion` for animation
- [ ] **4C.7** Add `data-testid="mana-curve-overlay"`

#### 4D: Tag Comparison Chart (`src/components/TagComparisonChart.tsx`)

- [ ] **4D.1** Create component receiving `TagComparison[]` and deck labels as props
- [ ] **4D.2** Render a horizontal grouped `BarChart` with two bars per tag
- [ ] **4D.3** Use `ChartContainer` wrapper, custom tooltip showing both counts
- [ ] **4D.4** Legend with deck labels
- [ ] **4D.5** Add `data-testid="tag-comparison-chart"`

### Phase 5: Compare Page (`src/app/compare/page.tsx`)

- [ ] **5.1** Create `src/app/compare/page.tsx` as a server component wrapper with metadata
- [ ] **5.2** Create `src/app/compare/ComparePageClient.tsx` as `"use client"` component with state for both decks
- [ ] **5.3** Two-column layout using CSS grid: `grid grid-cols-1 lg:grid-cols-2 gap-6`
- [ ] **5.4** When both decks are non-null, compute comparison via `useMemo`
- [ ] **5.5** Render comparison results below the import columns in a full-width section
- [ ] **5.6** When only one deck is imported, show a prompt: "Import a second deck to see comparison"
- [ ] **5.7** When neither deck is imported, show introductory text explaining the feature
- [ ] **5.8** Page heading: "Compare Decks" with subtitle
- [ ] **5.9** Add `data-testid="compare-page"`, `data-testid="comparison-results"`

### Phase 6: Navigation

- [ ] **6.1** Add "Compare Decks" link in the nav bar in `src/app/layout.tsx`
- [ ] **6.2** Add a link card in the features section of `src/app/page.tsx`
- [ ] **6.3** Ensure the nav link has proper focus styles and `aria-current="page"` when on `/compare`

### Phase 7: E2E Tests (`e2e/deck-comparison.spec.ts`)

- [ ] **7.1** Create `ComparePage` page-object class in `e2e/compare-fixtures.ts`
- [ ] **7.2** Create `e2e/deck-comparison.spec.ts` with mock enrichment routes for two different decks
- [ ] **7.3** Test: "Compare page loads with two empty import slots"
- [ ] **7.4** Test: "Importing one deck shows 'Import a second deck' prompt"
- [ ] **7.5** Test: "Importing two decks shows comparison results"
- [ ] **7.6** Test: "Card overlap section shows shared and unique counts"
- [ ] **7.7** Test: "Metric comparison table shows land count, avg CMC, efficiency score"
- [ ] **7.8** Test: "Mana curve overlay chart is visible with both deck labels"
- [ ] **7.9** Test: "Tag comparison chart is visible"
- [ ] **7.10** Test: "Clearing one deck hides comparison results"
- [ ] **7.11** Test: "Navigation link to compare page visible in nav bar"
- [ ] **7.12** Test: "Compare page has proper heading and page title"
- [ ] **7.13** Test: "Comparison results sections have proper ARIA structure"

### Phase 8: Polish and Accessibility

- [ ] **8.1** Ensure all comparison sections use `<section aria-labelledby>` pattern
- [ ] **8.2** Ensure deck labels default to deck name from import when available
- [ ] **8.3** Add screen reader announcement when comparison results appear
- [ ] **8.4** Ensure responsive layout: stacks vertically on mobile, side-by-side on desktop
- [ ] **8.5** Ensure `motion-reduce:transition-none` on all animations
- [ ] **8.6** Test keyboard navigation through all expandable sections

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/deck-comparison.ts` | Create | Core comparison logic: overlap, metric diffs, tag comparison, curve overlay |
| `src/app/compare/page.tsx` | Create | Server component with metadata for `/compare` route |
| `src/app/compare/ComparePageClient.tsx` | Create | Client component managing two deck states and comparison computation |
| `src/components/CompareImportSlot.tsx` | Create | Self-contained deck import + enrichment slot for comparison |
| `src/components/ComparisonOverview.tsx` | Create | Card overlap display: shared/unique counts, expandable lists |
| `src/components/MetricComparisonTable.tsx` | Create | Side-by-side metric diff table |
| `src/components/ManaCurveOverlay.tsx` | Create | Grouped bar chart overlaying both decks' mana curves |
| `src/components/TagComparisonChart.tsx` | Create | Grouped bar chart comparing functional tag counts |
| `src/app/layout.tsx` | Modify | Add "Compare Decks" nav link |
| `src/app/page.tsx` | Modify | Add comparison link card in features section |
| `tests/unit/deck-comparison.spec.ts` | Create | Unit tests for all comparison logic functions |
| `e2e/compare-fixtures.ts` | Create | `ComparePage` page-object class |
| `e2e/deck-comparison.spec.ts` | Create | E2E tests for comparison page UI |

No changes to: `package.json`, `src/lib/types.ts`, existing analysis modules, existing API routes, `DeckImportSection.tsx`, `DeckViewTabs.tsx`, `next.config.ts`.

---

## Edge Cases

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Both decks empty (0 cards) | All overlap counts 0, percentage 0% (no division by zero), metric diffs all 0 |
| Identical decks imported twice | 100% overlap, all cards shared, 0 unique, all metric diffs are 0 |
| One deck has 100 cards, other has 10 | Overlap computed correctly; unique-to-A will be large; metrics still valid |
| Cards in cardMap missing for one deck | Comparison still computed for overlapping enriched cards; metrics show best-effort values |
| Same card name in different zones (commander in A, mainboard in B) | Still counted as "shared" -- zone membership does not affect overlap |
| Card with quantity > 1 in one deck, quantity 1 in other | Appears in shared list with both quantities shown |
| Deck with no enrichment yet (cardMap is null) | Comparison not computed; prompt to wait for enrichment |
| Only one deck imported | No comparison shown; "Import a second deck" prompt displayed |
| User clears one deck after comparison was shown | Comparison results hidden; reverts to single-deck prompt |
| Network error during enrichment of one deck | That slot shows enrichment error; comparison cannot proceed until both enriched |
| Very large decks (200+ cards each) | Computation is O(n) per function; no performance concern |
| Decks with no tags at all (all vanilla creatures) | Tag comparison shows empty or zero-count rows |
| Both decks have same name | Display distinguishes via "Deck A" / "Deck B" labels regardless |
| Commander in deck A, no commander in deck B | Overlap still works; commander identity for color distribution computed per-deck |

## E2E User Scenarios

1. **Basic comparison flow**: User navigates to `/compare` via nav link -> imports Deck A (pasted list) -> imports Deck B (pasted list) -> both enriched -> comparison results appear showing overlap, metrics, curve overlay, and tag chart
2. **Identical decks**: User imports the same decklist in both slots -> 100% overlap -> all metrics identical -> curve overlay bars perfectly aligned -> tag counts identical
3. **Sequential import**: User imports Deck A first -> sees "Import a second deck" message -> imports Deck B -> comparison appears
4. **Clear and re-import**: User sees comparison -> clears Deck A -> comparison disappears -> imports new Deck A -> comparison recalculates
5. **Card overlap drill-down**: User sees "15 shared cards" -> expands shared cards list -> sees card names -> expands unique-to-A -> sees what A has that B does not
6. **Mobile responsive**: User views on small screen -> slots stack vertically -> comparison results display full-width below
7. **Navigation**: User on home page -> clicks "Compare Decks" in nav -> lands on compare page -> imports decks -> clicks logo to return home -> existing single-deck page still works independently

## Verification

1. `npx playwright test --config playwright.unit.config.ts tests/unit/deck-comparison.spec.ts` -- all unit tests pass
2. `npx playwright test --config playwright.config.ts e2e/deck-comparison.spec.ts` -- all E2E tests pass
3. `npm test` -- full suite green (no regressions)
4. `npm run build` -- no TypeScript errors
5. `npm run lint` -- no lint errors
6. Manual: navigate to `/compare` -> import two different Commander decks -> verify overlap counts are correct by spot-checking -> verify mana curve overlay shows both decks -> verify tag comparison chart reflects actual tag differences -> verify clearing one deck hides results -> verify mobile layout stacks properly -> verify nav link active state on `/compare`
