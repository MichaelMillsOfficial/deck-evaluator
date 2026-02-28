import type { DeckData, DeckTheme, EnrichedCard } from "./types";
import { generateTags } from "./card-tags";
import { type MtgColor } from "./color-distribution";
import { classifyLandEntry } from "./land-base-efficiency";
import { SYNERGY_AXES } from "./synergy-axes";

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
  strategyScore?: number;
  cardAdvantageCount?: number;
  interactionCount?: number;
  themeHits?: string[];
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
  avgStrategyScore?: number;
}

export interface RankedHand {
  rank: number;
  hand: DrawnHand;
  cardKey: string;
}

export interface HandEvaluationContext {
  deckThemes: DeckTheme[];
  cardCache?: Map<string, { tags: string[]; axisScores: Map<string, number> }>;
}

export interface HandWeights {
  land: number;
  curve: number;
  color: number;
  ramp: number;
  strategy: number;
  cardAdvantage: number;
  interaction: number;
}

export interface PipRequirement {
  satisfiedBy: Set<string>;
}

/**
 * Parse a Scryfall mana cost string into colored pip requirements.
 * Each requirement has a set of colors that can satisfy it.
 *
 * - Single color pips ({W}, {U}, etc.) → satisfiedBy one color
 * - Hybrid pips ({W/U}) → satisfiedBy either color
 * - Phyrexian ({B/P}) → skipped (payable with life)
 * - Mono-hybrid ({2/W}) → skipped (payable with generic)
 * - Colorless-specific ({C}) → satisfiedBy "C"
 * - Generic ({1}, {X}, {0}) → skipped
 */
export function parsePipRequirements(manaCost: string): PipRequirement[] {
  if (!manaCost) return [];

  const pips: PipRequirement[] = [];
  const symbolRe = /\{([^}]+)\}/g;

  for (const match of manaCost.matchAll(symbolRe)) {
    const inner = match[1];

    // Hybrid color/color: {W/U}
    if (/^([WUBRG])\/([WUBRG])$/.test(inner)) {
      const [c1, c2] = inner.split("/");
      pips.push({ satisfiedBy: new Set([c1, c2]) });
      continue;
    }

    // Phyrexian: {B/P} or {B/H} — skip (payable with life)
    if (/^[WUBRG]\/[PH]$/.test(inner)) continue;

    // Mono-hybrid: {2/W} — skip (payable with generic)
    if (/^\d+\/[WUBRG]$/.test(inner)) continue;

    // Single color or colorless-specific: {W}, {C}
    if (/^[WUBRGC]$/.test(inner)) {
      pips.push({ satisfiedBy: new Set([inner]) });
      continue;
    }

    // Generic mana ({0}, {1}, {X}, etc.) — skip
  }

  return pips;
}

/**
 * Determine if a spell's colored pip requirements can be satisfied
 * by the given land sources using bipartite matching.
 *
 * Each land source is an array of colors that land can produce.
 */
