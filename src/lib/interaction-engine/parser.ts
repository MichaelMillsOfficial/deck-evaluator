/**
 * Oracle Text Parser — Transforms Token[] streams into AbilityNode ASTs.
 *
 * Handles:
 * - Ability type classification (triggered, activated, keyword, static,
 *   replacement, spell effect)
 * - Cost parsing ({T}, sacrifice, pay life, mana, discard, etc.)
 * - Additional cost parsing ("As an additional cost to cast this spell, ...")
 * - Alternative cost parsing ("... rather than pay this spell's mana cost")
 * - Effect parsing (draw, create token, destroy, exile, damage, mana, counters,
 *   sacrifice, return, search)
 * - Trigger parsing (zone transitions, phase triggers, player actions, damage)
 * - Duration parsing (until end of turn, until next turn, as long as)
 * - Condition parsing (if, unless, as long as)
 * - Replacement effect detection (would/instead pattern)
 * - Speed assignment (mana_ability, instant, sorcery)
 */

import type {
  Token,
  TokenType,
  AbilityNode,
  TriggeredAbility,
  ActivatedAbility,
  KeywordAbility,
  StaticAbility,
  ReplacementAbility,
  SpellEffect,
  CastingCost,
  GameEvent,
  ZoneTransition,
  PhaseTrigger,
  PlayerAction,
  DamageEvent,
  Effect,
  Cost,
  Condition,
  GameObjectRef,
  Controller,
  RefModifier,
  Zone,
  CardType,
} from "./types";
import type { Speed, Phase, Step } from "./rules/types";
import { tokenizeAbility } from "./lexer";
import { parseConditionStructured } from "./condition-parser";

// ═══════════════════════════════════════════════════════════════════
// TOKEN STREAM HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Look up a token by type in a Token[] */
function hasType(tokens: Token[], type: TokenType): boolean {
  return tokens.some((t) => t.type === type);
}

/** Check if normalized value exists */
function hasNormalized(tokens: Token[], normalized: string): boolean {
  return tokens.some((t) => t.normalized === normalized);
}

/** Find the index of the cost separator ":" */
function findCostSeparatorIndex(tokens: Token[]): number {
  return tokens.findIndex((t) => t.type === "COST_SEPARATOR");
}

/** Split tokens at a given index, returning [before, after] */
function splitAt(tokens: Token[], index: number): [Token[], Token[]] {
  return [tokens.slice(0, index), tokens.slice(index + 1)];
}

/**
 * Find the first comma after a trigger word and before effects.
 * Triggered abilities follow "When/Whenever/At [trigger], [effects]"
 */
function findTriggerCommaIndex(tokens: Token[]): number {
  // Skip the initial trigger word
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i].type === "PUNCTUATION" && tokens[i].value === ",") {
      return i;
    }
  }
  return -1;
}

// ═══════════════════════════════════════════════════════════════════
// ABILITY TYPE CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════

type AbilityClass =
  | "triggered"
  | "activated"
  | "keyword"
  | "static"
  | "replacement"
  | "spell_effect"
  | "keyword_list";

/**
 * Classify what type of ability a token block represents.
 */
function classifyAbility(tokens: Token[]): AbilityClass {
  if (tokens.length === 0) return "spell_effect";

  const first = tokens[0];

  // ─── Replacement effect: "If ... would ... instead" ───
  if (
    first.type === "CONDITIONAL" &&
    first.normalized === "if" &&
    hasNormalized(tokens, "would") &&
    hasNormalized(tokens, "instead")
  ) {
    return "replacement";
  }

  // ─── Intervening-if triggered: "If [zone_transition], [effect]" ───
  // e.g. "If Gaea's Blessing is put into a graveyard from a library, ..."
  // These are triggered abilities phrased with "If" instead of "When/Whenever".
  // Must NOT have "would" (that's a replacement effect) and MUST contain a
  // zone transition to distinguish from other conditionals.
  if (
    first.type === "CONDITIONAL" &&
    first.normalized === "if" &&
    !hasNormalized(tokens, "would") &&
    hasType(tokens, "ZONE_TRANSITION")
  ) {
    return "triggered";
  }

  // ─── Triggered: starts with "when", "whenever", or "at" (phase trigger) ───
  if (first.type === "TRIGGER_WORD") {
    return "triggered";
  }

  // ─── Phase trigger detected via multi-word alias ───
  if (
    first.normalized &&
    (first.normalized.includes("_trigger") ||
      first.normalized === "upkeep_trigger_you" ||
      first.normalized === "end_step_trigger_each" ||
      first.normalized === "combat_trigger_you")
  ) {
    return "triggered";
  }

  // ─── Activated: has cost separator ":" ───
  if (hasType(tokens, "COST_SEPARATOR")) {
    return "activated";
  }

  // ─── Keyword list: comma-separated keywords ───
  if (isKeywordList(tokens)) {
    return "keyword_list";
  }

  // ─── Single keyword ───
  if (isKeyword(tokens)) {
    return "keyword";
  }

  // ─── Static: continuous effect patterns ───
  if (isStaticAbility(tokens)) {
    return "static";
  }

  // ─── Spell effect: one-shot effect (instant/sorcery) ───
  return "spell_effect";
}

/** Check if tokens represent a single keyword (possibly with parameter) */
function isKeyword(tokens: Token[]): boolean {
  const significant = tokens.filter(
    (t) => t.type !== "PUNCTUATION"
  );

  if (significant.length === 0) return false;

  // Single keyword token
  if (significant.length === 1 && significant[0].type === "KEYWORD") {
    return true;
  }

  // Keyword + parameter (number or mana symbol)
  if (
    significant.length === 2 &&
    significant[0].type === "KEYWORD" &&
    (significant[1].type === "NUMBER" || significant[1].type === "MANA_SYMBOL")
  ) {
    return true;
  }

  return false;
}

/** Check if tokens are a comma-separated keyword list */
function isKeywordList(tokens: Token[]): boolean {
  const keywords = tokens.filter((t) => t.type === "KEYWORD");
  const punctuation = tokens.filter(
    (t) => t.type === "PUNCTUATION" && t.value === ","
  );

  // Must have 2+ keywords and commas between them
  if (keywords.length >= 2 && punctuation.length >= 1) {
    // Verify all non-punctuation, non-keyword, non-number tokens are negligible
    // Numbers are allowed for keyword parameters (e.g., "flying, ward 3")
    const otherCount = tokens.filter(
      (t) => t.type !== "KEYWORD" && t.type !== "PUNCTUATION" && t.type !== "NUMBER"
    ).length;
    return otherCount === 0;
  }

  return false;
}

