import type { EnrichedCard } from "./types";
import { CONDITIONAL_PATTERNS } from "./land-base-efficiency";
import { CREATURE_TYPE_PATTERN } from "./creature-types";

export const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  Ramp: { bg: "bg-emerald-500/20", text: "text-emerald-300" },
  "Card Draw": { bg: "bg-blue-500/20", text: "text-blue-300" },
  "Card Advantage": { bg: "bg-sky-500/20", text: "text-sky-300" },
  Removal: { bg: "bg-red-500/20", text: "text-red-300" },
  "Board Wipe": { bg: "bg-orange-500/20", text: "text-orange-300" },
  Counterspell: { bg: "bg-cyan-500/20", text: "text-cyan-300" },
  Tutor: { bg: "bg-yellow-500/20", text: "text-yellow-300" },
  "Cost Reduction": { bg: "bg-amber-500/20", text: "text-amber-300" },
  Protection: { bg: "bg-violet-500/20", text: "text-violet-300" },
  Recursion: { bg: "bg-pink-500/20", text: "text-pink-300" },
  "Fetch Land": { bg: "bg-teal-500/20", text: "text-teal-300" },
  "ETB Tapped": { bg: "bg-rose-500/20", text: "text-rose-300" },
  "Conditional ETB": { bg: "bg-stone-500/20", text: "text-stone-300" },
  "Mana Fixing": { bg: "bg-indigo-500/20", text: "text-indigo-300" },
  "Utility Land": { bg: "bg-lime-500/20", text: "text-lime-300" },
  "Basic Types": { bg: "bg-green-500/20", text: "text-green-300" },
  "Mana Accel Land": { bg: "bg-fuchsia-500/20", text: "text-fuchsia-300" },
  "Non-Land Types": { bg: "bg-purple-500/20", text: "text-purple-300" },
  Cycling: { bg: "bg-zinc-500/20", text: "text-zinc-300" },
  "Game Changer": { bg: "bg-red-500/20", text: "text-red-300" },
  "Extra Turn": { bg: "bg-amber-600/20", text: "text-amber-200" },
  "Mass Land Denial": { bg: "bg-orange-600/20", text: "text-orange-200" },
  Lord: { bg: "bg-teal-600/20", text: "text-teal-200" },
  "Tribal Payoff": { bg: "bg-teal-500/20", text: "text-teal-300" },
};

const BASIC_LAND_RE = /^Basic Land/i;
const LAND_TYPE_RE = /\bLand\b/;
const RAMP_TAP_ADD_RE = /\{T\}.*?[Aa]dd\s+\{[WUBRGC]\}/;
const RAMP_MULTI_MANA_RE = /[Aa]dd\s+\{[WUBRGC]\}.*?\{[WUBRGC]\}/;
const RAMP_LAND_SEARCH_RE =
  /[Ss]earche?s?\s+(?:your|their)\s+library\s+for.+?(?:basic\s+)?(?:land|Forest|Plains|Island|Swamp|Mountain)\b/;
const RAMP_ANY_COLOR_RE =
  /\{T\}.*?[Aa]dd\s+(?:one\s+mana\s+of\s+any|mana\s+of\s+any\s+(?:one\s+)?(?:color|type))\b/;
const RAMP_AMOUNT_RE = /\{T\}.*?[Aa]dd\s+(?:an\s+amount\s+of\s+|X\s+)\{[WUBRGC]\}/;
const CARD_DRAW_RE = /\bdraw\b.+?\bcards?\b|\bdraw a card\b/i;
const CARD_ADVANTAGE_RE =
  /\b(?:look at|reveal)\b.+?\bput\b.+?\binto your hand\b/i;
const REMOVAL_TARGET_RE =
  /\b(?:destroy|exile)\s+target\b/i;
const REMOVAL_BOUNCE_RE = /\breturn target.+?to its owner's hand\b/i;
const REMOVAL_DAMAGE_RE = /\bdeals?\s+\d+\s+damage to\b.+?\btarget\b/i;
const BOARD_WIPE_RE =
  /\b(?:destroy|exile)\s+all\b/i;
