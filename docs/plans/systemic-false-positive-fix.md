# Systemic Fix for False Positive Interactions

## Context

The interaction engine's parser, lexer, and detector have three compounding architectural issues that produce false positive interactions. When the parser encounters a trigger pattern it doesn't recognize (passive voice damage, conditional triggers, unrecognized keywords), it silently falls back to an ETB (enters the battlefield) zone transition. Because ETB with empty types is the broadest possible trigger — it matches any card entering the battlefield — this single fallback pollutes the entire interaction graph. Cards like Gaea's Blessing (which triggers on library→graveyard) and Spiteful Sliver (which triggers on damage dealt) appear as ETB triggers, creating chains like "Lazotep Sliver causes an ETB, triggering Gaea's Blessing" that have no basis in reality.

The detector compounds this by lacking quality gates: `objectTypesMatch()` treats empty types as wildcards on both sides, so a false ETB trigger (empty types) matches any caused event (also possibly empty types) at the default 0.6 strength — which is above the chain inclusion threshold. There are no penalties for vagueness, no minimum strength filters on pairwise output, and no way to distinguish a confidently-parsed interaction from a parser-guessing one.

The lexer has coverage gaps in entire _categories_ of MTG phrasing, not just individual cards. Passive voice damage patterns ("damage is dealt to"), conditional zone transitions ("If ~ is put into a graveyard from a library"), and zone qualifiers ("from a library", "from exile") are all missing. These cause the parser to fall through to the ETB fallback.

**Intended outcome**: Eliminate false positive interactions architecturally by (1) making the parser honest about what it can't parse, (2) adding quality gates to the detector, and (3) closing the most impactful lexer gaps.

**In scope**: Parser fallback, lexer pattern categories, detector quality gates, `classifyAbility()` for "If" conditionals, `objectTypesMatch()` strictness, `computeTriggerStrength()` vagueness penalty.

**Out of scope**: Adding "eternalize" keyword support, modal ability deduplication, multi-card chain detection beyond pairwise, token subtype enrichment. These are real issues but are follow-up work.

## Design Decisions

### D1: Parser returns `null` for unrecognized triggers

When `parseTrigger()` cannot classify a trigger, it returns `null` instead of a false ETB. The caller (`parseTriggeredAbility()`) produces a triggered ability with `trigger: null`. The capability extractor (`extractTriggersOn()`) skips abilities with null triggers. This means unrecognized triggers produce **zero profile data** instead of **false profile data**.

**Rationale**: False data is worse than missing data. A missing trigger means the card simply won't participate in trigger-based interactions — which is correct, because the engine doesn't understand the trigger well enough to reason about it. The alternative (adding a new `"unknown"` GameEvent kind) would require changes across the entire type system and detector.

### D2: `computeTriggerStrength()` penalizes vague matches

A new scoring tier at the bottom of zone transition matching:

| Scenario | Current Score | New Score |
|----------|-------------|-----------|
| Both specify from+to zones + specific types match | 1.0 | 1.0 |
| Both specify from+to zones, wildcard types | 0.8 | 0.8 |
| One side specifies zones | 0.8 | 0.7 |
| Neither side has specific zones, but one has types | 0.6 | 0.5 |
| Neither side has zones OR types (vague-to-vague) | 0.6 | 0.3 |

This means vague-to-vague matches fall below the chain inclusion threshold (0.6), eliminating them from chains entirely.

### D3: Minimum pairwise strength threshold

`buildAnalysisResult()` filters out pairwise interactions below 0.5 strength before passing them to chain/loop/enabler detection. This acts as a safety net: even if a false trigger slips through, its low specificity score prevents it from appearing in the final output.

### D4: Lexer pattern categories to add

