# Improve Existing Card Tags

## Context

GitHub Issue #5 — Several cards are being mis-tagged by the heuristic tagging engine in `src/lib/card-tags.ts`. The problems fall into three categories:

1. **Ramp false positives** — Non-basic lands whose oracle text includes `{T}: Add {X}` are incorrectly tagged as Ramp. Regular lands that tap for mana are not ramp.
2. **Ramp false negatives** — Cards that produce mana via non-standard wording ("Add one mana of any color", "Add an amount of {G} equal to...") or search for lands via non-tap activated abilities are missed.
3. **Missing tag categories** — Card selection effects (look at top N / put in hand) and cost reduction effects have no tags.
4. **Board Wipe false negative** — Mass bounce effects ("Return all creatures to their owners' hands") are not detected.

### Cards called out in the issue

| Card | Expected | Actual | Root Cause |
|------|----------|--------|------------|
| Fertilid | Ramp | (none) | Activated ability uses counter removal, not tap — but `RAMP_LAND_SEARCH_RE` should match; verify Scryfall text |
| Halimar Depths | (none) | Ramp | Non-basic land matches `RAMP_TAP_ADD_RE` — needs land exclusion |
| Nesting Grounds | (none) | Ramp | Same as Halimar Depths |
| Etherium Sculptor | Cost Reduction | (none) | Cost reduction not detected |
| Cradle Clearcutter | Ramp | (none) | "Add an amount of {G}" doesn't match strict `Add\s+{G}` pattern |
| Arcane Signet | Ramp | (none) | "Add one mana of any color" doesn't match literal symbol pattern |
| Adaptive Omnitool | Card Advantage | (none) | Look/put-in-hand not detected |
| Ancient Stirrings | Card Advantage | (none) | Same as Adaptive Omnitool |
| Evacuation | Board Wipe | (none) | Mass bounce not in `BOARD_WIPE_RE` |

## Implementation Tasks

### 1. Fix Ramp false positives — exclude lands

- [x] Add a land type check: if `typeLine` contains "Land" (and is not already excluded as Basic Land), skip the `RAMP_TAP_ADD_RE` and `RAMP_MULTI_MANA_RE` patterns. Land search (`RAMP_LAND_SEARCH_RE`) should still apply to land-typed cards since fetching lands onto the battlefield *is* ramp even on a land (e.g., Krosan Verge).

### 2. Fix Ramp false negatives — broaden mana production patterns

- [x] Add pattern for "Add one mana of any color" / "Add {X} mana of any one color" / "Add one mana of any type" (covers Arcane Signet, Commander's Sphere, Chromatic Lantern, etc.)
- [x] Add pattern for "Add an amount of" / "Add X mana" (covers Cradle Clearcutter, Nykthos, etc.)
- [x] Verify Fertilid's Scryfall oracle text matches `RAMP_LAND_SEARCH_RE`; fix if needed

### 3. Add "Card Advantage" tag

- [x] Add `Card Advantage` to `TAG_COLORS` with a distinct color
- [x] Add regex for look/reveal + put-in-hand patterns: "look at the top ... put ... into your hand", "reveal ... put ... into your hand", "search your library for ... put ... into your hand" (only when not already tagged as Tutor)
- [x] Ensure literal "draw" effects remain tagged as "Card Draw" only (no double-tag)

### 4. Add "Cost Reduction" tag

- [x] Add `Cost Reduction` to `TAG_COLORS` with a distinct color
- [x] Add regex for cost reduction patterns: "cost(s) {N} less", "costs? less to cast", "Affinity" keyword detection

### 5. Fix Board Wipe — add mass bounce

- [x] Add pattern for "return all ... to ... hand(s)" to `BOARD_WIPE_RE` logic (covers Evacuation, Cyclonic Rift overloaded, etc.)

### 6. Write tests (TDD — tests first)

- [x] Add failing tests for each card in the issue table above
- [x] Add additional edge-case tests:
  - Non-basic land with `{T}: Add {C}` (e.g., Nesting Grounds) → no Ramp
  - Krosan Verge (land that searches for lands) → Ramp
  - Commander's Sphere ("Add one mana of any color") → Ramp
  - Chromatic Lantern → Ramp
  - Helm of Awakening ("Spells cost {1} less to cast") → Cost Reduction
  - Cyclonic Rift overloaded → Board Wipe
  - Impulse ("look at top 4, put one in hand") → Card Advantage
  - Brainstorm ("draw three cards") → Card Draw, NOT Card Advantage
- [x] Confirm all 190+ existing tests still pass after changes

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/card-tags.ts` | Modify — add land exclusion, new patterns, new tags |
| `e2e/card-tags.spec.ts` | Modify — add test cases for all issue cards + edge cases |

## Verification

- Run `npm test` — all tests pass with 0 failures
- Manually verify with Scryfall oracle text for each card in the issue table
