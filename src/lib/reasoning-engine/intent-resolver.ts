/**
 * Intent Resolver — Orchestrates effect classification for cards
 *
 * Profiles cards via the interaction engine, classifies all effects,
 * and builds per-card intent summaries for synergy pair filtering.
 */

import type { EnrichedCard } from "../types";
import { profileCard } from "../interaction-engine/capability-extractor";
import { classifyAbilityEffects } from "./effect-classifier";
import type {
  AnnotatedEffect,
  CardIntentSummary,
  EffectCategory,
  TargetIntent,
} from "./types";

// ═══════════════════════════════════════════════════════════════════
// Effect Category → Synergy Axis Mapping
// ═══════════════════════════════════════════════════════════════════

const EFFECT_TO_AXIS: Record<string, string[]> = {
  stat_buff: ["counters"],
  stat_debuff: ["sacrifice"], // -X/-X is often paired with sacrifice/removal
  keyword_grant: ["keywordMatters"],
  removal_destroy: [],
  removal_exile: [],
  removal_bounce: [],
  removal_damage: [],
  board_wipe: [],
  token_creation: ["tokens"],
  card_draw: [],
  life_gain: ["lifegain"],
  life_loss: [],
  counter_positive: ["counters"],
  counter_negative: [],
  sacrifice: ["sacrifice"],
  discard: ["graveyard"],
  mill: ["graveyard"],
  reanimate: ["graveyard"],
  mana_production: ["landfall"],
  copy: ["spellslinger"],
  control_change: [],
  protection: [],
  other: [],
};

/** Map an effect category to relevant synergy axis IDs */
export function mapEffectToAxes(category: EffectCategory): string[] {
  return EFFECT_TO_AXIS[category] ?? [];
}

// ═══════════════════════════════════════════════════════════════════
// Card Intent Summary Builder
// ═══════════════════════════════════════════════════════════════════

/** Build intent summary for a single card */
export function buildCardIntentSummary(card: EnrichedCard): CardIntentSummary {
  const profile = profileCard(card);
  const allEffects: AnnotatedEffect[] = [];
  let hasModal = false;

  // Classify effects in each ability
  for (let i = 0; i < profile.abilities.length; i++) {
    const ability = profile.abilities[i];
    const annotated = classifyAbilityEffects(ability, i);
    allEffects.push(...annotated);

    // Check if ability is modal
    if (ability.abilityType === "activated" || ability.abilityType === "triggered" || ability.abilityType === "spell_effect") {
      if ("modal" in ability && ability.modal) {
        hasModal = true;
      }
    }
  }

  // Also classify from oracle text fallback patterns using regex
  // for effects the parser may have missed
  const oracleEffects = classifyFromOracleText(card, allEffects);
  allEffects.push(...oracleEffects);

  // Build per-axis intent summary
  const axisIntent = buildAxisIntentMap(allEffects);

  return {
    cardName: card.name,
    effects: allEffects,
    axisIntent,
    hasModalAbilities: hasModal,
  };
}

/** Build intent summaries for all cards in a deck */
export function buildDeckIntentSummaries(
  cardMap: Record<string, EnrichedCard>
): Record<string, CardIntentSummary> {
  const summaries: Record<string, CardIntentSummary> = {};
  for (const [name, card] of Object.entries(cardMap)) {
    summaries[name] = buildCardIntentSummary(card);
  }
  return summaries;
}

// ═══════════════════════════════════════════════════════════════════
// Axis Intent Map
// ═══════════════════════════════════════════════════════════════════

/**
 * For each synergy axis this card's effects map to, determine the
 * dominant target intent. If a card has both self and opponent effects
 * on the same axis, the intent is "both".
 */
