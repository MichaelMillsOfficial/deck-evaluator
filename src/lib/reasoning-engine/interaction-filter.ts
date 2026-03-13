/**
 * Interaction Filter — Reasoning-aware interaction filtering
 *
 * Filters interactions produced by the interaction detector using
 * effect polarity and target intent from the reasoning engine.
 *
 * Example: Breya's -4/-4 mode is classified as harmful + opponent intent,
 * so "amplifies" interactions between Breya and your own creatures are removed.
 */

import type { Interaction, InteractionAnalysis } from "../interaction-engine/types";
import type { EnrichedCard } from "../types";
import type { CardIntentSummary, DeckReasoningContext } from "./types";
import { buildDeckIntentSummaries } from "./intent-resolver";
import { analyzeDeckContext, generateIntentOverrides, applyDeckContext } from "./deck-context";

// ═══════════════════════════════════════════════════════════════════
// Mechanical description patterns
// ═══════════════════════════════════════════════════════════════════

/** Patterns that identify the mechanism described in an interaction's `mechanical` text */
const STAT_DEBUFF_MECHANICAL = /grants?\s+[+-]?\d+\/-\d+/i;
const DESTROY_MECHANICAL = /\bdestroy/i;
const EXILE_MECHANICAL = /\bexile/i;
const DAMAGE_MECHANICAL = /\bdeals?\s+\d+\s+damage\b/i;
const LOSES_LIFE_MECHANICAL = /\bloses?\s+\d+\s+life\b/i;
const NEGATIVE_COUNTER_MECHANICAL = /\b-1\/-1 counter/i;

/**
 * Check if an interaction's mechanical description describes a harmful effect.
 * This is used as a cross-check: even if the interaction type is "amplifies",
 * the mechanism might be harmful (e.g. granting -4/-4).
 */
function isHarmfulMechanic(mechanical: string): boolean {
  return (
    STAT_DEBUFF_MECHANICAL.test(mechanical) ||
    DESTROY_MECHANICAL.test(mechanical) ||
    EXILE_MECHANICAL.test(mechanical) ||
    DAMAGE_MECHANICAL.test(mechanical) ||
    LOSES_LIFE_MECHANICAL.test(mechanical) ||
    NEGATIVE_COUNTER_MECHANICAL.test(mechanical)
  );
}

// ═══════════════════════════════════════════════════════════════════
// Core filter
// ═══════════════════════════════════════════════════════════════════

/**
 * Determine whether an interaction should be filtered out based on
 * the reasoning engine's effect classification.
 *
 * Returns true if the interaction is a false positive that should be removed.
 */
export function shouldFilterInteraction(
  interaction: Interaction,
  intentSummaries: Record<string, CardIntentSummary>,
  _deckContext?: DeckReasoningContext
): boolean {
  const [sourceCard, _targetCard] = interaction.cards;
  const sourceSummary = intentSummaries[sourceCard];

  if (!sourceSummary) return false;

  // Only filter "positive" interaction types — never filter blocks/conflicts
  const positiveTypes = new Set(["amplifies", "enables", "triggers", "protects"]);
  if (!positiveTypes.has(interaction.type)) return false;

  // Strategy 1: Check if the mechanical description is harmful
  // This catches cases like "grants -4/-4" being labeled as "amplifies"
  if (isHarmfulMechanic(interaction.mechanical)) {
    // Cross-reference with the source card's intent summary
    // If the source has harmful + opponent effects, this is a false positive
    const hasOpponentHarmful = sourceSummary.effects.some(
      (e) => e.polarity === "harmful" && e.targetIntent === "opponent"
    );
    if (hasOpponentHarmful) return true;
  }

  // Strategy 2: For "amplifies" interactions, check if the source card's
  // stat-related effects are all opponent-directed
  if (interaction.type === "amplifies") {
    const statEffects = sourceSummary.effects.filter(
      (e) =>
        e.effectCategory === "stat_debuff" ||
        e.effectCategory === "counter_negative" ||
        e.effectCategory === "removal_damage"
    );
    // If the card has debuff effects and ALL of them are opponent-directed,
    // and the mechanical text matches those debuffs, filter it
    if (statEffects.length > 0) {
      const allOpponent = statEffects.every(
        (e) => e.targetIntent === "opponent"
      );
      if (allOpponent && STAT_DEBUFF_MECHANICAL.test(interaction.mechanical)) {
        return true;
      }
    }
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════════
// Batch filter
// ═══════════════════════════════════════════════════════════════════

/**
 * Filter an array of interactions using reasoning engine intent analysis.
 * Returns a new array with false-positive interactions removed.
 */
export function filterInteractions(
  interactions: Interaction[],
  intentSummaries: Record<string, CardIntentSummary>,
  deckContext?: DeckReasoningContext
): Interaction[] {
  return interactions.filter(
    (i) => !shouldFilterInteraction(i, intentSummaries, deckContext)
  );
}

/**
 * Filter a complete InteractionAnalysis using reasoning engine intent analysis.
 * Returns a new InteractionAnalysis with false-positive interactions removed.
 */
export function filterInteractionAnalysis(
  analysis: InteractionAnalysis,
  cardMap: Record<string, EnrichedCard>
): InteractionAnalysis {
  // Build intent summaries for all cards
  const intentSummaries = buildDeckIntentSummaries(cardMap);

  // Build deck context (we pass empty axis scores since we don't have them here)
  const deckContext = analyzeDeckContext(cardMap, new Map());
  const overrides = generateIntentOverrides(deckContext);
  if (overrides.length > 0) {
    applyDeckContext(intentSummaries, deckContext);
  }

  // Filter interactions
  const filteredInteractions = filterInteractions(
    analysis.interactions,
    intentSummaries,
    deckContext
  );

  return {
    ...analysis,
    interactions: filteredInteractions,
  };
}
