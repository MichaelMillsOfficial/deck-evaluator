/**
 * Capability Extractor — Phase 4 of the oracle text compiler
 *
 * Transforms EnrichedCard (Scryfall data) into a CardProfile by:
 * 1. Parsing the type line into cardTypes, supertypes, subtypes
 * 2. Tokenizing + parsing oracle text into AbilityNode[]
 * 3. Expanding keyword abilities via keyword-database
 * 4. Walking all AbilityNode[] to extract summarized capabilities
 */

import type { EnrichedCard } from "../types";
import type {
  CardProfile,
  AbilityNode,
  ActivatedAbility,
  TriggeredAbility,
  StaticAbility,
  ReplacementAbility,
  KeywordAbility,
  SpellEffect,
  Effect,
  Cost,
  GameEffect,
  GameEvent,
  ZoneTransition,
  StateChange,
  DamageEvent,
  PlayerResource,
  ManaResource,
  LifeResource,
  CardsResource,
  ObjectAttribute,
  CreateTokenEffect,
  RestrictionEffect,
  CopyEffect,
  ZoneCastPermission,
  GameDesignation,
  WinConditionEffect,
  TypeChangeEffect,
  ExtraTurnEffect,
  PlayerControlEffect,
  CostSubstitutionEffect,
  CastingCost,
  Condition,
  GameObjectRef,
  RefModifier,
  Zone,
  KeywordGrant,
  StatModification,
  CardType,
  Supertype,
  Subtype,
} from "./types";
import type { Speed, Layer } from "./rules/types";
import { tokenize } from "./lexer";
import { parseAbilities } from "./parser";
import { expandKeyword, lookupKeyword } from "./keyword-database";

// ═══════════════════════════════════════════════════════════════════
// TYPE PARSING
// ═══════════════════════════════════════════════════════════════════

const KNOWN_SUPERTYPES = new Set<string>([
  "legendary",
  "basic",
  "snow",
  "world",
  "ongoing",
]);

const KNOWN_CARD_TYPES = new Set<string>([
  "creature",
  "artifact",
  "enchantment",
  "planeswalker",
  "land",
  "instant",
  "sorcery",
  "battle",
  "kindred",
]);

interface ParsedTypeLine {
  cardTypes: CardType[];
  supertypes: Supertype[];
  subtypes: Subtype[];
}

/**
 * Parse a type line string into card types, supertypes, and subtypes.
 *
 * Examples:
 *   "Legendary Creature - Zombie Wizard"
 *   "Artifact"
 *   "Legendary Enchantment Creature - God"
 *   "Basic Land - Swamp"
 */
function parseTypeLine(typeLine: string): ParsedTypeLine {
  const cardTypes: CardType[] = [];
  const supertypes: Supertype[] = [];
  const subtypes: Subtype[] = [];

  if (!typeLine) {
    return { cardTypes, supertypes, subtypes };
  }

  // Split on em-dash or en-dash to separate type-line from subtype-line
  const dashSplit = typeLine.split(/\s+[—\-]+\s+/);
  const typeLinePart = dashSplit[0].trim();
  const subtypePart = dashSplit.length > 1 ? dashSplit[1].trim() : "";

  // Parse the type portion
  const typeWords = typeLinePart.split(/\s+/);
  for (const word of typeWords) {
    const lower = word.toLowerCase();
    if (KNOWN_SUPERTYPES.has(lower)) {
      supertypes.push(lower as Supertype);
    } else if (KNOWN_CARD_TYPES.has(lower)) {
      cardTypes.push(lower as CardType);
    }
    // Skip unrecognized words (e.g., "//")
  }

  // Parse subtypes (preserve original casing)
  if (subtypePart) {
    const subtypeWords = subtypePart.split(/\s+/);
    for (const word of subtypeWords) {
      if (word.length > 0) {
        subtypes.push(word);
      }
    }
  }

  return { cardTypes, supertypes, subtypes };
}

// ═══════════════════════════════════════════════════════════════════
// LAYOUT DETECTION
// ═══════════════════════════════════════════════════════════════════

type CardLayout =
  | "normal"
  | "mdfc"
  | "transform"
  | "meld"
  | "adventure"
  | "split"
  | "flip";

