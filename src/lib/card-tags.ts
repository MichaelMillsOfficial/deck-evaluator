import type { EnrichedCard } from "./types";
import { CONDITIONAL_PATTERNS } from "./land-base-efficiency";
import { CREATURE_TYPE_PATTERN, NON_TYPE_RE } from "./creature-types";

export const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  Ramp: { bg: "bg-emerald-500/20", text: "text-emerald-300" },
  "Card Draw": { bg: "bg-blue-500/20", text: "text-blue-300" },
  "Card Advantage": { bg: "bg-sky-500/20", text: "text-sky-300" },
  Removal: { bg: "bg-red-500/20", text: "text-red-300" },
  "Board Wipe": { bg: "bg-orange-500/20", text: "text-orange-300" },
  "Asymmetric Wipe": { bg: "bg-amber-500/20", text: "text-amber-300" },
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
  "Legendary Payoff": { bg: "bg-amber-500/20", text: "text-amber-300" },
  "Snow Payoff": { bg: "bg-cyan-500/20", text: "text-cyan-300" },
  "Targeted Discard": { bg: "bg-neutral-500/20", text: "text-neutral-300" },
  "Mass Discard": { bg: "bg-neutral-600/20", text: "text-neutral-200" },
  "Self-Discard": { bg: "bg-gray-600/20", text: "text-gray-300" },
  "Discard Payoff": { bg: "bg-slate-600/20", text: "text-slate-200" },
};

const BASIC_LAND_RE = /^Basic Land/i;
const LAND_TYPE_RE = /\bLand\b/;
const RAMP_TAP_ADD_RE = /\{T\}.*?[Aa]dd\s+\{[WUBRGC]\}/;
const RAMP_MULTI_MANA_RE = /[Aa]dd\s+\{[WUBRGC]\}.*?\{[WUBRGC]\}/;
export const RAMP_LAND_SEARCH_RE =
  /[Ss]earche?s?\s+(?:your|their)\s+library\s+for.+?(?:basic\s+)?(?:land|Forest|Plains|Island|Swamp|Mountain)\b/;
const RAMP_ANY_COLOR_RE =
  /\{T\}.*?[Aa]dd\s+(?:one\s+mana\s+of\s+any|mana\s+of\s+any\s+(?:one\s+)?(?:color|type))\b/;
const RAMP_AMOUNT_RE = /\{T\}.*?[Aa]dd\s+(?:an\s+amount\s+of\s+|X\s+)\{[WUBRGC]\}/;
const RAMP_ADDITIONAL_LAND_RE = /\badditional lands?\b/i;
// Matches mana-producing spell effects (rituals) — excludes tap abilities via
// negative lookbehind. The Instant/Sorcery type-line gate in the goldfish
// simulator is the primary filter; this regex is a secondary safety net.
export const RITUAL_MANA_ADD_RE = /(?<!\{T\}[^.]*)[Aa]dd\s+\{[WUBRGC]\}/;
const CARD_DRAW_RE = /\bdraw\b.+?\bcards?\b|\bdraw a card\b/i;
const CARD_ADVANTAGE_RE =
  /\b(?:look at|reveal)\b.+?\bput\b.+?\binto your hand\b/i;
const CARD_ADVANTAGE_IMPULSE_RE =
  /\byou may (?:play|cast)\b.+?\b(?:exiled|those cards?|that card)\b/i;
const REMOVAL_TARGET_RE =
  /\b(?:destroy|exile)\s+target\b/i;
const REMOVAL_BOUNCE_RE = /\breturn target.+?to its owner's hand\b/i;
const REMOVAL_DAMAGE_RE = /\bdeals?\s+\d+\s+damage to\b.+?\btarget\b/i;
const BOARD_WIPE_RE =
  /\b(?:destroy|exile)\s+all\b/i;
