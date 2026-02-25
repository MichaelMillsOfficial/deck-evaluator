# Opening Hand Simulator

## Context

Commander deck-building tools like Moxfield and Archidekt offer "playtester" modes where players can draw sample hands and goldfish games. However, these tools treat opening hands as purely visual -- draw 7, look at them, decide yourself. They provide no automated quality assessment.

This feature adds an **Opening Hand Simulator** that draws random 7-card opening hands, supports the London Mulligan rule, scores each hand for quality using heuristic analysis (land count, ramp presence, curve playability, color requirements), and runs aggregate Monte Carlo simulations to produce statistical summaries like keepable-hand rate, average lands in opener, and probability of a turn-1 play.

### Intended Outcome

A new "Hands" tab in `DeckViewTabs.tsx` that provides:
1. Interactive single-hand draw with card images, quality scoring, and mulligan support
2. Aggregate simulation statistics from 1000+ random hands
3. Automated hand quality evaluation -- a unique competitive advantage

## Why

- **Competitive differentiation**: No existing deck builder scores opening hands automatically. Moxfield shows "average lands in opening 7" but does not evaluate hand quality holistically.
- **User value**: Players spend significant time goldfishing to assess mana base reliability. Automated statistics answer "how often does this deck keep?" instantly.
- **Builds on existing infrastructure**: Card tags ("Ramp"), mana pip analysis, and land classification are already implemented.

## Dependencies

| Module | What We Use |
|--------|-------------|
| `src/lib/types.ts` | `DeckData`, `DeckCard`, `EnrichedCard`, `ManaPips` |
| `src/lib/card-tags.ts` | `generateTags()` -- detect "Ramp" cards in hand |
| `src/lib/color-distribution.ts` | `resolveCommanderIdentity()` -- determine which colors the deck needs |
| `src/lib/land-base-efficiency.ts` | `classifyLandEntry()` -- identify untapped vs. tapped lands |
| `src/lib/mana-curve.ts` | `extractCardType()` -- distinguish lands from spells |
| `src/components/DeckViewTabs.tsx` | Tab shell -- add new "Hands" tab |
| `src/components/ManaCost.tsx` | Render mana costs on cards in hand display |
| `src/components/CardTags.tsx` | Show tags on cards in hand display |

No external APIs or new dependencies required. All computation is client-side.

## Existing Patterns to Reuse

| Pattern | Source | Application |
|---------|--------|-------------|
| Pure computation module | `src/lib/land-base-efficiency.ts` | `(deck, cardMap) => result` pattern |
| Tab addition | `src/components/DeckViewTabs.tsx` | Add to `ViewTab` union, `tabs` array, tabpanel block |
| Stat cards | `src/components/ManaBaseStats.tsx` | Grid layout for simulation stats |
| Score display | `src/components/LandBaseEfficiency.tsx` | Color-coded badges, progress bars |
| Unit tests | `tests/unit/mana-curve.spec.ts` | `makeCard()`/`makeDeck()` helpers |
| E2E tests | `e2e/deck-enrichment.spec.ts` | Mock enrichment, page-object methods |

---

## Implementation Tasks

### Phase 1: Core Simulation Logic (`src/lib/opening-hand.ts`)

- [ ] Create `src/lib/opening-hand.ts` with types:
  - `HandCard` -- `{ name, quantity, enriched: EnrichedCard }`
  - `HandQualityFactors` -- `{ landCount, rampCount, playableTurns[], colorCoverage, curvePlayability }`
  - `HandQualityResult` -- `{ score, verdict: "Strong Keep"|"Keepable"|"Marginal"|"Mulligan", factors, reasoning[] }`
  - `DrawnHand` -- `{ cards: HandCard[], quality: HandQualityResult, mulliganNumber }`
  - `SimulationStats` -- `{ totalSimulations, keepableRate, avgLandsInOpener, avgScore, probT1Play, probT2Play, probT3Play, verdictDistribution }`
- [ ] Implement `buildPool(deck, cardMap): HandCard[]` -- flatten commanders + mainboard (exclude sideboard), repeat for quantity, skip missing cardMap entries
- [ ] Implement `drawHand(pool, count): HandCard[]` -- Fisher-Yates shuffle copy, return first `count` cards
- [ ] Implement `evaluateHandQuality(hand, mulliganNumber, commanderIdentity): HandQualityResult`:
  - **Land count** (35% weight): 2-4 ideal for 7 cards, adjust for mulligan count
  - **Ramp availability** (15%): At least 1 "Ramp" tagged card
  - **Curve playability** (30%): Can cast something turns 1-3 with available untapped lands
  - **Color coverage** (20%): Lands produce colors needed by spells in hand
- [ ] Implement `getVerdict(score)`: 80-100 "Strong Keep", 60-79 "Keepable", 40-59 "Marginal", 0-39 "Mulligan"
- [ ] Implement `generateReasoning(factors, mulliganNumber): string[]` -- human-readable bullet points
- [ ] Implement `runSimulation(deck, cardMap, iterations=1000): SimulationStats` -- Monte Carlo aggregate

### Phase 2: Unit Tests (`tests/unit/opening-hand.spec.ts`)

- [ ] `buildPool`: flattens quantities, includes commanders, excludes sideboard, skips missing cardMap, empty deck
- [ ] `drawHand`: returns correct count, cards from pool, no mutation, handles pool < count
- [ ] `evaluateHandQuality`: ideal hand = "Strong Keep", 0 lands = "Mulligan", 7 lands = "Mulligan", 1 land + ramp = "Marginal", wrong-color lands = low score, 6-card hand adjustments, 5-card hand adjustments
- [ ] `getVerdict`: boundary values at 80, 60, 40
- [ ] `generateReasoning`: returns string array, includes land/ramp/color assessments
- [ ] `runSimulation`: correct iteration count, rate bounds, avg lands bounds, verdict distribution sums, all-land deck ≈ 0% keepable

