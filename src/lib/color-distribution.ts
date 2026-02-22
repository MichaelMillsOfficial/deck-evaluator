import type { DeckData, EnrichedCard } from "./types";

export const MTG_COLORS = ["W", "U", "B", "R", "G"] as const;
export type MtgColor = (typeof MTG_COLORS)[number];

export interface ColorCounts {
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
}

export interface ColorDistribution {
  /** Number of cards that can produce each color of mana */
  sources: ColorCounts;
  /** Total mana pips of each color across all card mana costs */
  pips: ColorCounts;
  /** Number of cards that produce only colorless mana */
  colorlessSources: number;
}

export interface ManaBaseMetrics {
  landCount: number;
  totalCards: number;
  landPercentage: number;
  averageCmc: number;
  colorlessSources: number;
  sourceToDemandRatio: ColorCounts;
}

const ALL_FIVE = new Set<string>(MTG_COLORS);

function isAllFiveColors(produced: string[]): boolean {
  return MTG_COLORS.every((c) => produced.includes(c));
}

/**
 * Returns the union of all commanders' color identities.
 */
export function resolveCommanderIdentity(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): Set<MtgColor> {
  const identity = new Set<MtgColor>();
  for (const cmd of deck.commanders) {
    const enriched = cardMap[cmd.name];
    if (!enriched) continue;
    for (const c of enriched.colorIdentity) {
      if (ALL_FIVE.has(c)) identity.add(c as MtgColor);
    }
  }
  return identity;
}

function zeroColorCounts(): ColorCounts {
  return { W: 0, U: 0, B: 0, R: 0, G: 0 };
}

/**
 * Computes mana source counts and pip demand per color for a deck.
 * 5-color producers (e.g. Command Tower) are scoped to commander identity when commanders exist.
 */
export function computeColorDistribution(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): ColorDistribution {
  const sources = zeroColorCounts();
  const pips = zeroColorCounts();
  let colorlessSources = 0;

  const commanderIdentity = resolveCommanderIdentity(deck, cardMap);
  const allCards = [...deck.commanders, ...deck.mainboard, ...deck.sideboard];

  for (const card of allCards) {
    const enriched = cardMap[card.name];
    if (!enriched) continue;

    // Count mana sources
    if (enriched.producedMana.length > 0) {
      let effectiveProduced = enriched.producedMana;

      // Scope 5-color producers to commander identity when commanders exist
      if (
        isAllFiveColors(enriched.producedMana) &&
        commanderIdentity.size > 0
      ) {
        effectiveProduced = MTG_COLORS.filter((c) =>
          commanderIdentity.has(c)
        );
      }

      let producesColor = false;
      for (const color of effectiveProduced) {
        if (ALL_FIVE.has(color)) {
          sources[color as MtgColor] += card.quantity;
          producesColor = true;
        }
      }

      // Track colorless-only sources
      if (!producesColor && enriched.producedMana.includes("C")) {
        colorlessSources += card.quantity;
      }
    }

    // Count pip demand
    for (const color of MTG_COLORS) {
      pips[color] += enriched.manaPips[color] * card.quantity;
    }
  }

  return { sources, pips, colorlessSources };
}

function isLand(typeLine: string): boolean {
  return typeLine.includes("Land");
}

/**
 * Computes mana base efficiency metrics for a deck.
 */
export function computeManaBaseMetrics(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): ManaBaseMetrics {
  const distribution = computeColorDistribution(deck, cardMap);
  const allCards = [...deck.commanders, ...deck.mainboard, ...deck.sideboard];

  let landCount = 0;
  let totalCards = 0;
  let totalCmc = 0;
  let nonLandCount = 0;

  for (const card of allCards) {
    totalCards += card.quantity;
    const enriched = cardMap[card.name];
    if (!enriched) continue;

    if (isLand(enriched.typeLine)) {
      landCount += card.quantity;
    } else {
      totalCmc += enriched.cmc * card.quantity;
      nonLandCount += card.quantity;
    }
  }

  const landPercentage = totalCards > 0 ? (landCount / totalCards) * 100 : 0;
  const averageCmc = nonLandCount > 0 ? totalCmc / nonLandCount : 0;

  const sourceToDemandRatio = zeroColorCounts();
  for (const color of MTG_COLORS) {
    if (distribution.pips[color] === 0) {
      // No demand: Infinity if we have sources, 0 if we don't
      sourceToDemandRatio[color] =
        distribution.sources[color] > 0 ? Infinity : 0;
    } else {
      sourceToDemandRatio[color] =
        distribution.sources[color] / distribution.pips[color];
    }
  }

  return {
    landCount,
    totalCards,
    landPercentage,
    averageCmc,
    colorlessSources: distribution.colorlessSources,
    sourceToDemandRatio,
  };
}