export function canCastWithLands(
  spell: EnrichedCard,
  landSources: string[][]
): boolean {
  const pips = parsePipRequirements(spell.manaCost);
  if (pips.length === 0) return true;
  if (pips.length > landSources.length) return false;

  // Sort pips by ascending satisfiedBy size (most constrained first for pruning)
  const sorted = pips
    .map((p, i) => ({ idx: i, satisfiedBy: p.satisfiedBy }))
    .sort((a, b) => a.satisfiedBy.size - b.satisfiedBy.size);

  const usedLands = new Set<number>();

  function backtrack(pipIdx: number): boolean {
    if (pipIdx >= sorted.length) return true;
    const pip = sorted[pipIdx];
    for (let li = 0; li < landSources.length; li++) {
      if (usedLands.has(li)) continue;
      const landColors = landSources[li];
      if (!landColors.some((c) => pip.satisfiedBy.has(c))) continue;
      usedLands.add(li);
      if (backtrack(pipIdx + 1)) return true;
      usedLands.delete(li);
    }
    return false;
  }

  return backtrack(0);
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

function getTagsForCard(
  card: EnrichedCard,
  cache?: Map<string, { tags: string[]; axisScores: Map<string, number> }>
): string[] {
  if (cache) {
    const cached = cache.get(card.name);
    if (cached) return cached.tags;
  }
  return generateTags(card);
}

function getAxisScoresForCard(
  card: EnrichedCard,
  cache?: Map<string, { tags: string[]; axisScores: Map<string, number> }>
): Map<string, number> {
  if (cache) {
    const cached = cache.get(card.name);
    if (cached) return cached.axisScores;
  }
  const scores = new Map<string, number>();
  for (const axis of SYNERGY_AXES) {
    const score = axis.detect(card);
    if (score > 0) scores.set(axis.id, score);
  }
  return scores;
}

// ---------------------------------------------------------------------------
// buildPool
// ---------------------------------------------------------------------------

/**
 * Flatten mainboard into a pool of HandCards, repeating for quantity.
 * Commanders and sideboard are excluded — commanders start in the command
 * zone and are never part of the library. Cards missing from cardMap are
 * skipped.
 */
export function buildPool(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): HandCard[] {
  const pool: HandCard[] = [];

  for (const card of deck.mainboard) {
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

/**
 * Build command zone HandCards from the deck's commanders.
 * These cards are always available to cast and are never drawn.
 */
export function buildCommandZone(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): HandCard[] {
  const zone: HandCard[] = [];

  for (const card of deck.commanders) {
    const enriched = cardMap[card.name];
    if (!enriched) continue;

    for (let i = 0; i < card.quantity; i++) {
      zone.push({
        name: card.name,
        quantity: card.quantity,
        enriched,
      });
    }
  }

  return zone;
}

/**
 * Pre-compute tags and axis scores for all cards in a pool.
 * Call once before simulation loops to avoid redundant regex work.
 */
export function buildCardCache(
  pool: HandCard[]
): Map<string, { tags: string[]; axisScores: Map<string, number> }> {
  const cache = new Map<
    string,
    { tags: string[]; axisScores: Map<string, number> }
  >();
  for (const card of pool) {
    if (cache.has(card.name)) continue;
    const tags = generateTags(card.enriched);
    const axisScores = new Map<string, number>();
    for (const axis of SYNERGY_AXES) {
      const score = axis.detect(card.enriched);
      if (score > 0) axisScores.set(axis.id, score);
    }
    cache.set(card.name, { tags, axisScores });
  }
  return cache;
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
// New scoring helpers
// ---------------------------------------------------------------------------

const CA_TAGS = new Set(["Card Draw", "Card Advantage", "Tutor"]);
const INTERACTION_TAGS = new Set(["Removal", "Board Wipe", "Counterspell"]);

/**
 * Tempo-weighted ramp scoring.
 * CMC ≤ 2 → 1.0, CMC 3 → 0.8, CMC 4 → 0.5, CMC 5+ → 0.2
 */
export function scoreRamp(
  hand: HandCard[],
  cache?: Map<string, { tags: string[]; axisScores: Map<string, number> }>
): number {
  let effectiveCount = 0;
  for (const card of hand) {
    if (isLand(card.enriched)) continue;
    const tags = getTagsForCard(card.enriched, cache);
    if (!tags.includes("Ramp")) continue;
    const cmc = card.enriched.cmc;
    let weight: number;
    if (cmc <= 2) weight = 1.0;
    else if (cmc === 3) weight = 0.8;
    else if (cmc === 4) weight = 0.5;
    else weight = 0.2;
    effectiveCount += weight;
  }

  if (effectiveCount >= 2.0) return 100;
  if (effectiveCount >= 1.0) return 70;
  if (effectiveCount >= 0.5) return 50;
  return 30;
}

/**
 * Tempo-weighted card advantage scoring.
 * Tags: "Card Draw", "Card Advantage", "Tutor"
 * CMC ≤ 3 → 1.0, CMC 4-5 → 0.7, CMC 6+ → 0.4
 */
export function scoreCardAdvantage(
  hand: HandCard[],
  cache?: Map<string, { tags: string[]; axisScores: Map<string, number> }>
): number {
  let effectiveCount = 0;
  for (const card of hand) {
    if (isLand(card.enriched)) continue;
    const tags = getTagsForCard(card.enriched, cache);
    if (!tags.some((t) => CA_TAGS.has(t))) continue;
    const cmc = card.enriched.cmc;
    let weight: number;
    if (cmc <= 3) weight = 1.0;
    else if (cmc <= 5) weight = 0.7;
    else weight = 0.4;
    effectiveCount += weight;
  }

  if (effectiveCount >= 2.0) return 100;
  if (effectiveCount >= 1.0) return 70;
  if (effectiveCount >= 0.5) return 50;
  return 25;
}

/**
 * Tempo-weighted interaction scoring.
 * Tags: "Removal", "Board Wipe", "Counterspell"
 * CMC ≤ 3 → 1.0, CMC 4-5 → 0.7, CMC 6+ → 0.4
 */
export function scoreInteraction(
  hand: HandCard[],
  cache?: Map<string, { tags: string[]; axisScores: Map<string, number> }>
): number {
  let effectiveCount = 0;
  for (const card of hand) {
    if (isLand(card.enriched)) continue;
    const tags = getTagsForCard(card.enriched, cache);
    if (!tags.some((t) => INTERACTION_TAGS.has(t))) continue;
    const cmc = card.enriched.cmc;
    let weight: number;
    if (cmc <= 3) weight = 1.0;
    else if (cmc <= 5) weight = 0.7;
    else weight = 0.4;
    effectiveCount += weight;
  }

  if (effectiveCount >= 2.0) return 100;
  if (effectiveCount >= 1.0) return 70;
  if (effectiveCount >= 0.5) return 50;
  return 20;
}

/**
 * Strategy alignment scoring: do hand cards match deck themes and
 * can the hand actually deploy them early?
 *
 * Returns { score: 0-100, themeHits: string[] }
 */
export function scoreStrategy(
  hand: HandCard[],
  deckThemes: DeckTheme[],
  landCount: number,
  rampCount: number,
  cache?: Map<string, { tags: string[]; axisScores: Map<string, number> }>
): number {
  if (deckThemes.length === 0) return 50; // neutral for goodstuff decks

  const availableManaByT4 = landCount + rampCount;
  const topThemes = deckThemes.slice(0, 3);

  // Compute tempo-weighted relevance for each non-land card
  const spells = hand.filter((c) => !isLand(c.enriched));
  const cardRelevances: { themeIds: Set<string>; tempoWeight: number }[] = [];

  for (const card of spells) {
    const axisScores = getAxisScoresForCard(card.enriched, cache);
    const matchedThemeIds = new Set<string>();
    let maxRelevance = 0;

    for (const theme of topThemes) {
      const axisScore = axisScores.get(theme.axisId) ?? 0;
      if (axisScore > 0) {
        matchedThemeIds.add(theme.axisId);
        maxRelevance = Math.max(maxRelevance, axisScore);
      }
    }

    if (matchedThemeIds.size === 0) continue;

    // Tempo discount based on castability
    const cmc = card.enriched.cmc;
    let tempoWeight: number;
    if (cmc <= availableManaByT4) tempoWeight = 1.0;
    else if (cmc <= availableManaByT4 + 2) tempoWeight = 0.4;
    else tempoWeight = 0.15;

    cardRelevances.push({
      themeIds: matchedThemeIds,
      tempoWeight: maxRelevance * tempoWeight,
    });
  }

  // Theme hit rate: fraction of top themes with ≥1 tempo-weighted relevant card ≥ 0.2
  const themesHit = new Set<string>();
  for (const cr of cardRelevances) {
    if (cr.tempoWeight >= 0.2) {
      cr.themeIds.forEach((id) => themesHit.add(id));
    }
  }
  const themeHitRate =
    topThemes.length > 0 ? themesHit.size / topThemes.length : 0;

  // Average tempo-weighted relevance
  const avgRelevance =
    cardRelevances.length > 0
      ? cardRelevances.reduce((sum, cr) => sum + cr.tempoWeight, 0) /
        cardRelevances.length
      : 0;

  // Combined: 60% theme hit rate + 40% average relevance
  const rawScore = themeHitRate * 0.6 + avgRelevance * 0.4;
  return Math.round(rawScore * 100);
}

/**
 * Get theme names that are represented in the hand.
 */
function getThemeHits(
  hand: HandCard[],
  deckThemes: DeckTheme[],
  cache?: Map<string, { tags: string[]; axisScores: Map<string, number> }>
): string[] {
  if (deckThemes.length === 0) return [];
  const topThemes = deckThemes.slice(0, 3);
  const hits = new Set<string>();
  const spells = hand.filter((c) => !isLand(c.enriched));

  for (const card of spells) {
    const axisScores = getAxisScoresForCard(card.enriched, cache);
    for (const theme of topThemes) {
      const score = axisScores.get(theme.axisId) ?? 0;
      if (score > 0) hits.add(theme.axisName);
    }
  }
  return Array.from(hits);
}

// ---------------------------------------------------------------------------
// getAbilityReliability
// ---------------------------------------------------------------------------

const ETB_TRIGGERED_RE = /\b(?:enters the battlefield|enters|whenever|at the beginning)\b/i;
const ACTIVATED_COST_RE = /^((?:\{[^}]+\}|[^:{}])*?):\s*/;
const MANA_SYMBOL_RE = /\{([^}]+)\}/g;

/**
 * Determine how reliably a commander provides a capability.
 * Returns a reliability scale factor:
 *   ETB/triggered → 1.0
 *   Cheap activated (≤2 mana) → 0.8
 *   Moderate activated (3-4 mana) → 0.5
 *   Expensive activated (5+ mana) → 0.3
 *   No matching ability → 1.0 (fallback)
 */
export function getAbilityReliability(
  card: EnrichedCard,
  tagType: "cardAdvantage" | "interaction" | "ramp"
): number {
  const text = card.oracleText;
  if (!text) return 1.0;

  // Determine which patterns to look for based on tag type
  let relevantPatterns: RegExp[];
  if (tagType === "cardAdvantage") {
    relevantPatterns = [/\bdraw\b/i, /\binto your hand\b/i, /\bsearch your library\b/i];
  } else if (tagType === "interaction") {
    relevantPatterns = [/\bdestroy\b/i, /\bexile\b/i, /\bcounter\b/i, /\breturn\b.*\bto\b/i];
  } else {
    // ramp
    relevantPatterns = [/\bAdd\s+\{/i, /\bsearch\b.*\bland\b/i];
  }

  // Check if any relevant pattern matches
  const hasRelevantAbility = relevantPatterns.some((p) => p.test(text));
  if (!hasRelevantAbility) return 1.0; // fallback

  // Check for ETB/triggered abilities
  if (ETB_TRIGGERED_RE.test(text)) {
    // Check if the relevant pattern is in a triggered/ETB clause
    const clauses = text.split("\n");
    for (const clause of clauses) {
      const hasRelevant = relevantPatterns.some((p) => p.test(clause));
      if (!hasRelevant) continue;

      // If this clause starts with an activation cost (mana/tap before colon),
      // it's an activated ability, not triggered
      const match = clause.trim().match(ACTIVATED_COST_RE);
      if (match) {
        // Has an activation cost — compute its mana cost
        const costPart = match[1];
        const manaCost = computeActivationManaCost(costPart);
        if (manaCost <= 2) return 0.8;
        if (manaCost <= 4) return 0.5;
        return 0.3;
      }
      // No activation cost prefix → it's triggered
      return 1.0;
    }
  }

  // Check for activated abilities (cost: effect pattern)
  const clauses = text.split("\n");
  for (const clause of clauses) {
    const hasRelevant = relevantPatterns.some((p) => p.test(clause));
    if (!hasRelevant) continue;

    const match = clause.trim().match(ACTIVATED_COST_RE);
    if (match) {
      const costPart = match[1];
      const manaCost = computeActivationManaCost(costPart);
      if (manaCost <= 2) return 0.8;
      if (manaCost <= 4) return 0.5;
      return 0.3;
    }
  }

  // Fallback: has the ability but couldn't classify it
  return 1.0;
}

/**
 * Sum the total mana cost from an activation cost string like "{2}{U}{G}" or "{5}".
 */
function computeActivationManaCost(costStr: string): number {
  let total = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(MANA_SYMBOL_RE.source, "g");
  while ((match = re.exec(costStr)) !== null) {
    const sym = match[1];
    if (sym === "T" || sym === "Q") continue; // tap/untap symbols
    const num = parseInt(sym, 10);
    if (!isNaN(num)) {
      total += num;
    } else {
      // Colored pip or hybrid — counts as 1
      total += 1;
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// computeAdjustedWeights
// ---------------------------------------------------------------------------

const BASE_WEIGHTS: HandWeights = {
  land: 0.25,
  curve: 0.20,
  color: 0.15,
  ramp: 0.10,
  strategy: 0.15,
  cardAdvantage: 0.08,
  interaction: 0.07,
};

function getCmcScale(cmc: number): number {
  if (cmc <= 3) return 1.0;
  if (cmc <= 5) return 0.6;
  return 0.25;
}

/**
 * Compute dynamically adjusted weights based on what commanders provide.
 * Returns adjusted weights and reasoning strings explaining adjustments.
 */
export function computeAdjustedWeights(
  commandZone: HandCard[],
  cache?: Map<string, { tags: string[]; axisScores: Map<string, number> }>
): { weights: HandWeights; reasoning: string[] } {
  const weights = { ...BASE_WEIGHTS };
  const reasoning: string[] = [];

  if (commandZone.length === 0) {
    return { weights, reasoning };
  }

  // Analyze each commander's capabilities
  interface CommanderCapability {
    name: string;
    cmc: number;
    hasCA: boolean;
    hasInteraction: boolean;
    hasRamp: boolean;
    caReliability: number;
    interactionReliability: number;
    rampReliability: number;
  }

  const commanders: CommanderCapability[] = commandZone.map((cmd) => {
    const tags = getTagsForCard(cmd.enriched, cache);
    return {
      name: cmd.name,
      cmc: cmd.enriched.cmc,
      hasCA: tags.some((t) => CA_TAGS.has(t)),
      hasInteraction: tags.some((t) => INTERACTION_TAGS.has(t)),
      hasRamp: tags.includes("Ramp"),
      caReliability: getAbilityReliability(cmd.enriched, "cardAdvantage"),
      interactionReliability: getAbilityReliability(cmd.enriched, "interaction"),
      rampReliability: getAbilityReliability(cmd.enriched, "ramp"),
    };
  });

  // Track total weight surplus to redistribute
  let surplus = 0;

  // Card advantage adjustment — use most favorable commander
  const caCommanders = commanders.filter((c) => c.hasCA);
  if (caCommanders.length > 0) {
    // Pick commander with lowest effective cost (cmcScale × reliability = highest)
    let bestScale = 0;
    let bestCmd: CommanderCapability | null = null;
    for (const cmd of caCommanders) {
      const scale = getCmcScale(cmd.cmc) * cmd.caReliability;
      if (scale > bestScale) {
        bestScale = scale;
        bestCmd = cmd;
      }
    }
    if (bestCmd && bestScale >= 0.2) {
      const reduction = weights.cardAdvantage * 0.5 * bestScale;
      weights.cardAdvantage -= reduction;
      surplus += reduction;

      if (bestScale >= 0.8) {
        reasoning.push(
          `Commander (${bestCmd.name}, CMC ${bestCmd.cmc}) provides card advantage -- hand card draw less critical`
        );
      } else if (bestCmd.caReliability < 0.8) {
        reasoning.push(
          `Commander (${bestCmd.name}, CMC ${bestCmd.cmc}) has card draw via expensive ability -- hand still benefits from card advantage sources`
        );
      } else {
        reasoning.push(
          `Commander (${bestCmd.name}, CMC ${bestCmd.cmc}) provides card draw but is expensive to cast -- hand still needs card advantage sources`
        );
      }
    }
  }

  // Interaction adjustment
  const interactionCommanders = commanders.filter((c) => c.hasInteraction);
  if (interactionCommanders.length > 0) {
    let bestScale = 0;
    let bestCmd: CommanderCapability | null = null;
    for (const cmd of interactionCommanders) {
      const scale = getCmcScale(cmd.cmc) * cmd.interactionReliability;
      if (scale > bestScale) {
        bestScale = scale;
        bestCmd = cmd;
      }
    }
    if (bestCmd && bestScale >= 0.2) {
      const reduction = weights.interaction * 0.5 * bestScale;
      weights.interaction -= reduction;
      surplus += reduction;

      if (bestScale >= 0.8) {
        reasoning.push(
          `Commander (${bestCmd.name}, CMC ${bestCmd.cmc}) provides interaction -- hand removal less critical`
        );
      } else if (bestCmd.cmc > 5) {
        reasoning.push(
          `Commander (${bestCmd.name}, CMC ${bestCmd.cmc}) provides interaction but is expensive to cast -- hand still needs answers`
        );
      } else {
        reasoning.push(
          `Commander (${bestCmd.name}, CMC ${bestCmd.cmc}) provides interaction -- hand removal less critical`
        );
      }
    }
  }

  // Ramp adjustment
  const rampCommanders = commanders.filter((c) => c.hasRamp);
  if (rampCommanders.length > 0) {
    let bestScale = 0;
    let bestCmd: CommanderCapability | null = null;
    for (const cmd of rampCommanders) {
      const scale = getCmcScale(cmd.cmc) * cmd.rampReliability;
      if (scale > bestScale) {
        bestScale = scale;
        bestCmd = cmd;
      }
    }
    if (bestCmd && bestScale >= 0.2) {
      const reduction = weights.ramp * 0.4 * bestScale;
      weights.ramp -= reduction;
      // Ramp surplus goes to curve playability
      weights.curve += reduction;

      reasoning.push(
        `Commander (${bestCmd.name}, CMC ${bestCmd.cmc}) provides ramp -- early acceleration less critical`
      );
    }
  }

  // Redistribute CA/interaction surplus to strategy
  if (surplus > 0) {
    weights.strategy += surplus;
  }

  return { weights, reasoning };
}

// ---------------------------------------------------------------------------
// evaluateHandQuality
// ---------------------------------------------------------------------------

/**
 * Evaluate a drawn hand's quality using weighted heuristic scoring.
 *
 * Without context: original 4-factor weights (35/30/20/15)
 * With context: 7-factor weights (25/20/15/10/15/8/7) with commander adjustments
 */
export function evaluateHandQuality(
  hand: HandCard[],
  mulliganNumber: number,
  commanderIdentity: Set<MtgColor | string>,
  commandZone: HandCard[] = [],
  context?: HandEvaluationContext
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

  // Build land source arrays for proper pip-to-land matching
  const allLandSources = lands.map((l) => l.enriched.producedMana);
  const untappedLandSources = untappedLands.map((l) => l.enriched.producedMana);

  // --- Playable turns analysis ---
  const allSpells = [...spells, ...commandZone];
  const playableTurns: boolean[] = [];

  // Turn 1
  const t1Playable =
    untappedCount >= 1 &&
    allSpells.some((s) => {
      if (s.enriched.cmc > 1) return false;
      return canCastWithLands(s.enriched, untappedLandSources);
    });
  playableTurns.push(t1Playable);

  // Turn 2
  const t2Playable =
    landCount >= 2 &&
    allSpells.some((s) => {
      if (s.enriched.cmc > 2) return false;
      return canCastWithLands(s.enriched, allLandSources);
    });
  playableTurns.push(t2Playable);

  // Turn 3
  const t3Playable =
    landCount >= 3 &&
    allSpells.some((s) => {
      if (s.enriched.cmc > 3) return false;
      return canCastWithLands(s.enriched, allLandSources);
    });
  playableTurns.push(t3Playable);

  // --- Color coverage ---
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
  if (neededColors.length === 0) {
    colorCoverage = 1.0;
  }

  // --- Curve playability ---
  const curvePlayability =
    playableTurns.length > 0
      ? playableTurns.filter(Boolean).length / playableTurns.length
      : 0;

  // --- Land count scoring ---
  const idealLandMin = Math.max(1, Math.round((handSize * 2) / 7));
  const idealLandMax = Math.min(handSize - 1, Math.round((handSize * 4) / 7));

  let landScore: number;
  if (landCount === 0) {
    landScore = 0;
  } else if (landCount >= handSize) {
    landScore = 0;
  } else if (landCount >= idealLandMin && landCount <= idealLandMax) {
    const center = (idealLandMin + idealLandMax) / 2;
    const range = (idealLandMax - idealLandMin) / 2 || 1;
    const distFromCenter = Math.abs(landCount - center) / range;
    landScore = 100 * (1 - distFromCenter * 0.15);
  } else if (landCount < idealLandMin) {
    const deficit = idealLandMin - landCount;
    landScore = Math.max(0, 50 - deficit * 30);
  } else {
    const excess = landCount - idealLandMax;
    landScore = Math.max(0, 60 - excess * 25);
  }

  // Bonus for ramp when land count is low
  if (landCount === 1 && rampCount > 0) {
    landScore = Math.min(100, landScore + 15);
  }

  // --- Curve score ---
  const curveScore = curvePlayability * 100;

  // --- Color score ---
  const colorScore = colorCoverage * 100;

  // --- Build factors ---
  const factors: HandQualityFactors = {
    landCount,
    rampCount,
    playableTurns,
    colorCoverage,
    curvePlayability,
  };

  let clampedScore: number;
  let commanderAdjustments: string[] = [];

  if (!context) {
    // --- Original 4-factor scoring (backward compatible) ---
    let rampScore: number;
    if (rampCount >= 2) {
      rampScore = 100;
    } else if (rampCount === 1) {
      rampScore = 70;
    } else {
      rampScore = 30;
    }

    const score = Math.round(
      landScore * 0.35 +
        curveScore * 0.3 +
        colorScore * 0.2 +
        rampScore * 0.15
    );
    clampedScore = Math.max(0, Math.min(100, score));
  } else {
    // --- 7-factor scoring with context ---
    const rampScoreVal = scoreRamp(hand, context.cardCache);
    const caScoreVal = scoreCardAdvantage(hand, context.cardCache);
    const interactionScoreVal = scoreInteraction(hand, context.cardCache);
    const strategyScoreVal = scoreStrategy(
      hand,
      context.deckThemes,
      landCount,
      rampCount,
      context.cardCache
    );

    // Extend factors with new fields
    factors.strategyScore = strategyScoreVal;
    factors.cardAdvantageCount = caScoreVal;
    factors.interactionCount = interactionScoreVal;
    factors.themeHits = getThemeHits(hand, context.deckThemes, context.cardCache);

    // Get adjusted weights for commander awareness
    const { weights, reasoning: cmdReasoning } = computeAdjustedWeights(
      commandZone,
      context.cardCache
    );
    commanderAdjustments = cmdReasoning;

    const score = Math.round(
      landScore * weights.land +
        curveScore * weights.curve +
        colorScore * weights.color +
        rampScoreVal * weights.ramp +
        strategyScoreVal * weights.strategy +
        caScoreVal * weights.cardAdvantage +
        interactionScoreVal * weights.interaction
    );
    clampedScore = Math.max(0, Math.min(100, score));
  }

  const verdict = getVerdict(clampedScore);
  const reasoning = generateReasoning(
    factors,
    mulliganNumber,
    context ? commanderAdjustments : undefined
  );

  return {
    score: clampedScore,
    verdict,
    factors,
    reasoning,
  };
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
  mulliganNumber: number,
  commanderAdjustments?: string[]
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

  // --- New factor reasoning (only when context was provided) ---

  // Strategy alignment
  if (factors.strategyScore !== undefined && factors.themeHits !== undefined) {
    const hits = factors.themeHits;
    if (hits.length >= 2) {
      reasoning.push(
        `${hits.length} cards support deck themes (${hits.join(", ")}) -- strong game plan setup`
      );
    } else if (hits.length === 1) {
      reasoning.push(
        `1 card supports ${hits[0]} theme -- partial game plan`
      );
    } else if (factors.strategyScore < 50) {
      reasoning.push(
        "No cards align with deck themes -- hand lacks strategic direction"
      );
    }
    // When strategyScore is 50 (no themes detected), omit reasoning
  }

  // Card advantage
  if (factors.cardAdvantageCount !== undefined) {
    if (factors.cardAdvantageCount >= 100) {
      reasoning.push("2 card advantage sources for hand refill");
    } else if (factors.cardAdvantageCount >= 70) {
      reasoning.push("1 card advantage source available");
    } else if (factors.cardAdvantageCount >= 50) {
      reasoning.push("1 card advantage source available");
    } else {
      reasoning.push("No card draw or selection -- may run out of gas");
    }
  }

  // Interaction
  if (factors.interactionCount !== undefined) {
    if (factors.interactionCount >= 100) {
      reasoning.push("2 interaction pieces to answer threats");
    } else if (factors.interactionCount >= 70) {
      reasoning.push("1 interaction piece available");
    } else if (factors.interactionCount >= 50) {
      reasoning.push("1 interaction piece available");
    } else {
      reasoning.push(
        "No interaction -- vulnerable to opponent threats"
      );
    }
  }

  // Mulligan penalty
  if (mulliganNumber > 0) {
    reasoning.push(
      `Mulligan ${mulliganNumber} -- starting with ${7 - mulliganNumber} cards`
    );
  }

  // Commander awareness reasoning (appended at end)
  if (commanderAdjustments && commanderAdjustments.length > 0) {
    for (const adj of commanderAdjustments) {
      reasoning.push(adj);
    }
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
  iterations = 1000,
  commandZone: HandCard[] = [],
  context?: HandEvaluationContext
): SimulationStats {

  // Pre-compute card cache if context is provided but cache is missing
  let effectiveContext = context;
  if (context && !context.cardCache) {
    effectiveContext = {
      ...context,
      cardCache: buildCardCache(pool),
    };
  }

  const verdictDistribution: Record<Verdict, number> = {
    "Strong Keep": 0,
    Keepable: 0,
    Marginal: 0,
    Mulligan: 0,
  };

  let totalLands = 0;
  let totalScore = 0;
  let totalStrategyScore = 0;
  let t1Plays = 0;
  let t2Plays = 0;
  let t3Plays = 0;

  for (let i = 0; i < iterations; i++) {
    const hand = drawHand(pool, 7);
    const quality = evaluateHandQuality(
      hand,
      0,
      commanderIdentity,
      commandZone,
      effectiveContext
    );

    verdictDistribution[quality.verdict]++;
    totalScore += quality.score;
    totalLands += quality.factors.landCount;
    if (quality.factors.strategyScore !== undefined) {
      totalStrategyScore += quality.factors.strategyScore;
    }

    if (quality.factors.playableTurns[0]) t1Plays++;
    if (quality.factors.playableTurns[1]) t2Plays++;
    if (quality.factors.playableTurns[2]) t3Plays++;
  }

  const keepable =
    verdictDistribution["Strong Keep"] + verdictDistribution["Keepable"];

  const stats: SimulationStats = {
    totalSimulations: iterations,
    keepableRate: iterations > 0 ? keepable / iterations : 0,
    avgLandsInOpener: iterations > 0 ? totalLands / iterations : 0,
    avgScore: iterations > 0 ? Math.round(totalScore / iterations) : 0,
    probT1Play: iterations > 0 ? t1Plays / iterations : 0,
    probT2Play: iterations > 0 ? t2Plays / iterations : 0,
    probT3Play: iterations > 0 ? t3Plays / iterations : 0,
    verdictDistribution,
  };

  if (effectiveContext) {
    stats.avgStrategyScore =
      iterations > 0 ? Math.round(totalStrategyScore / iterations) : 0;
  }

  return stats;
}

// ---------------------------------------------------------------------------
// findTopHands
// ---------------------------------------------------------------------------

/**
 * Run a Monte Carlo simulation and return the top `topN` unique hands by
 * quality score. Hands are deduplicated by sorting card names alphabetically.
 */
export function findTopHands(
  pool: HandCard[],
  commanderIdentity: Set<MtgColor | string>,
  topN = 5,
  iterations = 2000,
  commandZone: HandCard[] = [],
  context?: HandEvaluationContext
): RankedHand[] {
  if (pool.length === 0) return [];

  // Pre-compute card cache if context is provided but cache is missing
  let effectiveContext = context;
  if (context && !context.cardCache) {
    effectiveContext = {
      ...context,
      cardCache: buildCardCache(pool),
    };
  }

  // Buffer of top hands, sorted ascending by score (worst first for easy eviction)
  const buffer: { hand: DrawnHand; cardKey: string }[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < iterations; i++) {
    const cards = drawHand(pool, 7);
    const quality = evaluateHandQuality(
      cards,
      0,
      commanderIdentity,
      commandZone,
      effectiveContext
    );

    // Dedup key: sorted card names joined
    const cardKey = cards
      .map((c) => c.name)
      .sort()
      .join("|");

    if (seenKeys.has(cardKey)) continue;

    // Check if this hand qualifies for the buffer
    if (buffer.length < topN) {
      buffer.push({ hand: { cards, quality, mulliganNumber: 0 }, cardKey });
      seenKeys.add(cardKey);
      // Keep sorted ascending by score
      buffer.sort((a, b) => a.hand.quality.score - b.hand.quality.score);
    } else if (quality.score > buffer[0].hand.quality.score) {
      // Evict the lowest-scoring hand
      const evicted = buffer.shift()!;
      seenKeys.delete(evicted.cardKey);
      buffer.push({ hand: { cards, quality, mulliganNumber: 0 }, cardKey });
      seenKeys.add(cardKey);
      buffer.sort((a, b) => a.hand.quality.score - b.hand.quality.score);
    }
  }

  // Return sorted descending (best first) with rank
  return buffer
    .sort((a, b) => b.hand.quality.score - a.hand.quality.score)
    .map((entry, idx) => ({
      rank: idx + 1,
      hand: entry.hand,
      cardKey: entry.cardKey,
    }));
}
