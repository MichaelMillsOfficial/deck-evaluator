import type { DeckData, EnrichedCard } from "./types";
import type { PowerLevelResult } from "./power-level";
import type { SpellbookCombo } from "./commander-spellbook";
import { findCombosInDeck, type KnownCombo } from "./known-combos";
import { getTagsCached } from "./card-tags";
import { computeStapleOverlap } from "./cedh-staples";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BracketConstraint {
  type: "game-changer" | "two-card-combo" | "extra-turn" | "mass-land-denial";
  cards: string[];
  minBracket: number;
  explanation: string;
}

export interface DowngradeRecommendation {
  targetBracket: number;
  targetBracketName: string;
  removals: BracketConstraint[];
}

export interface BracketResult {
  bracket: number;
  bracketName: string;
  bracketDescription: string;
  constraints: BracketConstraint[];
  recommendations: DowngradeRecommendation[];
  gameChangerCount: number;
  twoCardComboCount: number;
  extraTurnCount: number;
  hasMassLandDenial: boolean;
  cedhStapleOverlap: number;
  comboSource: "local" | "local+spellbook";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BRACKET_NAMES: Record<number, string> = {
  1: "Exhibition",
  2: "Core",
  3: "Upgraded",
  4: "Optimized",
  5: "cEDH",
};

export const BRACKET_DESCRIPTIONS: Record<number, string> = {
  1: "Casual, low-power decks focused on fun and social play. No Game Changers, combos, or extra turns.",
  2: "Standard Commander experience. No Game Changers or two-card combos. Single extra turn cards permitted.",
  3: "Upgraded decks with Game Changers allowed. No two-card infinite combos or mass land denial.",
  4: "Highly optimized decks. Two-card combos, mass land denial, and heavy Game Changer density permitted.",
  5: "Competitive EDH. Maximum optimization with cEDH staples, fast mana, and win-at-all-costs strategies.",
};

// ---------------------------------------------------------------------------
// Combo Helpers
// ---------------------------------------------------------------------------

/**
 * Find 2-card known combos of restricted types (infinite/lock/wincon).
 * Value-type combos and 3+ card combos are excluded.
 */
export function findRestrictedKnownCombos(
  cardNames: string[]
): KnownCombo[] {
  const allCombos = findCombosInDeck(cardNames);
  return allCombos.filter(
    (c) =>
      c.cards.length === 2 &&
      (c.type === "infinite" || c.type === "lock" || c.type === "wincon")
  );
}

/**
 * Filter Spellbook combos to 2-card exact matches.
 * Returns empty array if input is null.
 */
export function findRestrictedSpellbookCombos(
  spellbookCombos: SpellbookCombo[] | null
): SpellbookCombo[] {
  if (!spellbookCombos) return [];
  return spellbookCombos.filter(
    (c) => c.type === "exact" && c.cards.length === 2
  );
}

/**
 * Merge restricted combos from known-combos and Spellbook, deduplicating
 * by sorted card pair key.
 */
export function mergeRestrictedCombos(
  knownCombos: KnownCombo[],
  spellbookCombos: SpellbookCombo[]
): { cards: string[]; source: string }[] {
  const seen = new Set<string>();
  const merged: { cards: string[]; source: string }[] = [];

  for (const combo of knownCombos) {
    const key = [...combo.cards].sort().join(" + ");
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({ cards: combo.cards, source: "known" });
    }
  }

