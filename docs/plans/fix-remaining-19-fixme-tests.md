# Fix Remaining 19 Fixme Tests in the Interaction Engine

## Context

The interaction engine test suite has 19 `test.fixme()` tests remaining across 5 test files. These tests were written TDD-first to specify expected behavior for the interaction detector, but the implementation hasn't caught up yet. The previous round of work fixed 60 tests by adding oracle text fallback patterns to `interaction-detector.ts`.

The 19 remaining tests fall into three layers of the pipeline:
1. **Capability extractor gaps** (6 tests): The `profileCard()` function in `capability-extractor.ts` fails to extract certain events/capabilities from oracle text (lifelink → gain_life, "draw a card" → draw event, variable token creation "create X tokens", enchantment-specific triggers, zone cast permissions).
2. **Interaction detector oracle pattern gaps** (5 tests): The detector's oracle fallback functions miss shared-theme synergies (extra combat phases, equipment death triggers, permanent ETB triggers, replacement-effect-based draw synergy).
3. **Loop detection gaps** (8 tests): Multi-card combos and bidirectional trigger cycles aren't assembled into loops. Some depend on fixes in layers 1 and 2 to produce the trigger edges that the loop detector then composes into cycles.

The key insight for a holistic approach: **6 generic fixes cover all 19 tests**. Rather than 19 individual patches, we can add 3 generic extractors in the capability extractor and 3 generic pattern groups in the interaction detector, each fixing multiple tests at once.

### Scope

**In scope:** All 19 `test.fixme()` tests across these files:
- `tests/unit/interaction-triggers.spec.ts` (8 fixmes)
- `tests/unit/interaction-loops-chains.spec.ts` (7 fixmes)
- `tests/unit/interaction-blockers-conflicts.spec.ts` (1 fixme)
- `tests/unit/interaction-l3-judge.spec.ts` (2 fixmes)
- `tests/unit/interaction-nuanced-synergy.spec.ts` (0 fixmes — this file's fixmes were resolved in the previous round, but listed for completeness since it's part of the test suite)

**Out of scope:** Changes to the lexer, parser, or keyword-database. All fixes go through oracle text fallback mechanisms in the capability extractor and interaction detector, keeping the structured pipeline intact.

## Design Decisions

### D1: Fix at the capability extractor level vs. interaction detector level

Several tests (e.g., "Curiosity causes draw events", "Archangel of Thune lifelink triggers itself") test `CardProfile` fields directly, not pairwise interactions. These **must** be fixed in `capability-extractor.ts` because the tests assert on `causesEvents`, `triggersOn`, or `zoneCastPermissions` arrays on the profile object itself.

Other tests (e.g., "Aurelia synergizes with Combat Celebrant") only assert on pairwise interaction results, so they can be fixed with oracle pattern matching in `interaction-detector.ts`.

The split: capability extractor for profile-level assertions, interaction detector for pairwise interaction assertions.

### D2: Oracle text fallback vs. structured parser changes

All fixes use oracle text regex fallbacks rather than modifying the lexer/parser pipeline. This is consistent with the approach in the previous round (which fixed 60 tests) and avoids risk of regressions in the structured pipeline. The capability extractor already has precedent for oracle fallbacks (`detectOracleTokenCreation`, `detectOracleStaticEffects`, `detectOracleCausedEvents`).

### D3: Loop detection via trigger graph cycle detection

The current `detectLoops()` in the interaction detector builds an adjacency graph from `enables` and `triggers` edges and finds cycles via DFS. This already works mechanically — the problem is that the edges don't exist because the capability extractor doesn't produce the right events. Once fixes D1 produces correct `causesEvents`/`triggersOn`, many loop tests will pass automatically. For the remaining loop tests (Isochron Scepter, Mikaeus, Kitchen Finks), we add oracle-based pairwise interaction detection so the loop detector's DFS finds the cycle.

## Implementation Tasks

### Phase 1: Capability Extractor Enhancements (`capability-extractor.ts`)

These fixes add oracle text fallback extraction to `profileCard()` so that `CardProfile` fields are populated correctly.

