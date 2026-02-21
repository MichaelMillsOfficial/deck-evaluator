# Mana Curve Analysis with Recharts

## Context

The enrichment pipeline already provides `cmc`, `typeLine`, and `manaPips` on every `EnrichedCard`. There is no analysis view — the UI only shows the card list. This plan adds a "Deck List / Analysis" tab system around the deck display, a mana curve bar chart using Recharts, and the computation logic to drive it. The charting infrastructure is designed to support bar, line, and pie charts in a shared view pane for future analysis features.

---

## Implementation Tasks

### 1. Install Recharts

- [ ] `npm install recharts`
- [ ] Verify `npm run build` passes (Recharts ships its own types)

### 2. Write mana curve unit tests — `e2e/mana-curve.spec.ts`

Pure function tests (direct import, `@playwright/test`, no browser). Following `e2e/mana-parsers.spec.ts` pattern.

- [ ] Returns 8 buckets `["0","1","2","3","4","5","6","7+"]` in order, all zero when cardMap is empty
- [ ] Groups cards into correct CMC bucket
- [ ] Groups CMC >= 7 into the "7+" bucket
- [ ] Multiplies `DeckCard.quantity` into count
- [ ] Excludes lands (`typeLine` contains "Land" — covers Basic Land, Snow Land, Artifact Land)
- [ ] Includes commanders and sideboard cards
- [ ] Skips cards not found in cardMap (no crash)
- [ ] CMC 0 non-land cards (e.g. Mox) appear in bucket 0

### 3. Implement mana curve utility — `src/lib/mana-curve.ts`

```typescript
export interface ManaCurveBucket {
  cmc: string;   // "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7+"
  count: number;
}

export function computeManaCurve(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): ManaCurveBucket[]
```

Logic:
1. Iterate `[...deck.commanders, ...deck.mainboard, ...deck.sideboard]`
2. Look up `cardMap[card.name]` — skip if missing
3. Skip if `enriched.typeLine.includes("Land")`
4. Bucket: `cmc >= 7 ? "7+" : String(Math.floor(cmc))`
5. Add `card.quantity` to bucket count
6. Always return exactly 8 buckets in fixed order, even if count is 0

### 4. Write E2E tests — `e2e/deck-analysis.spec.ts`

Follow `e2e/deck-enrichment.spec.ts` pattern: mock `/api/deck-enrich` via `page.route()`, import `test`/`expect` from `./fixtures`.

Mock response includes cards at various CMCs plus a land (excluded from curve).

- [ ] **Tab navigation**: "Deck List" and "Analysis" tabs visible after import, defaults to "Deck List", arrow key navigation between tabs, Home/End keys
- [ ] **Tab availability**: Analysis tab disabled while enrichment loads, enabled after completion
- [ ] **Mana curve content**: Clicking Analysis shows "Mana Curve" heading, chart wrapper has `role="img"` with descriptive `aria-label`, switching back to Deck List shows `deck-display`
- [ ] **Accessibility**: Tab buttons have `role="tab"` + correct `aria-selected`, `aria-controls` matches panel IDs, inactive panel has `hidden` attribute, tablist has `aria-label="Deck view"`

### 5. Update fixtures — `e2e/fixtures.ts`

- [ ] Add `selectDeckViewTab(tab: "Deck List" | "Analysis")` — scoped to `getByRole("tablist", { name: "Deck view" })`
- [ ] Add `waitForAnalysisPanel()` — waits for "Mana Curve" heading
- [ ] Add `get analysisPanel` — locator for `#tabpanel-deck-analysis`
- [ ] Add `get deckViewTabs` — locator for `[data-testid="deck-view-tabs"]`

### 6. Create chart wrapper — `src/components/ChartContainer.tsx`

```typescript
interface ChartContainerProps {
  height?: number;        // default 240
  ariaLabel: string;      // required — describes chart content
  children: React.ReactNode;
}
```

- [ ] `"use client"` (ResizeObserver)
- [ ] Outer `<div>` with `role="img"` and `aria-label`
- [ ] `<ResponsiveContainer width="100%" height="100%">`
- [ ] No chart-specific logic — each chart component owns its own Recharts primitives

### 7. Create mana curve chart — `src/components/ManaCurveChart.tsx`

```typescript
interface ManaCurveChartProps {
  data: ManaCurveBucket[];
}
```

