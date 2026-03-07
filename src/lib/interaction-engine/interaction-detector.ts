/**
 * Interaction Detector — Phase 5, Slices A + B + C
 *
 * Pairwise interaction detection between CardProfile pairs.
 * Takes CardProfile[] and checks every pair (A, B) for mechanical
 * relationships: enables, triggers, protects, recurs, tutors_for,
 * reduces_cost, blocks, conflicts, and loops_with.
 *
 * Also detects multi-card chains, resource loops, and interaction
 * enablers/blockers.
 *
 * Pipeline position:
 *   Oracle Text -> Lexer -> Parser -> Capability Extractor -> [Interaction Detector]
 */

import type {
  CardProfile,
  Interaction,
  InteractionAnalysis,
  InteractionBlocker,
  InteractionEnabler,
  InteractionChain,
  InteractionLoop,
  GameEvent,
  GameObjectRef,
  Cost,
  RestrictionEffect,
  PlayerResource,
  ObjectAttribute,
  CreateTokenEffect,
  CostSubstitutionEffect,
  Effect,
  CardType,
} from "./types";
import { PERMANENT_TYPES } from "./game-model";

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Analyze a set of card profiles and find all pairwise mechanical
 * interactions between them.
 */
export function findInteractions(profiles: CardProfile[]): InteractionAnalysis {
  const profileMap: Record<string, CardProfile> = {};
  for (const p of profiles) {
    if (!profileMap[p.cardName]) {
      profileMap[p.cardName] = p;
    }
  }

  const interactions: Interaction[] = [];

  // Check every pair (i, j) where i < j
  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const a = profiles[i];
      const b = profiles[j];

      // Check A->B and B->A for asymmetric interactions
      interactions.push(...detectEnables(a, b));
      interactions.push(...detectEnables(b, a));
      interactions.push(...detectTriggers(a, b));
      interactions.push(...detectTriggers(b, a));
      interactions.push(...detectProtects(a, b));
      interactions.push(...detectProtects(b, a));
      interactions.push(...detectRecurs(a, b));
      interactions.push(...detectRecurs(b, a));
      interactions.push(...detectTutorsFor(a, b));
      interactions.push(...detectTutorsFor(b, a));
      interactions.push(...detectReducesCost(a, b));
      interactions.push(...detectReducesCost(b, a));
      interactions.push(...detectBlocks(a, b));
      interactions.push(...detectBlocks(b, a));
    }
  }

  // Derive conflicts from blocks (bidirectional view of blocking)
  interactions.push(...deriveConflicts(interactions));

  // Build InteractionBlocker entries from blocks interactions
  const blockers = buildBlockerEntries(interactions, profiles);

  // Slice C: detect chains, loops, and enablers
  const chains = detectChains(interactions, profiles);
  const loops = detectLoops(interactions, profiles);
  const enablers = detectEnablers(interactions, profiles);

  return {
    profiles: profileMap,
    interactions,
    chains,
    loops,
    blockers,
    enablers,
  };
}

// ═══════════════════════════════════════════════════════════════
// EVENT MATCHING
// ═══════════════════════════════════════════════════════════════

/**
 * Two GameEvents "match" if they share the same `kind` AND have
 * compatible zone/object/property fields. Undefined fields act
 * as wildcards.
 */
function eventsMatch(caused: GameEvent, trigger: GameEvent): boolean {
  if (caused.kind !== trigger.kind) return false;

  if (caused.kind === "zone_transition" && trigger.kind === "zone_transition") {
    // Both must agree on from/to zones (undefined = wildcard)
    if (caused.from && trigger.from && caused.from !== trigger.from) return false;
    if (caused.to && trigger.to && caused.to !== trigger.to) return false;
    // Object types must be compatible
    return objectTypesMatch(caused.object, trigger.object);
  }

  if (caused.kind === "state_change" && trigger.kind === "state_change") {
    return caused.property === trigger.property;
  }

  if (caused.kind === "damage" && trigger.kind === "damage") {
    return true;
  }

  if (caused.kind === "player_action" && trigger.kind === "player_action") {
    return caused.action === trigger.action;
  }

  if (caused.kind === "phase_trigger" && trigger.kind === "phase_trigger") {
    return caused.phase === trigger.phase && caused.step === trigger.step;
  }

  // Unknown event kinds should not match by default
  return false;
}

// ═══════════════════════════════════════════════════════════════
// OBJECT TYPE MATCHING
// ═══════════════════════════════════════════════════════════════

/**
 * Expand composite type tokens (e.g., "permanent", "spell", "nonland")
 * into the actual CardType values they represent. The upstream parser
 * sometimes places these composite identifiers into GameObjectRef.types.
 */
function expandCompositeTypes(types: string[]): string[] {
  const expanded: string[] = [];
  for (const t of types) {
    const lower = t.toLowerCase();
    if (lower === "permanent") {
      expanded.push(...PERMANENT_TYPES);
    } else if (lower === "spell") {
      // Spells = all types except land
      expanded.push(
        "creature",
        "artifact",
        "enchantment",
        "planeswalker",
        "instant",
        "sorcery",
        "battle",
        "kindred"
      );
    } else if (lower === "nonland") {
      expanded.push(
        "creature",
        "artifact",
        "enchantment",
        "planeswalker",
        "instant",
        "sorcery",
        "battle",
        "kindred"
      );
    } else {
      expanded.push(t);
    }
  }
  return expanded;
}

/**
 * Two GameObjectRef match if one's types overlap with the other's.
 * Empty types = matches anything (wildcard).
 * Handles composite types like "permanent" by expanding them.
 */
function objectTypesMatch(
  a: GameObjectRef | undefined,
  b: GameObjectRef | undefined
): boolean {
  if (!a || !b) return true;
  if (a.types.length === 0 || b.types.length === 0) return true;
  const expandedA = expandCompositeTypes(a.types);
  const expandedB = expandCompositeTypes(b.types);
  return expandedA.some((t) => expandedB.includes(t));
}

/**
 * Check if a card (by its cardTypes) matches a GameObjectRef filter.
 * Empty types in the ref = matches anything.
 * Handles composite types like "permanent" by expanding them.
 */
function cardMatchesRef(
  cardTypes: CardType[],
  ref: GameObjectRef
): boolean {
  if (ref.types.length === 0) return true;
  const expandedRefTypes = expandCompositeTypes(ref.types);
  return expandedRefTypes.some((t) => cardTypes.includes(t as CardType));
}

/**
 * Check whether a card is a "permanent type" — can exist on battlefield.
 */
function isPermanentCard(cardTypes: CardType[]): boolean {
  return cardTypes.some((t) => (PERMANENT_TYPES as readonly string[]).includes(t));
}

// ═══════════════════════════════════════════════════════════════
// COST-RESOURCE MATCHING (for enables)
// ═══════════════════════════════════════════════════════════════

/**
 * Check if a resource produced by A can satisfy a cost consumed by B.
 */