/** Check if tokens represent a static ability */
function isStaticAbility(tokens: Token[]): boolean {
  // Patterns: "X get/gets/have/has [effect]", "X you control get ..."
  // Look for stat mods with "get/gets" or keyword grants with "have/has"
  if (hasType(tokens, "STAT_MOD")) return true;

  // Check for "get/gets/have/has" as TEXT tokens (used with card type or controller)
  const hasGetOrHave = tokens.some(
    (t) => t.type === "TEXT" && /^(get|gets|ha(ve|s))$/i.test(t.value)
  );

  if (!hasGetOrHave) return false;
  if (hasType(tokens, "TRIGGER_WORD") || hasType(tokens, "COST_SEPARATOR")) return false;

  // "Creatures you control have flying" / "Other creatures you control get +1/+1"
  if (hasType(tokens, "CARD_TYPE") && (hasType(tokens, "KEYWORD") || hasType(tokens, "STAT_MOD"))) {
    return true;
  }

  // "All Slivers have indestructible" / "Sliver creatures get +1/+1"
  if (hasType(tokens, "SUBTYPE") && (hasType(tokens, "KEYWORD") || hasType(tokens, "STAT_MOD"))) {
    return true;
  }

  // Also match when controller is present: "[X] you control have [keyword]"
  if (hasType(tokens, "CONTROLLER") && hasType(tokens, "KEYWORD")) {
    return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════════
// COST PARSING
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse tokens before the cost separator into Cost[].
 */
function parseCosts(tokens: Token[]): Cost[] {
  const costs: Cost[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    // Skip punctuation (commas between costs)
    if (token.type === "PUNCTUATION") {
      i++;
      continue;
    }

    // ─── Tap: {T} ───
    if (token.type === "MANA_SYMBOL" && token.value === "{T}") {
      costs.push({ costType: "tap" });
      i++;
      continue;
    }

    // ─── Untap: {Q} ───
    if (token.type === "MANA_SYMBOL" && token.value === "{Q}") {
      costs.push({ costType: "untap" });
      i++;
      continue;
    }

    // ─── Mana symbols ───
    if (token.type === "MANA_SYMBOL") {
      costs.push({ costType: "mana", mana: token.value });
      i++;
      continue;
    }

    // ─── Pay N life ───
    if (
      token.type === "TEXT" &&
      token.value.toLowerCase() === "pay" &&
      i + 1 < tokens.length
    ) {
      // "Pay 50 life" or "Pay {N} life"
      const next = tokens[i + 1];
      if (next.type === "NUMBER") {
        const lifeAmount = parseInt(next.value, 10);
        // Check for "life" after the number
        if (
          i + 2 < tokens.length &&
          tokens[i + 2].type === "TEXT" &&
          tokens[i + 2].value.toLowerCase() === "life"
        ) {
          costs.push({ costType: "pay_life", quantity: lifeAmount });
          i += 3;
          continue;
        }
      }
    }

    // ─── Sacrifice: "Sacrifice a/an [type]" ───
    if (
      token.type === "EFFECT_VERB" &&
      token.normalized === "sacrifice"
    ) {
      const objRef = parseObjectRefFrom(tokens, i + 1);
      costs.push({
        costType: "sacrifice",
        object: objRef.ref,
      });
      i = objRef.endIndex;
      continue;
    }

    // ─── Discard: "Discard a/an [type]" ───
    if (
      token.type === "EFFECT_VERB" &&
      token.normalized === "discard"
    ) {
      costs.push({ costType: "discard" });
      // Skip to next comma or end
      while (i < tokens.length && tokens[i].type !== "PUNCTUATION") i++;
      continue;
    }

    i++;
  }

  return costs;
}

// ═══════════════════════════════════════════════════════════════════
// EFFECT PARSING
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse the effect portion of an ability into Effect[].
 */
function parseEffects(tokens: Token[]): Effect[] {
  const effects: Effect[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    // Skip punctuation and conjunctions
    if (token.type === "PUNCTUATION" || token.type === "CONJUNCTION") {
      i++;
      continue;
    }

    // ─── Draw card(s) ───
    if (
      token.type === "EFFECT_VERB" &&
      (token.normalized === "draw_card" ||
        token.normalized === "draw_cards_2" ||
        token.normalized === "draw_cards_3" ||
        token.normalized === "draw_cards" ||
        token.normalized === "draw")
    ) {
      const qty = token.normalized === "draw_cards_2"
        ? 2
        : token.normalized === "draw_cards_3"
          ? 3
          : 1;
      effects.push({
        type: "draw",
        resource: { category: "cards", quantity: qty },
      });
      i++;
      continue;
    }

    // ─── Add mana ───
    if (
      token.type === "EFFECT_VERB" &&
      token.normalized === "add"
    ) {
      // Collect subsequent mana symbols
      const manaSymbols: string[] = [];
      let j = i + 1;
      while (j < tokens.length && tokens[j].type === "MANA_SYMBOL") {
        manaSymbols.push(tokens[j].value);
        j++;
      }
      for (const sym of manaSymbols) {
        const color = parseManaColor(sym);
        effects.push({
          type: "add_mana",
          resource: { category: "mana", color, quantity: 1 },
        });
      }
      i = j;
      continue;
    }

    // ─── Destroy target ───
    if (
      token.type === "EFFECT_VERB" &&
      (token.normalized === "destroy_target" || token.normalized === "destroy_all")
    ) {
      const targetRef = parseObjectRefFrom(tokens, i + 1);
      effects.push({
        type: token.normalized === "destroy_all" ? "destroy_all" : "destroy",
        gameEffect: {
          category: "destroy",
          target: targetRef.ref,
        },
      });
      i = targetRef.endIndex;
      continue;
    }

    // ─── Destroy (single word) ───
    if (
      token.type === "EFFECT_VERB" &&
      token.normalized === "destroy"
    ) {
      const targetRef = parseObjectRefFrom(tokens, i + 1);
      effects.push({
        type: "destroy",
        gameEffect: {
          category: "destroy",
          target: targetRef.ref,
        },
      });
      i = targetRef.endIndex;
      continue;
    }

    // ─── Exile target ───
    if (
      token.type === "EFFECT_VERB" &&
      (token.normalized === "exile_target" ||
        token.normalized === "exile_all" ||
        token.normalized === "exile")
    ) {
      const targetRef = parseObjectRefFrom(tokens, i + 1);
      effects.push({
        type: "exile",
        gameEffect: {
          category: "exile",
          target: targetRef.ref,
        },
      });
      i = targetRef.endIndex;
      continue;
    }

    // ─── Deal damage ───
    if (
      (token.type === "EFFECT_VERB" &&
        (token.normalized === "deals" || token.normalized === "deal" ||
          token.normalized === "deals_damage" || token.normalized === "damage_to_player")) ||
      (token.type === "PLAYER_ACTION" &&
        (token.normalized === "deals_damage" || token.normalized === "damage_to_player" ||
          token.normalized === "damage_to_opponent"))
    ) {
      let dmgQty: number | "X" = 0;
      let j = i + 1;
      // Look for damage amount
      if (j < tokens.length && tokens[j].type === "NUMBER") {
        dmgQty = parseInt(tokens[j].value, 10);
        j++;
      }
      effects.push({
        type: "damage",
        gameEffect: {
          category: "damage",
          quantity: dmgQty,
          target: { types: [], quantity: "one", modifiers: [] },
        },
      });
      i = j;
      // Skip past "damage to any target" etc.
      while (i < tokens.length && tokens[i].type !== "PUNCTUATION" && tokens[i].type !== "CONJUNCTION") i++;
      continue;
    }

    // ─── Sacrifice (as effect, not cost) ───
    if (
      token.type === "EFFECT_VERB" &&
      (token.normalized === "sacrifice" || token.normalized === "sacrifices")
    ) {
      const targetRef = parseObjectRefFrom(tokens, i + 1);
      effects.push({
        type: "sacrifice",
        target: targetRef.ref,
      });
      i = targetRef.endIndex;
      continue;
    }

    // ─── Create token ───
    if (
      token.type === "EFFECT_VERB" &&
      (token.normalized === "create_token" ||
        token.normalized === "create_treasure" ||
        token.normalized === "create_food" ||
        token.normalized === "create_clue")
    ) {
      const tokenType = token.normalized.replace("create_", "");
      effects.push({
        type: "create_token",
        gameEffect: {
          category: "create_token",
          token: {
            types: ["artifact"],
            subtypes: [tokenType],
            name: capitalize(tokenType),
          },
          quantity: 1,
        },
      });
      i++;
      continue;
    }

    // ─── Search library ───
    if (
      token.type === "PLAYER_ACTION" &&
      token.normalized === "search_library"
    ) {
      // Look ahead for "for a [TYPE/SUBTYPE] card" to capture search target
      let searchTarget: GameObjectRef | undefined;
      let j = i + 1;
      // Find "for" keyword in the remaining tokens
      while (j < tokens.length && tokens[j].type !== "PUNCTUATION") {
        if (tokens[j].type === "TEXT" && tokens[j].value.toLowerCase() === "for") {
          const targetRef = parseObjectRefFrom(tokens, j + 1);
          // Only use target if we found meaningful type info
          if (targetRef.ref.types.length > 0 || (targetRef.ref.subtypes && targetRef.ref.subtypes.length > 0)) {
            searchTarget = targetRef.ref;
          }
          j = targetRef.endIndex;
          break;
        }
        j++;
      }
      effects.push({
        type: "search_library",
        target: searchTarget,
      });
      // Skip rest of the search clause
      while (j < tokens.length && tokens[j].type !== "PUNCTUATION") j++;
      i = j;
      continue;
    }

    // ─── Gain/Lose life (from multi-word aliases) ───
    if (
      token.type === "STATE_CHANGE" &&
      (token.normalized === "gains_life" || token.normalized === "loses_life")
    ) {
      let qty = 1;
      // Look for a number after this
      if (i + 1 < tokens.length && tokens[i + 1].type === "NUMBER") {
        qty = parseInt(tokens[i + 1].value, 10);
        i++;
      }
      effects.push({
        type: token.normalized === "gains_life" ? "gain_life" : "lose_life",
        resource: {
          category: "life",
          quantity: qty,
        },
      });
      i++;
      continue;
    }

    // ─── Gain/Lose life (from individual tokens: gains/loses/gain/lose) ───
    if (
      token.type === "EFFECT_VERB" &&
      (token.normalized === "gain" || token.normalized === "gains" ||
        token.normalized === "lose" || token.normalized === "loses")
    ) {
      // Check if followed by number + "life"
      const lookahead = tokens.slice(i + 1, i + 4);
      const numToken = lookahead.find((t) => t.type === "NUMBER" || t.type === "QUANTITY");
      const lifeToken = lookahead.find(
        (t) => t.type === "TEXT" && t.value.toLowerCase() === "life"
      );

      if (numToken && lifeToken) {
        const qty =
          numToken.type === "NUMBER"
            ? parseInt(numToken.value, 10)
            : numToken.normalized === "1"
              ? 1
              : parseInt(numToken.normalized || "1", 10);
        const isGain = token.normalized === "gain" || token.normalized === "gains";
        effects.push({
          type: isGain ? "gain_life" : "lose_life",
          resource: {
            category: "life",
            quantity: qty,
          },
        });
        // Skip past the life clause
        i = tokens.indexOf(lifeToken) + 1;
        continue;
      }
    }

    // ─── Put counters ───
    if (
      token.type === "EFFECT_VERB" &&
      (token.normalized === "put_p1p1_counter" || token.normalized === "put_m1m1_counter" ||
        token.normalized === "put")
    ) {
      if (token.normalized === "put_p1p1_counter") {
        const targetRef = parseObjectRefFrom(tokens, i + 1);
        effects.push({
          type: "put_counter",
          attribute: {
            category: "counter",
            counterType: "+1/+1",
            quantity: 1,
          },
          target: targetRef.ref,
        });
        i = targetRef.endIndex;
        continue;
      }
      if (token.normalized === "put_m1m1_counter") {
        const targetRef = parseObjectRefFrom(tokens, i + 1);
        effects.push({
          type: "put_counter",
          attribute: {
            category: "counter",
            counterType: "-1/-1",
            quantity: 1,
          },
          target: targetRef.ref,
        });
        i = targetRef.endIndex;
        continue;
      }
      // Generic "put" — look for counter context
      if (i + 1 < tokens.length) {
        const rest = tokens.slice(i + 1);
        const statMod = rest.find((t) => t.type === "STAT_MOD");
        if (statMod) {
          const targetRef = parseObjectRefFrom(tokens, tokens.indexOf(statMod) + 1);
          effects.push({
            type: "put_counter",
            attribute: {
              category: "counter",
              counterType: statMod.value,
              quantity: 1,
            },
            target: targetRef.ref,
          });
          i = targetRef.endIndex;
          continue;
        }
      }
    }

    // ─── Stat modification (from STAT_MOD token directly) ───
    if (token.type === "STAT_MOD") {
      effects.push({
        type: "stat_mod",
        attribute: {
          category: "stat_mod",
          power: parseStatComponent(token.value, "power"),
          toughness: parseStatComponent(token.value, "toughness"),
        },
      });
      i++;
      continue;
    }

    // ─── Self reference deals damage ───
    if (
      token.type === "MODIFIER" &&
      token.normalized === "self" &&
      i + 1 < tokens.length
    ) {
      const next = tokens[i + 1];
      if (
        (next.type === "EFFECT_VERB" &&
          (next.normalized === "deals" || next.normalized === "deal")) ||
        (next.type === "PLAYER_ACTION" &&
          (next.normalized === "deals_damage" || next.normalized === "damage_to_player" ||
            next.normalized === "damage_to_opponent"))
      ) {
        let dmgQty: number | "X" = 0;
        let j = i + 2;
        if (j < tokens.length && tokens[j].type === "NUMBER") {
          dmgQty = parseInt(tokens[j].value, 10);
          j++;
        }
        effects.push({
          type: "damage",
          gameEffect: {
            category: "damage",
            quantity: dmgQty,
            target: { types: [], quantity: "one", modifiers: [] },
          },
        });
        i = j;
        // Skip past the rest
        while (i < tokens.length && tokens[i].type !== "PUNCTUATION" && tokens[i].type !== "CONJUNCTION") i++;
        continue;
      }
    }

    // ─── Keyword grants: "gains/have [keyword]" ───
    if (
      token.type === "EFFECT_VERB" &&
      (token.normalized === "grant_flying" ||
        token.normalized === "grant_haste" ||
        token.normalized === "grant_lifelink" ||
        token.normalized === "grant_indestructible" ||
        token.normalized === "grant_trample")
    ) {
      const kw = token.normalized.replace("grant_", "");
      effects.push({
        type: "grant_keyword",
        attribute: {
          category: "keyword_grant",
          keyword: kw,
        },
      });
      i++;
      continue;
    }

    // ─── Duration detection: apply to previous effect ───
    if (
      token.type === "CONDITIONAL" &&
      token.normalized === "until_eot"
    ) {
      // Apply duration to the most recent effect
      if (effects.length > 0) {
        effects[effects.length - 1].duration = { type: "until_end_of_turn" };
      }
      i++;
      continue;
    }

    if (
      token.type === "CONDITIONAL" &&
      token.normalized === "until_next_turn"
    ) {
      if (effects.length > 0) {
        effects[effects.length - 1].duration = { type: "until_next_turn" };
      }
      i++;
      continue;
    }

    // ─── Counter a spell ───
    if (
      token.type === "EFFECT_VERB" &&
      token.normalized === "counter"
    ) {
      effects.push({ type: "counter_spell" });
      i++;
      // Skip "target spell" etc.
      while (i < tokens.length && tokens[i].type !== "PUNCTUATION") i++;
      continue;
    }

    // ─── Return from zone ───
    if (
      token.type === "EFFECT_VERB" &&
      (token.normalized === "return_target" || token.normalized === "return_it" || token.normalized === "return")
    ) {
      const targetRef = parseObjectRefFrom(tokens, i + 1);

      // Extract source zone from context (look for ZONE tokens before the verb
      // or in the target ref span, e.g. "from your graveyard", "from exile")
      let fromZone: Zone = "graveyard"; // default
      let toZone: Zone = "battlefield"; // default
      const searchStart = Math.max(0, i - 3);
      const searchEnd = Math.min(tokens.length, targetRef.endIndex + 5);
      let foundFrom = false;
      let foundTo = false;
      for (let k = searchStart; k < searchEnd; k++) {
        const tk = tokens[k];
        if (tk.type === "ZONE" && tk.normalized) {
          // Check if this zone follows "from" or "to" by looking at the preceding token
          if (k > 0) {
            const prev = tokens[k - 1];
            if (prev.type === "TEXT" && prev.value.toLowerCase() === "from") {
              fromZone = tk.normalized as Zone;
              foundFrom = true;
              continue;
            }
            if (prev.type === "TEXT" && prev.value.toLowerCase() === "to") {
              toZone = tk.normalized as Zone;
              foundTo = true;
              continue;
            }
          }
          // Check if "to" follows via next tokens: "to your hand" → ZONE token for "hand"
          if (k > 1) {
            const prevPrev = tokens[k - 2];
            if (prevPrev.type === "TEXT" && prevPrev.value.toLowerCase() === "to") {
              toZone = tk.normalized as Zone;
              foundTo = true;
              continue;
            }
            if (prevPrev.type === "TEXT" && prevPrev.value.toLowerCase() === "from") {
              fromZone = tk.normalized as Zone;
              foundFrom = true;
              continue;
            }
          }
          // Unattributed zone: if before the verb, likely source; if after, likely destination
          if (!foundFrom && k < i) {
            fromZone = tk.normalized as Zone;
          } else if (!foundTo && k > i) {
            toZone = tk.normalized as Zone;
          }
        }
      }

      // Check for "to your hand" / "to the battlefield" / "on top of library"
      // patterns using TEXT tokens that may indicate destination
      for (let k = targetRef.endIndex; k < searchEnd; k++) {
        const tk = tokens[k];
        if (tk.type === "TEXT") {
          const lower = tk.value.toLowerCase();
          if (lower === "top" && k + 2 < tokens.length) {
            // "on top of library" pattern
            const libToken = tokens[k + 1]?.type === "TEXT" && tokens[k + 1]?.value.toLowerCase() === "of"
              ? tokens[k + 2]
              : null;
            if (libToken?.type === "ZONE" && libToken.normalized === "library") {
              toZone = "library";
            }
          }
        }
      }

      // Blink context: if no explicit "from ZONE" was found and a preceding
      // exile effect exists in this ability (e.g. "exile X, then return that
      // card to the battlefield"), the return is from exile, not graveyard.
      if (!foundFrom) {
        const hasPrecedingExile = effects.some(
          (e) => e.type === "exile" || e.type === "exile_zone_transition" ||
                 (e.zoneTransition?.to === "exile")
        );
        if (hasPrecedingExile) {
          fromZone = "exile";
        }
      }

      effects.push({
        type: "return",
        gameEffect: {
          category: "return",
          target: targetRef.ref,
          from: fromZone,
          to: toZone,
        },
      });
      i = targetRef.endIndex;
      continue;
    }

    // ─── Mill ───
    if (
      token.type === "EFFECT_VERB" &&
      token.normalized === "mill"
    ) {
      let qty = 1;
      if (i + 1 < tokens.length && tokens[i + 1].type === "NUMBER") {
        qty = parseInt(tokens[i + 1].value, 10);
        i++;
      }
      effects.push({ type: "mill", quantity: qty });
      i++;
      continue;
    }

    // ─── Scry ───
    if (
      token.type === "EFFECT_VERB" &&
      token.normalized === "scry"
    ) {
      let qty = 1;
      if (i + 1 < tokens.length && tokens[i + 1].type === "NUMBER") {
        qty = parseInt(tokens[i + 1].value, 10);
        i++;
      }
      effects.push({ type: "scry", quantity: qty });
      i++;
      continue;
    }

    // ─── Shuffle ───
    if (
      token.type === "EFFECT_VERB" &&
      token.normalized === "shuffle"
    ) {
      effects.push({ type: "shuffle" });
      i++;
      continue;
    }

    // ─── Tap/Untap effect ───
    if (
      token.type === "EFFECT_VERB" &&
      (token.normalized === "tap" || token.normalized === "untap")
    ) {
      const targetRef = parseObjectRefFrom(tokens, i + 1);
      effects.push({
        type: token.normalized,
        target: targetRef.ref,
      });
      i = targetRef.endIndex;
      continue;
    }

    i++;
  }

  return effects;
}

// ═══════════════════════════════════════════════════════════════════
// TRIGGER PARSING
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse a trigger clause (tokens before the comma in a triggered ability)
 * into a GameEvent.
 */
function parseTrigger(tokens: Token[]): GameEvent | null {
  // ─── Phase triggers: "At the beginning of ..." ───
  const phaseTriggerToken = tokens.find(
    (t) =>
      t.type === "TRIGGER_WORD" &&
      t.normalized !== undefined &&
      t.normalized.includes("_trigger")
  );

  if (phaseTriggerToken) {
    return parsePhaseTrigger(phaseTriggerToken);
  }

  // ─── Zone transitions ───
  const ztToken = tokens.find((t) => t.type === "ZONE_TRANSITION");

  if (ztToken) {
    return parseZoneTransitionTrigger(ztToken, tokens);
  }

  // ─── Player actions ───
  const paToken = tokens.find((t) => t.type === "PLAYER_ACTION");

  if (paToken) {
    return parsePlayerActionTrigger(paToken, tokens);
  }

  // ─── Damage triggers ───
  if (hasNormalized(tokens, "deals_damage") || hasNormalized(tokens, "deals")) {
    return {
      kind: "damage",
      source: { types: [], quantity: "one", modifiers: [] },
      target: { types: [], quantity: "one", modifiers: [] },
      quantity: 0,
      isCombatDamage: hasNormalized(tokens, "combat_damage"),
    };
  }

  // ─── State change: "gains life" / "loses life" ───
  const stateToken = tokens.find((t) => t.type === "STATE_CHANGE");
  if (stateToken) {
    return {
      kind: "state_change",
      property: stateToken.normalized === "gains_life" || stateToken.normalized === "loses_life"
        ? "life_total"
        : "tapped",
    };
  }

  // ─── Effect verbs as trigger conditions: "draws a card", "sacrifices" ───
  const effectVerbTrigger = tokens.find(
    (t) => t.type === "EFFECT_VERB" &&
      (t.normalized === "draw_card" || t.normalized === "draw_cards" ||
        t.normalized === "sacrifices" || t.normalized === "sacrifice")
  );
  if (effectVerbTrigger) {
    const action: PlayerAction["action"] =
      effectVerbTrigger.normalized === "draw_card" || effectVerbTrigger.normalized === "draw_cards"
        ? "draw"
        : "sacrifice";
    return {
      kind: "player_action",
      action,
      object: buildObjectRefFromTokens(tokens),
      details: { action: effectVerbTrigger.normalized },
    };
  }

  // Fallback: return null — we cannot confidently classify this trigger.
  // Returning a false ETB placeholder would pollute the entire interaction graph.
  return null;
}

function parsePhaseTrigger(token: Token): PhaseTrigger {
  const normalized = token.normalized || "";

  let step: Step = "upkeep";
  let phase: Phase = "beginning";
  let player: Controller | undefined;

  if (normalized.includes("upkeep")) {
    step = "upkeep";
    phase = "beginning";
  } else if (normalized.includes("draw_step")) {
    step = "draw";
    phase = "beginning";
  } else if (normalized.includes("combat")) {
    step = "beginning_of_combat";
    phase = "combat";
  } else if (normalized.includes("end_step")) {
    step = "end";
    phase = "ending";
  } else if (normalized.includes("postcombat")) {
    step = "upkeep"; // Main phases don't have substeps; use upkeep as placeholder
    phase = "postcombat_main";
  }

  if (normalized.includes("_you")) player = "you";
  if (normalized.includes("_each")) player = "each";
  if (normalized.includes("_opponents")) player = "opponent";

  return {
    kind: "phase_trigger",
    phase,
    step,
    player,
  };
}

function parseZoneTransitionTrigger(
  ztToken: Token,
  allTokens: Token[]
): ZoneTransition {
  const normalized = ztToken.normalized || "";

  const transition: ZoneTransition = {
    kind: "zone_transition",
    object: buildObjectRefFromTokens(allTokens),
  };

  if (normalized === "etb" || normalized === "etb_your_control") {
    transition.to = "battlefield";
  } else if (normalized === "dies") {
    transition.from = "battlefield";
    transition.to = "graveyard";
    transition.cause = "dies";
  } else if (normalized === "ltb") {
    transition.from = "battlefield";
    // LTB triggers fire regardless of destination — `to` is intentionally omitted
  } else if (normalized === "exiled") {
    transition.to = "exile";
  } else if (normalized === "put_into_graveyard" || normalized === "put_into_graveyard_from_anywhere") {
    transition.to = "graveyard";
  } else if (normalized === "milled") {
    transition.from = "library";
    transition.to = "graveyard";
  } else if (normalized === "bounced") {
    transition.from = "battlefield";
    transition.to = "hand";
  } else if (normalized === "tucked") {
    transition.from = "battlefield";
    transition.to = "library";
  } else if (normalized === "returns_from_exile") {
    transition.from = "exile";
    transition.to = "battlefield";
  }
  // No else fallback — if we don't recognize the zone transition,
  // leave from/to undefined. The caller (parseTrigger) already
  // returns null for fully unrecognized patterns.

  return transition;
}

function parsePlayerActionTrigger(
  paToken: Token,
  allTokens: Token[]
): PlayerAction | DamageEvent {
  const normalized = paToken.normalized || "";

  // "deals combat damage to a player" should be a DamageEvent, not PlayerAction
  if (normalized.includes("damage")) {
    return {
      kind: "damage",
      source: buildObjectRefFromTokens(allTokens),
      target: { types: [], quantity: "one", modifiers: [] },
      quantity: 0,
      isCombatDamage: normalized.includes("combat"),
    };
  }

  let action: PlayerAction["action"] = "cast_spell";

  if (normalized.includes("cast_spell") || normalized.includes("cast")) {
    action = "cast_spell";
  } else if (normalized === "search_library") {
    action = "search_library";
  } else if (normalized === "declare_attacker") {
    action = "declare_attacker";
  } else if (normalized === "declare_blocker") {
    action = "declare_blocker";
  } else if (normalized === "play_land") {
    action = "play_land";
  }

  return {
    kind: "player_action",
    action,
    object: buildObjectRefFromTokens(allTokens),
  };
}

// ═══════════════════════════════════════════════════════════════════
// CONDITION PARSING
// ═══════════════════════════════════════════════════════════════════

/**
 * Extract a condition from tokens if present.
 */
function parseCondition(tokens: Token[]): Condition | undefined {
  // "unless" pattern
  const unlessIdx = tokens.findIndex(
    (t) => t.type === "CONDITIONAL" && t.normalized === "unless"
  );
  if (unlessIdx !== -1) {
    const rest = tokens.slice(unlessIdx + 1);
    const predicate = rest.map((t) => t.value).join(" ");
    return {
      type: "unless",
      predicate,
      structured: parseConditionStructured(predicate),
    };
  }

  // "if you do" / "if you don't" pattern
  const ifDoIdx = tokens.findIndex(
    (t) =>
      t.type === "CONDITIONAL" &&
      (t.normalized === "if_you_do" || t.normalized === "if_you_dont")
  );
  if (ifDoIdx !== -1) {
    const predicate = tokens[ifDoIdx].normalized || "";
    return {
      type: "if",
      predicate,
      structured: parseConditionStructured(predicate),
    };
  }

  // "as long as" pattern
  const asLongIdx = tokens.findIndex(
    (t) => t.type === "CONDITIONAL" && t.normalized === "as_long_as"
  );
  if (asLongIdx !== -1) {
    const rest = tokens.slice(asLongIdx + 1);
    const predicate = rest.map((t) => t.value).join(" ");
    return {
      type: "as_long_as",
      predicate,
      structured: parseConditionStructured(predicate),
    };
  }

  return undefined;
}

// ═══════════════════════════════════════════════════════════════════
// OBJECT REF PARSING
// ═══════════════════════════════════════════════════════════════════

interface ObjectRefResult {
  ref: GameObjectRef;
  endIndex: number;
}

/**
 * Build a GameObjectRef from tokens starting at a given index.
 * Scans forward for card types, subtypes, modifiers, and controller tokens.
 */
function parseObjectRefFrom(tokens: Token[], startIndex: number): ObjectRefResult {
  const ref: GameObjectRef = { types: [], quantity: "one", modifiers: [] };
  let i = startIndex;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === "PUNCTUATION" || token.type === "CONJUNCTION") {
      i++;
      break;
    }

    if (token.type === "CARD_TYPE") {
      const normalized = (token.normalized || token.value).replace(/s$/, "");
      ref.types.push(normalized as CardType);
    } else if (token.type === "SUBTYPE") {
      if (!ref.subtypes) ref.subtypes = [];
      // Normalize plural subtypes to singular (e.g., "slivers" → "sliver")
      let subtype = token.normalized || token.value;
      if (subtype.endsWith("s") && subtype !== "plains") {
        if (subtype === "elves") subtype = "elf";
        else subtype = subtype.replace(/s$/, "");
      }
      ref.subtypes.push(subtype);
    } else if (token.type === "MODIFIER" && token.normalized === "target") {
      ref.modifiers.push("target" as RefModifier);
    } else if (token.type === "MODIFIER" && token.normalized === "other") {
      ref.modifiers.push("other" as RefModifier);
    } else if (token.type === "MODIFIER" && token.normalized?.startsWith("non")) {
      // "noncreature", "nonland", "nonartifact" etc.
      // Store as modifier for now — Capability Extractor will handle exclusion
      ref.modifiers.push(token.normalized as RefModifier);
    } else if (token.type === "MODIFIER" && token.normalized === "self") {
      ref.self = true;
    } else if (token.type === "MODIFIER" && token.normalized === "token") {
      ref.modifiers.push("token" as RefModifier);
    } else if (token.type === "MODIFIER" && token.normalized === "nontoken") {
      ref.modifiers.push("nontoken" as RefModifier);
    } else if (token.type === "CONTROLLER") {
      ref.controller = parseController(token.normalized || "");
    } else if (token.type === "QUANTITY") {
      const norm = token.normalized || token.value;
      if (norm === "all") {
        ref.quantity = "all";
      } else if (norm === "each") {
        ref.quantity = "each";
      } else if (norm === "another") {
        ref.quantity = "another";
      } else if (norm === "X" || norm === "x") {
        ref.quantity = "X";
      } else {
        const n = parseInt(norm, 10);
        ref.quantity = isNaN(n) ? "one" : n;
      }
    }

    i++;
  }

  return { ref, endIndex: i };
}