function mapLayout(scryfallLayout: string): CardLayout {
  switch (scryfallLayout) {
    case "normal":
      return "normal";
    case "transform":
      return "transform";
    case "modal_dfc":
      return "mdfc";
    case "adventure":
      return "adventure";
    case "split":
      return "split";
    case "flip":
      return "flip";
    case "meld":
      return "meld";
    default:
      return "normal";
  }
}

// ═══════════════════════════════════════════════════════════════════
// CASTING COST
// ═══════════════════════════════════════════════════════════════════

function buildCastingCost(card: EnrichedCard): CastingCost | undefined {
  if (!card.manaCost && card.cmc === 0) {
    // Lands have no casting cost
    return undefined;
  }
  return {
    manaCost: card.manaCost,
    manaValue: card.cmc,
    additionalCosts: [],
  };
}

// ═══════════════════════════════════════════════════════════════════
// KEYWORD EXPANSION
// ═══════════════════════════════════════════════════════════════════

/**
 * Expand keyword abilities from parsed AbilityNode[] and card.keywords.
 * Returns expanded AbilityNode[] to add to the abilities list.
 */
function expandKeywords(
  parsedAbilities: AbilityNode[],
  card: EnrichedCard
): AbilityNode[] {
  const expanded: AbilityNode[] = [];
  const expandedKeywords = new Set<string>();

  // Expand keywords from parsed abilities
  for (const ability of parsedAbilities) {
    if (ability.abilityType === "keyword") {
      const kw = ability as KeywordAbility;
      const expansion = expandKeyword(kw.keyword, kw.parameter, card.name);
      if (expansion) {
        expanded.push(...expansion);
        expandedKeywords.add(kw.keyword.toLowerCase());
      }
    }
  }

  // Also expand keywords from Scryfall card.keywords that the parser may
  // not have caught
  if (card.keywords) {
    for (const kw of card.keywords) {
      const kwLower = kw.toLowerCase();
      if (!expandedKeywords.has(kwLower)) {
        // Check if a parsed keyword already covers this
        const alreadyParsed = parsedAbilities.some(
          (a) =>
            a.abilityType === "keyword" &&
            (a as KeywordAbility).keyword.toLowerCase() === kwLower
        );
        if (!alreadyParsed) {
          const expansion = expandKeyword(kwLower, undefined, card.name);
          if (expansion) {
            expanded.push(...expansion);
          }
        }
        expandedKeywords.add(kwLower);
      }
    }
  }

  return expanded;
}

// ═══════════════════════════════════════════════════════════════════
// EXTRACTION HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Collect all effects from an ability node */
function getEffects(ability: AbilityNode): Effect[] {
  switch (ability.abilityType) {
    case "activated":
      return (ability as ActivatedAbility).effects;
    case "triggered":
      return (ability as TriggeredAbility).effects;
    case "static":
      return (ability as StaticAbility).effects;
    case "replacement":
      return (ability as ReplacementAbility).with;
    case "spell_effect":
      return (ability as SpellEffect).effects;
    case "keyword":
      return [];
    default:
      return [];
  }
}

/** Collect all costs from an ability node */
function getCosts(ability: AbilityNode): Cost[] {
  if (ability.abilityType === "activated") {
    return (ability as ActivatedAbility).costs;
  }
  if (ability.abilityType === "spell_effect") {
    return (ability as SpellEffect).castingCost.additionalCosts || [];
  }
  return [];
}

// ─── Produces Extraction ───

function extractProduces(
  abilities: AbilityNode[]
): (PlayerResource | ObjectAttribute | CreateTokenEffect)[] {
  const produces: (PlayerResource | ObjectAttribute | CreateTokenEffect)[] = [];

  for (const ability of abilities) {
    const effects = getEffects(ability);

    for (const effect of effects) {
      // Mana production
      if (
        effect.type === "add_mana" &&
        effect.resource?.category === "mana"
      ) {
        produces.push(effect.resource as ManaResource);
      }

      // Life production
      if (
        effect.type === "gain_life" &&
        effect.resource?.category === "life"
      ) {
        produces.push(effect.resource as LifeResource);
      }

      // Card draw
      if (
        effect.type === "draw" &&
        effect.resource?.category === "cards"
      ) {
        produces.push(effect.resource as CardsResource);
      }

      // Token creation
      if (
        effect.type === "create_token" &&
        effect.gameEffect?.category === "create_token"
      ) {
        produces.push(effect.gameEffect as CreateTokenEffect);
      }

      // Counters
      if (
        effect.type === "put_counter" &&
        effect.attribute?.category === "counter"
      ) {
        produces.push(effect.attribute);
      }
    }
  }

  return produces;
}

