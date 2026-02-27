# Additional Hand Analysis Features

## Context

The deck evaluator already has a complete Opening Hand Simulator (see `docs/plans/opening-hand-simulator.md`) that draws random 7-card opening hands, evaluates quality with weighted heuristic scoring, supports London Mulligan rules, and runs Monte Carlo simulations for aggregate statistics. All of this lives in the "Hands" tab of `DeckViewTabs.tsx`.

Issue #32 requests two new capabilities that build on this existing framework:

1. **Top 5 Best Hands**: Surface the five highest-scoring hands discovered during simulation, with explanations of why each is strong. This gives users a concrete picture of what an ideal opening looks like in their specific deck — a "gold standard" to compare their real draws against.

2. **Hand Builder (Manual Hand Selection)**: Let users pick specific cards from their deck to construct a hand, then run the same `evaluateHandQuality()` analysis. This answers "what if I drew these exact cards?" — useful for evaluating specific openers players have seen in practice.

Both features reuse the existing scoring framework (`evaluateHandQuality`, `generateReasoning`, `getVerdict`) with no changes to the scoring logic itself. No external APIs or new dependencies are required.

### Scope

**In scope**: Top 5 hands display, manual card picker + analysis, unit tests, e2e tests, fixture updates.

**Out of scope**: Changes to the scoring algorithm, changes to Monte Carlo iteration count, new tab (both features integrate into the existing Hands tab), backend API changes.

## Design Decisions

### Top Hands: Deduplication Strategy

Hands are considered duplicates if they contain the same card names (regardless of draw order). We sort card names alphabetically and join them as a key string. During the simulation loop, we maintain a min-heap (sorted array) of the top N unique hands by score, replacing the lowest when a higher-scoring unique hand is found.

### Top Hands: Integration with Existing Simulation

Rather than running a separate Monte Carlo pass, `findTopHands()` will be a standalone function that runs its own simulation loop (default 2000 iterations for better coverage of strong hands). This keeps `runSimulation()` unchanged and avoids coupling the two features. The caller (`HandSimulator.tsx`) runs both in the same `requestAnimationFrame` callback.

### Hand Builder: Card Selection UX

The card picker displays all unique cards in the deck as a scrollable list, grouped by type (Lands vs Non-lands). Each row shows the card name, mana cost, type, and a quantity stepper (+/- buttons). A running count shows "X / 7 cards selected" with the Analyze button disabled until at least 1 card is selected. Selecting fewer than 7 cards is allowed (simulates a mulligan hand).

### Hand Builder: Mulligan Number Inference

When fewer than 7 cards are selected, the mulligan number is inferred as `7 - selectedCount`. This matches the London Mulligan rule where you see 7 but put some back. The reasoning output will note the inferred mulligan.

### UI Layout

Both features appear as sections within the existing Hands tab, ordered:
1. Simulation Stats (existing)
2. Top 5 Best Hands (new — collapsible, default expanded)
3. Draw / Mulligan buttons + hand display (existing)
4. Hand Builder (new — collapsible, default collapsed)

### Tailwind Classes

| Element | Classes |
|---------|---------|
| Section header | `text-sm font-semibold uppercase tracking-wide text-slate-300` |
| Section description | `text-xs text-slate-400 mb-4` |
| Collapsible button | `flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3` |
| Rank badge (top hands) | `flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white` |
| Card picker row | `flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2` |
| Quantity stepper button | `flex h-7 w-7 items-center justify-center rounded border border-slate-600 text-slate-300 hover:bg-slate-700 disabled:opacity-30` |
| Selected count pill | `rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-300` |
| Analyze button | `rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-40` |

---

## Implementation Tasks

### Phase 1: Core Logic — `findTopHands()` (`src/lib/opening-hand.ts`)

- [x] 1.1 Add `RankedHand` type to `src/lib/opening-hand.ts`
  - `{ rank: number; hand: DrawnHand; cardKey: string }` — `cardKey` is the dedup key (sorted card names joined by `|`)
- [x] 1.2 Implement `findTopHands(pool, commanderIdentity, topN?, iterations?): RankedHand[]`
  - Default `topN = 5`, `iterations = 2000`
  - Loop: draw hand → evaluate → compute cardKey → if unique and score > min in buffer, insert
  - Return sorted descending by score, with `rank` set 1..N
  - Signature: `export function findTopHands(pool: HandCard[], commanderIdentity: Set<MtgColor | string>, topN?: number, iterations?: number): RankedHand[]`

### Phase 2: Unit Tests — `findTopHands` (`tests/unit/opening-hand.spec.ts`)

- [x] 2.1 Add `findTopHands` describe block to `tests/unit/opening-hand.spec.ts`
  - Test: "returns at most topN hands" — call with `topN=3`, verify length <= 3
  - Test: "hands are sorted by score descending" — verify `result[0].hand.quality.score >= result[1].hand.quality.score`
  - Test: "rank values are 1-indexed and sequential" — verify ranks are `[1, 2, 3, ...]`
  - Test: "no duplicate cardKeys in results" — verify all `cardKey` values are unique
  - Test: "returns empty array for empty pool" — `findTopHands([], identity)` returns `[]`
  - Test: "returns fewer than topN when pool has very few unique combinations" — small pool (3 cards), verify results.length <= possible combos

### Phase 3: Top Hands Component (`src/components/TopHands.tsx`)

- [x] 3.1 Create `src/components/TopHands.tsx`
  - Props: `{ hands: RankedHand[]; loading: boolean }`
  - Loading state: shimmer placeholders (3 rows)
  - Each hand: rank badge, card image thumbnails (small, ~73x102px), verdict badge, score, reasoning bullets
  - Collapsible via a `<button>` with `aria-expanded` / `aria-controls`
  - `data-testid="top-hands"` on container, `data-testid="top-hand-{rank}"` on each entry
  - Accessible: `aria-label="Top 5 best hands"` on section

