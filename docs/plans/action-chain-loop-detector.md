# Action-Chain Loop Detector

## Context

The interaction engine's loop detector currently uses DFS cycle-finding on a directed graph of pairwise interactions. Each card is a node, and `enables`/`triggers`/`recurs` interactions are directed edges. A loop is detected when the DFS finds a cycle (A → B → C → A).

This approach fails for 3 remaining fixme tests because real MTG combo loops often involve **intermediary resources** (Treasure tokens → mana), **self-loops** (a card dying and returning via a granted keyword), and **replacement effects** that transform one-shot mechanics into repeatable ones. The graph has the individual edges but can't express that the *output* of one step feeds the *input* of the next.

The proposed solution replaces the graph-cycle approach with an **action-chain solver**. Each card's abilities are decomposed into discrete **LoopSteps** — actions with explicit resource inputs (`requires`) and outputs (`produces`). A loop exists when a set of steps can be arranged into a circular chain where every requirement is satisfied by some other step's production, and the chain is self-sustaining.

This is conceptually a [Petri net](https://en.wikipedia.org/wiki/Petri_net): resources are tokens, card abilities are transitions, and a loop fires when every transition's input places are filled by other transitions' output places.

### The 3 Combos This Must Solve

**1. Pitiless Plunderer + Viscera Seer + Reassembling Skeleton**
```
Viscera Seer     | activate: sac creature  | requires: [creature_on_bf]  | produces: [creature_death]
Pitiless Plunderer | trigger: creature dies | requires: [creature_death]  | produces: [treasure_token]
(Treasure token) | activate: sac for mana  | requires: [treasure_token]  | produces: [mana_B]
Reassembling Skeleton | activate: return   | requires: [mana_1, mana_B]  | produces: [creature_on_bf]
→ creature_on_bf feeds back to step 1 → loop closed
```

**2. Mikaeus, the Unhallowed + Triskelion**
```
Mikaeus           | static: grant undying   | requires: []               | produces: [undying_grant]
Triskelion        | activate: remove counter | requires: [plus_counter]   | produces: [creature_death]
Triskelion        | trigger: undying return  | requires: [creature_death, undying_grant] | produces: [creature_on_bf, plus_counter]
→ plus_counter feeds back to step 2 → loop closed
```

**3. Kitchen Finks + Viscera Seer + Vizier of Remedies**
```
Viscera Seer     | activate: sac creature  | requires: [creature_on_bf]  | produces: [creature_death]
Kitchen Finks    | trigger: persist return  | requires: [creature_death]  | produces: [creature_on_bf, minus_counter]
Vizier of Remedies | replacement: prevent   | requires: [minus_counter]   | produces: [counter_prevented]
→ creature_on_bf feeds back to step 1 → loop closed (persist repeatable because counter prevented)
```

### Scope

**In scope:**
- New `LoopStep` type and resource token vocabulary
- Step extraction from `CardProfile` fields (`produces`, `consumes`, `causesEvents`, `triggersOn`, `grants`, `replacements`) and oracle text fallback
- Chain solver that finds circular chains in a set of steps
- Integration with existing `detectLoops()` — the chain solver supplements (not replaces) the existing graph-cycle approach, since graph-cycle already works for simpler loops
- Unfixme the 3 remaining loop tests

**Out of scope:**
- Changes to `CardProfile` type or the capability extractor
- Changes to pairwise interaction detection
- UI changes
- Performance optimization beyond the 3 target combos (but the design should be generalizable)

## Design Decisions

### Resource Token Vocabulary

The chain solver needs a finite vocabulary of abstract resource tokens. These are not MTG game objects — they're abstract connectors between steps.

| Token | Meaning | Produced by | Consumed by |
|-------|---------|-------------|-------------|
| `creature_on_bf` | A creature is on the battlefield, available to sacrifice | ETB, persist/undying return, graveyard return | Sacrifice costs |
| `creature_death` | A creature just died | Sacrifice, lethal damage, state-based action | Death triggers |
| `treasure_token` | A Treasure artifact token exists | "create a Treasure token" triggers | Sac for mana |
| `mana_B`, `mana_1`, `mana_any` | Mana of a specific color/generic | Treasure, mana abilities | Activation costs, return-from-graveyard costs |
| `plus_counter` | A +1/+1 counter is on a creature | Undying return, "enters with counters" | Remove-counter costs |
| `minus_counter` | A -1/-1 counter would be placed | Persist return | Counter-prevention replacement |
| `counter_prevented` | A -1/-1 counter was prevented | Vizier-style replacement effects | (enables persist to repeat) |
| `undying_grant` | Undying keyword is available | Static "have undying" grants | Undying trigger condition |
| `persist_grant` | Persist keyword is available | Keyword on card, static grants | Persist trigger condition |

This vocabulary is intentionally small — it covers the 3 target combos and the most common Commander combo patterns. It can be extended by adding new token strings.

### Chain Solver Algorithm

1. **Extract steps**: For each card in the interaction set, enumerate all `LoopStep`s from its profile
2. **Build a bipartite graph**: Steps are on one side, resource tokens on the other. Edges go from step → token (produces) and token → step (requires)
3. **Find satisfiable subsets**: For each subset of steps (bounded by card count), check if every `requires` token has a corresponding `produces` from another step in the subset. Use set-cover logic, not full DFS.
4. **Verify circularity**: A valid loop must have at least one resource that flows in a cycle (step A produces X, step B consumes X and produces Y, step C consumes Y and produces something step A needs).
5. **Emit `InteractionLoop`**: Convert the found chain into the existing `InteractionLoop` type with steps, netEffect, and isInfinite.

Complexity is bounded because we limit to 5 cards max per loop (already enforced by existing `path.length < 5` guard), and each card generates a small number of steps (typically 1-3).

### Integration Strategy

The chain solver runs **after** the existing graph-cycle detector as a second pass. This way:
- Existing loop detection (which works for simpler loops) is untouched
- The chain solver catches combos the graph-cycle approach misses
- Results are deduplicated by card set

## Implementation Tasks

### Phase 1: Define Types

- [ ] 1.1 Add `LoopStep` interface to `src/lib/interaction-engine/types.ts`
  ```typescript
  export interface LoopStep {
    card: string;
    action: string;            // human-readable: "sacrifice creature", "trigger: creature dies", etc.
    requires: string[];        // resource tokens consumed
    produces: string[];        // resource tokens produced
    source: "structured" | "oracle";  // provenance for debugging
  }
  ```
- [ ] 1.2 Add `ResourceToken` type alias or string constants to `types.ts`
  ```typescript
  export type ResourceToken = string;  // e.g. "creature_on_bf", "creature_death", "treasure_token", "mana_B"
  ```

### Phase 2: Write Tests (TDD)

- [ ] 2.1 Create `tests/unit/loop-chain-solver.spec.ts` with direct unit tests for the chain solver
  - Test: `extractLoopSteps` for Viscera Seer produces step with `requires: [creature_on_bf]`, `produces: [creature_death]`
  - Test: `extractLoopSteps` for Pitiless Plunderer produces step with `requires: [creature_death]`, `produces: [treasure_token]`
  - Test: `extractLoopSteps` for Reassembling Skeleton produces step with `requires: [mana_1, mana_B]`, `produces: [creature_on_bf]`
  - Test: `extractLoopSteps` for Mikaeus produces step with `produces: [undying_grant]`
  - Test: `extractLoopSteps` for Triskelion produces steps for counter removal and undying return
  - Test: `extractLoopSteps` for Kitchen Finks produces step with persist return
  - Test: `extractLoopSteps` for Vizier of Remedies produces step with counter prevention
  - Test: `solveChain` finds a loop for Plunderer + Seer + Skeleton steps
  - Test: `solveChain` finds a loop for Mikaeus + Triskelion steps
  - Test: `solveChain` finds a loop for Finks + Seer + Vizier steps
  - Test: `solveChain` returns empty for cards that don't form a loop (e.g., 3 random creatures)

- [ ] 2.2 Unfixme the 3 loop tests in `tests/unit/interaction-loops-chains.spec.ts`
  - `test.fixme` → `test` for "Pitiless Plunderer + Viscera Seer + Reassembling Skeleton detects a loop"
  - `test.fixme` → `test` for "Mikaeus + Triskelion detects a loop"
  - `test.fixme` → `test` for "Kitchen Finks + Viscera Seer + Vizier of Remedies detects a loop"

### Phase 3: Implement Step Extraction

- [ ] 3.1 Create `src/lib/interaction-engine/loop-chain-solver.ts`
  - Function signature: `export function extractLoopSteps(card: CardProfile): LoopStep[]`
  - Extract from structured `CardProfile` fields:
    - `consumes` with `costType: "sacrifice"` where `object.types` includes `"creature"` → `requires: [creature_on_bf]`, `produces: [creature_death]`
    - `triggersOn` with `kind: "zone_transition"` and `to: "graveyard"` (death triggers) → `requires: [creature_death]`
    - `produces` with `category: "create_token"` and treasure/food/etc. → `produces: [treasure_token]`
    - `produces` with `category: "mana"` → `produces: [mana_{color}]`
    - `grants` containing undying/persist keywords → `produces: [undying_grant]` or `[persist_grant]`
    - `replacements` with `mode: "prevent"` on -1/-1 counters → `requires: [minus_counter]`, `produces: [counter_prevented]`
  - Oracle text fallback patterns:
    - `"Sacrifice a creature:"` → sac outlet step
    - `"Whenever .+ creature .+ dies, create a Treasure"` → death trigger + treasure production
    - `"{cost}: Return .+ from your graveyard to the battlefield"` → graveyard return step, parse mana from cost
    - `"have undying"` / `"have persist"` → keyword grant step
    - `"counters would be put .+ minus one"` → counter prevention step
    - Persist/undying keywords → self-return step: `requires: [creature_death, persist_grant or keyword]`, `produces: [creature_on_bf, minus_counter or plus_counter]`
    - `"enters the battlefield with .+ +1/+1 counter"` + `"Remove a +1/+1 counter .+:"` → counter removal step

- [ ] 3.2 Add implicit resource production rules
  - Treasure tokens implicitly produce mana: if any step produces `treasure_token`, add a synthetic step `{ card: "(Treasure)", action: "sacrifice for mana", requires: [treasure_token], produces: [mana_any] }`
  - `mana_any` satisfies any `mana_{color}` requirement
  - `mana_1` (generic mana) is satisfied by any `mana_{color}` or `mana_any`

### Phase 4: Implement Chain Solver

- [ ] 4.1 Implement `solveChain` in `src/lib/interaction-engine/loop-chain-solver.ts`
  - Function signature: `export function solveChain(steps: LoopStep[]): LoopStep[][] `
  - Algorithm:
    1. Build a map: for each resource token, which steps produce it and which steps require it
    2. For each possible starting step, attempt to build a chain by greedily satisfying requirements
    3. A chain is valid when every step's `requires` is covered by some other step's `produces`, and there is at least one circular dependency
    4. Return all valid chains found (deduplicated by card set)
  - Handle `mana_any` satisfying specific mana tokens
  - Handle `mana_1` being satisfiable by any mana token

- [ ] 4.2 Implement `detectLoopsFromChains` in `src/lib/interaction-engine/loop-chain-solver.ts`
  - Function signature: `export function detectLoopsFromChains(profiles: CardProfile[]): InteractionLoop[]`
  - Orchestrator:
    1. Call `extractLoopSteps` for each profile
    2. Add implicit steps (Treasure → mana)
    3. Call `solveChain` on the combined steps
    4. Convert each valid chain to an `InteractionLoop` with proper `steps`, `netEffect`, and `isInfinite`

### Phase 5: Integrate into Detection Pipeline

- [ ] 5.1 Modify `detectLoops` in `src/lib/interaction-engine/interaction-detector.ts`
  - After the existing graph-cycle detection, call `detectLoopsFromChains(profiles)`
  - Merge results, deduplicating by sorted card-set key (same dedup used by existing `findCycles`)
  - No changes to the existing graph-cycle code path

- [ ] 5.2 Update exports if needed
  - Ensure `loop-chain-solver.ts` exports are accessible for unit testing
  - Add barrel export from `interaction-detector.ts` if needed

### Phase 6: Verify

- [ ] 6.1 Run `npx playwright test --config playwright.unit.config.ts tests/unit/loop-chain-solver.spec.ts` — all chain solver unit tests pass
- [ ] 6.2 Run `npx playwright test --config playwright.unit.config.ts tests/unit/interaction-loops-chains.spec.ts` — all loop tests pass including the 3 formerly-fixme'd tests
- [ ] 6.3 Run `npm run test:unit` — all unit tests pass, 0 skipped
- [ ] 6.4 Run `npm run build` — production build succeeds

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/interaction-engine/types.ts` | Modify | Add `LoopStep` and `ResourceToken` types |
| `src/lib/interaction-engine/loop-chain-solver.ts` | Create | Step extraction, chain solver, loop conversion |
| `src/lib/interaction-engine/interaction-detector.ts` | Modify | Call chain solver from `detectLoops` |
| `tests/unit/loop-chain-solver.spec.ts` | Create | Unit tests for step extraction and chain solving |
| `tests/unit/interaction-loops-chains.spec.ts` | Modify | Unfixme 3 loop tests |

No changes to: `capability-extractor.ts`, `types.ts` (beyond adding 2 types), any UI components, any other test files.

## Verification

1. `npx playwright test --config playwright.unit.config.ts tests/unit/loop-chain-solver.spec.ts` — all chain solver tests pass
2. `npx playwright test --config playwright.unit.config.ts tests/unit/interaction-loops-chains.spec.ts` — 24/24 pass, 0 skipped
3. `npm run test:unit` — all unit tests pass, 0 skipped
4. `npm run build` — production build succeeds
5. Manual: verify that Pitiless Plunderer, Mikaeus+Triskelion, and Kitchen Finks combos all report `isInfinite: true`
