# Goldfish Simulator: Ramp Acceleration Accounting

## Context

The goldfish simulator (`src/lib/goldfish-simulator.ts`) runs Monte Carlo simulations of goldfishing — playing against an imaginary opponent with no interaction. It tracks mana development, spell casting, and commander timing across hundreds of iterations.

Currently, the simulator has three gaps in how it handles ramp and mana acceleration:

1. **Land-search ramp sorceries are no-ops.** Cards like Cultivate, Rampant Growth, and Kodama's Reach are correctly prioritized for casting (via the "Ramp" tag + `chooseSpellToCast` priority), but when `castSpell` resolves them, they simply go to the graveyard. The simulator never adds a land to the battlefield, so casting a 3-mana Cultivate produces zero benefit.

2. **Rituals produce no mana.** Instants and sorceries that generate temporary mana (Dark Ritual, Pyretic Ritual, Seething Song) go to the graveyard with no net mana effect. In real gameplay, Dark Ritual costs {B} and produces {B}{B}{B}, netting +2 mana for the turn.

3. **Mid-turn mana rocks don't contribute mana within the same turn.** When Sol Ring is cast on turn 1, the `remainingMana` tracker in the `executeTurn` loop only decreases — it never recomputes to include Sol Ring's 2 colorless mana. Artifacts don't have summoning sickness, so they should produce mana immediately after being cast.

### Pre-existing bug: `computeAvailableMana` ignores tapped state

`computeAvailableMana` (lines 203-218) iterates all lands on the battlefield and counts their mana **regardless of the `tapped` flag**. This means a land that enters tapped would be counted as producing mana on the same turn it enters. This must be fixed as part of this work, because land-search ramp adds a tapped land to the battlefield, and mid-turn recomputation would erroneously count it.

### Scope

**In scope:**
- Fixing `computeAvailableMana` to skip tapped permanents
- Simulating land-search ramp effects (add tapped basic land to battlefield)
- Simulating ritual net-mana for the current turn
- Recomputing available mana mid-turn after every spell cast
- Updating `manaAvailable` in turn logs to reflect end-of-turn state (captures ramp benefit)
- New unit tests validating each behavior
- Updating existing ramp-comparison test expectations

**Out of scope:**
- Treasure-producing spells (Dockside Extortionist, Smothering Tithe) — complex ETB/trigger effects
- "Additional land" effects (Exploration, Oracle of Mul Daya) — requires land-per-turn tracking changes
- Multi-land ramp nuances (Cultivate puts 1 onto battlefield + 1 into hand) — we simplify to 1 tapped land
- Color-aware land searching (fetching the "right" basic type) — use the cast spell's color identity

**Known limitations (acceptable for first pass):**
- Cards with non-standard mana phrasing (e.g., Manamorphose: "Add two mana in any combination of {R} and {G}") will not match the ritual regex. This is documented, not a bug.
- Hybrid/Phyrexian mana symbols in ritual output are not counted.

## Design Decisions

### Ramp Effect Classification

Rather than extending the tag system, we classify ramp effects at simulation time using oracle text analysis. This keeps the tag system focused on deck-level categorization while the simulator handles gameplay mechanics. The `classifyRampEffect` function gates on `Instant/Sorcery` type line — permanents with mana abilities are handled by the existing battlefield placement logic.

| Effect Type | Detection | Simulation |
|------------|-----------|------------|
| Land search | Oracle text matches `RAMP_LAND_SEARCH_RE` AND card is Instant/Sorcery | Add 1 tapped basic land to battlefield |
| Ritual | Oracle text matches `RITUAL_MANA_ADD_RE` (no `{T}` prefix) AND card is Instant/Sorcery | Add net mana (produced − CMC) to turn's remaining mana |
| Mana rock | Permanent with `producedMana.length > 0` AND not a creature | Already placed on battlefield; recompute mana mid-turn |
| Mana dork | Creature with `producedMana.length > 0` | Already placed on battlefield with summoning sickness; no mid-turn mana |

