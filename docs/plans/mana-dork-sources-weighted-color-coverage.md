# Mana Dork Sources & Weighted Color Coverage for Hand Quality

## Context

The hand quality evaluator in `src/lib/opening-hand.ts` has two gaps in how it models mana availability:

**1. Mana dorks are invisible as mana sources.** The T1/T2/T3 playability checks (`canCastWithLands`) partition the hand into `lands` (where `typeLine.includes("Land")`) and `spells` (everything else). Only lands feed into `allLandSources` and `untappedLandSources`. A mana dork like Llanowar Elves — which has `producedMana: ["G"]` from Scryfall and a Ramp tag — is treated purely as a castable spell. A hand with [Forest, Llanowar Elves, 3-drop green spell] marks T2 as unplayable because it sees only 1 land, even though the Elves realistically provide the second green mana on T2. This under-values hands with early mana dorks and inflates mulligan rates in creature-ramp-heavy decks.

**2. Color coverage is a flat binary check.** The formula `coveredCount / neededColors.length` treats every commander identity color equally. In an Abzan deck where 60% of pips are green, 30% white, and 10% black, having only a Swamp scores 33% coverage — identical to having only a Forest. The deck's actual pip demand per color is already computed in `color-distribution.ts` (`ColorDistribution.pips`) but is not wired into hand evaluation. This means hands heavy in barely-used colors score the same as hands heavy in the deck's primary color.

**Intended outcome:** T2/T3 playability considers mana dorks played on earlier turns as additional sources. Color coverage is weighted by the deck's pip demand so that missing a high-demand color hurts more than missing a low-demand one.

**Scope:** Changes are limited to `src/lib/opening-hand.ts` and its test file. The `HandEvaluationContext` interface gains an optional `pipWeights` field. No UI changes — the existing score/verdict display adapts automatically. The `color-distribution.ts` module is read-only (we reuse its types, not modify it). Mana dorks only contribute to T2+ checks (they need a turn to become active); T1 remains land-only.

## Design Decisions

### Mana Dork Source Modeling

