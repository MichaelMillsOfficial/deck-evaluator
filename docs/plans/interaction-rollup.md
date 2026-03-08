# Interaction Rollup — Group Repetitive Interactions

## Context

When a card like "No One Left Behind" can recur every creature in the deck, the interaction engine produces N individual interactions — one per creature. The same pattern applies to any card that interacts broadly: a sacrifice outlet enables sacrificing every creature, a mass recursion spell recurs every graveyard target, etc. This floods the Interactions panel with repetitive entries like:

- "No One Left Behind recurs Basal Sliver"
- "No One Left Behind recurs Lazotep Sliver"
- "No One Left Behind recurs Spiteful Sliver"
- ... (15 more)

The fix is a **UI-level rollup** that groups these into a single entry "No One Left Behind recurs 15 creatures" with an expandable sub-list. The interaction detector continues producing individual interactions (needed for chains/loops/enablers), but the display compacts them.

**In scope**: Rollup algorithm, summary text generation (using card type info from profiles), new `RolledUpInteractionItem` component, integration into InteractionSection render loop.

**Out of scope**: Changes to the interaction detector itself, changes to chains/loops/enablers display.

## Design Decisions

### D1: Rollup is purely a display concern

The detector keeps producing individual `Interaction[]` entries. A new pure utility function `rollUpInteractions()` in `src/lib/interaction-rollup.ts` transforms them into a mix of rolled-up groups and individual entries for rendering. This keeps the core engine unchanged and the rollup logic independently testable.

### D2: Grouping key is `(anchorCard, type, anchorRole)`

An interaction `{ cards: [A, B], type: "recurs" }` can group by anchor=A (A recurs many targets) or anchor=B (B is recurred by many sources). Both directions are computed; the one with more members wins. Threshold: **3+ interactions** to form a rollup group.

### D3: Summary text uses card type classification

Use `analysis.profiles` to determine what the target cards are:
- All creatures → "15 creatures"
- All share a subtype (≥80%) → "12 Slivers"
- All permanents → "8 permanents"
- Mixed → "15 cards"

### D4: Greedy assignment prevents double-counting

An interaction can appear in at most one rollup group. Candidate groups are processed largest-first; consumed interactions are removed from subsequent candidates.

### D5: Expandable sub-list reuses existing disclosure pattern

Follows the `ChainItem` "Step-by-step breakdown" pattern: toggle button with rotating chevron, `grid-rows-[0fr]/[1fr]` animation, `aria-expanded`/`aria-controls`. Sub-rows are compact: `[CardPill] [truncated mechanical text] [StrengthBar]`.

## Implementation Tasks

### Phase 1: Write Tests (TDD)

- [x] 1.1 Create `tests/unit/interaction-rollup.spec.ts`
  - Test: 2 interactions with same anchor — no rollup (below threshold)
  - Test: 3+ interactions with same anchor + type → produces 1 rollup group
  - Test: greedy assignment — interaction consumed by one group doesn't appear in another
  - Test: bidirectional — picks direction with more interactions
  - Test: summary text — all creatures → "creatures", all Slivers → "Slivers", mixed → "cards"
  - Test: strength — maxStrength and avgStrength computed correctly
  - Test: individual interactions not in any group remain as `kind: "individual"` entries
  - Test: rollup entries sort before individual entries

### Phase 2: Implement Rollup Logic

- [x] 2.1 Create `src/lib/interaction-rollup.ts`
  - Export types: `RolledUpGroup`, `IndividualInteraction`, `DisplayInteractionItem`
  - Export function: `rollUpInteractions(interactions: Interaction[], profiles: Record<string, CardProfile>): DisplayInteractionItem[]`
  - Export const: `INTERACTION_VERBS` map (type → { sourceVerb, targetVerb })
  - Internal function: `classifyTargets(targetCards: string[], profiles): string` (→ "creatures", "Slivers", "cards")
  - Internal function: `pluralize(noun: string): string`

### Phase 3: Add UI Components

- [x] 3.1 Add `RolledUpInteractionItem` component in `InteractionSection.tsx`
  - Header: type badge, anchor card pill, verb, count + noun ("recurs 15 creatures"), strength bar
  - Toggle button: "Show N interactions" with chevron
  - Expandable sub-list: grid-rows animation, `RolledUpSubRow` per target card

- [x] 3.2 Add `RolledUpSubRow` component in `InteractionSection.tsx`
  - Compact row: `CardPill` + truncated mechanical text + `StrengthBar`
  - Hover state: `hover:bg-slate-700/20`

### Phase 4: Integrate into InteractionSection

- [x] 4.1 Modify `InteractionSectionInner` in `InteractionSection.tsx`
  - Add `useMemo` after `groups` to apply `rollUpInteractions()` to each group
  - Update render loop to discriminate on `item.kind` ("rollup" vs "individual")
  - Update pagination: `ShowMoreButton` counts `DisplayInteractionItem` entries, not raw interactions
  - Group header still shows raw interaction count: `ENABLES (46)` — the total, not the display count

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/interaction-rollup.ts` | Create | Pure rollup algorithm, types, summary text generation |
| `tests/unit/interaction-rollup.spec.ts` | Create | Unit tests for rollup logic |
| `src/components/InteractionSection.tsx` | Modify | Add RolledUpInteractionItem/SubRow, integrate rollup into render |

No changes to: `src/lib/interaction-engine/interaction-detector.ts`, `src/lib/interaction-engine/types.ts`, API routes, or any other components.

## Verification

1. `npm run test:unit` — all unit tests pass including new rollup tests
2. `npm run build` — production build succeeds
3. Manual: Import a Sliver deck and verify:
   - Repetitive interactions (e.g., "No One Left Behind recurs X" × 15) are rolled up into a single entry
   - Rolled-up entry shows correct count and type noun ("15 creatures" or "12 Slivers")
   - Expanding the sub-list shows individual target cards with strength bars
   - Individual interactions (not part of any rollup) still display normally
   - Group header counts still reflect total raw interactions