/**
 * Build a basic GameObjectRef from all tokens (for trigger objects).
 */
function buildObjectRefFromTokens(tokens: Token[]): GameObjectRef {
  const ref: GameObjectRef = { types: [], quantity: "one", modifiers: [] };

  for (const token of tokens) {
    if (token.type === "CARD_TYPE") {
      const normalized = (token.normalized || token.value).replace(/s$/, "");
      ref.types.push(normalized as CardType);
    }
    if (token.type === "SUBTYPE") {
      if (!ref.subtypes) ref.subtypes = [];
      // Normalize plural subtypes to singular (e.g., "slivers" → "sliver")
      let subtype = token.normalized || token.value;
      if (subtype.endsWith("s") && subtype !== "plains") {
        // Special cases: "elves" → "elf", but most just drop the trailing "s"
        if (subtype === "elves") subtype = "elf";
        else subtype = subtype.replace(/s$/, "");
      }
      ref.subtypes.push(subtype);
    }
    if (token.type === "CONTROLLER") {
      ref.controller = parseController(token.normalized || "");
    }
    if (token.type === "MODIFIER" && token.normalized === "self") {
      ref.self = true;
    }
    if (token.type === "MODIFIER" && token.normalized === "other") {
      ref.modifiers.push("other");
    }
    if (token.type === "MODIFIER" && token.normalized === "nontoken") {
      ref.modifiers.push("nontoken");
    }
    if (token.type === "MODIFIER" && token.normalized === "token") {
      ref.modifiers.push("token");
    }
  }

  return ref;
}

