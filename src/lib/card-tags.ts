import type { EnrichedCard } from "./types";

export const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  Ramp: { bg: "bg-emerald-500/20", text: "text-emerald-300" },
  "Card Draw": { bg: "bg-blue-500/20", text: "text-blue-300" },
  Removal: { bg: "bg-red-500/20", text: "text-red-300" },
  "Board Wipe": { bg: "bg-orange-500/20", text: "text-orange-300" },
  Counterspell: { bg: "bg-cyan-500/20", text: "text-cyan-300" },
  Tutor: { bg: "bg-yellow-500/20", text: "text-yellow-300" },
  Protection: { bg: "bg-violet-500/20", text: "text-violet-300" },
  Recursion: { bg: "bg-pink-500/20", text: "text-pink-300" },
};

const BASIC_LAND_RE = /^Basic Land/i;
const RAMP_TAP_ADD_RE = /\{T\}.*?[Aa]dd\s+\{[WUBRGC]\}/;
const RAMP_MULTI_MANA_RE = /[Aa]dd\s+\{[WUBRGC]\}.*?\{[WUBRGC]\}/;
const RAMP_LAND_SEARCH_RE = /[Ss]earch your library for.+(?:basic )?land/;
const CARD_DRAW_RE = /\bdraw\b.+?\bcards?\b|\bdraw a card\b/i;
const REMOVAL_TARGET_RE =
  /\b(?:destroy|exile)\s+target\b/i;
const REMOVAL_BOUNCE_RE = /\breturn target.+?to its owner's hand\b/i;
const REMOVAL_DAMAGE_RE = /\bdeals?\s+\d+\s+damage to\b.+?\btarget\b/i;
const BOARD_WIPE_RE =
  /\b(?:destroy|exile)\s+all\b/i;
const BOARD_WIPE_MINUS_RE = /\ball creatures get -\d+\/-\d+/i;
const COUNTER_RE = /\bcounter target\b.+?\bspell\b/i;
const TUTOR_RE = /\bsearch your library\b/i;
const TUTOR_LAND_EXCLUSION_RE = /search your library for.+?land\b/i;
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

  // Ramp — exclude basic lands
  if (!isBasicLand) {
    if (
      RAMP_TAP_ADD_RE.test(text) ||
      RAMP_MULTI_MANA_RE.test(text) ||
      RAMP_LAND_SEARCH_RE.test(text)
    ) {
      tags.add("Ramp");
    }
  }

  // Card Draw
  if (CARD_DRAW_RE.test(text)) {
    tags.add("Card Draw");
  }

  // Board Wipe (check before single-target removal)
  if (BOARD_WIPE_RE.test(text) || BOARD_WIPE_MINUS_RE.test(text)) {
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
