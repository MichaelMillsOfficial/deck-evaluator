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
  // Secrets of Strixhaven (SOS) mechanics
  Lesson: { bg: "bg-rose-500/20", text: "text-rose-200" },
  Paradigm: { bg: "bg-fuchsia-500/20", text: "text-fuchsia-200" },
  Opus: { bg: "bg-blue-500/20", text: "text-blue-300" },
  Repartee: { bg: "bg-zinc-400/20", text: "text-zinc-200" },
  Infusion: { bg: "bg-lime-500/20", text: "text-lime-300" },
  Increment: { bg: "bg-lime-600/20", text: "text-lime-200" },
  Prepare: { bg: "bg-cyan-500/20", text: "text-cyan-300" },
  Book: { bg: "bg-amber-500/20", text: "text-amber-300" },
  Converge: { bg: "bg-indigo-500/20", text: "text-indigo-300" },
  // #56 phase 2 functional tags
  "Token Generator": { bg: "bg-lime-500/20", text: "text-lime-200" },
  "Token Multiplier": { bg: "bg-fuchsia-500/20", text: "text-fuchsia-300" },
  "Mana Reduction": { bg: "bg-emerald-500/20", text: "text-emerald-200" },
  "Token Payoff": { bg: "bg-rose-500/20", text: "text-rose-300" },
  Flicker: { bg: "bg-sky-500/20", text: "text-sky-200" },
  Fog: { bg: "bg-stone-500/20", text: "text-stone-200" },
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
// Upkeep mana effects — Braid of Fire's "cumulative upkeep — Add {R}" and
// similar "at the beginning of your upkeep, add {X}" upkeep ramp.
const RAMP_UPKEEP_ADD_RE =
  /\b(?:at the beginning of (?:your )?upkeep[^.]*\badd\s+\{[WUBRGC]\}|cumulative upkeep[^.]*\badd\s+\{[WUBRGC]\})/i;
// Ritual / "Add {X} for each ..." spells (Mana Geyser, Pyretic Ritual,
// Seething Song). Per issue #56, classifying rituals as Ramp is intentional.
const RAMP_RITUAL_FOR_EACH_RE = /\badd\s+\{[WUBRGC]\}\s+for each\b/i;
// Treasure-token generators — non-land permanents that ETB or trigger to
// create Treasure tokens (Generous Plunderer, Smothering Tithe, etc.).
const RAMP_TREASURE_RE = /\bcreate[^.]+treasure token/i;
// Matches mana-producing spell effects (rituals) — excludes tap abilities via
// negative lookbehind. The Instant/Sorcery type-line gate in the goldfish
// simulator is the primary filter; this regex is a secondary safety net.
export const RITUAL_MANA_ADD_RE = /(?<!\{T\}[^.]*)[Aa]dd\s+\{[WUBRGC]\}/;
// Card Draw — matches "draw a card", "draw N cards", or "draws N cards"
// (the plural form covers "Target player draws two cards" on Sign in Blood).
const CARD_DRAW_RE = /\bdraws?\b.+?\bcards?\b|\bdraws? a card\b/i;
// Pattern used to locate individual draw clauses for the opponent-recipient
// filter. Matches "draws? ... card(s)" or "draws? a card".
const CARD_DRAW_CLAUSE_RE = /\bdraws?\b[^.]*?\bcards?\b/gi;
// Opponent-recipient phrases that, when the IMMEDIATE subject of the draw
// verb, suppress the Card Draw tag. Trigger conditions like "Whenever an
// opponent casts a spell, draw a card" are not affected because the opponent
// reference is far from the draw verb.
// Note: "target player" is intentionally NOT included — Sign in Blood
// self-targets and is a real draw spell.
const CARD_DRAW_OPPONENT_RECIPIENT_RE =
  /\b(?:target opponent|each opponent|an opponent|each other player)\s*$/i;
const CARD_ADVANTAGE_RE =
  /\b(?:look at|reveal)\b.+?\bput\b.+?\binto your hand\b/i;
