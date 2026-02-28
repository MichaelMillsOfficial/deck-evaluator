import type { EnrichedCard } from "./types";

/** Regex patterns for detecting supertype-matters oracle text */
const LEGENDARY_PAYOFF_RE =
  /\b(?:legendary|historic)\b.*?(?:spell|permanent|creature|card|land|you control|enters|dies|cost|graveyard|get \+|have )/i;
const LEGENDARY_EACH_RE = /\b(?:for each|each|number of) legendary\b/i;
const LEGEND_RULE_RE = /\blegend rule\b/i;
const HISTORIC_RE = /\bhistoric\b/i;

const SNOW_PAYOFF_RE =
  /\bsnow\b[^.]*?\b(?:permanent|creature|land|mana)s?\b/i;
const SNOW_OTHER_RE = /\bother snow\b/i;
const SNOW_TRIGGER_RE = /whenever a snow.*enters|for each snow/i;
const SNOW_MANA_RE = /\{S\}/;

const SUPERTYPE_ANCHOR_THRESHOLD = 4;
const LEGENDARY_DENSITY_THRESHOLD = 20;
const SNOW_DENSITY_THRESHOLD = 8;

/**
 * Check if a card is historic (Legendary, Artifact, or Saga).
 * "Historic" is a composite game mechanic, not a supertype.
 */
export function isHistoric(card: EnrichedCard): boolean {
  return (
    card.supertypes.includes("Legendary") ||
    card.typeLine.toLowerCase().includes("artifact") ||
    card.subtypes.includes("Saga")
  );
}

/**
 * Check if oracle text references legendary-matters patterns.
 */
function hasLegendaryPayoffText(oracleText: string): boolean {
  return (
    LEGENDARY_PAYOFF_RE.test(oracleText) ||
    LEGENDARY_EACH_RE.test(oracleText) ||
    LEGEND_RULE_RE.test(oracleText)
  );
}

/**
 * Check if oracle text references snow-matters patterns.
 */
function hasSnowPayoffText(oracleText: string): boolean {
  return (
    SNOW_PAYOFF_RE.test(oracleText) ||
    SNOW_OTHER_RE.test(oracleText) ||
    SNOW_TRIGGER_RE.test(oracleText) ||
    SNOW_MANA_RE.test(oracleText)
  );
}

/**
 * Check if oracle text references historic patterns.
 */
function hasHistoricPayoffText(oracleText: string): boolean {
  return HISTORIC_RE.test(oracleText);
}

/**
 * Compute supertype frequency across a deck.
 * Only counts actual MTG supertypes (Legendary, Snow, Basic, etc.) — not card types like Artifact.
 */
export function computeSupertypeBreakdown(
  cardNames: string[],
  cardMap: Record<string, EnrichedCard>
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const name of cardNames) {
    const card = cardMap[name];
    if (!card) continue;

    for (const supertype of card.supertypes) {
      counts.set(supertype, (counts.get(supertype) ?? 0) + 1);
    }
  }

  return counts;
}

/**
 * Identify supertype anchors for a deck.
 * Returns sorted array of anchor names (e.g. "legendary", "snow", "historic").
 *
 * Scoring per the plan:
 * - Commander has "Snow" supertype: +3
 * - Commander has "Legendary" supertype: +1 (low because nearly universal)
 * - Commander oracle text references supertype: +4
 * - Other card oracle text references supertype: +2
 * - Density >= 20 legendary permanents: +3
 * - Density >= 8 snow permanents: +3
 *
 * Threshold: >= 4 points to qualify as an anchor.
 */
export function identifySupertypeAnchors(
  commanders: EnrichedCard[],
  cardNames: string[],
  cardMap: Record<string, EnrichedCard>
): string[] {
  const anchorScores = new Map<string, number>();

  // Commander supertype signals
  for (const commander of commanders) {
    if (commander.supertypes.includes("Legendary")) {
      anchorScores.set("legendary", (anchorScores.get("legendary") ?? 0) + 1);
    }
    if (commander.supertypes.includes("Snow")) {
      anchorScores.set("snow", (anchorScores.get("snow") ?? 0) + 3);
    }

    // Commander oracle text references (strongest signal)
    if (hasLegendaryPayoffText(commander.oracleText)) {
      anchorScores.set("legendary", (anchorScores.get("legendary") ?? 0) + 4);
    }
    if (hasSnowPayoffText(commander.oracleText)) {
      anchorScores.set("snow", (anchorScores.get("snow") ?? 0) + 4);
    }
    if (hasHistoricPayoffText(commander.oracleText)) {
      anchorScores.set("historic", (anchorScores.get("historic") ?? 0) + 4);
    }
  }

  // Other cards' oracle text references
  for (const name of cardNames) {
    const card = cardMap[name];
    if (!card) continue;
    // Skip commanders (already counted above)
    if (commanders.some((c) => c.name === card.name)) continue;

    if (hasLegendaryPayoffText(card.oracleText)) {
      anchorScores.set("legendary", (anchorScores.get("legendary") ?? 0) + 2);
    }
    if (hasSnowPayoffText(card.oracleText)) {
      anchorScores.set("snow", (anchorScores.get("snow") ?? 0) + 2);
    }
    if (hasHistoricPayoffText(card.oracleText)) {
      anchorScores.set("historic", (anchorScores.get("historic") ?? 0) + 2);
    }
  }

  // Density bonuses
  const supertypeBreakdown = computeSupertypeBreakdown(cardNames, cardMap);
  const legendaryCount = supertypeBreakdown.get("Legendary") ?? 0;
  const snowCount = supertypeBreakdown.get("Snow") ?? 0;

  if (legendaryCount >= LEGENDARY_DENSITY_THRESHOLD) {
    anchorScores.set("legendary", (anchorScores.get("legendary") ?? 0) + 3);
  }
  if (snowCount >= SNOW_DENSITY_THRESHOLD) {
    anchorScores.set("snow", (anchorScores.get("snow") ?? 0) + 3);
  }

  // Filter to anchors meeting threshold, sort by score descending
  const anchors = Array.from(anchorScores.entries())
    .filter(([, score]) => score >= SUPERTYPE_ANCHOR_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);

  return anchors;
}