### Phase 4: Hand Builder Component (`src/components/HandBuilder.tsx`)

- [x] 4.1 Create `src/components/HandBuilder.tsx`
  - Props: `{ pool: HandCard[]; commanderIdentity: Set<MtgColor | string> }`
  - Internal state: `selectedCards: Record<string, number>` (card name → selected quantity)
  - Deduplicate pool into unique cards with max quantity
  - Group cards: Lands first, then non-lands sorted by CMC
  - Each card row: name, `<ManaCost>`, type line, quantity stepper (+/-), current/max count
  - Header bar: "X / 7 cards selected" pill + "Analyze Hand" button (disabled when 0 selected)
  - "Clear" button to reset selections
  - On Analyze: build `HandCard[]` from selections, call `evaluateHandQuality()`, display result via `<HandDisplay>`
  - Collapsible via a `<button>` with `aria-expanded` / `aria-controls`
  - `data-testid="hand-builder"` on container
  - `data-testid="card-picker-row-{cardName}"` on each card row (sanitize spaces to hyphens, lowercase)
  - `data-testid="hand-builder-result"` on the analysis result area
  - `data-testid="analyze-hand-btn"` on the Analyze button
  - `data-testid="selected-count"` on the "X / 7" indicator
  - `data-testid="clear-selection-btn"` on the Clear button

### Phase 5: Integration into HandSimulator (`src/components/HandSimulator.tsx`)

- [x] 5.1 Modify `src/components/HandSimulator.tsx` to:
  - Import `findTopHands` from `@/lib/opening-hand` and `TopHands` + `HandBuilder` components
  - Add `topHands` state alongside existing `simStats`
  - In the existing `useEffect`, call `findTopHands(pool, commanderIdentity)` after `runSimulation()` and set state
  - Render order: SimulationStats → TopHands → Draw/Mulligan buttons + HandDisplay → HandBuilder
  - Pass `pool` and `commanderIdentity` to `HandBuilder`

### Phase 6: E2E Tests (`e2e/hand-analysis.spec.ts`)

- [x] 6.1 Create `e2e/hand-analysis.spec.ts` with tests:
  - Test: "Top 5 best hands appear after simulation completes" — navigate to Hands tab, verify `top-hands` container visible with up to 5 `top-hand-*` entries
  - Test: "Top hands show rank, verdict badge, and reasoning" — verify first entry has rank "1", a verdict badge, and reasoning text
  - Test: "Hand builder is visible on Hands tab" — verify `hand-builder` container visible
  - Test: "Card picker shows deck cards with quantity steppers" — verify card rows appear with +/- buttons
  - Test: "Selecting cards updates count indicator" — click + on a card, verify "1 / 7" shows
  - Test: "Analyze button disabled when no cards selected" — verify disabled state
  - Test: "Analyze button produces hand evaluation" — select cards, click Analyze, verify verdict appears
  - Test: "Clear button resets selection" — select cards, click Clear, verify count goes to 0

### Phase 7: Fixture Updates (`e2e/fixtures.ts`)

- [x] 7.1 Add page-object helpers to `DeckPage` in `e2e/fixtures.ts`:
  - `get topHandsSection` — locator for `[data-testid="top-hands"]`
  - `get handBuilder` — locator for `[data-testid="hand-builder"]`
  - `get analyzeHandButton` — locator for `[data-testid="analyze-hand-btn"]`

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/opening-hand.ts` | Modify | Add `RankedHand` type and `findTopHands()` function |
| `src/components/TopHands.tsx` | Create | Top 5 best hands display with rank badges and analysis |
| `src/components/HandBuilder.tsx` | Create | Manual card picker with quantity steppers and analysis |
| `src/components/HandSimulator.tsx` | Modify | Integrate TopHands and HandBuilder into Hands tab layout |
| `tests/unit/opening-hand.spec.ts` | Modify | Add `findTopHands` unit tests |
| `e2e/hand-analysis.spec.ts` | Create | E2E tests for top hands and hand builder |
| `e2e/fixtures.ts` | Modify | Add page-object helpers for new features |

No changes to: `types.ts`, API routes, `DeckAnalysis.tsx`, `DeckViewTabs.tsx`, `HandDisplay.tsx`, `HandSimulationStats.tsx`, `package.json`.

---

## Edge Cases

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Fewer than 5 unique hand combinations | `findTopHands` returns as many as found |
| Empty pool | `findTopHands` returns `[]`, hand builder shows empty state |
| All hands score identically | Top 5 all shown with same score, deduplication still applied |
| Hand builder: selecting more than available quantity | Stepper + button disabled at max quantity per card |
| Hand builder: selecting 0 cards | Analyze button disabled |
| Hand builder: selecting < 7 cards | Mulligan number inferred as `7 - count`, scoring adjusts accordingly |
| Top hands loading state | Shimmer placeholders shown until computation completes |
| Very large deck (99 unique cards) | Card picker is scrollable with max-height, performance stays smooth |

## Verification

1. `npx playwright test --config playwright.unit.config.ts tests/unit/opening-hand.spec.ts` — all unit tests pass (existing + new)
2. `npx playwright test e2e/hand-analysis.spec.ts` — all new e2e tests pass
3. `npm test` — full test suite green
4. `npm run build` — production build succeeds with no TypeScript errors
5. Manual: import a Commander deck → Hands tab → verify top 5 hands display with rankings → scroll to Hand Builder → pick 3 lands + 4 spells → click Analyze → verify verdict + reasoning appears → click Clear → verify reset