const BOARD_WIPE_BOUNCE_RE = /\breturn all\b.+?\bto their owners' hands\b/i;
const BOARD_WIPE_MINUS_RE = /\ball creatures get -\d+\/-\d+/i;
const COUNTER_RE = /\bcounter target\b.+?\bspell\b/i;
const TUTOR_RE = /\bsearch your library\b/i;
const TUTOR_LAND_EXCLUSION_RE = /search your library for.+?(?:land|Forest|Plains|Island|Swamp|Mountain)\b/i;
const COST_REDUCTION_RE = /\bcosts?\s+\{\d+\}\s+less\b/i;
const COST_REDUCTION_LESS_RE = /\bcosts?\s+less\s+to\s+cast\b/i;
const PROTECTION_KEYWORDS = new Set([
  "Hexproof",
  "Indestructible",
  "Shroud",
  "Ward",
]);
const PROTECTION_ORACLE_RE =
  /\bgains?\b.+?\b(?:hexproof|indestructible|protection|shroud)\b/i;
const RECURSION_RE = /\breturn\b.+?\bfrom\b.+?\bgraveyard\b/i;

// --- Land tag patterns ---
const ETB_TAPPED_RE = /enters the battlefield tapped|enters tapped/i;
const MANA_FIXING_ANY_COLOR_RE =
  /\bany\s+(?:one\s+)?(?:color|type)\b/i;
const MANA_ACCEL_DOUBLE_RE =
  /\{T\}.*?[Aa]dd\s+\{[WUBRGC]\}\s*\{[WUBRGC]\}/;
const MANA_ACCEL_FOR_EACH_RE = /[Aa]dd\s+\{[WUBRGC]\}\s+for each\b/i;
const MANA_ACCEL_AMOUNT_RE = /[Aa]dd\s+an\s+amount\s+of/i;
const NON_LAND_TYPES_RE = /\b(?:Creature|Enchantment|Artifact|Planeswalker)\b/;
const BASIC_LAND_SUBTYPES = new Set([
  "Plains",
  "Island",
  "Swamp",
  "Mountain",
  "Forest",
]);
const CYCLING_KEYWORDS = new Set(["Cycling", "Basic landcycling"]);
const CYCLING_RE = /\b(?:cycling|basic landcycling)\s+/i;

// --- Bracket-related tag patterns ---
const EXTRA_TURN_RE = /\bextra turn\b/i;
const FULL_MLD_RE = /\bdestroy all\b[^.]*\blands\b/i;
const SACRIFICE_MLD_RE =
  /\beach player\b[^.]*(?:\bsacrifices?\b[^.]*\bland|\bland[^.]*\bsacrifices?\b)/i;
// --- Tribal tag patterns ---
const LORD_TYPE_SPECIFIC_RE = new RegExp(
  `(?:other )?(?:${CREATURE_TYPE_PATTERN})(?:s| creatures?) you control get \\+`,
  "i"
);
const LORD_CHOSEN_TYPE_RE =
  /(?:other )?creatures? you control of the chosen type get \+/i;
const TRIBAL_PAYOFF_KINDRED_RE = /^Kindred\b/i;
const TRIBAL_PAYOFF_CHOOSE_RE = /\bchoose a creature type\b/i;
const TRIBAL_PAYOFF_SHARE_RE = /shares? (?:at least one |a )?creature type/i;
const TRIBAL_PAYOFF_OF_TYPE_RE = /creature (?:spell|card)s? (?:of|you cast of) the chosen type/i;
const TRIBAL_PAYOFF_EVERY_TYPE_RE = /\bevery creature type\b/i;

const RESOURCE_DENIAL_NAMES = new Set([
  "Blood Moon",
  "Back to Basics",
  "Magus of the Moon",
  "Winter Orb",
  "Static Orb",
  "Stasis",
  "Rising Waters",
  "Hokori, Dust Drinker",
  "Tanglewire",
]);