### Ritual Mana Estimation

Ritual mana production is hard to parse precisely from oracle text (e.g., "Add {B}{B}{B}" vs "Add {R}{R}{R}{R}{R}"). We use `matchAll` to count all mana symbol occurrences after "Add":

- Use `matchAll` with `/\{[WUBRGC]\}/g` on the oracle text following "Add" to count all mana symbols produced
- Net mana = total symbols produced − card's CMC
- If net mana > 0, add it to `remainingMana` for the current turn
- Cap net mana at 5 (safety valve for parser edge cases like Mana Geyser)

Note: Repeated capture groups in JS only return the last match. We must use `matchAll` or a separate counting regex, not a single repeated group.

### Land Search: Synthetic Land

When a land-search ramp spell resolves, we create a synthetic basic land permanent:
- Type: "Basic Land"
- Enters tapped (most search effects say "tapped")
- `producedMana`: Use the **cast spell's own color identity** as the best heuristic (a green ramp spell likely searches for a Forest). Falls back to scanning battlefield lands for dominant color, then "C".
- The synthetic land produces mana starting next turn (since it enters tapped and `computeAvailableMana` will be fixed to skip tapped permanents)

A synthetic `EnrichedCard` must be constructed in production code. Since the test-only `makeCard` helper is unavailable in the simulator, we add a `makeSyntheticLand(producedMana: string[])` factory function in `goldfish-simulator.ts` that creates a minimal `EnrichedCard` with only the fields needed by the simulation (`typeLine`, `producedMana`, `oracleText`, `keywords`, etc., with safe defaults for the rest).

### Fix: `computeAvailableMana` Must Respect Tapped State

Currently, `computeAvailableMana` counts all lands and non-sick mana producers regardless of `tapped`. This is wrong — tapped permanents cannot produce mana. The fix adds a `permanent.tapped` check:

```typescript
// For lands:
if (isLand(card) && !permanent.tapped) { ... }
// For mana producers:
if (isManaProducer(card) && !permanent.tapped) {
  const canAct = !permanent.summoningSick || hasHaste(card);
  if (canAct) { ... }
}
```

This is a prerequisite for land-search simulation. Without it, a tapped synthetic land would immediately contribute mana via mid-turn recomputation.

**Impact on existing behavior:** Currently all lands are untapped at the start of each turn via `untapAll()`, so the existing start-of-turn mana computation is unaffected. The only change is that mid-turn calls to `computeAvailableMana` (from `chooseSpellToCast` line 341, and the new recomputation) will correctly exclude tapped-entry lands.

### Mid-Turn Mana Recomputation: Always Recompute After Every Cast

Rather than conditionally recomputing only after artifact casts, **always recompute `remainingMana` after every spell cast**. This is simpler, eliminates conditional branching, and is correct by construction because `computeAvailableMana` already handles summoning sickness.

The cost is negligible — one linear scan of ≤30 battlefield permanents per cast.

After each cast:
```typescript
castSpell(state, choice.card, choice.isCommander);
manaUsed += cmc;
// Recompute: total available mana (respecting tapped + sickness) minus total spent
remainingMana = computeRemainingMana(state, manaUsed) + ritualBonusMana;
```

Where `computeRemainingMana` is a thin wrapper:
```typescript
function computeRemainingMana(state: GoldfishGameState, manaUsed: number): number {
  return sumManaPool(computeAvailableMana(state)) - manaUsed;
}
```

This works because `computeAvailableMana` (after the tapped-state fix) correctly excludes:
- Tapped lands (including just-entered tapped search lands)
- Summoning-sick creatures (mana dorks cast this turn)

And correctly includes:
- Non-creature artifacts with `producedMana` (mana rocks, no summoning sickness, untapped)

### No State Shape Change: Ritual Mana as Local Variable

Ritual mana is **turn-local bookkeeping**, not game state. Instead of adding `bonusMana` to `GoldfishGameState`, `castSpell` returns a `CastResult`:

```typescript
interface CastResult {
  bonusMana: number; // net ritual mana produced (0 for non-rituals)
}
```

The `executeTurn` loop accumulates ritual bonus mana in a local variable:

```typescript
let ritualBonusMana = 0;
// ... in loop:
const result = castSpell(state, choice.card, choice.isCommander);
ritualBonusMana += result.bonusMana;
manaUsed += cmc;
remainingMana = computeRemainingMana(state, manaUsed) + ritualBonusMana;
```

This keeps `GoldfishGameState` clean, avoids cross-turn leakage bugs, and requires no changes to `emptyGameState()` test helpers or `initializeGame()`.

### Update `manaAvailable` in Turn Logs

Currently, `manaAvailable` in `GoldfishTurnLog` is set at the start of the turn (line 524), before any ramp effects resolve. This means mid-turn mana rocks don't appear in `avgManaByTurn` or `rampAcceleration`.

Fix: recompute `manaAvailable` at the **end** of the turn to reflect "what mana do I have access to going into next turn." This captures ramp benefit for the acceleration metric:

```typescript
const manaAvailableEndOfTurn = sumManaPool(computeAvailableMana(state));
```

Use this for the turn log's `manaAvailable` field. The `rampAcceleration` stat (derived from `avgManaByTurn` at T4) will then correctly reflect acceleration from mana rocks cast during that turn.

### Render Hand Contents in Sample Game Timeline

Currently, `GoldfishTurnLog` tracks `handSize: number` but not the actual card names. The `GoldfishTurnTimeline` component shows "Hand Size: 6" but the user has no visibility into *which* cards are in hand — this makes it hard to follow the sample game's decision-making.

Fix:
- Add `hand: string[]` field to `GoldfishTurnLog` — the list of card names in hand at end of turn (after draws, land plays, and spell casts)
- Populate it in `executeTurn` by mapping `state.hand` to names
- Render it in `GoldfishTurnTimeline` as an expandable list below the existing hand size stat
- Only populate `hand` for the sample game (not all 1000 iterations) to avoid memory bloat — this is handled naturally since only the sample game's `GoldfishGameLog` is passed to the timeline component

## Implementation Tasks

### Phase 1: Export Ramp Regexes (prerequisite for compilation)

- [x]1.1 Export `RAMP_LAND_SEARCH_RE` from `src/lib/card-tags.ts`
  - Change `const RAMP_LAND_SEARCH_RE` to `export const RAMP_LAND_SEARCH_RE`
  - No functional change to tag generation

- [x]1.2 Add ritual detection regex to `src/lib/card-tags.ts`
  - `export const RITUAL_MANA_ADD_RE = /(?<!\{T\}[^.]*)[Aa]dd\s+\{[WUBRGC]\}/;`
  - Uses a negative lookbehind for `{T}` to exclude tap-for-mana abilities
  - The Instant/Sorcery type-line gate in `classifyRampEffect` is the primary filter; this regex is a secondary safety net
  - Note: This regex detects the *presence* of a mana-add clause. Counting total symbols produced uses a separate `matchAll` call with `/\{[WUBRGC]\}/g`

### Phase 2: Write Tests (TDD)

- [x]2.1 Add ramp classification tests to `tests/unit/goldfish-simulator.spec.ts`
  - Test: `classifyRampEffect` returns `"land-search"` for Rampant Growth-type sorcery
  - Test: `classifyRampEffect` returns `"ritual"` for Dark Ritual-type instant
  - Test: `classifyRampEffect` returns `null` for a creature with `producedMana`
  - Test: `classifyRampEffect` returns `null` for a non-ramp sorcery

- [x]2.2 Add `estimateRitualNetMana` tests
  - Test: Dark Ritual analog (CMC 1, "Add {B}{B}{B}.") → returns 2
  - Test: Pyretic Ritual analog (CMC 2, "Add {R}{R}{R}.") → returns 1
  - Test: Even-mana ritual (CMC 3, "Add {R}{R}{R}.") → returns 0
  - Test: High-output ritual capped at 5 (CMC 1, "Add {R}{R}{R}{R}{R}{R}{R}.") → returns 5
  - Test: Non-ritual card → returns 0

