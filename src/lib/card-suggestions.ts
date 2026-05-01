/**
 * Card Swap Suggestions
 *
 * Pure computation functions for identifying weak cards, selecting upgrade
 * candidates, and building Scryfall search queries for category fills.
 *
 * Pattern: (deck, cardMap, ...) => Result
 */

import type { DeckData, EnrichedCard, CardSynergyScore, DeckTheme } from "./types";
import type { CompositionScorecardResult, CategoryResult } from "./deck-composition";
import { generateTags } from "./card-tags";
import { findCombosInDeck } from "./known-combos";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const WEAK_CARD_THRESHOLD = 35;
export const MAX_WEAK_CARDS = 10;
export const UPGRADE_SCORE_MIN = 35;
export const UPGRADE_SCORE_MAX = 55;
export const MAX_UPGRADE_CANDIDATES = 8;
export const MAX_QUERY_EXCLUSIONS = 20;
export const THEME_STRENGTH_THRESHOLD = 30;
export const AXIS_RELEVANCE_THRESHOLD = 0.5;
export const RESULTS_PER_CATEGORY = 5;
export const RESULTS_PER_UPGRADE = 3;
export const SEARCH_DELAY_MS = 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardSuggestion {
  cardName: string;
  reason: string;
  category: string;
  scryfallUri: string;
  imageUri: string | null;
  manaCost: string;
  cmc: number;
  typeLine: string;
}

export interface CategoryFillRecommendation {
  tag: string;
  label: string;
  status: "low" | "critical";
  currentCount: number;
  targetMin: number;
  gap: number;
  suggestions: CardSuggestion[];
}

export interface WeakCard {
  cardName: string;
  synergyScore: number;
  tags: string[];
  reason: string;
}

export interface UpgradeCandidate {
  cardName: string;
  score: number;
  cmc: number;
  tags: string[];
}

export interface UpgradeSuggestion {
  existingCard: string;
  existingCmc: number;
  existingTags: string[];
  upgrades: CardSuggestion[];
}

export interface SwapSuggestionsResult {
  categoryFills: CategoryFillRecommendation[];
  weakCards: WeakCard[];
  upgrades: UpgradeSuggestion[];
}

export interface GapDescriptor {
  tag: string;
  label: string;
  status: "low" | "critical";
  currentCount: number;
  targetMin: number;
  gap: number;
}

export interface SuggestionsApiRequest {
  gaps: GapDescriptor[];
  colorIdentity: string[];
  deckCardNames: string[];
  upgradeCandidates: UpgradeCandidate[];
}

export interface UpgradeContext {
  deckThemes: DeckTheme[];
}

export interface LandSwapCandidate {
  cardName: string;
  synergyScore: number;
  tags: string[];
}

export interface LandSwapRecommendation {
  currentCount: number;
  targetMin: number;
  gap: number;
  status: "low" | "critical";
  candidates: LandSwapCandidate[];
}

export interface SuggestionsApiResponse {
  categoryFills: CategoryFillRecommendation[];
  upgrades: UpgradeSuggestion[];
  error?: string;
}

// ---------------------------------------------------------------------------
// TAG_TO_SCRYFALL_QUERY
//
// Allowlisted query fragments per functional tag. Using allowlisted fragments
// prevents arbitrary data injection into Scryfall queries.
// ---------------------------------------------------------------------------