| Category | Patterns | Normalized As |
|----------|----------|--------------|
| Passive damage | `"damage is dealt to"`, `"damage is dealt"` | `PLAYER_ACTION: "is_dealt_damage"` |
| Zone-qualified graveyard | `"is put into a graveyard from a library"` | `ZONE_TRANSITION: "milled"` |
| Zone-qualified graveyard | `"is put into a graveyard from your library"` | `ZONE_TRANSITION: "milled"` |
| Zone-qualified return | `"returns from exile"`, `"return from exile"` | `ZONE_TRANSITION: "returns_from_exile"` |

### D5: "If [zone transition], [effect]" as triggered ability

`classifyAbility()` gains a new check: if the first token is `CONDITIONAL: "if"` AND the tokens contain a `ZONE_TRANSITION` token (and do NOT contain "would"/"instead"), classify as `"triggered"`. This correctly handles Gaea's Blessing's "If Gaea's Blessing is put into a graveyard from a library, shuffle your graveyard into your library."

This pattern captures the MTG rules concept of "intervening if" — abilities phrased as "If [condition], [effect]" that are actually triggered abilities, not replacement effects.

## Implementation Tasks

### Phase 1: Write Tests (TDD)

- [ ] 1.1 Add parser fallback tests in `tests/unit/interaction-detector.spec.ts`
  - Test case: card with unrecognized trigger text produces zero `triggersOn` events (not false ETB)
  - Test case: card with recognized ETB trigger still produces correct `triggersOn` ETB event
  - Test case: card with "damage is dealt to" trigger produces `damage` event (not ETB)
  - Test case: card with "If ~ is put into a graveyard from a library" produces correct `zone_transition` trigger with `from: "library", to: "graveyard"`

- [ ] 1.2 Add detector quality gate tests in `tests/unit/interaction-detector.spec.ts`
  - Test case: vague-to-vague zone transition match scores ≤ 0.3 strength
  - Test case: interactions below 0.5 strength are excluded from final output
  - Test case: specific zone + specific type match still scores 1.0
  - Test case: one-side-zones match scores 0.7

- [ ] 1.3 Add lexer pattern tests in `tests/unit/interaction-detector.spec.ts`
  - Test case: "damage is dealt to a Sliver" tokenizes `PLAYER_ACTION: "is_dealt_damage"` and produces a damage trigger
  - Test case: "is put into a graveyard from a library" tokenizes as `ZONE_TRANSITION: "milled"` and produces `{ from: "library", to: "graveyard" }`
  - Test case: Gaea's Blessing "If" ability is classified as triggered (not spell_effect)

### Phase 2: Fix Parser Fallback

- [ ] 2.1 Modify `src/lib/interaction-engine/parser.ts` — `parseTrigger()` returns `GameEvent | null`
  - Change return type from `GameEvent` to `GameEvent | null`
  - Replace ETB fallback (line 979-984) with `return null`

- [ ] 2.2 Modify `src/lib/interaction-engine/parser.ts` — `parseTriggeredAbility()` handles null trigger
  - When `parseTrigger()` returns null, set `trigger` to a sentinel that the extractor can detect
  - Approach: keep the `TriggeredAbility` type unchanged; use a marker event `{ kind: "zone_transition", to: "nowhere" }` as an internal sentinel OR make `TriggeredAbility.trigger` optional (`trigger?: GameEvent`)
  - **Preferred**: Make `TriggeredAbility.trigger` optional (`trigger?: GameEvent`). When null, the ability's effects are still parsed (they may produce `causesEvents`), but no `triggersOn` entry is created.

- [ ] 2.3 Modify `src/lib/interaction-engine/types.ts` — make `TriggeredAbility.trigger` optional
  - Change `trigger: GameEvent` to `trigger?: GameEvent` in the `TriggeredAbility` interface

- [ ] 2.4 Modify `src/lib/interaction-engine/capability-extractor.ts` — `extractTriggersOn()` skips undefined triggers
  - Guard: `if (ability.abilityType === "triggered" && triggered.trigger)` before pushing

### Phase 3: Add Lexer Patterns

