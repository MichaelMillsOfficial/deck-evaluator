import type {
  DeckData,
  EnrichedCard,
  CardAxisScore,
  SynergyPair,
  CardSynergyScore,
  DeckTheme,
  DeckSynergyAnalysis,
} from "./types";
import { SYNERGY_AXES } from "./synergy-axes";
import { findCombosInDeck } from "./known-combos";
import { generateTags } from "./card-tags";
import {
  identifyTribalAnchors,
  getCreatureSubtypes,
  getCommanderTypes,
  isChangeling,
} from "./creature-types";
import {
  identifySupertypeAnchors,
  isHistoric,
} from "./supertypes";

const BASE_SCORE = 50;
const AXIS_WEIGHT = 3;
const COMBO_BONUS = 20;
const ANTI_SYNERGY_PENALTY_WEIGHT = 5;
const AXIS_RELEVANCE_THRESHOLD = 0.2;
const DECK_THEME_MIN_CARDS = 2;
const TOP_SYNERGIES_LIMIT = 15;

/** Collect all unique card names from a deck */
function getAllCardNames(deck: DeckData): string[] {
  const names: string[] = [];
  for (const section of [deck.commanders, deck.mainboard, deck.sideboard]) {
    for (const card of section) {
      names.push(card.name);
    }
  }
  return names;
}

/** Score every card against every axis */
function computeAxisScores(
  cardNames: string[],
  cardMap: Record<string, EnrichedCard>
): Map<string, CardAxisScore[]> {
  const result = new Map<string, CardAxisScore[]>();

  for (const name of cardNames) {
    const card = cardMap[name];
    if (!card) {
      result.set(name, []);
      continue;
    }

    const axes: CardAxisScore[] = [];
    for (const axis of SYNERGY_AXES) {
      const relevance = axis.detect(card);
      if (relevance > 0) {
        axes.push({ axisId: axis.id, axisName: axis.name, relevance });
      }
    }
    result.set(name, axes);
  }

  return result;
}

/** Compute deck-level strength for each axis (sum of all card relevances) */
function computeDeckAxisStrengths(
  axisScores: Map<string, CardAxisScore[]>
): Map<string, number> {
  const strengths = new Map<string, number>();

  for (const [, cardAxes] of axisScores) {
    for (const axis of cardAxes) {
      strengths.set(axis.axisId, (strengths.get(axis.axisId) ?? 0) + axis.relevance);
    }
  }

  return strengths;
}