- [ ] 1.1 **Add `detectOracleLifeGainEvents()` — lifelink keyword → `gain_life` causesEvent**
  - File: `src/lib/interaction-engine/capability-extractor.ts`
  - Add after `detectOracleCausedEvents()` (~line 1030)
  - Function signature: `function detectOracleLifeGainEvents(oracleText: string, keywords: string[], existingEvents: GameEvent[]): GameEvent[]`
  - Logic: If card has "lifelink" keyword or oracle text matches `/lifelink/i`, and no existing `player_action{gain_life}` event, add `{ kind: "player_action", action: "gain_life" }` to causesEvents
  - Also detect explicit "you gain N life" patterns → add `player_action{gain_life}` event
  - Call from `profileCard()` after step 10 (oracle caused events), push results into `causesEvents`
  - **Fixes tests:** #272 (Archangel self-trigger), enables #292 (chain through life gain)

- [ ] 1.2 **Add `detectOracleDrawEvents()` — "draw a card" → `draw` causesEvent**
  - File: `src/lib/interaction-engine/capability-extractor.ts`
  - Add after the new `detectOracleLifeGainEvents()`
  - Function signature: `function detectOracleDrawEvents(oracleText: string, existingEvents: GameEvent[]): GameEvent[]`
  - Logic: If oracle text matches `/draw (?:a|one|\d+) cards?/i` and no existing `player_action{draw}` event, add `{ kind: "player_action", action: "draw" }`
  - Call from `profileCard()`, push results into `causesEvents`
  - **Fixes tests:** #631 (Curiosity causes draw events), enables #670/#685 (Niv-Mizzet + Curiosity loop)

- [ ] 1.3 **Add `detectOracleEnchantmentTriggers()` — constellation / enchantment cast triggers**
  - File: `src/lib/interaction-engine/capability-extractor.ts`
  - Add after the new draw event detector
  - Function signature: `function detectOracleEnchantmentTriggers(oracleText: string, existingTriggersOn: GameEvent[]): GameEvent[]`
  - Logic:
    - If `/whenever (?:an(?:other)? )?enchantment enters the battlefield/i` or `/constellation/i` → add `zone_transition{to: "battlefield", object: {types: ["enchantment"]}}` to `triggersOn`
    - If `/whenever you cast an? enchantment spell/i` → add `player_action{cast_spell, object: {types: ["enchantment"]}}` to `triggersOn`
  - Call from `profileCard()`, push results into `triggersOn`
  - **Fixes tests:** #743 (Eidolon of Blossoms ETB trigger), #773 (Sigil cast trigger)

- [ ] 1.4 **Add `detectOracleZoneCastPermissions()` — "cast from library/graveyard" → `zoneCastPermissions`**
  - File: `src/lib/interaction-engine/capability-extractor.ts`
  - Add after the enchantment trigger detector
  - Function signature: `function detectOracleZoneCastPermissions(oracleText: string, existingPerms: ZoneCastPermission[]): ZoneCastPermission[]`
  - Logic: If `/(?:you may )?(?:play lands and )?cast spells from (?:the top of )?your library/i` and no existing library permission → add `{ category: "zone_cast_permission", fromZone: "library", cardTypes: [] }`
  - Also handle graveyard cast: `/cast .+ from your graveyard/i` → `fromZone: "graveyard"`
  - Call from `profileCard()`, push results into `zoneCastPermissions`
  - **Fixes test:** #290 (Bolas's Citadel)

- [ ] 1.5 **Enhance `detectOracleTokenCreation()` — handle "create X ... tokens" with variable quantity**
  - File: `src/lib/interaction-engine/capability-extractor.ts`
  - Modify existing function at ~line 927
  - Current regex: `/create\s+(?:a|an|\d+)\s+(.+?)\s+tokens?\b/gi`
  - New regex: `/create\s+(?:a|an|\d+|[Xx]|that many)\s+(.+?)\s+tokens?\b/gi`
  - This adds `X` and `that many` as valid quantity patterns (Dockside, Avenger)
  - Also handle "Treasure" as an artifact subtype: if description includes "treasure", add `"artifact"` to types
  - **Fixes test:** #175 (Dockside Extortionist)