- [ ] `"use client"`
- [ ] `<ChartContainer height={240} ariaLabel="Mana curve bar chart. Distribution of N non-land spells by converted mana cost.">`
- [ ] `<BarChart>` with:
  - `<CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />`
  - `<XAxis dataKey="cmc">` — slate-400 ticks, no tick lines
  - `<YAxis allowDecimals={false}>` — slate-400 ticks, no axis line
  - `<Tooltip>` — custom dark tooltip (`bg-slate-800 border-slate-600`, purple-300 value text)
  - `<Bar dataKey="count" fill="#9333ea" radius={[3,3,0,0]}>` — purple-600
  - `<LabelList>` — suppresses "0" labels, slate-300 text
- [ ] Reduced motion: `isAnimationActive={!prefersReducedMotion}` on `<Bar>`

### 8. Create analysis panel — `src/components/DeckAnalysis.tsx`

```typescript
interface DeckAnalysisProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard>;
}
```

- [ ] Calls `computeManaCurve(deck, cardMap)`, computes total non-land count
- [ ] Renders section with `aria-labelledby="mana-curve-heading"`
- [ ] Heading: "Mana Curve" (uppercase tracking-wide, matches deck section headers)
- [ ] Subtitle: "N non-land spells by converted mana cost"
- [ ] `<ManaCurveChart data={curveData} />`
- [ ] Wrapped in `<div className="space-y-6">` for future analysis sections

### 9. Create tab shell — `src/components/DeckViewTabs.tsx`

```typescript
interface DeckViewTabsProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard> | null;
  enrichLoading: boolean;
}
```

- [ ] `"use client"`, `data-testid="deck-view-tabs"`
- [ ] Two tabs: `"list"` ("Deck List") and `"analysis"` ("Analysis")
- [ ] WAI-ARIA tab pattern matching `DeckInput.tsx` exactly:
  - `role="tablist"` with `aria-label="Deck view"`
  - Roving tabindex, ArrowRight/Left/Home/End keyboard nav
  - `role="tab"`, `aria-selected`, `aria-controls`, `tabIndex`
  - `role="tabpanel"`, `id`, `aria-labelledby`, `hidden` attribute
- [ ] Tab bar styling: `bg-slate-900 p-1 rounded-lg`, active `bg-slate-600 text-white`
- [ ] Analysis tab `disabled` when `!cardMap || enrichLoading` — `disabled:cursor-not-allowed disabled:opacity-40`
- [ ] List panel renders `<DeckList>` as-is (keeps `data-testid="deck-display"`, zero existing test breakage)
- [ ] Analysis panel renders `<DeckAnalysis>` only when `cardMap && !enrichLoading`

### 10. Update DeckImportSection — `src/components/DeckImportSection.tsx`

- [ ] Replace `<DeckList deck={deckData} cardMap={cardMap} enrichLoading={enrichLoading} />` with `<DeckViewTabs deck={deckData} cardMap={cardMap} enrichLoading={enrichLoading} />`
- [ ] Update import statement accordingly. No other changes — state ownership is unchanged.

### 11. Verify

- [ ] `npx playwright test e2e/mana-curve.spec.ts` — utility tests pass
- [ ] `npx playwright test e2e/deck-analysis.spec.ts` — E2E tests pass
- [ ] `npm test` — full suite green (117 existing + new tests)
- [ ] `npm run build` — no TypeScript errors
- [ ] Visual: import a deck, confirm Deck List / Analysis tabs appear, Analysis tab enables after enrichment, mana curve shows purple bars with correct counts, lands excluded

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add `recharts` dependency |
| `src/lib/mana-curve.ts` | Create | `computeManaCurve()` + `ManaCurveBucket` type |
| `src/components/ChartContainer.tsx` | Create | Recharts `ResponsiveContainer` wrapper, `role="img"` |
| `src/components/ManaCurveChart.tsx` | Create | Bar chart: purple bars, dark tooltip, reduced-motion |
| `src/components/DeckAnalysis.tsx` | Create | Analysis panel: mana curve section |
| `src/components/DeckViewTabs.tsx` | Create | Tab shell: Deck List / Analysis, WAI-ARIA tabs |
| `src/components/DeckImportSection.tsx` | Modify | Replace `<DeckList>` with `<DeckViewTabs>` (1-line) |
| `e2e/mana-curve.spec.ts` | Create | Unit tests for `computeManaCurve` |
| `e2e/deck-analysis.spec.ts` | Create | E2E tests: tabs, chart, accessibility |
| `e2e/fixtures.ts` | Modify | Add deck view tab helpers to `DeckPage` |

No changes to: `DeckList.tsx`, `types.ts`, API routes, `next.config.ts`
