/**
 * Effect Classifier — Core of the Reasoning Engine
 *
 * Classifies each effect from a CardProfile's abilities by:
 * 1. What the effect does (EffectCategory)
 * 2. Whether it's good or bad for the target (EffectPolarity)
 * 3. Who should be targeted (TargetIntent)
 */

import type {
  AbilityNode,
  ActivatedAbility,
  TriggeredAbility,
  StaticAbility,
  SpellEffect,
  Effect,
  Cost,
  GameObjectRef,
  StatModification,
  KeywordGrant,
} from "../interaction-engine/types";
import type {
  EffectPolarity,
  TargetIntent,
  EffectCategory,
  AnnotatedEffect,
} from "./types";

// ═══════════════════════════════════════════════════════════════════
// Effect Categorization
// ═══════════════════════════════════════════════════════════════════

/** Categorize an Effect by what it fundamentally does */
export function categorizeEffect(effect: Effect): EffectCategory {
  // Check gameEffect first (most specific)
  if (effect.gameEffect) {
    switch (effect.gameEffect.category) {
      case "damage":
        return "removal_damage";
      case "create_token":
        return "token_creation";
      case "destroy":
        return "removal_destroy";
      case "exile":
        return "removal_exile";
      case "return": {
        const ret = effect.gameEffect;
        if (ret.from === "graveyard" && ret.to === "battlefield") {
          return "reanimate";
        }
        return "removal_bounce";
      }
      case "copy":
        return "copy";
      case "restriction":
        return "other";
      case "player_counter":
        return "other";
      case "win_condition":
        return "other";
      case "extra_turn":
        return "other";
      case "player_control":
        return "control_change";
      case "cost_substitution":
        return "other";
      case "type_change":
        return "other";
      default:
        break;
    }
  }

  // Check zone transitions
  if (effect.zoneTransition) {
    const zt = effect.zoneTransition;
    if (zt.from === "battlefield" && zt.to === "graveyard") {
      if (zt.cause === "sacrifice") return "sacrifice";
      if (zt.cause === "destroy") return "removal_destroy";
      return "removal_destroy";
    }
    if (zt.from === "battlefield" && zt.to === "exile") {
      return "removal_exile";
    }
    if (zt.from === "battlefield" && zt.to === "hand") {
      return "removal_bounce";
    }
    if (zt.from === "graveyard" && zt.to === "battlefield") {
      return "reanimate";
    }
    if (zt.from === "hand" && zt.to === "graveyard") {
      return "discard";
    }
    if (zt.from === "library" && zt.to === "graveyard") {
      return "mill";
    }
  }

  // Check attributes
  if (effect.attribute) {
    if (effect.attribute.category === "stat_mod") {
      const mod = effect.attribute as StatModification;
      return classifyStatMod(mod);
    }
    if (effect.attribute.category === "keyword_grant") {
      return "keyword_grant";
    }
    if (effect.attribute.category === "counter") {
      const ct = effect.attribute.counterType;
      if (ct === "-1/-1") return "counter_negative";
      return "counter_positive";
    }
  }

  // Check resource effects
  if (effect.resource) {
    if (effect.resource.category === "life") {
      const qty = effect.resource.quantity;
      if (typeof qty === "number" && qty > 0) return "life_gain";
      if (typeof qty === "number" && qty < 0) return "life_loss";
      return "life_gain"; // default for "X" life
    }
    if (effect.resource.category === "cards") {
      return "card_draw";
    }
    if (effect.resource.category === "mana") {
      return "mana_production";
    }
  }

  // Check effect type string for fallback categorization
  const type = effect.type?.toLowerCase() ?? "";
  if (type.includes("destroy")) return "removal_destroy";
  if (type.includes("exile")) return "removal_exile";
  if (type.includes("damage")) return "removal_damage";
  if (type.includes("create_token") || type.includes("token")) return "token_creation";
  if (type.includes("draw")) return "card_draw";
  if (type.includes("sacrifice")) return "sacrifice";
  if (type.includes("discard")) return "discard";
  if (type.includes("mill")) return "mill";
  if (type.includes("gain_life") || type.includes("life_gain")) return "life_gain";
  if (type.includes("lose_life") || type.includes("life_loss")) return "life_loss";
  if (type.includes("counter") && type.includes("+1")) return "counter_positive";
  if (type.includes("counter") && type.includes("-1")) return "counter_negative";
  if (type.includes("keyword") || type.includes("grant")) return "keyword_grant";
  if (type.includes("return") || type.includes("bounce")) return "removal_bounce";
  if (type.includes("reanimate") || type.includes("return_from_graveyard")) return "reanimate";
  if (type.includes("control")) return "control_change";

  return "other";
}

