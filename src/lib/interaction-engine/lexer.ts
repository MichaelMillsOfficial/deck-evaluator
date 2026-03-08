/**
 * Oracle Text Lexer — Tokenizes MTG oracle text into meaningful tokens
 *
 * Handles multi-word recognition, mana symbols, ability block splitting,
 * modal spells, self-references, and oracle text aliases.
 *
 * Performance optimizations:
 * - Sticky (y-flag) regexes avoid substring allocation per character
 * - Pre-lowercased text eliminates per-iteration toLowerCase calls
 * - First-word alias lookup Map reduces multi-word alias scan from O(n) to O(k)
 * - Card-name regex is compiled once per tokenize() call, reused across blocks
 */

import type { Token, TokenType } from "./types";

// ═══════════════════════════════════════════════════════════════════
// ORACLE TEXT ALIAS MAP
// Maps oracle language → normalized form for primitive event matching.
// ═══════════════════════════════════════════════════════════════════

interface AliasEntry {
  pattern: string;
  type: TokenType;
  normalized: string;
}

/**
 * Multi-word phrases that must be matched before single-word tokenization.
 * Ordered longest-first so "is put into a graveyard from the battlefield"
 * matches before "is put into".
 *
 * All patterns are lowercase for case-insensitive matching.
 */