/** Generate heuristic synergy pairs between cards sharing axes */
function generateSynergyPairs(
  cardNames: string[],
  axisScores: Map<string, CardAxisScore[]>
): SynergyPair[] {
  const pairs: SynergyPair[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < cardNames.length; i++) {
    const aName = cardNames[i];
    const aAxes = axisScores.get(aName) ?? [];

    for (let j = i + 1; j < cardNames.length; j++) {
      const bName = cardNames[j];
      const bAxes = axisScores.get(bName) ?? [];

      // Find shared axes
      for (const aAxis of aAxes) {
        if (aAxis.relevance < AXIS_RELEVANCE_THRESHOLD) continue;

        const bMatch = bAxes.find(
          (b) => b.axisId === aAxis.axisId && b.relevance >= AXIS_RELEVANCE_THRESHOLD
        );
        if (!bMatch) continue;

        const key = `${aAxis.axisId}:${[aName, bName].sort().join("|")}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const axisInfo = SYNERGY_AXES.find((a) => a.id === aAxis.axisId);
        const strength = Math.min(1, (aAxis.relevance + bMatch.relevance) / 2);

        pairs.push({
          cards: [aName, bName],
          axisId: aAxis.axisId,
          type: "synergy",
          strength,
          description: `Both contribute to ${axisInfo?.name ?? aAxis.axisId} strategy`,
        });
      }
    }
  }

  return pairs;
}

/** Generate anti-synergy pairs between cards on conflicting axes */
function generateAntiSynergyPairs(
  cardNames: string[],
  axisScores: Map<string, CardAxisScore[]>,
  cardMap: Record<string, EnrichedCard>
): SynergyPair[] {
  const pairs: SynergyPair[] = [];
  const seen = new Set<string>();

  // Axis-based conflicts
  for (let i = 0; i < cardNames.length; i++) {
    const aName = cardNames[i];
    const aAxes = axisScores.get(aName) ?? [];

    for (let j = i + 1; j < cardNames.length; j++) {
      const bName = cardNames[j];
      const bAxes = axisScores.get(bName) ?? [];

      for (const aAxis of aAxes) {
        if (aAxis.relevance < AXIS_RELEVANCE_THRESHOLD) continue;

        const axisDef = SYNERGY_AXES.find((a) => a.id === aAxis.axisId);
        if (!axisDef?.conflictsWith?.length) continue;

        for (const conflictId of axisDef.conflictsWith) {
          const bMatch = bAxes.find(
            (b) => b.axisId === conflictId && b.relevance >= AXIS_RELEVANCE_THRESHOLD
          );
          if (!bMatch) continue;

          const key = `anti:${[aName, bName].sort().join("|")}:${[aAxis.axisId, conflictId].sort().join("-")}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const conflictAxis = SYNERGY_AXES.find((a) => a.id === conflictId);
          const strength = Math.min(1, (aAxis.relevance + bMatch.relevance) / 2);

          pairs.push({
            cards: [aName, bName],
            axisId: aAxis.axisId,
            type: "anti-synergy",
            strength,
            description: `${axisDef.name} conflicts with ${conflictAxis?.name ?? conflictId}`,
          });
        }
      }
    }
  }

  // Board wipe vs tokens anti-synergy (tag-based)
  const tokenCardNames: string[] = [];
  const boardWipeCardNames: string[] = [];

  for (const name of cardNames) {
    const card = cardMap[name];
    if (!card) continue;
    const tags = generateTags(card);
    if (tags.includes("Board Wipe")) boardWipeCardNames.push(name);
    const tokenAxes = axisScores.get(name) ?? [];
    if (tokenAxes.some((a) => a.axisId === "tokens" && a.relevance >= AXIS_RELEVANCE_THRESHOLD)) {
      tokenCardNames.push(name);
    }
  }

  for (const wipeName of boardWipeCardNames) {
    for (const tokenName of tokenCardNames) {
      const key = `anti:${[wipeName, tokenName].sort().join("|")}:boardwipe-tokens`;
      if (seen.has(key)) continue;
      seen.add(key);

      pairs.push({
        cards: [wipeName, tokenName],
        axisId: "tokens",
        type: "anti-synergy",
        strength: 0.6,
        description: "Board wipe conflicts with token strategy",
      });
    }
  }

  return pairs;
}

/** Convert known combos to SynergyPair format */
function combosToPairs(
  cardNames: string[]
): SynergyPair[] {
  const combos = findCombosInDeck(cardNames);
  return combos.map((combo) => ({
    cards: combo.cards,
    axisId: null,
    type: "combo" as const,
    strength: 1,
    description: combo.description,
  }));
}

/** Compute per-card synergy score */
function computeCardScores(
  cardNames: string[],
  axisScores: Map<string, CardAxisScore[]>,
  deckAxisStrengths: Map<string, number>,
  synergyPairs: SynergyPair[],
  antiSynergyPairs: SynergyPair[],
  comboPairs: SynergyPair[]
): Record<string, CardSynergyScore> {
  const scores: Record<string, CardSynergyScore> = {};

  for (const name of cardNames) {
    const axes = axisScores.get(name) ?? [];
    const cardPairs = [
      ...synergyPairs.filter((p) => p.cards.includes(name)),
      ...antiSynergyPairs.filter((p) => p.cards.includes(name)),
      ...comboPairs.filter((p) => p.cards.includes(name)),
    ];

    // Base score
    let score = BASE_SCORE;

    // Axis bonus: card's relevance * (deck strength on that axis minus this card's own contribution) * weight
    for (const axis of axes) {
      const deckStrength = deckAxisStrengths.get(axis.axisId) ?? 0;
      const othersStrength = deckStrength - axis.relevance;
      if (othersStrength > 0) {
        score += axis.relevance * Math.min(othersStrength, 5) * AXIS_WEIGHT;
      }
    }

    // Known combo bonus
    const comboCount = comboPairs.filter((p) => p.cards.includes(name)).length;
    score += comboCount * COMBO_BONUS;

    // Anti-synergy penalty
    const antiPairs = antiSynergyPairs.filter((p) => p.cards.includes(name));
    for (const pair of antiPairs) {
      score -= pair.strength * ANTI_SYNERGY_PENALTY_WEIGHT;
    }

    scores[name] = {
      cardName: name,
      score: Math.max(0, Math.min(100, Math.round(score))),
      axes,
      pairs: cardPairs,
    };
  }

  return scores;
}

