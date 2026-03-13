/**
 * Deck Context Analyzer — Detects deck-level strategies
 * that override individual effect intents.
 *
 * When a deck has death triggers, sacrifice costs become synergistic.
 * When a deck has enrage, damage-to-creature becomes self-beneficial.
 * When a deck has madness, discard becomes self-beneficial.
 */

import type { EnrichedCard, CardAxisScore } from "../types";
import type {
  DeckReasoningContext,
  IntentOverride,
  CardIntentSummary,
} from "./types";

// ═══════════════════════════════════════════════════════════════════
// Deck Strategy Detection Patterns
// ═══════════════════════════════════════════════════════════════════

const DEATH_TRIGGER_RE = /whenever.+?(?:creature.+?dies|dies|you sacrifice)/i;
const ENRAGE_RE = /(?:enrage|whenever .+ is dealt damage)/i;
const LEAVES_BATTLEFIELD_RE = /leaves the battlefield/i;
const PERSIST_UNDYING_KEYWORDS = new Set(["Persist", "Undying"]);
const MADNESS_KEYWORD = "Madness";
const INDESTRUCTIBLE_KEYWORD = "Indestructible";

const AXIS_RELEVANCE_THRESHOLD = 0.2;

// ═══════════════════════════════════════════════════════════════════
// Context Analysis
// ═══════════════════════════════════════════════════════════════════

