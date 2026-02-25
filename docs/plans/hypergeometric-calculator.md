# Hypergeometric Probability Calculator

## Context

Commander players need to reason about the statistical likelihood of drawing specific cards or card categories by a given turn. Questions like "What are the chances I draw a ramp spell by turn 3?" or "Will I reliably hit 3 lands in my opening hand?" are fundamental to deck construction decisions. Currently, tools like DeckLens and AetherHub offer standalone hypergeometric calculators, but they require manual setup -- the user must count how many "ramp cards" they have and enter the number themselves.

This feature adds a **Hypergeometric Probability Calculator** section to the Analysis tab. By leveraging the auto-tagging system in `card-tags.ts`, we pre-compute probabilities for common questions automatically and let users build custom queries from tag categories or individual cards.

### Intended Outcome

A "Draw Probability" section in the Analysis tab showing pre-computed stat cards for common probability questions, an interactive query builder for custom queries, and a Recharts line chart for probability curves across turns.

## Why

1. **Analytical differentiator**: Combines auto-tagging with hypergeometric math for zero-setup probability insights
2. **Pure computation**: No external APIs, purely client-side math on existing data
3. **Proven demand**: DeckLens and AetherHub both have this, validating the use case
4. **Extends existing work**: `land-base-efficiency.ts` already references hypergeometric probability for land drop consistency

## Dependencies

| Module | What We Use |
|--------|-------------|
| `src/lib/types.ts` | `DeckData`, `DeckCard`, `EnrichedCard` |
| `src/lib/card-tags.ts` | `generateTags()` — count cards per tag category |
| `src/components/DeckAnalysis.tsx` | Integration point for new section |
| `src/components/ChartContainer.tsx` | Recharts wrapper for probability curve |
| `recharts` (v3.7.0, installed) | `LineChart`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip` |

No external APIs needed.

## Existing Patterns to Reuse

| Pattern | Source | Application |
|---------|--------|-------------|
| Computation module | `src/lib/land-base-efficiency.ts` | Function signature, type exports |
| Chart component | `src/components/ManaCurveChart.tsx` | `ChartContainer`, dark tooltips, reduced-motion |
| Stat cards | `src/components/ManaBaseStats.tsx` | Grid layout, slate styling |
| Unit tests | `tests/unit/mana-curve.spec.ts` | `makeCard()`/`makeDeck()` helpers |

---

## Implementation Tasks

### Phase 1: Core Math Utility (`src/lib/hypergeometric.ts`)

- [ ] Create `src/lib/hypergeometric.ts` with types:
  - `HypergeometricQuery` -- `{ N, K, n, k }` (deck size, successes in deck, draws, desired successes)
  - `ProbabilityPoint` -- `{ turn, probability }`
  - `PrecomputedQuery` -- `{ label, description, probability, category, successCount, drawCount, desiredSuccesses }`
- [ ] Implement `logChoose(n, k)` -- log-space binomial coefficient to avoid integer overflow for C(99,7)
- [ ] Implement `hypergeometricPmf(N, K, n, k)` -- probability mass function P(X = k) using log-space arithmetic
- [ ] Implement `hypergeometricCdf(N, K, n, k)` -- cumulative P(X >= k) = 1 - sum(P(X = i) for i in 0..k-1)
- [ ] Implement `computeProbabilityCurve(N, K, kMin, maxTurns, openingHandSize=7)` -- array of `ProbabilityPoint` for turns 1-maxTurns, where draws at turn T = openingHandSize + (T - 1)

### Phase 2: Deck Query Engine (`src/lib/hypergeometric.ts` continued)

- [ ] Implement `countCardsByTag(deck, cardMap, tag)` -- total quantity of cards with given tag (commanders + mainboard, exclude sideboard)
- [ ] Implement `countCardsByName(deck, cardName)` -- quantity of specific card
- [ ] Implement `getDeckSize(deck)` -- total cards in commanders + mainboard
- [ ] Implement `computePrecomputedQueries(deck, cardMap)` -- auto-generated queries:
  1. "3+ lands in opening 7" -- `cdf(deckSize, landCount, 7, 3)`
  2. "At least 1 ramp by turn 3" -- `cdf(deckSize, rampCount, 9, 1)`
  3. "At least 1 removal by turn 5" -- `cdf(deckSize, removalCount, 11, 1)`
  4. "At least 1 card draw by turn 4" -- `cdf(deckSize, drawCount, 10, 1)`
  - Skip queries where category count is 0
- [ ] Implement `getAvailableCategories(deck, cardMap)` -- list of `{ label, count }` for all present tags + "Lands", sorted by count desc

### Phase 3: Unit Tests (`tests/unit/hypergeometric.spec.ts`)

- [ ] `logChoose`: C(0,0)=1, C(5,0)=1, C(5,5)=1, C(10,3)=120, C(99,7) not Infinity/NaN, k>n returns -Infinity
- [ ] `hypergeometricPmf`: known simple case (deck 10, 3 successes, draw 5), K=0 → P(X=0)=1, k>K → 0
- [ ] `hypergeometricCdf`: P(X≥1) with K=0 → 0, P(X≥0) → 1.0, 37 lands in 99 drawing 7 P(X≥3) ≈ 0.83
- [ ] `computeProbabilityCurve`: correct length, monotonically non-decreasing, turn 1 matches single cdf call
- [ ] `countCardsByTag`: correct count, 0 for absent tag, respects quantity
- [ ] `computePrecomputedQueries`: expected labels, zero-skip, probability range 0-1
- [ ] `getAvailableCategories`: includes "Lands", sorted desc, excludes zero-count

### Phase 4: UI Component (`src/components/HypergeometricCalculator.tsx`)

- [ ] Create component with props `{ deck, cardMap }`
- [ ] `useMemo` for precomputed queries and available categories
- [ ] Section: `aria-labelledby="hypergeometric-heading"`, heading "Draw Probability"
- [ ] Pre-computed stat cards grid (2 cols mobile, 4 desktop): label, probability %, description; color-coded (green ≥75%, yellow 50-74%, orange 25-49%, red <25%); `data-testid="precomputed-query"`
- [ ] Custom query builder:
  - Category dropdown from `getAvailableCategories()` + individual card names; `data-testid="query-category-select"`
  - "At least N" number input, default 1; `data-testid="query-min-successes"`
  - "By turn N" number input, default 4; `data-testid="query-turn-number"`
  - Computed probability display; `data-testid="query-result"`
  - "Show Curve" toggle for line chart; `data-testid="show-curve-btn"`
- [ ] Probability curve chart: Recharts `LineChart` via `ChartContainer`, purple line with area fill, custom dark tooltip, reduced-motion; `data-testid="probability-curve-chart"`
- [ ] Styling: existing dark slate patterns, form controls `bg-slate-800 border-slate-600`
- [ ] Accessibility: labels on all controls, chart `role="img"`, keyboard navigable

### Phase 5: Integration into DeckAnalysis

- [ ] Import `HypergeometricCalculator` in `DeckAnalysis.tsx`
- [ ] Render after `LandBaseEfficiency` section
- [ ] Component manages its own `useMemo` calls internally

### Phase 6: E2E Tests (`e2e/hypergeometric-ui.spec.ts`)

- [ ] "Draw Probability section appears in Analysis tab"
- [ ] "Displays pre-computed query stat cards"
- [ ] "Pre-computed land query shows reasonable probability"
- [ ] "Custom query builder controls visible"
- [ ] "Changing category updates probability"
- [ ] "Show Curve button reveals chart"
- [ ] "Section accessible with proper ARIA"
- [ ] "Skips pre-computed queries for absent categories"

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/hypergeometric.ts` | Create | Core math, query engine, types |
| `src/components/HypergeometricCalculator.tsx` | Create | Stat cards, query builder, probability chart |
| `src/components/DeckAnalysis.tsx` | Modify | Render after LandBaseEfficiency |
| `tests/unit/hypergeometric.spec.ts` | Create | Unit tests for math and query functions |
| `e2e/hypergeometric-ui.spec.ts` | Create | E2E tests for UI |

