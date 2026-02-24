# Color Distribution Analysis

## Context

The Analysis tab currently shows only a mana curve chart. Players need to understand whether their mana base is balanced — i.e., whether the lands and mana producers in their deck can actually support the colored mana demands of their spells. This plan adds a **Color Distribution** section below the mana curve that shows mana source counts per color, pip demand per color, and key mana base efficiency metrics. A critical prerequisite is capturing Scryfall's `produced_mana` field, which we currently discard during enrichment.

Commander-identity-aware cards (Command Tower, Exotic Orchard, etc.) will be scoped to the commander's actual color identity rather than naively counting all 5 colors.

---

## Implementation Tasks

### 1. Add `produced_mana` to Scryfall and EnrichedCard types

- [x] Add `produced_mana?: string[]` to `ScryfallCard` and `ScryfallCardFace` in `src/lib/scryfall.ts`
- [x] Add `producedMana: string[]` to `EnrichedCard` in `src/lib/types.ts`
- [x] Map `produced_mana` in `normalizeToEnrichedCard()` in `src/lib/scryfall.ts`:
  ```typescript
  producedMana: card.produced_mana ?? frontFace?.produced_mana ?? [],
  ```

### 2. Update existing test mocks with `producedMana`

Adding a required field to `EnrichedCard` will break any test that constructs mock cards. Add `producedMana: []` (or appropriate values) to mock card objects in:

- [x] `e2e/mana-curve.spec.ts` — `makeCard()` helper
- [x] `e2e/deck-analysis.spec.ts` — mock enrichment response
- [x] `e2e/deck-enrichment.spec.ts` — mock enriched cards (if applicable)
- [x] `e2e/card-tags.spec.ts` — mock enriched cards (if applicable)
- [x] Verify `npm run build` and `npm test` still pass after type changes

### 3. Write color distribution utility tests — `e2e/color-distribution.spec.ts`

Pure function tests (direct import, `@playwright/test`, no browser). Follow `e2e/mana-curve.spec.ts` pattern.

**`computeColorDistribution()` tests:**
- [x] Returns zero counts for all 5 colors when cardMap is empty
- [x] Counts basic lands correctly (Forest → G source, Island → U source)
- [x] Counts dual lands producing multiple colors (Hallowed Fountain → W + U)
- [x] Counts non-land mana producers (Birds of Paradise, Sol Ring)
- [x] Multiplies `DeckCard.quantity` into source counts
- [x] Skips cards not found in cardMap
- [x] Commander identity scoping: a card with `producedMana: ["W","U","B","R","G"]` in a W/U commander deck counts only as W + U source
- [x] Colorless sources tracked separately (Sol Ring with `producedMana: ["C"]`)

**`computePipDemand()` tests:**
- [x] Returns zero counts when deck is empty
- [x] Sums `manaPips` correctly across all cards
- [x] Multiplies by `DeckCard.quantity`
- [x] Includes commanders, mainboard, and sideboard

**`computeManaBaseMetrics()` tests:**
- [x] Returns land count, total cards, land percentage
- [x] Returns average CMC of non-land cards (1 decimal)
- [x] Returns per-color source-to-demand ratio
- [x] Handles zero-demand colors gracefully (ratio = Infinity or null)
- [x] Returns colorless source count

### 4. Implement color distribution utility — `src/lib/color-distribution.ts`

```typescript
export const MTG_COLORS = ["W", "U", "B", "R", "G"] as const;
export type MtgColor = (typeof MTG_COLORS)[number];

export interface ColorCounts {
  W: number; U: number; B: number; R: number; G: number;
}

export interface ColorDistribution {
  sources: ColorCounts;       // cards that produce each color
  pips: ColorCounts;          // total pip demand per color
  colorlessSources: number;   // cards producing only colorless
}

export interface ManaBaseMetrics {
  landCount: number;
  totalCards: number;
  landPercentage: number;
  averageCmc: number;
  colorlessSources: number;
  sourceToDemandRatio: ColorCounts;  // sources[c] / pips[c]
}
```