/**
 * Boost tribal axis scores for creatures sharing subtypes with tribal anchors.
 * This bridges the gap between individual-card detection (which only catches
 * explicit payoff cards) and deck-level tribal synergy (plain creatures of the
 * right type should also participate).
 */
function boostTribalScores(
  deck: DeckData,
  cardNames: string[],
  cardMap: Record<string, EnrichedCard>,
  axisScores: Map<string, CardAxisScore[]>
): void {
  // Resolve commanders
  const commanders: EnrichedCard[] = [];
  for (const cmd of deck.commanders) {
    const card = cardMap[cmd.name];
    if (card) commanders.push(card);
  }

  // Identify which types the deck is built around
  const anchors = identifyTribalAnchors(commanders, cardNames, cardMap);
  if (anchors.length === 0) return;

  const anchorSet = new Set(anchors);
  const tribalAxis = SYNERGY_AXES.find((a) => a.id === "tribal");
  if (!tribalAxis) return;

  // Extract commander type sets for tiered boosting
  const { subtypes: cmdSubtypes, oracleTypes: cmdOracleTypes } =
    getCommanderTypes(commanders);

  for (const name of cardNames) {
    const card = cardMap[name];
    if (!card) continue;

    const subtypes = getCreatureSubtypes(card);
    const changeling = isChangeling(card);

    // Determine matching anchors and their tiered boost rates
    const matchingAnchors = changeling
      ? anchors
      : subtypes.filter((st) => anchorSet.has(st));

    if (matchingAnchors.length === 0) continue;

    // Compute tiered boost: commander subtypes 0.25, oracle-referenced 0.20, density-only 0.15
    // Use highest tier per type (don't stack)
    let boost = 0;
    for (const type of matchingAnchors) {
      if (cmdSubtypes.has(type)) {
        boost += 0.25;
      } else if (cmdOracleTypes.has(type)) {
        boost += 0.20;
      } else {
        boost += 0.15;
      }
    }
    boost = Math.min(0.5, boost);

    const cardAxes = axisScores.get(name) ?? [];
    const existing = cardAxes.find((a) => a.axisId === "tribal");

    if (existing) {
      // Add to existing tribal score (still cap at 1)
      existing.relevance = Math.min(1, existing.relevance + boost);
    } else {
      // Add new tribal axis score
      cardAxes.push({
        axisId: "tribal",
        axisName: tribalAxis.name,
        relevance: boost,
      });
      axisScores.set(name, cardAxes);
    }
  }
}

/**
 * Boost supertypeMatter axis scores for cards matching supertype anchors.
 * Similar to boostTribalScores but for legendary/snow/historic patterns.
 */
function boostSupertypeScores(
  deck: DeckData,
  cardNames: string[],
  cardMap: Record<string, EnrichedCard>,
  axisScores: Map<string, CardAxisScore[]>
): string[] {
  // Resolve commanders
  const commanders: EnrichedCard[] = [];
  for (const cmd of deck.commanders) {
    const card = cardMap[cmd.name];
    if (card) commanders.push(card);
  }

  // Identify which supertypes the deck is built around
  const anchors = identifySupertypeAnchors(commanders, cardNames, cardMap);
  if (anchors.length === 0) return anchors;

  const anchorSet = new Set(anchors);
  const supertypeAxis = SYNERGY_AXES.find((a) => a.id === "supertypeMatter");
  if (!supertypeAxis) return anchors;

  for (const name of cardNames) {
    const card = cardMap[name];
    if (!card) continue;

    // Check each anchor against the card
    let matchCount = 0;
    for (const anchor of anchors) {
      if (anchor === "legendary" && card.supertypes.includes("Legendary")) {
        matchCount++;
      } else if (anchor === "snow" && card.supertypes.includes("Snow")) {
        matchCount++;
      } else if (anchor === "historic" && isHistoric(card)) {
        matchCount++;
      }
    }

    if (matchCount === 0) continue;

    const boost = Math.min(0.4, matchCount * 0.2);
    const cardAxes = axisScores.get(name) ?? [];
    const existing = cardAxes.find((a) => a.axisId === "supertypeMatter");

    if (existing) {
      existing.relevance = Math.min(1, existing.relevance + boost);
    } else {
      cardAxes.push({
        axisId: "supertypeMatter",
        axisName: supertypeAxis.name,
        relevance: boost,
      });
      axisScores.set(name, cardAxes);
    }
  }

  return anchors;
}