export const TAG_TO_SCRYFALL_QUERY: Record<string, string> = {
  // Ramp: mana rocks + land search + mana dorks + land auras + extra land drops
  Ramp: '(o:"add {" or o:"search your library for" o:"land" or o:"additional land" or o:"tap for mana") -t:land',

  // Card Draw: explicit draw effects
  "Card Draw": '(o:"draw" o:"card")',

  // Removal: destroy/exile targeting opponents' permanents
  Removal: '(o:"destroy target" or o:"exile target" or o:"return target" o:"hand")',

  // Board Wipe: destroy or exile all (mass removal)
  "Board Wipe": '(o:"destroy all" or o:"exile all" or o:"all creatures get -")',

  // Counterspell: counter target spell
  Counterspell: '(o:"counter target spell" or o:"counter target" t:instant)',

  // Tutor: library search
  Tutor: '(o:"search your library" not o:"land")',

  // Cost Reduction: spells cost less
  "Cost Reduction": '(o:"costs" o:"less" or o:"cost {0}")',

  // Protection: hexproof, indestructible, ward, phase out, totem armor, flicker
  Protection: '(o:hexproof or o:indestructible or o:ward or o:"phase out" or o:"totem armor" or o:"exile" o:"return" o:"battlefield")',

  // Recursion: return from graveyard
  Recursion: '(o:"return" o:"graveyard" or o:"cast" o:"graveyard")',

  // Token Generator: create tokens
  "Token Generator": '(o:"create" o:"token")',

  // Token Multiplier: doublers (Anointed Procession, Parallel Lives, etc.)
  "Token Multiplier": '(o:"twice that many" o:"tokens")',

  // Mana Reduction: pay life rather than mana (Defiler cycle)
  "Mana Reduction": '(o:"pay" o:"life" o:"costs" o:"less")',

  // Sacrifice Outlet: sacrifice effects
  "Sacrifice Outlet": '(o:"sacrifice" o:":" or o:"sacrifice a")',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isLand(typeLine: string): boolean {
  return /\bLand\b/.test(typeLine);
}

function getAllDeckCardNames(deck: DeckData): string[] {
  const names: string[] = [];
  for (const section of [deck.commanders, deck.mainboard, deck.sideboard]) {
    for (const card of section) {
      names.push(card.name);
    }
  }
  return names;
}

function getCommanderNames(deck: DeckData): Set<string> {
  return new Set(deck.commanders.map((c) => c.name));
}

/**
 * Build a set of card names that are sole providers of any low/critical
 * category in the scorecard. These cards are protected from weak flagging.
 */
function buildSoleProviderSet(
  scorecard: CompositionScorecardResult
): Set<string> {
  const protected_ = new Set<string>();

  for (const category of scorecard.categories) {
    if (category.status !== "low" && category.status !== "critical") continue;
    if (category.tag === "Lands") continue;

    // If only one distinct card name provides this category, it is protected
    const uniqueNames = new Set(category.cards.map((c) => c.name));
    if (uniqueNames.size === 1) {
      for (const name of uniqueNames) {
        protected_.add(name);
      }
    }
  }

  return protected_;
}

// ---------------------------------------------------------------------------
// identifyWeakCards
// ---------------------------------------------------------------------------

/**
 * Identifies cards with low synergy scores that are not sole providers of
 * any low/critical category, not combo pieces, not commanders, and not lands.
 *
 * Returns weak cards sorted by score ascending, capped at MAX_WEAK_CARDS.
 */
export function identifyWeakCards(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  cardScores: Record<string, CardSynergyScore>,
  scorecard: CompositionScorecardResult
): WeakCard[] {
  const commanderNames = getCommanderNames(deck);
  const allCardNames = getAllDeckCardNames(deck);
  const comboCardNames = new Set(
    findCombosInDeck(allCardNames).flatMap((c) => c.cards)
  );
  const soleProviders = buildSoleProviderSet(scorecard);

  const weak: WeakCard[] = [];

  for (const section of [deck.mainboard, deck.sideboard]) {
    for (const deckCard of section) {
      const { name } = deckCard;

      // Skip if no enrichment data
      const enriched = cardMap[name];
      if (!enriched) continue;

      // Skip if no score data
      const scoreData = cardScores[name];
      if (!scoreData) continue;

      // Skip lands
      if (isLand(enriched.typeLine)) continue;

      // Skip commanders (commanders are in deck.commanders, mainboard check is
      // defensive but commanders can appear in both in some imports)
      if (commanderNames.has(name)) continue;

      // Skip combo pieces
      if (comboCardNames.has(name)) continue;

      // Skip sole providers of any low/critical category
      if (soleProviders.has(name)) continue;

      // Check threshold
      if (scoreData.score >= WEAK_CARD_THRESHOLD) continue;

      const tags = generateTags(enriched);
      weak.push({
        cardName: name,
        synergyScore: scoreData.score,
        tags,
        reason: buildWeakCardReason(scoreData.score, tags),
      });
    }
  }

  // Sort by score ascending (lowest performing first), cap at MAX_WEAK_CARDS
  return weak
    .sort((a, b) => a.synergyScore - b.synergyScore)
    .slice(0, MAX_WEAK_CARDS);
}

function buildWeakCardReason(score: number, tags: string[]): string {
  if (tags.length === 0) {
    return `Low synergy (score: ${score}) and no recognized functional role`;
  }
  return `Low synergy (score: ${score}) — consider swapping for a stronger option`;
}

// ---------------------------------------------------------------------------
// buildScryfallSearchQuery
// ---------------------------------------------------------------------------

/**
 * Builds a Scryfall search query string for a given functional tag and
 * color identity. Returns empty string if the tag is not in the allowlist.
 *
 * @param tag - Functional tag (must exist in TAG_TO_SCRYFALL_QUERY)
 * @param colorIdentity - Array of MTG color letters (e.g. ["B","U","G"])
 * @param excludeNames - Card names already in the deck to exclude
 */
export function buildScryfallSearchQuery(
  tag: string,
  colorIdentity: string[],
  excludeNames: string[]
): string {
  const fragment = TAG_TO_SCRYFALL_QUERY[tag];
  if (!fragment) return "";

  // Color identity filter: colorless if empty
  const colorStr =
    colorIdentity.length > 0
      ? colorIdentity.join("").toUpperCase()
      : "C";
  const colorFilter = `id<=${colorStr}`;

  // Exclusions capped at MAX_QUERY_EXCLUSIONS
  const capped = excludeNames.slice(0, MAX_QUERY_EXCLUSIONS);
  const exclusions = capped
    .map((name) => `-!"${name.replace(/"/g, "")}"`)
    .join(" ");

  const parts = [fragment, colorFilter];
  if (exclusions) parts.push(exclusions);
  parts.push("format:commander");

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// selectUpgradeCandidates
// ---------------------------------------------------------------------------

/**
 * Selects cards with moderate synergy scores (35-55) that have at least one
 * functional tag and are not commanders or lands. Sorted by score ascending,
 * capped at MAX_UPGRADE_CANDIDATES.
 */
export function selectUpgradeCandidates(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  cardScores: Record<string, CardSynergyScore>,
  context?: UpgradeContext
): UpgradeCandidate[] {
  const commanderNames = getCommanderNames(deck);

  // Build set of strong theme axis IDs for context-aware filtering
  const strongThemeAxes = new Set<string>();
  if (context) {
    for (const theme of context.deckThemes) {
      if (theme.strength >= THEME_STRENGTH_THRESHOLD) {
        strongThemeAxes.add(theme.axisId);
      }
    }
  }

  const candidates: UpgradeCandidate[] = [];

  for (const section of [deck.mainboard, deck.sideboard]) {
    for (const deckCard of section) {
      const { name } = deckCard;

      const enriched = cardMap[name];
      if (!enriched) continue;

      const scoreData = cardScores[name];
      if (!scoreData) continue;

      // Skip commanders and lands
      if (commanderNames.has(name)) continue;
      if (isLand(enriched.typeLine)) continue;

      // Must be in upgrade score range
      if (
        scoreData.score < UPGRADE_SCORE_MIN ||
        scoreData.score > UPGRADE_SCORE_MAX
      )
        continue;

      // Must have at least one functional tag
      const tags = generateTags(enriched);
      if (tags.length === 0) continue;

      // Skip cards highly relevant to a strong deck theme
      if (strongThemeAxes.size > 0) {
        const isThemeRelevant = scoreData.axes.some(
          (axis) =>
            axis.relevance > AXIS_RELEVANCE_THRESHOLD &&
            strongThemeAxes.has(axis.axisId)
        );
        if (isThemeRelevant) continue;
      }

      candidates.push({
        cardName: name,
        score: scoreData.score,
        cmc: enriched.cmc,
        tags,
      });
    }
  }

  return candidates
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_UPGRADE_CANDIDATES);
}

// ---------------------------------------------------------------------------
// deriveGapsFromScorecard
// ---------------------------------------------------------------------------

function isLowOrCritical(
  cat: CategoryResult
): cat is CategoryResult & { status: "low" | "critical" } {
  return cat.status === "low" || cat.status === "critical";
}

/**
 * Filters scorecard categories to only those with "low" or "critical" status,
 * excluding the "Lands" tag. Returns GapDescriptor array.
 */
export function deriveGapsFromScorecard(
  scorecard: CompositionScorecardResult
): GapDescriptor[] {
  return scorecard.categories
    .filter(
      (cat: CategoryResult): cat is CategoryResult & { status: "low" | "critical" } =>
        isLowOrCritical(cat) && cat.tag !== "Lands"
    )
    .map((cat) => ({
      tag: cat.tag,
      label: cat.label,
      status: cat.status,
      currentCount: cat.count,
      targetMin: cat.min,
      gap: cat.min - cat.count,
    }));
}

// ---------------------------------------------------------------------------
// identifyLandSwapCandidates
// ---------------------------------------------------------------------------

/**
 * When the deck is short on lands (Lands category is "low" or "critical"),
 * identifies the weakest non-land, non-commander cards that could be cut
 * to make room for more lands. Returns null if lands are adequate.
 *
 * Candidates are sorted by synergy score ascending (weakest first) and
 * capped at the land gap count (targetMin - currentCount).
 */
export function identifyLandSwapCandidates(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  cardScores: Record<string, CardSynergyScore>,
  scorecard: CompositionScorecardResult
): LandSwapRecommendation | null {
  // Find the Lands category
  const landsCategory = scorecard.categories.find(
    (cat) => cat.tag === "Lands"
  );
  if (!landsCategory) return null;
  if (!isLowOrCritical(landsCategory)) return null;

  const gap = landsCategory.min - landsCategory.count;
  if (gap <= 0) return null;

  const commanderNames = getCommanderNames(deck);
  const allCardNames = getAllDeckCardNames(deck);
  const comboCardNames = new Set(
    findCombosInDeck(allCardNames).flatMap((c) => c.cards)
  );

  const candidates: LandSwapCandidate[] = [];

  for (const section of [deck.mainboard, deck.sideboard]) {
    for (const deckCard of section) {
      const { name } = deckCard;

      const enriched = cardMap[name];
      if (!enriched) continue;

      const scoreData = cardScores[name];
      if (!scoreData) continue;

      // Skip lands, commanders, combo pieces
      if (isLand(enriched.typeLine)) continue;
      if (commanderNames.has(name)) continue;
      if (comboCardNames.has(name)) continue;

      candidates.push({
        cardName: name,
        synergyScore: scoreData.score,
        tags: generateTags(enriched),
      });
    }
  }

  // Sort weakest first, cap at the gap
  candidates.sort((a, b) => a.synergyScore - b.synergyScore);

  return {
    currentCount: landsCategory.count,
    targetMin: landsCategory.min,
    gap,
    status: landsCategory.status,
    candidates: candidates.slice(0, gap),
  };
}
