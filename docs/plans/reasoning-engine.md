# Reasoning Engine

## Context

The deck evaluator's synergy engine currently operates at the **card level**, treating all legal interactions as positive synergies. This produces systematic false positives where opponent-targeted effects (removal, -X/-X, forced sacrifice) are scored as synergies with your own permanents. The canonical example: **Breya, Etherium Shaper** has an activated ability that gives a creature -4/-4. The engine pairs her with every creature in the deck as "Amplified" synergy — but in actual gameplay, -4/-4 is removal aimed at an opponent's creature, not a synergy with your own board.

The root cause is that synergy axes use regex-based detection on oracle text without understanding **effect polarity** (beneficial vs harmful) or **target intent** (self vs opponent). The card tagging system (`card-tags.ts`) already classifies effects into categories like "Removal" and "Board Wipe", but these tags are only consulted during anti-synergy detection, never during positive synergy pair generation. Meanwhile, the interaction engine (`src/lib/interaction-engine/`) has a full oracle text compiler that produces `CardProfile` ASTs with `GameObjectRef.controller` fields — but this rich data is not connected to the synergy scoring pipeline.

The reasoning engine is a **bridge layer** between the interaction engine's parsed card profiles and the synergy engine's pair generation. It classifies each effect's polarity and target intent, then filters synergy pairs where a card's contribution to an axis is purely opponent-directed. It also supports **deck context overrides** where normally harmful effects become beneficial (enrage creatures want to be dealt damage, aristocrats decks want sacrifice, madness decks want discard).

**In scope:** Effect polarity classification, target intent inference, synergy pair filtering, deck context overrides for enrage/aristocrats/madness/indestructible. **Out of scope:** Rewriting synergy axes to use CardProfile directly, changing the interaction engine, UI changes, infinite loop detection (already handled by interaction engine).

## Design Decisions

### Bridge Layer vs Axis Rewrite

The reasoning engine wraps existing infrastructure rather than replacing it. Synergy axes continue to use regex detection for relevance scoring. The reasoning engine adds a **pre-filter** in `generateSynergyPairs()` that consults effect polarity before emitting pairs. This is backward-compatible (reasoning is opt-in via an options flag) and avoids the risk of rewriting 13 established axes.

### Effect Polarity Model

Effects are classified into three polarities:

| Polarity | Meaning | Oracle Signals | Target Intent |
|----------|---------|----------------|---------------|
| `beneficial` | Good for target's controller | +X/+X, keyword grant, draw, create token | Self |
| `harmful` | Bad for target's controller | -X/-X, destroy, exile, damage to creature | Opponent |
| `contextual` | Depends on deck strategy | Sacrifice (cost), discard, self-bounce, self-damage | Deck-dependent |

### Target Intent Inference Rules

1. **Explicit controller** — `GameObjectRef.controller === "you"` → self (confidence 0.95)
2. **Explicit opponent** — `GameObjectRef.controller === "opponent"` → opponent (confidence 0.95)
3. **Harmful + unqualified** — Polarity is harmful and no controller specified → opponent (confidence 0.85)
4. **Beneficial + unqualified** — Polarity is beneficial and no controller specified → self (confidence 0.85)
5. **Cost effects** — Effects in a cost list (sacrifice, discard, pay life) → cost (confidence 1.0)
6. **Contextual** — Effects flagged as contextual → either (confidence 0.5), overridable by deck context

### Deck Context Overrides

| Deck Signal | Override | Detection |
|-------------|----------|-----------|
| Death triggers present | Sacrifice costs become self-beneficial synergy | `whenever .* dies`, `whenever you sacrifice`, Persist, Undying keywords |
| Graveyard strategy | Mill/discard become self-beneficial | Graveyard axis strength > threshold |
| Madness payoffs | Discard becomes self-beneficial | Madness keyword on 2+ cards |
| Enrage/damage payoffs | Damage-to-creature becomes self-beneficial | `whenever .* is dealt damage`, Enrage keyword |
| Indestructible creatures | Board wipes become asymmetric advantage | Indestructible keyword + board wipe in same deck |

## Algorithm Design

### Effect Classification Pipeline

```
EnrichedCard
    ↓ profileCard()
CardProfile (abilities[], produces[], consumes[], causesEvents[])
    ↓ classifyEffects()
AnnotatedEffect[] (each effect gets polarity + targetIntent)
    ↓ applyDeckContext()
AnnotatedEffect[] (context overrides applied)
    ↓ buildCardIntentSummary()
CardIntentSummary (per-axis intent: self/opponent/both)
```

