import type { EnrichedCard } from "./types";

/** Land subtypes to exclude from creature type analysis */
const LAND_SUBTYPES = new Set([
  "Plains",
  "Island",
  "Swamp",
  "Mountain",
  "Forest",
  "Cave",
  "Desert",
  "Gate",
  "Lair",
  "Locus",
  "Mine",
  "Power-Plant",
  "Tower",
  "Sphere",
  "Urza's",
]);

/**
 * Common MTG creature types used for tribal detection.
 * Comprehensive list covering all major tribes seen in Commander.
 */
export const COMMON_CREATURE_TYPES = new Set([
  // Humanoid races
  "Human",
  "Elf",
  "Goblin",
  "Dwarf",
  "Orc",
  "Halfling",
  "Gnome",
  "Faerie",
  "Merfolk",
  "Vedalken",
  "Kor",
  "Kithkin",

  // Undead & horror
  "Zombie",
  "Vampire",
  "Skeleton",
  "Spirit",
  "Specter",
  "Wraith",
  "Shade",
  "Horror",
  "Nightmare",
  "Demon",

  // Angels & divine
  "Angel",
  "Archon",
  "Avatar",
  "God",
  "Cleric",

  // Classic fantasy
  "Dragon",
  "Dinosaur",
  "Beast",
  "Elemental",
  "Giant",
  "Treefolk",
  "Hydra",
  "Wurm",
  "Drake",
  "Phoenix",
  "Griffin",
  "Sphinx",

  // Military / class
  "Warrior",
  "Soldier",
  "Knight",
  "Rogue",
  "Wizard",
  "Druid",
  "Shaman",
  "Monk",
  "Berserker",
  "Samurai",
  "Ninja",
  "Pirate",
  "Assassin",
  "Archer",
  "Barbarian",
  "Ranger",
  "Pilot",
  "Noble",
  "Peasant",
  "Scout",
  "Artificer",
  "Warlock",

  // Animal / beast
  "Cat",
  "Dog",
  "Wolf",
  "Bear",
  "Bird",
  "Snake",
  "Rat",
  "Bat",
  "Spider",
  "Insect",
  "Ape",
  "Squirrel",
  "Fish",
  "Frog",
  "Lizard",
  "Turtle",
  "Ox",
  "Boar",
  "Horse",

  // Iconic / unique
  "Sliver",
  "Ally",
  "Eldrazi",
  "Phyrexian",
  "Shapeshifter",
  "Changeling",
  "Golem",
  "Construct",
  "Myr",
  "Thopter",
  "Servo",
  "Scarecrow",
  "Troll",
  "Ogre",
  "Minotaur",
  "Centaur",
  "Satyr",
  "Naga",
  "Viashino",
  "Leonin",
  "Loxodon",
  "Rhino",
  "Werewolf",
  "Fungus",
  "Saproling",
  "Plant",
  "Advisor",
  "Tyranid",
]);

/** Sorted type names (longest first) for regex alternation — avoids partial matches */
const TYPE_NAMES = Array.from(COMMON_CREATURE_TYPES).sort((a, b) => b.length - a.length);

/**
 * Pre-built regex alternation string of all common creature type names.
 * Sorted longest-first to prevent partial matches (e.g. "Shapeshifter" before "Shape").
 * Use in `new RegExp(...)` when building creature-type-aware patterns.
 */
export const CREATURE_TYPE_PATTERN = TYPE_NAMES.join("|");

/**
 * Matches type names that appear in tribal oracle text contexts:
 * - "Other Elf creatures"
 * - "Whenever a Warrior attacks"
 * - "for each Goblin you control"
 * - "Zombies you control"
 * - "Elf you control"
 * - "non-Zombie creatures"
 */
const TYPE_CONTEXT_RE = new RegExp(
  `\\b(?:${CREATURE_TYPE_PATTERN})s?\\b(?=\\s+(?:creature|you control|get |enter|attack|deal|die|token|spell|card))`,
  "gi"
);

/** "non-TYPE creatures" pattern for asymmetric wipes */
export const NON_TYPE_RE = new RegExp(
  `\\bnon-(?:${CREATURE_TYPE_PATTERN})\\b`,
  "gi"
);

/** "for each TYPE" or "number of TYPEs" pattern */
const FOR_EACH_TYPE_RE = new RegExp(
  `\\b(?:for each|number of)\\s+(?:${CREATURE_TYPE_PATTERN})s?\\b`,
  "gi"
);

/** "Whenever a/an TYPE" trigger pattern */
const TYPE_TRIGGER_RE = new RegExp(
  `\\bwhenever (?:a |an )(?:${CREATURE_TYPE_PATTERN})\\b`,
  "gi"
);