function parseController(normalized: string): Controller {
  if (normalized === "you_control" || normalized === "you") return "you";
  if (normalized === "opponent_controls" || normalized === "each_opponent" || normalized === "target_opponent") {
    return "opponent";
  }
  if (normalized === "each_player") return "each";
  if (normalized === "target_player") return "any";
  return "any";
}

// ═══════════════════════════════════════════════════════════════════
// STAT PARSING HELPERS
// ═══════════════════════════════════════════════════════════════════

function parseStatComponent(statMod: string, which: "power" | "toughness"): number | string {
  const parts = statMod.split("/");
  const val = which === "power" ? parts[0] : parts[1];
  if (val === undefined) return 0;
  if (val.includes("X")) return "X";
  return parseInt(val, 10) || 0;
}

function parseManaColor(symbol: string): "W" | "U" | "B" | "R" | "G" | "C" | "any" {
  const inner = symbol.replace(/[{}]/g, "");
  if (inner === "W") return "W";
  if (inner === "U") return "U";
  if (inner === "B") return "B";
  if (inner === "R") return "R";
  if (inner === "G") return "G";
  if (inner === "C") return "C";
  if (/^[0-9]+$/.test(inner)) return "any"; // generic mana (payable with any color, not colorless)
  return "any";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ═══════════════════════════════════════════════════════════════════
// SPEED DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Determine if an activated ability is a mana ability.
 * CR 605.1a: mana abilities must (1) produce mana, (2) not target,
 * and (3) not be loyalty abilities.
 */
function detectSpeed(costs: Cost[], effects: Effect[]): Speed {
  const producesMana = effects.some(
    (e) => e.type === "add_mana" && e.resource?.category === "mana"
  );
  const targets = effects.some(
    (e) => e.target && !e.target.self
  );
  const isLoyaltyAbility = costs.some((c) => c.costType === "loyalty");

  if (producesMana && !targets && !isLoyaltyAbility) {
    return "mana_ability";
  }

  return "instant";
}

// ═══════════════════════════════════════════════════════════════════
// REPLACEMENT EFFECT PARSING
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse a replacement effect from tokens.
 * Pattern: "If [event] would [happen], [instead] [modified event]"
 */
function parseReplacementEffect(tokens: Token[]): ReplacementAbility {
  // Find "would" index
  const wouldIdx = tokens.findIndex(
    (t) => t.type === "CONDITIONAL" && t.normalized === "would"
  );

  // Find "instead" index
  const insteadIdx = tokens.findIndex(
    (t) => t.type === "CONDITIONAL" && t.normalized === "instead"
  );

  // Tokens before "would" describe the intercepted event
  const eventTokens = wouldIdx > 0 ? tokens.slice(1, wouldIdx) : tokens.slice(1);

  // Tokens between "would" and "instead" (or end) describe what would happen
  const actionTokens =
    insteadIdx > wouldIdx
      ? tokens.slice(wouldIdx + 1, insteadIdx)
      : tokens.slice(wouldIdx + 1);

  // Determine the replaced event
  const replacedEvent = parseReplacedEvent(eventTokens, actionTokens);

  // Determine replacement mode
  const mode = detectReplacementMode(tokens);

  // Parse the "with" effects — what happens instead
  const commaIdx = tokens.findIndex(
    (t, idx) => idx > wouldIdx && t.type === "PUNCTUATION" && t.value === ","
  );
  const withTokens = commaIdx > 0 ? tokens.slice(commaIdx + 1) : [];
  const withEffects = parseEffects(withTokens);

  // If no effects parsed but we have "exile it instead", create exile effect
  if (withEffects.length === 0 && hasNormalized(tokens, "exile")) {
    withEffects.push({
      type: "exile",
      gameEffect: {
        category: "exile",
        target: { types: [], quantity: "one", modifiers: [] },
      },
    });
  }

  return {
    abilityType: "replacement",
    replaces: replacedEvent,
    with: withEffects,
    mode,
  };
}

function parseReplacedEvent(eventTokens: Token[], actionTokens: Token[]): GameEvent {
  // Check for zone transition tokens
  const ztToken = [...eventTokens, ...actionTokens].find(
    (t) => t.type === "ZONE_TRANSITION"
  );

  if (ztToken) {
    const normalized = ztToken.normalized || "";
    if (
      normalized === "put_into_graveyard" ||
      normalized === "put_into_graveyard_from_anywhere" ||
      normalized === "dies"
    ) {
      return {
        kind: "zone_transition",
        from: "battlefield",
        to: "graveyard",
        object: buildObjectRefFromTokens(eventTokens),
      };
    }
    if (normalized === "etb") {
      return {
        kind: "zone_transition",
        to: "battlefield",
        object: buildObjectRefFromTokens(eventTokens),
      };
    }
  }

  // Check for "create ... tokens" pattern
  if (
    eventTokens.some(
      (t) =>
        t.type === "EFFECT_VERB" &&
        (t.normalized === "create_token" || t.normalized === "create")
    ) ||
    actionTokens.some(
      (t) =>
        t.type === "EFFECT_VERB" &&
        (t.normalized === "create_token" || t.normalized === "create")
    )
  ) {
    return {
      kind: "zone_transition",
      to: "battlefield",
      object: { types: [], quantity: "one", modifiers: [] },
      cause: "create_token",
    };
  }

  // Check for counter placement
  if (
    eventTokens.some((t) => t.normalized === "put_p1p1_counter" || t.normalized === "put") ||
    actionTokens.some((t) => t.normalized === "put_p1p1_counter" || t.normalized === "put")
  ) {
    return {
      kind: "state_change",
      property: "counters",
    };
  }

  // Fallback
  return {
    kind: "zone_transition",
    to: "graveyard",
    object: buildObjectRefFromTokens(eventTokens),
  };
}

function detectReplacementMode(
  tokens: Token[]
): "replace" | "modify" | "add" | "redirect" | "prevent" {
  // "exile it instead" → replace (the original event is prevented)
  if (hasNormalized(tokens, "exile") && hasNormalized(tokens, "instead")) {
    return "replace";
  }

  // "twice that many" → modify (event still happens, just amplified)
  if (
    tokens.some(
      (t) => t.type === "TEXT" && t.value.toLowerCase() === "twice"
    )
  ) {
    return "modify";
  }

  // "an additional time" → add
  if (
    tokens.some(
      (t) => t.type === "TEXT" && t.value.toLowerCase() === "additional"
    )
  ) {
    return "add";
  }

  // "prevent" → prevent
  if (hasNormalized(tokens, "prevent")) {
    return "prevent";
  }

  // Default to replace
  return "replace";
}

// ═══════════════════════════════════════════════════════════════════
// STATIC ABILITY PARSING
// ═══════════════════════════════════════════════════════════════════

function parseStaticAbility(tokens: Token[]): StaticAbility {
  const effects = parseEffects(tokens);

  // If no effects from the general parser, try to extract stat_mod and keyword_grant
  if (effects.length === 0) {
    // Look for stat mod pattern
    const statMod = tokens.find((t) => t.type === "STAT_MOD");
    if (statMod) {
      effects.push({
        type: "stat_mod",
        attribute: {
          category: "stat_mod",
          power: parseStatComponent(statMod.value, "power"),
          toughness: parseStatComponent(statMod.value, "toughness"),
        },
      });
    }

    // Look for keyword grant via "have/has [keyword]"
    const haveIdx = tokens.findIndex(
      (t) => t.type === "TEXT" && /^ha(ve|s)$/i.test(t.value)
    );
    if (haveIdx !== -1) {
      // Keywords after "have"
      const afterHave = tokens.slice(haveIdx + 1);
      for (const t of afterHave) {
        if (t.type === "KEYWORD") {
          effects.push({
            type: "grant_keyword",
            attribute: {
              category: "keyword_grant",
              keyword: t.normalized || t.value.toLowerCase(),
            },
          });
        }
      }
    }
  }

  // Determine affected objects
  const affectedObjects = buildObjectRefFromTokens(tokens);

  return {
    abilityType: "static",
    effects,
    affectedObjects:
      affectedObjects.types.length > 0 ||
      (affectedObjects.subtypes && affectedObjects.subtypes.length > 0)
        ? affectedObjects
        : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PARSE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse a single token block into an AbilityNode.
 */
export function parseAbility(tokens: Token[]): AbilityNode {
  if (tokens.length === 0) {
    return {
      abilityType: "spell_effect",
      effects: [],
      castingCost: {
        manaCost: "",
        manaValue: 0,
        additionalCosts: [],
      },
    };
  }

  const classification = classifyAbility(tokens);

  switch (classification) {
    case "keyword":
      return parseKeywordAbility(tokens);

    case "keyword_list":
      // Should not happen — use parseAbilities for lists
      return parseKeywordAbility(tokens);

    case "activated":
      return parseActivatedAbility(tokens);

    case "triggered":
      return parseTriggeredAbility(tokens);

    case "replacement":
      return parseReplacementEffect(tokens);

    case "static":
      return parseStaticAbility(tokens);

    case "spell_effect":
    default:
      return parseSpellEffect(tokens);
  }
}

// ═══════════════════════════════════════════════════════════════════
// ADDITIONAL / ALTERNATIVE COST DETECTION & PARSING
// ═══════════════════════════════════════════════════════════════════

/** Check if a token block declares an additional cost ("As an additional cost ...") */
function isAdditionalCostBlock(tokens: Token[]): boolean {
  return tokens.some(
    (t) => t.type === "CONDITIONAL" && t.normalized === "additional_cost"
  );
}

/** Check if a token block declares an alternative cost ("... rather than pay ...") */
function isAlternativeCostBlock(tokens: Token[]): boolean {
  return tokens.some(
    (t) => t.type === "CONDITIONAL" && t.normalized === "rather_than_pay"
  );
}

/**
 * Parse additional costs from a block that contains an "additional_cost" token.
 * Reuses parseCosts logic by extracting cost-relevant tokens after the conditional.
 *
 * Handles:
 * - "sacrifice a creature"
 * - "sacrifice an artifact or creature"
 * - "discard a card"
 * - "pay N life"
 * - "exile a card from your graveyard"
 */
function parseAdditionalCosts(tokens: Token[]): Cost[] {
  // Find the additional_cost token
  const condIdx = tokens.findIndex(
    (t) => t.type === "CONDITIONAL" && t.normalized === "additional_cost"
  );

  if (condIdx === -1) return [];

  // Extract tokens after the conditional — these describe the cost
  const costTokens = tokens.slice(condIdx + 1);

  // Use parseCosts to extract structured Cost[] from the tokens
  return parseCosts(costTokens);
}

/**
 * Parse alternative costs from a block that contains a "rather_than_pay" token.
 * Extracts the cost components before the "rather than pay" phrase.
 *
 * Pattern: "You may [cost1] and [cost2] rather than pay this spell's mana cost."
 * Pattern: "You may pay [cost] rather than pay this spell's mana cost."
 * Pattern: "If [condition], you may [cost] rather than pay this spell's mana cost."
 */
function parseAlternativeCosts(
  tokens: Token[]
): NonNullable<CastingCost["alternativeCosts"]> {
  // Find the rather_than_pay token
  const ratherIdx = tokens.findIndex(
    (t) => t.type === "CONDITIONAL" && t.normalized === "rather_than_pay"
  );

  if (ratherIdx === -1) return [];

  // Cost tokens are between "may_pay" and "rather than pay"
  const mayIdx = tokens.findIndex(
    (t) => t.type === "CONDITIONAL" && t.normalized === "may_pay"
  );

  const costStart = mayIdx !== -1 ? mayIdx + 1 : 0;
  const costTokens = tokens.slice(costStart, ratherIdx);

  // Parse the costs using parseAlternativeCostTokens which handles the
  // patterns where "pay" was consumed by "may_pay" (e.g., "1 life and exile...")
  const costs = parseAlternativeCostTokens(costTokens);

  // Build description from original token values
  const description = costTokens
    .filter((t) => t.type !== "PUNCTUATION")
    .map((t) => t.value)
    .join(" ")
    .trim();

  // Check for a condition (e.g., "If it's not your turn")
  const condition = parseCondition(tokens.slice(0, costStart));

  return [
    {
      costs,
      description,
      condition,
    },
  ];
}

/**
 * Parse cost tokens from an alternative cost context.
 *
 * Unlike parseCosts (which expects "Pay N life", "Sacrifice a creature"),
 * alternative cost tokens have the "pay" consumed by the "may_pay" alias.
 * So we see patterns like:
 *   - NUMBER "1" + TEXT "life" → PayLifeCost
 *   - MANA_SYMBOL "{W}" → ManaCostUnit
 *   - EFFECT_VERB "exile" + ... → ExileCost
 * Connected by CONJUNCTION "and".
 */
function parseAlternativeCostTokens(tokens: Token[]): Cost[] {
  const costs: Cost[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    // Skip conjunctions and punctuation
    if (token.type === "CONJUNCTION" || token.type === "PUNCTUATION") {
      i++;
      continue;
    }

    // ─── Pay life: NUMBER + "life" (no "pay" prefix in alt cost context) ───
    if (token.type === "NUMBER") {
      const lifeAmount = parseInt(token.value, 10);
      if (
        i + 1 < tokens.length &&
        tokens[i + 1].type === "TEXT" &&
        tokens[i + 1].value.toLowerCase() === "life"
      ) {
        costs.push({ costType: "pay_life", quantity: lifeAmount });
        i += 2;
        continue;
      }
    }

    // ─── Mana cost: {W}, {U}, {1}, etc. ───
    if (token.type === "MANA_SYMBOL") {
      if (token.value === "{T}") {
        costs.push({ costType: "tap" });
      } else if (token.value === "{Q}") {
        costs.push({ costType: "untap" });
      } else {
        costs.push({ costType: "mana", mana: token.value });
      }
      i++;
      continue;
    }

    // ─── Exile cost: EFFECT_VERB "exile" + object ref ───
    if (
      token.type === "EFFECT_VERB" &&
      token.normalized === "exile"
    ) {
      const objRef = parseObjectRefFrom(tokens, i + 1);
      // Look for "from" + zone in the remaining tokens
      let from: Zone | undefined;
      for (let k = i + 1; k < objRef.endIndex + 3 && k < tokens.length; k++) {
        if (
          tokens[k].type === "TEXT" &&
          tokens[k].value.toLowerCase() === "from" &&
          k + 1 < tokens.length
        ) {
          // Look for zone after "from" (may be preceded by "your")
          for (let m = k + 1; m < k + 3 && m < tokens.length; m++) {
            if (tokens[m].type === "ZONE") {
              from = tokens[m].normalized as Zone;
              break;
            }
          }
        }
      }
      costs.push({
        costType: "exile",
        object: objRef.ref,
        from,
      });
      i = objRef.endIndex;
      continue;
    }

    // ─── Sacrifice cost ───
    if (
      token.type === "EFFECT_VERB" &&
      token.normalized === "sacrifice"
    ) {
      const objRef = parseObjectRefFrom(tokens, i + 1);
      costs.push({
        costType: "sacrifice",
        object: objRef.ref,
      });
      i = objRef.endIndex;
      continue;
    }

    // ─── Discard cost ───
    if (
      token.type === "EFFECT_VERB" &&
      token.normalized === "discard"
    ) {
      costs.push({ costType: "discard" });
      while (i < tokens.length && tokens[i].type !== "PUNCTUATION" && tokens[i].type !== "CONJUNCTION") i++;
      continue;
    }

    i++;
  }

  return costs;
}

// ═══════════════════════════════════════════════════════════════════
// SAGA CHAPTER PARSING
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse saga oracle text into TriggeredAbility[] — one per chapter.
 *
 * Handles:
 * - Individual chapters: "I —", "II —", "III —", "IV —"
 * - Combined chapters: "I, II —", "II, III —", "I, II, III —"
 * - Read-ahead sagas (reminder text stripped by parenthesis skipping)
 *
 * Each chapter produces a TriggeredAbility with a lore-counter StateChange
 * trigger. Combined chapters (e.g., "I, II —") produce two triggers with
 * identical effects.
 */
export function parseSagaChapters(oracleText: string): AbilityNode[] {
  // Strip all parenthetical reminder text (e.g. the lore counter reminder)
  const stripped = oracleText.replace(/\([^)]*\)/g, "").trim();

  // Regex to split at chapter markers. Handles Roman numerals I–IV
  // and combined markers like "I, II —" or "II, III —".
  const chapterRe =
    /(?:^|\n)\s*((?:I{1,3}V?|IV)(?:\s*,\s*(?:I{1,3}V?|IV))*)\s*—\s*/gim;

  // Collect all chapter matches with their positions
  const matches: { romans: string[]; textStart: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = chapterRe.exec(stripped)) !== null) {
    const romanStr = match[1]; // e.g. "I, II" or "III"
    const romans = romanStr
      .split(/\s*,\s*/)
      .map((r) => r.trim().toUpperCase())
      .filter((r) => r.length > 0);
    matches.push({ romans, textStart: chapterRe.lastIndex });
  }

  // For each match, extract the effect text up to the next marker
  const abilities: AbilityNode[] = [];

  for (let i = 0; i < matches.length; i++) {
    const { romans, textStart } = matches[i];
    const textEnd = i + 1 < matches.length
      ? stripped.lastIndexOf("\n", matches[i + 1].textStart - 1)
      : stripped.length;

    const effectText = stripped.slice(textStart, textEnd).trim();

    // Lore counter trigger (StateChange on the saga)
    const loreCounterTrigger: import("./types").StateChange = {
      kind: "state_change",
      property: "counters",
      object: { types: ["enchantment"], quantity: "one", modifiers: [] },
      delta: 1,
    };

    // Parse effects from the chapter text
    const { blocks } = tokenizeText(effectText, "");
    let chapterEffects: import("./types").Effect[] = [];
    for (const block of blocks) {
      const blockEffects = parseEffects(block);
      chapterEffects.push(...blockEffects);
    }

    // Fallback: if no structured effects parsed, store the raw text
    if (chapterEffects.length === 0) {
      chapterEffects = [
        {
          type: "chapter_effect",
          details: { text: effectText, chapter: romans.join(", ") },
        },
      ];
    }

    // Create one TriggeredAbility per roman numeral in the marker
    // (combined chapters like "I, II —" produce two triggers with same effects)
    for (const roman of romans) {
      const chapterNumber = romanToNumber(roman);
      abilities.push({
        abilityType: "triggered",
        trigger: {
          ...loreCounterTrigger,
          delta: chapterNumber,
        },
        effects: chapterEffects,
        speed: "instant",
      } as import("./types").TriggeredAbility);
    }
  }

  return abilities;
}

/** Convert Roman numeral chapter string to integer */
function romanToNumber(roman: string): number {
  const map: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
  return map[roman.toUpperCase()] ?? 1;
}

/** Thin wrapper to tokenize a plain text string into ability blocks */
function tokenizeText(
  text: string,
  cardName: string
): { blocks: Token[][] } {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const blocks = lines.map((line) => tokenizeAbility(line, cardName));
  return { blocks };
}

// ═══════════════════════════════════════════════════════════════════
// CLASS LEVEL PARSING
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse Class enchantment oracle text into AbilityNode[].
 *
 * Structure:
 * - Text before the first "Level N" marker → base abilities (no condition)
 * - "Level N — {cost}" line → ActivatedAbility for level-up (sorcery speed)
 * - Text after the level marker (on same or subsequent lines until next Level marker)
 *   → StaticAbility/TriggeredAbility gated with Condition { class_level >= N }
 */
export function parseClassLevels(oracleText: string): AbilityNode[] {
  const abilities: AbilityNode[] = [];

  // Split oracle text into lines
  const lines = oracleText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Regex to detect level marker lines like "Level 2 — {2}{R}:" or "Level 2 — {2}{R}"
  // Also handles "Level 2 — {cost}: effect" all-in-one line
  const levelRe = /^Level\s+(\d+)\s*—\s*(.+)$/i;

  let currentSection: "base" | number = "base";
  let pendingLines: string[] = [];

  const flushSection = (section: "base" | number, sectionLines: string[]) => {
    if (sectionLines.length === 0) return;

    const condition: import("./types").Condition | undefined =
      section === "base"
        ? undefined
        : {
            type: "as_long_as",
            predicate: `class level is ${section} or more`,
            structured: {
              check: "class_level",
              count: section as number,
              comparison: "greater_equal",
            },
          };

    for (const line of sectionLines) {
      const { blocks } = tokenizeText(line, "");
      for (const block of blocks) {
        if (block.length === 0) continue;
        const ability = parseAbility(block);

        // Attach the class level condition to non-activated abilities
        if (section !== "base" && condition) {
          if (ability.abilityType === "static") {
            (ability as import("./types").StaticAbility).condition = condition;
          } else if (ability.abilityType === "triggered") {
            (ability as import("./types").TriggeredAbility).condition = condition;
          } else if (ability.abilityType === "spell_effect") {
            (ability as import("./types").SpellEffect).condition = condition;
          }
        }

        abilities.push(ability);
      }
    }
  };

  for (const line of lines) {
    const levelMatch = line.match(levelRe);
    if (levelMatch) {
      // Flush the previous section
      flushSection(currentSection, pendingLines);
      pendingLines = [];

      const levelNum = parseInt(levelMatch[1], 10);
      currentSection = levelNum;

      // The level marker line contains the upgrade cost (and possibly an ability)
      const levelContent = levelMatch[2].trim();

      // Build an ActivatedAbility for the level-up itself
      // levelContent looks like: "{2}{R}" or "{2}{R}: Some effect"
      const colonIdx = levelContent.indexOf(":");
      const costPart =
        colonIdx !== -1 ? levelContent.slice(0, colonIdx) : levelContent;
      const effectPart =
        colonIdx !== -1 ? levelContent.slice(colonIdx + 1).trim() : "";

      // Parse mana cost from costPart
      const manaCosts: import("./types").Cost[] = [];
      const manaRe = /\{[WUBRGCXSTQEP0-9/]+\}/g;
      let manaMatch;
      while ((manaMatch = manaRe.exec(costPart)) !== null) {
        const sym = manaMatch[0];
        if (sym === "{T}") {
          manaCosts.push({ costType: "tap" });
        } else if (sym === "{Q}") {
          manaCosts.push({ costType: "untap" });
        } else {
          manaCosts.push({ costType: "mana", mana: sym });
        }
      }

      const levelUpEffects: import("./types").Effect[] = [
        {
          type: "class_level_up",
          details: { targetLevel: levelNum, description: `Upgrade to level ${levelNum}` },
        },
      ];

      const levelUpAbility: import("./types").ActivatedAbility = {
        abilityType: "activated",
        costs: manaCosts,
        effects: levelUpEffects,
        speed: "sorcery",
      };
      abilities.push(levelUpAbility);

      // If there's an effect part after the colon, add it to the pending lines
      // for this level's section (it's a level-gated ability)
      if (effectPart.length > 0) {
        pendingLines.push(effectPart);
      }
    } else {
      pendingLines.push(line);
    }
  }

  // Flush final section
  flushSection(currentSection, pendingLines);

  return abilities;
}

/**
 * Parse multiple token blocks into AbilityNode[].
 * Handles:
 * - Keyword lists (comma-separated keywords -> multiple KeywordAbility nodes)
 * - Additional cost blocks (merge with following spell effect block)
 * - Alternative cost blocks (merge with following spell effect block)
 */
export function parseAbilities(blocks: Token[][]): AbilityNode[] {
  const abilities: AbilityNode[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    if (block.length === 0) {
      i++;
      continue;
    }

    // ─── Additional cost block: merge with next block ───
    if (isAdditionalCostBlock(block)) {
      const additionalCosts = parseAdditionalCosts(block);

      if (i + 1 < blocks.length) {
        const nextBlock = blocks[i + 1];
        const nextNode = parseAbility(nextBlock);

        if (nextNode.abilityType === "spell_effect") {
          const spellNode = nextNode as SpellEffect;
          spellNode.castingCost.additionalCosts = additionalCosts;
          abilities.push(spellNode);
          i += 2; // skip both blocks
          continue;
        }
      }

      // No next block or next block is not a spell_effect — parse standalone
      // but still preserve the additional costs on the node
      const standaloneNode = parseAbility(block);
      if (standaloneNode.abilityType === "spell_effect") {
        (standaloneNode as SpellEffect).castingCost.additionalCosts = additionalCosts;
      }
      abilities.push(standaloneNode);
      i++;
      continue;
    }

    // ─── Alternative cost block: merge with next spell_effect block ───
    if (isAlternativeCostBlock(block)) {
      const altCosts = parseAlternativeCosts(block);

      if (i + 1 < blocks.length) {
        const nextBlock = blocks[i + 1];
        const nextNode = parseAbility(nextBlock);

        if (nextNode.abilityType === "spell_effect") {
          const spellNode = nextNode as SpellEffect;
          spellNode.castingCost.alternativeCosts = altCosts;
          abilities.push(spellNode);
          i += 2; // skip both blocks
          continue;
        }

        // Next block is not a spell_effect (e.g., triggered ability on Solitude).
        // Preserve alt costs on the standalone parsed node.
        const altStandalone = parseAbility(block);
        if (altStandalone.abilityType === "spell_effect") {
          (altStandalone as SpellEffect).castingCost.alternativeCosts = altCosts;
        }
        abilities.push(altStandalone);
        // Fall through to let the next block be processed in the next iteration
      } else {
        // No next block — parse standalone but preserve alt costs
        const altStandalone = parseAbility(block);
        if (altStandalone.abilityType === "spell_effect") {
          (altStandalone as SpellEffect).castingCost.alternativeCosts = altCosts;
        }
        abilities.push(altStandalone);
      }

      i++;
      continue;
    }

    // ─── Normal processing ───
    const classification = classifyAbility(block);

    if (classification === "keyword_list") {
      // Split comma-separated keywords into individual keyword nodes
      const keywords = extractKeywordsFromList(block);
      abilities.push(...keywords);
    } else {
      abilities.push(parseAbility(block));
    }

    i++;
  }

  return abilities;
}

// ═══════════════════════════════════════════════════════════════════
// INDIVIDUAL ABILITY PARSERS
// ═══════════════════════════════════════════════════════════════════

function parseKeywordAbility(tokens: Token[]): KeywordAbility {
  const kwToken = tokens.find((t) => t.type === "KEYWORD");

  if (!kwToken) {
    return { abilityType: "keyword", keyword: "unknown" };
  }

  // Check for parameter after keyword
  const kwIdx = tokens.indexOf(kwToken);
  let parameter: string | undefined;

  if (kwIdx + 1 < tokens.length) {
    const next = tokens[kwIdx + 1];
    if (next.type === "NUMBER") {
      parameter = next.value;
    } else if (next.type === "MANA_SYMBOL") {
      parameter = next.value;
    }
  }

  return {
    abilityType: "keyword",
    keyword: kwToken.normalized || kwToken.value.toLowerCase(),
    parameter,
  };
}

function extractKeywordsFromList(tokens: Token[]): KeywordAbility[] {
  const result: KeywordAbility[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === "KEYWORD") {
      let parameter: string | undefined;
      if (i + 1 < tokens.length) {
        const next = tokens[i + 1];
        if (next.type === "NUMBER") {
          parameter = next.value;
          i++;
        } else if (next.type === "MANA_SYMBOL") {
          parameter = next.value;
          i++;
        }
      }
      result.push({
        abilityType: "keyword",
        keyword: token.normalized || token.value.toLowerCase(),
        parameter,
      });
    }
  }

  return result;
}

