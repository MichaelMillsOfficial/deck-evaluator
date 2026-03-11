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
  Subtype,
  Supertype,
  SacrificeCost,
} from "./types";
import { PERMANENT_TYPES, matchesCompositeType } from "./game-model";

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Analyze a set of card profiles and find all pairwise mechanical
 * interactions between them.
 */
/**
 * Detect pairwise interactions for a single pair (both directions).
 * Extracted to allow batching in async mode.
 */
function detectPairInteractions(a: CardProfile, b: CardProfile): Interaction[] {
  const results: Interaction[] = [];
  results.push(...detectEnables(a, b));
  results.push(...detectEnables(b, a));
  results.push(...detectTriggers(a, b));
  results.push(...detectTriggers(b, a));
  results.push(...detectProtects(a, b));
  results.push(...detectProtects(b, a));
  results.push(...detectAmplifies(a, b));
  results.push(...detectAmplifies(b, a));
  results.push(...detectRecurs(a, b));
  results.push(...detectRecurs(b, a));
  results.push(...detectTutorsFor(a, b));
  results.push(...detectTutorsFor(b, a));
  results.push(...detectReducesCost(a, b));
  results.push(...detectReducesCost(b, a));
  results.push(...detectBlocks(a, b));
  results.push(...detectBlocks(b, a));
  return results;
}

/**
 * Build the final analysis result from pairwise interactions.
 */
function deduplicateInteractions(interactions: Interaction[]): Interaction[] {
  const seen = new Map<string, Interaction>();
  for (const inter of interactions) {
    const key = `${inter.type}:${inter.cards[0]}:${inter.cards[1]}`;
    const existing = seen.get(key);
    if (!existing || inter.strength > existing.strength) {
      seen.set(key, inter);
    }
  }
  return Array.from(seen.values());
}

function buildAnalysisResult(
  profileMap: Record<string, CardProfile>,
  interactions: Interaction[],
  profiles: CardProfile[]
): InteractionAnalysis {
  // Global dedup: keep highest-strength interaction per (type, cardA, cardB) triple
  interactions = deduplicateInteractions(interactions);

  // Quality gate: remove interactions below minimum confidence threshold.
  // This filters out vague-to-vague matches (scored 0.3) and other low-confidence
  // results that would pollute chains, loops, and enablers.
  const MIN_PAIRWISE_STRENGTH = 0.5;
  interactions = interactions.filter((i) => i.strength >= MIN_PAIRWISE_STRENGTH);

  // Derive conflicts from blocks (bidirectional view of blocking)
  interactions.push(...deriveConflicts(interactions));

  // Build InteractionBlocker entries from blocks interactions
  const blockers = buildBlockerEntries(interactions, profiles);

  // Detect chains, loops, and enablers
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
      interactions.push(...detectPairInteractions(profiles[i], profiles[j]));
    }
  }

  return buildAnalysisResult(profileMap, interactions, profiles);
}

/**
 * Async version of findInteractions that yields to the browser between
 * batches of pair checks to prevent main thread blocking.
 *
 * @param onProgress - Called with (0-1) progress during pair detection
 * @param cancelled  - Function returning true if computation should abort
 */
