import type { ManaPips } from "./types";

const COLORED_PIP = /\{([WUBRGC])(?:\/[PH])?\}/g;
const HYBRID_PIP = /\{([WUBRG])\/([WUBRG])\}/g;

/**
 * Parses a Scryfall mana cost string and returns counts of each colored pip.
 * Generic mana ({0}, {1}, {X}, etc.) is ignored — only colored pips are counted.
 * Hybrid mana like {W/U} counts toward both colors.
 * Phyrexian mana like {B/P} counts toward the color.
 */
export function parseManaPips(manaCost: string): ManaPips {
  const pips: ManaPips = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

  if (!manaCost) return pips;

  // Count hybrid pips first (both colors)
  for (const match of manaCost.matchAll(HYBRID_PIP)) {
    const c1 = match[1] as keyof ManaPips;
    const c2 = match[2] as keyof ManaPips;
    pips[c1]++;
    pips[c2]++;
  }

  // Count single-color pips (skip hybrids already counted)
  for (const match of manaCost.matchAll(COLORED_PIP)) {
    const symbol = match[0];
    // Skip hybrid pips — they were already counted above
    if (/\{[WUBRG]\/[WUBRG]\}/.test(symbol)) continue;
    const color = match[1] as keyof ManaPips;
    pips[color]++;
  }

  return pips;
}

const SUPERTYPES = new Set([
  "Legendary",
  "Basic",
  "Snow",
  "World",
  "Ongoing",
  "Host",
]);

const CARD_TYPES = new Set([
  "Creature",
  "Artifact",
  "Enchantment",
  "Land",
  "Instant",
  "Sorcery",
  "Planeswalker",
  "Battle",
  "Kindred",
]);

/**
 * Parses a Scryfall type_line string into supertypes, card type, and subtypes.
 * Type line format: "[Supertypes] <Card Type(s)> [— Subtypes]"
 */
export function parseTypeLine(typeLine: string): {
  supertypes: string[];
  cardType: string;
  subtypes: string[];
} {
  // Handle DFC type lines — only parse the front face
  const frontFace = typeLine.split(" // ")[0];

  // Split on em dash to separate types from subtypes
  const [typesPart, subtypesPart] = frontFace.split(" — ");

  const words = typesPart.trim().split(/\s+/);
  const supertypes: string[] = [];
  const cardTypeParts: string[] = [];

  for (const word of words) {
    if (SUPERTYPES.has(word)) {
      supertypes.push(word);
    } else {
      cardTypeParts.push(word);
    }
  }

  const subtypes = subtypesPart
    ? subtypesPart.trim().split(/\s+/)
    : [];

  return {
    supertypes,
    cardType: cardTypeParts.join(" "),
    subtypes,
  };
}
