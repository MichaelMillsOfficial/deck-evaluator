import type { DeckData, EnrichedCard } from "@/lib/types";

export const BASIC_LAND_NAMES = new Set([
  "Plains",
  "Island",
  "Swamp",
  "Mountain",
  "Forest",
  "Wastes",
  "Snow-Covered Plains",
  "Snow-Covered Island",
  "Snow-Covered Swamp",
  "Snow-Covered Mountain",
  "Snow-Covered Forest",
]);

export interface ValidationError {
  message: string;
  cards?: string[];
}

export interface CommanderValidationResult {
  hasCommander: boolean;
  isValid: boolean;
  errors: ValidationError[];
  commanderNames: string[];
}

/**
 * Check if a card is exempt from the singleton rule.
 */
export function isSingletonExempt(
  cardName: string,
  cardMap: Record<string, EnrichedCard>,
  gameChangerNames: Set<string>
): boolean {
  if (BASIC_LAND_NAMES.has(cardName)) return true;
  if (gameChangerNames.has(cardName)) return true;
  return false;
}

/**
 * Get the maximum allowed quantity for a card in Commander.
 * Returns Infinity for basic lands and most game changers,
 * 7 for Seven Dwarves, 1 for everything else.
 */
export function getMaxQuantity(
  cardName: string,
  cardMap: Record<string, EnrichedCard>,
  gameChangerNames: Set<string>
): number {
  if (BASIC_LAND_NAMES.has(cardName)) return Infinity;
  if (gameChangerNames.has(cardName)) {
    // Check for Seven Dwarves limit
    const enriched = cardMap[cardName];
    if (
      enriched?.oracleText &&
      /a deck can have up to seven cards named/i.test(enriched.oracleText)
    ) {
      return 7;
    }
    return Infinity;
  }
  return 1;
}

/**
 * Validate a deck against Commander format rules.
 */
export function validateCommanderDeck(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  bannedSet: Set<string>,
  gameChangerNames: Set<string>
): CommanderValidationResult {
  const errors: ValidationError[] = [];
  const commanderNames = deck.commanders.map((c) => c.name);
  const hasCommander = deck.commanders.length > 0;

  if (!hasCommander) {
    errors.push({ message: "No commander detected in this deck." });
    return { hasCommander, isValid: false, errors, commanderNames };
  }

  // Total card count (commanders + mainboard)
  const allCards = [...deck.commanders, ...deck.mainboard];
  const totalCount = allCards.reduce((sum, c) => sum + c.quantity, 0);
  if (totalCount !== 100) {
    errors.push({
      message: `Deck has ${totalCount} cards — Commander requires exactly 100.`,
    });
  }

  // Singleton violations
  const duplicates: string[] = [];
  for (const card of allCards) {
    const max = getMaxQuantity(card.name, cardMap, gameChangerNames);
    if (card.quantity > max) {
      duplicates.push(card.name);
    }
  }
  if (duplicates.length > 0) {
    errors.push({
      message: `Singleton violation — these cards exceed the allowed quantity:`,
      cards: duplicates,
    });
  }

  // Banned cards
  const bannedFound: string[] = [];
  for (const card of allCards) {
    if (bannedSet.has(card.name)) {
      bannedFound.push(card.name);
    }
  }
  if (bannedFound.length > 0) {
    errors.push({
      message: `Banned in Commander:`,
      cards: bannedFound,
    });
  }

  return {
    hasCommander,
    isValid: errors.length === 0,
    errors,
    commanderNames,
  };
}

/**
 * Build an EDHREC URL for the given commander name(s).
 */
export function buildEdhrecUrl(commanderNames: string[]): string {
  const slug = commanderNames
    .map((name) =>
      name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
    )
    .join("-");
  return `https://edhrec.com/commanders/${slug}`;
}