export async function findInteractionsAsync(
  profiles: CardProfile[],
  onProgress?: (progress: number) => void,
  cancelled?: () => boolean
): Promise<InteractionAnalysis> {
  const profileMap: Record<string, CardProfile> = {};
  for (const p of profiles) {
    if (!profileMap[p.cardName]) {
      profileMap[p.cardName] = p;
    }
  }

  const interactions: Interaction[] = [];
  const totalPairs = (profiles.length * (profiles.length - 1)) / 2;
  let pairsDone = 0;

  // Process pairs in batches, yielding between batches
  const PAIR_BATCH_SIZE = 50;
  const yield_ = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      if (cancelled?.()) {
        return buildAnalysisResult(profileMap, interactions, profiles);
      }

      interactions.push(...detectPairInteractions(profiles[i], profiles[j]));
      pairsDone++;

      if (pairsDone % PAIR_BATCH_SIZE === 0) {
        onProgress?.(pairsDone / totalPairs);
        await yield_();
      }
    }
  }

  onProgress?.(1);
  await yield_();

  return buildAnalysisResult(profileMap, interactions, profiles);
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
    // Self-ONLY triggers ("When ~ enters the battlefield") only trigger on the
    // card itself — never on another card's events. Detected by self: true with
    // no additional types (empty types = specifically this card, not a class).
    // Self-INCLUDED triggers ("Whenever ~ or another creature dies") have types
    // alongside self, so they DO match other cards' events of those types.
    if (trigger.object?.self && (!trigger.object.types || trigger.object.types.length === 0)) {
      return false;
    }

    // Both must agree on from/to zones (undefined = wildcard)
    if (caused.from && trigger.from && caused.from !== trigger.from) return false;
    if (caused.to && trigger.to && caused.to !== trigger.to) return false;
    // Object types must be compatible
    return objectTypesMatch(caused.object, trigger.object);
  }

  if (caused.kind === "state_change" && trigger.kind === "state_change") {
    if (caused.property !== trigger.property) return false;
    // If both specify objects, their types must be compatible
    if (caused.object && trigger.object) {
      return objectTypesMatch(caused.object, trigger.object);
    }
    return true;
  }

  if (caused.kind === "damage" && trigger.kind === "damage") {
    // If trigger specifically requires combat damage, caused must be combat
    if (trigger.isCombatDamage && !caused.isCombatDamage) return false;
    // Check source type compatibility when the caused event has type info.
    // When the caused source has no type info (generic "deals damage"),
    // pass through — detectTriggers will verify the card matches.
    const causedSource = caused.source;
    const triggerSource = trigger.source;
    if (causedSource && triggerSource) {
      const causedHasTypeInfo =
        causedSource.types.length > 0 ||
        (causedSource.subtypes?.length ?? 0) > 0;
      if (causedHasTypeInfo) {
        if (!objectTypesMatch(causedSource, triggerSource)) return false;
      }
    }
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
const expansionCache = new Map<string, readonly string[]>();

function expandCompositeTypes(types: string[]): readonly string[] {
  const key = types.join(",");
  const cached = expansionCache.get(key);
  if (cached) return cached;

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
  const frozen = Object.freeze(expanded);
  expansionCache.set(key, frozen);
  return frozen;
}

/**
 * Check if two object refs are compatible (e.g., caused event vs trigger).
 * Empty types = matches anything (wildcard).
 * Handles composite types like "permanent" by expanding them.
 *
 * Subtype handling is BIDIRECTIONAL: if either side requires subtypes,
 * the other side must have at least one matching subtype. This prevents
 * "whenever a Sliver dies" from matching a non-Sliver dying, and vice versa.
 * Comparisons are case-insensitive since the parser normalises to lowercase
 * while the capability extractor preserves original casing.
 */
function objectTypesMatch(
  a: GameObjectRef | undefined,
  b: GameObjectRef | undefined
): boolean {
  if (!a || !b) return true;
  // Type check
  if (a.types.length > 0 && b.types.length > 0) {
    const expandedA = expandCompositeTypes(a.types);
    const expandedB = expandCompositeTypes(b.types);
    if (!expandedA.some((t) => expandedB.includes(t))) return false;
  }
  // Bidirectional subtype check (case-insensitive)
  const aSubtypes = a.subtypes?.map((s) => s.toLowerCase()) ?? [];
  const bSubtypes = b.subtypes?.map((s) => s.toLowerCase()) ?? [];
  // If a requires subtypes, b must have at least one match
  if (aSubtypes.length > 0) {
    if (bSubtypes.length === 0 || !aSubtypes.some((st) => bSubtypes.includes(st))) {
      return false;
    }
  }
  // If b requires subtypes, a must have at least one match
  if (bSubtypes.length > 0) {
    if (aSubtypes.length === 0 || !bSubtypes.some((st) => aSubtypes.includes(st))) {
      return false;
    }
  }
  // Modifier compatibility: nontoken vs token
  const aModifiers = a.modifiers ?? [];
  const bModifiers = b.modifiers ?? [];
  if (aModifiers.includes("nontoken") && bModifiers.includes("token")) return false;
  if (aModifiers.includes("token") && bModifiers.includes("nontoken")) return false;
  return true;
}

/**
 * Check if a card (by its cardTypes) matches a GameObjectRef filter.
 * Empty types in the ref = matches anything.
 * Handles composite types like "permanent" by expanding them.
 */
function cardMatchesRef(
  cardTypes: CardType[],
  ref: GameObjectRef,
  cardSubtypes?: Subtype[],
  cardSupertypes?: Supertype[]
): boolean {
  // Type check (handle empty types differently)
  if (ref.types.length > 0) {
    const expandedRefTypes = expandCompositeTypes(ref.types);
    if (!expandedRefTypes.some((t) => cardTypes.includes(t as CardType))) {
      return false;
    }
  }
  // Subtype check - if ref requires specific subtypes, card must have at least one
  // Case-insensitive: parser normalises to lowercase, card profiles keep original case
  if (ref.subtypes && ref.subtypes.length > 0) {
    if (!cardSubtypes) return false;
    const cardSubsLower = cardSubtypes.map((s) => s.toLowerCase());
    if (!ref.subtypes.some((st) => cardSubsLower.includes(st.toLowerCase()))) {
      return false;
    }
  }
  // Supertype check - if ref requires specific supertypes, card must have at least one
  if (ref.supertypes && ref.supertypes.length > 0) {
    if (!cardSupertypes || !ref.supertypes.some((st) => cardSupertypes.includes(st))) {
      return false;
    }
  }
  // Composite type check - use matchesCompositeType from game-model
  if (ref.compositeTypes && ref.compositeTypes.length > 0) {
    const matchesAny = ref.compositeTypes.some((ct) =>
      matchesCompositeType(ct, {
        types: cardTypes,
        supertypes: cardSupertypes || [],
        subtypes: cardSubtypes || [],
      })
    );
    if (!matchesAny) return false;
  }
  return true;
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
    // Self-sacrifice costs never match other cards' tokens
    if (cost.object.self) return false;
    const tokenTypes = resource.token.types;
    const sacTypes = cost.object.types;
    const sacSubtypes = cost.object.subtypes || [];
    // If sacrifice requires specific subtypes (e.g. "Sacrifice a Sliver"),
    // the token must have that subtype
    if (sacSubtypes.length > 0) {
      const tokenSubtypes = resource.token.subtypes || [];
      const subtypeMatch = sacSubtypes.some((s) => tokenSubtypes.includes(s));
      if (!subtypeMatch) return false;
    }
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
  cost: SacrificeCost,
  cardSubtypes?: Subtype[],
  cardSupertypes?: Supertype[]
): boolean {
  // Self-sacrifice ("Sacrifice ~") only sacrifices the card itself,
  // never other cards — no pairwise interaction
  if (cost.object.self) {
    return false;
  }
  if (cost.object.types.length === 0 && (!cost.object.subtypes || cost.object.subtypes.length === 0)) {
    return isPermanentCard(cardTypes);
  }
  return cardMatchesRef(cardTypes, cost.object, cardSubtypes, cardSupertypes);
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
          // Only create mana-enables-mana if A is a resource converter that
          // transforms non-mana resources into mana on the SAME ability.
          // e.g. Ashnod's Altar: "Sacrifice a creature: Add {C}{C}" — the
          // sacrifice cost and mana output are on the same activated ability.
          // Pure mana producers (lands, mana dorks) just tap — they're parallel
          // producers, not a conversion chain. A card like The World Tree
          // has both a tap-for-mana ability AND a separate sacrifice ability;
          // the sacrifice is on a different ability, so it's not a converter.
          const manaDedupKey = `enables:mana:${a.cardName}:${b.cardName}`;
          if (seen.has(manaDedupKey)) {
            continue;
          }
          let converterCostType = "";
          const isManaConverter = a.abilities.some((ability) => {
            if (ability.abilityType !== "activated") return false;
            const costs = ability.costs || [];
            const effects = ability.effects || [];
            const nonTrivialCost = costs.find(
              (c: Cost) => c.costType === "sacrifice" || c.costType === "pay_life" ||
                c.costType === "exile" || c.costType === "discard"
            );
            const producesMana = effects.some(
              (e: Effect) => e.type === "add_mana"
            );
            if (nonTrivialCost && producesMana) {
              converterCostType = nonTrivialCost.costType;
              return true;
            }
            return false;
          });
          if (!isManaConverter) {
            continue;
          }
          strength = 0.6;
          const costVerb = converterCostType === "sacrifice" ? "sacrificing permanents"
            : converterCostType === "pay_life" ? "paying life"
            : converterCostType === "exile" ? "exiling cards"
            : converterCostType === "discard" ? "discarding cards"
            : "converting resources";
          mechanical = `${a.cardName} converts ${costVerb} into mana, fueling ${b.cardName}'s abilities`;
          seen.add(manaDedupKey);
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
        if (cardSatisfiesSacrificeCost(a.cardTypes, cost, a.subtypes, a.supertypes)) {
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
  // Disabled: too noisy — "Sol Ring helps cast everything" generates ~N
  // interactions per mana producer, drowning out real synergies.

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
  const seen = new Set<string>();

  for (const caused of a.causesEvents) {
    for (const trigger of b.triggersOn) {
      if (eventsMatch(caused, trigger)) {
        // For damage events where the trigger requires specific source types
        // (e.g., "Whenever a Sliver deals damage"), verify the card itself
        // matches the source filter — the event data may lack source type info.
        if (caused.kind === "damage" && trigger.kind === "damage") {
          const triggerSource = trigger.source;
          if (
            triggerSource &&
            ((triggerSource.subtypes?.length ?? 0) > 0 ||
              triggerSource.types.length > 0)
          ) {
            if (
              !cardMatchesRef(
                a.cardTypes,
                triggerSource,
                a.subtypes,
                a.supertypes
              )
            ) {
              continue;
            }
          }
        }

        // Dedup: keep the best (highest strength) interaction per card pair + event kind
        const dedupKey = `triggers:${a.cardName}:${b.cardName}:${caused.kind}:${trigger.kind}`;
        if (seen.has(dedupKey)) {
          continue;
        }
        seen.add(dedupKey);

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

  // Oracle text fallback: detect trigger patterns the structured parser misses
  if (results.length === 0) {
    results.push(...detectTriggersFromOraclePatterns(a, b, seen));
  }

  return results;
}

// ─── Oracle trigger detection patterns ───

/**
 * Oracle text fallback for trigger detection. Catches:
 * - Life gain → "whenever you gain life" triggers
 * - Spell cast type → "whenever you cast an instant or sorcery"
 * - Draw events → "whenever you draw a card"
 * - Enchantment ETB → constellation ("whenever an enchantment enters")
 * - Land ETB → landfall ("whenever a land enters")
 * - Attack triggers → "whenever a [type] attacks"
 */
function detectTriggersFromOraclePatterns(
  a: CardProfile,
  b: CardProfile,
  seen: Set<string>
): Interaction[] {
  const results: Interaction[] = [];
  const aOracle = a.rawOracleText || "";
  const bOracle = b.rawOracleText || "";

  // A causes life gain → B triggers on life gain
  if (cardCausesLifeGain(a, aOracle) && cardTriggersOnLifeGain(b, bOracle)) {
    const dedupKey = `triggers:${a.cardName}:${b.cardName}:player_action:player_action`;
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      results.push({
        cards: [a.cardName, b.cardName],
        type: "triggers",
        strength: 0.8,
        mechanical: `${a.cardName} gains life, triggering ${b.cardName}`,
        events: [],
      });
    }
  }

  // A is an instant/sorcery → B triggers on instant/sorcery cast
  if (cardIsSpellType(a, ["instant", "sorcery"]) && cardTriggersOnSpellCast(b, bOracle, ["instant", "sorcery"])) {
    const dedupKey = `triggers:${a.cardName}:${b.cardName}:player_action:player_action`;
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      results.push({
        cards: [a.cardName, b.cardName],
        type: "triggers",
        strength: 0.8,
        mechanical: `Casting ${a.cardName} triggers ${b.cardName}'s spell cast trigger`,
        events: [],
      });
    }
  }

  // A causes draw → B triggers on draw
  if (cardCausesDraw(a, aOracle) && cardTriggersOnDraw(b, bOracle)) {
    const dedupKey = `triggers:${a.cardName}:${b.cardName}:player_action:player_action:draw`;
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      results.push({
        cards: [a.cardName, b.cardName],
        type: "triggers",
        strength: 0.8,
        mechanical: `${a.cardName} draws cards, triggering ${b.cardName}`,
        events: [],
      });
    }
  }

  // A is an enchantment → B triggers on enchantment ETB (constellation)
  if (a.cardTypes.includes("enchantment") && cardTriggersOnEnchantmentETB(b, bOracle)) {
    const dedupKey = `triggers:${a.cardName}:${b.cardName}:zone_transition:zone_transition:enchantment`;
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      results.push({
        cards: [a.cardName, b.cardName],
        type: "triggers",
        strength: 0.8,
        mechanical: `${a.cardName} entering triggers ${b.cardName}'s enchantment ETB ability`,
        events: [],
      });
    }
  }

  // A is a creature → B triggers on creature ETB ("whenever another creature enters")
  if (a.cardTypes.includes("creature") && cardTriggersOnCreatureETB(b, bOracle)) {
    const dedupKey = `triggers:${a.cardName}:${b.cardName}:zone_transition:zone_transition:creature_etb`;
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      results.push({
        cards: [a.cardName, b.cardName],
        type: "triggers",
        strength: 0.8,
        mechanical: `${a.cardName} entering the battlefield triggers ${b.cardName}`,
        events: [],
      });
    }
  }

  // A puts a land onto the battlefield → B has landfall
  if (cardCausesLandETB(a, aOracle) && cardTriggersOnLandfall(b, bOracle)) {
    const dedupKey = `triggers:${a.cardName}:${b.cardName}:zone_transition:zone_transition:land`;
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      results.push({
        cards: [a.cardName, b.cardName],
        type: "triggers",
        strength: 0.8,
        mechanical: `${a.cardName} puts a land onto the battlefield, triggering ${b.cardName}'s landfall`,
        events: [],
      });
    }
  }

  // A is a creature with matching subtype → B triggers on that subtype attacking
  if (a.cardTypes.includes("creature") && cardTriggersOnSubtypeAttack(b, bOracle, a.subtypes)) {
    const dedupKey = `triggers:${a.cardName}:${b.cardName}:player_action:player_action:attack`;
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      results.push({
        cards: [a.cardName, b.cardName],
        type: "triggers",
        strength: 0.8,
        mechanical: `${a.cardName} attacking triggers ${b.cardName}`,
        events: [],
      });
    }
  }

  // A is a permanent → B triggers on permanent ETB ("whenever another permanent enters")
  if (isPermanentCard(a.cardTypes) && cardTriggersOnPermanentETB(b, bOracle)) {
    const dedupKey = `triggers:${a.cardName}:${b.cardName}:zone_transition:zone_transition:permanent_etb`;
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      results.push({
        cards: [a.cardName, b.cardName],
        type: "triggers",
        strength: 0.8,
        mechanical: `${a.cardName} entering triggers ${b.cardName}'s permanent ETB ability`,
        events: [],
      });
    }
  }

  // A has equipment death trigger + B creates tokens (Skullclamp + token makers)
  if (cardHasEquipmentDeathTrigger(a, aOracle) && cardCreatesTokens(b)) {
    const dedupKey = `triggers:${a.cardName}:${b.cardName}:equipment_death:token_creation`;
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      results.push({
        cards: [a.cardName, b.cardName],
        type: "triggers",
        strength: 0.8,
        mechanical: `${b.cardName} creates tokens that ${a.cardName} can equip and trigger on death`,
        events: [],
      });
    }
  }

  // A has draw replacement for opponents + B triggers on opponent draws (Notion Thief + Consecrated Sphinx)
  if (cardReplacesOpponentDraws(a, aOracle) && cardTriggersOnOpponentDraws(b, bOracle)) {
    const dedupKey = `triggers:${a.cardName}:${b.cardName}:draw_replacement:draw_trigger`;
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      results.push({
        cards: [a.cardName, b.cardName],
        type: "triggers",
        strength: 0.8,
        mechanical: `${a.cardName} redirects opponent draws while ${b.cardName} triggers on them, creating synergy`,
        events: [],
      });
    }
  }

  // Both A and B grant extra combat phases → synergy
  if (cardGrantsExtraCombat(a, aOracle) && cardGrantsExtraCombat(b, bOracle)) {
    const dedupKey = `triggers:${a.cardName}:${b.cardName}:extra_combat:extra_combat`;
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      results.push({
        cards: [a.cardName, b.cardName],
        type: "triggers",
        strength: 0.7,
        mechanical: `${a.cardName} and ${b.cardName} both create extra combat phases, amplifying attack triggers`,
        events: [],
      });
    }
  }

  // A copies/imprints instants + B is an instant that untaps (Isochron Scepter + Dramatic Reversal)
  if (cardCopiesImprinted(a, aOracle) && b.cardTypes.includes("instant")) {
    const dedupKey = `triggers:${a.cardName}:${b.cardName}:imprint:instant`;
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      results.push({
        cards: [a.cardName, b.cardName],
        type: "enables",
        strength: 0.8,
        mechanical: `${a.cardName} can copy ${b.cardName} (imprinted instant)`,
        events: [],
      });
    }
  }

  // B untaps nonland permanents + A is an artifact with activated abilities
  if (cardUntapsNonlands(b, bOracle) && a.cardTypes.includes("artifact") && cardHasActivatedAbilities(a)) {
    const dedupKey = `triggers:${b.cardName}:${a.cardName}:untap:artifact`;
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      results.push({
        cards: [b.cardName, a.cardName],
        type: "triggers",
        strength: 0.8,
        mechanical: `${b.cardName} untaps ${a.cardName}, enabling repeated activation`,
        events: [],
      });
    }
  }

  // A grants undying/persist to creatures → enables B (creature)
  if (b.cardTypes.includes("creature") && cardGrantsUndyingOrPersist(a, aOracle, b)) {
    const dedupKey = `enables:${a.cardName}:${b.cardName}:keyword_grant`;
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      results.push({
        cards: [a.cardName, b.cardName],
        type: "enables",
        strength: 0.8,
        mechanical: `${a.cardName} grants undying/persist to ${b.cardName}, enabling recursion`,
        events: [],
      });
    }
  }

  // A prevents -1/-1 counters + B has persist (Vizier of Remedies + Kitchen Finks)
  if (cardPreventsMinusCounters(a, aOracle) && cardHasPersist(b, bOracle)) {
    const dedupKey = `enables:${a.cardName}:${b.cardName}:counter_prevention:persist`;
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      results.push({
        cards: [a.cardName, b.cardName],
        type: "enables",
        strength: 0.9,
        mechanical: `${a.cardName} prevents persist counters on ${b.cardName}, enabling infinite recurrence`,
        events: [],
      });
    }
  }

  return results;
}