function resourceMatchesCost(
  resource: PlayerResource | ObjectAttribute | CreateTokenEffect,
  cost: Cost
): boolean {
  // Mana production matches mana cost
  if (resource.category === "mana" && cost.costType === "mana") {
    return true;
  }

  // Token creation matches sacrifice cost
  if (resource.category === "create_token" && cost.costType === "sacrifice") {
    const tokenTypes = resource.token.types;
    const sacTypes = cost.object.types;
    // Empty sacrifice target = "sacrifice a permanent" — any token works
    if (sacTypes.length === 0) return true;
    return tokenTypes.some((t) => sacTypes.includes(t));
  }

  // Life gain matches pay_life cost
  if (resource.category === "life" && cost.costType === "pay_life") {
    return true;
  }

  // Card draw matches discard cost
  if (resource.category === "cards" && cost.costType === "discard") {
    return true;
  }

  return false;
}

/**
 * Check if a card (being a creature/permanent on battlefield) can serve
 * as sacrifice fodder for a sacrifice cost.
 */
function cardSatisfiesSacrificeCost(
  cardTypes: CardType[],
  cost: { object: GameObjectRef }
): boolean {
  if (cost.object.types.length === 0) return isPermanentCard(cardTypes);
  return cardMatchesRef(cardTypes, cost.object);
}

// ═══════════════════════════════════════════════════════════════
// DETECTOR: ENABLES
// ═══════════════════════════════════════════════════════════════

/**
 * A enables B if:
 * - A produces resources that match B's consumed costs
 * - A is a creature (or token producer) and B has sacrifice costs
 * - A produces mana and B has mana costs (via castingCost)
 */
