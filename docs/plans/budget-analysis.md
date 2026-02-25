# Budget Analysis

## Context

Deck budgeting is one of the most common concerns for Commander players. Scryfall returns price data for every card (`prices.usd`, `prices.usd_foil`, `prices.eur`), but the deck evaluator currently discards this data during normalization. Players must manually look up card prices and tally totals to understand what their deck costs, where the money is concentrated, and which functional categories consume the most budget.

This feature adds **price capture to the enrichment pipeline** and a **Budget Analysis section** to the Analysis tab. The section shows total deck cost, per-card prices (visible in the expanded card detail and in a ranked table), a price distribution histogram, and a price-per-functional-category breakdown using the existing `generateTags()` infrastructure.

### Intended Outcome

After importing and enriching a deck, the Analysis tab includes a Budget Analysis section showing: (1) total deck cost as a headline stat, (2) average price per card, (3) the 10 most expensive cards in a ranked table, (4) a histogram showing how many cards fall into each price bucket, and (5) a breakdown of spending by functional category (Ramp, Removal, Card Draw, etc.). Per-card prices are also visible in the expanded detail of each card in the Deck List tab.

### Available Data

Scryfall returns a `prices` object on every card response:

```json
{
  "prices": {
    "usd": "0.25",
    "usd_foil": "1.50",
    "usd_etched": null,
    "eur": "0.20",
    "eur_foil": "1.10",
    "tix": "0.05"
  }
}
```

The `usd` field is the most commonly used and will be the primary price. Values are strings or `null` when unavailable. The normalization layer will parse these to `number | null`.

## Why

1. **High user demand** -- "How much does this deck cost?" is the first question after "What power level is it?" Every deck-building community discusses budget constraints.
2. **Low implementation cost** -- Price data is already returned by Scryfall in every API response. The only pipeline change is capturing one additional field during normalization.
3. **Leverages existing infrastructure** -- Functional category pricing reuses `generateTags()` from `card-tags.ts`. Chart patterns reuse `ChartContainer`, `Recharts`, and the stat card layout from `ManaBaseStats.tsx`.
4. **Differentiation** -- Moxfield shows per-card prices but not price-by-category breakdowns. Archidekt has limited budget tools. Automated price-by-functional-role analysis is novel.

## Dependencies

All dependencies are existing, shipped features:

| Dependency | Module | What It Provides |
|-----------|--------|------------------|
| Scryfall enrichment | `src/lib/scryfall.ts` | `normalizeToEnrichedCard()` and `ScryfallCard` interface -- will be extended |
| Types | `src/lib/types.ts` | `EnrichedCard`, `DeckData`, `DeckCard` -- `EnrichedCard` will gain `prices` field |
| Card tags | `src/lib/card-tags.ts` | `generateTags(card)` -- used to compute price per functional category |
| DeckAnalysis | `src/components/DeckAnalysis.tsx` | Analysis tab container where Budget Analysis section will be added |
| ChartContainer | `src/components/ChartContainer.tsx` | Responsive Recharts wrapper with `role="img"` and `aria-label` |
| Stat cards | `src/components/ManaBaseStats.tsx` | Layout pattern for headline stat pills |
| Score display | `src/components/LandBaseEfficiency.tsx` | Color-coded badges, `data-testid` patterns |
| EnrichedCardRow | `src/components/EnrichedCardRow.tsx` | Expanded card detail -- will show per-card price |
| Enrichment route | `src/app/api/deck-enrich/route.ts` | API route that calls `normalizeToEnrichedCard()` -- no changes needed (passthrough) |

**No dependencies on unbuilt features.** Can be built in parallel with all other planned features.

## Existing Patterns to Reuse

