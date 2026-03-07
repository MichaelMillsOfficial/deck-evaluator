# Hand Keepability: Game Plan Awareness (Issue #46)

## Context

The opening hand evaluator in `src/lib/opening-hand.ts` already scores hands across 7 weighted factors: land count, curve playability, color coverage, ramp, strategy alignment, card advantage, and interaction. Commander awareness dynamically adjusts weights when a commander provides card advantage, interaction, or ramp (via `computeAdjustedWeights()`).

However, the current implementation has gaps identified in issue #46:

1. **Commander not scored as a strategic play** -- The commander sits in the command zone and is always available, but `scoreStrategy()` only evaluates hand cards against deck themes. A hand that perfectly enables an early commander cast (e.g., T1 dork -> T2 ramp -> T3 Korvold) doesn't get credit for "setting up the game plan" even though the commander IS the game plan.

2. **No turn-by-turn sequencing evaluation** -- The hand evaluator checks if individual spells are castable on turns 1-3, but doesn't model a coherent play sequence. Playing a T1 dork that enables a T2 draw engine that fuels T3+ plays is qualitatively better than having three individually-castable spells that don't chain.

3. **Card advantage castability not verified** -- `scoreCardAdvantage()` tempo-weights by CMC but doesn't check whether the hand's mana actually supports casting the card advantage spell. A 3-CMC Phyrexian Arena with only 1 land and no ramp scores the same as one with 3 lands.

4. **No board state projection** -- The evaluator doesn't model what the board looks like after executing the hand's plays. "After T1-T3, do I have a board presence, a card draw engine running, and interaction held up?" is the question experienced players ask.

**Intended outcome**: Hands that coherently set up the deck's game plan -- deploying the commander on curve, establishing card advantage engines castable with available mana, and building toward a functional board state -- score higher than hands with individually good but uncoordinated cards.

**Scope**: Changes are limited to `src/lib/opening-hand.ts` scoring functions and their tests. No UI changes. No changes to the simulation loop or `HandQualityFactors` interface shape (new fields are already optional). The existing 7-factor weighted model is preserved; we enhance the individual factor scoring functions to be more context-aware.

## Design Decisions

### D1: Enhance existing scorers vs. add new factors

**Decision**: Enhance `scoreStrategy()`, `scoreCardAdvantage()`, and `scoreInteraction()` rather than adding new weight factors.

**Reasoning**: The 7-factor model with commander weight adjustment is already well-tested. Adding more factors would dilute existing weights and require retuning. Instead, make the existing factor scores smarter by considering castability and commander synergy within each scorer.

### D2: Lightweight sequencing via "mana projection" instead of full goldfish simulation

**Decision**: Project available mana per turn (T1-T4) using existing `getManaProducers()` output, then check which spells are castable on each turn. No full game state simulation.

**Reasoning**: A full goldfish sim (tracking board state, card draw triggers, etc.) is complex and slow for 1000+ Monte Carlo iterations. A mana projection model captures 90% of sequencing value: "can I cast this draw spell on T2?" and "can I deploy my commander on T3?".

### D3: Commander-as-gameplan bonus in `scoreStrategy()`

**Decision**: When the command zone commander matches deck themes AND is castable by T4 given the hand's mana, add a bonus to the strategy score.

**Reasoning**: This directly addresses the issue's ask: "if the commander can be played in the early game and has card advantage, card advantage in the hand should carry less weight." The weight adjustment already handles the second part; we need the strategy scorer to treat the commander as a theme-aligned play.

## Algorithm Design

### Mana Projection Model

Given a hand, project available mana on turns 1-4:

| Turn | Available Mana Sources |
|------|----------------------|
| T1 | untapped lands in hand (assume 1 land drop) |
| T2 | all lands (2 land drops assumed) + T1 dorks (summoning sickness cleared) |
| T3 | all lands + 1 (3 land drops) + T1+T2 dorks |
| T4 | all lands + 2 (4 land drops) + all dorks |

