/**
 * Condition Parser — Structured predicate extraction.
 *
 * Converts free-form condition predicate text into a structured form
 * so that satisfiability can be evaluated against a deck's composition.
 *
 * Priority order:
 *   1. Devotion checks ("your devotion to [color] is N or more")
 *   2. Graveyard card type checks (delirium)
 *   3. Graveyard size checks (threshold)
 *   4. Life total checks
 *   5. Land subtype checks
 *   6. Creature / artifact / enchantment / permanent count checks
 *   7. Runtime conditions (turn-based, phase-based, combat-based)
 *   8. Unknown fallback
 */

import type { Condition, ConditionCheck } from "./types";

// ─── Number word → integer ───────────────────────────────────────

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
};

function parseNumber(text: string): number | undefined {
  const trimmed = text.trim().toLowerCase();
  if (WORD_NUMBERS[trimmed] !== undefined) return WORD_NUMBERS[trimmed];
  const asInt = parseInt(trimmed, 10);
  if (!isNaN(asInt)) return asInt;
  return undefined;
}

/** Parse a number from a regex match group that could be a word or digit. */
function extractCount(raw: string): number {
  return parseNumber(raw) ?? 1;
}

// ─── Color word → color code ──────────────────────────────────────

const COLOR_WORDS: Record<string, string> = {
  white: "W",
  blue: "U",
  black: "B",
  red: "R",
  green: "G",
  colorless: "C",
};

function parseColors(colorText: string): string[] {
  const colors: string[] = [];
  for (const [word, code] of Object.entries(COLOR_WORDS)) {
    if (colorText.includes(word)) {
      colors.push(code);
    }
  }
  return colors;
}

// ─── Land subtypes (basic + common non-basic) ────────────────────

const LAND_SUBTYPES = new Set([
  "plains",
  "island",
  "swamp",
  "mountain",
  "forest",
  "desert",
  "gate",
  "locus",
  "urza's",
  "sphere",
  "tower",
  "mine",
  "powerplant",
  "lair",
  "scrubland",
  "savannah",
  "taiga",
  "badlands",
  "bayou",
  "tundra",
  "underground sea",
  "tropical island",
  "volcanic island",
  "plateau",
]);

// ─── Main export ─────────────────────────────────────────────────

/**
 * Parse a condition predicate string into a structured representation.
 * Returns undefined if the predicate is empty or unrecognizable — callers
 * can use `check: "unknown"` in that case.
 */
export function parseConditionStructured(
  predicate: string
): Condition["structured"] {
  const text = predicate.toLowerCase().trim();

  if (!text) {
    return { check: "unknown" };
  }

  // ── 1. Devotion: "your devotion to [color(s)] is N or more" ─────
  const devotionMatch = text.match(
    /your\s+devotion\s+to\s+([\w\s,]+?)\s+is\s+([\w]+)\s+or\s+more/
  );
  if (devotionMatch) {
    const colorText = devotionMatch[1];
    const devotionColors = parseColors(colorText);
    const count = extractCount(devotionMatch[2]);
    return {
      check: "devotion",
      devotionColors: devotionColors.length > 0 ? devotionColors : ["C"],
      count,
      comparison: "greater_equal",
    };
  }

  // ── 2. Graveyard card types (delirium): "N or more card types among cards in your graveyard" ─
  const graveyardTypesMatch = text.match(
    /([\w]+)\s+or\s+more\s+card\s+types?\s+among\s+cards?\s+in\s+your\s+graveyard/
  );
  if (graveyardTypesMatch) {
    const count = extractCount(graveyardTypesMatch[1]);
    return {
      check: "graveyard_card_types",
      count,
      comparison: "greater_equal",
    };
  }

  // ── 3. Graveyard size (threshold): "N or more cards are in your graveyard" / "N or more cards in your graveyard" ─
  const graveyardSizeMatch = text.match(
    /([\w]+)\s+or\s+more\s+cards?\s+(?:are\s+)?in\s+your\s+graveyard/
  );
  if (graveyardSizeMatch) {
    const count = extractCount(graveyardSizeMatch[1]);
    return {
      check: "graveyard_size",
      count,
      comparison: "greater_equal",
    };
  }

  // ── 4. Life total: "you have N or more life" ────────────────────
  const lifeTotalMatch = text.match(
    /you\s+have\s+([\w]+)\s+or\s+more\s+life/
  );
  if (lifeTotalMatch) {
    const count = extractCount(lifeTotalMatch[1]);
    return {
      check: "life_total",
      count,
      comparison: "greater_equal",
    };
  }

  // ── 5. Land subtype: "you control a [land subtype]" ─────────────
  // Must be checked before generic "you control a creature" since some
  // land subtypes (e.g., Forest) overlap with card type checks.
  const landSubtypeMatch = text.match(
    /you\s+control\s+(?:a|an)\s+([\w\s']+?)(?:\s+land)?(?:\b|$)/
  );
  if (landSubtypeMatch) {
    const candidate = landSubtypeMatch[1].trim();
    if (LAND_SUBTYPES.has(candidate)) {
      // Capitalize first letter for display consistency
      const subtypeRequired =
        candidate.charAt(0).toUpperCase() + candidate.slice(1);
      return {
        check: "land_subtype",
        subtypeRequired,
      };
    }
  }

  // ── 6. Type count: "you control N or more [type]s" ──────────────
  // Handle "you control N or more [type]s" with digit or word count
  const typeCountMatch = text.match(
    /you\s+control\s+([\w]+)\s+or\s+more\s+(creatures?|artifacts?|enchantments?|permanents?)/
  );
  if (typeCountMatch) {
    const count = extractCount(typeCountMatch[1]);
    const typeWord = typeCountMatch[2].replace(/s$/, "");
    const check = typeWordToCheck(typeWord);
    return { check, count, comparison: "greater_equal" };
  }

  // Handle "you control a [type]" (count = 1)
  const singleTypeMatch = text.match(
    /you\s+control\s+(?:a|an)\s+(creature|artifact|enchantment|permanent)/
  );
  if (singleTypeMatch) {
    const check = typeWordToCheck(singleTypeMatch[1]);
    return { check, count: 1, comparison: "greater_equal" };
  }

  // ── 7. Runtime conditions ────────────────────────────────────────
  const RUNTIME_PATTERNS = [
    /\bthis\s+turn\b/,
    /\blast\s+turn\b/,
    /\byour\s+turn\b/,
    /\bit'?s?\s+(?:not\s+)?your\s+turn/,
    /\bduring\s+(?:your|their|each)\s+(?:turn|upkeep|combat|main\s+phase)\b/,
    /\bon\s+(?:your\s+turn|each\s+turn)\b/,
    /\b(?:a\s+)?(?:creature|player|opponent)\s+(?:died|attacked|was\s+dealt\s+damage|cast)\b/,
    /\bphase\b/,
    /\buntap\s+step\b/,
    /\bcombat\b/,
    /\bbeginning\s+of\b/,
    /\bend\s+step\b/,
  ];

  for (const pattern of RUNTIME_PATTERNS) {
    if (pattern.test(text)) {
      return { check: "runtime" };
    }
  }

  // ── 8. Unknown fallback ──────────────────────────────────────────
  return { check: "unknown" };
}

function typeWordToCheck(typeWord: string): ConditionCheck {
  switch (typeWord) {
    case "creature":
      return "creature_count";
    case "artifact":
      return "artifact_count";
    case "enchantment":
      return "enchantment_count";
    case "permanent":
      return "permanent_count";
    default:
      return "unknown";
  }
}