function parseActivatedAbility(tokens: Token[]): ActivatedAbility {
  const sepIdx = findCostSeparatorIndex(tokens);
  const [costTokens, effectTokens] = splitAt(tokens, sepIdx);

  const costs = parseCosts(costTokens);
  const effects = parseEffects(effectTokens);
  const speed = detectSpeed(costs, effects);
  const condition = parseCondition(effectTokens);

  return {
    abilityType: "activated",
    costs,
    effects,
    speed,
    condition,
  };
}

function parseTriggeredAbility(tokens: Token[]): TriggeredAbility {
  // Find the comma that separates trigger from effects
  const commaIdx = findTriggerCommaIndex(tokens);

  let triggerTokens: Token[];
  let effectTokens: Token[];

  if (commaIdx > 0) {
    triggerTokens = tokens.slice(0, commaIdx);
    effectTokens = tokens.slice(commaIdx + 1);
  } else {
    // No comma found — entire block is the trigger (unusual but possible)
    triggerTokens = tokens;
    effectTokens = [];
  }

  const trigger = parseTrigger(triggerTokens);
  const effects = parseEffects(effectTokens);
  const condition = parseCondition(effectTokens);

  return {
    abilityType: "triggered",
    trigger: trigger ?? undefined,
    effects,
    speed: "instant",
    condition,
  };
}

function parseSpellEffect(tokens: Token[]): SpellEffect {
  const effects = parseEffects(tokens);
  const condition = parseCondition(tokens);

  return {
    abilityType: "spell_effect",
    effects,
    castingCost: {
      manaCost: "",
      manaValue: 0,
      additionalCosts: [],
    },
    condition,
  };
}