### Phase 2: Interaction Detector Oracle Patterns (`interaction-detector.ts`)

These fixes add oracle text fallback patterns for pairwise interaction detection.

- [ ] 2.1 **Add extra combat phase synergy detection**
  - File: `src/lib/interaction-engine/interaction-detector.ts`
  - Add a new oracle pattern in `detectTriggersFromOraclePatterns()` or a new function `detectExtraCombatSynergy()`
  - Logic: If both cards' oracle text matches `/additional combat (?:phase|step)/i` or `/untap .+ (?:and|that) (?:attack|attacks)/i`, generate a `triggers` interaction (shared combat synergy)
  - Called from `detectTriggers()` as an additional fallback
  - **Fixes test:** #878 (Aurelia + Combat Celebrant)

- [ ] 2.2 **Add equipment death trigger / token producer synergy**
  - File: `src/lib/interaction-engine/interaction-detector.ts`
  - Add to `detectTriggersFromOraclePatterns()`: if A's oracle matches `/whenever equipped creature dies/i` (equipment death trigger) and B creates tokens (via `cardCreatesTokens(b)`), emit a `triggers` interaction
  - Also detect the reverse: if A creates tokens and B's oracle has death trigger patterns
  - **Fixes test:** #533 (Skullclamp + Young Pyromancer)

- [ ] 2.3 **Add permanent ETB trigger detection**
  - File: `src/lib/interaction-engine/interaction-detector.ts`
  - Add to `detectTriggersFromOraclePatterns()`: if B's oracle matches `/whenever another permanent enters the battlefield/i` and A is a permanent type (creature, artifact, enchantment, land, planeswalker), emit `triggers`
  - **Fixes test:** #634 (Kodama triggers on permanent ETB)

- [ ] 2.4 **Add Notion Thief + draw-based card positive synergy**
  - File: `src/lib/interaction-engine/interaction-detector.ts`
  - Add to `detectTriggersFromOraclePatterns()`: if A has a replacement effect for opponent draws (`/if an opponent would draw/i`) and B triggers on draws (`/whenever (?:an opponent|a player) draws/i`), emit a `triggers` interaction rather than a conflict
  - Logic: these are complementary — Thief redirects opponent draws to you, Sphinx triggers on opponent draws. Both benefit the same controller.
  - **Fixes test:** #674 (Notion Thief + Consecrated Sphinx)

### Phase 3: Loop and Combo Detection Improvements (`interaction-detector.ts`)

These fixes ensure the loop detector finds cycles once the trigger edges exist from Phases 1 and 2.

- [ ] 3.1 **Add oracle-based "untap all" synergy for Isochron Scepter combos**
  - File: `src/lib/interaction-engine/interaction-detector.ts`
  - Add to `detectTriggersFromOraclePatterns()`: if A's oracle matches `/copy the (?:exiled|imprinted) card/i` and B is an instant (card type check), emit `enables` (A can cast B). If B's oracle matches `/untap all nonland permanents/i` and A is an artifact (has activated abilities), emit `triggers` (B untaps A).
  - This gives the loop detector the bidirectional edges it needs.
  - **Fixes tests:** #401 (Scepter + Reversal pair), #417 (Dramatic Scepter loop)

- [ ] 3.2 **Add keyword grant "have undying/persist" as `enables` interaction**
  - File: `src/lib/interaction-engine/interaction-detector.ts`
  - Add a new function `detectKeywordGrantEnables(a: CardProfile, b: CardProfile): Interaction[]`
  - Logic: if A's oracle matches `/(?:other )?(?:non-Human )?creatures you control (?:get|have|gain) (\w+)/i` and the granted keyword is `undying` or `persist`, and B is a creature that matches the type restriction (e.g., non-Human for Mikaeus), emit `enables`
  - Call from `detectPairInteractions()` alongside existing detectors
  - Also handle: if A grants undying to B, and B has activated abilities that remove counters or can deal damage, generate `triggers` edges so loop detector can find cycles
  - **Fixes tests:** #466 (Mikaeus enables Triskelion), #448 (Mikaeus + Triskelion loop)