Note: We already have `getManaProducers()` which computes T2/T3 sources. We extend this to also compute a T4 projection and return total available mana counts per turn.

```
function projectManaByTurn(hand, untappedLandSources, allLandSources):
  { t2Sources, t3Sources, dorks } = getManaProducers(hand, untappedLandSources, allLandSources)
  t1Mana = untappedLandSources.length
  t2Mana = t2Sources.length   // lands + T1 dorks (already computed)
  t3Mana = t3Sources.length   // lands + T1+T2 dorks (already computed)
  t4Mana = t3Mana + 1 + (CMC 3 dorks castable by T3)  // approximate
  return { t1Mana, t2Mana, t3Mana, t4Mana, t2Sources, t3Sources }
```

### Enhanced scoreCardAdvantage

Current: tempo-weight by CMC alone.
New: also check if the card advantage source is actually castable given projected mana.

```
for each CA spell in hand:
  cmcWeight = existing tempo weight (1.0 / 0.7 / 0.4)
  castable = canCastWithLands(spell, sourcesForTurn(spell.cmc))
  castabilityMultiplier = castable ? 1.0 : 0.3
  effectiveCount += cmcWeight * castabilityMultiplier
```

### Enhanced scoreStrategy (commander-as-gameplan)

```
existing strategy score from hand cards (0-100)
if commandZone has commanders:
  for each commander:
    themeRelevance = max axis score across top themes
    if themeRelevance > 0:
      cmcTurn = commander.cmc (turn it can be cast)
      castable = projected mana at cmcTurn >= commander.cmc
                 AND canCastWithLands(commander, sourcesForTurn(cmcTurn))
      if castable:
        bonus = themeRelevance * tempoWeight(cmcTurn)
        add bonus to strategy score (capped at 100)
```

### Enhanced scoreInteraction (castability check)

Same pattern as scoreCardAdvantage -- multiply by castability factor.

## Implementation Tasks

### Phase 1: Write Tests (TDD)

- [ ] 1.1 Add tests to `tests/unit/opening-hand.spec.ts` for `projectManaByTurn()`
  - Test case: hand with 3 lands, no dorks -> t1=1, t2=2, t3=3, t4=4 (assumes land draws)
  - Test case: hand with 2 lands + Llanowar Elves (CMC 1 dork) -> t2 includes dork source
  - Test case: hand with 1 untapped land + 1 tapped land -> t1=1, t2=2

- [ ] 1.2 Add tests for enhanced `scoreCardAdvantage()` with mana context
  - Test case: 3-CMC draw spell with 3 lands -> full weight (castable)
  - Test case: 3-CMC draw spell with 1 land, no ramp -> reduced weight (not castable early)
  - Test case: 1-CMC cantrip with 1 land -> full weight (castable T1)

- [ ] 1.3 Add tests for enhanced `scoreInteraction()` with mana context
  - Test case: 2-CMC removal with 2+ lands -> full weight
  - Test case: 2-CMC removal with 0 lands -> reduced weight