// ─── Consumes Extraction ───

function extractConsumes(abilities: AbilityNode[]): Cost[] {
  const consumes: Cost[] = [];

  for (const ability of abilities) {
    const costs = getCosts(ability);
    for (const cost of costs) {
      consumes.push(cost);
    }
  }

  return consumes;
}

// ─── TriggersOn Extraction ───

function extractTriggersOn(abilities: AbilityNode[]): GameEvent[] {
  const triggersOn: GameEvent[] = [];

  for (const ability of abilities) {
    if (ability.abilityType === "triggered") {
      const triggered = ability as TriggeredAbility;
      // Skip abilities where the parser couldn't classify the trigger
      if (triggered.trigger) {
        triggersOn.push(triggered.trigger);
      }
    }
  }

  return triggersOn;
}

// ─── CausesEvents Extraction ───

/** Extract the target from a GameEffect using discriminated union narrowing */
function getGameEffectTarget(gameEffect: GameEffect | undefined): GameObjectRef | undefined {
  if (!gameEffect) return undefined;
  switch (gameEffect.category) {
    case "destroy":
      return gameEffect.target;
    case "exile":
      return gameEffect.target;
    case "return":
      return gameEffect.target;
    case "damage":
      // DamageEffect.target can be GameObjectRef | Controller; only return if GameObjectRef
      return typeof gameEffect.target === "object" && "types" in gameEffect.target
        ? gameEffect.target
        : undefined;
    default:
      return undefined;
  }
}

const DEFAULT_OBJECT_REF: GameObjectRef = {
  types: [],
  quantity: "one",
  modifiers: [],
};

