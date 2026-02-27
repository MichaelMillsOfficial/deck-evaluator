# Fix: Exclude Commander from Opening Hand Draw Pool (#34)

## Context

In Magic: The Gathering's Commander format, the commander starts in the **command zone**, not in the library. It is always available to be cast and should never appear in a randomly drawn opening hand. However, the current implementation of `buildPool` in `src/lib/opening-hand.ts` includes commanders in the draw pool:

```typescript
const cards = [...deck.commanders, ...deck.mainboard];
```

This means commanders can be randomly drawn into simulated opening hands, which is incorrect for Commander rules. The same issue exists in `src/lib/hypergeometric.ts`, where `getLibraryCards` includes commanders in library-size calculations — the library should be 99 cards (mainboard only), not 100.

The fix must exclude commanders from the draw pool and library-size calculations while still treating the commander as **always available to cast** when evaluating hand quality. For example, a 2-CMC commander should count as a turn-2 play when scoring curve playability, even though it's not physically in the hand. The UI should also display the commander in a "Command Zone" indicator alongside drawn hands so users understand the commander is always accessible.

**In scope:** Pool exclusion, library-size fix, hand quality evaluation with command zone awareness, command zone UI display, test updates.

**Out of scope:** Partner commanders (multiple commanders) are handled naturally since the code already supports `deck.commanders` as an array. No special partner logic needed.

## Design Decisions

### Command Zone Awareness in Hand Quality

`evaluateHandQuality` currently only considers cards physically in the hand for curve playability. We will add an optional `commandZone` parameter so commanders are checked as always-available spells for the turn-1/2/3 playability analysis. Commanders do **not** count toward land count, ramp count, or other hand-composition metrics — only curve castability.

### Command Zone UI Display

When displaying a drawn hand (in `HandDisplay`) or simulation results, show a small "Command Zone" row above the hand cards listing each commander with its image/mana cost. This uses the existing card rendering patterns (image fallback with ManaCost).

| Token | Tailwind Classes |
|-------|-----------------|
| Command zone container | `rounded-lg border border-purple-500/30 bg-purple-950/20 p-2` |
| Label | `text-[10px] font-semibold uppercase tracking-wide text-purple-400` |
| Commander card | Same card rendering as hand cards but with purple accent border |

### HandBuilder Behavior

Since `buildPool` will no longer include commanders, the `HandBuilder` card picker will automatically exclude them — no additional changes needed to `HandBuilder.tsx` beyond receiving the new pool. The command zone display will be shown above the card picker so users see their commander is always available.

## Implementation Tasks

### Phase 1: Update Unit Tests (TDD)

- [ ] 1.1 Update `tests/unit/opening-hand.spec.ts` — flip the `buildPool` "includes commanders in pool" test
  - Rename to "excludes commanders from pool"
  - Assert `pool.some(c => c.name === "Atraxa")` is `false`
  - Assert pool length is 1 (only Sol Ring)

- [ ] 1.2 Add new test: `buildPool` returns correct count for deck with commanders
  - Deck with 2 commanders + 5 mainboard cards
  - Assert pool length is 5 (mainboard only)

- [ ] 1.3 Add new test: `evaluateHandQuality` considers command zone for curve playability
  - Hand with 2 lands, 1 high-CMC spell; commander has CMC 1
  - Without `commandZone`: T1 not playable
  - With `commandZone` containing the 1-CMC commander: T1 is playable
  - Assert higher score with command zone awareness

- [ ] 1.4 Add new test in `tests/unit/hypergeometric.spec.ts` (or inline): `getDeckSize` excludes commanders
  - Deck with 1 commander + 99 mainboard
  - Assert `getDeckSize` returns 99

### Phase 2: Fix Core Logic — `opening-hand.ts`

- [ ] 2.1 Update `buildPool` to exclude commanders
  - Change line 92 from `[...deck.commanders, ...deck.mainboard]` to `[...deck.mainboard]`
  - Update JSDoc comment accordingly

- [ ] 2.2 Add `buildCommandZone` helper function
  - Signature: `export function buildCommandZone(deck: DeckData, cardMap: Record<string, EnrichedCard>): HandCard[]`
  - Same mapping logic as `buildPool` but only for `deck.commanders`

- [ ] 2.3 Update `evaluateHandQuality` to accept optional `commandZone` parameter
  - Add parameter: `commandZone: HandCard[] = []`
  - In the playable-turns analysis, check both `spells` and `commandZone` cards when determining if a spell is castable on T1/T2/T3
  - Commander cards from command zone count as playable spells but do NOT affect `landCount`, `rampCount`, or `colorCoverage`