const MULTI_WORD_ALIASES: AliasEntry[] = [
  // Zone transitions (longest first)
  { pattern: "is put into a graveyard from the battlefield", type: "ZONE_TRANSITION", normalized: "dies" },
  { pattern: "is put into a graveyard from anywhere", type: "ZONE_TRANSITION", normalized: "put_into_graveyard_from_anywhere" },
  { pattern: "be put into a graveyard from anywhere", type: "ZONE_TRANSITION", normalized: "put_into_graveyard_from_anywhere" },
  { pattern: "is put into a graveyard", type: "ZONE_TRANSITION", normalized: "put_into_graveyard" },
  { pattern: "be put into a graveyard", type: "ZONE_TRANSITION", normalized: "put_into_graveyard" },
  { pattern: "enters the battlefield", type: "ZONE_TRANSITION", normalized: "etb" },
  { pattern: "enters under your control", type: "ZONE_TRANSITION", normalized: "etb_your_control" },
  { pattern: "enters", type: "ZONE_TRANSITION", normalized: "etb" },
  { pattern: "leaves the battlefield", type: "ZONE_TRANSITION", normalized: "ltb" },
  { pattern: "is put into exile", type: "ZONE_TRANSITION", normalized: "exiled" },
  { pattern: "is returned to its owner's hand", type: "ZONE_TRANSITION", normalized: "bounced" },
  { pattern: "is put on the bottom of its owner's library", type: "ZONE_TRANSITION", normalized: "tucked" },

  // Trigger words (multi-word)
  { pattern: "at the beginning of your upkeep", type: "TRIGGER_WORD", normalized: "upkeep_trigger_you" },
  { pattern: "at the beginning of each player's upkeep", type: "TRIGGER_WORD", normalized: "upkeep_trigger_each" },
  { pattern: "at the beginning of each opponent's upkeep", type: "TRIGGER_WORD", normalized: "upkeep_trigger_opponents" },
  { pattern: "at the beginning of your draw step", type: "TRIGGER_WORD", normalized: "draw_step_trigger" },
  { pattern: "at the beginning of combat on your turn", type: "TRIGGER_WORD", normalized: "combat_trigger_you" },
  { pattern: "at the beginning of combat", type: "TRIGGER_WORD", normalized: "combat_trigger" },
  { pattern: "at the beginning of your end step", type: "TRIGGER_WORD", normalized: "end_step_trigger_you" },
  { pattern: "at the beginning of each end step", type: "TRIGGER_WORD", normalized: "end_step_trigger_each" },
  { pattern: "at the beginning of the next end step", type: "TRIGGER_WORD", normalized: "end_step_trigger_next" },
  { pattern: "at the beginning of your postcombat main phase", type: "TRIGGER_WORD", normalized: "postcombat_main_trigger" },
  { pattern: "at the beginning of each combat", type: "TRIGGER_WORD", normalized: "combat_trigger_each" },

  // State changes (multi-word)
  { pattern: "becomes tapped", type: "STATE_CHANGE", normalized: "becomes_tapped" },
  { pattern: "becomes untapped", type: "STATE_CHANGE", normalized: "becomes_untapped" },
  { pattern: "becomes the target", type: "STATE_CHANGE", normalized: "becomes_target" },
  { pattern: "gains life", type: "STATE_CHANGE", normalized: "gains_life" },
  { pattern: "loses life", type: "STATE_CHANGE", normalized: "loses_life" },
  { pattern: "gain life", type: "STATE_CHANGE", normalized: "gains_life" },
  { pattern: "lose life", type: "STATE_CHANGE", normalized: "loses_life" },

  // Player actions (multi-word)
  { pattern: "cast a spell", type: "PLAYER_ACTION", normalized: "cast_spell" },
  { pattern: "casts a spell", type: "PLAYER_ACTION", normalized: "cast_spell" },
  { pattern: "cast a creature spell", type: "PLAYER_ACTION", normalized: "cast_creature_spell" },
  { pattern: "cast an instant or sorcery spell", type: "PLAYER_ACTION", normalized: "cast_instant_sorcery" },
  { pattern: "cast a noncreature spell", type: "PLAYER_ACTION", normalized: "cast_noncreature_spell" },
  { pattern: "play a land", type: "PLAYER_ACTION", normalized: "play_land" },
  { pattern: "plays a land", type: "PLAYER_ACTION", normalized: "play_land" },
  { pattern: "search your library", type: "PLAYER_ACTION", normalized: "search_library" },
  { pattern: "searches their library", type: "PLAYER_ACTION", normalized: "search_library" },
  { pattern: "deals combat damage to a player", type: "PLAYER_ACTION", normalized: "combat_damage_to_player" },
  { pattern: "deals combat damage to an opponent", type: "PLAYER_ACTION", normalized: "combat_damage_to_opponent" },
  { pattern: "deals combat damage", type: "PLAYER_ACTION", normalized: "combat_damage" },
  { pattern: "deals damage to a player", type: "PLAYER_ACTION", normalized: "damage_to_player" },
  { pattern: "deals damage to an opponent", type: "PLAYER_ACTION", normalized: "damage_to_opponent" },
  { pattern: "deals damage", type: "PLAYER_ACTION", normalized: "deals_damage" },
  { pattern: "is dealt damage", type: "PLAYER_ACTION", normalized: "is_dealt_damage" },

  // Controller (multi-word)
  { pattern: "you control", type: "CONTROLLER", normalized: "you_control" },
  { pattern: "an opponent controls", type: "CONTROLLER", normalized: "opponent_controls" },
  { pattern: "each opponent", type: "CONTROLLER", normalized: "each_opponent" },
  { pattern: "each player", type: "CONTROLLER", normalized: "each_player" },
  { pattern: "target opponent", type: "CONTROLLER", normalized: "target_opponent" },
  { pattern: "target player", type: "CONTROLLER", normalized: "target_player" },

  // Modifiers (multi-word)
  { pattern: "you don't control", type: "MODIFIER", normalized: "opponent_controlled" },

  // Effect phrases (multi-word)
  { pattern: "draw a card", type: "EFFECT_VERB", normalized: "draw_card" },
  { pattern: "draws a card", type: "EFFECT_VERB", normalized: "draw_card" },
  { pattern: "draw two cards", type: "EFFECT_VERB", normalized: "draw_cards_2" },
  { pattern: "draw three cards", type: "EFFECT_VERB", normalized: "draw_cards_3" },
  { pattern: "draw cards", type: "EFFECT_VERB", normalized: "draw_cards" },
  { pattern: "create a token", type: "EFFECT_VERB", normalized: "create_token" },
  { pattern: "create a treasure token", type: "EFFECT_VERB", normalized: "create_treasure" },
  { pattern: "create a food token", type: "EFFECT_VERB", normalized: "create_food" },
  { pattern: "create a clue token", type: "EFFECT_VERB", normalized: "create_clue" },
  { pattern: "destroy target", type: "EFFECT_VERB", normalized: "destroy_target" },
  { pattern: "destroy all", type: "EFFECT_VERB", normalized: "destroy_all" },
  { pattern: "exile target", type: "EFFECT_VERB", normalized: "exile_target" },
  { pattern: "exile all", type: "EFFECT_VERB", normalized: "exile_all" },
  { pattern: "deals damage equal to", type: "EFFECT_VERB", normalized: "damage_equal_to" },
  { pattern: "return target", type: "EFFECT_VERB", normalized: "return_target" },
  { pattern: "return it", type: "EFFECT_VERB", normalized: "return_it" },
  { pattern: "put a +1/+1 counter", type: "EFFECT_VERB", normalized: "put_p1p1_counter" },
  { pattern: "put a -1/-1 counter", type: "EFFECT_VERB", normalized: "put_m1m1_counter" },
  { pattern: "gains flying", type: "EFFECT_VERB", normalized: "grant_flying" },
  { pattern: "gains haste", type: "EFFECT_VERB", normalized: "grant_haste" },
  { pattern: "gains lifelink", type: "EFFECT_VERB", normalized: "grant_lifelink" },
  { pattern: "gains indestructible", type: "EFFECT_VERB", normalized: "grant_indestructible" },
  { pattern: "gains trample", type: "EFFECT_VERB", normalized: "grant_trample" },

  // Duration (multi-word)
  { pattern: "until end of turn", type: "CONDITIONAL", normalized: "until_eot" },
  { pattern: "until your next turn", type: "CONDITIONAL", normalized: "until_next_turn" },
  { pattern: "as long as", type: "CONDITIONAL", normalized: "as_long_as" },
  { pattern: "for as long as", type: "CONDITIONAL", normalized: "as_long_as" },

  // Conditional (multi-word)
  { pattern: "as an additional cost", type: "CONDITIONAL", normalized: "additional_cost" },
  { pattern: "you may pay", type: "CONDITIONAL", normalized: "may_pay" },
  { pattern: "rather than pay", type: "CONDITIONAL", normalized: "rather_than_pay" },
  { pattern: "without paying its mana cost", type: "CONDITIONAL", normalized: "without_paying_mana" },
  { pattern: "if you do", type: "CONDITIONAL", normalized: "if_you_do" },
  { pattern: "if you don't", type: "CONDITIONAL", normalized: "if_you_dont" },

  // Modal (multi-word)
  { pattern: "choose one —", type: "MODAL", normalized: "choose_one" },
  { pattern: "choose two —", type: "MODAL", normalized: "choose_two" },
  { pattern: "choose one or more —", type: "MODAL", normalized: "choose_one_or_more" },
  { pattern: "choose one -", type: "MODAL", normalized: "choose_one" },
  { pattern: "choose two -", type: "MODAL", normalized: "choose_two" },

  // Quantity (multi-word)
  { pattern: "any number of", type: "QUANTITY", normalized: "any_number" },
  { pattern: "one or more", type: "QUANTITY", normalized: "one_or_more" },
  { pattern: "up to two", type: "QUANTITY", normalized: "up_to_2" },
  { pattern: "up to three", type: "QUANTITY", normalized: "up_to_3" },
  { pattern: "up to one", type: "QUANTITY", normalized: "up_to_1" },
];