const BOARD_WIPE_BOUNCE_RE = /\breturn all\b.+?\bto their owners' hands\b/i;
const BOARD_WIPE_MINUS_RE = /\ball creatures get -\d+\/-\d+/i;
// --- Asymmetric (one-sided) wipe patterns ---
// Universal: "creatures you don't control", "permanents an opponent controls", etc.
const ASYMMETRIC_OPPONENT_RE =
  /\b(?:creatures?|permanents?|planeswalkers?)\s+(?:you don't control|an opponent controls|your opponents control)\b/i;
// Tribal: "that aren't of the chosen type" (Kindred Dominance)
const ASYMMETRIC_CHOSEN_TYPE_RE = /\bthat aren't of the chosen (?:type|creature type)\b/i;
// Tribal: "that don't share a creature type with" (Patriarch's Bidding-style)
const ASYMMETRIC_SHARED_TYPE_RE = /\bthat don't share a (?:creature )?type with\b/i;
// "non-<cardtype-or-supertype>" — broad exclusion patterns like "nonartifact creatures"
// (Organic Extinction), "nonlegendary creatures", etc. Card types and supertypes only;
// creature subtypes are handled by NON_TYPE_RE from creature-types.
const ASYMMETRIC_NON_CARDTYPE_RE =
  /\bnon-?(artifact|enchantment|planeswalker|legendary|snow|basic)\b/gi;
// Note: NON_TYPE_RE (imported from creature-types) catches "non-Elf creatures" etc.
// Both NON_TYPE_RE and ASYMMETRIC_NON_CARDTYPE_RE have /g flag — reset lastIndex before use.

/**
 * Sub-classification of an asymmetric wipe so callers can decide exemption context:
 * - `opponentSided`: always one-sided regardless of deck (In Garruk's Wake, Plague Wind).
 * - `chosenType`: references a creature type chosen at resolution (Kindred Dominance); asymmetric
 *   only when the deck has any tribal anchor the caster can name.
 * - `specificType`: references a fixed creature subtype (e.g. "non-Elf"); asymmetric only when
 *   that subtype matches a deck anchor. `excludedTypes` is empty because creature subtypes are
 *   recovered by callers via `extractReferencedTypes`.
 * - `cardTypeRestricted`: spares a card type or supertype (e.g. "nonartifact", "nonlegendary");
 *   `excludedTypes` holds the lowercased spared names (e.g. `["artifact"]`). Asymmetric only
 *   when the deck's composition aligns with the spared category.
 * Returns `null` for wipes that have no asymmetric pattern.
 */
export type AsymmetricWipeKind =
  | "opponentSided"
  | "chosenType"
  | "specificType"
  | "cardTypeRestricted";

export interface AsymmetricWipeClassification {
  kind: AsymmetricWipeKind;
  excludedTypes: string[];
}

export function classifyAsymmetricWipe(
  oracleText: string
): AsymmetricWipeClassification | null {
  if (ASYMMETRIC_OPPONENT_RE.test(oracleText)) {
    return { kind: "opponentSided", excludedTypes: [] };
  }
  if (
    ASYMMETRIC_CHOSEN_TYPE_RE.test(oracleText) ||
    ASYMMETRIC_SHARED_TYPE_RE.test(oracleText)
  ) {
    return { kind: "chosenType", excludedTypes: [] };
  }
  // Collect all non-<cardtype> matches (a single wipe could reference multiple).
  ASYMMETRIC_NON_CARDTYPE_RE.lastIndex = 0;
  const cardTypeMatches = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = ASYMMETRIC_NON_CARDTYPE_RE.exec(oracleText)) !== null) {
    cardTypeMatches.add(m[1].toLowerCase());
  }
  if (cardTypeMatches.size > 0) {
    return { kind: "cardTypeRestricted", excludedTypes: [...cardTypeMatches] };
  }
  NON_TYPE_RE.lastIndex = 0;
  if (NON_TYPE_RE.test(oracleText)) {
    return { kind: "specificType", excludedTypes: [] };
  }
  return null;
}
const COUNTER_RE = /\bcounter target\b.+?\bspell\b/i;
const TUTOR_RE = /\bsearch your library\b/i;
const TUTOR_LAND_EXCLUSION_RE = /search your library for.+?(?:land|Forest|Plains|Island|Swamp|Mountain)\b/i;
const COST_REDUCTION_RE = /\bcosts?\s+\{\d+\}\s+less\b/i;
const COST_REDUCTION_LESS_RE = /\bcosts?\s+less\s+to\s+cast\b/i;
// Self-referential cost reduction: "This spell costs {1} less"
const SELF_COST_REDUCTION_RE = /\bthis spell costs?\b/i;
// Keywords that only reduce their own spell's cost
const SELF_COST_KEYWORDS = new Set(["Affinity", "Convoke", "Delve", "Improvise"]);
const PROTECTION_KEYWORDS = new Set([
  "Hexproof",
  "Indestructible",
  "Shroud",
  "Ward",
]);
const PROTECTION_ORACLE_RE =
  /\b(?:gains?|ha[sv]e?)\b.+?\b(?:hexproof|indestructible|protection|shroud)\b/i;
const RECURSION_RE = /\breturn\b.+?\bfrom\b.+?\bgraveyard\b/i;
const RECURSION_PLAY_GY_RE = /\b(?:play|cast)\b.+?\bfrom\b.+?\bgraveyard\b/i;

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