function extractCausesEvents(
  abilities: AbilityNode[],
  cardTypes: CardType[],
  subtypes: Subtype[]
): GameEvent[] {
  const causesEvents: GameEvent[] = [];

  for (const ability of abilities) {
    const effects = getEffects(ability);

    for (const effect of effects) {
      // Destroy -> ZoneTransition battlefield to graveyard
      if (
        effect.type === "destroy" ||
        effect.type === "destroy_all" ||
        effect.gameEffect?.category === "destroy"
      ) {
        causesEvents.push({
          kind: "zone_transition",
          from: "battlefield",
          to: "graveyard",
          cause: "destroy",
          object: effect.target || getGameEffectTarget(effect.gameEffect) || DEFAULT_OBJECT_REF,
        } as ZoneTransition);
      }

      // Exile -> ZoneTransition to exile
      if (
        effect.type === "exile" ||
        effect.gameEffect?.category === "exile"
      ) {
        const exileFrom = effect.gameEffect?.category === "exile"
          ? effect.gameEffect.from || "battlefield"
          : "battlefield";
        causesEvents.push({
          kind: "zone_transition",
          from: exileFrom,
          to: "exile",
          object: effect.target || getGameEffectTarget(effect.gameEffect) || DEFAULT_OBJECT_REF,
        } as ZoneTransition);
      }

      // Token creation -> ZoneTransition ETB
      if (
        effect.type === "create_token" ||
        effect.gameEffect?.category === "create_token"
      ) {
        const tokenTypes = effect.gameEffect?.category === "create_token"
          ? effect.gameEffect.token.types || []
          : [];
        causesEvents.push({
          kind: "zone_transition",
          to: "battlefield",
          object: {
            types: tokenTypes,
            quantity: "one" as const,
            modifiers: ["token"] as RefModifier[],
          },
        } as ZoneTransition);
      }

      // Damage -> DamageEvent + StateChange life_total
      if (
        effect.type === "damage" ||
        effect.gameEffect?.category === "damage"
      ) {
        const damageEffect = effect.gameEffect?.category === "damage"
          ? effect.gameEffect
          : undefined;
        const qty = damageEffect
          ? damageEffect.quantity
          : effect.quantity;

        // Emit DamageEvent for damage-based trigger matching
        causesEvents.push({
          kind: "damage",
          source: damageEffect?.source || { types: [], quantity: "one", modifiers: [] },
          target: damageEffect?.target || effect.target || { types: [], quantity: "one", modifiers: [] },
          quantity: typeof qty === "number" ? qty : (qty as "X" || 0),
          isCombatDamage: false,
        } as DamageEvent);

        // Also emit StateChange for life total tracking
        causesEvents.push({
          kind: "state_change",
          property: "life_total",
          delta: typeof qty === "number" ? -qty : undefined,
        } as StateChange);
      }

      // Sacrifice (as effect) -> ZoneTransition dies
      if (effect.type === "sacrifice") {
        causesEvents.push({
          kind: "zone_transition",
          from: "battlefield",
          to: "graveyard",
          cause: "sacrifice",
          object: effect.target || DEFAULT_OBJECT_REF,
        } as ZoneTransition);
      }

      // Return -> ZoneTransition with from/to
      if (
        effect.type === "return" ||
        effect.gameEffect?.category === "return"
      ) {
        const ge = effect.gameEffect;
        const returnFrom = ge?.category === "return" ? ge.from : undefined;
        const returnTo = ge?.category === "return" ? ge.to : "battlefield";
        const returnTarget = ge?.category === "return" ? ge.target : undefined;
        causesEvents.push({
          kind: "zone_transition",
          from: returnFrom,
          to: returnTo || "battlefield",
          object: effect.target || returnTarget || DEFAULT_OBJECT_REF,
        } as ZoneTransition);
      }

      // Lose life -> StateChange life_total
      if (effect.type === "lose_life") {
        const qty =
          effect.resource?.category === "life"
            ? effect.resource.quantity
            : effect.quantity;
        causesEvents.push({
          kind: "state_change",
          property: "life_total",
          delta: typeof qty === "number" ? -qty : undefined,
        } as StateChange);
      }
    }

    // From COSTS: SacrificeCost -> ZoneTransition dies
    const costs = getCosts(ability);
    for (const cost of costs) {
      if (cost.costType === "sacrifice") {
        // When a card sacrifices itself (self: true), the parser produces
        // an empty-typed object ({ self: true, types: [] }). Enrich it
        // with the card's actual types and subtypes so type matching
        // works correctly — e.g., a land sacrificing itself should NOT
        // match a "whenever a Sliver dies" trigger.
        let sacObject = cost.object;
        if (sacObject.self && sacObject.types.length === 0) {
          sacObject = {
            ...sacObject,
            types: [...cardTypes],
            subtypes: subtypes.length > 0 ? [...subtypes] : sacObject.subtypes,
          };
        }
        causesEvents.push({
          kind: "zone_transition",
          from: "battlefield",
          to: "graveyard",
          cause: "sacrifice",
          object: sacObject,
        } as ZoneTransition);
      }
    }
  }

  return causesEvents;
}

// ─── Grants Extraction ───

function extractGrants(
  abilities: AbilityNode[],
  oracleText: string
): {
  ability: KeywordGrant | StatModification | string;
  to: GameObjectRef;
  layer?: Layer;
}[] {
  const grants: {
    ability: KeywordGrant | StatModification | string;
    to: GameObjectRef;
    layer?: Layer;
  }[] = [];

  // Split oracle text into lines for per-ability controller detection
  const oracleLines = oracleText.split("\n").map((l) => l.trim());

  for (const ability of abilities) {
    if (ability.abilityType === "static") {
      const staticAbility = ability as StaticAbility;
      let affectedObjects = staticAbility.affectedObjects;

      for (const effect of staticAbility.effects) {
        // If the affectedObjects doesn't have a controller set,
        // try to infer from oracle text. This handles patterns like
        // "your opponents control" which the lexer doesn't recognize.
        let targetRef: GameObjectRef = affectedObjects || {
          types: [],
          quantity: "all" as const,
          modifiers: [] as RefModifier[],
        };

        if (!targetRef.controller && effect.attribute?.category === "stat_mod") {
          const statMod = effect.attribute as StatModification;
          // Find the oracle line that matches this stat mod
          const statStr = formatStatMod(statMod.power, statMod.toughness);
          const matchingLine = oracleLines.find((line) =>
            line.includes(statStr)
          );

          if (matchingLine) {
            const inferredController = inferControllerFromText(matchingLine);
            if (inferredController) {
              targetRef = { ...targetRef, controller: inferredController };
            }
          }
        }

        if (
          effect.type === "grant_keyword" &&
          effect.attribute?.category === "keyword_grant"
        ) {
          grants.push({
            ability: effect.attribute as KeywordGrant,
            to: targetRef,
            layer: staticAbility.layer,
          });
        }

        if (
          effect.type === "stat_mod" &&
          effect.attribute?.category === "stat_mod"
        ) {
          grants.push({
            ability: effect.attribute as StatModification,
            to: targetRef,
            layer: staticAbility.layer,
          });
        }
      }
    }
  }

  return grants;
}

