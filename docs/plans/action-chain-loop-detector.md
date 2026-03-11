# Action-Chain Loop Detector

## Context

The interaction engine's loop detector currently uses DFS cycle-finding on a directed graph of pairwise interactions. Each card is a node, and `enables`/`triggers`/`recurs` interactions are directed edges. A loop is detected when the DFS finds a cycle (A → B → C → A).

This approach fails for 3 remaining fixme tests because real MTG combo loops often involve **intermediary resources** (Treasure tokens → mana), **self-loops** (a card dying and returning via a granted keyword), and **replacement effects** that transform one-shot mechanics into repeatable ones. The graph has the individual edges but can't express that the *output* of one step feeds the *input* of the next.

The proposed solution replaces the graph-cycle approach with an **action-chain solver**. Each card's abilities are decomposed into discrete **LoopSteps** — actions with explicit resource inputs (`requires`) and outputs (`produces`), each carrying **quantities**. A loop exists when a set of steps can be arranged into a circular chain where every requirement is satisfied by some other step's production, the chain is self-sustaining, and all **blocking outputs** are consumed.

This is conceptually a [Petri net](https://en.wikipedia.org/wiki/Petri_net): resources are tokens, card abilities are transitions, and a loop fires when every transition's input places are filled by other transitions' output places.

### The 3 Combos This Must Solve

**1. Pitiless Plunderer + Ashnod's Altar + Reassembling Skeleton**

> **Design note:** The original test used Viscera Seer as the sac outlet, but Seer produces no mana and Skeleton costs {1}{B} to return. 1 Treasure from Plunderer = 1 mana, which is insufficient for the 2-mana cost. The test must use Ashnod's Altar ({C}{C} per sacrifice) instead, making the loop mana-positive: {C}{C} from Altar + 1 Treasure from Plunderer = 3 mana total, paying {1}{B} with mana to spare.

```
Ashnod's Altar        | activate: sac creature | requires: [creature_on_bf(1)]  | produces: [creature_death(1), mana_C(2)]
Pitiless Plunderer     | trigger: creature dies | requires: [creature_death(1)]  | produces: [treasure_token(1)]
(Treasure token)       | activate: sac for mana | requires: [treasure_token(1)]  | produces: [mana_any(1)]
Reassembling Skeleton  | activate: return       | requires: [mana_generic(1), mana_B(1)] | produces: [creature_on_bf(1)]
→ mana: Altar gives {C}{C} (2 generic), Treasure gives {B} (1 any→black). Cost is {1}{B}. Net +1 mana. Loop closed.
```

**2. Mikaeus, the Unhallowed + Triskelion**

> **Design note:** Mikaeus grants both +1/+1 (continuous, Layer 7b) and undying (keyword). With 0 counters, Triskelion is 2/2 (1/1 base + Mikaeus buff). The combo line: remove all 3 initial counters dealing damage to Triskelion itself (3 damage to a 2/2 = lethal, dies). Undying returns it with 1 +1/+1 counter → 3/3. Remove counter, ping Triskelion for 1 → 2/2 with 1 damage (not lethal). The 2-card combo produces finite damage on the first cycle but stalls after undying return #1 because 1 self-ping doesn't kill a 2/2.
>
> **However**, the loop detector operates as a heuristic for combo potential, not a full game state simulator. The `plus_counter → creature_death` abstraction is an intentional over-approximation: if a card has +1/+1 counters it can remove and a way to die/be sacrificed, we flag it as a potential loop. Many players combine Mike+Trike with a sac outlet, and the engine should surface this interaction. We document this as a known heuristic.

```
Mikaeus           | static: grant undying   | requires: []                           | produces: [undying_grant(1)]
Triskelion        | activate: remove counter| requires: [plus_counter(1)]            | produces: [creature_death(1)]
Triskelion        | trigger: undying return | requires: [creature_death(1), undying_grant(1)] | produces: [creature_on_bf(1), plus_counter(1)]
→ plus_counter feeds back to step 2 → loop closed (heuristic: self-damage abstracted)
```

**3. Kitchen Finks + Viscera Seer + Vizier of Remedies**
```
Viscera Seer         | activate: sac creature   | requires: [creature_on_bf(1)]  | produces: [creature_death(1)]
Kitchen Finks        | trigger: persist return   | requires: [creature_death(1)]  | produces: [creature_on_bf(1)] | blocking: [minus_counter(1)]
Vizier of Remedies   | replacement: prevent      | requires: [minus_counter(1)]   | produces: []
→ creature_on_bf feeds back to step 1. minus_counter (blocking output) consumed by Vizier → loop sustained.
```

### Scope

**In scope:**
- New `LoopStep` type with quantity-aware resource tokens and blocking outputs
- Step extraction from `CardProfile` fields (`produces`, `consumes`, `causesEvents`, `triggersOn`, `grants`, `replacements`) and oracle text fallback
- Chain solver that finds circular chains with quantity validation and blocking-output consumption
- Diagnostic tests verifying CardProfile extraction for 17 combo-relevant cards
- Integration with existing `detectLoops()` — the chain solver supplements (not replaces) the existing graph-cycle approach
- Fix the 3 remaining fixme tests (correcting the Plunderer test to use Ashnod's Altar)

**Out of scope:**
- Full game-state simulation (toughness math, damage tracking, SBA resolution)
- Changes to pairwise interaction detection
- UI changes
- Performance optimization beyond the target combos (but the design should be generalizable)

## Design Decisions

### Resource Token Vocabulary

The chain solver needs a finite vocabulary of abstract resource tokens with **quantities**. These are not MTG game objects — they're abstract connectors between steps.

| Token | Meaning | Produced by | Consumed by |
|-------|---------|-------------|-------------|
| `creature_on_bf` | A creature is on the battlefield, available to sacrifice | ETB, persist/undying return, graveyard return | Sacrifice costs |
| `creature_death` | A creature just died | Sacrifice, lethal damage, state-based action | Death triggers |
| `treasure_token` | A Treasure artifact token exists | "create a Treasure token" triggers | Sac for mana |
| `mana_W/U/B/R/G/C` | Mana of a specific color | Mana abilities, Treasure sac | Activation costs, casting costs |
| `mana_generic` | Generic mana (satisfiable by any color/colorless) | — | Generic mana costs |
| `mana_any` | Mana of any one color (Treasure, Phyrexian Altar) | Treasure, colored-mana sac outlets | Satisfies one `mana_{color}` or `mana_generic` |
| `plus_counter` | A +1/+1 counter is on a creature | Undying return, "enters with counters" | Remove-counter costs |
| `minus_counter` | A -1/-1 counter would be placed | Persist return (as blocking output) | Counter-prevention replacement |
| `undying_grant` | Undying keyword is available | Static "have undying" grants | Undying trigger condition |
| `persist_keyword` | Card has persist (intrinsic or granted) | Keyword on card, static grants | Persist trigger condition |
| `etb_trigger` | A creature entered the battlefield | ETB from return/cast | ETB-triggered abilities |
| `card_draw` | A card was drawn | Draw effects | Draw triggers |
| `life_gain` | Life was gained | Lifelink, "gain N life" | Life gain triggers |

### Quantity-Aware Matching

Each resource token carries a **quantity** (default 1). The solver performs multiset matching:

```typescript
interface ObjectFilter {
  self?: boolean;          // true = "this creature", false = "another creature"
  types?: string[];        // ["creature"], ["artifact", "creature"]
  subtypes?: string[];     // ["Zombie"], ["Human"]
  supertypeExcludes?: string[];  // non-Human → excludes: ["Human"]
  isToken?: boolean;       // true = token only, false = nontoken only
}

interface ResourceRequirement {
  token: string;
  quantity: number;        // how many needed
  filter?: ObjectFilter;   // constraints on which object satisfies this
}
interface ResourceProduction {
  token: string;
  quantity: number;        // how many produced
  filter?: ObjectFilter;   // constraints on the object produced/affected
}
```

**Object filter matching rules:**
- A `requires` with `filter.self: false` ("another creature") cannot be satisfied by a `produces` from the same card — the solver must check that the producing step's `card` differs from the consuming step's `card`
- A `requires` with `filter.isToken: false` ("nontoken creature") cannot be satisfied by a `produces` with `filter.isToken: true` (a token being created)
- A `requires` with `filter.supertypeExcludes: ["Human"]` cannot be satisfied by a `produces` whose source card has subtype Human
- Filters are **advisory** in v1 — the solver logs a warning when it can't verify a filter (e.g., subtype data missing from `CardProfile`) but still allows the match. This prevents false negatives while surfacing extraction gaps. Future versions can tighten to strict enforcement.

**Why this matters — real failure modes:**
- **Yawgmoth, Thran Physician**: "Sacrifice *another* creature" — Yawgmoth can't sacrifice itself. Without `self: false`, the solver might think Yawgmoth alone closes a loop.
- **Nim Deathmantle**: "Whenever a *nontoken* creature dies" — tokens dying don't trigger it. Without `isToken: false`, the solver would accept token-only sacrifice loops.
- **Mikaeus, the Unhallowed**: "other *non-Human* creatures you control have undying" — Mikaeus doesn't grant undying to Humans. Without `supertypeExcludes: ["Human"]`, the solver would pair Mikaeus with Human creatures.
- **Pitiless Plunderer**: "Whenever *another* creature you control dies" — Plunderer's own death doesn't trigger itself. Same `self: false` constraint.
- **Blood Artist**: "Whenever Blood Artist *or another* creature dies" — includes self. This is `self: undefined` (no filter), meaning any creature death works.

**Mana substitution rules:**
- `mana_any(1)` satisfies exactly one of: `mana_W(1)`, `mana_U(1)`, `mana_B(1)`, `mana_R(1)`, `mana_G(1)`, `mana_C(1)`, or `mana_generic(1)`
- `mana_C(1)` satisfies `mana_generic(1)` but not `mana_B(1)`
- `mana_B(1)` satisfies `mana_generic(1)` or `mana_B(1)` but not `mana_R(1)`
- Multiple `mana_any` tokens can each satisfy a different color requirement

**Example — Ashnod's Altar + Plunderer + Skeleton:**
- Produced: `mana_C(2)` from Altar + `mana_any(1)` from Treasure
- Required: `mana_generic(1)` + `mana_B(1)` for Skeleton
- Match: `mana_C(1)` → `mana_generic(1)`, `mana_any(1)` → `mana_B(1)`. Remaining: `mana_C(1)` surplus. Loop is mana-positive. ✓

### Blocking Outputs

A critical innovation: some step outputs are **blocking** — if not consumed by another step, the loop stalls after one iteration.

```typescript
interface LoopStep {
  card: string;
  cardTypes?: string[];            // ["Creature"], ["Artifact"] — for filter validation
  cardSubtypes?: string[];         // ["Zombie", "Warrior"] — for subtype filter validation
  action: string;
  requires: ResourceRequirement[];
  produces: ResourceProduction[];
  blocking: ResourceProduction[];  // outputs that MUST be consumed or loop stalls
  source: "structured" | "oracle";
}
```

**Persist's -1/-1 counter is a blocking output.** Without a consumer (Vizier, Solemnity, Melira), persist only fires once because the creature retains its -1/-1 counter on subsequent deaths.

**Undying's +1/+1 counter is also a blocking output** in the general case, but it's consumed by any "remove +1/+1 counter" ability (like Triskelion's). If no consumer exists, undying fires once and then the creature has a +1/+1 counter when it dies, preventing the next undying trigger.

The solver rule: **a chain is valid only if every step's `blocking` outputs are consumed by some other step's `requires` in the chain.**

### Chain Solver Algorithm

1. **Extract steps**: For each card in the interaction set, enumerate all `LoopStep`s from its profile and oracle text
2. **Add implicit steps**: Treasure → mana synthetic steps, Phyrexian Altar-style colored mana steps
3. **Build resource index**: Map each resource token to the steps that produce/consume it
4. **Find satisfiable subsets**: For each subset of steps (bounded by card count ≤ 5):
   a. Compute total production and total requirements (quantity-aware)
   b. Apply mana substitution rules to match `mana_any` against specific requirements
   c. Verify every `requires` is covered by some `produces` (multiset containment)
   d. **Validate object filters**: For each requires↔produces match, check `ObjectFilter` constraints:
      - `self: false` → producing step's `card` must differ from consuming step's `card`
      - `isToken: false` → producing step must not be a token-creation step
      - `supertypeExcludes` → producing step's `cardSubtypes` must not include excluded types
      - Log warnings for unverifiable filters (missing type data) but allow the match in v1
   e. Verify every `blocking` output is covered by some `requires` (blocking constraint)
   f. Verify at least one circular dependency exists (not just linear)
5. **Emit `InteractionLoop`**: Convert valid chains into `InteractionLoop` with steps, netEffect, and isInfinite

Complexity is bounded: max 5 cards, each generating 1-3 steps, so ≤15 steps total. Subset enumeration over steps is feasible at this scale.

### Integration Strategy

The chain solver runs **after** the existing graph-cycle detector as a second pass:
- Existing loop detection (which works for simpler loops) is untouched
- The chain solver catches combos the graph-cycle approach misses
- Results are deduplicated by sorted card-set key

### Over-Approximation Policy

The loop detector is a **heuristic** for combo potential, not a full game-state simulator. Known intentional over-approximations:

1. **Toughness math is not simulated.** `plus_counter → creature_death` is accepted if the card has both counter-removal and a pathway to death, even if the exact damage/toughness arithmetic doesn't close in all cases.
2. **Timing is not validated.** The solver doesn't check if abilities are instant-speed vs sorcery-speed, or whether trigger ordering matters.
3. **Zone tracking is simplified.** A creature "dying" and "returning to battlefield" is modeled without tracking zone state between steps.

4. **Object filters are advisory in v1.** When the solver can't verify a filter (e.g., card subtype data missing from the profile), it logs a warning and allows the match. This prevents false negatives. The `self: false` and `isToken: false` filters are always enforceable (they depend on card identity, not type data) and are enforced strictly.

These are documented so future improvements can tighten the model without redesigning the architecture.

## Implementation Tasks

### Phase 0: CardProfile Diagnostic Tests

Before building the chain solver, verify that the capability extractor produces the expected structured data for all combo-relevant cards. If extraction is wrong, the chain solver will fail silently.

- [ ] 0.1 Create `tests/unit/loop-profile-diagnostics.spec.ts` — diagnostic tests for 17 cards

  **Core combo cards (8) — with filter assertions:**
  - Viscera Seer: `consumes` includes `SacrificeCost` with creature type, no mana cost. Filter: `self: false` NOT required (can sac itself or others — "Sacrifice a creature" with no "another" qualifier)
  - Pitiless Plunderer: `triggersOn` includes death event for **another** creature (`quantity: "another"` or `self: false` on the trigger's object ref); `produces` includes `create_token` (Treasure). **Filter test: trigger must carry `self: false`**
  - Reassembling Skeleton: `consumes` includes `ManaCostUnit({1}{B})`; has graveyard return ability. `self: true` on the return target.
  - Ashnod's Altar: `consumes` includes `SacrificeCost` with creature type; `produces` includes `mana` with quantity 2. No self/other filter (any creature).
  - Mikaeus, the Unhallowed: `grants` includes undying keyword to non-Human creatures — **must carry `supertypeExcludes: ["Human"]` on the grant target**; `grants` includes +1/+1 stat modification with same filter
  - Triskelion: `consumes` includes `RemoveCounterCost(+1/+1)` with `self: true`; `causesEvents` includes damage event
  - Kitchen Finks: has persist keyword; `causesEvents` includes ETB life gain
  - Vizier of Remedies: `replacements` includes -1/-1 counter prevention with `mode: "modify"` or `"prevent"`

  **Stress-test cards (10) — mechanically complex cards that exercise edge cases, including filter validation:**
  - Murderous Redcap: ETB damage trigger + persist keyword (dual-trigger card). Must extract both `triggersOn: [ETB]` and persist as separate profile entries. Tests that damage output and self-recurrence coexist. **No filter complexity** — damage targets "any target", persist is self-referential.
  - Altar of Dementia: Free sac outlet with zero mana cost. `consumes: [SacrificeCost(creature)]`, no mana. **No self/other filter** — "Sacrifice a creature" (no "another"). Tests that variable-magnitude mill is extracted as `causesEvents` without confusing it for resource production.
  - Karmic Guide: ETB reanimation trigger + echo keyword. Must extract `causesEvents: [ReturnFromGraveyardToBattlefield(creature)]` AND echo as a delayed conditional self-sacrifice. Tests multi-mechanic extraction on a single card. Return target is "target creature card" — **no self filter** (can return any creature from graveyard).
  - Reveillark: Leaves-the-battlefield trigger (NOT just dies). Must extract `triggersOn: [LTB(self)]` distinct from death triggers. `causesEvents` returns up to 2 creatures with **power ≤ 2 constraint** (modeled as `manaValue` or custom filter on the target ref). Tests LTB vs dies distinction. **Filter test: the power constraint gates which combos are legal** — Karmic Guide (2/2) passes, Grave Titan (6/6) fails.
  - Gravecrawler: Static graveyard-cast permission, NOT a triggered ability. Must extract `zoneCastPermissions` with zone=graveyard and **condition: control a Zombie** (subtype filter on controller's battlefield). Tests recursion that is cast-based, not return-based. **Filter test: Zombie condition means the loop requires a Zombie on the battlefield.**
  - Phyrexian Altar: Sac outlet producing colored mana. `consumes: [SacrificeCost(creature)]`, `produces: [Mana(1, any)]`. **No self/other filter** — "Sacrifice a creature" (generic). Tests colored mana production vs Ashnod's Altar's colorless.
  - Blood Artist: Global death trigger **including self**. `triggersOn: [Dies(anyCreature)]` — "Blood Artist or another creature" means no `self: false` filter, the trigger fires on ALL creatures including itself. **Filter test: verify absence of `self: false`**, unlike Pitiless Plunderer which has "another".
  - Nim Deathmantle: Equipment grants + death trigger reanimation. **Filter test: `triggersOn` must carry `isToken: false`** — "Whenever a nontoken creature dies" excludes tokens. The {4} payment is optional. Must extract both `grants` (to equipped creature) and the filtered death trigger.
  - Yawgmoth, Thran Physician: Two activated abilities. **Filter test: Ability 1 sac cost must carry `self: false`** — "Sacrifice *another* creature" means Yawgmoth cannot sacrifice itself. Ability 2 is `consumes: [Mana({B}{B}), Discard]`, `causesEvents: [Proliferate]`. Tests multi-ability extraction where filter on the sac cost matters for combo validation.
  - Solemnity: Pure static replacement effect. `replacements: [PreventCounterPlacement(on: permanents and players)]`. **No object filters** — applies globally to all permanents. Tests broadest possible replacement effect scope.

- [ ] 0.2 Run diagnostic tests to identify extraction gaps
  - For each card where structured extraction fails, document which oracle text fallback pattern `extractLoopSteps` will need

### Phase 1: Define Types

- [ ] 1.1 Add `ObjectFilter`, `ResourceRequirement`, `ResourceProduction`, and `LoopStep` interfaces to `src/lib/interaction-engine/types.ts`
  ```typescript
  /** Constrains which game object can satisfy a resource requirement or is produced */
  export interface ObjectFilter {
    self?: boolean;              // true = "this creature", false = "another creature"
    types?: string[];            // ["creature"], ["artifact", "creature"]
    subtypes?: string[];         // ["Zombie"], ["Human"]
    supertypeExcludes?: string[];  // non-Human → excludes: ["Human"]
    isToken?: boolean;           // true = token only, false = nontoken only
  }

  export interface ResourceRequirement {
    token: string;
    quantity: number;
    filter?: ObjectFilter;       // constraints on which object satisfies this
  }

  export interface ResourceProduction {
    token: string;
    quantity: number;
    filter?: ObjectFilter;       // constraints on the object produced/affected
  }

  export interface LoopStep {
    card: string;
    cardTypes?: string[];        // ["Creature"], ["Artifact"] — for filter validation
    cardSubtypes?: string[];     // ["Zombie", "Warrior"] — for subtype filter validation
    action: string;
    requires: ResourceRequirement[];
    produces: ResourceProduction[];
    blocking: ResourceProduction[];  // outputs that MUST be consumed or loop stalls
    source: "structured" | "oracle";
  }
  ```

### Phase 2: Write Tests (TDD)

- [ ] 2.1 Create `tests/unit/loop-chain-solver.spec.ts` with direct unit tests for the chain solver

  **Step extraction tests:**
  - Test: `extractLoopSteps` for Viscera Seer produces step with `requires: [creature_on_bf(1)]`, `produces: [creature_death(1)]`
  - Test: `extractLoopSteps` for Pitiless Plunderer produces step with `requires: [creature_death(1)]`, `produces: [treasure_token(1)]`
  - Test: `extractLoopSteps` for Reassembling Skeleton produces step with `requires: [mana_generic(1), mana_B(1)]`, `produces: [creature_on_bf(1)]`
  - Test: `extractLoopSteps` for Ashnod's Altar produces step with `requires: [creature_on_bf(1)]`, `produces: [creature_death(1), mana_C(2)]`
  - Test: `extractLoopSteps` for Mikaeus produces step with `produces: [undying_grant(1)]`, empty requires
  - Test: `extractLoopSteps` for Triskelion produces steps for counter removal (`requires: [plus_counter(1)]`) and undying return (`requires: [creature_death(1), undying_grant(1)]`, `produces: [creature_on_bf(1)]`, `blocking: [plus_counter(1)]`)
  - Test: `extractLoopSteps` for Kitchen Finks produces persist step with `produces: [creature_on_bf(1)]`, `blocking: [minus_counter(1)]`
  - Test: `extractLoopSteps` for Vizier of Remedies produces step with `requires: [minus_counter(1)]`
  - Test: `extractLoopSteps` for Phyrexian Altar produces step with `requires: [creature_on_bf(1)]`, `produces: [creature_death(1), mana_any(1)]`
  - Test: `extractLoopSteps` for Solemnity produces step with `requires: [minus_counter(1)]` (same functional role as Vizier)
  - Test: `extractLoopSteps` for Gravecrawler produces step with `requires: [mana_B(1)]`, `produces: [creature_on_bf(1)]` (graveyard cast)

  **Chain solver tests:**
  - Test: `solveChain` finds a loop for Ashnod's Altar + Plunderer + Skeleton steps (mana-positive)
  - Test: `solveChain` finds a loop for Mikaeus + Triskelion steps (counter-cycling heuristic)
  - Test: `solveChain` finds a loop for Finks + Seer + Vizier steps (blocking output consumed)
  - Test: `solveChain` does NOT find a loop for Finks + Seer WITHOUT Vizier (blocking output minus_counter unconsumed)
  - Test: `solveChain` does NOT find a loop for Seer + Plunderer + Skeleton (mana-negative: 1 Treasure ≠ {1}{B})
  - Test: `solveChain` returns empty for 3 random creatures with no resource chain
  - Test: `solveChain` finds a loop for Gravecrawler + Phyrexian Altar (mana-neutral: {B} produced = {B} consumed, with Zombie condition assumed)
  - Test: `solveChain` finds a loop for Murderous Redcap + Vizier + Altar of Dementia (persist + counter prevention + free sac)

  **Mana economics tests:**
  - Test: `mana_any(1)` satisfies `mana_B(1)` requirement
  - Test: `mana_C(2)` satisfies `mana_generic(2)` requirement
  - Test: `mana_C(1)` does NOT satisfy `mana_B(1)` requirement
  - Test: `mana_any(1)` + `mana_C(2)` satisfies `mana_generic(1)` + `mana_B(1)` (optimal allocation)

  **Object filter tests:**
  - Test: `extractLoopSteps` for Pitiless Plunderer death trigger step has `requires` with `filter: { self: false }` on `creature_death` token
  - Test: `extractLoopSteps` for Yawgmoth sac step has `requires` with `filter: { self: false }` on `creature_on_bf` token ("another creature")
  - Test: `extractLoopSteps` for Nim Deathmantle death trigger step has `requires` with `filter: { isToken: false }` on `creature_death` token ("nontoken creature")
  - Test: `extractLoopSteps` for Mikaeus grant step carries `filter: { supertypeExcludes: ["Human"] }` on `undying_grant` token
  - Test: `extractLoopSteps` for Blood Artist death trigger step has NO `self: false` filter (triggers on self AND others)
  - Test: `extractLoopSteps` for Viscera Seer sac step has NO `self: false` filter ("Sacrifice a creature" — can sac self)
  - Test: `solveChain` rejects a loop where the only sacrifice fodder is the card with `self: false` on its sac cost (e.g., Yawgmoth can't sac itself)
  - Test: `solveChain` rejects Nim Deathmantle loop where the only dying creature is a token (`isToken: false` filter blocks)
  - Test: `solveChain` rejects Mikaeus granting undying to a Human creature (`supertypeExcludes: ["Human"]` filter blocks)

- [ ] 2.2 Fix the 3 loop tests in `tests/unit/interaction-loops-chains.spec.ts`
  - Change Pitiless Plunderer test to use Ashnod's Altar instead of Viscera Seer (mana math fix)
  - `test.fixme` → `test` for "Pitiless Plunderer + Ashnod's Altar + Reassembling Skeleton detects a loop"
  - `test.fixme` → `test` for "Mikaeus + Triskelion detects a loop"
  - `test.fixme` → `test` for "Kitchen Finks + Viscera Seer + Vizier of Remedies detects a loop"

### Phase 3: Implement Step Extraction

- [ ] 3.1 Create `src/lib/interaction-engine/loop-chain-solver.ts`
  - Function signature: `export function extractLoopSteps(card: CardProfile): LoopStep[]`
  - Extract from structured `CardProfile` fields, **propagating `ObjectFilter` from `GameObjectRef`**:
    - `consumes` with `costType: "sacrifice"` where `object.types` includes `"creature"` → sac outlet step.
      **Filter propagation**: read `object.quantity` and `object.self` from the `GameObjectRef`:
      - `quantity: "another"` or `self: false` → add `filter: { self: false }` to the `creature_on_bf` requirement
      - `modifiers` includes `"nontoken"` → add `filter: { isToken: false }`
      - No qualifier → no filter (can sac any creature, including self)
    - `produces` with `category: "mana"` → check `quantity` and `color` fields for accurate mana amounts
    - `triggersOn` with `kind: "zone_transition"` and `to: "graveyard"` → death trigger step.
      **Filter propagation**: read `object` ref from the trigger event:
      - `quantity: "another"` or `self: false` → add `filter: { self: false }` to the `creature_death` requirement (e.g., Pitiless Plunderer)
      - `modifiers` includes `"nontoken"` → add `filter: { isToken: false }` (e.g., Nim Deathmantle)
      - No qualifier → no filter (e.g., Blood Artist triggers on any creature including self)
    - `produces` with `category: "create_token"` and treasure/food/etc. → treasure production step
    - `grants` containing undying/persist keywords → keyword grant step.
      **Filter propagation**: read the grant's target ref:
      - `subtypes` with excludes → add `filter: { supertypeExcludes: [...] }` (e.g., Mikaeus's "non-Human")
      - `modifiers` includes `"nontoken"` → add `filter: { isToken: false }`
    - `replacements` with `mode: "prevent"` or `"modify"` on -1/-1 counters → counter prevention step
    - Keywords array: "Persist" → persist return step with `blocking: [minus_counter(1)]`
    - Keywords array: "Undying" → undying return step with `blocking: [plus_counter(1)]`
    - `consumes` with `costType: "remove_counter"` → counter removal step. Typically `self: true` (remove from self).
    - `zoneCastPermissions` with graveyard zone → graveyard cast step (parse mana cost from `castingCost`). May carry condition filters (e.g., Gravecrawler's "control a Zombie").
  - Oracle text fallback patterns (for cards where structured extraction misses).
    **Filter extraction from oracle text**: parse "another", "nontoken", "non-Human" qualifiers:
    - `"Sacrifice a creature:"` → sac outlet step (no filter)
    - `"Sacrifice another creature:"` → sac outlet step with `filter: { self: false }` (e.g., Yawgmoth)
    - `"Sacrifice a creature: Add {C}{C}"` → mana-producing sac outlet, parse mana from effect
    - `"Sacrifice a creature: Add one mana of any color"` → colored-mana sac outlet
    - `"Whenever another creature .+ dies"` → death trigger with `filter: { self: false }` (e.g., Plunderer)
    - `"Whenever a nontoken creature dies"` → death trigger with `filter: { isToken: false }` (e.g., Nim Deathmantle)
    - `"Whenever .+ or another creature dies"` → death trigger with NO self filter (e.g., Blood Artist)
    - `"Whenever .+ creature .+ dies, create a Treasure"` → death trigger + treasure production
    - `"{cost}: Return .+ from your graveyard to the battlefield"` → graveyard return step, parse mana from cost
    - `"other non-Human creatures .+ have undying"` → keyword grant with `filter: { self: false, supertypeExcludes: ["Human"] }`
    - `"have undying"` / `"have persist"` → keyword grant step (check for "other"/"non-X" qualifiers)
    - `"counters would be put .+ minus one"` / `"can't be placed"` → counter prevention step
    - `"enters the battlefield with .+ +1/+1 counter"` + `"Remove a +1/+1 counter:"` → counter removal step
    - `"may cast .+ from your graveyard"` → graveyard cast permission step (check for conditions like "as long as you control a Zombie")

- [ ] 3.2 Add implicit resource production rules
  - Treasure tokens implicitly produce mana: for each step producing `treasure_token(N)`, add a synthetic step `{ card: "(Treasure)", action: "sacrifice for mana", requires: [treasure_token(1)], produces: [mana_any(1)] }` (repeated N times conceptually — solver handles quantity)
  - Document mana substitution rules as a utility function:
    ```typescript
    function canSatisfy(produced: ResourceProduction[], required: ResourceRequirement[]): boolean
    ```

### Phase 4: Implement Chain Solver

- [ ] 4.1 Implement mana satisfaction logic
  - Function signature: `export function canSatisfyRequirements(produced: ResourceProduction[], required: ResourceRequirement[]): { satisfied: boolean; surplus: ResourceProduction[] }`
  - Algorithm: greedy allocation with priority ordering
    1. First, match exact-color mana to exact-color requirements
    2. Then, use `mana_any` to fill remaining colored requirements
    3. Then, use any remaining mana (colored or `mana_any`) for `mana_generic` requirements
    4. Return whether all requirements are met, plus any surplus

- [ ] 4.2 Implement `solveChain` in `src/lib/interaction-engine/loop-chain-solver.ts`
  - Function signature: `export function solveChain(steps: LoopStep[]): LoopStep[][]`
  - Algorithm:
    1. Build resource index: for each token, which steps produce and consume it
    2. Enumerate candidate step subsets (bounded by card count ≤ 5, ≤ 3 steps per card)
    3. For each subset:
       a. Sum total `produces` and total `requires` across all steps (multiset)
       b. Apply mana substitution via `canSatisfyRequirements`
       c. Verify every non-mana `requires` is covered by some `produces`
       d. **Blocking constraint**: verify every `blocking` output is covered by some step's `requires`
       e. Verify at least one circular dependency exists (step A's output feeds step B, whose output feeds step A or another step in the chain)
    4. Return all valid chains (deduplicated by card set)

- [ ] 4.3 Implement `detectLoopsFromChains` in `src/lib/interaction-engine/loop-chain-solver.ts`
  - Function signature: `export function detectLoopsFromChains(profiles: CardProfile[]): InteractionLoop[]`
  - Orchestrator:
    1. Call `extractLoopSteps` for each profile
    2. Add implicit steps (Treasure → mana)
    3. Call `solveChain` on the combined steps
    4. Convert each valid chain to an `InteractionLoop` with proper `steps`, `netEffect`, and `isInfinite`
    5. `isInfinite` = true when mana surplus ≥ 0 and all blocking outputs consumed

### Phase 5: Integrate into Detection Pipeline

- [ ] 5.1 Modify `detectLoops` in `src/lib/interaction-engine/interaction-detector.ts`
  - After the existing graph-cycle detection, call `detectLoopsFromChains(profiles)`
  - Merge results, deduplicating by sorted card-set key (same dedup used by existing `findCycles`)
  - No changes to the existing graph-cycle code path

- [ ] 5.2 Update exports if needed
  - Ensure `loop-chain-solver.ts` exports are accessible for unit testing
  - Add barrel export from `interaction-detector.ts` if needed

### Phase 6: Verify

- [ ] 6.1 Run `npx playwright test --config playwright.unit.config.ts tests/unit/loop-profile-diagnostics.spec.ts` — all profile diagnostic tests pass
- [ ] 6.2 Run `npx playwright test --config playwright.unit.config.ts tests/unit/loop-chain-solver.spec.ts` — all chain solver unit tests pass
- [ ] 6.3 Run `npx playwright test --config playwright.unit.config.ts tests/unit/interaction-loops-chains.spec.ts` — all loop tests pass including the 3 formerly-fixme'd tests, 0 skipped
- [ ] 6.4 Run `npm run test:unit` — all unit tests pass, 0 skipped
- [ ] 6.5 Run `npm run build` — production build succeeds

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/interaction-engine/types.ts` | Modify | Add `LoopStep`, `ResourceRequirement`, `ResourceProduction` types |
| `src/lib/interaction-engine/loop-chain-solver.ts` | Create | Step extraction, mana satisfaction, chain solver, loop conversion |
| `src/lib/interaction-engine/interaction-detector.ts` | Modify | Call chain solver from `detectLoops` |
| `tests/unit/loop-profile-diagnostics.spec.ts` | Create | CardProfile extraction diagnostics for 17 cards |
| `tests/unit/loop-chain-solver.spec.ts` | Create | Unit tests for step extraction, mana math, and chain solving |
| `tests/unit/interaction-loops-chains.spec.ts` | Modify | Fix Plunderer test sac outlet, unfixme 3 loop tests |

No changes to: `capability-extractor.ts` (extraction gaps handled by oracle fallback in step extractor), any UI components, any e2e tests.

## Verification

1. `npx playwright test --config playwright.unit.config.ts tests/unit/loop-profile-diagnostics.spec.ts` — all profile diagnostic tests pass
2. `npx playwright test --config playwright.unit.config.ts tests/unit/loop-chain-solver.spec.ts` — all chain solver tests pass
3. `npx playwright test --config playwright.unit.config.ts tests/unit/interaction-loops-chains.spec.ts` — 24/24 pass, 0 skipped
4. `npm run test:unit` — all unit tests pass, 0 skipped
5. `npm run build` — production build succeeds
6. Manual: verify Ashnod's Altar + Plunderer + Skeleton reports `isInfinite: true` and mana-positive
7. Manual: verify Mikaeus + Triskelion reports a loop (heuristic)
8. Manual: verify Kitchen Finks + Seer + Vizier reports `isInfinite: true`
9. Manual: verify Kitchen Finks + Seer WITHOUT Vizier does NOT report a loop (blocking output unconsumed)
