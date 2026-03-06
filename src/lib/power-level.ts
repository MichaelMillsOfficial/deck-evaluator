import type { DeckData, EnrichedCard } from "./types";
import { getTagsCached } from "./card-tags";
import { findCombosInDeck, type KnownCombo } from "./known-combos";
import { computeManaBaseMetrics } from "./color-distribution";
import { computeLandBaseEfficiency } from "./land-base-efficiency";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PowerLevelFactor {
  id: string;
  name: string;
  rawValue: number;
  score: number; // 0–100
  weight: number; // 0–1
  maxRawValue: number;
  explanation: string;
}

export interface PowerLevelResult {
  powerLevel: number; // 1–10
  rawScore: number; // 0–100
  bandLabel: string;
  bandDescription: string;
  factors: PowerLevelFactor[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Curated list of fast mana card names for power level detection */
export const FAST_MANA_NAMES: Set<string> = new Set([
  "Sol Ring",
  "Mana Crypt",
  "Mana Vault",
  "Chrome Mox",
  "Mox Diamond",
  "Jeweled Lotus",
  "Mox Opal",
  "Lotus Petal",
  "Mox Amber",
  "Lion's Eye Diamond",
  "Dark Ritual",
  "Cabal Ritual",
  "Simian Spirit Guide",
  "Elvish Spirit Guide",
  "Rite of Flame",
  "Pyretic Ritual",
  "Desperate Ritual",
]);

/** Factor weights — must sum to 1.0 */
export const FACTOR_WEIGHTS = {
  tutorDensity: 0.18,
  fastMana: 0.16,
  averageCmc: 0.12,
  interactionDensity: 0.14,
  infiniteCombos: 0.14,
  manaBaseQuality: 0.10,
  cardDrawDensity: 0.08,
  winConditionSpeed: 0.08,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAllCards(deck: DeckData) {
  return [...deck.commanders, ...deck.mainboard, ...deck.sideboard];
}

/**
 * Count the number of cards in the deck that have at least one of the given tags.
 * Each unique card name counts once (regardless of quantity).
 */
export function countTaggedCards(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  tags: string[],
  tagCache?: Map<string, string[]>
): number {
  const tagSet = new Set(tags);
  const allCards = getAllCards(deck);
  let count = 0;

  for (const card of allCards) {
    const enriched = cardMap[card.name];
    if (!enriched) continue;
    const cardTags = getTagsCached(enriched, tagCache);
    if (cardTags.some((t) => tagSet.has(t))) {
      count += card.quantity;
    }
  }

  return count;
}

/**
 * Count the number of fast mana cards in the deck (by name match).
 * Works even without enrichment data.
 */
export function countFastMana(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): number {
  const allCards = getAllCards(deck);
  let count = 0;

  for (const card of allCards) {
    if (FAST_MANA_NAMES.has(card.name)) {
      count += card.quantity;
    }
    // Also check flavor names if enriched
    const enriched = cardMap[card.name];
    if (enriched && enriched.flavorName && FAST_MANA_NAMES.has(enriched.flavorName)) {
      count += card.quantity;
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// Individual factor scorers
// ---------------------------------------------------------------------------

/**
 * Score tutor density. Breakpoints:
 * 0 → 0, 1-2 → 30, 3-4 → 55, 5-6 → 75, 7+ → 100
 */
export function scoreTutorDensity(count: number): { score: number; explanation: string } {
  let score: number;
  if (count === 0) score = 0;
  else if (count <= 2) score = 30;
  else if (count <= 4) score = 55;
  else if (count <= 6) score = 75;
  else score = 100;

  const explanation =
    count === 0
      ? "No tutors detected — limited consistency finding key pieces."
      : count <= 2
      ? `${count} tutor${count > 1 ? "s" : ""} detected — some ability to find win conditions.`
      : count <= 4
      ? `${count} tutors detected — solid tutor package for reliable consistency.`
      : count <= 6
      ? `${count} tutors detected — heavy tutoring enables multiple win lines.`
      : `${count} tutors detected — maximum tutor density for cEDH-level consistency.`;

  return { score, explanation };
}

/**
 * Score fast mana count. Breakpoints:
 * 0 → 0, 1 → 25, 2 → 45, 3-4 → 70, 5+ → 100
 */
export function scoreFastMana(count: number): { score: number; explanation: string } {
  let score: number;
  if (count === 0) score = 0;
  else if (count === 1) score = 25;
  else if (count === 2) score = 45;
  else if (count <= 4) score = 70;
  else score = 100;

  const explanation =
    count === 0
      ? "No fast mana detected — limited acceleration beyond land drops."
      : count === 1
      ? `${count} fast mana piece (${count <= 1 ? "Sol Ring" : "fast mana"}) — minor acceleration.`
      : count === 2
      ? `${count} fast mana pieces — noticeable acceleration above curve.`
      : count <= 4
      ? `${count} fast mana pieces — strong mana acceleration common in high-power decks.`
      : `${count} fast mana pieces — maximum acceleration for explosive starts.`;

  return { score, explanation };
}

/**
 * Score average CMC with continuous linear interpolation.
 * ≤1.8 → 100, ≥4.0 → 0, linear between.
 * Lower CMC is better (faster deck).
 */
export function scoreAverageCmc(avgCmc: number): { score: number; explanation: string } {
  const LOW = 1.8;
  const HIGH = 4.0;

  let score: number;
  if (avgCmc <= LOW) {
    score = 100;
  } else if (avgCmc >= HIGH) {
    score = 0;
  } else {
    // Linear interpolation: 100 at LOW, 0 at HIGH
    score = Math.round(100 * (1 - (avgCmc - LOW) / (HIGH - LOW)));
  }

  const label =
    avgCmc <= 1.8 ? "very low" :
    avgCmc <= 2.3 ? "low" :
    avgCmc <= 2.8 ? "moderate" :
    avgCmc <= 3.5 ? "high" : "very high";

  const explanation =
    avgCmc === 0
      ? "No non-land cards found — average CMC cannot be computed."
      : `Average CMC of ${avgCmc.toFixed(2)} is ${label} — ${
          avgCmc <= 2.3
            ? "efficient curve for fast gameplay."
            : avgCmc <= 3.0
            ? "moderate curve with reasonable tempo."
            : "high curve that slows down win conditions."
        }`;

  return { score, explanation };
}

/**
 * Score interaction density (Removal + Counterspell + Board Wipe). Breakpoints:
 * 0-2 → 0, 3-5 → 25, 6-8 → 45, 9-12 → 65, 13-16 → 80, 17+ → 100
 */
export function scoreInteractionDensity(count: number): { score: number; explanation: string } {
  let score: number;
  if (count <= 2) score = 0;
  else if (count <= 5) score = 25;
  else if (count <= 8) score = 45;
  else if (count <= 12) score = 65;
  else if (count <= 16) score = 80;
  else score = 100;

  const explanation =
    count <= 2
      ? `${count} interaction piece${count !== 1 ? "s" : ""} — very few answers to threats.`
      : count <= 5
      ? `${count} interaction pieces — minimal interaction, vulnerable to opponent combos.`
      : count <= 8
      ? `${count} interaction pieces — modest interaction package.`
      : count <= 12
      ? `${count} interaction pieces — solid interaction density.`
      : count <= 16
      ? `${count} interaction pieces — high interaction for disrupting opponents.`
      : `${count} interaction pieces — maximum interaction density.`;

  return { score, explanation };
}

/**
 * Score infinite combo count (filtered to infinite/wincon types only).
 * 0 → 0, 1 → 50, 2 → 75, 3+ → 100
 */
export function scoreInfiniteCombos(combos: KnownCombo[]): { score: number; explanation: string } {
  const relevant = combos.filter(
    (c) => c.type === "infinite" || c.type === "wincon"
  );
  const count = relevant.length;

  let score: number;
  if (count === 0) score = 0;
  else if (count === 1) score = 50;
  else if (count === 2) score = 75;
  else score = 100;

  const explanation =
    count === 0
      ? "No infinite combos or win conditions detected."
      : count === 1
      ? `${count} infinite combo/win condition detected — a single dedicated win line.`
      : count === 2
      ? `${count} infinite combos/win conditions detected — redundant win lines.`
      : `${count} infinite combos/win conditions detected — multiple redundant win lines for consistency.`;

  return { score, explanation };
}

/**
 * Score mana base quality — direct passthrough of land base efficiency score (0-100).
 */
export function scoreManaBaseQuality(landEfficiencyScore: number): { score: number; explanation: string } {
  const score = Math.max(0, Math.min(100, Math.round(landEfficiencyScore)));

  const label =
    score >= 80 ? "excellent" :
    score >= 60 ? "good" :
    score >= 40 ? "fair" :
    score >= 20 ? "below average" : "poor";

  const explanation = `Mana base quality is ${label} (${score}/100) based on untapped lands, color coverage, and fixing.`;

  return { score, explanation };
}

/**
 * Score card draw density (Card Draw + Card Advantage tags). Breakpoints:
 * 0-3 → 0, 4-6 → 30, 7-9 → 55, 10-12 → 75, 13+ → 100
 */
export function scoreCardDrawDensity(count: number): { score: number; explanation: string } {
  let score: number;
  if (count <= 3) score = 0;
  else if (count <= 6) score = 30;
  else if (count <= 9) score = 55;
  else if (count <= 12) score = 75;
  else score = 100;

  const explanation =
    count <= 3
      ? `${count} card draw piece${count !== 1 ? "s" : ""} — very limited draw, deck may stall.`
      : count <= 6
      ? `${count} card draw pieces — minimal card advantage.`
      : count <= 9
      ? `${count} card draw pieces — decent draw to maintain hand quality.`
      : count <= 12
      ? `${count} card draw pieces — strong card advantage engine.`
      : `${count} card draw pieces — exceptional card draw for maximum consistency.`;

  return { score, explanation };
}

/**
 * Score win condition speed based on average CMC of combo pieces.
 * Lower CMC combo pieces = faster wins = higher score.
 * Falls back to overall average CMC if no combos found.
 */
export function scoreWinConditionSpeed(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  combos: KnownCombo[]
): { score: number; explanation: string } {
  const relevantCombos = combos.filter(
    (c) => c.type === "infinite" || c.type === "wincon"
  );

  if (relevantCombos.length > 0) {
    // Collect all unique combo piece names
    const comboPieceNames = new Set<string>();
    for (const combo of relevantCombos) {
      for (const card of combo.cards) {
        comboPieceNames.add(card);
      }
    }

    // Average the CMC of combo pieces that are enriched
    let totalCmc = 0;
    let count = 0;
    for (const name of comboPieceNames) {
      const enriched = cardMap[name];
      if (enriched) {
        totalCmc += enriched.cmc;
        count++;
      }
    }

    if (count > 0) {
      const avgComboCmc = totalCmc / count;
      // Invert the CMC scale: CMC ≤2 → 100, CMC ≥6 → 0, linear between
      const LOW = 2;
      const HIGH = 6;
      let score: number;
      if (avgComboCmc <= LOW) score = 100;
      else if (avgComboCmc >= HIGH) score = 0;
      else score = Math.round(100 * (1 - (avgComboCmc - LOW) / (HIGH - LOW)));

      const explanation = `Average CMC of combo pieces is ${avgComboCmc.toFixed(1)} — ${
        avgComboCmc <= 3 ? "low-cost, fast win condition." :
        avgComboCmc <= 4.5 ? "moderate-cost combo pieces." :
        "high-cost combo pieces that take longer to assemble."
      }`;

      return { score, explanation };
    }
  }

  // No combo pieces found — fall back to overall CMC assessment
  const metrics = computeManaBaseMetrics(deck, cardMap);
  const avgCmc = metrics.averageCmc;

  if (avgCmc === 0) {
    return {
      score: 0,
      explanation: "No win conditions or combo pieces detected.",
    };
  }

  // Lower curve = faster threats
  const LOW = 2;
  const HIGH = 5;
  let score: number;
  if (avgCmc <= LOW) score = 70;
  else if (avgCmc >= HIGH) score = 0;
  else score = Math.round(70 * (1 - (avgCmc - LOW) / (HIGH - LOW)));

  return {
    score,
    explanation: `No known combo pieces found. Deck curve of ${avgCmc.toFixed(1)} suggests ${
      avgCmc <= 3 ? "efficient threats." : avgCmc <= 4 ? "moderate-speed threats." : "slow win conditions."
    }`,
  };
}

// ---------------------------------------------------------------------------
// Raw score to power level mapping
// ---------------------------------------------------------------------------

interface PowerLevelBand {
  powerLevel: number;
  bandLabel: string;
  bandDescription: string;
}

/**
 * Map a raw 0-100 score to a power level 1-10 with band label and description.
 * Each 10-point band maps to one power level.
 * Clamps values below 0 to power 1 and above 100 to power 10.
 */
export function rawScoreToPowerLevel(rawScore: number): PowerLevelBand {
  const clamped = Math.max(0, Math.min(100, rawScore));
  // Map 0-9 → 1, 10-19 → 2, ..., 90-100 → 10
  const powerLevel = clamped >= 100 ? 10 : Math.floor(clamped / 10) + 1;

  const bandLabel =
    powerLevel <= 3 ? "Casual" :
    powerLevel <= 5 ? "Focused" :
    powerLevel <= 7 ? "Optimized" :
    powerLevel <= 9 ? "High Power" : "cEDH";

  const bandDescription =
    powerLevel <= 3
      ? "Precon-level or jank. No tutors, no fast mana, high curve, minimal interaction."
      : powerLevel <= 5
      ? "Clear strategy with some optimization. A few tutors, moderate curve, possibly 1 combo."
      : powerLevel <= 7
      ? "Efficient curve, multiple tutors, consistent game plan, 1-2 combos, solid interaction."
      : powerLevel <= 9
      ? "Fast mana, efficient tutors, multiple win lines, low curve, high interaction density."
      : "Fully optimized for speed. Maximum tutors, fast mana, redundant combo lines, turn 3-5 wins.";

  return { powerLevel, bandLabel, bandDescription };
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

/**
 * Compute the power level score for a deck with full factor breakdown.
 */
export function computePowerLevel(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  tagCache?: Map<string, string[]>
): PowerLevelResult {
  // Gather inputs
  const allCards = getAllCards(deck);
  const cardNames = allCards.map((c) => c.name);
  const combos = findCombosInDeck(cardNames);
  const metrics = computeManaBaseMetrics(deck, cardMap);
  const landEfficiency = computeLandBaseEfficiency(deck, cardMap);

  // Count factors
  const tutorCount = countTaggedCards(deck, cardMap, ["Tutor"], tagCache);
  const fastManaCount = countFastMana(deck, cardMap);
  const interactionCount = countTaggedCards(deck, cardMap, [
    "Removal",
    "Counterspell",
    "Board Wipe",
  ], tagCache);
  const cardDrawCount = countTaggedCards(deck, cardMap, [
    "Card Draw",
    "Card Advantage",
  ], tagCache);

  // Score each factor
  const tutorResult = scoreTutorDensity(tutorCount);
  const fastManaResult = scoreFastMana(fastManaCount);
  const cmcResult = scoreAverageCmc(metrics.averageCmc);
  const interactionResult = scoreInteractionDensity(interactionCount);
  const comboResult = scoreInfiniteCombos(combos);
  const manaBaseResult = scoreManaBaseQuality(landEfficiency.overallScore);
  const cardDrawResult = scoreCardDrawDensity(cardDrawCount);
  const winSpeedResult = scoreWinConditionSpeed(deck, cardMap, combos);

  // Build factor array
  const factors: PowerLevelFactor[] = [
    {
      id: "tutor-density",
      name: "Tutor Density",
      rawValue: tutorCount,
      score: tutorResult.score,
      weight: FACTOR_WEIGHTS.tutorDensity,
      maxRawValue: 99,
      explanation: tutorResult.explanation,
    },
    {
      id: "fast-mana",
      name: "Fast Mana",
      rawValue: fastManaCount,
      score: fastManaResult.score,
      weight: FACTOR_WEIGHTS.fastMana,
      maxRawValue: 17,
      explanation: fastManaResult.explanation,
    },
    {
      id: "average-cmc",
      name: "Average CMC",
      rawValue: Math.round(metrics.averageCmc * 100) / 100,
      score: cmcResult.score,
      weight: FACTOR_WEIGHTS.averageCmc,
      maxRawValue: 10,
      explanation: cmcResult.explanation,
    },
    {
      id: "interaction-density",
      name: "Interaction Density",
      rawValue: interactionCount,
      score: interactionResult.score,
      weight: FACTOR_WEIGHTS.interactionDensity,
      maxRawValue: 99,
      explanation: interactionResult.explanation,
    },
    {
      id: "infinite-combos",
      name: "Infinite Combos",
      rawValue: combos.filter((c) => c.type === "infinite" || c.type === "wincon").length,
      score: comboResult.score,
      weight: FACTOR_WEIGHTS.infiniteCombos,
      maxRawValue: 10,
      explanation: comboResult.explanation,
    },
    {
      id: "mana-base-quality",
      name: "Mana Base Quality",
      rawValue: landEfficiency.overallScore,
      score: manaBaseResult.score,
      weight: FACTOR_WEIGHTS.manaBaseQuality,
      maxRawValue: 100,
      explanation: manaBaseResult.explanation,
    },
    {
      id: "card-draw-density",
      name: "Card Draw Density",
      rawValue: cardDrawCount,
      score: cardDrawResult.score,
      weight: FACTOR_WEIGHTS.cardDrawDensity,
      maxRawValue: 99,
      explanation: cardDrawResult.explanation,
    },
    {
      id: "win-condition-speed",
      name: "Win Condition Speed",
      rawValue: metrics.averageCmc,
      score: winSpeedResult.score,
      weight: FACTOR_WEIGHTS.winConditionSpeed,
      maxRawValue: 10,
      explanation: winSpeedResult.explanation,
    },
  ];

  // Weighted sum → raw score
  const rawScore = Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0)
  );

  const { powerLevel, bandLabel, bandDescription } = rawScoreToPowerLevel(rawScore);

  return {
    powerLevel,
    rawScore,
    bandLabel,
    bandDescription,
    factors,
  };
}