// --- Legendary Payoff tag patterns ---
const LEGENDARY_CAST_RE = /whenever you (?:cast|play) a (?:legendary|historic)/i;
const LEGENDARY_ETB_RE = /whenever (?:a|another) legendary.*(?:enters|dies)/i;
const LEGENDARY_STATIC_RE = /legendary (?:creature|permanent)s? you control (?:get \+|have)/i;
const LEGENDARY_OTHER_RE = /other legendary (?:creature|permanent)s? you control/i;
const LEGENDARY_FOR_EACH_RE = /\b(?:for each|each|number of) legendary\b/i;
const LEGENDARY_COST_RE = /legendary.*(?:spell|permanent|card)s?.*cost.*less/i;
const LEGENDARY_GRAVEYARD_RE = /legendary cards? (?:from|in) your graveyard/i;
const LEGEND_RULE_RE = /\blegend rule\b/i;
const HISTORIC_RE = /\bhistoric\b/i;

// --- Snow Payoff tag patterns ---
const SNOW_BROAD_RE = /\bsnow\b[^.]*?\b(?:permanent|creature|land|mana)s?\b/i;
const SNOW_OTHER_RE = /\bother snow\b/i;
const SNOW_TRIGGER_RE = /whenever a snow.*enters|for each snow/i;
const SNOW_MANA_RE = /\{S\}/;

// --- Discard tag patterns ---
// Targeted Discard — requires "target" word (1-for-1 disruption)
const TARGETED_DISCARD_RE = /\btarget (?:player|opponent) discards/i;
// Multi-sentence pattern: "Target player reveals ... That player discards"
// Uses [\s\S] instead of . to match across sentence boundaries (newlines)
// because the reveal and discard clauses are in separate sentences.
// (Cannot use /s dot-all flag — tsconfig target is ES2017, /s requires ES2018.)
const TARGETED_DISCARD_CHOOSE_RE =
  /\btarget (?:player|opponent) reveals[\s\S]+?(?:that player |they )discard/i;

// Mass Discard — affects multiple players, no targeting
const MASS_DISCARD_EACH_RE =
  /\beach (?:player|opponent|other player)[^.]*discards?\b/i;
const MASS_DISCARD_UNLESS_RE =
  /\bunless (?:that player|they|he or she) discards?\b/i;

// Self-Discard — self-discard as cost or forced trigger
const SELF_DISCARD_COST_RE =
  /[Dd]iscard (?:a|two|three|x|your) (?:cards?|hand)\s*:/;
const SELF_DISCARD_ADDITIONAL_RE = /\bas an additional cost[^.]*discard/i;
const SELF_DISCARD_UPKEEP_RE =
  /\b(?:at the beginning of|during) your upkeep[^.]*discard/i;
const SELF_DISCARD_KEYWORDS = new Set(["Cycling", "Connive"]);

// Discard Payoff — triggers on discard events
const DISCARD_PAYOFF_TRIGGER_RE = /\bwhenever[^.]*discards?\b/i;
const DISCARD_PAYOFF_CONDITION_RE =
  /\bif a player discarded a card this turn\b/i;