- [ ] 3.1 Modify `src/lib/interaction-engine/lexer.ts` — add passive damage patterns
  - Add `{ pattern: "damage is dealt to", type: "PLAYER_ACTION", normalized: "is_dealt_damage" }` before the existing `"is dealt damage"` entry
  - Add `{ pattern: "damage is dealt", type: "PLAYER_ACTION", normalized: "is_dealt_damage" }` as fallback

- [ ] 3.2 Modify `src/lib/interaction-engine/lexer.ts` — add zone-qualified graveyard transitions
  - Add `{ pattern: "is put into a graveyard from a library", type: "ZONE_TRANSITION", normalized: "milled" }` BEFORE the generic "is put into a graveyard" entry (longest-first ordering)
  - Add `{ pattern: "is put into a graveyard from your library", type: "ZONE_TRANSITION", normalized: "milled" }`

- [ ] 3.3 Modify `src/lib/interaction-engine/parser.ts` — handle `"milled"` normalized token in `parseZoneTransitionTrigger()`
  - Map `"milled"` → `{ kind: "zone_transition", from: "library", to: "graveyard" }`

### Phase 4: Fix Classifier for "If" Conditionals

- [ ] 4.1 Modify `src/lib/interaction-engine/parser.ts` — `classifyAbility()` recognizes "If [zone_transition]" as triggered
  - After the replacement effect check (line 105-113) and BEFORE falling through to activated/keyword/static, add:
  ```typescript
  // "If [zone transition], [effect]" — intervening-if triggered ability
  // e.g. "If Gaea's Blessing is put into a graveyard from a library, ..."
  if (
    first.type === "CONDITIONAL" &&
    first.normalized === "if" &&
    hasType(tokens, "ZONE_TRANSITION") &&
    !hasNormalized(tokens, "would")
  ) {
    return "triggered";
  }
  ```

### Phase 5: Add Detector Quality Gates

- [ ] 5.1 Modify `src/lib/interaction-engine/interaction-detector.ts` — `computeTriggerStrength()` penalizes vagueness
  - Replace the zone_transition final `return 0.6` with tiered scoring:
    - If neither side has zones but one has types → 0.5
    - If neither side has zones AND neither has types → 0.3 (vague-to-vague)

- [ ] 5.2 Modify `src/lib/interaction-engine/interaction-detector.ts` — add minimum pairwise strength filter
  - In `buildAnalysisResult()`, after `deduplicateInteractions()`, filter: `interactions = interactions.filter(i => i.strength >= 0.5)`
  - This removes vague-to-vague matches (0.3) from the entire pipeline

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `tests/unit/interaction-detector.spec.ts` | Modify | Add regression tests for parser fallback, quality gates, lexer patterns |
| `src/lib/interaction-engine/parser.ts` | Modify | Return null from parseTrigger fallback, classify "If" conditionals, handle "milled" token |
| `src/lib/interaction-engine/types.ts` | Modify | Make TriggeredAbility.trigger optional |
| `src/lib/interaction-engine/capability-extractor.ts` | Modify | Guard extractTriggersOn against undefined triggers |
| `src/lib/interaction-engine/lexer.ts` | Modify | Add passive damage and zone-qualified graveyard patterns |
| `src/lib/interaction-engine/interaction-detector.ts` | Modify | Vagueness penalty in computeTriggerStrength, minimum pairwise filter |

No changes to: `src/components/InteractionSection.tsx`, `src/app/api/`, `src/lib/interaction-engine/keyword-database.ts`, `playwright.config.ts`, `playwright.unit.config.ts`.

## Verification

1. `npm run test:unit` — all unit tests pass (including new regression tests)
2. `npm run test:e2e` — all e2e tests pass (no UI regressions)
3. `npm run build` — production build succeeds with no TypeScript errors
4. Manual: Import a Sliver deck (the user's test deck) and verify:
   - No "Gaea's Blessing" ETB triggers appear
   - No "Lazotep Sliver causes an ETB" false chains
   - Chains section shows ≤30 high-quality chains with coherent reasoning
   - Real interactions (Basal Sliver sacrifice → Blood Artist death trigger) still detected