// ─── First-word alias lookup Map ───
// Instead of scanning all MULTI_WORD_ALIASES at every position, index by
// first word so we only check aliases that could possibly match.
const ALIAS_BY_FIRST_WORD = new Map<string, AliasEntry[]>();
for (const alias of MULTI_WORD_ALIASES) {
  const firstWord = alias.pattern.split(" ")[0];
  if (!ALIAS_BY_FIRST_WORD.has(firstWord)) {
    ALIAS_BY_FIRST_WORD.set(firstWord, []);
  }
  ALIAS_BY_FIRST_WORD.get(firstWord)!.push(alias);
}

// ─── Pre-compiled sticky regexes for the tokenization loop ───
// Using the sticky (y) flag avoids creating a substring slice on every
// character position. Instead we set lastIndex and exec directly.
const MANA_RE = /\{[WUBRGCXSTQEP0-9/]+\}/y;
const STAT_RE = /[+-][0-9X]+\/[+-][0-9X]+/y;
const WORD_RE = /[a-zA-Z_']+/y;
const NUM_RE = /[0-9]+/y;
const WS_RE = /\s/y;
const AFTER_EXILE_RE = /\s+([a-zA-Z]+)/y;
const STRIKE_RE = /\s+(strike)/yi;

// Word-boundary character test for multi-word alias matching
const WORD_BOUNDARY_RE = /[\s,;.:•)—\-]/;