/** Format a stat mod as a string for oracle text matching (e.g., "+2/+2" or "-2/-2") */
function formatStatMod(power: number | string, toughness: number | string): string {
  const p = typeof power === "number" ? (power >= 0 ? `+${power}` : `${power}`) : power;
  const t = typeof toughness === "number" ? (toughness >= 0 ? `+${toughness}` : `${toughness}`) : toughness;
  return `${p}/${t}`;
}

/** Infer controller from a line of oracle text */
function inferControllerFromText(text: string): "you" | "opponent" | "each" | "any" | undefined {
  const lower = text.toLowerCase();
  if (/your opponents? control/.test(lower) || /opponents? control/.test(lower)) {
    return "opponent";
  }
  if (/you control/.test(lower)) {
    return "you";
  }
  if (/each player/.test(lower)) {
    return "each";
  }
  return undefined;
}

// ─── Replacements Extraction ───

function extractReplacements(
  abilities: AbilityNode[]
): {
  replaces: GameEvent;
  with: Effect[];
  affectedObjects?: GameObjectRef;
  mode: "replace" | "modify" | "add" | "redirect" | "prevent";
}[] {
  const replacements: {
    replaces: GameEvent;
    with: Effect[];
    affectedObjects?: GameObjectRef;
    mode: "replace" | "modify" | "add" | "redirect" | "prevent";
  }[] = [];

  for (const ability of abilities) {
    if (ability.abilityType === "replacement") {
      const rep = ability as ReplacementAbility;
      replacements.push({
        replaces: rep.replaces,
        with: rep.with,
        affectedObjects: rep.affectedObjects,
        mode: rep.mode,
      });
    }
  }

  return replacements;
}

// ─── Restrictions Extraction ───

function extractRestrictions(abilities: AbilityNode[]): RestrictionEffect[] {
  return extractByGameEffectCategory<RestrictionEffect>(abilities, "restriction");
}

// ─── Generic Game Effect Category Extractor ───

/**
 * Extract all GameEffect values matching a specific discriminated union category
 * from the effects of all abilities. Nine extraction functions share this pattern.
 */
function extractByGameEffectCategory<T extends GameEffect>(
  abilities: AbilityNode[],
  category: T["category"]
): T[] {
  const results: T[] = [];
  for (const ability of abilities) {
    for (const effect of getEffects(ability)) {
      if (effect.gameEffect?.category === category) {
        results.push(effect.gameEffect as T);
      }
    }
  }
  return results;
}

// ─── Speeds Extraction ───

function extractSpeeds(abilities: AbilityNode[]): Speed[] {
  const speeds = new Set<Speed>();

  for (const ability of abilities) {
    if (ability.abilityType === "activated") {
      speeds.add((ability as ActivatedAbility).speed);
    }
    if (ability.abilityType === "triggered") {
      speeds.add((ability as TriggeredAbility).speed);
    }
  }

  return Array.from(speeds);
}

// ─── StaticEffects Extraction ───

function extractStaticEffects(
  abilities: AbilityNode[]
): { effect: Effect; layer?: Layer; affectedObjects?: GameObjectRef }[] {
  const staticEffects: {
    effect: Effect;
    layer?: Layer;
    affectedObjects?: GameObjectRef;
  }[] = [];

  for (const ability of abilities) {
    if (ability.abilityType === "static") {
      const staticAbility = ability as StaticAbility;
      for (const effect of staticAbility.effects) {
        staticEffects.push({
          effect,
          layer: staticAbility.layer,
          affectedObjects: staticAbility.affectedObjects,
        });
      }
    }
  }

  return staticEffects;
}