### Phase 3: Hand Display Component (`src/components/HandDisplay.tsx`)

- [ ] Card images in horizontal row using `imageUris.normal`, placeholder if null, ~146x204px
- [ ] Quality verdict as color-coded badge (green/emerald/yellow/red)
- [ ] Numeric score next to verdict
- [ ] Reasoning bullets (`text-xs text-slate-400`)
- [ ] Mulligan number indicator if > 0
- [ ] Accessible: `alt` text on images, `aria-label` on container

### Phase 4: Simulation Stats Component (`src/components/HandSimulationStats.tsx`)

- [ ] Stat cards grid (`grid-cols-2 sm:grid-cols-4`): Keepable Rate, Avg Lands, T1 Play, T2 Play
- [ ] Verdict distribution summary
- [ ] `data-testid` attributes on each stat card

### Phase 5: Hands Tab Container (`src/components/HandSimulator.tsx`)

- [ ] State: `currentHand`, `mulliganCount`, `simStats`
- [ ] `useMemo` for `runSimulation(deck, cardMap, 1000)`
- [ ] "Draw Hand" button (purple primary): draws 7, evaluates quality, resets mulligan
- [ ] "Mulligan" button (outline): increments count, draws new 7, disabled after 3
- [ ] "New Hand" button (secondary): equivalent to Draw Hand
- [ ] Layout: stats at top → buttons → hand display

### Phase 6: Tab Integration (`src/components/DeckViewTabs.tsx`)

- [ ] Add `"hands"` to `ViewTab` union type
- [ ] Add `{ key: "hands", label: "Hands" }` to `tabs` array
- [ ] Add tabpanel block: `id="tabpanel-deck-hands"`, render `HandSimulator` when active + cardMap ready
- [ ] Disable when `analysisDisabled` is true

### Phase 7: E2E Tests (`e2e/opening-hand-ui.spec.ts`)

- [ ] "Hands tab appears after deck import and enrichment"
- [ ] "Hands tab disabled while enrichment loading"
- [ ] "Draw Hand button produces hand with card images"
- [ ] "Hand quality verdict displayed after drawing"
- [ ] "Mulligan button draws new hand and increments count"
- [ ] "Mulligan button disabled after 3 mulligans"
- [ ] "New Hand button resets mulligan count"
- [ ] "Simulation stats are visible"
- [ ] "Tab accessible with proper ARIA attributes"

### Phase 8: Fixture Updates (`e2e/fixtures.ts`)

- [ ] Add `waitForHandsPanel()` method
- [ ] Add `get handsPanel` locator for `#tabpanel-deck-hands`

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/opening-hand.ts` | Create | Pool building, hand drawing, quality scoring, Monte Carlo simulation |
| `src/components/HandDisplay.tsx` | Create | Card image fan, verdict badge, reasoning list |
| `src/components/HandSimulationStats.tsx` | Create | Stat cards for aggregate results |
| `src/components/HandSimulator.tsx` | Create | Container: buttons, state, orchestration |
| `src/components/DeckViewTabs.tsx` | Modify | Add "Hands" tab |
| `tests/unit/opening-hand.spec.ts` | Create | Unit tests for all pure functions |
| `e2e/opening-hand-ui.spec.ts` | Create | E2E tests for hands tab |
| `e2e/fixtures.ts` | Modify | Add hands panel helpers |

No changes to: `types.ts`, API routes, `DeckAnalysis.tsx`, `package.json`.

---

## Edge Cases

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Deck < 7 cards | Draw as many as available, score accordingly |
| 0 lands in deck | Every hand scores "Mulligan", keepable rate ≈ 0% |
| All lands | 7 lands = "Mulligan" (no spells), keepable rate ≈ 0% |
| Cards missing from cardMap | Skipped in pool building, no crash |
| Colorless deck | Color coverage gives full marks (no colored requirements) |
| Split/DFC cards | Use front face CMC (consistent with mana-curve.ts) |
| Mulligan cap at 3 | 4-card hand minimum, button disabled after 3 mulligans |
| Simulation performance | 1000 iterations × O(99) shuffle ≈ <50ms, no Web Worker needed |
| Tapped lands + T1 play | Tapped lands don't enable T1 plays (use `classifyLandEntry()`) |
| Commanders in pool | Included for statistical accuracy (represent 1-2 of 99 cards) |

## E2E User Scenarios

1. **First draw**: Import deck → Hands tab → Draw Hand → 7 card images + verdict badge + reasoning
2. **Mulligan sequence**: Draw 0-land hand → "Mulligan" verdict → click Mulligan → new hand with "Mulligan 1" indicator
3. **Multiple mulligans**: Mulligan 3× → button disabled → click "New Hand" to reset
4. **Statistics review**: Scroll to stats → "Keepable Rate: 68%", "Avg Lands: 3.2", "T1 Play: 42%"
5. **Tab switching**: Switch Hands → Deck List → back to Hands → previous hand + stats preserved
6. **Poor mana base**: 5-color deck with all forests → keepable rate ≈ 12% → signals mana base issues

## Verification

1. `npx playwright test --config playwright.unit.config.ts tests/unit/opening-hand.spec.ts` — all pass
2. `npx playwright test e2e/opening-hand-ui.spec.ts` — all pass
3. `npm test` — full suite green
4. `npm run build` — no TypeScript errors
5. Manual: import Commander deck → Hands tab → draw hand → verify scoring → run multiple mulligans → check stats
