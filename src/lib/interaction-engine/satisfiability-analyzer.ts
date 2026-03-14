/**
 * Satisfiability Analyzer — Evaluate conditions against deck composition.
 *
 * Given a Condition (with its structured predicate) and the deck's card list,
 * returns a SatisfiabilityResult indicating how likely the condition is to be
 * met by this particular deck build.
 *
 * Scoring:
 *   1.0 = condition almost certainly satisfied
 *   0.7 = partial support, usually satisfiable
 *   0.3 = floor — deck cannot meaningfully support this condition
 *
 * The score is used as a multiplier on interaction strength: strong conditions
 * that a deck can't satisfy will reduce the effective interaction strength.
 */

import type {
  Condition,
  ConditionCheck,
  SatisfiabilityResult,
  CardProfile,
  Interaction,
} from "./types";
import type { EnrichedCard } from "../types";

// ─── Score constants ─────────────────────────────────────────────

const SCORE_FLOOR = 0.3;
const SCORE_CEILING = 1.0;

function clampScore(score: number): number {
  return Math.min(SCORE_CEILING, Math.max(SCORE_FLOOR, score));
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Evaluate how well a deck can satisfy a given condition.
 */
export function analyzeSatisfiability(
  condition: Condition,
  deckCards: EnrichedCard[]
): SatisfiabilityResult {
  if (!condition.structured) {
    return {
      check: "unknown",
      satisfiable: "unknown",
      score: 1.0,
      reason: "Condition not parsed",
    };
  }

  const { check } = condition.structured;

  switch (check) {
    case "creature_count":
      return checkTypeCount(condition.structured, deckCards, "creature");
    case "artifact_count":
      return checkTypeCount(condition.structured, deckCards, "artifact");
    case "enchantment_count":
      return checkTypeCount(condition.structured, deckCards, "enchantment");
    case "permanent_count":
      return checkPermanentCount(condition.structured, deckCards);
    case "devotion":
      return checkDevotion(condition.structured, deckCards);
    case "graveyard_card_types":
      return checkGraveyardCardTypes(condition.structured, deckCards);
    case "graveyard_size":
      return checkGraveyardSize(condition.structured, deckCards);
    case "life_total":
      return checkLifeTotal(condition.structured, deckCards);
    case "land_subtype":
      return checkLandSubtype(condition.structured, deckCards);
    case "creature_type_count":
      return checkTypeCount(condition.structured, deckCards, "creature");
    case "spell_frequency":
      return checkSpellFrequency(condition.structured, deckCards);
    case "runtime":
      return {
        check: "runtime",
        satisfiable: "unknown",
        score: 1.0,
        reason: "Requires game state — cannot evaluate statically",
      };
    default:
      return {
        check: "unknown",
        satisfiable: "unknown",
        score: 1.0,
        reason: "Unknown condition type",
      };
  }
}

/**
 * Adjust interaction strengths based on condition satisfiability.
 * Conditions from both cards in an interaction are evaluated;
 * the minimum score (weakest link) is applied as a multiplier.
 */
export function adjustInteractionStrengths(
  interactions: Interaction[],
  profiles: Record<string, CardProfile>,
  deckCards: EnrichedCard[]
): Interaction[] {
  return interactions.map((interaction) => {
    const conditions = getConditionsForInteraction(interaction, profiles);
    if (conditions.length === 0) return interaction;

    const scores = conditions.map((c) => analyzeSatisfiability(c, deckCards));
    const minScore = Math.min(...scores.map((s) => s.score));

    return {
      ...interaction,
      strength: interaction.strength * minScore,
    };
  });
}

// ─── Condition helpers ───────────────────────────────────────────

function getConditionsForInteraction(
  interaction: Interaction,
  profiles: Record<string, CardProfile>
): Condition[] {
  const conditions: Condition[] = [];
  for (const cardName of interaction.cards) {
    const profile = profiles[cardName];
    if (profile?.requires) {
      conditions.push(...profile.requires);
    }
  }
  return conditions;
}

// ─── Checkers ────────────────────────────────────────────────────

/**
 * Count permanents of a given type.
 * Score formula: min(1.0, max(0.3, relevantCards / (count * 3)))
 * This means if you need 5 of a type, you need 15 cards of that type → score 1.0
 */
function checkTypeCount(
  structured: NonNullable<Condition["structured"]>,
  deckCards: EnrichedCard[],
  cardType: "creature" | "artifact" | "enchantment"
): SatisfiabilityResult {
  const count = structured.count ?? 1;
  const relevantCards = deckCards.filter((c) =>
    isOfType(c, cardType)
  ).length;
  const totalCards = deckCards.length;

  const rawScore = relevantCards / (count * 3);
  const score = clampScore(rawScore);

  const density = totalCards > 0 ? relevantCards / totalCards : 0;
  const satisfiable =
    score >= 0.9 ? "yes" : score <= SCORE_FLOOR ? "no" : "partial";

  const checkName: ConditionCheck = `${cardType}_count` as ConditionCheck;
  return {
    check: checkName,
    satisfiable,
    score,
    reason:
      relevantCards === 0
        ? `No ${cardType}s in deck`
        : `${relevantCards} ${cardType}s in deck, need ${count}+`,
    deckSupport: {
      relevantCards,
      totalCards,
      density,
    },
  };
}

function checkPermanentCount(
  structured: NonNullable<Condition["structured"]>,
  deckCards: EnrichedCard[]
): SatisfiabilityResult {
  const count = structured.count ?? 1;
  const PERMANENT_TYPES = ["creature", "artifact", "enchantment", "land", "planeswalker", "battle"];
  const relevantCards = deckCards.filter((c) =>
    PERMANENT_TYPES.some((t) => isOfType(c, t as "creature" | "artifact" | "enchantment"))
  ).length;
  const totalCards = deckCards.length;
  const rawScore = relevantCards / (count * 3);
  const score = clampScore(rawScore);
  const density = totalCards > 0 ? relevantCards / totalCards : 0;
  const satisfiable =
    score >= 0.9 ? "yes" : score <= SCORE_FLOOR ? "no" : "partial";

  return {
    check: "permanent_count",
    satisfiable,
    score,
    reason: `${relevantCards} permanents in deck, need ${count}+`,
    deckSupport: { relevantCards, totalCards, density },
  };
}

/**
 * Devotion check: count total mana pips of the required colors across all
 * castable permanents (creatures, artifacts, enchantments, planeswalkers).
 *
 * Score = min(1.0, max(0.3, totalPips / (threshold * 3)))
 */
function checkDevotion(
  structured: NonNullable<Condition["structured"]>,
  deckCards: EnrichedCard[]
): SatisfiabilityResult {
  const { devotionColors = [], count: threshold = 5 } = structured;

  // Permanents contribute to devotion
  const permanents = deckCards.filter((c) => isPermanent(c));

  let totalPips = 0;
  for (const card of permanents) {
    for (const color of devotionColors) {
      const key = color as keyof typeof card.manaPips;
      totalPips += card.manaPips[key] ?? 0;
    }
  }

  const rawScore = totalPips / (threshold * 3);
  const score = clampScore(rawScore);
  const satisfiable =
    score >= 0.9 ? "yes" : score <= SCORE_FLOOR ? "no" : "partial";
  const totalCards = deckCards.length;

  return {
    check: "devotion",
    satisfiable,
    score,
    reason:
      totalPips === 0
        ? `No ${devotionColors.join("/")} pips in deck`
        : `${totalPips} ${devotionColors.join("/")} pips across permanents, need devotion ${threshold}+`,
    deckSupport: {
      relevantCards: permanents.length,
      totalCards,
      density: totalCards > 0 ? permanents.length / totalCards : 0,
    },
  };
}

/**
 * Delirium / graveyard card types check.
 *
 * Counts distinct card types present in the deck (not the graveyard —
 * we use deck composition as a proxy). If the deck has 4+ distinct types
 * naturally, delirium is usually achievable.
 */
function checkGraveyardCardTypes(
  structured: NonNullable<Condition["structured"]>,
  deckCards: EnrichedCard[]
): SatisfiabilityResult {
  const requiredTypes = structured.count ?? 4;

  const MAJOR_TYPES = [
    "creature",
    "artifact",
    "enchantment",
    "instant",
    "sorcery",
    "land",
    "planeswalker",
    "battle",
  ];

  const presentTypes = new Set<string>();
  for (const card of deckCards) {
    const tl = card.typeLine.toLowerCase();
    for (const t of MAJOR_TYPES) {
      if (tl.includes(t)) {
        presentTypes.add(t);
      }
    }
  }

  const distinctTypes = presentTypes.size;

  // Check whether the deck has self-mill / looting support
  const hasSelfMill = deckCards.some((c) => hasSelfMillText(c));
  const bonusMultiplier = hasSelfMill ? 1.15 : 1.0;

  // Score: if deck has requiredTypes distinct types → great; scale down otherwise
  const rawScore = (distinctTypes / requiredTypes) * bonusMultiplier;
  const score = clampScore(rawScore);
  const satisfiable =
    score >= 0.8 ? "yes" : score <= SCORE_FLOOR ? "no" : "partial";

  return {
    check: "graveyard_card_types",
    satisfiable,
    score,
    reason: `Deck has ${distinctTypes} distinct card types (need ${requiredTypes} in graveyard)`,
    deckSupport: {
      relevantCards: distinctTypes,
      totalCards: MAJOR_TYPES.length,
      density: distinctTypes / MAJOR_TYPES.length,
    },
  };
}

/**
 * Threshold / graveyard size check.
 *
 * Looks for self-mill, looting, and discard effects that help fill
 * the graveyard quickly.
 */
function checkGraveyardSize(
  structured: NonNullable<Condition["structured"]>,
  deckCards: EnrichedCard[]
): SatisfiabilityResult {
  const requiredSize = structured.count ?? 7;
  const totalCards = deckCards.length;

  // Count cards with graveyard-filling mechanics
  const selfMillCards = deckCards.filter((c) => hasSelfMillText(c));
  const lootingCards = deckCards.filter((c) => hasLootingText(c));

  const supportCount = selfMillCards.length + lootingCards.length;

  // Baseline: small graveyard (3-4 cards from normal play) is almost always achievable
  // Threshold of 7 is harder; 10+ is very hard without dedicated support
  const baselineScore =
    requiredSize <= 4
      ? 0.8
      : requiredSize <= 7
      ? 0.5
      : 0.4;

  // Each support card adds a boost
  const supportBonus = Math.min(0.4, supportCount * 0.08);
  const rawScore = baselineScore + supportBonus;
  const score = clampScore(rawScore);
  const satisfiable =
    score >= 0.7 ? "yes" : score <= SCORE_FLOOR ? "no" : "partial";

  return {
    check: "graveyard_size",
    satisfiable,
    score,
    reason: `${supportCount} self-mill/looting cards found; need ${requiredSize}+ cards in graveyard`,
    deckSupport: {
      relevantCards: supportCount,
      totalCards,
      density: totalCards > 0 ? supportCount / totalCards : 0,
    },
  };
}

/**
 * Life total check: look for lifegain sources in the deck.
 * Thresholds above starting life (20) require dedicated lifegain engines.
 */
function checkLifeTotal(
  structured: NonNullable<Condition["structured"]>,
  deckCards: EnrichedCard[]
): SatisfiabilityResult {
  const targetLife = structured.count ?? 40;
  const totalCards = deckCards.length;

  const lifegainCards = deckCards.filter((c) => hasLifegainText(c));

  // Baseline: starting at 20, above 40 is very hard
  const baselineScore =
    targetLife <= 20
      ? 0.9  // always starts at 20
      : targetLife <= 30
      ? 0.5
      : targetLife <= 40
      ? 0.35
      : 0.3;

  const supportBonus = Math.min(0.5, lifegainCards.length * 0.05);
  const rawScore = baselineScore + supportBonus;
  const score = clampScore(rawScore);
  const satisfiable =
    score >= 0.7 ? "yes" : score <= SCORE_FLOOR ? "no" : "partial";

  return {
    check: "life_total",
    satisfiable,
    score,
    reason: `${lifegainCards.length} lifegain cards found; need ${targetLife}+ life`,
    deckSupport: {
      relevantCards: lifegainCards.length,
      totalCards,
      density: totalCards > 0 ? lifegainCards.length / totalCards : 0,
    },
  };
}

/**
 * Land subtype check: count lands with the required subtype.
 * A single copy of a land subtype raises score meaningfully; 3+ is high.
 */
function checkLandSubtype(
  structured: NonNullable<Condition["structured"]>,
  deckCards: EnrichedCard[]
): SatisfiabilityResult {
  const { subtypeRequired = "" } = structured;
  const totalCards = deckCards.length;

  const matchingLands = deckCards.filter((c) =>
    hasLandSubtype(c, subtypeRequired)
  );

  const count = matchingLands.length;
  // 1 land → score 0.7; 3+ lands → score 1.0
  const rawScore = count === 0 ? 0 : 0.5 + count * 0.15;
  const score = clampScore(rawScore);
  const satisfiable =
    score >= 0.8 ? "yes" : score <= SCORE_FLOOR ? "no" : "partial";

  return {
    check: "land_subtype",
    satisfiable,
    score,
    reason:
      count === 0
        ? `No ${subtypeRequired} lands in deck`
        : `${count} ${subtypeRequired} land(s) found`,
    deckSupport: {
      relevantCards: count,
      totalCards,
      density: totalCards > 0 ? count / totalCards : 0,
    },
  };
}

/**
 * Spell frequency check: are there enough spells cast per turn?
 * Rare — mainly for prowess-style conditions.
 */
function checkSpellFrequency(
  structured: NonNullable<Condition["structured"]>,
  deckCards: EnrichedCard[]
): SatisfiabilityResult {
  const requiredCount = structured.count ?? 2;
  const totalCards = deckCards.length;

  const spells = deckCards.filter((c) =>
    /\b(instant|sorcery)\b/i.test(c.typeLine)
  );

  const rawScore = spells.length / (requiredCount * 10);
  const score = clampScore(rawScore);
  const satisfiable =
    score >= 0.7 ? "yes" : score <= SCORE_FLOOR ? "no" : "partial";

  return {
    check: "spell_frequency",
    satisfiable,
    score,
    reason: `${spells.length} spells in deck`,
    deckSupport: {
      relevantCards: spells.length,
      totalCards,
      density: totalCards > 0 ? spells.length / totalCards : 0,
    },
  };
}

// ─── Card classification helpers ─────────────────────────────────

function isOfType(card: EnrichedCard, type: string): boolean {
  return card.typeLine.toLowerCase().includes(type.toLowerCase());
}

function isPermanent(card: EnrichedCard): boolean {
  const tl = card.typeLine.toLowerCase();
  return (
    tl.includes("creature") ||
    tl.includes("artifact") ||
    tl.includes("enchantment") ||
    tl.includes("land") ||
    tl.includes("planeswalker") ||
    tl.includes("battle")
  );
}

const SELF_MILL_PATTERN =
  /\b(?:mill(?:s)?|put the top|self.?mill|discard your hand|wheel)\b/i;

function hasSelfMillText(card: EnrichedCard): boolean {
  return SELF_MILL_PATTERN.test(card.oracleText);
}

const LOOTING_PATTERN =
  /\b(?:loot|draw\b.{0,30}discard|discard\b.{0,30}draw|surveil|scry)\b/i;

function hasLootingText(card: EnrichedCard): boolean {
  return LOOTING_PATTERN.test(card.oracleText);
}

const LIFEGAIN_PATTERN =
  /\b(?:you gain|gains?\s+\d+\s+life|lifelink|life total becomes)\b/i;

function hasLifegainText(card: EnrichedCard): boolean {
  return LIFEGAIN_PATTERN.test(card.oracleText);
}

function hasLandSubtype(card: EnrichedCard, subtype: string): boolean {
  if (!subtype) return false;
  const tl = card.typeLine.toLowerCase();
  if (!tl.includes("land")) return false;
  // Check subtypes array first (more reliable)
  if (card.subtypes.some((s) => s.toLowerCase() === subtype.toLowerCase())) {
    return true;
  }
  // Fall back to type line parsing
  return tl.includes(subtype.toLowerCase());
}