// ─── Copies Extraction ───

function extractCopies(abilities: AbilityNode[]): CopyEffect[] {
  return extractByGameEffectCategory<CopyEffect>(abilities, "copy");
}

// ─── ZoneCastPermissions Extraction ───

function extractZoneCastPermissions(
  abilities: AbilityNode[]
): ZoneCastPermission[] {
  return extractByGameEffectCategory<ZoneCastPermission>(abilities, "zone_cast_permission");
}

// ─── WinConditions Extraction ───

function extractWinConditions(
  abilities: AbilityNode[]
): WinConditionEffect[] {
  return extractByGameEffectCategory<WinConditionEffect>(abilities, "win_condition");
}

// ─── CostSubstitutions Extraction ───

function extractCostSubstitutions(
  abilities: AbilityNode[]
): CostSubstitutionEffect[] {
  return extractByGameEffectCategory<CostSubstitutionEffect>(abilities, "cost_substitution");
}

// ─── ExtraTurns Extraction ───

function extractExtraTurns(abilities: AbilityNode[]): ExtraTurnEffect[] {
  return extractByGameEffectCategory<ExtraTurnEffect>(abilities, "extra_turn");
}

// ─── PlayerControl Extraction ───

function extractPlayerControl(
  abilities: AbilityNode[]
): PlayerControlEffect[] {
  return extractByGameEffectCategory<PlayerControlEffect>(abilities, "player_control");
}

// ─── TypeChanges Extraction ───

function extractTypeChanges(abilities: AbilityNode[]): TypeChangeEffect[] {
  return extractByGameEffectCategory<TypeChangeEffect>(abilities, "type_change");
}

// ─── Designations Extraction ───

function extractDesignations(abilities: AbilityNode[]): GameDesignation[] {
  return extractByGameEffectCategory<GameDesignation>(abilities, "designation");
}

// ─── LinkedEffects Extraction ───

function extractLinkedEffects(
  abilities: AbilityNode[],
  cardName: string
): {
  effect: Effect;
  source: string;
  returnCondition?: { trigger: GameEvent; returnTo: Zone };
}[] {
  const linked: {
    effect: Effect;
    source: string;
    returnCondition?: { trigger: GameEvent; returnTo: Zone };
  }[] = [];

  for (const ability of abilities) {
    const effects = getEffects(ability);
    for (const effect of effects) {
      if (effect.linkedReturn) {
        linked.push({
          effect,
          source: cardName,
          returnCondition: {
            trigger: effect.linkedReturn.trigger,
            returnTo: effect.linkedReturn.returnTo,
          },
        });
      }
    }
  }

  return linked;
}

// ─── Conditions Extraction ───

function extractConditions(abilities: AbilityNode[]): Condition[] {
  const conditions: Condition[] = [];

  for (const ability of abilities) {
    let condition: Condition | undefined;

    switch (ability.abilityType) {
      case "activated":
        condition = (ability as ActivatedAbility).condition;
        break;
      case "triggered":
        condition = (ability as TriggeredAbility).condition;
        break;
      case "static":
        condition = (ability as StaticAbility).condition;
        break;
      case "replacement":
        condition = (ability as ReplacementAbility).condition;
        break;
      case "spell_effect":
        condition = (ability as SpellEffect).condition;
        break;
    }

    if (condition) {
      conditions.push(condition);
    }
  }

  return conditions;
}

// ─── ZoneAbilities Extraction ───

function extractZoneAbilities(
  abilities: AbilityNode[]
): { ability: AbilityNode; functionsFrom: Zone }[] {
  const zoneAbilities: { ability: AbilityNode; functionsFrom: Zone }[] = [];

  // Zone abilities come from keyword expansion (flashback, cycling, etc.)
  for (const ability of abilities) {
    if (ability.abilityType === "activated") {
      const activated = ability as ActivatedAbility;
      // Check if any cost involves exiling from a zone
      for (const cost of activated.costs) {
        if (cost.costType === "exile" && cost.from) {
          zoneAbilities.push({
            ability,
            functionsFrom: cost.from,
          });
        }
      }
    }
  }

  return zoneAbilities;
}