const CARD_ADVANTAGE_IMPULSE_RE =
  /\byou may (?:play|cast)\b.+?\b(?:exiled|those cards?|that card)\b/i;
const REMOVAL_TARGET_RE =
  /\b(?:destroy|exile)\s+target\b/i;
const REMOVAL_BOUNCE_RE = /\breturn target.+?to its owner's hand\b/i;
// Single-target damage removal — accepts \d+ or X as the damage amount.
// The "deals N damage" clause is the anchor; a separate same-clause check
// requires the target to be a creature / planeswalker / permanent / battle,
// "any target", or a modal target list that includes a creature/planeswalker.
// Damage dealt ONLY to "target player" / "target opponent" is NOT removal
// (Abraded Bluffs is the canonical false-positive).
const REMOVAL_DAMAGE_AMOUNT_RE =
  /\bdeals?\s+(?:\d+|X|that much)\s+damage\b/i;
const REMOVAL_DAMAGE_VALID_TARGET_RE =
  /\b(?:any target\b|target\s+(?:creatures?|planeswalkers?|permanents?|battles?|attacking|blocking)\b|target\s+creature\s+or\s+(?:player|planeswalker)\b|target\s+creature,\s*player,?\s*(?:or\s+planeswalker)?\b)/i;
const BOARD_WIPE_RE =
  /\b(?:destroy|exile)\s+all\b/i;
// Conditional board wipe — "destroy each ... nonland permanent ... mana value"
// covers Karn's Sylex / Toxic Deluge-style X-cost wipes that say "each" rather
// than "all" and gate on mana value or some condition.
const BOARD_WIPE_CONDITIONAL_RE =
  /\bdestroy each\b[^.]*\bnonland permanent[^.]*\bmana value\b/i;