### Synergy Pair Filtering

In `generateSynergyPairs()`, before emitting a pair:

1. Look up both cards' `CardIntentSummary`
2. For the shared axis, check if either card's intent is `opponent-only`
3. If card A's contribution to axis X is purely opponent-directed (e.g., Breya's -4/-4 on the sacrifice axis), skip the pair
4. Exception: if card B has a context override (e.g., enrage creature), allow the pair

### Per-Axis Intent Mapping

| Axis | Opponent-Intent Signals | Self-Intent Signals |
|------|------------------------|---------------------|
| sacrifice | Forced opponent sacrifice | Sacrifice outlets + death triggers in deck |
| artifacts | Destroy/exile artifacts | Artifact ETB triggers, affinity, metalcraft |
| lifegain | Opponent loses life (incidental) | Lifegain triggers, soul sisters |
| counters | -1/-1 counters on targets | +1/+1 counters, proliferate |
| tokens | — | Token creation, populate |

## Implementation Tasks

### Phase 1: Write Tests (TDD)

- [ ] 1.1 Create `tests/unit/reasoning-engine.spec.ts` with core classification tests
  - Test: Breya's -4/-4 mode is classified as `harmful` + `opponent` intent
  - Test: Breya's token creation ETB is classified as `beneficial` + `self` intent
  - Test: Breya's "you gain 5 life" mode is classified as `beneficial` + `self` intent
  - Test: Craterhoof Behemoth's +X/+X is classified as `beneficial` + `self` intent
  - Test: Swords to Plowshares "exile target creature" is `harmful` + `opponent` intent
  - Test: `+1/+1 counter` effects are `beneficial`
  - Test: `-1/-1 counter` effects are `harmful`
  - Test: Sacrifice costs are classified as `cost` intent
  - Test: Keyword grants (flying, hexproof) are `beneficial` + `self`
  - Test: "destroy all creatures" is `harmful` + `opponent` (affects all but intent is opponent-hostile)
  - Test: Cards with explicit "you control" are always `self` intent
  - Test: Cards with explicit "opponent controls" are always `opponent` intent

- [ ] 1.2 Add deck context override tests to `tests/unit/reasoning-engine.spec.ts`
  - Test: Sacrifice costs become synergistic when death triggers are present
  - Test: Damage-to-creature becomes synergistic with enrage creatures
  - Test: Discard costs become synergistic when madness payoffs are present
  - Test: Board wipes become synergistic when indestructible creatures are present
  - Test: Context overrides do NOT apply when deck lacks the relevant payoffs