// ═══════════════════════════════════════════════════════════════════
// ORACLE TEXT FALLBACK DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Detect token creation from oracle text that the parser may not
 * capture (e.g., "create a 0/1 green Plant creature token").
 * The parser only matches "create a token" / "create a treasure token"
 * multi-word aliases but not parameterized token descriptions.
 */
function detectOracleTokenCreation(
  oracleText: string,
  existingProduces: (PlayerResource | ObjectAttribute | CreateTokenEffect)[]
): CreateTokenEffect[] {
  const tokens: CreateTokenEffect[] = [];

  // Match "create a/an [description] token" or "create [N] [description] tokens"
  const tokenPattern =
    /create\s+(?:a|an|\d+)\s+(.+?)\s+tokens?\b/gi;
  let match;

  while ((match = tokenPattern.exec(oracleText)) !== null) {
    const description = match[1].toLowerCase();

    // Extract types from the description
    const types: CardType[] = [];
    if (description.includes("creature")) types.push("creature");
    if (description.includes("artifact")) types.push("artifact");
    if (description.includes("enchantment")) types.push("enchantment");

    // If no types found, default to creature (most common token type)
    if (types.length === 0) types.push("creature");

    tokens.push({
      category: "create_token",
      token: {
        types,
      },
      quantity: 1,
    });
  }

  return tokens;
}

/**
 * Detect static effects from oracle text for patterns the parser
 * doesn't handle as structured abilities (e.g., Panharmonicon's
 * "If ... entering the battlefield causes a triggered ability ...
 * to trigger, that ability triggers an additional time").
 */
function detectOracleStaticEffects(
  oracleText: string
): { effects: Effect[]; triggersOn: GameEvent[] } {
  const effects: Effect[] = [];
  const triggersOn: GameEvent[] = [];

  // Panharmonicon pattern: "entering the battlefield causes a triggered ability"
  if (
    /entering the battlefield/i.test(oracleText) &&
    /triggered? ability/i.test(oracleText) &&
    /additional time/i.test(oracleText)
  ) {
    effects.push({
      type: "trigger_doubler",
      details: { scope: "etb_triggers" },
    });
  }

  return { effects, triggersOn };
}

/**
 * Detect caused events from oracle text that the parser may not catch
 * (e.g., token creation producing ETB zone transitions).
 */
function detectOracleCausedEvents(
  oracleText: string,
  existingCausesEvents: GameEvent[]
): GameEvent[] {
  const events: GameEvent[] = [];

  // If oracle text mentions creating tokens but we haven't captured the ETB event
  const hasTokenCreation = /create\s+(?:a|an|\d+)\s+.+?\s+tokens?\b/i.test(
    oracleText
  );
  const hasETB = existingCausesEvents.some(
    (e) => e.kind === "zone_transition" && (e as ZoneTransition).to === "battlefield"
  );

  if (hasTokenCreation && !hasETB) {
    // Extract token types from oracle text for ETB type matching
    const tokenMatch = oracleText.match(/create\s+(?:a|an|\d+)\s+(.+?)\s+tokens?\b/i);
    const tokenTypes: CardType[] = [];
    if (tokenMatch) {
      const desc = tokenMatch[1].toLowerCase();
      if (desc.includes("creature")) tokenTypes.push("creature");
      if (desc.includes("artifact")) tokenTypes.push("artifact");
      if (desc.includes("enchantment")) tokenTypes.push("enchantment");
      if (tokenTypes.length === 0) tokenTypes.push("creature");
    }
    events.push({
      kind: "zone_transition",
      to: "battlefield",
      object: {
        types: tokenTypes,
        quantity: "one" as const,
        modifiers: ["token"] as RefModifier[],
      },
    } as ZoneTransition);
  }

  return events;
}

// ═══════════════════════════════════════════════════════════════════
// ORACLE TEXT RESTRICTION DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Detect restriction effects from oracle text that the parser may not
 * capture as structured RestrictionEffect. Handles patterns like
 * "can't draw more than one card each turn".
 */