// ─── Trigger helper predicates ───

function cardCausesLifeGain(card: CardProfile, oracle: string): boolean {
  if (card.produces.some((p) => p.category === "life")) return true;
  for (const event of card.causesEvents) {
    if (event.kind === "player_action" && event.action === "gain_life") return true;
  }
  // Lifelink causes life gain, keywords that produce life
  if (card.abilities.some((a) => a.abilityType === "keyword" && a.keyword.toLowerCase() === "lifelink")) return true;
  if (/(?:you )?gain\s+(?:\d+|X)\s+life/i.test(oracle)) return true;
  if (/lifelink/i.test(oracle)) return true;
  return false;
}

function cardTriggersOnLifeGain(card: CardProfile, oracle: string): boolean {
  for (const trigger of card.triggersOn) {
    if (trigger.kind === "player_action" && trigger.action === "gain_life") return true;
  }
  if (/whenever you gain life/i.test(oracle)) return true;
  return false;
}

function cardIsSpellType(card: CardProfile, types: string[]): boolean {
  return card.cardTypes.some((t) => types.includes(t));
}

function cardTriggersOnSpellCast(card: CardProfile, oracle: string, spellTypes: string[]): boolean {
  for (const trigger of card.triggersOn) {
    if (trigger.kind === "player_action" && trigger.action === "cast_spell") {
      // Check if trigger specifies spell types
      if (trigger.object) {
        if (trigger.object.types.length === 0) return true; // "whenever you cast a spell"
        if (trigger.object.types.some((t) => spellTypes.includes(t))) return true;
      }
      return true;
    }
  }
  // Oracle text fallback
  const typePattern = spellTypes.join("|");
  const regex = new RegExp(`whenever (?:you|a player) cast[s]? (?:an? )?(?:${typePattern})`, "i");
  if (regex.test(oracle)) return true;
  // Also match "whenever you cast an instant or sorcery spell"
  if (/whenever (?:you|a player) casts? an? (?:instant or sorcery|noncreature) spell/i.test(oracle)) return true;
  return false;
}

function cardCausesDraw(card: CardProfile, oracle: string): boolean {
  if (card.produces.some((p) => p.category === "cards")) return true;
  for (const event of card.causesEvents) {
    if (event.kind === "player_action" && event.action === "draw") return true;
  }
  if (/draw (?:a|one|\d+) cards?/i.test(oracle)) return true;
  return false;
}

function cardTriggersOnDraw(card: CardProfile, oracle: string): boolean {
  for (const trigger of card.triggersOn) {
    if (trigger.kind === "player_action" && trigger.action === "draw") return true;
  }
  if (/whenever you draw a card/i.test(oracle)) return true;
  return false;
}

function cardTriggersOnEnchantmentETB(card: CardProfile, oracle: string): boolean {
  for (const trigger of card.triggersOn) {
    if (trigger.kind === "zone_transition" && trigger.to === "battlefield") {
      if (trigger.object?.types.includes("enchantment")) return true;
    }
  }
  if (/whenever (?:an(?:other)? )?enchantment enters the battlefield/i.test(oracle)) return true;
  if (/constellation/i.test(oracle)) return true;
  return false;
}

function cardCausesLandETB(card: CardProfile, oracle: string): boolean {
  // Check for zone transitions that put lands onto battlefield
  for (const event of card.causesEvents) {
    if (event.kind === "zone_transition" && event.to === "battlefield") {
      if (event.object?.types.includes("land")) return true;
    }
  }
  // Oracle fallback: "search your library for a land card, put it onto the battlefield"
  if (/(?:search|put)\s+(?:a |one |up to \S+ )?(?:\S+ )?land\s+(?:card\s+)?(?:onto|into|on) the battlefield/i.test(oracle)) return true;
  // Fetchlands: "Search your library for an [type] or [type] card, put it onto the battlefield"
  if (/search your library for (?:a|an)\s+.+card,?\s+put it onto the battlefield/i.test(oracle)) return true;
  return false;
}