- [x] `resolveCommanderIdentity(deck, cardMap)` — returns `Set<MtgColor>` from the union of all commanders' `colorIdentity`
- [x] `computeColorDistribution(deck, cardMap)` — iterates all cards, counts sources (using `producedMana` scoped to commander identity for 5-color producers) and pip demand
- [x] `computeManaBaseMetrics(deck, cardMap, distribution)` — derives land count, avg CMC, land ratio, per-color source-to-demand ratio
- [x] Logic for commander identity scoping: if a card's `producedMana` contains all 5 colors AND commanders exist, filter to commander identity colors. Cards that produce a fixed subset (e.g., a Simic dual land) are counted as-is regardless of commander identity.

### 5. Write E2E tests for color distribution UI — extend `e2e/deck-analysis.spec.ts`

Add `test.describe("Deck Analysis — Color Distribution")` block with enriched mock data including `producedMana` on each card.

- [x] "Color Distribution" heading visible on Analysis tab
- [x] Chart has `role="img"` with accessible label
- [x] Stat pills visible: land count, average CMC, colorless sources
- [x] Each color shows source count and pip count

### 6. Create `ColorDistributionChart` component — `src/components/ColorDistributionChart.tsx`

Grouped bar chart (Recharts `BarChart`) — one group per color, two bars per group:
- **Sources** bar: how many cards produce that color
- **Demand** bar: total pips of that color in mana costs

- [x] Uses `ChartContainer` wrapper with `ariaLabel`
- [x] MTG color scheme: W=`#F9D75E`, U=`#0E68AB`, B=`#6B7280`, R=`#D32029`, G=`#00733E`
- [x] X-axis labels: full color names (White, Blue, Black, Red, Green)
- [x] Legend distinguishing Sources vs Demand
- [x] Dark tooltip matching existing style (`bg-slate-800 border-slate-600`)
- [x] Respects `prefers-reduced-motion`

### 7. Create `ManaBaseStats` component — `src/components/ManaBaseStats.tsx`

Row of stat cards displayed above the chart:

- [x] **Lands**: `{landCount} / {totalCards} ({landPercentage}%)`
- [x] **Avg CMC**: formatted to 1 decimal
- [x] **Colorless Sources**: count of C-only producers
- [x] Styling: `bg-slate-800/50 border border-slate-700 rounded-lg` grid, `data-testid` attributes for testing

### 8. Update `DeckAnalysis.tsx` — add color distribution section

- [x] Import and call `computeColorDistribution()` and `computeManaBaseMetrics()` wrapped in `useMemo`
- [x] Add new `<section aria-labelledby="color-distribution-heading">` below mana curve
- [x] Render heading "Color Distribution", subtitle, `<ManaBaseStats>`, and `<ColorDistributionChart>`

### 9. Verify

- [x] `npx playwright test e2e/color-distribution.spec.ts` — utility tests pass
- [x] `npx playwright test e2e/deck-analysis.spec.ts` — E2E tests pass
- [x] `npm test` — full suite green (181 passed)
- [x] `npm run build` — no TypeScript errors
- [x] Visual: import a deck, switch to Analysis, see mana curve + color distribution chart with source/demand bars and stat pills

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/types.ts` | Modify | Add `producedMana: string[]` to `EnrichedCard` |
| `src/lib/scryfall.ts` | Modify | Add `produced_mana` to `ScryfallCard`/`ScryfallCardFace`; map in normalizer |
| `src/lib/color-distribution.ts` | Create | Core computation: sources, pips, metrics, commander identity resolution |
| `src/components/ColorDistributionChart.tsx` | Create | Grouped bar chart: sources vs demand per color |
| `src/components/ManaBaseStats.tsx` | Create | Stat pills: land count, avg CMC, colorless sources |
| `src/components/DeckAnalysis.tsx` | Modify | Wire in color distribution section below mana curve |
| `e2e/color-distribution.spec.ts` | Create | Unit tests for all color distribution functions |
| `e2e/deck-analysis.spec.ts` | Modify | E2E tests for color distribution UI + update mocks |
| `e2e/mana-curve.spec.ts` | Modify | Add `producedMana: []` to `makeCard()` helper |
| `e2e/deck-enrichment.spec.ts` | Modify | Add `producedMana` to mock data |
| `e2e/card-tags.spec.ts` | Modify | Add `producedMana` to mock data (if needed) |

No changes to: `package.json`, API routes, `DeckViewTabs.tsx`, `DeckList.tsx`, `next.config.ts`