function detectEnables(a: CardProfile, b: CardProfile): Interaction[] {
  const results: Interaction[] = [];
  const seen = new Set<string>();

  // 1. A.produces matches B.consumes
  for (const resource of a.produces) {
    for (const cost of b.consumes) {
      if (resourceMatchesCost(resource, cost)) {
        let strength = 0.6;
        let mechanical = "";

        if (
          resource.category === "create_token" &&
          cost.costType === "sacrifice"
        ) {
          strength = 0.8;
          mechanical = `${a.cardName} creates tokens that ${b.cardName} can sacrifice`;
          seen.add(`enables:sacrifice:${a.cardName}:${b.cardName}`);
        } else if (resource.category === "mana" && cost.costType === "mana") {
          strength = 0.6;
          mechanical = `${a.cardName} produces mana that ${b.cardName} can use`;
          seen.add(`enables:mana:${a.cardName}:${b.cardName}`);
        } else {
          mechanical = `${a.cardName} produces resources consumed by ${b.cardName}`;
        }

        results.push({
          cards: [a.cardName, b.cardName],
          type: "enables",
          strength,
          mechanical,
          events: [],
        });
      }
    }
  }

  // 2. A is a creature/permanent -> B has sacrifice costs for that type
  // (A itself is the resource, not something A produces)
  if (isPermanentCard(a.cardTypes)) {
    for (const cost of b.consumes) {
      if (cost.costType === "sacrifice") {
        if (cardSatisfiesSacrificeCost(a.cardTypes, cost)) {
          // Check if we already found this via token production
          const dedupKey = `enables:sacrifice:${a.cardName}:${b.cardName}`;
          if (!seen.has(dedupKey)) {
            seen.add(dedupKey);
            const matchingType =
              cost.object.types.length > 0
                ? cost.object.types.join("/")
                : "permanent";
            results.push({
              cards: [a.cardName, b.cardName],
              type: "enables",
              strength: 0.6,
              mechanical: `${a.cardName} is a ${matchingType} that ${b.cardName} can sacrifice`,
              events: [],
            });
          }
        }
      }
    }
  }

  // 3. A produces mana -> B has a casting cost with mana
  if (
    a.produces.some((p) => p.category === "mana") &&
    b.castingCost &&
    b.castingCost.manaValue > 0
  ) {
    // Check we haven't already found a mana enables from produces/consumes
    const manaDedupKey = `enables:mana:${a.cardName}:${b.cardName}`;
    if (!seen.has(manaDedupKey)) {
      seen.add(manaDedupKey);
      results.push({
        cards: [a.cardName, b.cardName],
        type: "enables",
        strength: 0.4,
        mechanical: `${a.cardName} produces mana to help cast ${b.cardName}`,
        events: [],
      });
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// DETECTOR: TRIGGERS
// ═══════════════════════════════════════════════════════════════

/**
 * A triggers B if A.causesEvents matches B.triggersOn.
 * The caused event from A matches a trigger condition on B.
 */
function detectTriggers(a: CardProfile, b: CardProfile): Interaction[] {
  const results: Interaction[] = [];

  for (const caused of a.causesEvents) {
    for (const trigger of b.triggersOn) {
      if (eventsMatch(caused, trigger)) {
        const strength = computeTriggerStrength(caused, trigger);
        const mechanical = describeTriggerInteraction(a, b, caused, trigger);

        results.push({
          cards: [a.cardName, b.cardName],
          type: "triggers",
          strength,
          mechanical,
          events: [caused, trigger],
        });
      }
    }
  }

  return results;
}

/**
 * Compute how strong a trigger match is based on specificity.
 */
function computeTriggerStrength(
  caused: GameEvent,
  trigger: GameEvent
): number {
  if (caused.kind === "zone_transition" && trigger.kind === "zone_transition") {
    // Both specify from AND to zones -> strong match
    if (caused.from && caused.to && trigger.from && trigger.to) {
      // Check if object types match specifically
      if (
        caused.object.types.length > 0 &&
        trigger.object.types.length > 0 &&
        caused.object.types.some((ct) => trigger.object.types.includes(ct))
      ) {
        return 1.0; // Perfect: specific zones + specific types
      }
      return 0.8; // Strong: specific zones, wildcard types
    }

    // One side specifies zones -> good match
    if ((caused.from || caused.to) && (trigger.from || trigger.to)) {
      return 0.8;
    }

    return 0.6;
  }

  if (caused.kind === "state_change" && trigger.kind === "state_change") {
    return 0.8;
  }

  if (caused.kind === "damage" && trigger.kind === "damage") {
    return 0.8;
  }

  if (caused.kind === "player_action" && trigger.kind === "player_action") {
    return 0.8;
  }

  return 0.6;
}

/**
 * Generate a human-readable description of the trigger interaction.
 */
function describeTriggerInteraction(
  a: CardProfile,
  b: CardProfile,
  caused: GameEvent,
  trigger: GameEvent
): string {
  if (caused.kind === "zone_transition") {
    if (caused.from === "battlefield" && caused.to === "graveyard") {
      const cause = caused.cause || "destruction";
      return `${a.cardName} causes ${cause}, triggering ${b.cardName}'s death trigger`;
    }
    if (caused.to === "battlefield") {
      return `${a.cardName} causes an ETB, triggering ${b.cardName}`;
    }
    if (caused.to === "exile") {
      return `${a.cardName} causes exile, triggering ${b.cardName}`;
    }
  }

  if (caused.kind === "state_change") {
    return `${a.cardName} causes ${caused.property} change, triggering ${b.cardName}`;
  }

  if (caused.kind === "damage") {
    return `${a.cardName} deals damage, triggering ${b.cardName}`;
  }

  if (caused.kind === "player_action") {
    return `${a.cardName} causes ${caused.action}, triggering ${b.cardName}`;
  }

  return `${a.cardName} causes an event that triggers ${b.cardName}`;
}

// ═══════════════════════════════════════════════════════════════
// DETECTOR: PROTECTS
// ═══════════════════════════════════════════════════════════════

/** Keywords that grant protection to another permanent */
const PROTECTION_KEYWORDS = new Set([
  "indestructible",
  "hexproof",
  "shroud",
  "ward",
  "protection",
]);

/**
 * A protects B if A grants a protective keyword to objects that
 * match B's types.
 */
function detectProtects(a: CardProfile, b: CardProfile): Interaction[] {
  const results: Interaction[] = [];

  for (const grant of a.grants) {
    // Check if the granted ability is a protection-related keyword
    let isProtective = false;
    let keywordName = "";

    if (typeof grant.ability === "string") {
      isProtective = PROTECTION_KEYWORDS.has(grant.ability.toLowerCase())
        || grant.ability.toLowerCase().startsWith("protection");
      keywordName = grant.ability;
    } else if (grant.ability.category === "keyword_grant") {
      isProtective = PROTECTION_KEYWORDS.has(grant.ability.keyword.toLowerCase())
        || grant.ability.keyword.toLowerCase().startsWith("protection");
      keywordName = grant.ability.keyword;
    }

    if (!isProtective) continue;

    // Check if B's types match the grant target
    if (cardMatchesRef(b.cardTypes, grant.to)) {
      // Also check controller — "you control" means B must be yours
      // For analysis purposes, we assume all cards are controlled by "you"
      const controllerOk =
        !grant.to.controller ||
        grant.to.controller === "you" ||
        grant.to.controller === "any" ||
        grant.to.controller === "each";

      if (controllerOk) {
        // Don't let a card "protect" itself if grant says "other"
        if (grant.to.modifiers?.includes("other") && a.cardName === b.cardName) {
          continue;
        }

        results.push({
          cards: [a.cardName, b.cardName],
          type: "protects",
          strength: 0.8,
          mechanical: `${a.cardName} grants ${keywordName} to ${b.cardName}`,
          events: [],
        });
      }
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// DETECTOR: RECURS
// ═══════════════════════════════════════════════════════════════

/**
 * A recurs B if A has effects that return objects from the graveyard,
 * and B's types match what A can return.
 */
function detectRecurs(a: CardProfile, b: CardProfile): Interaction[] {
  const results: Interaction[] = [];

  // 1. Check A's causesEvents for ZoneTransition{from: graveyard, to: battlefield|hand}
  for (const event of a.causesEvents) {
    if (event.kind !== "zone_transition") continue;
    if (
      event.from === "graveyard" &&
      (event.to === "battlefield" || event.to === "hand")
    ) {
      // Check if B's types match the object reference
      if (objectTypesMatch(event.object, { types: b.cardTypes, quantity: "one", modifiers: [] })) {
        results.push({
          cards: [a.cardName, b.cardName],
          type: "recurs",
          strength: 0.8,
          mechanical: `${a.cardName} can return ${b.cardName} from the graveyard to the ${event.to}`,
          events: [event],
        });
        return results; // One recurs interaction per pair is enough
      }
    }
  }

  // 2. Check A's abilities for return effects with from=graveyard
  for (const ability of a.abilities) {
    const effects = getAbilityEffects(ability);
    for (const effect of effects) {
      if (
        effect.type === "return" &&
        effect.gameEffect?.category === "return"
      ) {
        const returnEffect = effect.gameEffect;
        if (returnEffect.from === "graveyard") {
          const returnTarget = returnEffect.target;
          if (
            objectTypesMatch(returnTarget, {
              types: b.cardTypes,
              quantity: "one",
              modifiers: [],
            })
          ) {
            results.push({
              cards: [a.cardName, b.cardName],
              type: "recurs",
              strength: 0.8,
              mechanical: `${a.cardName} can return ${b.cardName} from the graveyard to the ${returnEffect.to}`,
              events: [],
            });
            return results;
          }
        }
      }

      // Also check for zone transitions in effects directly
      if (effect.zoneTransition) {
        const zt = effect.zoneTransition;
        if (
          zt.from === "graveyard" &&
          (zt.to === "battlefield" || zt.to === "hand")
        ) {
          if (
            objectTypesMatch(zt.object, {
              types: b.cardTypes,
              quantity: "one",
              modifiers: [],
            })
          ) {
            results.push({
              cards: [a.cardName, b.cardName],
              type: "recurs",
              strength: 0.8,
              mechanical: `${a.cardName} can return ${b.cardName} from the graveyard to the ${zt.to}`,
              events: [],
            });
            return results;
          }
        }
      }
    }
  }

  // 3. Effect target fallback: detect reanimation patterns the parser misses
  const oracleRecurs = detectRecursFromEffectTargets(a, b);
  if (oracleRecurs) {
    results.push(oracleRecurs);
  }

  return results;
}

/**
 * Effect target fallback for detecting reanimation patterns.
 * Inspects structured effect target data for graveyard zone references
 * that the parser may not extract as full zone transitions.
 */
function detectRecursFromEffectTargets(
  a: CardProfile,
  b: CardProfile
): Interaction | null {
  // Reconstruct oracle text from abilities -- check for graveyard-to-battlefield text
  // We check all effects for any text clues in the raw oracle
  // The oracle text is not stored on CardProfile directly, but we can look for
  // return/put patterns in abilities' effects

  // Pattern: "from a graveyard onto the battlefield" or "from your graveyard to the battlefield"
  // or "from your graveyard to your hand"
  // Since we don't have raw oracle text on CardProfile, check for effects that
  // mention putting cards from graveyard, which the parser may only partially capture

  // Check if any ability has an effect with a target in a graveyard zone
  for (const ability of a.abilities) {
    const effects = getAbilityEffects(ability);
    for (const effect of effects) {
      // Check for "put onto the battlefield" type effects with graveyard targets
      if (effect.target?.zone === "graveyard") {
        if (
          objectTypesMatch(effect.target, {
            types: b.cardTypes,
            quantity: "one",
            modifiers: [],
          })
        ) {
          return {
            cards: [a.cardName, b.cardName],
            type: "recurs",
            strength: 0.6,
            mechanical: `${a.cardName} can return ${b.cardName} from the graveyard`,
            events: [],
          };
        }
      }
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// DETECTOR: TUTORS_FOR
// ═══════════════════════════════════════════════════════════════

/**
 * A tutors_for B if A has effects that search the library,
 * and B matches the search target types.
 */
function detectTutorsFor(a: CardProfile, b: CardProfile): Interaction[] {
  const results: Interaction[] = [];

  for (const ability of a.abilities) {
    const effects = getAbilityEffects(ability);
    for (const effect of effects) {
      if (isSearchEffect(effect)) {
        // Determine what types the search targets
        const searchTarget = getSearchTarget(effect);

        // Check if B matches the search target
        if (
          !searchTarget ||
          searchTarget.types.length === 0 ||
          cardMatchesRef(b.cardTypes, searchTarget)
        ) {
          const targetDesc =
            searchTarget && searchTarget.types.length > 0
              ? searchTarget.types.join("/")
              : "any card";

          results.push({
            cards: [a.cardName, b.cardName],
            type: "tutors_for",
            strength: searchTarget?.types.length ? 0.6 : 0.4,
            mechanical: `${a.cardName} can search for ${b.cardName} (${targetDesc})`,
            events: [],
          });
          return results; // One tutors interaction per pair is enough
        }
      }
    }
  }

  // Also check causesEvents for search_library player actions
  for (const event of a.causesEvents) {
    if (event.kind === "player_action") {
      if (event.action === "search_library") {
        const alreadyFound = results.length > 0;
        if (!alreadyFound) {
          results.push({
            cards: [a.cardName, b.cardName],
            type: "tutors_for",
            strength: 0.4,
            mechanical: `${a.cardName} searches the library and can find ${b.cardName}`,
            events: [event],
          });
          return results;
        }
      }
    }
  }

  return results;
}

/**
 * Check if an effect represents a library search.
 */
function isSearchEffect(effect: Effect): boolean {
  if (effect.type === "search" || effect.type === "search_library") {
    return true;
  }
  // Check for zone transitions from library to hand/battlefield
  if (effect.zoneTransition) {
    const zt = effect.zoneTransition;
    if (
      zt.from === "library" &&
      (zt.to === "hand" || zt.to === "battlefield")
    ) {
      return true;
    }
  }
  // Check for game effects involving return from library
  if (effect.gameEffect?.category === "return") {
    const ret = effect.gameEffect;
    if (ret.from === "library") {
      return true;
    }
  }
  return false;
}

/**
 * Get the target types for a search effect.
 */
function getSearchTarget(effect: Effect): GameObjectRef | undefined {
  if (effect.target) return effect.target;
  if (effect.zoneTransition?.object) return effect.zoneTransition.object;
  if (effect.gameEffect?.category === "return") {
    return effect.gameEffect.target;
  }
  return undefined;
}

// ═══════════════════════════════════════════════════════════════
// DETECTOR: REDUCES_COST
// ═══════════════════════════════════════════════════════════════

/**
 * A reduces_cost for B if:
 * - A has costSubstitutions that apply to B's type
 * - A has static effects that reduce costs for B's card types
 */
function detectReducesCost(a: CardProfile, b: CardProfile): Interaction[] {
  const results: Interaction[] = [];

  // 1. Check A's costSubstitutions
  for (const sub of a.costSubstitutions) {
    if (costSubstitutionAppliesTo(sub, b)) {
      results.push({
        cards: [a.cardName, b.cardName],
        type: "reduces_cost",
        strength: 0.8,
        mechanical: `${a.cardName} can substitute {${sub.replacesSymbol}} in ${b.cardName}'s cost`,
        events: [],
      });
      return results; // One reduces_cost per pair
    }
  }

  // 2. Check A's static effects for cost reduction patterns
  for (const staticEffect of a.staticEffects) {
    const effect = staticEffect.effect;
    if (
      effect.type === "cost_reduction" ||
      effect.type === "reduce_cost" ||
      effect.type === "cost_modifier"
    ) {
      // Check if the affected objects match B's types
      const affectedObjects = staticEffect.affectedObjects;
      if (
        !affectedObjects ||
        cardMatchesRef(b.cardTypes, affectedObjects)
      ) {
        results.push({
          cards: [a.cardName, b.cardName],
          type: "reduces_cost",
          strength: 0.6,
          mechanical: `${a.cardName} reduces the cost of ${b.cardName}`,
          events: [],
        });
        return results;
      }
    }
  }

  return results;
}

/**
 * Check if a cost substitution effect applies to card B.
 */
function costSubstitutionAppliesTo(
  sub: CostSubstitutionEffect,
  b: CardProfile
): boolean {
  // Check if B's mana cost contains the symbol being replaced
  if (b.castingCost) {
    const manaCost = b.castingCost.manaCost.toLowerCase();
    const symbol = sub.replacesSymbol.toLowerCase();
    if (manaCost.includes(`{${symbol}}`)) {
      // Check if the substitution's appliesTo matches B's types
      if (cardMatchesRef(b.cardTypes, sub.appliesTo)) {
        return true;
      }
    }
  }

  // Also check activation costs containing the symbol
  for (const cost of b.consumes) {
    if (cost.costType === "mana") {
      const manaCost = cost.mana.toLowerCase();
      const symbol = sub.replacesSymbol.toLowerCase();
      if (manaCost.includes(`{${symbol}}`)) {
        if (cardMatchesRef(b.cardTypes, sub.appliesTo)) {
          return true;
        }
      }
    }
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════
// DETECTOR: BLOCKS (Slice B)
// ═══════════════════════════════════════════════════════════════

/**
 * A blocks B if:
 * 1. A has replacement effects (mode: "replace" or "prevent") that intercept
 *    events B depends on (triggersOn, causesEvents involving that zone).
 * 2. A has restrictions that prevent actions B requires.
 */
function detectBlocks(a: CardProfile, b: CardProfile): Interaction[] {
  const results: Interaction[] = [];

  // 1. Replacement-based blocking: A.replacements intercept events B depends on
  for (const replacement of a.replacements) {
    // Only "replace" and "prevent" modes actually block — "modify", "add", and
    // "redirect" enhance/redirect without removing the original event
    if (replacement.mode !== "replace" && replacement.mode !== "prevent") continue;

    const replacedEvent = replacement.replaces;

    // Check if B triggers on an event that A's replacement intercepts
    for (const trigger of b.triggersOn) {
      if (eventsMatch(replacedEvent, trigger)) {
        results.push({
          cards: [a.cardName, b.cardName],
          type: "blocks",
          strength: 0.9,
          mechanical: `${a.cardName} replaces ${describeEvent(replacedEvent)}, preventing ${b.cardName}'s trigger`,
          events: [replacedEvent, trigger],
        });
        break; // One replacement blocking one card's triggers is enough
      }
    }

    // Check if B depends on the graveyard (recursion/death triggers) and A
    // replaces the path TO graveyard — meaning the graveyard never gets populated
    if (replacedEvent.kind === "zone_transition" && replacedEvent.to === "graveyard") {
      // A replaces "going to graveyard" → cards that return FROM graveyard are blocked
      for (const event of b.causesEvents) {
        if (event.kind === "zone_transition" && event.from === "graveyard") {
          const alreadyFound = results.some(
            (r) => r.type === "blocks" && r.cards[0] === a.cardName && r.cards[1] === b.cardName
          );
          if (!alreadyFound) {
            results.push({
              cards: [a.cardName, b.cardName],
              type: "blocks",
              strength: 0.8,
              mechanical: `${a.cardName} prevents cards from reaching the graveyard, blocking ${b.cardName}'s recursion`,
              events: [replacedEvent, event],
            });
          }
          break;
        }
      }
      // Also check abilities that return from graveyard
      for (const ability of b.abilities) {
        const effects = getAbilityEffects(ability);
        for (const effect of effects) {
          if (effect.zoneTransition?.from === "graveyard" ||
              (effect.gameEffect?.category === "return" && effect.gameEffect.from === "graveyard")) {
            const alreadyFound = results.some(
              (r) => r.type === "blocks" && r.cards[0] === a.cardName && r.cards[1] === b.cardName
            );
            if (!alreadyFound) {
              results.push({
                cards: [a.cardName, b.cardName],
                type: "blocks",
                strength: 0.8,
                mechanical: `${a.cardName} prevents cards from reaching the graveyard, blocking ${b.cardName}'s recursion`,
                events: [replacedEvent],
              });
            }
            break;
          }
        }
      }
    }
  }

  // 2. Restriction-based blocking: A.restrictions prevent actions B depends on
  for (const restriction of a.restrictions) {
    const blocked = restrictionBlocksCard(restriction, b);
    if (blocked) {
      results.push({
        cards: [a.cardName, b.cardName],
        type: "blocks",
        strength: 0.8,
        mechanical: `${a.cardName} restricts ${restriction.restricts}, blocking ${b.cardName} (${blocked})`,
        events: [],
      });
    }
  }

  // 3. Oracle text fallback: detect "can't" restriction patterns the parser misses
  if (results.length === 0) {
    results.push(...detectBlocksFromOraclePatterns(a, b));
  }

  return results;
}

/**
 * Oracle text fallback for blocking detection. Handles cards like Grafdigger's Cage
 * whose "can't" restriction patterns aren't extracted by the parser as structured
 * RestrictionEffect entries.
 *
 * Uses two strategies:
 * 1. Walk A's parsed abilities for structured restriction effects
 * 2. Regex match A's raw oracle text for common "can't" patterns
 */
function detectBlocksFromOraclePatterns(a: CardProfile, b: CardProfile): Interaction[] {
  const results: Interaction[] = [];

  // Strategy 1: Walk parsed restriction effects
  for (const ability of a.abilities) {
    const effects = getAbilityEffects(ability);
    for (const effect of effects) {
      if (effect.gameEffect?.category === "restriction") {
        const restriction = effect.gameEffect;
        const blocked = detectStructuredRestrictionBlock(restriction, a, b);
        if (blocked) {
          results.push(blocked);
          return results;
        }
      }
    }
  }

  // Strategy 2: Raw oracle text pattern matching for "can't" patterns
  if (a.rawOracleText) {
    const oracleBlocked = detectOracleTextBlock(a, b);
    if (oracleBlocked) {
      results.push(oracleBlocked);
      return results;
    }
  }

  return results;
}

/**
 * Check a structured restriction effect against card B.
 */
function detectStructuredRestrictionBlock(
  restriction: RestrictionEffect,
  a: CardProfile,
  b: CardProfile
): Interaction | null {
  if (restriction.restricts === "enter_battlefield") {
    if (cardDependsOnZoneEntry(b, "battlefield", ["graveyard", "library"])) {
      return {
        cards: [a.cardName, b.cardName],
        type: "blocks",
        strength: 0.8,
        mechanical: `${a.cardName} prevents entering battlefield, blocking ${b.cardName}`,
        events: [],
      };
    }
  }

  if (restriction.restricts === "cast") {
    for (const perm of b.zoneCastPermissions) {
      if (perm.from !== "hand") {
        return {
          cards: [a.cardName, b.cardName],
          type: "blocks",
          strength: 0.8,
          mechanical: `${a.cardName} prevents casting from ${perm.from}, blocking ${b.cardName}`,
          events: [],
        };
      }
    }
  }

  return null;
}

/**
 * Check if card B depends on things entering a specific zone from specific sources.
 */
function cardDependsOnZoneEntry(
  card: CardProfile,
  toZone: string,
  fromZones: string[]
): boolean {
  for (const event of card.causesEvents) {
    if (event.kind === "zone_transition" && event.to === toZone &&
        (event.from === undefined || fromZones.includes(event.from))) {
      return true;
    }
  }
  for (const ability of card.abilities) {
    const effects = getAbilityEffects(ability);
    for (const effect of effects) {
      if (effect.zoneTransition?.to === toZone &&
          (effect.zoneTransition.from === undefined || fromZones.includes(effect.zoneTransition.from))) {
        return true;
      }
      if (effect.gameEffect?.category === "return" &&
          effect.gameEffect.to === toZone &&
          (effect.gameEffect.from === undefined || fromZones.includes(effect.gameEffect.from))) {
        return true;
      }
    }
  }
  return false;
}

/** Common oracle text patterns for graveyard-hate blocking */
const GRAVEYARD_HATE_PATTERNS = [
  /can't enter the battlefield from (?:a |the )?graveyard/i,
  /cards? in graveyards?.+can't enter the battlefield/i,
  /can't cast spells? from (?:a |the )?graveyard/i,
];

const LIBRARY_HATE_PATTERNS = [
  /can't search/i,
  /can't enter the battlefield from (?:a |the )?library/i,
  /cards? in.+libraries.+can't enter the battlefield/i,
  /can't cast spells? from.+libraries/i,
];

/**
 * Raw oracle text fallback: match "can't" patterns in A's oracle text
 * and check if B's strategy is affected.
 */
function detectOracleTextBlock(a: CardProfile, b: CardProfile): Interaction | null {
  const oracle = a.rawOracleText!;

  // Check graveyard hate patterns
  const isGraveyardHate = GRAVEYARD_HATE_PATTERNS.some((p) => p.test(oracle));
  if (isGraveyardHate) {
    // Does B depend on graveyard?
    if (cardDependsOnZoneEntry(b, "battlefield", ["graveyard"]) ||
        cardDependsOnGraveyard(b)) {
      return {
        cards: [a.cardName, b.cardName],
        type: "blocks",
        strength: 0.7, // Slightly lower for oracle fallback
        mechanical: `${a.cardName} has graveyard hate, blocking ${b.cardName}'s graveyard strategy`,
        events: [],
      };
    }
  }

  // Check library hate patterns
  const isLibraryHate = LIBRARY_HATE_PATTERNS.some((p) => p.test(oracle));
  if (isLibraryHate) {
    if (cardDependsOnZoneEntry(b, "battlefield", ["library"]) ||
        cardSearchesLibrary(b)) {
      return {
        cards: [a.cardName, b.cardName],
        type: "blocks",
        strength: 0.7,
        mechanical: `${a.cardName} restricts library access, blocking ${b.cardName}`,
        events: [],
      };
    }
  }

  return null;
}

/**
 * Check if card B depends on the graveyard (triggers on death, returns from GY, etc.)
 */
function cardDependsOnGraveyard(card: CardProfile): boolean {
  for (const trigger of card.triggersOn) {
    if (trigger.kind === "zone_transition") {
      if (trigger.to === "graveyard" || trigger.from === "graveyard") return true;
    }
  }
  for (const event of card.causesEvents) {
    if (event.kind === "zone_transition" && event.from === "graveyard") return true;
  }
  return false;
}

/**
 * Check if card B searches the library.
 */
function cardSearchesLibrary(card: CardProfile): boolean {
  for (const event of card.causesEvents) {
    if (event.kind === "player_action" && event.action === "search_library") return true;
  }
  for (const ability of card.abilities) {
    const effects = getAbilityEffects(ability);
    for (const effect of effects) {
      if (isSearchEffect(effect)) return true;
    }
  }
  return false;
}

/**
 * Check if a restriction effect blocks a specific card's strategy.
 * Returns a description of what's blocked, or null if no blocking.
 */
function restrictionBlocksCard(
  restriction: RestrictionEffect,
  card: CardProfile
): string | null {
  switch (restriction.restricts) {
    case "enter_battlefield": {
      // Blocks recursion cards that return things from graveyard to battlefield
      for (const event of card.causesEvents) {
        if (event.kind === "zone_transition" && event.to === "battlefield") {
          if (event.from === "graveyard" || event.from === "library") {
            return `can't enter battlefield from ${event.from}`;
          }
        }
      }
      // Also blocks cards whose abilities produce ETB zone transitions
      for (const ability of card.abilities) {
        const effects = getAbilityEffects(ability);
        for (const effect of effects) {
          if (effect.zoneTransition?.from === "graveyard" && effect.zoneTransition?.to === "battlefield") {
            return "can't enter battlefield from graveyard";
          }
          if (effect.gameEffect?.category === "return" && effect.gameEffect.from === "graveyard" && effect.gameEffect.to === "battlefield") {
            return "can't return from graveyard to battlefield";
          }
        }
      }
      return null;
    }

    case "cast": {
      // Blocks cards that cast from non-standard zones (graveyard, exile, library)
      for (const perm of card.zoneCastPermissions) {
        if (perm.from !== "hand") {
          return `can't cast from ${perm.from}`;
        }
      }
      return null;
    }

    case "search_library": {
      // Blocks tutors
      for (const event of card.causesEvents) {
        if (event.kind === "player_action" && event.action === "search_library") {
          return "can't search library";
        }
      }
      for (const ability of card.abilities) {
        const effects = getAbilityEffects(ability);
        for (const effect of effects) {
          if (isSearchEffect(effect)) {
            return "can't search library";
          }
        }
      }
      return null;
    }

    case "draw": {
      // Blocks cards that depend on drawing (scope typically "more than one each turn")
      if (restriction.scope?.includes("more than one")) {
        // Only blocks extra-draw strategies, not normal draw
        for (const event of card.causesEvents) {
          if (event.kind === "player_action" && event.action === "draw_card") {
            return "can't draw more than one card each turn";
          }
        }
      }
      return null;
    }

    case "gain_life": {
      // Blocks lifegain strategy cards
      if (card.produces.some((p) => p.category === "life")) {
        return "can't gain life";
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Describe a GameEvent in human-readable form.
 */
function describeEvent(event: GameEvent): string {
  if (event.kind === "zone_transition") {
    const from = event.from || "anywhere";
    const to = event.to || "anywhere";
    const obj = event.object.types.length > 0 ? event.object.types.join("/") : "card";
    return `${obj} moving from ${from} to ${to}`;
  }
  if (event.kind === "state_change") {
    return `${event.property} change`;
  }
  if (event.kind === "damage") {
    return "damage";
  }
  if (event.kind === "player_action") {
    return event.action;
  }
  return "event";
}

// ═══════════════════════════════════════════════════════════════
// CONFLICTS (derived from blocks)
// ═══════════════════════════════════════════════════════════════

/**
 * Derive conflict interactions from blocks. A conflict is a bidirectional
 * view: if A blocks B, they conflict with each other.
 */
function deriveConflicts(interactions: Interaction[]): Interaction[] {
  const conflicts: Interaction[] = [];
  const seen = new Set<string>();

  for (const block of interactions) {
    if (block.type !== "blocks") continue;

    const key = [block.cards[0], block.cards[1]].sort().join(":");
    if (seen.has(key)) continue;
    seen.add(key);

    conflicts.push({
      cards: block.cards,
      type: "conflicts",
      strength: block.strength * 0.9, // Slightly lower than the direct block
      mechanical: `${block.cards[0]} conflicts with ${block.cards[1]}: ${block.mechanical}`,
      events: block.events,
    });
  }

  return conflicts;
}

// ═══════════════════════════════════════════════════════════════
// INTERACTION BLOCKERS (dependency graph entries)
// ═══════════════════════════════════════════════════════════════

/**
 * Build InteractionBlocker entries from blocks interactions.
 * Groups by blocker card and identifies which interactions are disrupted.
 */
function buildBlockerEntries(
  interactions: Interaction[],
  profiles: CardProfile[]
): InteractionBlocker[] {
  const blockerMap = new Map<string, InteractionBlocker>();

  for (const block of interactions) {
    if (block.type !== "blocks") continue;

    const blockerName = block.cards[0];
    const blockedName = block.cards[1];

    if (!blockerMap.has(blockerName)) {
      // Find the mechanism (replacement or restriction) from the blocker's profile
      const blockerProfile = profiles.find((p) => p.cardName === blockerName);
      const { mechanism, mechanismType } = findBlockingMechanism(blockerProfile, block);

      blockerMap.set(blockerName, {
        blocker: blockerName,
        mechanism,
        mechanismType,
        blockedEvents: [],
        blockedInteractions: [],
        description: `${blockerName} blocks interactions for: ${blockedName}`,
      });
    }

    const entry = blockerMap.get(blockerName)!;

    // Add blocked events
    for (const event of block.events) {
      entry.blockedEvents.push(event);
    }

    // Find interactions that involve the blocked card and are actually disrupted
    // Only include interactions whose events overlap with what the blocker prevents
    const affectedInteractions = interactions.filter(
      (i) =>
        i.type !== "blocks" &&
        i.type !== "conflicts" &&
        (i.cards[0] === blockedName || i.cards[1] === blockedName) &&
        interactionDisruptedByBlocker(i, block.events)
    );
    for (const affected of affectedInteractions) {
      if (!entry.blockedInteractions.some((bi) =>
        bi.cards[0] === affected.cards[0] &&
        bi.cards[1] === affected.cards[1] &&
        bi.type === affected.type
      )) {
        entry.blockedInteractions.push(affected);
      }
    }

    // Update description with all blocked cards
    const allBlocked = interactions
      .filter((i) => i.type === "blocks" && i.cards[0] === blockerName)
      .map((i) => i.cards[1]);
    const uniqueBlocked = [...new Set(allBlocked)];
    entry.description = `${blockerName} blocks interactions for: ${uniqueBlocked.join(", ")}`;
  }

  return [...blockerMap.values()];
}

/**
 * Find the specific mechanism (replacement ability or restriction) responsible
 * for a blocks interaction.
 */
function findBlockingMechanism(
  profile: CardProfile | undefined,
  block: Interaction
): { mechanism: InteractionBlocker["mechanism"]; mechanismType: "replacement" | "restriction" } {
  if (!profile) {
    // Fallback — shouldn't happen but return a dummy replacement
    return {
      mechanism: {
        abilityType: "replacement" as const,
        replaces: { kind: "zone_transition", from: "battlefield", to: "graveyard", object: { types: [], quantity: "one" as const, modifiers: [] }, cause: "destruction" },
        with: [],
        mode: "replace" as const,
      },
      mechanismType: "replacement",
    };
  }

  // Check if the block involves a replacement effect
  if (block.events.length > 0) {
    for (const replacement of profile.replacements) {
      if (replacement.mode === "replace" || replacement.mode === "prevent") {
        for (const event of block.events) {
          if (eventsMatch(replacement.replaces, event)) {
            return {
              mechanism: {
                abilityType: "replacement" as const,
                replaces: replacement.replaces,
                with: replacement.with,
                mode: replacement.mode,
              },
              mechanismType: "replacement",
            };
          }
        }
      }
    }
  }

  // Check if the block involves a restriction
  for (const restriction of profile.restrictions) {
    if (block.mechanical.includes(restriction.restricts)) {
      return { mechanism: restriction, mechanismType: "restriction" };
    }
  }

  // Default to first replacement if available, otherwise first restriction
  if (profile.replacements.length > 0) {
    const rep = profile.replacements[0];
    return {
      mechanism: {
        abilityType: "replacement" as const,
        replaces: rep.replaces,
        with: rep.with,
        mode: rep.mode,
      },
      mechanismType: "replacement",
    };
  }
  if (profile.restrictions.length > 0) {
    return { mechanism: profile.restrictions[0], mechanismType: "restriction" };
  }

  // Oracle text fallback — create a synthetic restriction for the blocker entry
  if (profile.rawOracleText) {
    const isGraveyardHate = GRAVEYARD_HATE_PATTERNS.some((p) => p.test(profile.rawOracleText!));
    if (isGraveyardHate) {
      return {
        mechanism: {
          category: "restriction" as const,
          restricts: "enter_battlefield",
          target: { types: [], quantity: "all" as const, modifiers: [] },
          scope: "from graveyard",
        },
        mechanismType: "restriction",
      };
    }
  }

  // Last resort fallback
  return {
    mechanism: {
      abilityType: "replacement" as const,
      replaces: { kind: "zone_transition", from: "battlefield", to: "graveyard", object: { types: [], quantity: "one" as const, modifiers: [] }, cause: "destruction" },
      with: [],
      mode: "replace" as const,
    },
    mechanismType: "replacement",
  };
}

// ═══════════════════════════════════════════════════════════════
// SLICE C: CHAINS, LOOPS, AND ENABLERS
// ═══════════════════════════════════════════════════════════════

/**
 * Check if an interaction is actually disrupted by the blocker's events.
 * Used to filter blockedInteractions to only relevant ones (C2 fix).
 */
function interactionDisruptedByBlocker(
  interaction: Interaction,
  blockedEvents: GameEvent[]
): boolean {
  // A "triggers" or "recurs" interaction is disrupted if any of its events
  // match the blocked events (e.g., death trigger blocked by graveyard replacement)
  for (const iEvent of interaction.events) {
    for (const bEvent of blockedEvents) {
      if (eventsMatch(iEvent, bEvent) || eventsMatch(bEvent, iEvent)) {
        return true;
      }
      // Indirect match: blocked event prevents graveyard population,
      // interaction depends on graveyard access
      if (bEvent.kind === "zone_transition" && bEvent.to === "graveyard" &&
          iEvent.kind === "zone_transition" && iEvent.from === "graveyard") {
        return true;
      }
    }
  }
  // Also check by interaction type + event kind patterns
  if (interaction.type === "recurs") {
    // Recursion is disrupted by anything blocking graveyard access
    return blockedEvents.some(
      (e) => e.kind === "zone_transition" &&
        (e.to === "graveyard" || e.from === "graveyard")
    );
  }
  return false;
}

/**
 * Detect multi-card causal chains (3+ cards in a path through the
 * interaction graph).
 *
 * A chain represents A → B → C where:
 *   A enables/triggers B AND B enables/triggers C
 *   forming a causal sequence.
 */
function detectChains(
  interactions: Interaction[],
  profiles: CardProfile[]
): InteractionChain[] {
  if (profiles.length < 3) return [];

  // Build adjacency list from causal interactions (directional)
  const causalTypes = new Set<string>([
    "enables", "triggers", "recurs", "reduces_cost",
  ]);
  const adjacency = new Map<string, Map<string, Interaction>>();

  for (const inter of interactions) {
    if (!causalTypes.has(inter.type)) continue;
    const from = inter.cards[0];
    const to = inter.cards[1];
    if (!adjacency.has(from)) adjacency.set(from, new Map());
    // Keep the strongest interaction per edge
    const existing = adjacency.get(from)!.get(to);
    if (!existing || inter.strength > existing.strength) {
      adjacency.get(from)!.set(to, inter);
    }
  }

  const chains: InteractionChain[] = [];
  const seen = new Set<string>();

  // DFS from each node to find paths of length >= 3
  for (const startCard of adjacency.keys()) {
    const stack: { path: string[]; interactions: Interaction[] }[] = [
      { path: [startCard], interactions: [] },
    ];

    while (stack.length > 0) {
      const { path, interactions: pathInteractions } = stack.pop()!;
      const current = path[path.length - 1];
      const neighbors = adjacency.get(current);
      if (!neighbors) continue;

      for (const [next, inter] of neighbors) {
        // Avoid revisiting nodes in this path (no cycles — that's loops)
        if (path.includes(next)) continue;

        const newPath = [...path, next];
        const newInteractions = [...pathInteractions, inter];

        // Emit chain if path has 3+ cards
        if (newPath.length >= 3) {
          const key = newPath.join(" → ");
          if (!seen.has(key)) {
            seen.add(key);
            chains.push(buildChain(newPath, newInteractions));
          }
        }

        // Continue extending if not too long
        if (newPath.length < 5) {
          stack.push({ path: newPath, interactions: newInteractions });
        }
      }
    }
  }

  return chains;
}

function buildChain(
  path: string[],
  interactions: Interaction[]
): InteractionChain {
  const steps: InteractionChain["steps"] = [];
  for (let i = 0; i < interactions.length; i++) {
    const inter = interactions[i];
    steps.push({
      from: path[i],
      to: path[i + 1],
      event: inter.events[0] || {
        kind: "zone_transition" as const,
        to: "battlefield" as const,
        object: { types: [], quantity: "one" as const, modifiers: [] },
      },
      description: inter.mechanical,
    });
  }

  return {
    cards: path,
    description: `${path.join(" → ")}: ${steps.map((s) => s.description).join("; ")}`,
    steps,
  };
}

/**
 * Detect resource loops — cycles in the interaction graph where cards
 * produce resources consumed by the next card in the cycle.
 *
 * A loop requires:
 * 1. A cycle of 2+ cards where A→B and B→A (or longer cycles)
 * 2. The cycle involves "enables" or "triggers" interactions
 * 3. Net resource computation determines if the loop is infinite
 */
function detectLoops(
  interactions: Interaction[],
  profiles: CardProfile[]
): InteractionLoop[] {
  if (profiles.length < 2) return [];

  // Build adjacency from causal interactions
  const causalTypes = new Set<string>(["enables", "triggers"]);
  const adjacency = new Map<string, Map<string, Interaction[]>>();

  for (const inter of interactions) {
    if (!causalTypes.has(inter.type)) continue;
    const from = inter.cards[0];
    const to = inter.cards[1];
    if (!adjacency.has(from)) adjacency.set(from, new Map());
    if (!adjacency.get(from)!.has(to)) adjacency.get(from)!.set(to, []);
    adjacency.get(from)!.get(to)!.push(inter);
  }

  const loops: InteractionLoop[] = [];
  const seen = new Set<string>();

  // Find cycles using DFS from each node
  for (const startCard of adjacency.keys()) {
    findCycles(startCard, [startCard], adjacency, loops, seen, profiles);
  }

  return loops;
}

function findCycles(
  start: string,
  path: string[],
  adjacency: Map<string, Map<string, Interaction[]>>,
  loops: InteractionLoop[],
  seen: Set<string>,
  profiles: CardProfile[]
): void {
  const current = path[path.length - 1];
  const neighbors = adjacency.get(current);
  if (!neighbors) return;

  for (const [next, inters] of neighbors) {
    if (next === start && path.length >= 2) {
      // Found a cycle back to start
      const key = [...path].sort().join("+");
      if (!seen.has(key)) {
        seen.add(key);
        loops.push(buildLoop(path, start, adjacency, profiles));
      }
    } else if (!path.includes(next) && path.length < 5) {
      findCycles(start, [...path, next], adjacency, loops, seen, profiles);
    }
  }
}

function buildLoop(
  path: string[],
  start: string,
  adjacency: Map<string, Map<string, Interaction[]>>,
  profiles: CardProfile[]
): InteractionLoop {
  const steps: InteractionChain["steps"] = [];
  const fullPath = [...path, start]; // close the cycle

  for (let i = 0; i < fullPath.length - 1; i++) {
    const from = fullPath[i];
    const to = fullPath[i + 1];
    const inters = adjacency.get(from)?.get(to) || [];
    const best = inters[0];
    steps.push({
      from,
      to,
      event: best?.events[0] || {
        kind: "zone_transition" as const,
        to: "battlefield" as const,
        object: { types: [], quantity: "one" as const, modifiers: [] },
      },
      description: best?.mechanical || `${from} interacts with ${to}`,
    });
  }

  // Compute net effect
  const netEffect = computeNetEffect(path, profiles);

  // Determine if infinite: loop is infinite if it produces all resources
  // it consumes (net non-negative for all resource types)
  const isInfinite = checkInfinite(path, profiles);

  return {
    cards: path,
    description: `Loop: ${path.join(" → ")} → ${start}`,
    steps,
    netEffect,
    isInfinite,
  };
}

function computeNetEffect(
  loopCards: string[],
  profiles: CardProfile[]
): InteractionLoop["netEffect"] {
  const resources: PlayerResource[] = [];
  const attributes: ObjectAttribute[] = [];
  const events: GameEvent[] = [];

  for (const cardName of loopCards) {
    const p = profiles.find((pr) => pr.cardName === cardName);
    if (!p) continue;

    // Collect produced resources
    for (const prod of p.produces) {
      if ("category" in prod) {
        if (prod.category === "mana" || prod.category === "life" || prod.category === "cards") {
          resources.push(prod);
        } else if (prod.category === "counter" || prod.category === "stat_mod" || prod.category === "keyword_grant") {
          attributes.push(prod);
        }
      } else if (prod.category === "create_token") {
        // Token creation causes an ETB event
        events.push({
          kind: "zone_transition",
          to: "battlefield",
          object: { types: ["creature"], quantity: "one", modifiers: [] },
        });
      }
    }

    // Collect caused events
    for (const event of p.causesEvents) {
      events.push(event);
    }
  }

  return { resources, attributes, events };
}

function checkInfinite(
  loopCards: string[],
  profiles: CardProfile[]
): boolean {
  // A loop is infinite if the mana produced covers the mana consumed.
  // Simple heuristic: sum all mana production and compare to costs.
  let totalManaProduced = 0;
  let totalManaCost = 0;
  const producedColors = new Set<string>();
  const requiredColors = new Set<string>();

  for (const cardName of loopCards) {
    const p = profiles.find((pr) => pr.cardName === cardName);
    if (!p) continue;

    for (const prod of p.produces) {
      if ("category" in prod && prod.category === "mana") {
        const qty = typeof prod.quantity === "number" ? prod.quantity : 0;
        totalManaProduced += qty;
        if (prod.color === "any") {
          // "Any color" satisfies all color requirements
          for (const c of ["W", "U", "B", "R", "G", "C"]) producedColors.add(c);
        } else if (prod.color) {
          producedColors.add(prod.color);
        }
      }
    }

    for (const cost of p.consumes) {
      if (cost.costType === "mana") {
        // Parse mana symbols properly: {1} = 1 generic, {B} = 1 colored
        const symbolRegex = /\{([^}]+)\}/g;
        let match;
        while ((match = symbolRegex.exec(cost.mana)) !== null) {
          const sym = match[1];
          if (/^\d+$/.test(sym)) {
            totalManaCost += parseInt(sym, 10);
          } else {
            totalManaCost += 1;
            if (/^[WUBRG]$/.test(sym)) requiredColors.add(sym);
          }
        }
      }
    }
  }

  // All required colors must be produced within the loop
  for (const color of requiredColors) {
    if (!producedColors.has(color)) return false;
  }

  // Loop is infinite if it produces at least as much mana as it consumes
  return totalManaProduced >= totalManaCost;
}

/**
 * Detect enablers — cards that participate in many interactions and are
 * central to the deck's interaction graph.
 */
function detectEnablers(
  interactions: Interaction[],
  profiles: CardProfile[]
): InteractionEnabler[] {
  if (interactions.length === 0 || profiles.length === 0) return [];

  // Count how many positive interactions each card participates in
  const interactionCount = new Map<string, Interaction[]>();
  const positiveTypes = new Set<string>([
    "enables", "triggers", "amplifies", "protects",
    "recurs", "reduces_cost", "tutors_for",
  ]);

  for (const inter of interactions) {
    if (!positiveTypes.has(inter.type)) continue;
    for (const card of inter.cards) {
      if (!interactionCount.has(card)) interactionCount.set(card, []);
      interactionCount.get(card)!.push(inter);
    }
  }

  const enablers: InteractionEnabler[] = [];

  // A card is an enabler if it participates in 2+ positive interactions
  for (const [cardName, inters] of interactionCount) {
    if (inters.length >= 2) {
      enablers.push({
        enabler: cardName,
        enabledInteractions: inters,
        isRequired: inters.some(
          (i) => i.type === "enables" && i.cards[0] === cardName
        ),
      });
    }
  }

  // Sort by number of enabled interactions (most central first)
  enablers.sort((a, b) => b.enabledInteractions.length - a.enabledInteractions.length);

  return enablers;
}

// ═══════════════════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Extract all effects from an ability node, regardless of type.
 */
function getAbilityEffects(
  ability: CardProfile["abilities"][number]
): Effect[] {
  if (ability.abilityType === "replacement") return ability.with;
  if (ability.abilityType === "keyword") return [];
  return ability.effects;
}