function cardTriggersOnLandfall(card: CardProfile, oracle: string): boolean {
  for (const trigger of card.triggersOn) {
    if (trigger.kind === "zone_transition" && trigger.to === "battlefield") {
      if (trigger.object?.types.includes("land")) return true;
    }
  }
  if (/landfall/i.test(oracle)) return true;
  if (/whenever a land enters the battlefield under your control/i.test(oracle)) return true;
  return false;
}

function cardTriggersOnSubtypeAttack(card: CardProfile, oracle: string, attackerSubtypes: Subtype[]): boolean {
  if (!attackerSubtypes || attackerSubtypes.length === 0) return false;
  // Check for oracle text pattern "whenever a [subtype] attacks"
  for (const subtype of attackerSubtypes) {
    const regex = new RegExp(`whenever (?:a |an )?${subtype} (?:you control )?attacks`, "i");
    if (regex.test(oracle)) return true;
  }
  return false;
}

function cardTriggersOnCreatureETB(_card: CardProfile, oracle: string): boolean {
  return /whenever (?:a(?:nother)? )?creature enters the battlefield/i.test(oracle);
}

function cardTriggersOnPermanentETB(_card: CardProfile, oracle: string): boolean {
  return /whenever another permanent enters the battlefield/i.test(oracle);
}

function cardHasEquipmentDeathTrigger(card: CardProfile, oracle: string): boolean {
  if (card.cardTypes.includes("artifact") && /whenever equipped creature dies/i.test(oracle)) return true;
  return false;
}

function cardReplacesOpponentDraws(_card: CardProfile, oracle: string): boolean {
  return /if an opponent would draw/i.test(oracle);
}

function cardTriggersOnOpponentDraws(_card: CardProfile, oracle: string): boolean {
  return /whenever an opponent draws/i.test(oracle);
}

function cardGrantsExtraCombat(_card: CardProfile, oracle: string): boolean {
  return /additional combat (?:phase|step)/i.test(oracle) ||
    /untap (?:all|each) .+ (?:and|that) (?:attack|attacks)/i.test(oracle);
}

function cardCopiesImprinted(_card: CardProfile, oracle: string): boolean {
  return /copy the (?:exiled|imprinted) card/i.test(oracle) ||
    /you may copy the (?:exiled|imprinted)/i.test(oracle);
}

function cardUntapsNonlands(_card: CardProfile, oracle: string): boolean {
  return /untap all nonland permanents/i.test(oracle) ||
    /untap each nonland permanent/i.test(oracle);
}

function cardGrantsUndyingOrPersist(granter: CardProfile, oracle: string, target: CardProfile): boolean {
  // Match "have undying" anywhere in a sentence about "creatures you control"
  // e.g., "Other non-Human creatures you control get +1/+1 and have undying."
  const undyingMatch = oracle.match(/(?:other )?(.+?)creatures? you control .+?(?:have|gain) undying/i)
    || oracle.match(/(?:other )?(.+?)creatures? you control (?:have|get|gain) undying/i);
  if (undyingMatch) {
    const qualifier = (undyingMatch[1] || "").trim().toLowerCase();
    // "non-Human" check
    if (qualifier.includes("non-human")) {
      // Target must not be a Human
      const isHuman = target.subtypes?.some((s) => s.toLowerCase() === "human");
      return !isHuman;
    }
    return true; // No type restriction
  }
  // Check for persist grants too
  if (/(?:other )?creatures? you control .+?(?:have|gain) persist/i.test(oracle) ||
      /(?:other )?creatures? you control (?:have|get|gain) persist/i.test(oracle)) {
    return true;
  }
  return false;
}

function cardPreventsMinusCounters(_card: CardProfile, oracle: string): boolean {
  return /if one or more -1\/-1 counters would be (?:placed|put)/i.test(oracle) ||
    /that many -1\/-1 counters minus one/i.test(oracle) ||
    /enters? (?:the battlefield )?with one fewer -1\/-1 counter/i.test(oracle);
}

function cardHasPersist(card: CardProfile, oracle: string): boolean {
  if (card.abilities.some((a) => a.abilityType === "keyword" && (a as { keyword: string }).keyword.toLowerCase() === "persist")) return true;
  return /persist/i.test(oracle);
}

/**
 * Compute how strong a trigger match is based on specificity.
 */