/** Analyze the deck to detect strategies that override effect intents */
export function analyzeDeckContext(
  cardMap: Record<string, EnrichedCard>,
  axisScores: Map<string, CardAxisScore[]>
): DeckReasoningContext {
  let deathTriggerCount = 0;
  let enrageCount = 0;
  let madnessCount = 0;
  let indestructibleCount = 0;
  let persistUndyingCount = 0;
  let graveyardAxisStrength = 0;

  for (const [, card] of Object.entries(cardMap)) {
    const text = card.oracleText;
    const keywords = card.keywords;

    // Death triggers
    if (DEATH_TRIGGER_RE.test(text)) deathTriggerCount++;
    if (keywords.some((kw) => PERSIST_UNDYING_KEYWORDS.has(kw))) {
      persistUndyingCount++;
      deathTriggerCount++; // Persist/undying creatures synergize with sacrifice
    }
    if (LEAVES_BATTLEFIELD_RE.test(text)) deathTriggerCount++;

    // Enrage
    if (keywords.includes("Enrage") || ENRAGE_RE.test(text)) enrageCount++;

    // Madness
    if (keywords.includes(MADNESS_KEYWORD)) madnessCount++;

    // Indestructible
    if (keywords.includes(INDESTRUCTIBLE_KEYWORD)) indestructibleCount++;
  }

  // Compute active axes
  const activeAxes = new Set<string>();
  const axisCardCounts = new Map<string, number>();
  for (const [, cardAxes] of axisScores) {
    for (const axis of cardAxes) {
      if (axis.relevance >= AXIS_RELEVANCE_THRESHOLD) {
        axisCardCounts.set(axis.axisId, (axisCardCounts.get(axis.axisId) ?? 0) + 1);
      }
      if (axis.axisId === "graveyard") {
        graveyardAxisStrength += axis.relevance;
      }
    }
  }
  for (const [axisId, count] of axisCardCounts) {
    if (count >= 2) activeAxes.add(axisId);
  }

  return {
    hasDeathTriggers: deathTriggerCount >= 1,
    hasGraveyardSynergy: graveyardAxisStrength >= 2 || activeAxes.has("graveyard"),
    hasMadnessPayoffs: madnessCount >= 2,
    hasEnragePayoffs: enrageCount >= 1,
    hasIndestructible: indestructibleCount >= 1,
    hasPersistUndying: persistUndyingCount >= 1,
    activeAxes,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Intent Overrides
// ═══════════════════════════════════════════════════════════════════

/** Generate intent overrides based on deck context */
export function generateIntentOverrides(
  context: DeckReasoningContext
): IntentOverride[] {
  const overrides: IntentOverride[] = [];

  // Death trigger deck: sacrifice becomes self-synergistic
  if (context.hasDeathTriggers) {
    overrides.push({
      effectCategory: "sacrifice",
      originalIntent: "cost",
      overriddenIntent: "self",
      reason: "Deck has death triggers — sacrifice enables value",
    });
  }

  // Graveyard deck: mill and discard become self-beneficial
  if (context.hasGraveyardSynergy) {
    overrides.push(
      {
        effectCategory: "mill",
        originalIntent: "opponent",
        overriddenIntent: "self",
        reason: "Deck has graveyard synergy — mill fills graveyard",
      },
      {
        effectCategory: "discard",
        originalIntent: "opponent",
        overriddenIntent: "self",
        reason: "Deck has graveyard synergy — discard fills graveyard",
      }
    );
  }

  // Madness deck: discard becomes self-beneficial
  if (context.hasMadnessPayoffs) {
    overrides.push({
      effectCategory: "discard",
      originalIntent: "cost",
      overriddenIntent: "self",
      reason: "Deck has madness payoffs — discard enables madness",
    });
  }

  // Enrage deck: damage to creature becomes self-beneficial
  if (context.hasEnragePayoffs) {
    overrides.push({
      effectCategory: "removal_damage",
      originalIntent: "opponent",
      overriddenIntent: "either",
      reason: "Deck has enrage payoffs — damage triggers enrage",
    });
  }

  return overrides;
}

// ═══════════════════════════════════════════════════════════════════
// Apply Context to Summaries
// ═══════════════════════════════════════════════════════════════════

/** Apply deck context overrides to card intent summaries (mutates in place) */
export function applyDeckContext(
  summaries: Record<string, CardIntentSummary>,
  context: DeckReasoningContext
): void {
  const overrides = generateIntentOverrides(context);
  if (overrides.length === 0) return;

  for (const [, summary] of Object.entries(summaries)) {
    for (const effect of summary.effects) {
      if (!effect.contextOverridable) continue;

      for (const override of overrides) {
        if (
          effect.effectCategory === override.effectCategory &&
          effect.targetIntent === override.originalIntent
        ) {
          effect.targetIntent = override.overriddenIntent;
          effect.reasoning += ` [Override: ${override.reason}]`;
          break; // Apply first matching override
        }
      }
    }

    // Rebuild axis intent map after overrides
    rebuildAxisIntentMap(summary);
  }
}

/** Rebuild the axis intent map after context overrides have been applied */
function rebuildAxisIntentMap(summary: CardIntentSummary): void {
  // Import mapping inline to avoid circular deps
  const EFFECT_TO_AXIS: Record<string, string[]> = {
    stat_buff: ["counters"],
    stat_debuff: ["sacrifice"],
    keyword_grant: ["keywordMatters"],
    token_creation: ["tokens"],
    life_gain: ["lifegain"],
    sacrifice: ["sacrifice"],
    discard: ["graveyard"],
    mill: ["graveyard"],
    reanimate: ["graveyard"],
    mana_production: ["landfall"],
    copy: ["spellslinger"],
    counter_positive: ["counters"],
  };

  const axisIntents = new Map<string, Set<string>>();

  for (const effect of summary.effects) {
    const axes = EFFECT_TO_AXIS[effect.effectCategory] ?? [];
    for (const axisId of axes) {
      if (!axisIntents.has(axisId)) {
        axisIntents.set(axisId, new Set());
      }
      axisIntents.get(axisId)!.add(effect.targetIntent);
    }
  }

  const result: Record<string, string> = {};
  for (const [axisId, intents] of axisIntents) {
    if (intents.has("self") && intents.has("opponent")) {
      result[axisId] = "either";
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

  summary.axisIntent = result as Record<string, import("./types").TargetIntent>;
}