| Pattern | Source File | How It Applies |
|---------|-------------|----------------|
| Pure computation function signature | `src/lib/land-base-efficiency.ts` | `(deck: DeckData, cardMap: Record<string, EnrichedCard>) => BudgetAnalysisResult` |
| Stat card grid | `src/components/ManaBaseStats.tsx` | `grid grid-cols-3 gap-3` with `bg-slate-800/50 border-slate-700 rounded-lg` |
| Bar chart with tooltip | `src/components/ManaCurveChart.tsx` | Recharts `BarChart` + custom tooltip in slate theme |
| `ChartContainer` wrapper | `src/components/ChartContainer.tsx` | `ResponsiveContainer` with `role="img"` and `aria-label` |
| Section heading pattern | `src/components/DeckAnalysis.tsx` | `<section aria-labelledby>` with `text-sm font-semibold uppercase tracking-wide text-slate-300` |
| `makeCard()` / `makeDeck()` test helpers | `tests/unit/mana-curve.spec.ts` | Reuse in budget analysis unit tests -- now with `prices` field |
| Mock enrichment in E2E | `e2e/deck-analysis.spec.ts` | `MOCK_ANALYSIS_RESPONSE` with full `EnrichedCard` objects -- must add `prices` |
| `data-testid` conventions | `src/components/LandBaseEfficiency.tsx` | `data-testid="budget-total-cost"` etc. |
| Adding a new field to EnrichedCard | `producedMana` field addition (prior precedent) | Same pattern: add to interface, update `normalizeToEnrichedCard()`, update all test mocks |

---

## Implementation Tasks

### Phase 0: Type Extension and Mock Updates

This phase must be done first because every subsequent phase depends on the `prices` field existing on `EnrichedCard`.

- [ ] **0.1** Add `CardPrices` interface and `prices` field to `EnrichedCard` in `src/lib/types.ts`:

  ```typescript
  export interface CardPrices {
    usd: number | null;
    usdFoil: number | null;
    eur: number | null;
  }
  ```

  Add to `EnrichedCard`:

  ```typescript
  prices: CardPrices;
  ```

- [ ] **0.2** Add `prices` field to `ScryfallCard` interface in `src/lib/scryfall.ts`:

  ```typescript
  // Inside ScryfallCard interface:
  prices?: {
    usd: string | null;
    usd_foil: string | null;
    eur: string | null;
  };
  ```

- [ ] **0.3** Update `normalizeToEnrichedCard()` in `src/lib/scryfall.ts` to capture prices:

  ```typescript
  prices: {
    usd: card.prices?.usd ? parseFloat(card.prices.usd) : null,
    usdFoil: card.prices?.usd_foil ? parseFloat(card.prices.usd_foil) : null,
    eur: card.prices?.eur ? parseFloat(card.prices.eur) : null,
  },
  ```

- [ ] **0.4** Update `makeCard()` helper in **all unit test files** to include `prices: { usd: null, usdFoil: null, eur: null }`:
  - `tests/unit/mana-curve.spec.ts`
  - `tests/unit/card-tags.spec.ts`
  - `tests/unit/color-distribution.spec.ts`
  - `tests/unit/synergy-axes.spec.ts`
  - `tests/unit/synergy-engine.spec.ts`
  - `tests/unit/commander-validation.spec.ts`

- [ ] **0.5** Update `makeCard()` helper in `e2e/land-base-efficiency.spec.ts` to include `prices` default.

- [ ] **0.6** Update **all inline mock `EnrichedCard` objects** in E2E test files to include `prices: { usd: null, usdFoil: null, eur: null }`:
  - `e2e/deck-enrichment.spec.ts` -- `MOCK_ENRICH_RESPONSE` (2 card objects)
  - `e2e/deck-analysis.spec.ts` -- `MOCK_ANALYSIS_RESPONSE` (4 card objects) and `MOCK_COMMANDER_RESPONSE` (6 card objects)
  - `e2e/land-base-efficiency-ui.spec.ts` -- all mock card objects in `MOCK_LAND_EFFICIENCY_RESPONSE`
  - `e2e/synergy-ui.spec.ts` -- all mock card objects in `MOCK_SYNERGY_RESPONSE`

- [ ] **0.7** Run `npm test` to verify all existing tests still pass with the new `prices` field defaulting to nulls.

- [ ] **0.8** Update `e2e/api-deck-enrich.spec.ts` to assert that the enriched response includes a `prices` object with `usd`, `usdFoil`, and `eur` fields (values may be numbers or null depending on Scryfall data availability).