  for (const combo of spellbookCombos) {
    const key = [...combo.cards].sort().join(" + ");
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({ cards: combo.cards, source: "spellbook" });
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Tag Counting
// ---------------------------------------------------------------------------

function countCardsWithTag(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  tag: string,
  tagCache?: Map<string, string[]>
): { count: number; cards: string[] } {
  const allCards = [
    ...deck.commanders,
    ...deck.mainboard,
    ...deck.sideboard,
  ];

  let count = 0;
  const cards: string[] = [];

  for (const card of allCards) {
    const enriched = cardMap[card.name];
    if (!enriched) continue;
    const tags = getTagsCached(enriched, tagCache);
    if (tags.includes(tag)) {
      count += card.quantity;
      cards.push(card.name);
    }
  }

  return { count, cards };
}

// ---------------------------------------------------------------------------
// Downgrade Recommendations
// ---------------------------------------------------------------------------

/**
 * Compute actionable recommendations for lowering the deck's bracket.
 * For each reachable lower bracket, lists which constraints must be resolved.
 */
export function computeDowngradeRecommendations(
  bracket: number,
  constraints: BracketConstraint[],
  powerLevel: number
): DowngradeRecommendation[] {
  if (bracket <= 1) return [];

  const recommendations: DowngradeRecommendation[] = [];

  // For each lower bracket, find which constraints would need to be removed
  for (let target = bracket - 1; target >= 1; target--) {
    // B1 is only reachable if power level <= 3
    if (target === 1 && powerLevel > 3) continue;

    // Find constraints that would need to be resolved for this target
    const removals = constraints.filter((c) => c.minBracket > target);

    if (removals.length > 0) {
      recommendations.push({
        targetBracket: target,
        targetBracketName: BRACKET_NAMES[target],
        removals,
      });
    }
  }

  return recommendations;
}

// ---------------------------------------------------------------------------
// Main Computation
// ---------------------------------------------------------------------------

/**
 * Compute the bracket estimate for a deck.
 *
 * Uses constraint-based bracket floor logic:
 * - Game Changers → B3+ (1-3) or B4+ (4+)
 * - 2-card combos (infinite/lock/wincon) → B4+
 * - Mass Land Denial → B4+
 * - Extra turns → B2+ (1 card) or B3+ (2+ cards)
 *
 * Then applies soft signals:
 * - B1 vs B2: power level ≤ 3 → B1, else B2
 * - B4 vs B5: PL ≥ 9 + staple overlap > 40% + 2+ infinite/wincon combos → B5
 */
export function computeBracketEstimate(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  powerLevel: PowerLevelResult,
  cedhStaples: Set<string>,
  spellbookCombos: SpellbookCombo[] | null,
  tagCache?: Map<string, string[]>
): BracketResult {
  const constraints: BracketConstraint[] = [];

  // --- Count constraint violations ---

  // Game Changers
  const gameChangers = countCardsWithTag(deck, cardMap, "Game Changer", tagCache);

  // Extra Turns
  const extraTurns = countCardsWithTag(deck, cardMap, "Extra Turn", tagCache);

  // Mass Land Denial
  const mld = countCardsWithTag(deck, cardMap, "Mass Land Denial", tagCache);

  // 2-card combos
  const allCardNames = [
    ...deck.commanders.map((c) => c.name),
    ...deck.mainboard.map((c) => c.name),
    ...deck.sideboard.map((c) => c.name),
  ];
  const knownRestricted = findRestrictedKnownCombos(allCardNames);
  const spellbookRestricted = findRestrictedSpellbookCombos(spellbookCombos);
  const mergedCombos = mergeRestrictedCombos(
    knownRestricted,
    spellbookRestricted
  );

  const comboSource: "local" | "local+spellbook" =
    spellbookCombos !== null ? "local+spellbook" : "local";

  // --- Build constraints ---

  if (gameChangers.count > 0) {
    const minBracket = gameChangers.count > 3 ? 4 : 3;
    constraints.push({
      type: "game-changer",
      cards: gameChangers.cards,
      minBracket,
      explanation:
        gameChangers.count > 3
          ? `${gameChangers.count} Game Changer cards (4+ pushes to Bracket 4)`
          : `${gameChangers.count} Game Changer card${gameChangers.count > 1 ? "s" : ""} (Bracket 3 minimum)`,
    });
  }

  if (mergedCombos.length > 0) {
    const comboCards = [
      ...new Set(mergedCombos.flatMap((c) => c.cards)),
    ];
    constraints.push({
      type: "two-card-combo",
      cards: comboCards,
      minBracket: 4,
      explanation: `${mergedCombos.length} two-card combo${mergedCombos.length > 1 ? "s" : ""} detected (Bracket 4 minimum)`,
    });
  }

  if (extraTurns.count > 0) {
    const minBracket = extraTurns.count >= 2 ? 3 : 2;
    constraints.push({
      type: "extra-turn",
      cards: extraTurns.cards,
      minBracket,
      explanation:
        extraTurns.count >= 2
          ? `${extraTurns.count} extra turn cards (chaining risk, Bracket 3 minimum)`
          : "1 extra turn card (Bracket 2 minimum)",
    });
  }

  if (mld.count > 0) {
    constraints.push({
      type: "mass-land-denial",
      cards: mld.cards,
      minBracket: 4,
      explanation: `${mld.count} mass land denial card${mld.count > 1 ? "s" : ""} (Bracket 4 minimum)`,
    });
  }

  // --- Determine minimum bracket (hard floor) ---

  let minBracket = 1;
  for (const constraint of constraints) {
    if (constraint.minBracket > minBracket) {
      minBracket = constraint.minBracket;
    }
  }

  // --- Apply soft signals ---

  let bracket: number;
  const cedhOverlap = computeStapleOverlap(deck, cardMap, cedhStaples);

  // Count infinite/wincon combos for B5 check
  const infiniteOrWinconCount =
    knownRestricted.filter(
      (c) => c.type === "infinite" || c.type === "wincon"
    ).length + spellbookRestricted.length;

  if (minBracket >= 4) {
    // B4 vs B5
    if (
      powerLevel.powerLevel >= 9 &&
      cedhOverlap > 40 &&
      infiniteOrWinconCount >= 2
    ) {
      bracket = 5;
    } else {
      bracket = 4;
    }
  } else if (minBracket <= 2) {
    // B1 vs B2
    if (powerLevel.powerLevel <= 3) {
      bracket = 1;
    } else {
      bracket = Math.max(2, minBracket);
    }
  } else {
    bracket = minBracket; // 3
  }

  // --- Build recommendations ---

  const recommendations = computeDowngradeRecommendations(
    bracket,
    constraints,
    powerLevel.powerLevel
  );

  return {
    bracket,
    bracketName: BRACKET_NAMES[bracket],
    bracketDescription: BRACKET_DESCRIPTIONS[bracket],
    constraints,
    recommendations,
    gameChangerCount: gameChangers.count,
    twoCardComboCount: mergedCombos.length,
    extraTurnCount: extraTurns.count,
    hasMassLandDenial: mld.count > 0,
    cedhStapleOverlap: cedhOverlap,
    comboSource,
  };
}
