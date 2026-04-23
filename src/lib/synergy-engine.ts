import type {
  DeckData,
  EnrichedCard,
  CardAxisScore,
  SynergyPair,
  CardSynergyScore,
  DeckTheme,
  DeckSynergyAnalysis,
} from "./types";
import { SYNERGY_AXES, extractReferencedKeywords } from "./synergy-axes";
import { findCombosInDeck } from "./known-combos";
import type { AsymmetricWipeClassification } from "./card-tags";
import { getTagsCached, classifyAsymmetricWipe } from "./card-tags";
import {
  identifyTribalAnchors,
  getCreatureSubtypes,
  getCommanderTypes,
  isChangeling,
  extractReferencedTypes,
} from "./creature-types";
import {
  identifySupertypeAnchors,
  isHistoric,
} from "./supertypes";
import { getAllCardNames } from "./deck-analysis-aggregate";
import type { SynergyAnalysisOptions, CardIntentSummary } from "./reasoning-engine/types";
import {
  buildDeckIntentSummaries,
  analyzeDeckContext,
  applyDeckContext,
} from "./reasoning-engine";

const BASE_SCORE = 50;
const AXIS_WEIGHT = 3;
const COMBO_BONUS = 20;
const ANTI_SYNERGY_PENALTY_WEIGHT = 5;
const AXIS_RELEVANCE_THRESHOLD = 0.2;
const DECK_THEME_MIN_CARDS = 2;
const TOP_SYNERGIES_LIMIT = 15;

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

/** Build a lookup map for axis definitions by ID (avoids repeated SYNERGY_AXES.find()) */
function buildAxisMap(): Map<string, (typeof SYNERGY_AXES)[number]> {
  const map = new Map<string, (typeof SYNERGY_AXES)[number]>();
  for (const axis of SYNERGY_AXES) {
    map.set(axis.id, axis);
  }
  return map;
}

const axisMap = buildAxisMap();

/** Generate heuristic synergy pairs between cards sharing axes */
function generateSynergyPairs(
  cardNames: string[],
  axisScores: Map<string, CardAxisScore[]>,
  intentSummaries?: Record<string, CardIntentSummary>
): SynergyPair[] {
  // Group cards by axis for O(axis × cards_per_axis²) instead of O(cards²)
  const cardsByAxis = new Map<string, { name: string; relevance: number }[]>();

  for (const name of cardNames) {
    const axes = axisScores.get(name) ?? [];
    for (const axis of axes) {
      if (axis.relevance < AXIS_RELEVANCE_THRESHOLD) continue;
      let group = cardsByAxis.get(axis.axisId);
      if (!group) {
        group = [];
        cardsByAxis.set(axis.axisId, group);
      }
      group.push({ name, relevance: axis.relevance });
    }
  }

  const pairs: SynergyPair[] = [];
  const seen = new Set<string>();

  for (const [axisId, cards] of cardsByAxis) {
    if (cards.length < 2) continue;
    const axisInfo = axisMap.get(axisId);

    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i];
        const b = cards[j];

        const key = `${axisId}:${a.name < b.name ? `${a.name}|${b.name}` : `${b.name}|${a.name}`}`;
        if (seen.has(key)) continue;
        seen.add(key);

        // Reasoning engine filter: skip pairs where either card's contribution
        // to this axis is purely opponent-directed
        if (intentSummaries && shouldFilterPair(a.name, b.name, axisId, intentSummaries)) {
          continue;
        }

        const strength = Math.min(1, (a.relevance + b.relevance) / 2);

        pairs.push({
          cards: [a.name, b.name],
          axisId,
          type: "synergy",
          strength,
          description: `Both contribute to ${axisInfo?.name ?? axisId} strategy`,
        });
      }
    }
  }

  return pairs;
}

/**
 * Determine if a synergy pair should be filtered out based on intent analysis.
 * Returns true if the pair is a false positive (e.g., removal paired with own creature).
 */