function detectOracleRestrictions(
  oracleText: string
): RestrictionEffect[] {
  const restrictions: RestrictionEffect[] = [];

  // "can't draw more than one card each turn" pattern
  if (/can't draw more than one card each turn/i.test(oracleText)) {
    // Determine target based on text context
    let controller: "opponent" | "you" | "any" = "any";
    if (/each opponent/i.test(oracleText)) {
      controller = "opponent";
    } else if (/you can't/i.test(oracleText)) {
      controller = "you";
    }

    restrictions.push({
      category: "restriction",
      restricts: "draw",
      target: {
        types: [],
        quantity: "all",
        modifiers: [],
        controller,
      },
      scope: "more than one card each turn",
    });
  }

  return restrictions;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PROFILE FUNCTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Profile a card by parsing its oracle text and extracting all
 * capabilities into a CardProfile.
 */
export function profileCard(card: EnrichedCard): CardProfile {
  // 1. Parse type line
  const { cardTypes, supertypes, subtypes } = parseTypeLine(card.typeLine);

  // 2. Tokenize + parse oracle text
  const oracleText = card.oracleText || "";
  const { blocks } = tokenize(oracleText, card.name);
  const parsedAbilities = parseAbilities(blocks);

  // 3. Expand keywords
  const expandedAbilities = expandKeywords(parsedAbilities, card);

  // 4. Combine all abilities (original parsed + expanded from keywords)
  const allAbilities = [...parsedAbilities, ...expandedAbilities];

  // 5. Build casting cost
  const castingCost = buildCastingCost(card);

  // 6. Extract all capability fields
  const produces = extractProduces(allAbilities);
  const consumes = extractConsumes(allAbilities);
  const triggersOn = extractTriggersOn(allAbilities);
  const causesEvents = extractCausesEvents(allAbilities, cardTypes, subtypes);
  const grants = extractGrants(allAbilities, oracleText);
  const replacements = extractReplacements(allAbilities);
  const speeds = extractSpeeds(allAbilities);
  const staticEffects = extractStaticEffects(allAbilities);
  const copies = extractCopies(allAbilities);
  const zoneCastPermissions = extractZoneCastPermissions(allAbilities);
  const winConditions = extractWinConditions(allAbilities);
  const costSubstitutions = extractCostSubstitutions(allAbilities);
  const extraTurns = extractExtraTurns(allAbilities);
  const playerControl = extractPlayerControl(allAbilities);
  const typeChanges = extractTypeChanges(allAbilities);
  const designations = extractDesignations(allAbilities);
  const linkedEffects = extractLinkedEffects(allAbilities, card.name);
  const requires = extractConditions(allAbilities);
  const zoneAbilities = extractZoneAbilities(allAbilities);

  // 7. Detect restrictions from oracle text
  const oracleRestrictions = detectOracleRestrictions(oracleText);
  const structuredRestrictions = extractRestrictions(allAbilities);
  const restrictions = [...structuredRestrictions, ...oracleRestrictions];

  // 8. Oracle text fallback: token creation
  const oracleTokens = detectOracleTokenCreation(oracleText, produces);
  produces.push(...oracleTokens);

  // 9. Oracle text fallback: static effects (e.g., Panharmonicon)
  const oracleStatic = detectOracleStaticEffects(oracleText);
  if (oracleStatic.effects.length > 0) {
    for (const effect of oracleStatic.effects) {
      staticEffects.push({ effect });
    }
  }

  // 10. Oracle text fallback: caused events (e.g., token creation ETB)
  const oracleCausedEvents = detectOracleCausedEvents(oracleText, causesEvents);
  causesEvents.push(...oracleCausedEvents);

  // 11. Detect layout
  const layout = mapLayout(card.layout);

  return {
    cardName: card.name,
    cardTypes,
    supertypes,
    subtypes,
    abilities: allAbilities,
    castingCost,
    layout,

    produces,
    consumes,
    triggersOn,
    causesEvents,
    grants,
    replacements,
    linkedEffects,
    requires,
    staticEffects,
    restrictions,
    copies,
    zoneCastPermissions,
    speeds,
    zoneAbilities,
    designations,
    typeChanges,
    winConditions,
    costSubstitutions,
    extraTurns,
    playerControl,
    rawOracleText: oracleText || undefined,
  };
}