No changes to: `types.ts`, API routes, `package.json`, `DeckViewTabs.tsx`.

---

## Edge Cases

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Empty deck (0 cards) | All probabilities 0, precomputed queries empty array |
| No lands in deck | Land query returns 0%, still shown as signal |
| K > N or n > N | Clamp to valid ranges, return 0 or 1 |
| K = 0 for a tag | Skip precomputed query, exclude from categories |
| Single card K=1, want ≥2 | Returns 0% |
| Turn 15 of 40-card deck | Clamp draws to deck size |
| Log-space overflow | `logChoose` prevents integer overflow for C(99,7) |
| Commander vs 60-card | Use actual deck count, not hardcoded 99 |
| Sideboard excluded | Not in library, excluded from all calculations |
| Multi-tag cards | Board Wipe also counted as Removal (correct behavior) |

## E2E User Scenarios

1. **Auto-insights**: Import Commander deck → Analysis tab → "Draw Probability" shows "83.2% chance of 3+ lands in opening hand"
2. **Custom query**: Select "Ramp" → at least 1 → by turn 3 → see ~65% probability
3. **Probability curve**: Click "Show Curve" → line chart showing probability turns 1-10
4. **Absent category**: Deck with no Removal → ramp/draw/land queries still appear, removal skipped
5. **Mono-color + 40 lands**: Land probability >95%, curve near 100% from turn 1

## Verification

1. `npx playwright test --config playwright.unit.config.ts tests/unit/hypergeometric.spec.ts` — all pass
2. `npx playwright test e2e/hypergeometric-ui.spec.ts` — all pass
3. `npm test` — full suite green
4. `npm run build` — no TypeScript errors
5. Manual: import deck → verify pre-computed stats → use custom query → verify curve chart → cross-reference against external calculator