// ─── Single-word token maps ───

const TRIGGER_WORDS = new Set(["when", "whenever", "at"]);

const CARD_TYPES = new Set([
  "creature", "creatures", "artifact", "artifacts",
  "enchantment", "enchantments", "planeswalker", "planeswalkers",
  "land", "lands", "instant", "sorcery", "battle", "kindred",
  "permanent", "permanents", "spell", "spells",
]);

const SUPERTYPES = new Set(["legendary", "basic", "snow", "world", "ongoing"]);

// Common subtypes recognized in oracle text
const SUBTYPES = new Set([
  // Creature types commonly referenced in oracle text
  "elf", "goblin", "human", "zombie", "vampire", "angel", "demon",
  "dragon", "wizard", "cleric", "warrior", "rogue", "knight",
  "elemental", "spirit", "beast", "bird", "cat", "dog", "dinosaur",
  "merfolk", "pirate", "soldier", "shaman", "druid", "monk",
  "horror", "nightmare", "skeleton", "phyrexian", "sliver",
  // Artifact subtypes
  "equipment", "vehicle", "treasure", "food", "clue", "blood",
  "map", "powerstone",
  // Enchantment subtypes
  "aura", "saga", "shrine", "curse", "cartouche", "case", "class", "room",
  // Land subtypes
  "plains", "island", "swamp", "mountain", "forest",
  "desert", "gate", "lair", "locus", "cave",
]);

const ZONES = new Set([
  "battlefield", "graveyard", "hand", "library",
  "exile", "stack", "command",
]);

const EFFECT_VERBS = new Set([
  "add", "create", "deal", "deals", "destroy", "destroys",
  "discard", "discards", "draw", "draws", "exile", "exiles",
  "gain", "gains", "lose", "loses", "mill", "mills",
  "put", "puts", "remove", "removes", "return", "returns", "reveal", "reveals",
  "sacrifice", "sacrifices", "scry", "search", "shuffle", "tap", "untap",
  "target", "fight", "transform", "attach", "counter", "copy",
  "proliferate", "explore", "venture", "adapt", "surveil",
]);

const KEYWORDS_SET = new Set([
  "flying", "haste", "lifelink", "deathtouch", "trample",
  "indestructible", "hexproof", "shroud", "menace", "vigilance",
  "reach", "defender", "flash", "first", "double", "strike",
  "protection", "ward", "phasing", "shadow", "fear", "intimidate",
  "infect", "wither", "prowess", "convoke", "delve", "affinity",
  "cascade", "storm", "flashback", "escape", "retrace", "unearth",
  "rebound", "foretell", "suspend", "kicker", "multikicker",
  "equip", "reconfigure", "crew", "saddle", "bestow", "evoke",
  "mutate", "ninjutsu", "dash", "overload", "emerge", "improvise",
  "replicate", "cipher", "landfall", "constellation", "alliance",
  "magecraft", "eminence", "partner", "undying", "persist",
]);

const MODIFIERS = new Set([
  "target", "other", "another", "nontoken", "token",
  "tapped", "untapped", "attacking", "blocking",
  "enchanted", "equipped", "noncreature", "nonland",
  "nonartifact", "nonenchantment",
]);

const QUANTITY_WORDS: Record<string, string> = {
  a: "1", an: "1", one: "1", two: "2", three: "3",
  four: "4", five: "5", six: "6", seven: "7",
  eight: "8", nine: "9", ten: "10",
  each: "each", all: "all", every: "all",
  another: "another", that: "that", those: "those",
  this: "this",
};

const CONJUNCTIONS = new Set(["and", "or", "then", "also", "but"]);

// Set of words that indicate "exile" is being used as a verb
const EXILE_VERB_CONTEXT = new Set([
  "it", "them", "that", "target", "a", "an", "all", "each",
]);