/** Check if a card has the Changeling keyword (all creature types) */
export function isChangeling(card: EnrichedCard): boolean {
  return card.keywords.includes("Changeling");
}

/** Get creature subtypes from a card, filtering out land subtypes */
export function getCreatureSubtypes(card: EnrichedCard): string[] {
  const typeLine = card.typeLine.toLowerCase();
  // Must be a creature (or Kindred with subtypes that are creature types)
  if (!typeLine.includes("creature")) return [];
  return card.subtypes.filter((st) => !LAND_SUBTYPES.has(st));
}

/**
 * Extract creature type names referenced in oracle text.
 * Returns deduplicated array of type names found in tribal contexts.
 */
export function extractReferencedTypes(oracleText: string): string[] {
  const found = new Set<string>();

  for (const re of [TYPE_CONTEXT_RE, NON_TYPE_RE, FOR_EACH_TYPE_RE, TYPE_TRIGGER_RE]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(oracleText)) !== null) {
      // Extract just the type name from the match
      const text = match[0];
      for (const typeName of TYPE_NAMES) {
        if (text.toLowerCase().includes(typeName.toLowerCase())) {
          found.add(typeName);
          break;
        }
      }
    }
  }

  return Array.from(found);
}

/**
 * Compute creature type frequency across a deck.
 * Changelings count toward every type present in the deck.
 */
export function computeCreatureTypeBreakdown(
  cardNames: string[],
  cardMap: Record<string, EnrichedCard>
): Map<string, number> {
  const counts = new Map<string, number>();
  let changelingCount = 0;

  // First pass: count regular creature subtypes
  for (const name of cardNames) {
    const card = cardMap[name];
    if (!card) continue;

    if (isChangeling(card)) {
      changelingCount++;
      continue;
    }

    const subtypes = getCreatureSubtypes(card);
    for (const st of subtypes) {
      counts.set(st, (counts.get(st) ?? 0) + 1);
    }
  }

  // Second pass: add changelings to every type found
  if (changelingCount > 0 && counts.size > 0) {
    for (const [type, count] of counts) {
      counts.set(type, count + changelingCount);
    }
  }

  return counts;
}

/**
 * Extract commander creature subtypes and oracle-referenced types as separate sets.
 * Used by boostTribalScores to apply tiered boost rates.
 */
export function getCommanderTypes(commanders: EnrichedCard[]): {
  subtypes: Set<string>;
  oracleTypes: Set<string>;
} {
  const subtypes = new Set<string>();
  const oracleTypes = new Set<string>();

  for (const commander of commanders) {
    for (const st of getCreatureSubtypes(commander)) {
      subtypes.add(st);
    }
    for (const type of extractReferencedTypes(commander.oracleText)) {
      oracleTypes.add(type);
    }
  }

  return { subtypes, oracleTypes };
}

/**
 * Identify the tribal anchor types for a deck.
 * Anchors are types the deck is strategically built around, determined by:
 * 1. Commander creature subtypes
 * 2. Types referenced in oracle text of tribal payoff cards
 * 3. Types with high creature density (>= 4 creatures)
 *
 * Returns sorted array of anchor type names (most relevant first).
 */
export function identifyTribalAnchors(
  commanders: EnrichedCard[],
  cardNames: string[],
  cardMap: Record<string, EnrichedCard>
): string[] {
  const anchorScores = new Map<string, number>();

  // Commander subtypes are strong anchors
  for (const commander of commanders) {
    const subtypes = getCreatureSubtypes(commander);
    for (const st of subtypes) {
      anchorScores.set(st, (anchorScores.get(st) ?? 0) + 3);
    }
    // Types referenced in commander oracle text
    const referenced = extractReferencedTypes(commander.oracleText);
    for (const type of referenced) {
      anchorScores.set(type, (anchorScores.get(type) ?? 0) + 4);
    }
  }

  // Types referenced in any card's tribal payoff oracle text
  for (const name of cardNames) {
    const card = cardMap[name];
    if (!card) continue;
    const referenced = extractReferencedTypes(card.oracleText);
    for (const type of referenced) {
      anchorScores.set(type, (anchorScores.get(type) ?? 0) + 2);
    }
  }

  // Creature density bonus
  const breakdown = computeCreatureTypeBreakdown(cardNames, cardMap);
  for (const [type, count] of breakdown) {
    if (count >= 4) {
      anchorScores.set(type, (anchorScores.get(type) ?? 0) + count);
    }
  }

  // Filter to types with meaningful anchor scores
  const anchors = Array.from(anchorScores.entries())
    .filter(([, score]) => score >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);

  return anchors;
}