### Phase 1: Core Logic (`src/lib/budget-analysis.ts`)

- [ ] **1.1** Create `src/lib/budget-analysis.ts` with type definitions:

  ```typescript
  export interface CardPriceEntry {
    name: string;
    quantity: number;
    unitPrice: number | null;
    totalPrice: number | null;
  }

  export interface PriceDistributionBucket {
    label: string;
    min: number;
    max: number;
    count: number;
    totalQuantity: number;
  }

  export interface CategoryPriceSummary {
    tag: string;
    label: string;
    totalCost: number;
    cardCount: number;
    averagePrice: number;
    cards: CardPriceEntry[];
  }

  export interface BudgetAnalysisResult {
    totalCost: number;
    totalCostFormatted: string;
    averagePricePerCard: number;
    medianPricePerCard: number;
    cardCount: number;
    unknownPriceCount: number;
    mostExpensive: CardPriceEntry[];
    distribution: PriceDistributionBucket[];
    byCategory: CategoryPriceSummary[];
  }
  ```

- [ ] **1.2** Define price distribution bucket boundaries as a constant:

  ```typescript
  export const PRICE_BUCKETS = [
    { label: "$0 - $1",   min: 0,   max: 1 },
    { label: "$1 - $5",   min: 1,   max: 5 },
    { label: "$5 - $10",  min: 5,   max: 10 },
    { label: "$10 - $25", min: 10,  max: 25 },
    { label: "$25 - $50", min: 25,  max: 50 },
    { label: "$50+",      min: 50,  max: Infinity },
  ] as const;
  ```

- [ ] **1.3** Implement `buildCardPriceList(deck, cardMap): CardPriceEntry[]` -- iterates all deck sections (`commanders`, `mainboard`, `sideboard`), looks up `cardMap[card.name].prices.usd`, returns sorted by totalPrice descending.

- [ ] **1.4** Implement `computePriceDistribution(priceList): PriceDistributionBucket[]` -- assigns each card with a known price to the appropriate bucket. Uses unit price (not total). Cards with `null` price are excluded.

- [ ] **1.5** Implement `computePriceByCategory(deck, cardMap): CategoryPriceSummary[]` -- for each card, calls `generateTags()`, distributes the card's price across all matching tags. Also includes a "Lands" pseudo-category for land cards and an "Uncategorized" category for non-land cards with no tags. Sorted by `totalCost` descending.

- [ ] **1.6** Implement `computeMedianPrice(priceList): number` -- finds median of all unit prices where price is not null.

- [ ] **1.7** Implement `computeBudgetAnalysis(deck, cardMap): BudgetAnalysisResult` -- orchestrates all sub-functions.

- [ ] **1.8** Implement `formatUSD(amount: number): string` -- formats a number as `$X.XX` with proper rounding.

### Phase 2: Unit Tests (`tests/unit/budget-analysis.spec.ts`)

- [ ] **2.1** Create `tests/unit/budget-analysis.spec.ts` with `makeCard()` and `makeDeck()` helpers (including `prices` field)
- [ ] **2.2** Test `buildCardPriceList`: returns entries sorted by totalPrice descending; handles quantity multiplication; handles null prices
- [ ] **2.3** Test `computePriceDistribution`: correct bucket assignment for $0.25 (bucket 0-1), $3.50 (bucket 1-5), $50 (bucket 50+); empty list returns all-zero buckets
- [ ] **2.4** Test `computePriceByCategory`: card with "Ramp" tag appears in Ramp category; card with multiple tags appears in multiple categories; lands counted in "Lands" category; untagged cards in "Uncategorized"
- [ ] **2.5** Test `computeMedianPrice`: odd count returns middle value; even count returns average of middle two; all-null returns 0
- [ ] **2.6** Test `computeBudgetAnalysis` end-to-end: empty deck returns 0 cost; deck with 3 cards at known prices returns correct total and average; top 10 most expensive are in correct order
- [ ] **2.7** Test edge case: all cards have null prices -- total is 0, unknownPriceCount equals card count, distribution all zeros
- [ ] **2.8** Test edge case: mix of null and known prices -- total only sums known prices, unknownPriceCount is correct
- [ ] **2.9** Test edge case: single card -- total equals unit price * quantity, median equals unit price
- [ ] **2.10** Test `formatUSD`: 0 -> "$0.00", 1.5 -> "$1.50", 1234.99 -> "$1,234.99", negative -> "$0.00"
- [ ] **2.11** Test quantity multiplication: card with `quantity: 4` at $2.00 shows `totalPrice: 8.00` and contributes $8.00 to total cost
- [ ] **2.12** Test category price does not double-count quantity: a 4x Ramp card at $2 contributes $8 to Ramp total, not $2