// ═══════════════════════════════════════════════════════════════════
// SELF-REFERENCE REGEX (static — compiled once)
// ═══════════════════════════════════════════════════════════════════

const SELF_REFERENCE_RE =
  /\bthis\s+(creature|permanent|artifact|enchantment|planeswalker|land|spell)\b/gi;

// ═══════════════════════════════════════════════════════════════════
// LEXER
// ═══════════════════════════════════════════════════════════════════

/**
 * Split oracle text into ability blocks (separated by newlines).
 * Each block is an independent ability.
 */
export function splitAbilityBlocks(oracleText: string): string[] {
  return oracleText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Split a modal ability into its modes.
 * Handles bullet "•" separators and "Choose one —" headers.
 */
export function splitModalModes(abilityText: string): {
  header: string | null;
  modes: string[];
} {
  // Check for modal header
  const modalMatch = abilityText.match(
    /^(choose (?:one|two|one or more|three)(?: that hasn't been chosen)?\s*[—\-])\s*/i
  );

  if (!modalMatch) {
    return { header: null, modes: [abilityText] };
  }

  const header = modalMatch[1].trim();
  const rest = abilityText.slice(modalMatch[0].length);

  // Split on bullet points
  const modes = rest
    .split("•")
    .map((m) => m.trim())
    .filter((m) => m.length > 0);

  return { header, modes };
}

/**
 * Replace self-references (CARDNAME, "this creature", "it") with a
 * canonical SELF token. The cardName parameter is the actual card name.
 *
 * When cardNameRegex is provided (pre-compiled), it is used instead of
 * building a new RegExp from cardName. This avoids re-compiling the same
 * regex for every ability block on the same card.
 */
export function normalizeSelfReferences(
  text: string,
  cardName: string,
  cardNameRegex?: RegExp
): string {
  // Replace exact card name with ~
  let result = text;
  if (cardName.length > 0) {
    if (cardNameRegex) {
      result = text.replace(cardNameRegex, "~");
    } else {
      const escapedName = cardName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = text.replace(new RegExp(escapedName, "gi"), "~");
    }
  }

  // "this creature", "this permanent", "this artifact", etc.
  SELF_REFERENCE_RE.lastIndex = 0;
  result = result.replace(SELF_REFERENCE_RE, "~");

  return result;
}

/**
 * Tokenize a single ability block into Token[].
 *
 * @param cardNameRegex - Optional pre-compiled regex for card name replacement,
 *   avoiding redundant regex compilation when processing multiple blocks.
 */
export function tokenizeAbility(
  abilityText: string,
  cardName: string = "",
  cardNameRegex?: RegExp
): Token[] {
  const tokens: Token[] = [];
  const normalized = normalizeSelfReferences(abilityText, cardName, cardNameRegex);

  // Pre-lowercase the entire text once, used for multi-word alias matching
  // and single-word classification. This avoids calling toLowerCase()
  // inside the loop on every character or word.
  const normalizedLower = normalized.toLowerCase();

  let pos = 0;

  while (pos < normalized.length) {
    // Skip whitespace — use sticky regex instead of per-char test
    WS_RE.lastIndex = pos;
    if (WS_RE.test(normalized)) {
      pos++;
      continue;
    }

    // ─── Mana symbols: {W}, {T}, {2/W}, etc. ───
    MANA_RE.lastIndex = pos;
    const manaMatch = MANA_RE.exec(normalized);
    if (manaMatch) {
      tokens.push({
        type: "MANA_SYMBOL",
        value: manaMatch[0],
        position: pos,
        normalized: manaMatch[0].toUpperCase(),
      });
      pos += manaMatch[0].length;
      continue;
    }

    // ─── Stat modifications: +1/+1, -2/-2, +X/+X ───
    STAT_RE.lastIndex = pos;
    const statMatch = STAT_RE.exec(normalized);
    if (statMatch) {
      tokens.push({
        type: "STAT_MOD",
        value: statMatch[0],
        position: pos,
        normalized: statMatch[0],
      });
      pos += statMatch[0].length;
      continue;
    }

    // ─── Cost separator: colon between cost and effect ───
    if (normalized[pos] === ":") {
      tokens.push({
        type: "COST_SEPARATOR",
        value: ":",
        position: pos,
      });
      pos++;
      continue;
    }

    // ─── Modal bullet ───
    if (normalized[pos] === "\u2022") {
      tokens.push({
        type: "MODAL",
        value: "\u2022",
        position: pos,
        normalized: "bullet",
      });
      pos++;
      continue;
    }

    // ─── Self reference: ~ ───
    if (normalized[pos] === "~") {
      tokens.push({
        type: "MODIFIER",
        value: "~",
        position: pos,
        normalized: "self",
      });
      pos++;
      continue;
    }

    // ─── Punctuation ───
    if (",;.\u2014-".includes(normalized[pos])) {
      // em-dash and en-dash
      if (normalized[pos] === "\u2014" || (normalized[pos] === "-" && normalized[pos + 1] === " ")) {
        tokens.push({
          type: "PUNCTUATION",
          value: normalized[pos],
          position: pos,
          normalized: "dash",
        });
        pos++;
        continue;
      }
      tokens.push({
        type: "PUNCTUATION",
        value: normalized[pos],
        position: pos,
      });
      pos++;
      continue;
    }

    // ─── Parenthesized reminder text — skip entirely ───
    if (normalized[pos] === "(") {
      const closeIdx = normalized.indexOf(")", pos);
      if (closeIdx !== -1) {
        pos = closeIdx + 1;
        continue;
      }
    }

    // ─── Quote marks — skip ───
    if (normalized[pos] === '"' || normalized[pos] === "'") {
      pos++;
      continue;
    }

    // ─── Try multi-word alias matches ───
    // Extract the current word from pre-lowercased text to look up candidates.
    // Only aliases sharing the same first word are checked.
    let multiMatched = false;

    // Use sticky regex on the lowercased text to extract the first word at pos
    WORD_RE.lastIndex = pos;
    const firstWordMatch = WORD_RE.exec(normalizedLower);
    if (firstWordMatch) {
      const firstWord = firstWordMatch[0];
      const candidates = ALIAS_BY_FIRST_WORD.get(firstWord);
      if (candidates) {
        for (const alias of candidates) {
          // Check if the lowercased text starting at pos matches the alias pattern
          if (
            normalizedLower.length - pos >= alias.pattern.length &&
            normalizedLower.startsWith(alias.pattern, pos)
          ) {
            // Verify word boundary after the match
            const afterIdx = pos + alias.pattern.length;
            if (
              afterIdx >= normalized.length ||
              WORD_BOUNDARY_RE.test(normalized[afterIdx])
            ) {
              tokens.push({
                type: alias.type,
                value: normalized.slice(pos, afterIdx),
                position: pos,
                normalized: alias.normalized,
              });
              pos = afterIdx;
              multiMatched = true;
              break;
            }
          }
        }
      }
    }
    if (multiMatched) continue;

    // ─── Extract next word ───
    WORD_RE.lastIndex = pos;
    const wordMatch = WORD_RE.exec(normalized);
    if (!wordMatch) {
      // Number
      NUM_RE.lastIndex = pos;
      const numMatch = NUM_RE.exec(normalized);
      if (numMatch) {
        tokens.push({
          type: "NUMBER",
          value: numMatch[0],
          position: pos,
        });
        pos += numMatch[0].length;
        continue;
      }
      // Unknown character — skip
      pos++;
      continue;
    }

    const word = wordMatch[0];
    // Use pre-lowercased text to get the lowercase word without allocation
    const wordLower = normalizedLower.slice(pos, pos + word.length);
    const wordEnd = pos + word.length;

    // ─── Classify single word ───
    if (TRIGGER_WORDS.has(wordLower)) {
      tokens.push({ type: "TRIGGER_WORD", value: word, position: pos, normalized: wordLower });
    } else if (wordLower === "dies" || wordLower === "die") {
      tokens.push({ type: "ZONE_TRANSITION", value: word, position: pos, normalized: "dies" });
    } else if (wordLower === "attacks") {
      tokens.push({ type: "PLAYER_ACTION", value: word, position: pos, normalized: "declare_attacker" });
    } else if (wordLower === "blocks") {
      tokens.push({ type: "PLAYER_ACTION", value: word, position: pos, normalized: "declare_blocker" });
    } else if (CARD_TYPES.has(wordLower)) {
      tokens.push({ type: "CARD_TYPE", value: word, position: pos, normalized: wordLower });
    } else if (SUPERTYPES.has(wordLower)) {
      tokens.push({ type: "SUPERTYPE", value: word, position: pos, normalized: wordLower });
    } else if (SUBTYPES.has(wordLower)) {
      tokens.push({ type: "SUBTYPE", value: word, position: pos, normalized: wordLower });
    } else if (ZONES.has(wordLower)) {
      // Disambiguate "exile" — when followed by a word that indicates verb
      // usage (e.g., "exile it", "exile them", "exile target"), classify as
      // EFFECT_VERB instead of ZONE. Multi-word phrases like "exile target"
      // and "exile all" are already handled above by MULTI_WORD_ALIASES;
      // this catches remaining verb-context cases for standalone "exile".
      if (wordLower === "exile") {
        AFTER_EXILE_RE.lastIndex = wordEnd;
        const afterExile = AFTER_EXILE_RE.exec(normalized);
        const nextWordLower = afterExile ? afterExile[1].toLowerCase() : "";
        if (EXILE_VERB_CONTEXT.has(nextWordLower)) {
          tokens.push({ type: "EFFECT_VERB", value: word, position: pos, normalized: wordLower });
          pos = wordEnd;
          continue;
        }
      }
      tokens.push({ type: "ZONE", value: word, position: pos, normalized: wordLower });
    } else if (EFFECT_VERBS.has(wordLower)) {
      tokens.push({ type: "EFFECT_VERB", value: word, position: pos, normalized: wordLower });
    } else if (KEYWORDS_SET.has(wordLower)) {
      // Handle "first strike" and "double strike" as compound keywords
      if (wordLower === "first" || wordLower === "double") {
        STRIKE_RE.lastIndex = wordEnd;
        const nextWord = STRIKE_RE.exec(normalized);
        if (nextWord) {
          tokens.push({
            type: "KEYWORD",
            value: word + " " + nextWord[1],
            position: pos,
            normalized: wordLower + "_strike",
          });
          pos = wordEnd + nextWord[0].length;
          continue;
        }
      }
      tokens.push({ type: "KEYWORD", value: word, position: pos, normalized: wordLower });
    } else if (MODIFIERS.has(wordLower)) {
      tokens.push({ type: "MODIFIER", value: word, position: pos, normalized: wordLower });
    } else if (wordLower in QUANTITY_WORDS) {
      tokens.push({
        type: "QUANTITY",
        value: word,
        position: pos,
        normalized: QUANTITY_WORDS[wordLower],
      });
    } else if (CONJUNCTIONS.has(wordLower)) {
      tokens.push({ type: "CONJUNCTION", value: word, position: pos, normalized: wordLower });
    } else if (wordLower === "if" || wordLower === "unless" || wordLower === "would" || wordLower === "instead") {
      tokens.push({ type: "CONDITIONAL", value: word, position: pos, normalized: wordLower });
    } else if (wordLower === "x") {
      tokens.push({ type: "QUANTITY", value: word, position: pos, normalized: "X" });
    } else {
      // Unrecognized word — preserve as TEXT
      tokens.push({ type: "TEXT", value: word, position: pos });
    }

    pos = wordEnd;
  }

  return tokens;
}

/**
 * Tokenize complete oracle text (potentially multiple abilities).
 * Returns an array of ability blocks, each containing Token[].
 *
 * Compiles the card-name regex once and reuses it across all ability blocks,
 * avoiding redundant regex compilation per block.
 */
export function tokenize(
  oracleText: string,
  cardName: string = ""
): { blocks: Token[][]; raw: string } {
  // Compile card-name regex once, reuse across all ability blocks
  let cardNameRegex: RegExp | undefined;
  if (cardName.length > 0) {
    const escapedName = cardName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cardNameRegex = new RegExp(escapedName, "gi");
  }

  const abilityBlocks = splitAbilityBlocks(oracleText);
  const blocks = abilityBlocks.map((block) =>
    tokenizeAbility(block, cardName, cardNameRegex)
  );

  return { blocks, raw: oracleText };
}
