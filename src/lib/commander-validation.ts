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
  _cardMap: Record<string, EnrichedCard>,
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

const PLAIN_PARTNER_RE = /\bPartner\b(?!\s+with)/;
const FRIENDS_FOREVER_RE = /\bFriends forever\b/i;
const DOCTORS_COMPANION_RE = /Doctor(?:'|’)s companion/i;
const CHOOSE_BACKGROUND_RE = /\bChoose a Background\b/i;
const BACKGROUND_TYPE_RE = /\bBackground\b/;
const TIME_LORD_DOCTOR_RE = /\bTime Lord\b.*\bDoctor\b/;

/**
 * Whether two cards form a rules-legal two-commander pairing: both have plain
 * Partner, they mutually "Partner with" each other, both have Friends Forever,
 * a Time Lord Doctor pairs with a Doctor's companion, or a "Choose a
 * Background" commander pairs with a Background enchantment.
 */
export function canPairCommanders(a: EnrichedCard, b: EnrichedCard): boolean {
  if (PLAIN_PARTNER_RE.test(a.oracleText) && PLAIN_PARTNER_RE.test(b.oracleText)) {
    return true;
  }
  if (
    a.oracleText.includes(`Partner with ${b.name}`) &&
    b.oracleText.includes(`Partner with ${a.name}`)
  ) {
    return true;
  }
  if (FRIENDS_FOREVER_RE.test(a.oracleText) && FRIENDS_FOREVER_RE.test(b.oracleText)) {
    return true;
  }
  const pairsOneWay = (x: EnrichedCard, y: EnrichedCard): boolean =>
    (CHOOSE_BACKGROUND_RE.test(x.oracleText) && BACKGROUND_TYPE_RE.test(y.typeLine)) ||
    (TIME_LORD_DOCTOR_RE.test(x.typeLine) && DOCTORS_COMPANION_RE.test(y.oracleText));
  return pairsOneWay(a, b) || pairsOneWay(b, a);
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

  if (deck.commanders.length === 2) {
    const [first, second] = commanderNames.map((name) => cardMap[name]);
    if (first && second && !canPairCommanders(first, second)) {
      errors.push({
        message: `${commanderNames[0]} and ${commanderNames[1]} cannot be paired — two commanders need Partner, "Partner with" each other, Friends Forever, a Doctor's companion, or a Background pairing.`,
        cards: commanderNames,
      });
    }
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
 * Check if a card is a legal commander.
 * Must be Legendary and one of: Creature, Planeswalker, Vehicle, or Spacecraft,
 * or have "can be your commander" in oracle text.
 *
 * As of July 2025 (Edge of Eternities), legendary Vehicles and Spacecraft
 * with a power/toughness box are eligible to be commanders.
 */
export function isLegalCommander(card: EnrichedCard): boolean {
  if (/can be your commander/i.test(card.oracleText)) return true;
  if (!card.supertypes.includes("Legendary")) return false;
  return /\bCreature\b/.test(card.typeLine)
    || /\bPlaneswalker\b/.test(card.typeLine)
    || /\bVehicle\b/.test(card.typeLine)
    || /\bSpacecraft\b/.test(card.typeLine);
}

/**
 * Validate that chosen commander names are acceptable selections.
 * Checks: max 2 commanders. Commanders don't need to be in the decklist
 * since the parser will add them automatically.
 */
export function validateCommanderSelection(
  names: string[],
  _deckCardNames: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (names.length === 0) return { valid: true, errors };

  if (names.length > 2) {
    errors.push("A deck can have at most 2 commanders.");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Post-enrichment check: warn if selected commanders aren't legal commanders.
 * Returns warnings (not hard errors) so unknown/new cards can still pass.
 */
export function validateCommanderLegality(
  names: string[],
  cardMap: Record<string, EnrichedCard>
): { warnings: string[] } {
  const warnings: string[] = [];

  for (const name of names) {
    const card = cardMap[name];
    if (!card) {
      warnings.push(`Could not verify "${name}" as a legal commander (card data not found).`);
      continue;
    }
    if (!isLegalCommander(card)) {
      warnings.push(`"${name}" may not be a legal commander — it is not a Legendary Creature, Planeswalker, Vehicle, or Spacecraft.`);
    }
  }

  return { warnings };
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