// Patterns to strip when detecting Utility Land —
// basic mana reminder text, ETB tapped boilerplate, tap-for-mana, and card name references
const UTILITY_STRIP_PATTERNS = [
  // Mana ability patterns
  /\(\{T\}: Add \{[WUBRGC]\}(?: or \{[WUBRGC]\})?\.\)/g, // "(T: Add {G}.)" or "(T: Add {G} or {U}.)"
  /\{T\}: Add \{[WUBRGC]\}(?: or \{[WUBRGC]\})?\./g, // "T: Add {G}." or "{T}: Add {G} or {U}."
  /\{T\}: Add one mana of[^.]+\./gi, // "{T}: Add one mana of any color..."
  // Specific conditional ETB patterns (must come BEFORE generic ETB tapped)
  /As \w[\w',\s-]* enters the battlefield, you may pay \d+ life\. If you don't, it enters the battlefield tapped\./gi, // shock land text
  /\w[\w',\s-]* enters the battlefield tapped unless [^.]+\./gi, // check/fast land text
  /\w[\w',\s-]* enters tapped unless [^.]+\./gi, // shorthand ETB tapped unless
  /You may reveal [^.]+ from your hand\. If you don't,[^.]+enters the battlefield tapped\./gi, // reveal lands
  /If you control two or fewer other lands,[^.]+enters the battlefield tapped\./gi, // fast lands
  // Generic ETB tapped (last — so it doesn't consume text needed by specific patterns above)
  /\w[\w',\s-]* enters the battlefield tapped\./gi, // "X enters tapped."
];

export function generateTags(card: EnrichedCard): string[] {
  const tags = new Set<string>();
  const text = card.oracleText;
  const isBasicLand = BASIC_LAND_RE.test(card.typeLine);
  const isLand = LAND_TYPE_RE.test(card.typeLine);

  // Ramp — exclude basic lands entirely; exclude non-basic lands from tap-for-mana
  if (!isBasicLand) {
    const hasTapForMana =
      RAMP_TAP_ADD_RE.test(text) ||
      RAMP_MULTI_MANA_RE.test(text) ||
      RAMP_ANY_COLOR_RE.test(text) ||
      RAMP_AMOUNT_RE.test(text);
    const hasLandSearch = RAMP_LAND_SEARCH_RE.test(text);

    if ((!isLand && hasTapForMana) || hasLandSearch) {
      tags.add("Ramp");
    }
  }

  // Card Draw
  if (CARD_DRAW_RE.test(text)) {
    tags.add("Card Draw");
  }

  // Card Advantage — look/reveal + put into hand (but not if already Card Draw)
  if (!tags.has("Card Draw") && CARD_ADVANTAGE_RE.test(text)) {
    tags.add("Card Advantage");
  }

  // Board Wipe (check before single-target removal)
  if (
    BOARD_WIPE_RE.test(text) ||
    BOARD_WIPE_BOUNCE_RE.test(text) ||
    BOARD_WIPE_MINUS_RE.test(text)
  ) {
    tags.add("Board Wipe");
    tags.add("Removal");
  }

  // Single-target Removal
  if (
    REMOVAL_TARGET_RE.test(text) ||
    REMOVAL_BOUNCE_RE.test(text) ||
    REMOVAL_DAMAGE_RE.test(text)
  ) {
    tags.add("Removal");
  }

  // Counterspell
  if (COUNTER_RE.test(text)) {
    tags.add("Counterspell");
  }

  // Tutor — but not if searching for lands (that's Ramp)
  if (TUTOR_RE.test(text) && !TUTOR_LAND_EXCLUSION_RE.test(text)) {
    tags.add("Tutor");
  }

  // Cost Reduction
  if (COST_REDUCTION_RE.test(text) || COST_REDUCTION_LESS_RE.test(text)) {
    tags.add("Cost Reduction");
  }

  // Protection
  if (card.keywords.some((kw) => PROTECTION_KEYWORDS.has(kw))) {
    tags.add("Protection");
  }
  if (PROTECTION_ORACLE_RE.test(text)) {
    tags.add("Protection");
  }

  // Recursion
  if (RECURSION_RE.test(text)) {
    tags.add("Recursion");
  }

  // --- Land-specific tags (non-basic lands only) ---
  if (isLand && !isBasicLand) {
    // Fetch Land — land that searches library for another land
    if (RAMP_LAND_SEARCH_RE.test(text)) {
      tags.add("Fetch Land");
    }

    // ETB Tapped / Conditional ETB (mutually exclusive)
    if (ETB_TAPPED_RE.test(text)) {
      const isConditional = CONDITIONAL_PATTERNS.some((p) => p.test(text));
      if (isConditional) {
        tags.add("Conditional ETB");
      } else {
        tags.add("ETB Tapped");
      }
    }

    // Mana Fixing — produces 2+ colors or "any color"
    const nonColorless = card.producedMana.filter((c) => c !== "C");
    if (nonColorless.length >= 2 || MANA_FIXING_ANY_COLOR_RE.test(text)) {
      tags.add("Mana Fixing");
    }

    // Basic Types — non-basic land with basic land subtypes
    if (card.subtypes.some((s) => BASIC_LAND_SUBTYPES.has(s))) {
      tags.add("Basic Types");
    }

    // Mana Accel Land — produces 2+ mana from a single activation
    if (
      MANA_ACCEL_DOUBLE_RE.test(text) ||
      MANA_ACCEL_FOR_EACH_RE.test(text) ||
      MANA_ACCEL_AMOUNT_RE.test(text)
    ) {
      tags.add("Mana Accel Land");
    }

    // Non-Land Types — land that is also another card type
    if (NON_LAND_TYPES_RE.test(card.typeLine)) {
      tags.add("Non-Land Types");
    }

    // Cycling — has cycling or basic landcycling ability
    if (
      card.keywords.some((kw) => CYCLING_KEYWORDS.has(kw)) ||
      CYCLING_RE.test(text)
    ) {
      tags.add("Cycling");
    }

    // Utility Land — has meaningful abilities beyond mana production
    let stripped = text;
    for (const pattern of UTILITY_STRIP_PATTERNS) {
      stripped = stripped.replace(pattern, "");
    }
    stripped = stripped.replace(/\s+/g, " ").trim();
    if (stripped.length > 0) {
      tags.add("Utility Land");
    }
  }

  // --- Bracket-related tags ---

  // Game Changer — sourced from Scryfall's game_changer field
  if (card.isGameChanger) {
    tags.add("Game Changer");
  }

  // Extra Turn — oracle text detection
  if (EXTRA_TURN_RE.test(text)) {
    tags.add("Extra Turn");
  }

  // Mass Land Denial — regex patterns + name-based detection
  if (
    FULL_MLD_RE.test(text) ||
    SACRIFICE_MLD_RE.test(text) ||
    RESOURCE_DENIAL_NAMES.has(card.name)
  ) {
    tags.add("Mass Land Denial");
  }

  // --- Tribal tags ---

  // Lord — type-specific buff ("Other Elf creatures you control get +1/+1")
  // or chosen-type lord ("Other creatures you control of the chosen type get +1/+1")
  if (LORD_TYPE_SPECIFIC_RE.test(text) || LORD_CHOSEN_TYPE_RE.test(text)) {
    tags.add("Lord");
  }

  // Tribal Payoff — any card that rewards a specific creature type strategy
  if (
    TRIBAL_PAYOFF_KINDRED_RE.test(card.typeLine) ||
    TRIBAL_PAYOFF_CHOOSE_RE.test(text) ||
    TRIBAL_PAYOFF_SHARE_RE.test(text) ||
    TRIBAL_PAYOFF_OF_TYPE_RE.test(text) ||
    TRIBAL_PAYOFF_EVERY_TYPE_RE.test(text) ||
    LORD_TYPE_SPECIFIC_RE.test(text)
  ) {
    tags.add("Tribal Payoff");
  }

  return Array.from(tags).sort();
}
