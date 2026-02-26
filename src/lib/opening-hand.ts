import type { DeckData, EnrichedCard } from "./types";
import { generateTags } from "./card-tags";
import { type MtgColor } from "./color-distribution";
import { classifyLandEntry } from "./land-base-efficiency";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HandCard {
  name: string;
  quantity: number;
  enriched: EnrichedCard;
}

export interface HandQualityFactors {
  landCount: number;
  rampCount: number;
  playableTurns: boolean[];
  colorCoverage: number;
  curvePlayability: number;
}

export type Verdict = "Strong Keep" | "Keepable" | "Marginal" | "Mulligan";

export interface HandQualityResult {
  score: number;
  verdict: Verdict;
  factors: HandQualityFactors;
  reasoning: string[];
}

export interface DrawnHand {
  cards: HandCard[];
  quality: HandQualityResult;
  mulliganNumber: number;
}

export interface SimulationStats {
  totalSimulations: number;
  keepableRate: number;
  avgLandsInOpener: number;
  avgScore: number;
  probT1Play: number;
  probT2Play: number;
  probT3Play: number;
  verdictDistribution: Record<Verdict, number>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isLand(card: EnrichedCard): boolean {
  return card.typeLine.includes("Land");
}

function isUntappedLand(card: EnrichedCard): boolean {
  if (!isLand(card)) return false;
  const classification = classifyLandEntry(card);
  return classification === "untapped" || classification === "conditional";
}

function hasRampTag(card: EnrichedCard): boolean {
  const tags = generateTags(card);
  return tags.includes("Ramp");
}

function getProducedColors(card: EnrichedCard): Set<string> {
  return new Set(card.producedMana.filter((c) => c !== "C"));
}

// ---------------------------------------------------------------------------
// buildPool
// ---------------------------------------------------------------------------

/**
 * Flatten commanders + mainboard into a pool of HandCards, repeating for
 * quantity. Sideboard is excluded. Cards missing from cardMap are skipped.
 */
export function buildPool(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): HandCard[] {
  const pool: HandCard[] = [];
  const cards = [...deck.commanders, ...deck.mainboard];

  for (const card of cards) {
    const enriched = cardMap[card.name];
    if (!enriched) continue;

    for (let i = 0; i < card.quantity; i++) {
      pool.push({
        name: card.name,
        quantity: card.quantity,
        enriched,
      });
    }
  }

  return pool;
}

// ---------------------------------------------------------------------------
// drawHand
// ---------------------------------------------------------------------------

/**
 * Fisher-Yates shuffle a copy of the pool, return the first `count` cards.
 * Does not mutate the original pool.
 */
export function drawHand(pool: HandCard[], count: number): HandCard[] {
  const copy = [...pool];
  const n = copy.length;
  const drawCount = Math.min(count, n);

  // Fisher-Yates partial shuffle — only shuffle drawCount positions from the end
  for (let i = n - 1; i >= n - drawCount && i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy.slice(n - drawCount);
}

// ---------------------------------------------------------------------------
// evaluateHandQuality
// ---------------------------------------------------------------------------

/**
 * Evaluate a drawn hand's quality using weighted heuristic scoring.
 *
 * Weights:
 * - Land count: 35%
 * - Curve playability: 30%
 * - Color coverage: 20%
 * - Ramp availability: 15%
 */
export function evaluateHandQuality(
  hand: HandCard[],
  mulliganNumber: number,
  commanderIdentity: Set<MtgColor | string>
): HandQualityResult {
  const handSize = hand.length;
  if (handSize === 0) {
    const factors: HandQualityFactors = {
      landCount: 0,
      rampCount: 0,
      playableTurns: [],
      colorCoverage: 0,
      curvePlayability: 0,
    };
    return {
      score: 0,
      verdict: "Mulligan",
      factors,
      reasoning: generateReasoning(factors, mulliganNumber),
    };
  }

  // Count lands and spells
  const lands = hand.filter((c) => isLand(c.enriched));
  const spells = hand.filter((c) => !isLand(c.enriched));
  const landCount = lands.length;

  // Count ramp cards among non-lands
  const rampCount = spells.filter((c) => hasRampTag(c.enriched)).length;

  // Determine available mana colors from lands
  const availableColors = new Set<string>();
  for (const land of lands) {
    for (const color of getProducedColors(land.enriched)) {
      availableColors.add(color);
    }
  }

  // Determine untapped lands for turn-1 plays
  const untappedLands = lands.filter((c) => isUntappedLand(c.enriched));
  const untappedCount = untappedLands.length;

  // Determine untapped mana colors
  const untappedColors = new Set<string>();
  for (const land of untappedLands) {
    for (const color of getProducedColors(land.enriched)) {
      untappedColors.add(color);
    }
  }

  // --- Playable turns analysis ---
  // Turn 1: need 1 untapped land + spell with CMC <= 1 castable with that land's colors
  // Turn 2: need 2 lands (at least 1 untapped initially) + spell CMC <= 2
  // Turn 3: need 3 lands + spell CMC <= 3
  const playableTurns: boolean[] = [];

  // Turn 1
  const t1Playable =
    untappedCount >= 1 &&
    spells.some((s) => {
      if (s.enriched.cmc > 1) return false;
      // Check if the spell's color requirements can be met by untapped lands
      return canCastSpell(s.enriched, untappedColors);
    });
  playableTurns.push(t1Playable);

  // Turn 2
  const t2Playable =
    landCount >= 2 &&
    spells.some((s) => {
      if (s.enriched.cmc > 2) return false;
      return canCastSpell(s.enriched, availableColors);
    });
  playableTurns.push(t2Playable);

  // Turn 3
  const t3Playable =
    landCount >= 3 &&
    spells.some((s) => {
      if (s.enriched.cmc > 3) return false;
      return canCastSpell(s.enriched, availableColors);
    });
  playableTurns.push(t3Playable);

  // --- Color coverage ---
  // What fraction of the deck's required colors are present in the hand's lands?
  const neededColors = Array.from(commanderIdentity);
  let colorCoverage = 1.0;
  if (neededColors.length > 0 && landCount > 0) {
    const coveredCount = neededColors.filter((c) =>
      availableColors.has(c)
    ).length;
    colorCoverage = coveredCount / neededColors.length;
  } else if (neededColors.length > 0 && landCount === 0) {
    colorCoverage = 0;
  }
  // Colorless decks get full marks
  if (neededColors.length === 0) {
    colorCoverage = 1.0;
  }

  // --- Curve playability ---
  // Fraction of turns 1-3 with a playable spell
  const curvePlayability =
    playableTurns.length > 0
      ? playableTurns.filter(Boolean).length / playableTurns.length
      : 0;

  // --- Land count scoring ---
  // Adjust ideal land count based on hand size
  const idealLandMin = Math.max(1, Math.round((handSize * 2) / 7));
  const idealLandMax = Math.min(handSize - 1, Math.round((handSize * 4) / 7));

  let landScore: number;
  if (landCount === 0) {
    landScore = 0;
  } else if (landCount >= handSize) {
    // All lands, no spells
    landScore = 0;
  } else if (landCount >= idealLandMin && landCount <= idealLandMax) {
    // Ideal range: score based on how close to center
    const center = (idealLandMin + idealLandMax) / 2;
    const range = (idealLandMax - idealLandMin) / 2 || 1;
    const distFromCenter = Math.abs(landCount - center) / range;
    landScore = 100 * (1 - distFromCenter * 0.15);
  } else if (landCount < idealLandMin) {
    // Too few lands
    const deficit = idealLandMin - landCount;
    landScore = Math.max(0, 50 - deficit * 30);
  } else {
    // Too many lands
    const excess = landCount - idealLandMax;
    landScore = Math.max(0, 60 - excess * 25);
  }

  // Bonus for ramp when land count is low
  if (landCount === 1 && rampCount > 0) {
    landScore = Math.min(100, landScore + 15);
  }

  // --- Ramp scoring ---
  let rampScore: number;
  if (rampCount >= 2) {
    rampScore = 100;
  } else if (rampCount === 1) {
    rampScore = 70;
  } else {
    // No ramp is not terrible, just not ideal
    rampScore = 30;
  }

  // --- Curve score ---
  const curveScore = curvePlayability * 100;

  // --- Color score ---
  const colorScore = colorCoverage * 100;

  // --- Weighted total ---
  const score = Math.round(
    landScore * 0.35 +
      curveScore * 0.3 +
      colorScore * 0.2 +
      rampScore * 0.15
  );

  // Clamp to 0-100
  const clampedScore = Math.max(0, Math.min(100, score));

  const factors: HandQualityFactors = {
    landCount,
    rampCount,
    playableTurns,
    colorCoverage,
    curvePlayability,
  };

  const verdict = getVerdict(clampedScore);
  const reasoning = generateReasoning(factors, mulliganNumber);

  return {
    score: clampedScore,
    verdict,
    factors,
    reasoning,
  };
}

/**
 * Check if a spell can be cast given available mana colors.
 * A spell with no colored pips (all generic/colorless) is always castable.
 */
function canCastSpell(
  spell: EnrichedCard,
  availableColors: Set<string>
): boolean {
  const pips = spell.manaPips;
  const needed: string[] = [];
  if (pips.W > 0) needed.push("W");
  if (pips.U > 0) needed.push("U");
  if (pips.B > 0) needed.push("B");
  if (pips.R > 0) needed.push("R");
  if (pips.G > 0) needed.push("G");

  // If no colored pips required, spell is castable with any mana source
  if (needed.length === 0) return true;

  return needed.every((c) => availableColors.has(c));
}

// ---------------------------------------------------------------------------
// getVerdict
// ---------------------------------------------------------------------------

export function getVerdict(score: number): Verdict {
  if (score >= 80) return "Strong Keep";
  if (score >= 60) return "Keepable";
  if (score >= 40) return "Marginal";
  return "Mulligan";
}

// ---------------------------------------------------------------------------
// generateReasoning
// ---------------------------------------------------------------------------

export function generateReasoning(
  factors: HandQualityFactors,
  mulliganNumber: number
): string[] {
  const reasoning: string[] = [];

  // Land assessment
  if (factors.landCount === 0) {
    reasoning.push("No lands in hand -- cannot cast any spells");
  } else if (factors.landCount === 1) {
    reasoning.push(
      "Only 1 land -- risky without early land draws"
    );
  } else if (factors.landCount >= 5) {
    reasoning.push(
      `${factors.landCount} lands -- too many, not enough spells`
    );
  } else {
    reasoning.push(`${factors.landCount} lands -- solid mana base for opener`);
  }

  // Ramp assessment
  if (factors.rampCount > 0) {
    reasoning.push(
      `${factors.rampCount} ramp card${factors.rampCount > 1 ? "s" : ""} for mana acceleration`
    );
  } else {
    reasoning.push("No ramp cards in hand");
  }

  // Color assessment
  if (factors.colorCoverage >= 1.0) {
    reasoning.push("Full color coverage -- all deck colors available");
  } else if (factors.colorCoverage > 0) {
    reasoning.push(
      `Partial color coverage (${Math.round(factors.colorCoverage * 100)}%) -- missing some deck colors`
    );
  } else if (factors.landCount > 0) {
    reasoning.push("No color coverage -- lands do not produce needed colors");
  }

  // Curve playability
  const earlyPlays = factors.playableTurns.filter(Boolean).length;
  if (earlyPlays === 3) {
    reasoning.push("Excellent early curve -- plays available turns 1-3");
  } else if (earlyPlays >= 1) {
    const turns = factors.playableTurns
      .map((p, i) => (p ? `T${i + 1}` : null))
      .filter(Boolean)
      .join(", ");
    reasoning.push(`Early plays on ${turns}`);
  } else if (factors.landCount > 0) {
    reasoning.push("No early plays available in first 3 turns");
  }

  // Mulligan penalty
  if (mulliganNumber > 0) {
    reasoning.push(
      `Mulligan ${mulliganNumber} -- starting with ${7 - mulliganNumber} cards`
    );
  }

  return reasoning;
}

// ---------------------------------------------------------------------------
// runSimulation
// ---------------------------------------------------------------------------

/**
 * Run a Monte Carlo simulation drawing `iterations` opening hands,
 * scoring each, and computing aggregate statistics.
 *
 * Accepts a pre-built pool and commander identity to avoid redundant
 * computation when the caller already has them.
 */
export function runSimulation(
  pool: HandCard[],
  commanderIdentity: Set<MtgColor | string>,
  iterations = 1000
): SimulationStats {

  const verdictDistribution: Record<Verdict, number> = {
    "Strong Keep": 0,
    Keepable: 0,
    Marginal: 0,
    Mulligan: 0,
  };

  let totalLands = 0;
  let totalScore = 0;
  let t1Plays = 0;
  let t2Plays = 0;
  let t3Plays = 0;

  for (let i = 0; i < iterations; i++) {
    const hand = drawHand(pool, 7);
    const quality = evaluateHandQuality(hand, 0, commanderIdentity);

    verdictDistribution[quality.verdict]++;
    totalScore += quality.score;
    totalLands += quality.factors.landCount;

    if (quality.factors.playableTurns[0]) t1Plays++;
    if (quality.factors.playableTurns[1]) t2Plays++;
    if (quality.factors.playableTurns[2]) t3Plays++;
  }

  const keepable =
    verdictDistribution["Strong Keep"] + verdictDistribution["Keepable"];

  return {
    totalSimulations: iterations,
    keepableRate: iterations > 0 ? keepable / iterations : 0,
    avgLandsInOpener: iterations > 0 ? totalLands / iterations : 0,
    avgScore: iterations > 0 ? Math.round(totalScore / iterations) : 0,
    probT1Play: iterations > 0 ? t1Plays / iterations : 0,
    probT2Play: iterations > 0 ? t2Plays / iterations : 0,
    probT3Play: iterations > 0 ? t3Plays / iterations : 0,
    verdictDistribution,
  };
}