- [ ] 2.4 Update `runSimulation` to accept and pass through `commandZone`
  - Add parameter: `commandZone: HandCard[] = []`
  - Pass `commandZone` to `evaluateHandQuality` inside the loop

- [ ] 2.5 Update `findTopHands` to accept and pass through `commandZone`
  - Add parameter: `commandZone: HandCard[] = []`
  - Pass `commandZone` to `evaluateHandQuality` inside the loop

### Phase 3: Fix Core Logic — `hypergeometric.ts`

- [ ] 3.1 Update `getLibraryCards` to exclude commanders
  - Change from `[...deck.commanders, ...deck.mainboard]` to `[...deck.mainboard]`
  - Update JSDoc comment

### Phase 4: Update Components

- [ ] 4.1 Update `HandSimulator.tsx`
  - Add `commandZone` memo: `useMemo(() => buildCommandZone(deck, cardMap), [deck, cardMap])`
  - Pass `commandZone` to `runSimulation`, `findTopHands`, and `evaluateHandQuality` calls
  - Pass `commandZone` to `HandDisplay` and `HandBuilder` as a prop

- [ ] 4.2 Update `HandDisplay.tsx` to show command zone
  - Accept `commandZone?: HandCard[]` prop
  - When non-empty, render a "Command Zone" section above hand cards
  - Use purple-accent styling per design decisions table
  - Show commander card image (or fallback) and mana cost

- [ ] 4.3 Update `HandBuilder.tsx` to show command zone
  - Accept `commandZone?: HandCard[]` prop
  - When non-empty, render a "Command Zone" display above the card picker
  - Commanders are shown for reference but are not selectable (they're always available)

### Phase 5: Update E2E Tests

- [ ] 5.1 Update `e2e/opening-hand-ui.spec.ts`
  - Add test: "Drawn hand does not contain commander cards"
    - Draw a hand, verify no card in the hand display matches "Atraxa"
  - Add test: "Command zone shows commander when drawing hand"
    - After drawing, verify a command zone element is visible with commander name
  - Existing tests should continue passing since they don't assert Atraxa appears in hand

- [ ] 5.2 Update `e2e/hand-analysis.spec.ts`
  - Add test: "Hand builder does not list commander in card picker"
    - Expand hand builder, verify `card-picker-row-atraxa-praetors-voice` is NOT visible
  - Add test: "Hand builder shows command zone above card picker"
    - Verify command zone display is visible with commander info
  - Existing tests should continue passing since they check for sol-ring/command-tower (mainboard cards)

### Phase 6: Verification

- [ ] 6.1 Run `npm run test:unit` — all unit tests pass
- [ ] 6.2 Run `npm run test:e2e` — all e2e tests pass
- [ ] 6.3 Run `npm run build` — production build succeeds

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/opening-hand.ts` | Modify | Exclude commanders from `buildPool`, add `buildCommandZone`, update `evaluateHandQuality`/`runSimulation`/`findTopHands` signatures |
| `src/lib/hypergeometric.ts` | Modify | Exclude commanders from `getLibraryCards` |
| `src/components/HandSimulator.tsx` | Modify | Build command zone, pass to child components and evaluation functions |
| `src/components/HandDisplay.tsx` | Modify | Add command zone UI section |
| `src/components/HandBuilder.tsx` | Modify | Add command zone display above card picker |
| `tests/unit/opening-hand.spec.ts` | Modify | Flip commander-in-pool test, add command zone tests |
| `tests/unit/hypergeometric.spec.ts` | Modify | Add getDeckSize excludes commanders test |
| `e2e/opening-hand-ui.spec.ts` | Modify | Add commander exclusion and command zone UI tests |
| `e2e/hand-analysis.spec.ts` | Modify | Add hand builder commander exclusion tests |

No changes to: `src/lib/types.ts`, `src/lib/card-tags.ts`, `src/lib/color-distribution.ts`, `src/components/TopHands.tsx`, `src/components/HandSimulationStats.tsx`, `src/components/ManaCost.tsx`, `src/components/ManaSymbol.tsx`

## Verification

1. `npm run test:unit` — all unit tests pass, including new command zone tests
2. `npm run test:e2e` — all e2e tests pass, including commander exclusion assertions
3. `npm run build` — production build succeeds
4. Manual smoke test: Import a Commander deck (e.g., Atraxa with 99 mainboard), go to Hands tab, draw a hand — verify commander never appears in the drawn cards and is shown in a "Command Zone" indicator