- [ ] 3.3 **Add persist + counter replacement combo detection**
  - File: `src/lib/interaction-engine/interaction-detector.ts`
  - Add to `detectKeywordGrantEnables()` or a new `detectCounterReplacementCombo()`: if A's oracle matches `/if one or more -1\/-1 counters would be (?:placed|put)/i` (Vizier of Remedies pattern) and B has persist keyword, emit `enables` (counter prevention enables infinite persist recurrence)
  - This plus the existing sacrifice enables from Viscera Seer gives the loop detector 3-card cycle edges
  - **Fixes test:** #549 (Kitchen Finks + Viscera Seer + Vizier)

- [ ] 3.4 **Add treasure-funded recursion loop detection**
  - File: `src/lib/interaction-engine/interaction-detector.ts`
  - The Pitiless Plunderer combo already has pairwise trigger and enable interactions detected. The gap is that the loop detector doesn't traverse the 3-card cycle because the edges don't form a clean A→B→C→A cycle.
  - Enhancement: In `detectLoops()`, also include `recurs` interactions as causal edges (currently only `enables` and `triggers` are included). Add `"recurs"` to the `causalTypes` set at line 2860.
  - **Fixes test:** #354 (Pitiless Plunderer + Viscera Seer + Reassembling Skeleton)

- [ ] 3.5 **Ensure Niv-Mizzet + Curiosity bidirectional trigger loop is found**
  - File: `src/lib/interaction-engine/interaction-detector.ts`
  - This should work automatically once fix 1.2 (Curiosity draw events) is applied: Curiosity triggers Niv (draw → damage) and Niv triggers Curiosity (damage → draw). Both edges already exist in passing tests (#655, #640). The loop detector's DFS from either node should find the 2-card cycle.
  - Verify: the `checkInfinite()` function handles loops with zero mana cost correctly (both cards have no activation costs in the cycle, so `totalManaCost === 0` and `totalManaProduced >= 0` → returns `true`).
  - **Fixes tests:** #670 (loop detected), #685 (loop is infinite)

### Phase 4: Unfixme Tests and Verify

- [ ] 4.1 **Remove `test.fixme` from all 19 tests**
  - Change `test.fixme(` to `test(` in all 19 locations across the 5 test files
  - Run `npm run test:unit` to verify all tests pass

- [ ] 4.2 **Run full test suite**
  - Run `npm test` to verify no regressions in existing passing tests
  - Ensure the 60 previously-fixed tests still pass
  - Verify `npm run build` succeeds

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/interaction-engine/capability-extractor.ts` | Modify | Add 5 oracle text fallback extractors: life gain events, draw events, enchantment triggers, zone cast permissions, variable token creation |
| `src/lib/interaction-engine/interaction-detector.ts` | Modify | Add 7 oracle pattern detectors: extra combat synergy, equipment death triggers, permanent ETB, draw replacement synergy, imprint/copy combos, keyword grant enables, counter replacement combos. Expand loop causal types. |
| `tests/unit/interaction-triggers.spec.ts` | Modify | Unfixme 8 tests |
| `tests/unit/interaction-loops-chains.spec.ts` | Modify | Unfixme 7 tests |
| `tests/unit/interaction-blockers-conflicts.spec.ts` | Modify | Unfixme 1 test |
| `tests/unit/interaction-l3-judge.spec.ts` | Modify | Unfixme 2 tests |

No changes to: `lexer.ts`, `parser.ts`, `keyword-database.ts`, `types.ts`, `game-model.ts`, any component files, any API routes, any e2e tests.

## Verification

1. `npm run test:unit` — all unit tests pass (0 fixme tests remaining)
2. `npm test` — full test suite passes (unit + e2e)
3. `npm run build` — production build succeeds
4. Manual: verify no `test.fixme` references remain in the 5 test files via `grep -c "test.fixme" tests/unit/interaction-*.spec.ts`