- [ ] 1.3 Add integration tests to `tests/unit/reasoning-engine.spec.ts`
  - Test: `analyzeDeckSynergy()` with `reasoning: true` does NOT pair Breya with random creatures
  - Test: `analyzeDeckSynergy()` with `reasoning: true` DOES pair Craterhoof with creatures
  - Test: `analyzeDeckSynergy()` without reasoning flag behaves identically to before (backward compat)
  - Test: Aristocrats deck correctly pairs sacrifice outlets with death trigger creatures
  - Test: Vandalblast (destroy opponent's artifacts) does NOT synergize with your own artifacts

### Phase 2: Implement Core Types and Effect Classifier

- [ ] 2.1 Create `src/lib/reasoning-engine/types.ts`
  - Type: `EffectPolarity = "beneficial" | "harmful" | "neutral" | "contextual"`
  - Type: `TargetIntent = "self" | "opponent" | "either" | "cost"`
  - Type: `EffectCategory` (enum of ~15 categories: stat_buff, stat_debuff, removal, token_creation, etc.)
  - Interface: `AnnotatedEffect { abilityIndex, effectCategory, polarity, targetIntent, confidence, contextOverridable, reasoning }`
  - Interface: `CardIntentSummary { cardName, effects: AnnotatedEffect[], axisSummary: Map<string, TargetIntent> }`
  - Interface: `DeckReasoningContext { hasDeathTriggers, hasGraveyardSynergy, hasMadnessPayoffs, hasEnragePayoffs, hasIndestructible, activeAxes }`
  - Interface: `IntentOverride { effectCategory, originalIntent, overriddenIntent, reason }`

- [ ] 2.2 Create `src/lib/reasoning-engine/effect-classifier.ts`
  - Function: `classifyEffectPolarity(effect: Effect): EffectPolarity` — decision tree based on effect type
  - Function: `inferTargetIntent(effect: Effect, polarity: EffectPolarity): { intent: TargetIntent, confidence: number }` — uses GameObjectRef.controller + polarity fallback
  - Function: `categorizeEffect(effect: Effect): EffectCategory` — maps Effect to EffectCategory
  - Function: `classifyAbilityEffects(ability: AbilityNode): AnnotatedEffect[]` — processes all effects in an ability, marking cost effects appropriately
  - Handles modal abilities: each mode's effects classified independently
  - Handles costs: sacrifice/discard in cost lists marked as `cost` intent

### Phase 3: Implement Intent Resolver and Deck Context

- [ ] 3.1 Create `src/lib/reasoning-engine/intent-resolver.ts`
  - Function: `buildCardIntentSummary(card: EnrichedCard): CardIntentSummary` — profiles card via interaction engine, classifies all effects
  - Function: `buildDeckIntentSummaries(cardMap: Record<string, EnrichedCard>): Record<string, CardIntentSummary>` — batch processing with caching
  - Function: `mapEffectToAxis(effect: AnnotatedEffect): string | null` — maps effect categories to synergy axis IDs

- [ ] 3.2 Create `src/lib/reasoning-engine/deck-context.ts`
  - Function: `analyzeDeckContext(cardMap: Record<string, EnrichedCard>, axisScores: Map<string, CardAxisScore[]>): DeckReasoningContext`
  - Function: `generateIntentOverrides(context: DeckReasoningContext): IntentOverride[]`
  - Function: `applyDeckContext(summaries: Record<string, CardIntentSummary>, context: DeckReasoningContext): void` — mutates summaries with overrides

- [ ] 3.3 Create `src/lib/reasoning-engine/index.ts`
  - Re-export public API: types, `buildCardIntentSummary`, `buildDeckIntentSummaries`, `analyzeDeckContext`, `applyDeckContext`

### Phase 4: Integrate with Synergy Engine

- [ ] 4.1 Modify `src/lib/synergy-engine.ts`
  - Add `reasoning?: boolean` to `analyzeDeckSynergy()` options (new optional parameter)
  - When `reasoning: true`: build intent summaries, analyze deck context, apply overrides
  - Pass `CardIntentSummary` records into `generateSynergyPairs()`
  - In pair generation loop: skip pairs where either card's axis contribution is `opponent`-only and the other card has no context override
  - Ensure backward compatibility: when `reasoning` is falsy, behavior is identical

- [ ] 4.2 Modify `src/lib/types.ts`
  - Add optional `reasoning?: boolean` to a new `SynergyAnalysisOptions` interface (or inline in function signature)

### Phase 5: Verification and Cleanup

- [ ] 5.1 Run full test suite and fix any regressions
- [ ] 5.2 Verify Breya scenario produces correct results end-to-end

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/reasoning-engine/types.ts` | Create | Core types: EffectPolarity, TargetIntent, AnnotatedEffect, CardIntentSummary |
| `src/lib/reasoning-engine/effect-classifier.ts` | Create | Effect polarity classification + target intent inference |
| `src/lib/reasoning-engine/intent-resolver.ts` | Create | Orchestration: card profiling → effect classification → axis mapping |
| `src/lib/reasoning-engine/deck-context.ts` | Create | Deck context analysis + intent overrides for enrage/aristocrats/madness |
| `src/lib/reasoning-engine/index.ts` | Create | Public API re-exports |
| `src/lib/synergy-engine.ts` | Modify | Add reasoning option, filter synergy pairs by intent |
| `tests/unit/reasoning-engine.spec.ts` | Create | Unit tests for classifier, context, and integration |

No changes to: `src/lib/synergy-axes.ts`, `src/lib/card-tags.ts`, `src/lib/types.ts`, `src/lib/interaction-engine/**`, `src/components/**`, `src/app/**`.

## Verification

1. `npm run test:unit` — all unit tests pass including new reasoning-engine tests
2. `npm run test:e2e` — all existing e2e tests pass (no regressions)
3. `npm run build` — production build succeeds
4. Manual: Create a Breya deck with random creatures, run with `reasoning: true`, verify Breya does not show synergy pairs with creatures that lack death triggers or enrage
5. Manual: Create an aristocrats deck (Viscera Seer + Blood Artist + Zulaport Cutthroat), verify sacrifice synergies are preserved with reasoning enabled