- [ ] 1.4 Add tests for commander-as-gameplan in `scoreStrategy()`
  - Test case: CMC 3 commander matching deck theme + 3 lands in hand -> strategy bonus
  - Test case: CMC 6 commander matching theme + 2 lands -> no bonus (can't cast early)
  - Test case: commander with no theme relevance + 3 lands -> no bonus
  - Test case: non-commander format (empty commandZone) -> no change to existing behavior

- [ ] 1.5 Add integration tests for `evaluateHandQuality()` with enhanced scoring
  - Test case: hand that perfectly curves into commander with theme alignment scores "Strong Keep"
  - Test case: hand with uncastable card advantage (high CMC, low lands) scores lower than castable equivalent

### Phase 2: Implement Core Logic

- [ ] 2.1 Add `projectManaByTurn()` to `src/lib/opening-hand.ts`
  - Signature: `export function projectManaByTurn(hand: HandCard[], untappedLandSources: string[][], allLandSources: string[][]): ManaProjection`
  - New type: `export interface ManaProjection { t1Mana: number; t2Mana: number; t3Mana: number; t4Mana: number; t2Sources: string[][]; t3Sources: string[][]; t4Sources: string[][]; dorks: { name: string; producedMana: string[]; availableTurn: number }[] }`
  - Internally calls `getManaProducers()` and extends with T4 projection

- [ ] 2.2 Enhance `scoreCardAdvantage()` in `src/lib/opening-hand.ts`
  - Add optional `manaProjection?: ManaProjection` parameter
  - When provided, multiply each spell's weight by castability factor (1.0 if castable at the turn matching its CMC, 0.3 otherwise)
  - Use `canCastWithLands()` against the projected sources for the appropriate turn
  - Backward compatible: without manaProjection, behavior is unchanged

- [ ] 2.3 Enhance `scoreInteraction()` in `src/lib/opening-hand.ts`
  - Same pattern as 2.2: add optional `manaProjection?: ManaProjection` parameter
  - Check castability of interaction spells against projected mana

- [ ] 2.4 Enhance `scoreStrategy()` in `src/lib/opening-hand.ts`
  - Add optional `commandZone?: HandCard[]` and `manaProjection?: ManaProjection` parameters
  - When commandZone is provided and commanders have theme relevance, check if the commander is castable by T4 given projected mana
  - If castable and theme-relevant, add a bonus to the raw strategy score (capped at 100)
  - Add reasoning about commander deployment to themeHits

- [ ] 2.5 Wire mana projection into `evaluateHandQuality()`
  - Compute `projectManaByTurn()` once at the top of the function (when context is provided)
  - Pass `manaProjection` to `scoreCardAdvantage()`, `scoreInteraction()`, and `scoreStrategy()`
  - Pass `commandZone` to `scoreStrategy()`

- [ ] 2.6 Update `generateReasoning()` for commander-as-gameplan
  - When strategy factors include commander deployment info, add reasoning like "Commander (Korvold) castable T4 -- sets up game plan"
  - When card advantage is in hand but uncastable, note "Card draw available but not castable in early turns"

### Phase 3: Verify & Refine

- [ ] 3.1 Run full test suite and fix any regressions
- [ ] 3.2 Spot-check with representative hands to verify scoring feels right
  - Hand A: 3 lands + Sol Ring + Rhystic Study + 2 theme cards -> should be Strong Keep
  - Hand B: 1 land + 3 expensive draw spells + 3 expensive threats -> should be Mulligan
  - Hand C: 3 lands + cheap ramp + CMC 4 commander (theme-relevant) -> should be Keepable+

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `tests/unit/opening-hand.spec.ts` | Modify | Add tests for mana projection, castability-aware scoring, commander-as-gameplan |
| `src/lib/opening-hand.ts` | Modify | Add `projectManaByTurn()`, enhance `scoreCardAdvantage()`, `scoreInteraction()`, `scoreStrategy()`, wire into `evaluateHandQuality()`, update `generateReasoning()` |

No changes to: `src/lib/types.ts`, `src/lib/card-tags.ts`, `src/lib/synergy-axes.ts`, `src/lib/synergy-engine.ts`, `src/lib/deck-analysis-aggregate.ts`, any UI components, any API routes, any e2e tests.

## Verification

1. `npm run test:unit` -- all unit tests pass, including new opening-hand tests
2. `npm run test:e2e` -- all e2e tests pass (no regressions)
3. `npm run build` -- production build succeeds
4. Manual: Import a commander deck (e.g., Korvold sacrifice), run hand analysis, verify:
   - Hands with early ramp into commander show "Commander castable" reasoning
   - Hands with uncastable draw spells show lower card advantage scores
   - Hands that coherently set up the deck's theme score higher than random good-stuff hands
