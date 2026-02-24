import type { EnrichedCard } from "./types";

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

  return Array.from(tags).sort();
}