- [x]2.3 Add `simulateRampEffect` tests
  - Test: land-search sorcery adds a tapped land to the battlefield, returns 0 bonus mana
    - Set up state with 2 green lands on battlefield, cast a land-search ramp sorcery
    - Verify `state.battlefield` gains a new land permanent with `tapped: true`
    - Verify returned bonus mana is 0
  - Test: ritual instant returns net mana, does not modify battlefield
    - Cast a Dark Ritual analog → returns 2, no new permanents on battlefield
  - Test: non-ramp sorcery returns 0 and does not modify battlefield

- [x]2.4 Add `computeAvailableMana` tapped-state tests
  - Test: tapped land does NOT contribute mana
    - Battlefield has 1 untapped Forest + 1 tapped Forest → pool.G === 1
  - Test: tapped mana rock does NOT contribute mana
    - Battlefield has 1 tapped Sol Ring → pool.C === 0

- [x]2.5 Add mid-turn recomputation integration tests
  - Test: "Sol Ring cast mid-turn frees mana for another spell"
    - State: 2 lands (2 mana), hand has Sol Ring (CMC 1) + 2-CMC creature
    - Execute turn → both Sol Ring AND the creature should be cast (Sol Ring costs 1, produces 2, creature costs 2 — total 3 mana available with 2 lands + Sol Ring)
  - Test: "mana dork cast mid-turn does NOT free mana (summoning sickness)"
    - State: 2 lands, hand has Llanowar Elves (CMC 1, creature, producedMana: ["G"]) + 2-CMC creature
    - Execute turn → Elves cast, but creature NOT cast (only 1 remaining mana, dork is sick)

- [x]2.6 Add integration test: "deck with land-search ramp has higher T5 mana than no-ramp deck"
  - Strengthen the existing "deck with ramp" test (line 462) with strict assertions:
    - `expect(rampManaT5).toBeGreaterThan(noRampManaT5)` (strict, no tolerance)
    - `expect(rampResult.stats.rampAcceleration).toBeGreaterThan(0)`

- [x]2.7 Add integration test: "deck with mana rocks has higher T4 mana than no-ramp deck"
  - Build deck with 12 Sol Ring-like artifacts (CMC 1, producedMana: ["C"])
  - Compare against all-creature deck
  - Assert `rampAcceleration > 0` and `avgManaByTurn[3] > noRampManaT4`

### Phase 3: Implement Core Logic

- [x]3.1 Fix `computeAvailableMana` to respect tapped state in `src/lib/goldfish-simulator.ts`
  - Add `!permanent.tapped` guard to both the land branch (line 203) and the mana-producer branch (line 219)
  - This is the **prerequisite** for all other changes

- [x]3.2 Add `CastResult` interface and `makeSyntheticLand` factory to `src/lib/goldfish-simulator.ts`
  - `CastResult`: `{ bonusMana: number }`
  - `makeSyntheticLand(producedMana: string[])`: returns a `GoldfishCard` with a minimal `EnrichedCard` — set `typeLine: "Basic Land"`, `producedMana`, `oracleText: ""`, `keywords: []`, and safe defaults for all other required fields (`name: "Basic Land"`, `manaCost: ""`, `cmc: 0`, `colorIdentity: []`, `colors: []`, `supertypes: ["Basic"]`, `subtypes: []`, etc.)