function computeTriggerStrength(
  caused: GameEvent,
  trigger: GameEvent
): number {
  if (caused.kind === "zone_transition" && trigger.kind === "zone_transition") {
    const causedHasZones = !!(caused.from || caused.to);
    const triggerHasZones = !!(trigger.from || trigger.to);
    const causedHasTypes = caused.object.types.length > 0;
    const triggerHasTypes = trigger.object.types.length > 0;

    // Both specify from AND to zones -> strong match
    if (caused.from && caused.to && trigger.from && trigger.to) {
      // Check if object types match specifically
      if (
        causedHasTypes &&
        triggerHasTypes &&
        caused.object.types.some((ct) => trigger.object.types.includes(ct))
      ) {
        return 1.0; // Perfect: specific zones + specific types
      }
      return 0.8; // Strong: specific zones, wildcard types
    }

    // One side specifies zones -> good match
    if (causedHasZones && triggerHasZones) {
      return causedHasTypes || triggerHasTypes ? 0.8 : 0.7;
    }

    // At least one side has zones but the other doesn't
    if (causedHasZones || triggerHasZones) {
      return causedHasTypes || triggerHasTypes ? 0.5 : 0.4;
    }

    // Neither side has zones — vague-to-vague
    return causedHasTypes || triggerHasTypes ? 0.5 : 0.3;
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
    if (cardMatchesRef(b.cardTypes, grant.to, b.subtypes, b.supertypes)) {
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

        // Oracle text cross-check: if the structured parser gave a wildcard
        // grant target (empty types), verify against oracle text type constraints.
        // E.g., "Target creature you control gains protection" shouldn't match Sol Ring.
        if (grant.to.types.length === 0 && a.rawOracleText) {
          if (!oracleProtectionTargetMatches(a.rawOracleText, b)) {
            continue;
          }
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

  // Oracle text fallback: detect protection patterns the parser misses
  if (results.length === 0 && a.rawOracleText) {
    const oracleProtects = detectProtectsFromOraclePatterns(a, b);
    results.push(...oracleProtects);
  }

  return results;
}

/**
 * Oracle text cross-check for protection target types.
 * When the structured parser gives a wildcard grant target, verify that
 * the oracle text's type constraints match card B.
 */
function oracleProtectionTargetMatches(oracle: string, b: CardProfile): boolean {
  // Check for "target creature" pattern
  if (/target creature/i.test(oracle)) {
    return b.cardTypes.includes("creature");
  }
  // Check for "target permanent" or "permanents you control"
  if (/(?:target permanent|permanents? you control)/i.test(oracle)) {
    return isPermanentCard(b.cardTypes);
  }
  // No type constraint found in oracle — allow anything
  return true;
}

// ─── Oracle protection detection ───

/** Protection-granting oracle patterns */
const PROTECTION_GRANT_PATTERNS = [
  { pattern: /(?:permanents?|creatures?) you control gain hexproof and indestructible/i, keyword: "hexproof and indestructible", types: ["permanent"] as string[] },
  { pattern: /target creature (?:you control )?gains? protection from the color/i, keyword: "protection from a color", types: ["creature"] as string[] },
  { pattern: /target creature (?:you control )?gains? hexproof/i, keyword: "hexproof", types: ["creature"] as string[] },
  { pattern: /target creature (?:you control )?gains? indestructible/i, keyword: "indestructible", types: ["creature"] as string[] },
  { pattern: /target creature (?:you control )?gains? protection/i, keyword: "protection", types: ["creature"] as string[] },
  { pattern: /target permanent (?:you control )?gains? protection/i, keyword: "protection", types: ["permanent"] as string[] },
];

function detectProtectsFromOraclePatterns(a: CardProfile, b: CardProfile): Interaction[] {
  const results: Interaction[] = [];
  const oracle = a.rawOracleText!;

  for (const { pattern, keyword, types } of PROTECTION_GRANT_PATTERNS) {
    if (pattern.test(oracle)) {
      // Check if B's type matches what the protection grants to
      const matchesType = types.includes("permanent")
        ? isPermanentCard(b.cardTypes)
        : b.cardTypes.some((t) => types.includes(t));

      if (matchesType) {
        results.push({
          cards: [a.cardName, b.cardName],
          type: "protects",
          strength: 0.8,
          mechanical: `${a.cardName} grants ${keyword} to ${b.cardName}`,
          events: [],
        });
        return results; // One protection per pair
      }
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// DETECTOR: AMPLIFIES
// ═══════════════════════════════════════════════════════════════

/** Non-protective keywords that enhance a card's power */
const AMPLIFY_KEYWORDS = new Set([
  "flying", "haste", "lifelink", "deathtouch", "trample",
  "menace", "vigilance", "reach", "first", "double", "strike",
  "fear", "intimidate", "shadow", "prowess", "infect", "wither",
  "undying", "persist", "flanking", "bushido", "exalted",
  "annihilator", "cascade",
]);

/**
 * A amplifies B if A grants stat modifications or enhancement keywords
 * to objects that match B's types (e.g., "All Sliver creatures get +1/+1").
 */
function detectAmplifies(a: CardProfile, b: CardProfile): Interaction[] {
  const results: Interaction[] = [];

  for (const grant of a.grants) {
    let isAmplifying = false;
    let description = "";

    if (typeof grant.ability === "string") {
      isAmplifying = AMPLIFY_KEYWORDS.has(grant.ability.toLowerCase());
      description = `grants ${grant.ability}`;
    } else if (grant.ability.category === "stat_mod") {
      isAmplifying = true;
      const sm = grant.ability;
      const pSign = typeof sm.power === "number" && sm.power >= 0 ? "+" : "";
      const tSign = typeof sm.toughness === "number" && sm.toughness >= 0 ? "+" : "";
      description = `grants ${pSign}${sm.power}/${tSign}${sm.toughness}`;
    } else if (grant.ability.category === "keyword_grant") {
      const kw = grant.ability.keyword.toLowerCase();
      // Skip protection keywords — those are handled by detectProtects
      if (PROTECTION_KEYWORDS.has(kw) || kw.startsWith("protection")) continue;
      isAmplifying = AMPLIFY_KEYWORDS.has(kw);
      if (!isAmplifying) {
        // Accept any non-protective keyword as amplifying
        isAmplifying = true;
      }
      description = `grants ${grant.ability.keyword}`;
    }

    if (!isAmplifying) continue;

    // Check if B's types match the grant target
    if (cardMatchesRef(b.cardTypes, grant.to, b.subtypes, b.supertypes)) {
      const controllerOk =
        !grant.to.controller ||
        grant.to.controller === "you" ||
        grant.to.controller === "any" ||
        grant.to.controller === "each";

      if (controllerOk) {
        // Don't let a card "amplify" itself if grant says "other"
        if (grant.to.modifiers?.includes("other") && a.cardName === b.cardName) {
          continue;
        }

        // Strength: subtype-specific grants are stronger than generic ones
        const hasSubtypeMatch = grant.to.subtypes && grant.to.subtypes.length > 0;
        const strength = hasSubtypeMatch ? 0.8 : 0.7;

        results.push({
          cards: [a.cardName, b.cardName],
          type: "amplifies",
          strength,
          mechanical: `${a.cardName} ${description} to ${b.cardName}`,
          events: [],
        });
      }
    }
  }

  // Oracle text fallback: detect replacement-based amplification patterns
  if (a.rawOracleText) {
    const oracleAmplify = detectAmplifyFromOraclePatterns(a, b);
    for (const oa of oracleAmplify) {
      const alreadyFound = results.some(
        (r) => r.type === "amplifies" && r.cards[0] === oa.cards[0] && r.cards[1] === oa.cards[1]
      );
      if (!alreadyFound) {
        results.push(oa);
      }
    }
  }

  return results;
}

// ─── Oracle text amplification patterns ───

/** Token-doubling: Doubling Season, Parallel Lives, Anointed Procession */
const TOKEN_DOUBLING_PATTERNS = [
  /if (?:an )?effect would (?:create|put) one or more tokens/i,
  /twice that many (?:of those )?tokens/i,
  /creates? (?:one or more )?tokens?,? (?:it )?creates? twice that many/i,
];

/** Counter-doubling: Doubling Season, Hardened Scales, Branching Evolution */
const COUNTER_DOUBLING_PATTERNS = [
  /if (?:an )?effect would (?:place|put) one or more .+ counters/i,
  /twice that many .+ counters/i,
  /additional \+1\/\+1 counter/i,
];

/** ETB trigger doubling: Panharmonicon, Yarok */
const ETB_DOUBLING_PATTERNS = [
  /(?:artifact|creature|permanent)s? entering the battlefield (?:under your control )?(?:causes|triggers) a triggered ability.+(?:additional|extra) time/i,
  /triggered ability.+triggers (?:an )?additional time/i,
  /if (?:an? )?(?:artifact|creature|permanent) entering the battlefield causes a triggered ability/i,
];

/** Damage amplification: Torbran, Fiery Emancipation, Furnace of Rath */
const DAMAGE_AMPLIFY_PATTERNS = [
  /(?:a red source|~) (?:you control )?would deal damage.+(?:plus \d+|that much damage plus|deals? (?:that much damage )?plus)/i,
  /deals? that much damage plus \d+ (?:instead|to)/i,
  /if a (?:source|red source) you control would deal damage.+deals? that much (?:damage )?plus/i,
  /damage.+(?:doubled|tripled|triple that damage)/i,
];

function detectAmplifyFromOraclePatterns(a: CardProfile, b: CardProfile): Interaction[] {
  const results: Interaction[] = [];
  const oracle = a.rawOracleText!;

  // Token-doubling amplifies token creators
  const isTokenDoubler = TOKEN_DOUBLING_PATTERNS.some((p) => p.test(oracle));
  if (isTokenDoubler && cardCreatesTokens(b)) {
    results.push({
      cards: [a.cardName, b.cardName],
      type: "amplifies",
      strength: 0.9,
      mechanical: `${a.cardName} doubles token creation from ${b.cardName}`,
      events: [],
    });
  }

  // Counter-doubling amplifies counter placers
  const isCounterDoubler = COUNTER_DOUBLING_PATTERNS.some((p) => p.test(oracle));
  if (isCounterDoubler && cardPlacesCounters(b)) {
    results.push({
      cards: [a.cardName, b.cardName],
      type: "amplifies",
      strength: 0.9,
      mechanical: `${a.cardName} doubles counter placement from ${b.cardName}`,
      events: [],
    });
  }

  // ETB trigger doubling amplifies ETB trigger creatures/artifacts
  const isETBDoubler = ETB_DOUBLING_PATTERNS.some((p) => p.test(oracle));
  if (isETBDoubler && cardHasETBTriggers(b) &&
      (b.cardTypes.includes("creature") || b.cardTypes.includes("artifact"))) {
    results.push({
      cards: [a.cardName, b.cardName],
      type: "amplifies",
      strength: 0.9,
      mechanical: `${a.cardName} doubles ETB triggers from ${b.cardName}`,
      events: [],
    });
  }

  // Damage amplification amplifies damage dealers (checking color for Torbran)
  const isDamageAmplifier = DAMAGE_AMPLIFY_PATTERNS.some((p) => p.test(oracle));
  if (isDamageAmplifier && cardDealsDamage(b)) {
    // Torbran specifically says "a red source" — check if B is red
    const isRedSpecific = /a red source/i.test(oracle);
    if (!isRedSpecific || cardIsRed(b)) {
      results.push({
        cards: [a.cardName, b.cardName],
        type: "amplifies",
        strength: 0.8,
        mechanical: `${a.cardName} amplifies damage from ${b.cardName}`,
        events: [],
      });
    }
  }

  return results;
}

/**
 * Check if card creates tokens.
 */
function cardCreatesTokens(card: CardProfile): boolean {
  if (card.produces.some((p) => p.category === "create_token")) return true;
  for (const event of card.causesEvents) {
    if (event.kind === "player_action" && event.action === "create_token") return true;
  }
  if (card.rawOracleText && /creates?\s+(?:\d+|[Xx]|a|an|that many)\s+\S*\s*tokens?/i.test(card.rawOracleText)) return true;
  return false;
}

/**
 * Check if card places counters.
 */
function cardPlacesCounters(card: CardProfile): boolean {
  if (card.produces.some((p) => p.category === "counter")) return true;
  for (const event of card.causesEvents) {
    if (event.kind === "state_change" && event.property === "counters") return true;
  }
  if (card.rawOracleText && /put\s+(?:\d+|[Xx]|a|an)\s+\+1\/\+1\s+counter/i.test(card.rawOracleText)) return true;
  return false;
}

/**
 * Check if card deals damage.
 */
function cardDealsDamage(card: CardProfile): boolean {
  for (const event of card.causesEvents) {
    if (event.kind === "damage") return true;
  }
  if (card.rawOracleText && /deals?\s+\d+\s+damage/i.test(card.rawOracleText)) return true;
  // Creatures deal combat damage
  if (card.cardTypes.includes("creature")) return true;
  return false;
}

/**
 * Check if card is red (has red in mana cost or color identity).
 */
function cardIsRed(card: CardProfile): boolean {
  if (card.castingCost?.manaCost && /\{R\}/i.test(card.castingCost.manaCost)) return true;
  if (card.rawOracleText && /\{R\}/i.test(card.rawOracleText)) return true;
  return false;
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

  // Pre-check: if A's oracle text has explicit type filters for recursion,
  // enforce them even when the structured parser missed the filter.
  // This prevents false positives like Meren (creature-only) recurring Lightning Bolt.
  if (a.rawOracleText && !oracleRecursionTypeMatches(a.rawOracleText, b)) {
    return results;
  }

  // Pre-check: if A's oracle text has explicit MV filters for recursion,
  // enforce them even when the structured parser missed the filter.
  if (a.rawOracleText && !oracleRecursionMVMatches(a.rawOracleText, b)) {
    return results;
  }

  // 1. Check A's causesEvents for ZoneTransition{from: graveyard, to: battlefield|hand}
  for (const event of a.causesEvents) {
    if (event.kind !== "zone_transition") continue;
    if (
      event.from === "graveyard" &&
      (event.to === "battlefield" || event.to === "hand")
    ) {
      // Check if B's types match the object reference
      if (objectTypesMatch(event.object, { types: b.cardTypes, subtypes: b.subtypes, quantity: "one", modifiers: [] })) {
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

  // 4. Oracle text fallback: detect recursion with type/MV filters
  if (results.length === 0 && a.rawOracleText) {
    const oracleMvRecurs = detectRecursFromOraclePatterns(a, b);
    if (oracleMvRecurs) {
      results.push(oracleMvRecurs);
    }
  }

  return results;
}

/**
 * Check if A's oracle text has a type filter for recursion and B matches it.
 * Returns true if B is a valid recursion target, false if filtered out.
 */
function oracleRecursionTypeMatches(oracle: string, b: CardProfile): boolean {
  // Look for graveyard return patterns that mention a specific type.
  // Patterns can be:
  //   "return target creature card from your graveyard" (return...type...graveyard)
  //   "target creature card in your graveyard...return it" (type...graveyard...return)
  const typePatterns = [
    { pattern: /creature card (?:from|in) (?:your |a )?graveyard/i, type: "creature" as CardType },
    { pattern: /(?:return|put).*?creature card/i, type: "creature" as CardType },
    { pattern: /artifact card (?:from|in) (?:your |a )?graveyard/i, type: "artifact" as CardType },
    { pattern: /(?:return|put).*?artifact card/i, type: "artifact" as CardType },
    { pattern: /enchantment card (?:from|in) (?:your |a )?graveyard/i, type: "enchantment" as CardType },
    { pattern: /(?:return|put).*?enchantment card/i, type: "enchantment" as CardType },
    { pattern: /instant (?:or sorcery )?card (?:from|in) (?:your |a )?graveyard/i, type: "instant" as CardType },
    { pattern: /(?:return|put).*?instant (?:or sorcery )?card/i, type: "instant" as CardType },
    { pattern: /permanent card (?:from|in) (?:your |a )?graveyard/i, type: "permanent" as unknown as CardType },
    { pattern: /(?:return|put).*?permanent card/i, type: "permanent" as unknown as CardType },
    { pattern: /permanent spell with mana value/i, type: "permanent" as unknown as CardType },
  ];

  // Only check patterns that are in a graveyard recursion context
  const hasGraveyardContext = /graveyard/i.test(oracle);
  if (!hasGraveyardContext) return true; // Not a recursion card, no filter applies

  let hasTypeFilter = false;
  const matchedTypes = new Set<string>();
  for (const { pattern, type } of typePatterns) {
    if (pattern.test(oracle)) {
      hasTypeFilter = true;
      matchedTypes.add(type);
    }
  }

  if (!hasTypeFilter) return true; // No type filter found

  // Check if B matches any of the matched types
  for (const type of matchedTypes) {
    if (type === ("permanent" as unknown as CardType)) {
      if (isPermanentCard(b.cardTypes)) return true;
    } else if (b.cardTypes.includes(type as CardType)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if A's oracle text has a mana value filter for recursion and B fits it.
 * Returns true if B is within the MV limit, false if filtered out.
 */
function oracleRecursionMVMatches(oracle: string, b: CardProfile): boolean {
  const mvMatch = oracle.match(
    /(?:return|put|cast).*?(?:mana value|converted mana cost)\s+(\d+)\s+or\s+less.*?(?:from|in)\s+(?:your |a )?graveyard/i
  );
  if (!mvMatch) return true; // No MV filter found
  const maxMV = parseInt(mvMatch[1], 10);
  if (!b.castingCost) return true; // No cost info, can't filter
  return b.castingCost.manaValue <= maxMV;
}

/**
 * Oracle text fallback for recursion. Handles:
 * - MV-filtered recursion: "mana value 3 or less" (Sun Titan), "mana value 2 or less" (Lurrus)
 * - Type-filtered recursion: "creature card" (Meren), "permanent card" (Lurrus)
 */
function detectRecursFromOraclePatterns(a: CardProfile, b: CardProfile): Interaction | null {
  const oracle = a.rawOracleText!;

  // Patterns for returning from graveyard
  const recursionPatterns = [
    /(?:return|put)\s+(?:target\s+)?(.+?)\s+(?:card\s+)?(?:from (?:your |a )?graveyard|in (?:your |a )?graveyard)\s+(?:to|onto|into)\s+(?:the\s+)?(?:battlefield|your hand)/i,
    /(?:return|put)\s+(?:target\s+)?(.+?)\s+(?:card\s+)?(?:with|that has)\s+(?:mana value|converted mana cost)\s+(\d+)\s+or less.*?(?:from (?:your |a )?graveyard)/i,
    /(?:you may )?cast\s+(?:target\s+)?(.+?)\s+(?:card\s+|spell\s+)?(?:from (?:your |a )?graveyard|in (?:your |a )?graveyard)/i,
  ];

  // Check each recursion pattern
  for (const pattern of recursionPatterns) {
    const match = oracle.match(pattern);
    if (!match) continue;

    const targetDesc = match[1]?.toLowerCase() || "";

    // Check type filter: "creature card", "permanent card", "artifact card", etc.
    if (targetDesc.includes("creature") && !b.cardTypes.includes("creature")) return null;
    if (targetDesc.includes("artifact") && !b.cardTypes.includes("artifact")) return null;
    if (targetDesc.includes("enchantment") && !b.cardTypes.includes("enchantment")) return null;
    if (targetDesc.includes("instant") && !b.cardTypes.includes("instant")) return null;
    if (targetDesc.includes("sorcery") && !b.cardTypes.includes("sorcery")) return null;
    if (targetDesc.includes("permanent") && !isPermanentCard(b.cardTypes)) return null;

    // Check MV filter from oracle text
    const mvMatch = oracle.match(/(?:mana value|converted mana cost)\s+(\d+)\s+or\s+less/i);
    if (mvMatch && b.castingCost) {
      const maxMV = parseInt(mvMatch[1], 10);
      if (b.castingCost.manaValue > maxMV) return null;
    }

    return {
      cards: [a.cardName, b.cardName],
      type: "recurs",
      strength: 0.7,
      mechanical: `${a.cardName} can return ${b.cardName} from the graveyard`,
      events: [],
    };
  }

  return null;
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
      // Skip exile effects — they remove from graveyard, not recur
      if (effect.type === "exile" || effect.type === "exile_from_graveyard") continue;
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
function detectTutorsFor(_a: CardProfile, _b: CardProfile): Interaction[] {
  // Tutoring is handled as a capability note, not individual pairwise interactions.
  // A card's search capability is visible in its CardProfile.
  return [];
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
        cardMatchesRef(b.cardTypes, affectedObjects, b.subtypes, b.supertypes)
      ) {
        // Oracle text cross-check: verify subtype/type constraints from oracle
        // when the structured parser gave a wildcard target
        if (a.rawOracleText && (!affectedObjects || affectedObjects.types.length === 0)) {
          if (!oracleCostReductionTargetMatches(a.rawOracleText, b)) {
            continue;
          }
        }
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

  // 3. Oracle text fallback: detect cost reduction patterns
  if (a.rawOracleText && b.castingCost && b.castingCost.manaValue > 0) {
    const oracleReduction = detectReducesCostFromOracle(a, b);
    if (oracleReduction) {
      results.push(oracleReduction);
      return results;
    }
  }

  return results;
}

/**
 * Oracle text fallback for cost reduction detection.
 */
/**
 * Oracle text cross-check for cost reduction targets.
 * When the structured parser gives a wildcard target, verify that
 * the oracle text's subtype/type constraints match card B.
 */
function oracleCostReductionTargetMatches(oracle: string, b: CardProfile): boolean {
  // Check for tribal pattern: "[Subtype] spells you cast cost less"
  const tribalMatch = oracle.match(/(\w+) spells (?:you cast )?cost \{\d+\} less/i);
  if (tribalMatch) {
    const tribeName = tribalMatch[1].toLowerCase();
    // "Spells" is universal, "Creature spells" is type-filtered
    if (tribeName === "spells") return !b.cardTypes.includes("land");
    if (tribeName === "creature") return b.cardTypes.includes("creature");
    // Tribal name (Goblin, Elf, etc.) — check subtypes
    const bSubtypesLower = (b.subtypes || []).map((s) => s.toLowerCase());
    return bSubtypesLower.includes(tribeName);
  }
  // No specific constraint found
  return true;
}

function detectReducesCostFromOracle(a: CardProfile, b: CardProfile): Interaction | null {
  const oracle = a.rawOracleText!;

  // Tribal cost reduction: "[Subtype] spells you cast cost {1} less"
  // Check BEFORE universal pattern to prevent "Goblin spells" matching as universal
  const tribalMatch = oracle.match(/(\w+) spells (?:you cast )?cost \{(\d+)\} less/i);
  if (tribalMatch) {
    const tribeName = tribalMatch[1].toLowerCase();
    if (tribeName === "creature") {
      // Creature-type cost reduction
      if (b.cardTypes.includes("creature")) {
        return {
          cards: [a.cardName, b.cardName],
          type: "reduces_cost",
          strength: 0.7,
          mechanical: `${a.cardName} reduces creature spell costs, including ${b.cardName}`,
          events: [],
        };
      }
      return null; // Creature-only reduction, B is not a creature
    }
    if (tribeName !== "spells") {
      // Specific tribe reduction (Goblin, Elf, Wizard, etc.)
      const bSubtypesLower = (b.subtypes || []).map((s) => s.toLowerCase());
      if (bSubtypesLower.includes(tribeName)) {
        return {
          cards: [a.cardName, b.cardName],
          type: "reduces_cost",
          strength: 0.8,
          mechanical: `${a.cardName} reduces ${tribalMatch[1]} spell costs, including ${b.cardName}`,
          events: [],
        };
      }
      return null; // Tribal reduction, B is not the right tribe
    }
  }

  // Universal cost reduction: "Spells cost {1} less to cast" / "Spells you cast cost {1} less"
  // Only matches when "Spells" starts the sentence (not preceded by a type qualifier)
  if (/(?:^|\. |\n)spells (?:you cast )?cost \{\d+\} less to cast/im.test(oracle)) {
    // B must be a spell (not a land)
    if (!b.cardTypes.includes("land")) {
      return {
        cards: [a.cardName, b.cardName],
        type: "reduces_cost",
        strength: 0.6,
        mechanical: `${a.cardName} reduces the cost of ${b.cardName}`,
        events: [],
      };
    }
  }

  // "Creature spells of the chosen type cost {N} less" (Urza's Incubator)
  if (/creature spells of the chosen type cost \{\d+\} less/i.test(oracle)) {
    if (b.cardTypes.includes("creature")) {
      return {
        cards: [a.cardName, b.cardName],
        type: "reduces_cost",
        strength: 0.6,
        mechanical: `${a.cardName} can reduce the cost of ${b.cardName} (if matching chosen type)`,
        events: [],
      };
    }
  }

  return null;
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
      if (cardMatchesRef(b.cardTypes, sub.appliesTo, b.subtypes, b.supertypes)) {
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
        if (cardMatchesRef(b.cardTypes, sub.appliesTo, b.subtypes, b.supertypes)) {
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
  // Always run oracle fallback — structured detection may miss patterns like
  // Torpor Orb, Cursed Totem, Null Rod that the parser doesn't extract
  const oracleBlocks = detectBlocksFromOraclePatterns(a, b);
  for (const ob of oracleBlocks) {
    // Only add if we don't already have a blocks interaction for this pair
    const alreadyFound = results.some(
      (r) => r.type === "blocks" && r.cards[0] === ob.cards[0] && r.cards[1] === ob.cards[1]
    );
    if (!alreadyFound) {
      results.push(ob);
    }
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
      if (perm.fromZone !== "hand") {
        return {
          cards: [a.cardName, b.cardName],
          type: "blocks",
          strength: 0.8,
          mechanical: `${a.cardName} prevents casting from ${perm.fromZone}, blocking ${b.cardName}`,
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

/** ETB trigger suppression: Torpor Orb, Hushbringer, Hushwing Gryff */
const ETB_SUPPRESSION_PATTERNS = [
  /creatures entering the battlefield don't cause (?:triggered )?abilities (?:of|to) trigger/i,
  /creatures entering the battlefield don't cause abilities to trigger/i,
  /entering the battlefield don't cause (?:triggered )?abilities to trigger/i,
  /permanents entering the battlefield don't cause abilities to trigger/i,
];

/** Creature activated ability restrictions: Cursed Totem, Linvala */
const CREATURE_ABILITY_HATE_PATTERNS = [
  /activated abilities of creatures can't be activated/i,
  /creatures can't activate abilities/i,
];

/** Artifact activated ability restrictions: Null Rod, Stony Silence */
const ARTIFACT_ABILITY_HATE_PATTERNS = [
  /activated abilities of artifacts can't be activated/i,
  /artifacts can't activate abilities/i,
];

/** Type-changing effects: Blood Moon */
const TYPE_CHANGE_HATE_PATTERNS = [
  /nonbasic lands are ([A-Za-z]+)/i,
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

  // Check ETB trigger suppression (Torpor Orb, Hushbringer)
  const isETBSuppression = ETB_SUPPRESSION_PATTERNS.some((p) => p.test(oracle));
  if (isETBSuppression) {
    if (cardHasETBTriggers(b)) {
      return {
        cards: [a.cardName, b.cardName],
        type: "blocks",
        strength: 0.9,
        mechanical: `${a.cardName} suppresses ETB triggers, blocking ${b.cardName}'s enter-the-battlefield abilities`,
        events: [],
      };
    }
  }

  // Check creature activated ability restrictions (Cursed Totem, Linvala)
  const isCreatureAbilityHate = CREATURE_ABILITY_HATE_PATTERNS.some((p) => p.test(oracle));
  if (isCreatureAbilityHate) {
    if (b.cardTypes.includes("creature") && cardHasActivatedAbilities(b)) {
      return {
        cards: [a.cardName, b.cardName],
        type: "blocks",
        strength: 0.9,
        mechanical: `${a.cardName} prevents creature activated abilities, blocking ${b.cardName}'s abilities`,
        events: [],
      };
    }
  }

  // Check artifact activated ability restrictions (Null Rod, Stony Silence)
  const isArtifactAbilityHate = ARTIFACT_ABILITY_HATE_PATTERNS.some((p) => p.test(oracle));
  if (isArtifactAbilityHate) {
    if (b.cardTypes.includes("artifact") && cardHasActivatedAbilities(b)) {
      return {
        cards: [a.cardName, b.cardName],
        type: "blocks",
        strength: 0.9,
        mechanical: `${a.cardName} prevents artifact activated abilities, blocking ${b.cardName}'s abilities`,
        events: [],
      };
    }
  }

  // Check type-changing effects (Blood Moon)
  const isTypeChange = TYPE_CHANGE_HATE_PATTERNS.some((p) => p.test(oracle));
  if (isTypeChange) {
    // Blood Moon blocks nonbasic lands with special abilities
    if (b.cardTypes.includes("land") && !b.supertypes.includes("basic") && cardHasActivatedAbilities(b)) {
      return {
        cards: [a.cardName, b.cardName],
        type: "blocks",
        strength: 0.8,
        mechanical: `${a.cardName} removes abilities from nonbasic lands, blocking ${b.cardName}`,
        events: [],
      };
    }
  }

  return null;
}

/**
 * Check if a card has ETB triggered abilities (enters-the-battlefield triggers).
 */
function cardHasETBTriggers(card: CardProfile): boolean {
  // Check triggersOn for ETB events
  for (const trigger of card.triggersOn) {
    if (trigger.kind === "zone_transition" && trigger.to === "battlefield") {
      return true;
    }
  }
  // Check abilities for triggered abilities with ETB patterns
  for (const ability of card.abilities) {
    if (ability.abilityType === "triggered" && ability.trigger) {
      if (ability.trigger.kind === "zone_transition" && ability.trigger.to === "battlefield") {
        return true;
      }
    }
  }
  // Oracle text fallback: check for ETB trigger patterns
  if (card.rawOracleText) {
    if (/when(ever)?\s+.+enters\s+(the\s+)?battlefield/i.test(card.rawOracleText)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a card has activated abilities (cost : effect pattern).
 */
function cardHasActivatedAbilities(card: CardProfile): boolean {
  for (const ability of card.abilities) {
    if (ability.abilityType === "activated") {
      return true;
    }
  }
  // Oracle text fallback: colon-separated cost and effect
  if (card.rawOracleText) {
    // Match "cost: effect" pattern (mana/tap/sacrifice before colon)
    if (/\{[^}]+\}[^:]*:|^[Tt]ap:/.test(card.rawOracleText)) {
      return true;
    }
  }
  return false;
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
        if (perm.fromZone !== "hand") {
          return `can't cast from ${perm.fromZone}`;
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
        // Card draw is modeled as producing CardsResource (category: "cards")
        if (card.produces.some((p) => p.category === "cards")) {
          return "can't draw more than one card each turn";
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
  // Pre-index: interactions by card name (excluding blocks/conflicts)
  const interactionsByCard = new Map<string, Interaction[]>();
  // Pre-index: blocks interactions by blocker name
  const blocksByBlocker = new Map<string, Interaction[]>();

  for (const inter of interactions) {
    if (inter.type === "blocks") {
      const arr = blocksByBlocker.get(inter.cards[0]);
      if (arr) arr.push(inter);
      else blocksByBlocker.set(inter.cards[0], [inter]);
      continue;
    }
    if (inter.type === "conflicts") continue;
    for (const card of inter.cards) {
      const arr = interactionsByCard.get(card);
      if (arr) arr.push(inter);
      else interactionsByCard.set(card, [inter]);
    }
  }

  const pMap = profilesByName(profiles);
  const blockerMap = new Map<string, InteractionBlocker>();

  for (const block of interactions) {
    if (block.type !== "blocks") continue;

    const blockerName = block.cards[0];
    const blockedName = block.cards[1];

    if (!blockerMap.has(blockerName)) {
      const blockerProfile = pMap.get(blockerName);
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

    for (const event of block.events) {
      entry.blockedEvents.push(event);
    }

    // Use pre-indexed lookup instead of filtering all interactions
    const candidates = interactionsByCard.get(blockedName) || [];
    for (const candidate of candidates) {
      if (
        interactionDisruptedByBlocker(candidate, block.events) &&
        !entry.blockedInteractions.some((bi) =>
          bi.cards[0] === candidate.cards[0] &&
          bi.cards[1] === candidate.cards[1] &&
          bi.type === candidate.type
        )
      ) {
        entry.blockedInteractions.push(candidate);
      }
    }
  }

  // Update descriptions using pre-indexed blocks
  for (const [blockerName, entry] of blockerMap) {
    const blocksForThis = blocksByBlocker.get(blockerName) || [];
    const uniqueBlocked = [...new Set(blocksForThis.map((i) => i.cards[1]))];
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
const MAX_CHAINS = 30;
const MIN_CHAIN_EDGE_STRENGTH = 0.6;
const MIN_CHAIN_AVG_STRENGTH = 0.65;

function detectChains(
  interactions: Interaction[],
  profiles: CardProfile[]
): InteractionChain[] {
  if (profiles.length < 3) return [];

  // Build adjacency list from causal interactions (directional)
  // Only include meaningful-strength edges — a chain is only as strong
  // as its weakest link, so weak edges produce weak chains.
  const causalTypes = new Set<string>([
    "enables", "triggers", "recurs", "reduces_cost",
  ]);
  const adjacency = new Map<string, Map<string, Interaction>>();

  for (const inter of interactions) {
    if (!causalTypes.has(inter.type)) continue;
    if (inter.strength < MIN_CHAIN_EDGE_STRENGTH) continue;
    const from = inter.cards[0];
    const to = inter.cards[1];
    if (!adjacency.has(from)) adjacency.set(from, new Map());
    // Keep the strongest interaction per edge
    const existing = adjacency.get(from)!.get(to);
    if (!existing || inter.strength > existing.strength) {
      adjacency.get(from)!.set(to, inter);
    }
  }

  const candidates: InteractionChain[] = [];
  const seen = new Set<string>();

  // DFS from each node to find paths of length >= 3
  for (const startCard of adjacency.keys()) {
    if (candidates.length >= MAX_CHAINS * 3) break; // collect extras to sort

    const stack: { path: string[]; interactions: Interaction[] }[] = [
      { path: [startCard], interactions: [] },
    ];

    while (stack.length > 0) {
      if (candidates.length >= MAX_CHAINS * 3) break;

      const { path, interactions: pathInteractions } = stack.pop()!;
      const current = path[path.length - 1];
      const neighbors = adjacency.get(current);
      if (!neighbors) continue;

      for (const [next, inter] of neighbors) {
        if (candidates.length >= MAX_CHAINS * 3) break;
        // Avoid revisiting nodes in this path (no cycles — that's loops)
        if (path.includes(next)) continue;

        const newPath = [...path, next];
        const newInteractions = [...pathInteractions, inter];

        // Emit chain if path has 3+ cards
        if (newPath.length >= 3) {
          const key = newPath.join(" → ");
          if (!seen.has(key)) {
            seen.add(key);
            const chain = buildChain(newPath, newInteractions);
            // Only keep chains where every edge is meaningful
            if (chain.strength >= MIN_CHAIN_AVG_STRENGTH) {
              candidates.push(chain);
            }
          }
        }

        // Continue extending if not too long
        if (newPath.length < 5) {
          stack.push({ path: newPath, interactions: newInteractions });
        }
      }
    }
  }

  // Sort by strength descending — best chains first
  candidates.sort((a, b) => b.strength - a.strength);
  return candidates.slice(0, MAX_CHAINS);
}

/**
 * Generate a strategic reasoning for why a chain matters in gameplay.
 */
function generateChainReasoning(
  path: string[],
  interactions: Interaction[]
): string {
  const types = interactions.map((i) => i.type);

  // Classify the chain pattern
  if (types.every((t) => t === "triggers")) {
    return `Trigger cascade — each card's effect triggers the next. ${path[0]} starts the chain, and each subsequent card fires automatically.`;
  }

  if (types.every((t) => t === "enables")) {
    return `Resource pipeline — each card produces what the next card needs. ${path[0]} feeds ${path[1]}, which feeds ${path[path.length - 1]}.`;
  }

  if (types.includes("enables") && types.includes("triggers")) {
    const enablerIdx = types.indexOf("enables");
    const triggerIdx = types.indexOf("triggers");
    if (enablerIdx < triggerIdx) {
      return `Resource-to-trigger chain — ${path[enablerIdx]} produces resources for ${path[enablerIdx + 1]}, which then causes events that trigger ${path[triggerIdx + 1]}.`;
    }
    return `Trigger-to-resource chain — ${path[triggerIdx]} triggers ${path[triggerIdx + 1]}, which produces resources enabling ${path[enablerIdx + 1]}.`;
  }

  if (types.includes("recurs")) {
    const recursIdx = types.indexOf("recurs");
    return `Recursion chain — ${path[recursIdx]} brings back ${path[recursIdx + 1]} from the graveyard, enabling continued synergy with ${path[path.length - 1]}.`;
  }

  if (types.includes("reduces_cost")) {
    const costIdx = types.indexOf("reduces_cost");
    return `Cost reduction chain — ${path[costIdx]} makes ${path[costIdx + 1]} cheaper, enabling more efficient play with ${path[path.length - 1]}.`;
  }

  // Fallback: describe the flow
  return `Multi-card synergy — ${path[0]} ${types[0]} ${path[1]}, which ${types[types.length - 1]} ${path[path.length - 1]}.`;
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
      interactionType: inter.type,
    });
  }

  // Chain strength = minimum edge strength (weakest link)
  const strength = interactions.length > 0
    ? Math.min(...interactions.map((i) => i.strength))
    : 0;

  const reasoning = generateChainReasoning(path, interactions);

  return {
    cards: path,
    description: `${path.join(" → ")}: ${steps.map((s) => s.description).join("; ")}`,
    reasoning,
    strength,
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
const MAX_LOOPS = 50;

function detectLoops(
  interactions: Interaction[],
  profiles: CardProfile[]
): InteractionLoop[] {
  if (profiles.length < 2) return [];

  // Build adjacency from causal interactions
  const causalTypes = new Set<string>(["enables", "triggers", "recurs"]);
  const adjacency = new Map<string, Map<string, Interaction[]>>();

  for (const inter of interactions) {
    if (!causalTypes.has(inter.type)) continue;
    if (inter.strength < 0.3) continue; // Skip weak edges
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
    if (loops.length >= MAX_LOOPS) break;
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
  if (loops.length >= MAX_LOOPS) return;

  const current = path[path.length - 1];
  const neighbors = adjacency.get(current);
  if (!neighbors) return;

  for (const [next] of neighbors) {
    if (loops.length >= MAX_LOOPS) return;

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

function profilesByName(profiles: CardProfile[]): Map<string, CardProfile> {
  const map = new Map<string, CardProfile>();
  for (const p of profiles) map.set(p.cardName, p);
  return map;
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
      interactionType: best?.type || "enables",
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
  const pMap = profilesByName(profiles);

  for (const cardName of loopCards) {
    const p = pMap.get(cardName);
    if (!p) continue;

    // Collect produced resources
    for (const prod of p.produces) {
      if (prod.category === "mana" || prod.category === "life" || prod.category === "cards") {
        resources.push(prod);
      } else if (prod.category === "counter" || prod.category === "stat_mod" || prod.category === "keyword_grant") {
        attributes.push(prod);
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
  const pMap = profilesByName(profiles);

  for (const cardName of loopCards) {
    const p = pMap.get(cardName);
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
    "recurs", "reduces_cost",
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