function shouldFilterPair(
  cardA: string,
  cardB: string,
  axisId: string,
  intentSummaries: Record<string, CardIntentSummary>
): boolean {
  const summaryA = intentSummaries[cardA];
  const summaryB = intentSummaries[cardB];

  if (!summaryA || !summaryB) return false;

  // Check if either card's effects relevant to this axis are purely opponent-directed
  const intentA = getCardAxisIntent(summaryA, axisId);
  const intentB = getCardAxisIntent(summaryB, axisId);

  // If card A's contribution is opponent-only, it shouldn't synergize
  // with card B on this axis (e.g., Breya's -4/-4 shouldn't pair with creatures)
  if (intentA === "opponent" && intentB !== "opponent") return true;
  if (intentB === "opponent" && intentA !== "opponent") return true;

  return false;
}

/**
 * Get a card's dominant intent for a specific synergy axis.
 * Checks both the pre-computed axisIntent map and falls back to
 * examining individual effects.
 */
function getCardAxisIntent(
  summary: CardIntentSummary,
  axisId: string
): string | undefined {
  // Check pre-computed axis intent
  if (summary.axisIntent[axisId]) {
    return summary.axisIntent[axisId];
  }

  // Check if card has any opponent-directed harmful effects
  // that could create false positives
  const hasOpponentHarmful = summary.effects.some(
    (e) =>
      e.targetIntent === "opponent" &&
      e.polarity === "harmful" &&
      e.confidence >= 0.7
  );

  if (hasOpponentHarmful) {
    // Check if card also has self-beneficial effects
    const hasSelfBeneficial = summary.effects.some(
      (e) =>
        e.targetIntent === "self" &&
        e.polarity === "beneficial" &&
        e.confidence >= 0.5
    );

    if (hasSelfBeneficial) return "either";
    return "opponent";
  }

  return undefined;
}

// Patterns identifying token producers whose tokens would SURVIVE a wipe that spares a given card type.
// Used for per-pair exemption: only the token producer whose tokens match the spared category is
// exempt — unrelated token producers in the same deck still trigger the anti-synergy.
const TOKEN_SURVIVES_PATTERNS: Record<string, RegExp> = {
  // Explicit "artifact creature token" phrasing plus common artifact-creature token subtype names.
  artifact:
    /\bartifact creature tokens?\b|\b(?:Thopter|Servo|Construct|Myr|Golem|Scion|Powerstone|Drone|Assembly-Worker)\b/i,
  enchantment: /\benchantment (?:creature )?tokens?\b/i,
  legendary: /\blegendary (?:creature )?tokens?\b/i,
};

/** Whether this token producer's tokens survive a wipe that spares the given card-type categories. */
function tokensSurviveCardTypeWipe(
  producer: EnrichedCard,
  sparedTypes: string[]
): boolean {
  const text = producer.oracleText;
  for (const spared of sparedTypes) {
    const pattern = TOKEN_SURVIVES_PATTERNS[spared];
    if (pattern?.test(text)) return true;
  }
  return false;
}