const BOARD_WIPE_BOUNCE_RE = /\breturn all\b.+?\bto their owners' hands\b/i;
const BOARD_WIPE_MINUS_RE = /\ball creatures get -\d+\/-\d+/i;
// Card names whose oracle text incidentally matches a board-wipe pattern but
// which are not actually permanent wipes. Pyre of the World Tree's front face
// "exile all cards from your hand" is a hand-exile, not a board wipe.
const BOARD_WIPE_NAME_DENYLIST = new Set<string>([
  "Invasion of Kaldheim // Pyre of the World Tree",
]);
// --- Asymmetric (one-sided) wipe patterns ---
// Universal: "all <modifier?> creatures/permanents/planeswalkers you don't control" etc.
// Anchored to "all" so single-target clauses ("target creature you don't control") on modal
// cards don't falsely flag a symmetric wipe mode as asymmetric.
const ASYMMETRIC_OPPONENT_RE =
  /\ball\s+(?:\S+\s+){0,3}?(?:creatures?|permanents?|planeswalkers?)\s+(?:you don't control|an opponent controls|your opponents control)\b/i;
// Tribal: "that aren't of the chosen type" (Kindred Dominance)
const ASYMMETRIC_CHOSEN_TYPE_RE = /\bthat aren't of the chosen (?:type|creature type)\b/i;
// Tribal: "that don't share a creature type with" (Patriarch's Bidding-style)
const ASYMMETRIC_SHARED_TYPE_RE = /\bthat don't share a (?:creature )?type with\b/i;
// "non-<cardtype-or-supertype>" — broad exclusion patterns like "nonartifact creatures"
// (Organic Extinction), "nonlegendary creatures", etc. Card types and supertypes only;
// creature subtypes are handled by NON_TYPE_RE from creature-types.
const ASYMMETRIC_NON_CARDTYPE_RE =
  /\bnon-?(artifact|enchantment|planeswalker|legendary|snow|basic)\b/gi;
// "destroy all permanents except for <list>" / "other than <list>" (Scourglass, Cataclysmic
// Gearhulk-style clauses). Captures the list; a second pass pulls spared card types out of it.
const ASYMMETRIC_EXCEPT_FOR_RE = /\b(?:except for|other than)\s+([^.]*)/i;
const SPARED_TYPE_TOKENS_RE =
  /\b(artifact|enchantment|planeswalker|land|legendary|snow|basic)s?\b/gi;
// Note: NON_TYPE_RE (imported from creature-types), ASYMMETRIC_NON_CARDTYPE_RE, and
// SPARED_TYPE_TOKENS_RE all have /g flag — reset lastIndex before use.

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
  // Also check "except for <list>" syntax (Scourglass: "except for artifacts and lands").
  const exceptMatch = ASYMMETRIC_EXCEPT_FOR_RE.exec(oracleText);
  if (exceptMatch) {
    SPARED_TYPE_TOKENS_RE.lastIndex = 0;
    let t: RegExpExecArray | null;
    while ((t = SPARED_TYPE_TOKENS_RE.exec(exceptMatch[1])) !== null) {
      cardTypeMatches.add(t[1].toLowerCase());
    }
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
// "(nonbasic) lands don't untap" — Stasis-style untap denial on lands.
const MLD_DONT_UNTAP_RE = /\b(?:nonbasic )?lands? don'?t untap\b/i;
// Forced-sacrifice removal — "target player/opponent sacrifices a creature/permanent/nonland".
// Allows optional modifiers ("an attacking creature", "a nonland permanent").
const REMOVAL_FORCE_SAC_RE =
  /\btarget (?:player|opponent) sacrifices?\s+(?:a |an )?(?:\w+\s+)?(?:creature|permanent|nonland)/i;
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

// --- Token Generator (#56 phase 2) ---
// "create ... tokens" — covers creature, Treasure, Clue, Food, etc. tokens.
// Also matches the passive replacement form on token-doubling enchantments
// ("...tokens would be created..." / "...tokens are created..." on
// Anointed Procession, Parallel Lives, Doubling Season).
const TOKEN_GENERATOR_RE =
  /\bcreate\b[^.]*\btokens?\b|\btokens?\b[^.]*\b(?:would be created|are created)\b/i;

// --- Token Multiplier (#56 phase 2) ---
// Cards that double / multiply token creation. Covers the "twice that many"
// + "tokens" replacement pattern, plus a name allow-list for staples whose
// oracle text style varies.
const TOKEN_MULTIPLIER_RE =
  /\b(?:twice that many|that many plus|those tokens? plus)[^.]*tokens?\b/i;
const TOKEN_MULTIPLIER_NAMES = new Set<string>([
  "Anointed Procession",
  "Doubling Season",
  "Parallel Lives",
  "Mondrak, Glory Dominus",
  "Adrix and Nev, Twincasters",
]);

// --- Mana Reduction (#56 phase 2) ---
// Cards that let you pay an alternative resource (life, generic mana) in
// place of a colored mana symbol — e.g. the Phyrexia: All Will Be One Defiler
// cycle ("you may pay 2 life. If you do, that spell costs {W} less to cast").
// Distinct from Cost Reduction, which is general "cost {X} less" effects.
const MANA_REDUCTION_RATHER_THAN_RE =
  /\byou may pay (?:\d+ life|\{[WUBRGC]\})\s+(?:rather than|instead of)\b/i;
// Defiler-style: "pay N life. If you do, that spell costs {C} less to cast"
// (the life payment substitutes for a single colored pip).
const MANA_REDUCTION_DEFILER_RE =
  /\bpay\s+\d+\s+life\b[^.]*\.\s*If you do,[^.]*\bcosts?\s+\{[WUBRGC]\}\s+less\b/i;

// --- Token Payoff (#56 phase 2) ---
// "Whenever <subject> creature(s) enter(s) the battlefield, <payoff>" —
// triggers that fire on creature ETB, especially relevant in token decks.
// The payoff clause must be a damage / life-change / token / counter / draw
// effect, otherwise we'd pull in static buffs that aren't payoffs.
const TOKEN_PAYOFF_RE =
  /\bwhenever\b[^.]*\bcreatures?\s+(?:enters|enter)\b[^.]*(?:deals?\s+\d+|deals?\s+damage|loses?\s+\d+\s+life|gains?\s+\d+\s+life|create|puts?\s+a|draws?\s+(?:a|\d+)\s+cards?)/i;

// --- Flicker (#56 phase 2) ---
// Self-bounce / blink: exile a creature/permanent then return it to the
// battlefield. Distinct from removal-style "Exile target creature" (Path to
// Exile, Swords to Plowshares) which never returns the exiled card.
// Pattern allows the exile clause and the return clause to be in the same
// sentence (Cloudshift) or in adjacent sentences (Eerie Interlude:
// "Exile ... creatures ... . Return those cards to the battlefield...").
// We forbid the second-clause start from being "Its controller" — that's the
// hallmark of removal-with-rider (Path to Exile / Swords to Plowshares).
const FLICKER_RE =
  /\bexile (?:any number of |another |target |that )(?:[a-z-]+ )*(?:creatures?|permanents?|artifacts?)[^.]*?(?:\.\s+(?!Its controller|It deals|Its owner)[^.]*)?\b(?:return|then return)[^.]*\b(?:to the battlefield|under (?:its|their) owner'?s control)\b/i;

// --- Fog (#56 phase 2) ---
// Mass damage prevention: "Prevent all combat damage that would be dealt
// this turn" (Fog, Holy Day, Angelsong) and the rarer "by sources" form.
// Healing Salve uses "Prevent the next N damage" (single-source) — NOT a fog.
const FOG_RE =
  /\bprevent all (?:combat )?damage that would be dealt (?:this turn|by[^.]+this turn)\b/i;

// Discard Payoff — triggers on discard events
const DISCARD_PAYOFF_TRIGGER_RE = /\bwhenever[^.]*discards?\b/i;
const DISCARD_PAYOFF_CONDITION_RE =
  /\bif a player discarded a card this turn\b/i;
// "unless ... discards" is NOT a payoff trigger — it's a Mass Discard choice
const DISCARD_UNLESS_EXCLUSION_RE = /\bunless[^.]*discards?\b/i;

// --- Secrets of Strixhaven (SOS) mechanics ---
// Ability words use an em-dash on printed cards ("Opus —"); we accept either a
// real em-dash (U+2014) or a hyphen-minus to be tolerant of paraphrased text.
const OPUS_RE = /\bopus\s*(?:—|-)/i;
const REPARTEE_RE = /\brepartee\s*(?:—|-)/i;
const INFUSION_RE = /\binfusion\s*(?:—|-)/i;
// Paradigm and Increment are keywords (also surface in card.keywords); we
// fall back to a word-boundary regex when the keyword array is missing them.
const PARADIGM_RE = /\bparadigm\b/i;
const INCREMENT_RE = /\bincrement\b/i;
// Prepare frames have a mode that says "becomes prepared" or "while ... is prepared".
const PREPARE_RE = /\b(?:becomes? prepared|is prepared|prepare\s*\{)/i;
// Converge: keyword from KTK; reminder text references "colors of mana spent".
const CONVERGE_RE =
  /\bconverge\b|\bcolors? of mana spent to cast (?:it|this spell)\b/i;

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
  "Winter Moon",
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

/**
 * Returns true if the oracle text contains at least one card-draw clause
 * whose recipient is NOT explicitly an opponent. Filters out:
 *   - "target opponent draws"
 *   - "each opponent draws" / "an opponent draws"
 *   - "they draw a card" where "opponent" was the most recently named
 *     actor (Dewdrop Cure Gift reminder text — the "they" refers to
 *     the opponent who was promised a gift).
 * Keeps:
 *   - "you (may) draw" — the controller draws (Rhystic Study)
 *   - "Target player draws" (Sign in Blood self-targets)
 *   - imperative "Draw N cards" / "Draw a card" (Concentrate, Brainstorm)
 *   - "Whenever an opponent casts a spell, you may draw a card" — the
 *     opponent is the trigger condition, "you" is the explicit subject.
 */
function hasNonOpponentCardDraw(text: string): boolean {
  if (!CARD_DRAW_RE.test(text)) return false;
  // Quick win: any "you (may) draw" anywhere means the controller draws.
  if (/\byou(?:\s+may)?\s+draws?\b/i.test(text)) return true;
  // Walk every draw clause across the full text. CARD_DRAW_CLAUSE_RE has the
  // /g flag — reset lastIndex before use.
  CARD_DRAW_CLAUSE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CARD_DRAW_CLAUSE_RE.exec(text)) !== null) {
    const before = text.slice(0, m.index);
    const immediateBefore = before.slice(-40);
    // Skip if the IMMEDIATE subject is an opponent recipient
    // ("target opponent draws", "an opponent draws", etc.).
    if (CARD_DRAW_OPPONENT_RECIPIENT_RE.test(immediateBefore)) continue;
    // Skip "they draw" when an "opponent" was named as the most recent
    // actor within the last 120 chars (Dewdrop Cure Gift reminder text:
    // "you may promise an opponent ... they draw a card").
    if (
      /\bthey\s*$/i.test(immediateBefore) &&
      /\bopponent\b/i.test(before.slice(-120))
    ) {
      continue;
    }
    return true;
  }
  return false;
}

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
    // Non-tap, non-land-search ramp: upkeep mana (Braid of Fire), ritual-style
    // "Add {X} for each ..." (Mana Geyser), and Treasure-token generators
    // (Generous Plunderer). Skip on lands — land-side mana is handled above.
    const hasUpkeepAdd = !isLand && RAMP_UPKEEP_ADD_RE.test(text);
    const hasRitualForEach = !isLand && RAMP_RITUAL_FOR_EACH_RE.test(text);
    const hasTreasureToken = !isLand && RAMP_TREASURE_RE.test(text);

    if (
      (!isLand && hasTapForMana) ||
      hasLandSearch ||
      hasAdditionalLand ||
      hasUpkeepAdd ||
      hasRitualForEach ||
      hasTreasureToken
    ) {
      tags.add("Ramp");
    }
  }

  // Card Draw — must have at least one draw clause that is NOT explicitly
  // an opponent recipient. (Dewdrop Cure's Gift reminder text reads
  // "you may promise an opponent a gift ... they draw a card" — that "they"
  // refers to the opponent and should not count as your draw.)
  if (hasNonOpponentCardDraw(text)) {
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

  // Board Wipe (check before single-target removal). Cards on the name
  // denylist incidentally match BOARD_WIPE_RE via non-permanent text
  // ("exile all cards from your hand") — skip them entirely.
  const onBoardWipeDenylist = BOARD_WIPE_NAME_DENYLIST.has(card.name);
  if (
    !onBoardWipeDenylist &&
    (BOARD_WIPE_RE.test(text) ||
      BOARD_WIPE_BOUNCE_RE.test(text) ||
      BOARD_WIPE_MINUS_RE.test(text) ||
      BOARD_WIPE_CONDITIONAL_RE.test(text))
  ) {
    tags.add("Board Wipe");
    tags.add("Removal");

    // Asymmetric (one-sided) wipes: In Garruk's Wake, Plague Wind, Kindred Dominance, etc.
    // Only applied when the card already matched a board-wipe pattern above.
    if (classifyAsymmetricWipe(text) !== null) {
      tags.add("Asymmetric Wipe");
    }
  }

  // Single-target Removal — destroy/exile target, bounce target, force-sacrifice,
  // or "deals N damage" combined with a valid (creature/planeswalker/etc.) target.
  const hasDamageRemoval =
    REMOVAL_DAMAGE_AMOUNT_RE.test(text) &&
    REMOVAL_DAMAGE_VALID_TARGET_RE.test(text);
  if (
    REMOVAL_TARGET_RE.test(text) ||
    REMOVAL_BOUNCE_RE.test(text) ||
    hasDamageRemoval ||
    REMOVAL_FORCE_SAC_RE.test(text)
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
    MLD_DONT_UNTAP_RE.test(text) ||
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

  // --- Token Generator (#56 phase 2) ---
  // Any "create ... token(s)" effect: creature tokens, Treasure, Clue, Food.
  if (TOKEN_GENERATOR_RE.test(text)) {
    tags.add("Token Generator");
  }

  // --- Token Multiplier (#56 phase 2) ---
  // "twice that many tokens" replacement effects, plus a name allow-list of
  // canonical token-doubler staples.
  if (
    TOKEN_MULTIPLIER_RE.test(text) ||
    TOKEN_MULTIPLIER_NAMES.has(card.name)
  ) {
    tags.add("Token Multiplier");
  }

  // --- Mana Reduction (#56 phase 2) ---
  // "Pay X life rather than {C}" alternative-cost spells, plus the Defiler
  // cycle that pays life to discount a colored pip.
  if (
    MANA_REDUCTION_RATHER_THAN_RE.test(text) ||
    MANA_REDUCTION_DEFILER_RE.test(text)
  ) {
    tags.add("Mana Reduction");
  }

  // --- Token Payoff (#56 phase 2) ---
  // Creature-ETB triggers with a damage / life / token / draw payoff —
  // synergizes with Token Generator decks that flood the board.
  if (TOKEN_PAYOFF_RE.test(text)) {
    tags.add("Token Payoff");
  }

  // --- Flicker (#56 phase 2) ---
  // Exile-and-return effects (Cloudshift, Ephemerate, Conjurer's Closet).
  if (FLICKER_RE.test(text)) {
    tags.add("Flicker");
  }

  // --- Fog (#56 phase 2) ---
  // Combat damage prevention (Fog, Holy Day, Constant Mists). Distinct from
  // single-source prevention spells like Healing Salve.
  if (FOG_RE.test(text)) {
    tags.add("Fog");
  }

  // --- Secrets of Strixhaven mechanics ---

  // Lesson — instant/sorcery subtype attached to the Paradigm cycle.
  if (card.subtypes.includes("Lesson")) {
    tags.add("Lesson");
  }

  // Paradigm — keyword on Lesson sorceries; exiles on first resolve and
  // copies itself each first main phase.
  if (card.keywords.includes("Paradigm") || PARADIGM_RE.test(text)) {
    tags.add("Paradigm");
  }

  // Opus — Prismari ability word: triggers on instant/sorcery cast, with
  // a 5+ mana threshold rider.
  if (card.keywords.includes("Opus") || OPUS_RE.test(text)) {
    tags.add("Opus");
  }

  // Repartee — Silverquill ability word: triggers on instant/sorcery cast
  // that targets a creature.
  if (card.keywords.includes("Repartee") || REPARTEE_RE.test(text)) {
    tags.add("Repartee");
  }

  // Infusion — Witherbloom ability word: triggers care if you gained life
  // this turn.
  if (card.keywords.includes("Infusion") || INFUSION_RE.test(text)) {
    tags.add("Infusion");
  }

  // Increment — Quandrix keyword on creatures: +1/+1 counter when you cast
  // a spell with mana value greater than this creature's P or T.
  if (card.keywords.includes("Increment") || INCREMENT_RE.test(text)) {
    tags.add("Increment");
  }

  // Prepare — Adventure-style two-frame mechanic: a creature "becomes
  // prepared" and you can cast a copy of its prepare-spell from exile.
  if (PREPARE_RE.test(text)) {
    tags.add("Prepare");
  }

  // Book — artifact subtype debuting in SOS.
  if (card.subtypes.includes("Book")) {
    tags.add("Book");
  }

  // Converge — multicolor payoff that scales with colors of mana spent.
  if (card.keywords.includes("Converge") || CONVERGE_RE.test(text)) {
    tags.add("Converge");
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