A non-land card is a **mana dork** if:
- `producedMana.length > 0` (Scryfall says it makes mana)
- `!typeLine.includes("Land")` (not a land)
- `cmc <= 2` (castable T1 or T2 — expensive mana producers like Gilded Lotus don't contribute to early turns reliably)

Mana dorks contribute to playability checks with a **one-turn delay**:
- **T1:** Land sources only (unchanged). Dorks can't tap the turn they're played (summoning sickness).
- **T2:** Land sources + dorks with CMC ≤ 1 that can be cast T1 (they were played T1, can tap T2). This requires the dork itself to be castable with the untapped land sources.
- **T3:** Land sources + dorks with CMC ≤ 2 that can be cast T2 (they were played T1 or T2, can tap T3).

The T2 check also needs to account for the land "spent" casting the dork. However, since we're checking whether *any* spell in the hand is castable on T2 with the combined sources, and the dork contributes an *additional* source beyond the lands, the net effect is: `landCount + castableDorkCount` available sources on T2. We don't need to subtract the land used for the dork because we're doing bipartite matching — if a land is allocated to satisfy the dork's pip, it won't double-count for the spell being checked. Instead, we simply extend the land source arrays with dork-produced colors for T2/T3 checks.

**Important constraint:** A dork's `producedMana` is added as an additional source entry, but we must verify the dork is actually castable with the available lands first. A Birds of Paradise (`{G}`) in a hand with only Islands cannot contribute `["W","U","B","R","G"]` to T2 sources.

**Helper function:** `getManaProducers(hand, untappedLandSources, allLandSources)` returns `{ t2Sources: string[][], t3Sources: string[][] }` — the land sources extended with castable mana dork production.

### Weighted Color Coverage

Replace the flat `coveredCount / neededColors.length` with pip-demand-weighted coverage.

**Data source:** `ColorDistribution.pips` from `color-distribution.ts` provides total pip demand per color across the deck. We normalize this into per-color weights that sum to 1.0.

**New optional field on `HandEvaluationContext`:**
```typescript
pipWeights?: Record<string, number>; // normalized pip demand per color, sums to ~1.0
```

The caller (`HandSimulator.tsx`) computes this once from `computeColorDistribution()` and passes it through context. When `pipWeights` is not provided (backward compat / no-context path), the existing equal-weight formula is preserved.

**Formula:**
```
totalPips = sum of pips for colors in commander identity
For each color c in identity:
  weight_c = pips[c] / totalPips
colorCoverage = sum(weight_c for each c where availableColors.has(c))
```

Example: Abzan deck with pips G=60, W=30, B=10 → totalPips=100
- Hand has Forest + Plains → coverage = 0.60 + 0.30 = 0.90 (great)
- Hand has only Swamp → coverage = 0.10 (terrible)
- Old formula would give 0.67 and 0.33 respectively

**Edge cases:**
- Zero total pips (colorless deck) → coverage = 1.0
- Color in identity with 0 pips (e.g., splash with no spells yet) → 0 weight, doesn't hurt coverage
- No context provided → fall back to existing equal-weight formula

### No Changes to `canCastWithLands`

The bipartite matching function itself doesn't change. We only change *what source arrays* are passed to it for T2/T3 checks.

## Implementation Tasks (TDD)

### Phase 1: Tests for `getManaProducers`

- [ ] 1.1 Export `getManaProducers` function from `src/lib/opening-hand.ts` (stub that returns `{ t2Sources: allLandSources, t3Sources: allLandSources }` — no dork contribution yet)
- [ ] 1.2 Add test block in `tests/unit/opening-hand.spec.ts` with cases:
  - Llanowar Elves (CMC 1, `{G}`, produces `["G"]`) + Forest + Mountain → T2 sources include `["G"]` from Elves
  - Birds of Paradise (CMC 1, `{G}`, produces `["W","U","B","R","G"]`) + Forest → T2 sources include 5-color entry
  - Dork not castable: Birds of Paradise + Island only → T2 sources do NOT include dork (can't cast `{G}` with Island)
  - CMC 2 dork: Bloom Tender (CMC 2, produces `["G"]`) + 2 Forests → T2 sources do NOT include it (CMC 2 can't be cast T1), T3 sources DO include it
  - CMC 3+ dork excluded: Selvala (CMC 3) + 3 lands → neither T2 nor T3 sources include it
  - Non-producer spell ignored: Sol Ring (CMC 1, produces `["C"]`) + Forest → T2 sources include `["C"]` from Sol Ring (it produces mana)
  - Land-type mana producers excluded: Dryad Arbor (`typeLine: "Land Creature"`) should NOT appear as a dork (it's already a land)
  - Multiple dorks: Elves + Birds + Forest → T2 has both dork entries
  - No dorks: just lands → T2/T3 sources equal land sources

### Phase 2: Implement `getManaProducers`

- [ ] 2.1 Implement the function in `src/lib/opening-hand.ts`
  - Function signature: `export function getManaProducers(hand: HandCard[], untappedLandSources: string[][], allLandSources: string[][]): { t2Sources: string[][]; t3Sources: string[][] }`
  - Identify mana dorks: `!isLand && producedMana.length > 0 && cmc <= 2`
  - For T2: filter dorks with `cmc <= 1` that are castable via `canCastWithLands(dork.enriched, untappedLandSources)`
  - For T3: filter dorks with `cmc <= 2` that are castable via `canCastWithLands(dork.enriched, allLandSources)`
  - Return land sources extended with each castable dork's `producedMana`
- [ ] 2.2 Run tests, confirm pass

### Phase 3: Tests for weighted color coverage

- [ ] 3.1 Add test block in `tests/unit/opening-hand.spec.ts` with cases:
  - `computePipWeights` with pips G=60, W=30, B=10, identity={W,B,G} → weights G=0.6, W=0.3, B=0.1
  - Pips G=50, W=50, identity={W,G} → weights G=0.5, W=0.5
  - Single color identity={G}, pips G=40 → weight G=1.0
  - Zero pips for a color in identity: pips G=30, W=0, identity={W,G} → weight G=1.0, W=0.0
  - Empty identity → returns empty record
  - evaluateHandQuality with pipWeights: Abzan hand with only Swamp, pipWeights B=0.1,W=0.3,G=0.6 → colorCoverage ~0.1
  - evaluateHandQuality with pipWeights: same deck, hand with Forest+Plains → colorCoverage ~0.9
  - evaluateHandQuality WITHOUT context → colorCoverage uses equal weights (backward compat)

### Phase 4: Implement weighted color coverage

- [ ] 4.1 Export `computePipWeights` from `src/lib/opening-hand.ts`
  - Function signature: `export function computePipWeights(pips: Record<string, number>, commanderIdentity: Set<string>): Record<string, number>`
  - Sum pips for colors in identity, normalize each to fraction
  - Return empty record if identity is empty or total pips is 0
- [ ] 4.2 Add optional `pipWeights?: Record<string, number>` field to `HandEvaluationContext`
- [ ] 4.3 Update `evaluateHandQuality` color coverage section:
  - When `context?.pipWeights` exists and has entries: use weighted sum
  - Otherwise: preserve existing equal-weight formula
- [ ] 4.4 Run tests, confirm pass

### Phase 5: Wire mana dorks into evaluateHandQuality

- [ ] 5.1 Add tests for T2/T3 playability with mana dorks:
  - Hand [Forest, Llanowar Elves, 3-CMC green spell] → `playableTurns[1]` is `true` (Elves provide T2 source)
  - Hand [Island, Llanowar Elves, 3-CMC green spell] → `playableTurns[1]` is `false` (can't cast Elves T1)
  - Hand [Forest, Forest, Bloom Tender (CMC 2), 3-CMC green spell] → `playableTurns[1]` is `true` via lands alone, `playableTurns[2]` benefits from Tender as extra source
  - T1 unchanged: [Forest, Llanowar Elves] → Elves itself is T1 playable, but Elves doesn't count as T1 mana source for other spells
- [ ] 5.2 In `evaluateHandQuality`, call `getManaProducers` and use `t2Sources` / `t3Sources` for T2/T3 checks:
  ```typescript
  const { t2Sources, t3Sources } = getManaProducers(hand, untappedLandSources, allLandSources);
  // T2: canCastWithLands(spell, t2Sources) instead of allLandSources
  // T3: canCastWithLands(spell, t3Sources) instead of allLandSources
  ```
  Also update the T2 land count gate: `landCount + t2DorkCount >= 2` (a hand with 1 land + 1 castable dork has 2 mana on T2)
  Similarly for T3: `landCount + t3DorkCount >= 3`
- [ ] 5.3 Run tests, confirm pass

### Phase 6: Wire pipWeights in HandSimulator

- [ ] 6.1 In `src/components/HandSimulator.tsx`, compute `pipWeights` from `computeColorDistribution` and pass through context:
  ```typescript
  import { computeColorDistribution, resolveCommanderIdentity } from "@/lib/color-distribution";
  import { computePipWeights } from "@/lib/opening-hand";
  // In useMemo for context:
  const distribution = computeColorDistribution(deck, cardMap);
  const identity = resolveCommanderIdentity(deck, cardMap);
  const pipWeights = computePipWeights(distribution.pips, identity);
  context.pipWeights = pipWeights;
  ```
- [ ] 6.2 Do the same in `src/components/HandBuilder.tsx` if it constructs its own context
- [ ] 6.3 Verify no TypeScript errors in components

### Phase 7: Verification

- [ ] 7.1 `npm run test:unit` — all pass
- [ ] 7.2 `npm run test:e2e` — all pass
- [ ] 7.3 `npm run build` — succeeds
- [ ] 7.4 Manual: import a multi-color deck, check that hands with mana dorks show improved T2/T3 playability and that color coverage varies by pip demand

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/opening-hand.ts` | Modify | Add `getManaProducers`, `computePipWeights`. Update `HandEvaluationContext` with `pipWeights`. Update `evaluateHandQuality` T2/T3 checks and color coverage. |
| `tests/unit/opening-hand.spec.ts` | Modify | Add test blocks for `getManaProducers`, `computePipWeights`, weighted color coverage, and dork-aware playability integration tests. |
| `src/components/HandSimulator.tsx` | Modify | Compute `pipWeights` from `computeColorDistribution` and pass through context. |
| `src/components/HandBuilder.tsx` | Modify | Same — compute and pass `pipWeights` if it builds its own context. |

No changes to: `src/lib/color-distribution.ts`, `src/lib/mana.ts`, `src/lib/card-tags.ts`, `src/lib/types.ts`, `src/lib/scryfall.ts`, any API routes, or any other component files.

## Key Reuse

- `canCastWithLands` from `src/lib/opening-hand.ts` — verify dork castability before adding it as a source
- `ColorDistribution.pips` / `ColorCounts` from `src/lib/color-distribution.ts` — pip demand data
- `computeColorDistribution` / `resolveCommanderIdentity` from `src/lib/color-distribution.ts` — called in components
- `makeCard` / `makeDeck` from `tests/helpers.ts` — test fixtures
- `HandEvaluationContext` from `src/lib/opening-hand.ts` — extended with `pipWeights`

## Verification

1. `npm run test:unit` — all unit tests pass
2. `npm run test:e2e` — all e2e tests pass
3. `npm run build` — production build succeeds
4. Manual: import a Gruul or Abzan deck with mana dorks (Llanowar Elves, Birds of Paradise), run hand simulation, verify T2 playability rates increase. Check that hands missing the primary color score lower on color coverage than hands missing a splash color.