/** Classify a stat modification as buff or debuff */
function classifyStatMod(mod: StatModification): EffectCategory {
  const p = parseStatValue(mod.power);
  const t = parseStatValue(mod.toughness);

  // Both positive or zero → buff
  if (p >= 0 && t >= 0 && (p > 0 || t > 0)) return "stat_buff";
  // Both negative → debuff
  if (p <= 0 && t <= 0 && (p < 0 || t < 0)) return "stat_debuff";
  // Mixed (e.g., +1/-1 Skullclamp) → debuff if toughness is negative
  // because reducing toughness can kill the creature
  if (t < 0) return "stat_debuff";
  // +X/+0 or similar
  return "stat_buff";
}

function parseStatValue(val: number | string): number {
  if (typeof val === "number") return val;
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

// ═══════════════════════════════════════════════════════════════════
// Polarity Classification
// ═══════════════════════════════════════════════════════════════════

/** Determine whether an effect is beneficial, harmful, or contextual */
export function classifyEffectPolarity(
  category: EffectCategory,
  effect?: Effect
): EffectPolarity {
  switch (category) {
    // Clearly beneficial
    case "stat_buff":
    case "keyword_grant":
    case "token_creation":
    case "card_draw":
    case "life_gain":
    case "counter_positive":
    case "reanimate":
    case "mana_production":
    case "protection":
    case "copy":
      return "beneficial";

    // Clearly harmful
    case "removal_destroy":
    case "removal_exile":
    case "removal_bounce":
    case "removal_damage":
    case "board_wipe":
    case "counter_negative":
    case "life_loss":
    case "control_change":
      return "harmful";

    // Context-dependent
    case "sacrifice":
    case "discard":
    case "mill":
      return "contextual";

    // Stat debuff: harmful, but could be contextual for mixed mods (Skullclamp)
    case "stat_debuff": {
      if (effect?.attribute?.category === "stat_mod") {
        const mod = effect.attribute as StatModification;
        const p = parseStatValue(mod.power);
        const t = parseStatValue(mod.toughness);
        // Mixed positive power + negative toughness → contextual (Skullclamp pattern)
        if (p > 0 && t < 0) return "contextual";
      }
      return "harmful";
    }

    default:
      return "neutral";
  }
}

// ═══════════════════════════════════════════════════════════════════
// Target Intent Inference
// ═══════════════════════════════════════════════════════════════════

/** Infer who should be targeted based on effect polarity and GameObjectRef */
export function inferTargetIntent(
  effect: Effect,
  polarity: EffectPolarity,
  isCost: boolean
): { intent: TargetIntent; confidence: number } {
  // Rule 1: Cost effects are always "cost"
  if (isCost) {
    return { intent: "cost", confidence: 1.0 };
  }

  // Rule 2: Check explicit controller on target
  const controller = extractController(effect);
  if (controller === "you") {
    return { intent: "self", confidence: 0.95 };
  }
  if (controller === "opponent" || controller === "each") {
    return { intent: "opponent", confidence: 0.95 };
  }

  // Rule 3: Infer from polarity
  if (polarity === "harmful") {
    return { intent: "opponent", confidence: 0.85 };
  }
  if (polarity === "beneficial") {
    return { intent: "self", confidence: 0.85 };
  }
  if (polarity === "contextual") {
    return { intent: "either", confidence: 0.5 };
  }

  // Rule 4: Neutral or unknown
  return { intent: "either", confidence: 0.3 };
}

/** Extract the controller from an effect's various target references */
function extractController(effect: Effect): string | undefined {
  // Check direct target
  if (effect.target?.controller) {
    return effect.target.controller;
  }

  // Check gameEffect targets
  if (effect.gameEffect) {
    const ge = effect.gameEffect;
    if ("target" in ge && ge.target && typeof ge.target === "object" && "controller" in ge.target) {
      return (ge.target as GameObjectRef).controller;
    }
  }

  // Check zone transition object
  if (effect.zoneTransition?.object?.controller) {
    return effect.zoneTransition.object.controller;
  }

  return undefined;
}

// ═══════════════════════════════════════════════════════════════════
// Ability-Level Classification
// ═══════════════════════════════════════════════════════════════════

/** Classify all effects in a single ability, respecting costs vs effects */
export function classifyAbilityEffects(
  ability: AbilityNode,
  abilityIndex: number
): AnnotatedEffect[] {
  const results: AnnotatedEffect[] = [];

  // Extract costs and effects based on ability type
  const costs: Cost[] = [];
  const effects: Effect[] = [];
  let modalModes: Effect[][] = [];

  switch (ability.abilityType) {
    case "activated": {
      const act = ability as ActivatedAbility;
      costs.push(...act.costs);
      if (act.modal?.modes) {
        modalModes = act.modal.modes.map((m) => m.effects);
      } else {
        effects.push(...act.effects);
      }
      break;
    }
    case "triggered": {
      const trig = ability as TriggeredAbility;
      if (trig.modal?.modes) {
        modalModes = trig.modal.modes.map((m) => m.effects);
      } else {
        effects.push(...trig.effects);
      }
      break;
    }
    case "static": {
      const stat = ability as StaticAbility;
      effects.push(...stat.effects);
      break;
    }
    case "spell_effect": {
      const spell = ability as SpellEffect;
      if (spell.modal?.modes) {
        modalModes = spell.modal.modes.map((m) => m.effects);
      } else {
        effects.push(...spell.effects);
      }
      // Additional costs from casting
      if (spell.castingCost?.additionalCosts) {
        costs.push(...spell.castingCost.additionalCosts);
      }
      break;
    }
    case "keyword":
      // Keywords are handled separately (keyword_grant category)
      break;
    case "replacement":
      // Replacement effects are complex — classify their "with" effects
      effects.push(...ability.with);
      break;
  }

  // Classify cost effects
  for (const cost of costs) {
    const costEffect = costToEffect(cost);
    if (costEffect) {
      const category = categorizeEffect(costEffect);
      const polarity = classifyEffectPolarity(category, costEffect);
      const { intent, confidence } = inferTargetIntent(costEffect, polarity, true);

      results.push({
        abilityIndex,
        effect: costEffect,
        effectCategory: category,
        polarity,
        targetIntent: intent,
        confidence,
        isCostEffect: true,
        contextOverridable: category === "sacrifice" || category === "discard",
        reasoning: `Cost: ${category} (${polarity})`,
      });
    }
  }

  // Classify regular effects
  for (const effect of effects) {
    results.push(classifySingleEffect(effect, abilityIndex, false));
  }

  // Classify modal mode effects independently
  for (const modeEffects of modalModes) {
    for (const effect of modeEffects) {
      results.push(classifySingleEffect(effect, abilityIndex, false));
    }
  }

  return results;
}

/** Classify a single effect */
function classifySingleEffect(
  effect: Effect,
  abilityIndex: number,
  isCost: boolean
): AnnotatedEffect {
  const category = categorizeEffect(effect);
  const polarity = classifyEffectPolarity(category, effect);
  const { intent, confidence } = inferTargetIntent(effect, polarity, isCost);

  return {
    abilityIndex,
    effect,
    effectCategory: category,
    polarity,
    targetIntent: intent,
    confidence,
    isCostEffect: isCost,
    contextOverridable:
      (polarity as string) === "contextual",
    reasoning: `${category}: ${polarity} → ${intent} (confidence: ${confidence})`,
  };
}

/** Convert a Cost object to an Effect for classification purposes */
function costToEffect(cost: Cost): Effect | null {
  switch (cost.costType) {
    case "sacrifice":
      return {
        type: "sacrifice",
        target: cost.object,
        zoneTransition: {
          kind: "zone_transition",
          from: "battlefield",
          to: "graveyard",
          object: cost.object,
          cause: "sacrifice",
        },
      };
    case "discard":
      return {
        type: "discard",
        target: cost.object,
        zoneTransition: cost.object
          ? {
              kind: "zone_transition",
              from: "hand",
              to: "graveyard",
              object: cost.object,
              cause: "discard",
            }
          : undefined,
      };
    case "pay_life":
      return {
        type: "pay_life",
        resource: {
          category: "life",
          quantity: typeof cost.quantity === "number" ? -cost.quantity : -1,
        },
      };
    case "exile":
      return {
        type: "exile",
        target: cost.object,
      };
    default:
      return null; // Tap, mana, etc. don't need classification
  }
}