### Phase 3: UI Components

#### 3a: BudgetStats (`src/components/BudgetStats.tsx`)

- [ ] **3.1** Create `"use client"` component with props `{ result: BudgetAnalysisResult }`
- [ ] **3.2** Render 3 stat cards in `grid grid-cols-3 gap-3` (same layout as `ManaBaseStats`):
  - **Total Cost**: `result.totalCostFormatted` with `data-testid="budget-total-cost"`
  - **Avg Price/Card**: formatted USD with `data-testid="budget-avg-price"`
  - **Median Price**: formatted USD with `data-testid="budget-median-price"`
- [ ] **3.3** Below stats, show a small info note if `unknownPriceCount > 0`: "N cards without price data" in `text-xs text-slate-400`

#### 3b: PriceDistributionChart (`src/components/PriceDistributionChart.tsx`)

- [ ] **3.4** Create `"use client"` component with props `{ data: PriceDistributionBucket[] }`
- [ ] **3.5** Render Recharts `BarChart` inside `ChartContainer` with `height={200}`:
  - X-axis: bucket labels ($0-1, $1-5, etc.)
  - Y-axis: count of cards
  - Bar fill: `#9333ea` (purple, matching mana curve)
  - Custom tooltip showing bucket label, card count, and total quantity
  - `aria-label="Price distribution bar chart"`
- [ ] **3.6** Style identically to `ManaCurveChart.tsx`: same grid stroke, axis tick colors, tooltip classes

#### 3c: TopExpensiveCardsTable (`src/components/TopExpensiveCardsTable.tsx`)