// "unless ... discards" is NOT a payoff trigger — it's a Mass Discard choice
const DISCARD_UNLESS_EXCLUSION_RE = /\bunless[^.]*discards?\b/i;

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
    const hasAdditionalLand = !isLand && RAMP_ADDITIONAL_LAND_RE.test(text);

    if ((!isLand && hasTapForMana) || hasLandSearch || hasAdditionalLand) {
      tags.add("Ramp");
    }
  }

  // Card Draw
  if (CARD_DRAW_RE.test(text)) {
    tags.add("Card Draw");
  }

  // Card Advantage — look/reveal + put into hand, impulse draw, cascade
  if (!tags.has("Card Draw")) {
    if (
      CARD_ADVANTAGE_RE.test(text) ||
      CARD_ADVANTAGE_IMPULSE_RE.test(text) ||
      card.keywords.includes("Cascade")
    ) {
      tags.add("Card Advantage");
    }
  }

  // Board Wipe (check before single-target removal)
  if (
    BOARD_WIPE_RE.test(text) ||
    BOARD_WIPE_BOUNCE_RE.test(text) ||
    BOARD_WIPE_MINUS_RE.test(text)
  ) {
    tags.add("Board Wipe");
    tags.add("Removal");

    // Asymmetric (one-sided) wipes: In Garruk's Wake, Plague Wind, Kindred Dominance, etc.
    // Only applied when the card already matched a board-wipe pattern above.
    if (classifyAsymmetricWipe(text) !== null) {
      tags.add("Asymmetric Wipe");
    }
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

  // Cost Reduction — exclude self-referential reductions ("This spell costs less",
  // Affinity, Convoke, Delve, Improvise) that only affect the card itself.
  if (COST_REDUCTION_RE.test(text) || COST_REDUCTION_LESS_RE.test(text)) {
    // Strip self-referential sentences and re-test for OTHER cost reduction
    const hasSelfKeyword = card.keywords.some((kw) => SELF_COST_KEYWORDS.has(kw));
    const hasSelfText = SELF_COST_REDUCTION_RE.test(text);
    if (hasSelfKeyword || hasSelfText) {
      // Remove self-referential sentences and check if any cost reduction remains
      const strippedText = text.replace(/[^.]*\bthis spell costs?\b[^.]*/gi, "");
      if (COST_REDUCTION_RE.test(strippedText) || COST_REDUCTION_LESS_RE.test(strippedText)) {
        tags.add("Cost Reduction");
      }
    } else {
      tags.add("Cost Reduction");
    }
  }

  // Protection
  if (card.keywords.some((kw) => PROTECTION_KEYWORDS.has(kw))) {
    tags.add("Protection");
  }
  if (PROTECTION_ORACLE_RE.test(text)) {
    tags.add("Protection");
  }

  // Recursion
  if (RECURSION_RE.test(text) || RECURSION_PLAY_GY_RE.test(text)) {
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

  // --- Supertype payoff tags ---

  // Legendary Payoff — oracle text references legendary/historic payoff patterns
  if (
    LEGENDARY_CAST_RE.test(text) ||
    LEGENDARY_ETB_RE.test(text) ||
    LEGENDARY_STATIC_RE.test(text) ||
    LEGENDARY_OTHER_RE.test(text) ||
    LEGENDARY_FOR_EACH_RE.test(text) ||
    LEGENDARY_COST_RE.test(text) ||
    LEGENDARY_GRAVEYARD_RE.test(text) ||
    LEGEND_RULE_RE.test(text) ||
    HISTORIC_RE.test(text)
  ) {
    tags.add("Legendary Payoff");
  }

  // Snow Payoff — oracle text or mana cost references snow patterns
  if (
    SNOW_BROAD_RE.test(text) ||
    SNOW_OTHER_RE.test(text) ||
    SNOW_TRIGGER_RE.test(text) ||
    SNOW_MANA_RE.test(text) ||
    SNOW_MANA_RE.test(card.manaCost)
  ) {
    tags.add("Snow Payoff");
  }

  // --- Discard tags (all four checked independently — cards can get multiple) ---

  // Targeted Discard — requires "target" word
  if (TARGETED_DISCARD_RE.test(text) || TARGETED_DISCARD_CHOOSE_RE.test(text)) {
    tags.add("Targeted Discard");
  }

  // Mass Discard — each player/opponent discards, or "unless ... discards"
  if (MASS_DISCARD_EACH_RE.test(text) || MASS_DISCARD_UNLESS_RE.test(text)) {
    tags.add("Mass Discard");
  }

  // Self-Discard — cost-position discard (colon-delimited), upkeep triggers, or keywords
  if (
    SELF_DISCARD_COST_RE.test(text) ||
    SELF_DISCARD_ADDITIONAL_RE.test(text) ||
    SELF_DISCARD_UPKEEP_RE.test(text) ||
    card.keywords.some((kw) => SELF_DISCARD_KEYWORDS.has(kw))
  ) {
    tags.add("Self-Discard");
  }

  // Discard Payoff — whenever triggers on discard, or conditional checks.
  // Two-pass approach: the trigger regex is broad (/whenever[^.]*discards/)
  // which would false-positive on "unless...discards" (Painful Quandary).
  // We check per-line to exclude lines where the "discard" is inside an
  // "unless" clause, while still allowing genuine payoff triggers on other lines.
  if (DISCARD_PAYOFF_CONDITION_RE.test(text)) {
    tags.add("Discard Payoff");
  }
  if (DISCARD_PAYOFF_TRIGGER_RE.test(text)) {
    const lines = text.split("\n");
    for (const line of lines) {
      if (
        DISCARD_PAYOFF_TRIGGER_RE.test(line) &&
        !DISCARD_UNLESS_EXCLUSION_RE.test(line)
      ) {
        tags.add("Discard Payoff");
        break;
      }
    }
  }

  return Array.from(tags).sort();
}

/**
 * Pre-compute tags for all cards in a map, returning a reusable cache.
 * Avoids redundant regex work when multiple analysis modules call generateTags
 * for the same cards.
 */
export function buildTagCache(
  cardMap: Record<string, EnrichedCard>
): Map<string, string[]> {
  const cache = new Map<string, string[]>();
  for (const [name, card] of Object.entries(cardMap)) {
    cache.set(name, generateTags(card));
  }
  return cache;
}

/** Look up tags from cache, falling back to generateTags if not cached. */
export function getTagsCached(
  card: EnrichedCard,
  tagCache?: Map<string, string[]>
): string[] {
  if (tagCache) {
    const cached = tagCache.get(card.name);
    if (cached) return cached;
  }
  return generateTags(card);
}