/** Generate anti-synergy pairs between cards on conflicting axes */
function generateAntiSynergyPairs(
  cardNames: string[],
  axisScores: Map<string, CardAxisScore[]>,
  cardMap: Record<string, EnrichedCard>,
  tribalAnchorTypes: Set<string>,
  tagCache?: Map<string, string[]>
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

        const axisDef = axisMap.get(aAxis.axisId);
        if (!axisDef?.conflictsWith?.length) continue;

        for (const conflictId of axisDef.conflictsWith) {
          const bMatch = bAxes.find(
            (b) => b.axisId === conflictId && b.relevance >= AXIS_RELEVANCE_THRESHOLD
          );
          if (!bMatch) continue;

          const key = `anti:${[aName, bName].sort().join("|")}:${[aAxis.axisId, conflictId].sort().join("-")}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const conflictAxis = axisMap.get(conflictId);
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
  // Asymmetric (one-sided) wipes are exempt according to their sub-classification:
  //   - opponentSided (In Garruk's Wake): always exempt — the wipe never hits the caster's board.
  //   - chosenType (Kindred Dominance): exempt when the deck has any tribal anchor to name.
  //   - specificType ("non-Elf" wipes): exempt when the referenced subtype matches a deck anchor.
  //   - cardTypeRestricted (Organic Extinction's "nonartifact creatures"): exempt PER PAIR —
  //     only when the specific token producer's tokens match the spared card type. An artifact
  //     deck with Bitterblossom still loses its Faerie tokens to Organic Extinction.
  const tokenCardNames: string[] = [];
  type WipeInfo = {
    name: string;
    classification: AsymmetricWipeClassification | null;
    referencedTypes: string[];
  };
  const boardWipes: WipeInfo[] = [];

  for (const name of cardNames) {
    const card = cardMap[name];
    if (!card) continue;
    const tags = getTagsCached(card, tagCache);
    if (tags.includes("Board Wipe")) {
      const classification = tags.includes("Asymmetric Wipe")
        ? classifyAsymmetricWipe(card.oracleText)
        : null;
      const referencedTypes =
        classification?.kind === "specificType"
          ? extractReferencedTypes(card.oracleText)
          : [];
      boardWipes.push({ name, classification, referencedTypes });
    }
    const tokenAxes = axisScores.get(name) ?? [];
    if (tokenAxes.some((a) => a.axisId === "tokens" && a.relevance >= AXIS_RELEVANCE_THRESHOLD)) {
      tokenCardNames.push(name);
    }
  }

  for (const wipe of boardWipes) {
    const c = wipe.classification;
    // Opponent-sided wipes never pair with tokens.
    if (c?.kind === "opponentSided") continue;
    // Chosen-type wipes are exempt whenever the deck has any tribal anchor the caster can name.
    if (c?.kind === "chosenType" && tribalAnchorTypes.size > 0) continue;
    // Specific-type wipes ("non-Elf") are exempt only if the named subtype matches an anchor.
    if (
      c?.kind === "specificType" &&
      wipe.referencedTypes.some((t) => tribalAnchorTypes.has(t))
    ) {
      continue;
    }

    for (const tokenName of tokenCardNames) {
      // Card-type-restricted wipes: exempt this pair only if the specific token producer's
      // tokens survive the wipe (e.g. Thopter Spy Network makes artifact creature tokens,
      // which survive Organic Extinction).
      if (c?.kind === "cardTypeRestricted") {
        const producer = cardMap[tokenName];
        if (producer && tokensSurviveCardTypeWipe(producer, c.excludedTypes)) {
          continue;
        }
      }

      const key = `anti:${[wipe.name, tokenName].sort().join("|")}:boardwipe-tokens`;
      if (seen.has(key)) continue;
      seen.add(key);

      pairs.push({
        cards: [wipe.name, tokenName],
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
  const tribalAxis = axisMap.get("tribal");
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
  const supertypeAxis = axisMap.get("supertypeMatter");
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

/**
 * Boost keywordMatters axis scores for cards that HAVE keywords anchored
 * by payoff cards (commanders or other keyword-matters cards).
 * A flying creature alone doesn't score on keywordMatters, but in a deck
 * with Kangee (flying payoff), every flying creature becomes synergistic.
 */
function boostKeywordScores(
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

  // Identify which keywords are "anchored" by payoff cards
  const keywordCounts = new Map<string, number>();

  // Commander mentions are weighted heavily (count as 3)
  for (const cmd of commanders) {
    for (const kw of extractReferencedKeywords(cmd)) {
      keywordCounts.set(kw, (keywordCounts.get(kw) ?? 0) + 3);
    }
  }

  // Non-commander cards that scored on keywordMatters axis also anchor
  for (const name of cardNames) {
    const card = cardMap[name];
    if (!card) continue;
    const cardAxes = axisScores.get(name) ?? [];
    if (!cardAxes.some((a) => a.axisId === "keywordMatters" && a.relevance >= 0.2)) continue;
    for (const kw of extractReferencedKeywords(card)) {
      keywordCounts.set(kw, (keywordCounts.get(kw) ?? 0) + 1);
    }
  }

  // A keyword is an anchor if commander references it (count >= 3) or 2+ cards reference it
  const anchors = [...keywordCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([kw]) => kw);

  if (anchors.length === 0) return anchors;

  const kwAxis = axisMap.get("keywordMatters");
  if (!kwAxis) return anchors;

  // Boost cards that HAVE the anchored keywords
  for (const name of cardNames) {
    const card = cardMap[name];
    if (!card) continue;

    const cardKeywords = card.keywords.map((k) => k.toLowerCase());
    const matchingAnchors = anchors.filter((anchor) =>
      cardKeywords.includes(anchor)
    );

    if (matchingAnchors.length === 0) continue;

    // Commander-referenced keywords get higher boost
    let boost = 0;
    for (const kw of matchingAnchors) {
      const count = keywordCounts.get(kw) ?? 0;
      if (count >= 3) {
        boost += 0.25; // Commander references this keyword
      } else {
        boost += 0.15; // Non-commander cards reference it
      }
    }
    boost = Math.min(0.5, boost);

    const cardAxes = axisScores.get(name) ?? [];
    const existing = cardAxes.find((a) => a.axisId === "keywordMatters");

    if (existing) {
      existing.relevance = Math.min(1, existing.relevance + boost);
    } else {
      cardAxes.push({
        axisId: "keywordMatters",
        axisName: kwAxis.name,
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
  supertypeAnchors?: string[],
  keywordAnchors?: string[]
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
    const axisDef = axisMap.get(axisId);
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
    // Annotate keywordMatters themes with the primary keyword anchor
    if (axisId === "keywordMatters" && keywordAnchors && keywordAnchors.length > 0) {
      theme.detail = keywordAnchors[0];
      const kwDisplay = keywordAnchors[0]
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      theme.axisName = `${kwDisplay} Matters`;
    }
    themes.push(theme);
  }

  return themes.sort((a, b) => b.strength - a.strength);
}

/** Main synergy analysis entry point */
export function analyzeDeckSynergy(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  tagCache?: Map<string, string[]>,
  options?: SynergyAnalysisOptions
): DeckSynergyAnalysis {
  const cardNames = getAllCardNames(deck);

  // Step 1: Score every card against every axis
  const axisScores = computeAxisScores(cardNames, cardMap);

  // Step 1b: Boost tribal scores for creatures sharing subtypes with anchors
  boostTribalScores(deck, cardNames, cardMap, axisScores);

  // Step 1c: Boost supertype scores for cards matching supertype anchors
  const supertypeAnchors = boostSupertypeScores(deck, cardNames, cardMap, axisScores);

  // Step 1d: Boost keyword scores for cards with keywords anchored by payoff cards
  const keywordAnchors = boostKeywordScores(deck, cardNames, cardMap, axisScores);

  // Step 1e: Build reasoning engine intent summaries (opt-in)
  let intentSummaries: Record<string, CardIntentSummary> | undefined;
  if (options?.reasoning) {
    intentSummaries = buildDeckIntentSummaries(cardMap);
    const deckContext = analyzeDeckContext(cardMap, axisScores);
    applyDeckContext(intentSummaries, deckContext);
  }

  // Step 2: Compute deck-level axis strengths
  const deckAxisStrengths = computeDeckAxisStrengths(axisScores);

  // Step 3: Detect known combos
  const comboPairs = combosToPairs(cardNames);

  // Step 4: Generate heuristic synergy pairs (with optional intent filtering)
  const synergyPairs = generateSynergyPairs(cardNames, axisScores, intentSummaries);

  // Step 5a: Resolve commanders and tribal anchors (needed by anti-synergy and theme detection)
  const commanders: EnrichedCard[] = [];
  for (const cmd of deck.commanders) {
    const card = cardMap[cmd.name];
    if (card) commanders.push(card);
  }
  const tribalAnchors = identifyTribalAnchors(commanders, cardNames, cardMap);
  const tribalAnchorTypes = new Set(tribalAnchors);

  // Step 5b: Generate anti-synergy pairs (asymmetric wipes exempt when they protect the deck's theme)
  const antiSynergyPairs = generateAntiSynergyPairs(
    cardNames,
    axisScores,
    cardMap,
    tribalAnchorTypes,
    tagCache
  );

  // Step 6: Compute per-card scores
  const cardScores = computeCardScores(
    cardNames,
    axisScores,
    deckAxisStrengths,
    synergyPairs,
    antiSynergyPairs,
    comboPairs
  );

  // Step 7: Identify deck themes (reuses tribal anchors resolved above)
  const deckThemes = identifyDeckThemes(axisScores, tribalAnchors, supertypeAnchors, keywordAnchors);

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