- [ ] **3.7** Create `"use client"` component with props `{ cards: CardPriceEntry[] }`
- [ ] **3.8** Render a `<table>` with columns: Rank (#), Card Name, Qty, Unit Price, Total
  - Use `table-auto` with `whitespace-nowrap` on numeric columns
  - Name column fills remaining space with `min-w-0`
  - Price columns right-aligned
  - `data-testid="budget-top-expensive"`
- [ ] **3.9** Alternate row shading: `even:bg-slate-800/30`, hover: `hover:bg-slate-700/30`
- [ ] **3.10** Cards with null price show "N/A" in gray text

#### 3d: PriceByCategoryChart (`src/components/PriceByCategoryChart.tsx`)

- [ ] **3.11** Create `"use client"` component with props `{ data: CategoryPriceSummary[] }`
- [ ] **3.12** Render a horizontal `BarChart` inside `ChartContainer` with `height={Math.max(200, data.length * 32)}`:
  - Y-axis: category labels (tag names)
  - X-axis: total cost in USD
  - Custom tooltip: category name, total cost, card count, average price
  - `aria-label="Price by functional category chart"`
- [ ] **3.13** Only render categories with `totalCost > 0`

### Phase 4: Per-Card Price in EnrichedCardRow

- [ ] **4.1** Update `EnrichedCardRow.tsx` to display the card's USD price in the expanded detail section:
  - Add a price span in the stats row (alongside P/T, Loyalty, Keywords, Rarity): `$X.XX` or "Price unavailable" if null
  - Format: `text-xs text-slate-400` with a subtle dollar sign accent
  - `data-testid="card-price"`
- [ ] **4.2** Ensure price does not appear when `prices.usd` is null (show nothing or "N/A")

### Phase 5: Integration into DeckAnalysis

- [ ] **5.1** Import `computeBudgetAnalysis` and all 4 Budget UI components in `src/components/DeckAnalysis.tsx`
- [ ] **5.2** Add `useMemo`:
  ```typescript
  const budgetAnalysis = useMemo(
    () => computeBudgetAnalysis(deck, cardMap),
    [deck, cardMap]
  );
  ```
- [ ] **5.3** Add Budget Analysis as the **last section** in the Analysis tab (after Land Base Efficiency):
  ```
  1. CommanderSection
  2. Mana Curve
  3. Color Distribution
  4. LandBaseEfficiency
  5. Budget Analysis (NEW)
  ```

### Phase 6: E2E Tests (extend `e2e/deck-analysis.spec.ts`)

- [ ] **6.1** Update `MOCK_ANALYSIS_RESPONSE` and `MOCK_COMMANDER_RESPONSE` to include realistic `prices` data:
  - Sol Ring: `{ usd: 1.50, usdFoil: 5.00, eur: 1.20 }`
  - Counterspell: `{ usd: 1.25, usdFoil: 3.00, eur: 1.00 }`
  - Cultivate: `{ usd: 0.50, usdFoil: 1.50, eur: 0.40 }`
  - Command Tower: `{ usd: 0.25, usdFoil: 2.00, eur: 0.20 }`

- [ ] **6.2** Test: "Budget Analysis heading visible on Analysis tab"
- [ ] **6.3** Test: "displays total deck cost stat card"
- [ ] **6.4** Test: "displays average price per card stat card"
- [ ] **6.5** Test: "displays median price stat card"
- [ ] **6.6** Test: "displays price distribution chart with accessible label"
- [ ] **6.7** Test: "displays top expensive cards table with correct ranking"
- [ ] **6.8** Test: "displays price by category breakdown"
- [ ] **6.9** Test: "section has proper ARIA structure"

- [ ] **6.10** Update `MOCK_SYNERGY_RESPONSE` in `e2e/synergy-ui.spec.ts` with `prices` fields
- [ ] **6.11** Update `MOCK_LAND_EFFICIENCY_RESPONSE` in `e2e/land-base-efficiency-ui.spec.ts` with `prices` fields
- [ ] **6.12** Update `MOCK_ENRICH_RESPONSE` in `e2e/deck-enrichment.spec.ts` with `prices` fields

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/types.ts` | Modify | Add `CardPrices` interface and `prices` field to `EnrichedCard` |
| `src/lib/scryfall.ts` | Modify | Add `prices` to `ScryfallCard` interface; update `normalizeToEnrichedCard()` to parse prices |
| `src/lib/budget-analysis.ts` | Create | Price computation: totals, distribution, top expensive, price-by-category |
| `src/components/BudgetStats.tsx` | Create | Stat cards: total cost, avg price, median price |
| `src/components/PriceDistributionChart.tsx` | Create | Recharts bar chart of price buckets |
| `src/components/TopExpensiveCardsTable.tsx` | Create | Ranked table of most expensive cards |
| `src/components/PriceByCategoryChart.tsx` | Create | Horizontal bar chart of spending by functional category |
| `src/components/EnrichedCardRow.tsx` | Modify | Show per-card USD price in expanded detail |
| `src/components/DeckAnalysis.tsx` | Modify | Import budget components, add Budget Analysis section |
| `tests/unit/budget-analysis.spec.ts` | Create | Unit tests for all budget computation functions |
| `tests/unit/mana-curve.spec.ts` | Modify | Add `prices` to `makeCard()` default |
| `tests/unit/card-tags.spec.ts` | Modify | Add `prices` to `makeCard()` default |
| `tests/unit/color-distribution.spec.ts` | Modify | Add `prices` to `makeCard()` default |
| `tests/unit/synergy-axes.spec.ts` | Modify | Add `prices` to `mockCard()` default |
| `tests/unit/synergy-engine.spec.ts` | Modify | Add `prices` to `mockCard()` default |
| `tests/unit/commander-validation.spec.ts` | Modify | Add `prices` to `makeCard()` default |
| `e2e/land-base-efficiency.spec.ts` | Modify | Add `prices` to `makeCard()` default |
| `e2e/deck-enrichment.spec.ts` | Modify | Add `prices` to `MOCK_ENRICH_RESPONSE` card objects |
| `e2e/deck-analysis.spec.ts` | Modify | Add `prices` to all mock card objects + budget E2E tests |
| `e2e/land-base-efficiency-ui.spec.ts` | Modify | Add `prices` to `MOCK_LAND_EFFICIENCY_RESPONSE` card objects |
| `e2e/synergy-ui.spec.ts` | Modify | Add `prices` to `MOCK_SYNERGY_RESPONSE` card objects |
| `e2e/api-deck-enrich.spec.ts` | Modify | Assert `prices` field in enrichment response |

---

## Edge Cases

| Edge Case | Expected Behavior |
|-----------|------------------|
| All cards have `prices.usd: null` (e.g., tokens, custom cards) | Total cost $0.00, `unknownPriceCount` equals card count, distribution all zeros, stat cards show "$0.00" |
| Mix of priced and unpriced cards | Total sums only known prices; unknown count shown as info note; distribution excludes unpriced |
| Card with `prices.usd: "0"` (free promos) | Parsed as `0.00`, falls into $0-1 bucket, contributes $0 to total |
| Very expensive card ($500+) | Falls into $50+ bucket; total correctly accumulates; no overflow |
| Quantity > 1 (e.g., 4x Lightning Bolt) | `totalPrice = unitPrice * quantity`; total deck cost reflects all copies; distribution uses unit price for bucket assignment |
| Empty deck (0 cards in cardMap) | All totals $0, empty top-10 list, all-zero distribution, no categories |
| Cards not found in cardMap | Silently skipped; no crash |
| Invalid price string from Scryfall (e.g., "N/A") | `parseFloat` returns `NaN`; treat as `null` |
| Single card deck | Total = unit price * qty; median = unit price; average = unit price |
| Category price overlap (card tagged Ramp + Card Draw) | Card's price counted in BOTH categories; categories are NOT mutually exclusive |
| Lands (no tags from `generateTags()`) | Counted in "Lands" pseudo-category, not "Uncategorized" |
| Negative price from `parseFloat` (shouldn't happen) | Clamp to 0 or treat as null |
| Price with many decimal places | Round to 2 decimal places in `formatUSD` |

## E2E User Scenarios

1. **Basic flow**: User pastes 4-card decklist -> Import -> enrichment with mocked prices -> Analysis tab -> Budget Analysis section shows total cost = sum of 4 card prices, stat cards visible, distribution chart renders, top expensive table shows cards ranked by price
2. **Real enrichment flow**: User imports a Commander deck -> Scryfall returns real prices -> Analysis tab shows actual market pricing -> most expensive cards are correctly identified (e.g., Mana Crypt, dual lands at the top)
3. **Category breakdown insight**: User sees "Ramp: $45.00 (10 cards)" and "Removal: $12.00 (8 cards)" -> understands their ramp package is expensive relative to interaction -> can target budget cuts in ramp
4. **Per-card price in Deck List**: User clicks expand chevron on a card in Deck List tab -> sees "$2.50" in the detail row alongside P/T and keywords
5. **All null prices**: User imports a deck with custom/unofficial cards -> Budget shows "$0.00" total with "N cards without price data" info note -> graceful degradation, no errors
6. **Tab persistence**: User views Budget Analysis -> switches to Deck List -> back to Analysis -> budget data still rendered correctly (useMemo cache)

## Verification

1. `npx playwright test --config playwright.unit.config.ts tests/unit/budget-analysis.spec.ts` -- all unit tests pass
2. `npx playwright test e2e/deck-analysis.spec.ts` -- all E2E tests pass (existing + new budget tests)
3. `npm test` -- full suite green (all existing tests updated with `prices` field still pass)
4. `npm run build` -- no TypeScript errors
5. Manual: import a Commander deck with real Scryfall enrichment -> Analysis tab -> Budget Analysis section visible -> total cost is reasonable -> top expensive cards match known expensive staples -> price distribution histogram renders correctly -> category breakdown sums are consistent with total