/** Supertype anchor name to theme display name */
const SUPERTYPE_THEME_NAMES: Record<string, string> = {
  legendary: "Legendary Matters",
  snow: "Snow Matters",
  historic: "Historic",
};

/** Identify deck themes from axis strengths */
function identifyDeckThemes(
  axisScores: Map<string, CardAxisScore[]>,
  anchors?: string[],
  supertypeAnchors?: string[]
): DeckTheme[] {
  const axisCardCounts = new Map<string, number>();
  const axisStrengths = new Map<string, number>();

  for (const [, cardAxes] of axisScores) {
    for (const axis of cardAxes) {
      if (axis.relevance >= AXIS_RELEVANCE_THRESHOLD) {
        axisCardCounts.set(axis.axisId, (axisCardCounts.get(axis.axisId) ?? 0) + 1);
        axisStrengths.set(axis.axisId, (axisStrengths.get(axis.axisId) ?? 0) + axis.relevance);
      }
    }
  }

  const themes: DeckTheme[] = [];
  for (const [axisId, cardCount] of axisCardCounts) {
    if (cardCount < DECK_THEME_MIN_CARDS) continue;
    const axisDef = SYNERGY_AXES.find((a) => a.id === axisId);
    if (!axisDef) continue;
    const theme: DeckTheme = {
      axisId,
      axisName: axisDef.name,
      strength: axisStrengths.get(axisId) ?? 0,
      cardCount,
    };
    // Annotate tribal themes with the primary anchor type
    if (axisId === "tribal" && anchors && anchors.length > 0) {
      theme.detail = anchors[0];
      theme.axisName = `${anchors[0]} Tribal`;
    }
    // Annotate supertypeMatter themes with the primary supertype anchor
    if (axisId === "supertypeMatter" && supertypeAnchors && supertypeAnchors.length > 0) {
      theme.detail = supertypeAnchors[0];
      theme.axisName = SUPERTYPE_THEME_NAMES[supertypeAnchors[0]] ?? "Supertype Matters";
    }
    themes.push(theme);
  }

  return themes.sort((a, b) => b.strength - a.strength);
}

/** Main synergy analysis entry point */
export function analyzeDeckSynergy(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): DeckSynergyAnalysis {
  const cardNames = getAllCardNames(deck);

  // Step 1: Score every card against every axis
  const axisScores = computeAxisScores(cardNames, cardMap);

  // Step 1b: Boost tribal scores for creatures sharing subtypes with anchors
  boostTribalScores(deck, cardNames, cardMap, axisScores);

  // Step 1c: Boost supertype scores for cards matching supertype anchors
  const supertypeAnchors = boostSupertypeScores(deck, cardNames, cardMap, axisScores);

  // Step 2: Compute deck-level axis strengths
  const deckAxisStrengths = computeDeckAxisStrengths(axisScores);

  // Step 3: Detect known combos
  const comboPairs = combosToPairs(cardNames);

  // Step 4: Generate heuristic synergy pairs
  const synergyPairs = generateSynergyPairs(cardNames, axisScores);

  // Step 5: Generate anti-synergy pairs
  const antiSynergyPairs = generateAntiSynergyPairs(cardNames, axisScores, cardMap);

  // Step 6: Compute per-card scores
  const cardScores = computeCardScores(
    cardNames,
    axisScores,
    deckAxisStrengths,
    synergyPairs,
    antiSynergyPairs,
    comboPairs
  );

  // Step 7: Identify deck themes (pass tribal anchors for labeling)
  const commanders: EnrichedCard[] = [];
  for (const cmd of deck.commanders) {
    const card = cardMap[cmd.name];
    if (card) commanders.push(card);
  }
  const tribalAnchors = identifyTribalAnchors(commanders, cardNames, cardMap);
  const deckThemes = identifyDeckThemes(axisScores, tribalAnchors, supertypeAnchors);

  // Step 8: Sort and return
  const topSynergies = [...synergyPairs, ...comboPairs]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, TOP_SYNERGIES_LIMIT);

  return {
    cardScores,
    topSynergies,
    antiSynergies: antiSynergyPairs.sort((a, b) => b.strength - a.strength),
    knownCombos: comboPairs,
    deckThemes,
  };
}