- [x]3.3 Add `classifyRampEffect(card: GoldfishCard)` function to `src/lib/goldfish-simulator.ts`
  - Signature: `export function classifyRampEffect(card: GoldfishCard): RampEffectType | null`
  - Define `type RampEffectType = "land-search" | "ritual"`
  - Returns `"land-search"` if card type line includes "Instant" or "Sorcery" AND oracle text matches `RAMP_LAND_SEARCH_RE`
  - Returns `"ritual"` if card type line includes "Instant" or "Sorcery" AND oracle text matches `RITUAL_MANA_ADD_RE` AND `producedMana` is empty (to exclude permanents with mana abilities that happen to also be instants/sorceries via Adventure, etc.)
  - Returns `null` otherwise
  - Import `RAMP_LAND_SEARCH_RE` and `RITUAL_MANA_ADD_RE` from `card-tags.ts`

- [x]3.4 Add `estimateRitualNetMana(card: GoldfishCard)` function to `src/lib/goldfish-simulator.ts`
  - Signature: `export function estimateRitualNetMana(card: GoldfishCard): number`
  - Use `Array.from(card.enriched.oracleText.matchAll(/\{[WUBRGC]\}/g)).length` to count all mana symbols in oracle text
  - Subtract symbols that appear in cost-like patterns (before "Add") — or more simply, only count symbols *after* the first occurrence of "Add" in the oracle text
  - Net = count − `card.enriched.cmc`
  - Return `Math.max(0, Math.min(net, 5))` (floor at 0, cap at 5)

- [x]3.5 Add `simulateRampEffect(state, card)` function to `src/lib/goldfish-simulator.ts`
  - Signature: `export function simulateRampEffect(state: GoldfishGameState, card: GoldfishCard): number`
  - Exported for direct unit testing
  - Call `classifyRampEffect(card)`:
    - `"land-search"`: Determine produced color from the spell's `colorIdentity` (first color), falling back to scanning battlefield lands, then "C". Call `makeSyntheticLand([color])`, push onto `state.battlefield` with `tapped: true`, `summoningSick: false`, `enteredTurn: state.turn`. Return `0`.
    - `"ritual"`: Call `estimateRitualNetMana(card)`, return the result.
    - `null`: Return `0`.

- [x]3.6 Update `castSpell` to return `CastResult` in `src/lib/goldfish-simulator.ts`
  - Change signature from `function castSpell(...)​: void` to `function castSpell(...)​: CastResult`
  - In the non-permanent else branch (line 500-502), after pushing to graveyard, call `simulateRampEffect(state, card)` and store the bonus mana
  - For permanent casts and commander casts, return `{ bonusMana: 0 }`
  - For non-permanent casts, return `{ bonusMana: simulateRampEffect(state, card) }`

- [x]3.7 Add `computeRemainingMana` helper to `src/lib/goldfish-simulator.ts`
  - Signature: `function computeRemainingMana(state: GoldfishGameState, manaUsed: number): number`
  - Body: `return sumManaPool(computeAvailableMana(state)) - manaUsed`

- [x]3.8 Update `executeTurn` spell-casting loop in `src/lib/goldfish-simulator.ts`
  - Add `let ritualBonusMana = 0` before the loop
  - After `castSpell`, capture the `CastResult`:
    ```typescript
    const result = castSpell(state, choice.card, choice.isCommander);
    ritualBonusMana += result.bonusMana;
    manaUsed += cmc;
    remainingMana = computeRemainingMana(state, manaUsed) + ritualBonusMana;
    ```
  - Remove the old `remainingMana -= cmc` line
  - After the spell loop, recompute `manaAvailable` for the turn log:
    ```typescript
    const manaAvailableEndOfTurn = sumManaPool(computeAvailableMana(state));
    ```
  - Use `manaAvailableEndOfTurn` (instead of the pre-ramp `manaAvailable`) in the returned `GoldfishTurnLog`

### Phase 4: Render Hand Contents in Sample Game Timeline

- [x]4.1 Add `hand: string[]` field to `GoldfishTurnLog` interface in `src/lib/goldfish-simulator.ts`
  - Contains card names in hand at end of turn (after all draws, land plays, and spell casts)
  - This field is populated for all games but only rendered for the sample game; the memory cost per game is minimal (string arrays, not full card objects)