function buildAxisIntentMap(effects: AnnotatedEffect[]): Record<string, TargetIntent> {
  const axisIntents = new Map<string, Set<TargetIntent>>();

  for (const effect of effects) {
    const axes = mapEffectToAxes(effect.effectCategory);
    for (const axisId of axes) {
      if (!axisIntents.has(axisId)) {
        axisIntents.set(axisId, new Set());
      }
      axisIntents.get(axisId)!.add(effect.targetIntent);
    }
  }

  const result: Record<string, TargetIntent> = {};
  for (const [axisId, intents] of axisIntents) {
    if (intents.has("self") && intents.has("opponent")) {
      result[axisId] = "either"; // Card has both self and opponent on this axis
    } else if (intents.has("self")) {
      result[axisId] = "self";
    } else if (intents.has("opponent")) {
      result[axisId] = "opponent";
    } else if (intents.has("cost")) {
      result[axisId] = "cost";
    } else {
      result[axisId] = "either";
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// Oracle Text Fallback Classification
// ═══════════════════════════════════════════════════════════════════

// Regex patterns for effects the parser might miss
const STAT_DEBUFF_RE = /(?:gets?|get) -(\d+)\/-(\d+)/i;
const STAT_BUFF_RE = /(?:gets?|get) \+(\d+)\/\+(\d+)/i;
const MIXED_STAT_RE = /(?:gets?|get) \+(\d+)\/-(\d+)/i;
const DESTROY_TARGET_RE = /\bdestroy target\b/i;
const EXILE_TARGET_RE = /\bexile target\b/i;
const DAMAGE_TO_TARGET_RE = /\bdeals?\s+\d+\s+damage to\b/i;
const CREATE_TOKEN_RE = /\bcreate\b.+?\btoken/i;
const YOU_GAIN_LIFE_RE = /\byou gain\b.+?\blife\b/i;
const DESTROY_ALL_RE = /\bdestroy all\b/i;
const SACRIFICE_COST_RE = /sacrifice (?:a |an |another |two |three )/i;
const YOU_CONTROL_RE = /you control/i;
const OPPONENT_CONTROL_RE = /(?:opponent|you don't) control/i;
const DRAW_CARDS_RE = /\bdraw\b.+?\bcards?\b/i;
const KEYWORD_GRANT_RE = /\bgains?\b.+?\b(?:hexproof|indestructible|flying|trample|haste|vigilance|deathtouch|lifelink|menace|first strike|double strike|reach|ward)\b/i;

/**
 * Classify effects from oracle text as a fallback for things the
 * interaction engine parser might not have fully captured.
 * Only adds effects not already covered by parsed abilities.
 */
function classifyFromOracleText(
  card: EnrichedCard,
  existingEffects: AnnotatedEffect[]
): AnnotatedEffect[] {
  const text = card.oracleText;
  if (!text) return [];

  const results: AnnotatedEffect[] = [];
  const hasCategory = (cat: EffectCategory) =>
    existingEffects.some((e) => e.effectCategory === cat);

  // Check for stat debuffs not captured by parser
  if (!hasCategory("stat_debuff") && STAT_DEBUFF_RE.test(text)) {
    const isOpponent = OPPONENT_CONTROL_RE.test(text);
    const isSelf = YOU_CONTROL_RE.test(text) && !isOpponent;
    results.push({
      abilityIndex: -1,
      effect: { type: "stat_debuff_oracle" },
      effectCategory: "stat_debuff",
      polarity: "harmful",
      targetIntent: isOpponent ? "opponent" : isSelf ? "self" : "opponent",
      confidence: isOpponent || isSelf ? 0.95 : 0.85,
      isCostEffect: false,
      contextOverridable: false,
      reasoning: "Oracle text: stat debuff detected",
    });
  }

  // Check for mixed stat mods (Skullclamp pattern: +1/-1)
  if (!hasCategory("stat_debuff") && !hasCategory("stat_buff") && MIXED_STAT_RE.test(text)) {
    results.push({
      abilityIndex: -1,
      effect: { type: "stat_mixed_oracle" },
      effectCategory: "stat_debuff",
      polarity: "contextual",
      targetIntent: "self", // Equipment targets your creatures
      confidence: 0.7,
      isCostEffect: false,
      contextOverridable: true,
      reasoning: "Oracle text: mixed stat mod (+N/-N) — contextual polarity",
    });
  }

  // Check for stat buffs not captured
  if (!hasCategory("stat_buff") && STAT_BUFF_RE.test(text)) {
    const isSelf = YOU_CONTROL_RE.test(text);
    results.push({
      abilityIndex: -1,
      effect: { type: "stat_buff_oracle" },
      effectCategory: "stat_buff",
      polarity: "beneficial",
      targetIntent: isSelf ? "self" : "self",
      confidence: isSelf ? 0.95 : 0.85,
      isCostEffect: false,
      contextOverridable: false,
      reasoning: "Oracle text: stat buff detected",
    });
  }

  // Check for removal not captured
  if (!hasCategory("removal_destroy") && DESTROY_TARGET_RE.test(text)) {
    const isOpponent = OPPONENT_CONTROL_RE.test(text);
    results.push({
      abilityIndex: -1,
      effect: { type: "destroy_oracle" },
      effectCategory: "removal_destroy",
      polarity: "harmful",
      targetIntent: isOpponent ? "opponent" : "opponent",
      confidence: isOpponent ? 0.95 : 0.85,
      isCostEffect: false,
      contextOverridable: false,
      reasoning: "Oracle text: destroy target detected",
    });
  }

  // Check for exile not captured
  if (!hasCategory("removal_exile") && EXILE_TARGET_RE.test(text)) {
    results.push({
      abilityIndex: -1,
      effect: { type: "exile_oracle" },
      effectCategory: "removal_exile",
      polarity: "harmful",
      targetIntent: "opponent",
      confidence: 0.85,
      isCostEffect: false,
      contextOverridable: false,
      reasoning: "Oracle text: exile target detected",
    });
  }

  // Check for damage not captured
  if (!hasCategory("removal_damage") && DAMAGE_TO_TARGET_RE.test(text)) {
    results.push({
      abilityIndex: -1,
      effect: { type: "damage_oracle" },
      effectCategory: "removal_damage",
      polarity: "harmful",
      targetIntent: "opponent",
      confidence: 0.8,
      isCostEffect: false,
      contextOverridable: true, // Enrage creatures want this
      reasoning: "Oracle text: damage to target detected",
    });
  }

  // Check for token creation not captured
  if (!hasCategory("token_creation") && CREATE_TOKEN_RE.test(text)) {
    results.push({
      abilityIndex: -1,
      effect: { type: "token_oracle" },
      effectCategory: "token_creation",
      polarity: "beneficial",
      targetIntent: "self",
      confidence: 0.9,
      isCostEffect: false,
      contextOverridable: false,
      reasoning: "Oracle text: token creation detected",
    });
  }

  // Check for life gain not captured
  if (!hasCategory("life_gain") && YOU_GAIN_LIFE_RE.test(text)) {
    results.push({
      abilityIndex: -1,
      effect: { type: "life_gain_oracle" },
      effectCategory: "life_gain",
      polarity: "beneficial",
      targetIntent: "self",
      confidence: 0.9,
      isCostEffect: false,
      contextOverridable: false,
      reasoning: "Oracle text: life gain detected",
    });
  }

  // Check for board wipes not captured
  if (!hasCategory("board_wipe") && !hasCategory("removal_destroy") && DESTROY_ALL_RE.test(text)) {
    const isOpponent = OPPONENT_CONTROL_RE.test(text);
    results.push({
      abilityIndex: -1,
      effect: { type: "board_wipe_oracle" },
      effectCategory: "board_wipe",
      polarity: "harmful",
      targetIntent: isOpponent ? "opponent" : "opponent",
      confidence: isOpponent ? 0.95 : 0.8,
      isCostEffect: false,
      contextOverridable: !isOpponent, // Non-one-sided wipes can be overridden by indestructible
      reasoning: isOpponent
        ? "Oracle text: one-sided board wipe"
        : "Oracle text: board wipe detected",
    });
  }

  // Check for sacrifice costs not captured
  if (!hasCategory("sacrifice") && SACRIFICE_COST_RE.test(text)) {
    results.push({
      abilityIndex: -1,
      effect: { type: "sacrifice_oracle" },
      effectCategory: "sacrifice",
      polarity: "contextual",
      targetIntent: "cost",
      confidence: 0.85,
      isCostEffect: true,
      contextOverridable: true,
      reasoning: "Oracle text: sacrifice cost detected",
    });
  }

  // Check for card draw not captured
  if (!hasCategory("card_draw") && DRAW_CARDS_RE.test(text)) {
    results.push({
      abilityIndex: -1,
      effect: { type: "draw_oracle" },
      effectCategory: "card_draw",
      polarity: "beneficial",
      targetIntent: "self",
      confidence: 0.9,
      isCostEffect: false,
      contextOverridable: false,
      reasoning: "Oracle text: card draw detected",
    });
  }

  // Check for keyword grants not captured
  if (!hasCategory("keyword_grant") && KEYWORD_GRANT_RE.test(text)) {
    results.push({
      abilityIndex: -1,
      effect: { type: "keyword_grant_oracle" },
      effectCategory: "keyword_grant",
      polarity: "beneficial",
      targetIntent: "self",
      confidence: 0.85,
      isCostEffect: false,
      contextOverridable: false,
      reasoning: "Oracle text: keyword grant detected",
    });
  }

  return results;
}