- [x]4.2 Populate `hand` in `executeTurn` in `src/lib/goldfish-simulator.ts`
  - At the end of `executeTurn`, before returning the `GoldfishTurnLog`, map `state.hand` to names:
    ```typescript
    hand: state.hand.map((c) => c.name),
    ```

- [x]4.3 Add hand rendering tests to `tests/unit/goldfish-simulator.spec.ts`
  - Test: "turn log includes hand contents after spells are cast"
    - Set up state with known hand, execute turn, verify `log.hand` contains expected remaining cards
  - Test: "hand shrinks after casting a spell and playing a land"
    - Start with hand of 3 cards (1 land + 1 castable creature + 1 expensive creature), 2 lands on battlefield
    - Execute turn → verify `log.hand` contains only the expensive creature

- [x]4.4 Render hand contents in `src/components/GoldfishTurnTimeline.tsx`
  - Add a "Hand" section below the existing "Spells Cast" section, following the same pattern:
    ```tsx
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Hand {log.hand.length > 0 && `(${log.hand.length})`}
      </p>
      {log.hand.length > 0 ? (
        <ul className="space-y-1">
          {log.hand.map((card, i) => (
            <li key={i} className="rounded bg-slate-900/50 px-2 py-1 text-slate-400">
              {card}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500 italic">Empty hand</p>
      )}
    </div>
    ```
  - Uses `text-slate-400` (lighter than spells' `text-slate-300`) to visually distinguish hand contents from active plays

- [x]4.5 Update e2e test for sample game timeline in `e2e/goldfish-tab.spec.ts`
  - Verify that expanded turn panels contain a "Hand" section
  - Verify hand items are rendered as list items

### Phase 5: Verify & Tighten

- [x]5.1 Run `npm run test:unit` — all unit tests pass (new + existing)
- [x]5.2 Run `npm run test:e2e` — all e2e tests pass (no regression)
- [x]5.3 Run `npm run build` — production build succeeds
- [x]5.4 Tighten the existing "deck with ramp has more mana" test (line 462-528)
  - Change `expect(rampManaT5).toBeGreaterThanOrEqual(noRampManaT5 - 1)` to `expect(rampManaT5).toBeGreaterThan(noRampManaT5)`
  - Change `expect(rampResult.stats.rampAcceleration).toBeGreaterThanOrEqual(0)` to `expect(rampResult.stats.rampAcceleration).toBeGreaterThan(0)`

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/card-tags.ts` | Modify | Export `RAMP_LAND_SEARCH_RE`; add and export `RITUAL_MANA_ADD_RE` |
| `src/lib/goldfish-simulator.ts` | Modify | Fix `computeAvailableMana` tapped check; add `CastResult`, `RampEffectType`, `makeSyntheticLand`, `classifyRampEffect`, `estimateRitualNetMana`, `simulateRampEffect`, `computeRemainingMana`; update `castSpell` return type, `executeTurn` loop + turn log; add `hand: string[]` to `GoldfishTurnLog` |
| `tests/unit/goldfish-simulator.spec.ts` | Modify | Add ramp classification, ritual net mana, simulate effect, tapped-mana, mid-turn recomputation, and hand-contents tests; tighten ramp comparison assertions |
| `src/components/GoldfishTurnTimeline.tsx` | Modify | Add "Hand" section rendering card names in hand at end of each turn |
| `e2e/goldfish-tab.spec.ts` | Modify | Add assertion for hand section in expanded turn panels |

No changes to: `src/lib/types.ts`, `src/lib/opening-hand.ts`, `src/app/`, `tests/helpers.ts`.

## Verification

1. `npm run test:unit` — all unit tests pass including new ramp effect tests
2. `npm run test:e2e` — all existing e2e tests pass (no regression)
3. `npm run build` — production build succeeds
4. Manual: Run the goldfish simulation on a deck with Sol Ring, Cultivate, and Dark Ritual; verify `avgManaByTurn` shows acceleration beyond baseline land drops, and `rampAcceleration` is positive
