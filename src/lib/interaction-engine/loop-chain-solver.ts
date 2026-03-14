/**
 * Loop Chain Solver — Action-chain approach to combo loop detection.
 *
 * Decomposes card abilities into discrete LoopSteps with explicit resource
 * inputs (requires) and outputs (produces). A loop exists when steps form
 * a circular chain where every requirement is satisfied by some other step's
 * production and all blocking outputs are consumed.
 */

import type {
  CardProfile,
  InteractionLoop,
  InteractionChain,
  LoopStep,
  ResourceRequirement,
  ResourceProduction,
  ObjectFilter,
  GameObjectRef,
} from "./types";

// ═══════════════════════════════════════════════════════════════
// RESOURCE TOKEN CONSTANTS
// ═══════════════════════════════════════════════════════════════

const CREATURE_ON_BF = "creature_on_bf";
const CREATURE_DEATH = "creature_death";
const TREASURE_TOKEN = "treasure_token";
const PLUS_COUNTER = "plus_counter";
const MINUS_COUNTER = "minus_counter";
const UNDYING_GRANT = "undying_grant";
const PERSIST_KEYWORD = "persist_keyword";

function manaToken(color: string): string {
  return `mana_${color}`;
}

function isManaToken(token: string): boolean {
  return token.startsWith("mana_");
}

// ═══════════════════════════════════════════════════════════════
// STEP EXTRACTION
// ═══════════════════════════════════════════════════════════════

function req(token: string, quantity = 1, filter?: ObjectFilter): ResourceRequirement {
  return { token, quantity, ...(filter ? { filter } : {}) };
}

function prod(token: string, quantity = 1, filter?: ObjectFilter): ResourceProduction {
  return { token, quantity, ...(filter ? { filter } : {}) };
}

function step(
  card: string,
  action: string,
  requires: ResourceRequirement[],
  produces: ResourceProduction[],
  blocking: ResourceProduction[],
  source: "structured" | "oracle",
  cardTypes?: string[],
  cardSubtypes?: string[]
): LoopStep {
  return { card, action, requires, produces, blocking, source, cardTypes, cardSubtypes };
}

/**
 * Extract ObjectFilter from a GameObjectRef (e.g., sacrifice cost target).
 */
function extractFilter(ref?: GameObjectRef): ObjectFilter | undefined {
  if (!ref) return undefined;
  const filter: ObjectFilter = {};
  let hasFilter = false;

  if (ref.quantity === "another" || ref.self === false) {
    filter.self = false;
    hasFilter = true;
  }
  if (ref.modifiers?.includes("nontoken")) {
    filter.isToken = false;
    hasFilter = true;
  }

  return hasFilter ? filter : undefined;
}

/**
 * Extract LoopSteps from a CardProfile's structured data and oracle text.
 */
export function extractLoopSteps(profile: CardProfile): LoopStep[] {
  const steps: LoopStep[] = [];
  const card = profile.cardName;
  const types = profile.cardTypes?.map((t) => String(t)) ?? [];
  const subtypes = profile.subtypes?.map((t) => String(t)) ?? [];

  // --- Structured extraction ---

  // 1. Sacrifice outlets from consumes
  for (const cost of profile.consumes) {
    if (cost.costType === "sacrifice" && cost.object?.types?.some((t) => t === "creature")) {
      const filter = extractFilter(cost.object);

      // Check what this sacrifice produces by looking at produces and causesEvents
      const manaProduced = profile.produces.filter(
        (p) => "category" in p && p.category === "mana"
      );

      if (manaProduced.length > 0) {
        // Mana-producing sac outlet (e.g., Ashnod's Altar, Phyrexian Altar)
        for (const mp of manaProduced) {
          if ("category" in mp && mp.category === "mana") {
            const qty = typeof mp.quantity === "number" ? mp.quantity : 1;
            const color = mp.color === "any" ? "any" : (mp.color ?? "C");
            steps.push(
              step(
                card,
                `sacrifice creature for ${color === "any" ? "any color" : `{${color}}`} mana`,
                [req(CREATURE_ON_BF, 1, filter)],
                [prod(CREATURE_DEATH), prod(manaToken(color), qty)],
                [],
                "structured",
                types,
                subtypes
              )
            );
          }
        }
      } else {
        // Free sac outlet (e.g., Viscera Seer, Altar of Dementia)
        steps.push(
          step(
            card,
            "sacrifice creature",
            [req(CREATURE_ON_BF, 1, filter)],
            [prod(CREATURE_DEATH)],
            [],
            "structured",
            types,
            subtypes
          )
        );
      }
    }
  }

  // 2. Death triggers that produce tokens/resources
  for (const trigger of profile.triggersOn) {
    if (
      trigger.kind === "zone_transition" &&
      trigger.to === "graveyard" &&
      trigger.object?.types?.some((t) => t === "creature")
    ) {
      const filter = extractFilter(trigger.object);

      // Check what this trigger produces
      const tokenProducers = profile.produces.filter(
        (p) => "category" in p && p.category === "create_token"
      );

      // Only create a death-trigger step if this card has token production AND
      // it's not already captured as a sac-outlet step above
      const isSacOutlet = profile.consumes.some(
        (c) => c.costType === "sacrifice" && c.object?.types?.some((t) => t === "creature")
      );

      if (tokenProducers.length > 0 && !isSacOutlet) {
        for (const tp of tokenProducers) {
          if ("category" in tp && tp.category === "create_token") {
            const isT = tp.token?.name?.toLowerCase().includes("treasure") ||
              tp.token?.subtypes?.some((s: string) => /treasure/i.test(String(s)));
            if (isT) {
              steps.push(
                step(
                  card,
                  "creature dies → create Treasure",
                  [req(CREATURE_DEATH, 1, filter)],
                  [prod(TREASURE_TOKEN)],
                  [],
                  "structured",
                  types,
                  subtypes
                )
              );
            }
          }
        }
      }
    }
  }

  // 3. Keyword grants (undying/persist)
  for (const grant of profile.grants) {
    const abilityStr =
      typeof grant.ability === "string"
        ? grant.ability
        : "keyword" in grant.ability
          ? grant.ability.keyword
          : "";

    if (/undying/i.test(abilityStr)) {
      const grantFilter: ObjectFilter = {};
      let hasFilter = false;

      // Check target ref for filters
      if (grant.to) {
        if (grant.to.quantity === "another" || grant.to.self === false) {
          grantFilter.self = false;
          hasFilter = true;
        }
        // Check for "non-Human" exclusions in subtypes
        // The game model stores this in TypeFilter, but grants use GameObjectRef
        // Look for "non-Human" patterns
        if (grant.to.subtypes?.length) {
          // If subtypes are present, they might be exclusions based on oracle text
        }
      }

      // Check oracle text for "non-Human" pattern
      const oracle = profile.rawOracleText ?? "";
      if (/non-Human/i.test(oracle) && /undying/i.test(oracle)) {
        grantFilter.supertypeExcludes = ["Human"];
        hasFilter = true;
      }

      steps.push(
        step(
          card,
          "grant undying",
          [],
          [prod(UNDYING_GRANT, 1, hasFilter ? grantFilter : undefined)],
          [],
          "structured",
          types,
          subtypes
        )
      );
    }

    if (/persist/i.test(abilityStr)) {
      steps.push(
        step(card, "grant persist", [], [prod(PERSIST_KEYWORD)], [], "structured", types, subtypes)
      );
    }
  }

  // 4. Replacement effects (counter prevention)
  for (const replacement of profile.replacements) {
    if (
      replacement.mode === "modify" ||
      replacement.mode === "prevent" ||
      replacement.mode === "replace"
    ) {
      // Check if it affects -1/-1 counters
      const replacesEvent = replacement.replaces;
      const isMinusCounter =
        (replacesEvent.kind === "state_change" &&
          replacesEvent.property === "counters" &&
          /minus|(-1\/-1)/.test(JSON.stringify(replacesEvent))) ||
        (profile.rawOracleText ?? "").match(
          /(-1\/-1 counter|minus one.*counter).*instead/i
        );

      if (isMinusCounter) {
        steps.push(
          step(
            card,
            "prevent -1/-1 counter",
            [req(MINUS_COUNTER)],
            [],
            [],
            "structured",
            types,
            subtypes
          )
        );
      }
    }
  }

  // 5. Persist keyword on the card itself
  if (
    profile.abilities.some(
      (a) => a.abilityType === "keyword" && /persist/i.test((a as { keyword?: string }).keyword ?? "")
    )
  ) {
    steps.push(
      step(
        card,
        "persist return",
        [req(CREATURE_DEATH)],
        [prod(CREATURE_ON_BF)],
        [prod(MINUS_COUNTER)],
        "structured",
        types,
        subtypes
      )
    );
  }

  // 6. Undying keyword on the card itself
  if (
    profile.abilities.some(
      (a) => a.abilityType === "keyword" && /undying/i.test((a as { keyword?: string }).keyword ?? "")
    )
  ) {
    steps.push(
      step(
        card,
        "undying return",
        [req(CREATURE_DEATH), req(UNDYING_GRANT)],
        [prod(CREATURE_ON_BF)],
        [prod(PLUS_COUNTER)],
        "structured",
        types,
        subtypes
      )
    );
  }

  // 7. Remove counter costs (e.g., Triskelion)
  for (const cost of profile.consumes) {
    if (cost.costType === "remove_counter" && /\+1\/\+1/.test(cost.counterType)) {
      steps.push(
        step(
          card,
          "remove +1/+1 counter",
          [req(PLUS_COUNTER, cost.quantity)],
          [prod(CREATURE_DEATH)], // Abstract: removing counters can lead to death
          [],
          "structured",
          types,
          subtypes
        )
      );
    }
  }

  // 8. Graveyard return abilities
  for (const ability of profile.abilities) {
    if (ability.abilityType !== "activated") continue;
    const activated = ability; // narrowed to ActivatedAbility
    const effects = activated.effects ?? [];
    const costs = activated.costs ?? [];

    const isGraveyardReturn = effects.some(
      (e) =>
        e.type === "return" ||
        (e.type === "zone_transition" && "to" in e)
    );

    if (isGraveyardReturn) {
      const manaReqs: ResourceRequirement[] = [];
      for (const c of costs) {
        if (c.costType === "mana") {
          parseManaRequirements(c.mana, manaReqs);
        }
      }

      if (manaReqs.length > 0) {
        steps.push(
          step(
            card,
            "return from graveyard",
            manaReqs,
            [prod(CREATURE_ON_BF)],
            [],
            "structured",
            types,
            subtypes
          )
        );
      }
    }
  }

  // 9. Zone cast permissions (e.g., Gravecrawler)
  for (const perm of profile.zoneCastPermissions) {
    if (perm.fromZone === "graveyard") {
      const manaReqs: ResourceRequirement[] = [];
      if (profile.castingCost) {
        parseManaRequirements(profile.castingCost.manaCost, manaReqs);
      }
      if (manaReqs.length > 0) {
        steps.push(
          step(
            card,
            "cast from graveyard",
            manaReqs,
            [prod(CREATURE_ON_BF)],
            [],
            "structured",
            types,
            subtypes
          )
        );
      }
    }
  }

  // --- Oracle text fallback ---
  // Always run oracle text fallback to supplement structured extraction.
  // The fallback avoids duplicating already-extracted steps via dedup in extractFromOracleText.
  if (profile.rawOracleText) {
    extractFromOracleText(profile, steps);
  }

  return steps;
}

/**
 * Parse mana cost string (e.g., "{1}{B}") into ResourceRequirements.
 */
function parseManaRequirements(
  manaCost: string,
  reqs: ResourceRequirement[]
): void {
  const symbolRegex = /\{([^}]+)\}/g;
  let match;
  while ((match = symbolRegex.exec(manaCost)) !== null) {
    const sym = match[1];
    if (/^\d+$/.test(sym)) {
      const n = parseInt(sym, 10);
      if (n > 0) reqs.push(req(manaToken("generic"), n));
    } else if (/^[WUBRG]$/.test(sym)) {
      reqs.push(req(manaToken(sym)));
    } else if (sym === "C") {
      reqs.push(req(manaToken("C")));
    } else if (sym.includes("/")) {
      // Hybrid mana — treat as generic for simplicity
      reqs.push(req(manaToken("generic")));
    }
  }
}

/**
 * Oracle text fallback extraction for cards not fully captured by structured data.
 */
function extractFromOracleText(profile: CardProfile, steps: LoopStep[]): void {
  const oracle = profile.rawOracleText ?? "";
  const card = profile.cardName;
  const types = profile.cardTypes?.map((t) => String(t)) ?? [];
  const subtypes = profile.subtypes?.map((t) => String(t)) ?? [];

  // Helper: check if a step with given action already exists
  const hasAction = (action: string) => steps.some((s) => s.card === card && s.action === action);
  // Helper: check if any step already produces a given token
  const alreadyProduces = (token: string) =>
    steps.some((s) => s.card === card && s.produces.some((p) => p.token === token));

  // Sacrifice outlets — upgrade existing structured step if oracle has more info (mana production)
  const sacMatch = oracle.match(
    /Sacrifice (another |a )creature[^.]*?:(.*?)(?:\.|$)/i
  );
  if (sacMatch) {
    const isAnother = /another/i.test(sacMatch[1]);
    const filter: ObjectFilter | undefined = isAnother ? { self: false } : undefined;
    const effectText = sacMatch[2] ?? "";

    // Check for mana production in effect
    const manaMatch = effectText.match(/Add \{([^}]+)\}\{([^}]+)\}/i);
    const anyManaMatch = effectText.match(/Add one mana of any color/i);
    const hasManaInOracle = !!(manaMatch || anyManaMatch);

    // Remove existing sac step for this card if oracle has better info (mana)
    const existingSacIdx = steps.findIndex(
      (s) => s.card === card && s.requires.some((r) => r.token === CREATURE_ON_BF) &&
        s.produces.some((p) => p.token === CREATURE_DEATH)
    );
    const existingHasMana = existingSacIdx >= 0 &&
      steps[existingSacIdx].produces.some((p) => isManaToken(p.token));

    // Only add oracle step if no existing step, or oracle has mana and existing doesn't
    if (existingSacIdx < 0 || (hasManaInOracle && !existingHasMana)) {
      if (existingSacIdx >= 0 && hasManaInOracle && !existingHasMana) {
        steps.splice(existingSacIdx, 1); // Remove incomplete structured step
      }

      if (manaMatch) {
        const sym1 = manaMatch[1];
        const sym2 = manaMatch[2];
        const color1 = sym1 === "C" ? "C" : sym1;
        const color2 = sym2 === "C" ? "C" : sym2;
        steps.push(
          step(
            card,
            `sacrifice creature for {${color1}}{${color2}}`,
            [req(CREATURE_ON_BF, 1, filter)],
            [prod(CREATURE_DEATH), prod(manaToken(color1)), prod(manaToken(color2))],
            [],
            "oracle",
            types,
            subtypes
          )
        );
      } else if (anyManaMatch) {
        steps.push(
          step(
            card,
            "sacrifice creature for any mana",
            [req(CREATURE_ON_BF, 1, filter)],
            [prod(CREATURE_DEATH), prod(manaToken("any"))],
            [],
            "oracle",
            types,
            subtypes
          )
        );
      } else if (existingSacIdx < 0) {
        // No existing step and no mana — add basic sac step
        steps.push(
          step(
            card,
            "sacrifice creature",
            [req(CREATURE_ON_BF, 1, filter)],
            [prod(CREATURE_DEATH)],
            [],
            "oracle",
            types,
            subtypes
          )
      );
      }
    }
  }

  // Death triggers creating Treasure
  const deathTreasure = oracle.match(
    /Whenever (.*?)creature(.*?)dies.*?create.*?Treasure/i
  );
  if (deathTreasure && !sacMatch) {
    const prefix = deathTreasure[1] ?? "";
    const isAnother = /another/i.test(prefix);
    const isNontoken = /nontoken/i.test(prefix);
    const filter: ObjectFilter = {};
    let hasFilter = false;
    if (isAnother) { filter.self = false; hasFilter = true; }
    if (isNontoken) { filter.isToken = false; hasFilter = true; }

    // Check if there's an existing treasure step without proper filter — upgrade it
    const existingTreasureIdx = steps.findIndex(
      (s) => s.card === card && s.produces.some((p) => p.token === TREASURE_TOKEN) &&
        s.requires.some((r) => r.token === CREATURE_DEATH)
    );

    if (existingTreasureIdx >= 0 && hasFilter) {
      // Upgrade existing step with oracle-derived filter
      const existingStep = steps[existingTreasureIdx];
      const deathReq = existingStep.requires.find((r) => r.token === CREATURE_DEATH);
      if (deathReq && !deathReq.filter) {
        deathReq.filter = filter;
      }
    } else if (existingTreasureIdx < 0) {
      steps.push(
        step(
          card,
          "creature dies → create Treasure",
          [req(CREATURE_DEATH, 1, hasFilter ? filter : undefined)],
          [prod(TREASURE_TOKEN)],
          [],
          "oracle",
          types,
          subtypes
        )
      );
    }
  }

  // Graveyard return with mana cost
  const graveyardReturn = oracle.match(
    /\{([^}]+(?:\}\{[^}]+)*)}: Return .+ from your graveyard to the battlefield/i
  );
  if (graveyardReturn && !alreadyProduces(CREATURE_ON_BF)) {
    const costStr = `{${graveyardReturn[1]}}`;
    const manaReqs: ResourceRequirement[] = [];
    parseManaRequirements(costStr, manaReqs);
    if (manaReqs.length > 0) {
      steps.push(
        step(card, "return from graveyard", manaReqs, [prod(CREATURE_ON_BF)], [], "oracle", types, subtypes)
      );
    }
  }

  // Undying/persist grant
  if (/other.*non-Human.*have undying/i.test(oracle) && !alreadyProduces(UNDYING_GRANT)) {
    steps.push(
      step(
        card,
        "grant undying to non-Humans",
        [],
        [prod(UNDYING_GRANT, 1, { self: false, supertypeExcludes: ["Human"] })],
        [],
        "oracle",
        types,
        subtypes
      )
    );
  } else if (/have undying/i.test(oracle) && !alreadyProduces(UNDYING_GRANT)) {
    steps.push(step(card, "grant undying", [], [prod(UNDYING_GRANT)], [], "oracle", types, subtypes));
  }

  if (/have persist/i.test(oracle) && !alreadyProduces(PERSIST_KEYWORD)) {
    steps.push(step(card, "grant persist", [], [prod(PERSIST_KEYWORD)], [], "oracle", types, subtypes));
  }

  // Persist keyword on this card
  if (/\bPersist\b/.test(oracle) && !/have persist/i.test(oracle) && !hasAction("persist return")) {
    const hasPersistKeyword = oracle.match(/^Persist$/m) || oracle.match(/\nPersist$/m);
    if (hasPersistKeyword) {
      steps.push(
        step(card, "persist return", [req(CREATURE_DEATH)], [prod(CREATURE_ON_BF)], [prod(MINUS_COUNTER)], "oracle", types, subtypes)
      );
    }
  }

  // Counter prevention (Vizier-style, Solemnity-style)
  if (!hasAction("prevent -1/-1 counter") && (
    /(-1\/-1 counter|counters?).*minus one.*instead/i.test(oracle) ||
    /counters can't be placed/i.test(oracle) ||
    /Players can't get counters/i.test(oracle)
  )) {
    steps.push(
      step(card, "prevent -1/-1 counter", [req(MINUS_COUNTER)], [], [], "oracle", types, subtypes)
    );
  }

  // Remove +1/+1 counter cost
  if (/Remove a \+1\/\+1 counter/i.test(oracle)) {
    steps.push(
      step(
        card,
        "remove +1/+1 counter",
        [req(PLUS_COUNTER)],
        [prod(CREATURE_DEATH)],
        [],
        "oracle",
        types,
        subtypes
      )
    );
  }

  // Cast from graveyard
  if (/cast .+ from your graveyard/i.test(oracle) || /may cast .+ from .+ graveyard/i.test(oracle)) {
    const manaReqs: ResourceRequirement[] = [];
    if (profile.castingCost) {
      parseManaRequirements(profile.castingCost.manaCost, manaReqs);
    }
    if (manaReqs.length > 0) {
      steps.push(
        step(card, "cast from graveyard", manaReqs, [prod(CREATURE_ON_BF)], [], "oracle", types, subtypes)
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// IMPLICIT STEPS
// ═══════════════════════════════════════════════════════════════

/**
 * Add synthetic steps for implicit resource conversions (Treasure → mana).
 */
function addImplicitSteps(steps: LoopStep[]): LoopStep[] {
  const hasTreasureProduction = steps.some((s) =>
    s.produces.some((p) => p.token === TREASURE_TOKEN)
  );

  if (hasTreasureProduction) {
    steps.push(
      step(
        "(Treasure)",
        "sacrifice for mana",
        [req(TREASURE_TOKEN)],
        [prod(manaToken("any"))],
        [],
        "structured"
      )
    );
  }

  return steps;
}

// ═══════════════════════════════════════════════════════════════
// MANA SATISFACTION
// ═══════════════════════════════════════════════════════════════

/**
 * Check if produced resources can satisfy required resources, with mana substitution.
 */
export function canSatisfyRequirements(
  produced: ResourceProduction[],
  required: ResourceRequirement[]
): { satisfied: boolean; surplus: ResourceProduction[] } {
  // Build pools
  const pool = new Map<string, number>();
  for (const p of produced) {
    pool.set(p.token, (pool.get(p.token) ?? 0) + p.quantity);
  }

  const needs = new Map<string, number>();
  for (const r of required) {
    needs.set(r.token, (needs.get(r.token) ?? 0) + r.quantity);
  }

  // 1. Satisfy non-mana requirements directly
  for (const [token, qty] of needs) {
    if (isManaToken(token)) continue;
    const available = pool.get(token) ?? 0;
    if (available < qty) return { satisfied: false, surplus: [] };
    pool.set(token, available - qty);
  }

  // 2. Satisfy exact-color mana requirements
  const manaNeeds: { token: string; qty: number }[] = [];
  for (const [token, qty] of needs) {
    if (!isManaToken(token)) continue;
    manaNeeds.push({ token, qty });
  }

  // Sort: specific colors first, then generic last
  manaNeeds.sort((a, b) => {
    const aGeneric = a.token === manaToken("generic") ? 1 : 0;
    const bGeneric = b.token === manaToken("generic") ? 1 : 0;
    return aGeneric - bGeneric;
  });

  for (const { token, qty } of manaNeeds) {
    let remaining = qty;

    if (token === manaToken("generic")) {
      // Generic mana: can be paid by any mana type
      // Use specific colors first, then "any", then "C"
      for (const [poolToken, poolQty] of pool) {
        if (!isManaToken(poolToken) || poolQty <= 0) continue;
        const use = Math.min(poolQty, remaining);
        pool.set(poolToken, poolQty - use);
        remaining -= use;
        if (remaining <= 0) break;
      }
    } else {
      // Specific color requirement
      // Try exact match first
      const exact = pool.get(token) ?? 0;
      const useExact = Math.min(exact, remaining);
      pool.set(token, exact - useExact);
      remaining -= useExact;

      // Try mana_any
      if (remaining > 0) {
        const anyPool = pool.get(manaToken("any")) ?? 0;
        const useAny = Math.min(anyPool, remaining);
        pool.set(manaToken("any"), anyPool - useAny);
        remaining -= useAny;
      }
    }

    if (remaining > 0) return { satisfied: false, surplus: [] };
  }

  // Build surplus
  const surplus: ResourceProduction[] = [];
  for (const [token, qty] of pool) {
    if (qty > 0) surplus.push(prod(token, qty));
  }

  return { satisfied: true, surplus };
}

// ═══════════════════════════════════════════════════════════════
// FILTER VALIDATION
// ═══════════════════════════════════════════════════════════════

/**
 * Check if a step's filter constraints are compatible with the providing step.
 * Returns false if a strict filter is violated.
 */
function checkFilterCompatibility(
  consumerStep: LoopStep,
  requirement: ResourceRequirement,
  producerStep: LoopStep
): boolean {
  if (!requirement.filter) return true;

  // self: false means the consumer can't be satisfied by the same card
  if (requirement.filter.self === false && producerStep.card === consumerStep.card) {
    return false;
  }

  // isToken: false means tokens can't satisfy this
  if (requirement.filter.isToken === false && producerStep.card === "(Treasure)") {
    return false;
  }

  // supertypeExcludes: check if the producer card has excluded subtypes
  if (requirement.filter.supertypeExcludes?.length) {
    const producerSubtypes = producerStep.cardSubtypes ?? [];
    for (const excluded of requirement.filter.supertypeExcludes) {
      if (producerSubtypes.some((s) => s.toLowerCase() === excluded.toLowerCase())) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Validate that all filter constraints in a step subset are satisfiable.
 */
function validateFilters(subset: LoopStep[]): boolean {
  for (const consumer of subset) {
    for (const requirement of consumer.requires) {
      if (!requirement.filter) continue;

      // Find a producer for this requirement
      const producers = subset.filter((s) =>
        s.produces.some((p) => p.token === requirement.token) ||
        s.blocking.some((p) => p.token === requirement.token)
      );

      if (producers.length === 0) continue; // Will be caught by resource check

      // For self: false, at least one producer must be a different card
      if (requirement.filter.self === false) {
        const hasDifferentCard = producers.some((p) => p.card !== consumer.card);
        if (!hasDifferentCard) return false;
      }

      // For isToken: false on creature_death, check that the creature source isn't token-only
      if (requirement.filter.isToken === false && requirement.token === CREATURE_DEATH) {
        // We need at least one non-token creature dying
        const hasNonToken = producers.some(
          (p) => p.card !== "(Treasure)" && p.produces.some((pr) => pr.token === CREATURE_DEATH)
        );
        if (!hasNonToken) return false;
      }

      // For supertypeExcludes on undying_grant
      if (requirement.filter.supertypeExcludes?.length && requirement.token === UNDYING_GRANT) {
        // Check that the grant's filter allows this consumer's card
        const grantProducers = producers.filter((p) =>
          p.produces.some((pr) => pr.token === UNDYING_GRANT)
        );
        for (const gp of grantProducers) {
          for (const pr of gp.produces) {
            if (pr.token === UNDYING_GRANT && pr.filter?.supertypeExcludes?.length) {
              // The grant excludes certain subtypes — check consumer
              for (const excluded of pr.filter.supertypeExcludes) {
                if (
                  consumer.cardSubtypes?.some(
                    (s) => s.toLowerCase() === excluded.toLowerCase()
                  )
                ) {
                  return false;
                }
              }
            }
          }
        }
      }
    }
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════
// CHAIN SOLVER
// ═══════════════════════════════════════════════════════════════

/**
 * Find all valid loop chains from a set of steps.
 * A valid chain has: all requires satisfied, all blocking outputs consumed,
 * and at least one circular dependency.
 */
export function solveChain(steps: LoopStep[]): LoopStep[][] {
  if (steps.length < 2) return [];

  // Synthesize granted return steps from step data
  synthesizeGrantedReturns(steps);

  const results: LoopStep[][] = [];
  const seen = new Set<string>();

  // Enumerate subsets of steps (2 to min(steps.length, 10))
  const maxSubset = Math.min(steps.length, 10);

  for (let size = 2; size <= maxSubset; size++) {
    enumerateSubsets(steps, size, 0, [], (subset) => {
      // Deduplicate by sorted card set
      const cardKey = [...new Set(subset.map((s) => s.card))].sort().join("+");
      if (seen.has(cardKey)) return;

      if (isValidChain(subset)) {
        seen.add(cardKey);
        results.push([...subset]);
      }
    });
  }

  return results;
}

function enumerateSubsets(
  steps: LoopStep[],
  targetSize: number,
  startIdx: number,
  current: LoopStep[],
  callback: (subset: LoopStep[]) => void
): void {
  if (current.length === targetSize) {
    callback(current);
    return;
  }
  if (startIdx >= steps.length) return;
  if (steps.length - startIdx < targetSize - current.length) return;

  for (let i = startIdx; i < steps.length; i++) {
    current.push(steps[i]);
    enumerateSubsets(steps, targetSize, i + 1, current, callback);
    current.pop();
  }
}

function isValidChain(subset: LoopStep[]): boolean {
  // 1. Check filter compatibility
  if (!validateFilters(subset)) return false;

  // 2. Collect all requires and produces (including blocking)
  const totalProduced: ResourceProduction[] = [];
  const totalRequired: ResourceRequirement[] = [];
  const totalBlocking: ResourceProduction[] = [];

  for (const s of subset) {
    totalProduced.push(...s.produces);
    totalRequired.push(...s.requires);
    totalBlocking.push(...s.blocking);
  }

  // 3. Check all non-mana requirements are satisfied by productions + blocking
  //    Blocking outputs ARE produced — they just also MUST be consumed.
  const prodPool = new Map<string, number>();
  for (const p of totalProduced) {
    prodPool.set(p.token, (prodPool.get(p.token) ?? 0) + p.quantity);
  }
  for (const b of totalBlocking) {
    prodPool.set(b.token, (prodPool.get(b.token) ?? 0) + b.quantity);
  }

  const reqPool = new Map<string, number>();
  for (const r of totalRequired) {
    reqPool.set(r.token, (reqPool.get(r.token) ?? 0) + r.quantity);
  }

  // Check non-mana requirements
  for (const [token, qty] of reqPool) {
    if (isManaToken(token)) continue;
    const available = prodPool.get(token) ?? 0;
    if (available < qty) return false;
  }

  // 4. Check mana requirements with substitution
  const manaProduced = totalProduced.filter((p) => isManaToken(p.token));
  const manaRequired = totalRequired.filter((r) => isManaToken(r.token));

  if (manaRequired.length > 0) {
    const { satisfied } = canSatisfyRequirements(manaProduced, manaRequired);
    if (!satisfied) return false;
  }

  // 5. Check blocking outputs are consumed
  for (const b of totalBlocking) {
    const consumed = reqPool.get(b.token) ?? 0;
    if (consumed < b.quantity) return false;
  }

  // 6. Check circularity — at least one token flows from one step to another
  // and back (directly or transitively)
  return hasCircularDependency(subset);
}

function hasCircularDependency(subset: LoopStep[]): boolean {
  // Build a directed graph: step → step via resource tokens
  const n = subset.length;
  const adj = Array.from({ length: n }, () => new Set<number>());

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      // Does step i produce (or block-produce) something step j requires?
      const allOutputs = [...subset[i].produces, ...subset[i].blocking];
      for (const p of allOutputs) {
        for (const r of subset[j].requires) {
          if (tokensMatch(p.token, r.token)) {
            adj[i].add(j);
          }
        }
      }
    }
  }

  // Check for any cycle in this directed graph using DFS
  for (let start = 0; start < n; start++) {
    const visited = new Set<number>();
    if (dfsReachable(start, start, adj, visited, 0, n)) return true;
  }

  return false;
}

function tokensMatch(produced: string, required: string): boolean {
  if (produced === required) return true;
  // Mana substitution: mana_any matches any mana_X
  if (produced === manaToken("any") && isManaToken(required)) return true;
  // Any specific mana matches generic
  if (isManaToken(produced) && required === manaToken("generic")) return true;
  return false;
}

function dfsReachable(
  start: number,
  current: number,
  adj: Set<number>[],
  visited: Set<number>,
  depth: number,
  maxNodes: number
): boolean {
  if (depth > 0 && current === start) return true;
  if (depth >= maxNodes) return false;

  for (const next of adj[current]) {
    if (next === start && depth > 0) return true;
    if (visited.has(next)) continue;
    visited.add(next);
    if (dfsReachable(start, next, adj, visited, depth + 1, maxNodes)) return true;
    visited.delete(next);
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════
// GRANTED KEYWORD STEPS
// ═══════════════════════════════════════════════════════════════

/**
 * Synthesize undying/persist return steps for creatures that could receive grants.
 * Works from step data alone (no profiles needed). If any step produces
 * undying_grant, every creature card that has steps producing creature_death
 * (but no own undying return) gets a synthetic return step.
 */
function synthesizeGrantedReturns(steps: LoopStep[]): void {
  const hasUndyingGrant = steps.some((s) => s.produces.some((p) => p.token === UNDYING_GRANT));
  const hasPersistGrant = steps.some((s) => s.produces.some((p) => p.token === PERSIST_KEYWORD));
  if (!hasUndyingGrant && !hasPersistGrant) return;

  // Find unique creature cards (cards with creature in cardTypes)
  const creatureCards = new Map<string, LoopStep>();
  for (const s of steps) {
    if (s.cardTypes?.some((t) => /creature/i.test(t)) && !creatureCards.has(s.card)) {
      creatureCards.set(s.card, s);
    }
  }

  for (const [card, representative] of creatureCards) {
    const hasOwnUndying = steps.some((s) => s.card === card && s.action === "undying return");
    const hasOwnPersist = steps.some((s) => s.card === card && s.action === "persist return");

    if (hasUndyingGrant && !hasOwnUndying) {
      steps.push(
        step(
          card,
          "undying return",
          [req(CREATURE_DEATH), req(UNDYING_GRANT)],
          [prod(CREATURE_ON_BF)],
          [prod(PLUS_COUNTER)],
          "structured",
          representative.cardTypes,
          representative.cardSubtypes
        )
      );
    }

    if (hasPersistGrant && !hasOwnPersist) {
      steps.push(
        step(
          card,
          "persist return",
          [req(CREATURE_DEATH), req(PERSIST_KEYWORD)],
          [prod(CREATURE_ON_BF)],
          [prod(MINUS_COUNTER)],
          "structured",
          representative.cardTypes,
          representative.cardSubtypes
        )
      );
    }
  }
}

/**
 * When one card grants undying (e.g., Mikaeus), other creatures need a
 * synthetic "undying return" step so the chain solver can model the loop.
 * Similarly for persist grants.
 */
function addGrantedReturnSteps(allSteps: LoopStep[], profiles: CardProfile[]): void {
  const hasUndyingGrant = allSteps.some((s) => s.produces.some((p) => p.token === UNDYING_GRANT));
  const hasPersistGrant = allSteps.some((s) => s.produces.some((p) => p.token === PERSIST_KEYWORD));

  if (!hasUndyingGrant && !hasPersistGrant) return;

  for (const p of profiles) {
    const card = p.cardName;
    const types = p.cardTypes?.map((t) => String(t)) ?? [];
    const subtypes = p.subtypes?.map((t) => String(t)) ?? [];
    const isCreature = types.some((t) => /creature/i.test(t));
    if (!isCreature) continue;

    // Skip cards that already have their own undying/persist return steps
    const hasOwnUndying = allSteps.some(
      (s) => s.card === card && s.action === "undying return"
    );
    const hasOwnPersist = allSteps.some(
      (s) => s.card === card && s.action === "persist return"
    );

    if (hasUndyingGrant && !hasOwnUndying) {
      // This creature could receive undying from a grant
      allSteps.push(
        step(
          card,
          "undying return",
          [req(CREATURE_DEATH), req(UNDYING_GRANT)],
          [prod(CREATURE_ON_BF)],
          [prod(PLUS_COUNTER)],
          "structured",
          types,
          subtypes
        )
      );
    }

    if (hasPersistGrant && !hasOwnPersist) {
      allSteps.push(
        step(
          card,
          "persist return",
          [req(CREATURE_DEATH), req(PERSIST_KEYWORD)],
          [prod(CREATURE_ON_BF)],
          [prod(MINUS_COUNTER)],
          "structured",
          types,
          subtypes
        )
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Detect loops using the action-chain approach.
 * Extracts LoopSteps from each profile, adds implicit steps, and solves.
 */
export function detectLoopsFromChains(
  profiles: CardProfile[]
): InteractionLoop[] {
  if (profiles.length < 2) return [];

  // Extract steps from all profiles
  let allSteps: LoopStep[] = [];
  for (const p of profiles) {
    allSteps.push(...extractLoopSteps(p));
  }

  // Add conditional undying/persist return steps for creatures that could receive grants
  addGrantedReturnSteps(allSteps, profiles);

  // Add implicit conversion steps
  allSteps = addImplicitSteps(allSteps);

  if (allSteps.length < 2) return [];

  // Solve
  const chains = solveChain(allSteps);

  // Convert to InteractionLoop
  return chains.map((chain) => chainToLoop(chain, profiles));
}

function chainToLoop(
  chain: LoopStep[],
  profiles: CardProfile[]
): InteractionLoop {
  const cards = [...new Set(chain.map((s) => s.card))].filter(
    (c) => c !== "(Treasure)"
  );

  const steps: InteractionChain["steps"] = [];
  for (let i = 0; i < chain.length; i++) {
    const current = chain[i];
    const next = chain[(i + 1) % chain.length];
    steps.push({
      from: current.card,
      to: next.card,
      event: {
        kind: "zone_transition" as const,
        to: "battlefield" as const,
        object: { types: [], quantity: "one" as const, modifiers: [] },
      },
      description: current.action,
      interactionType: "enables",
    });
  }

  // Compute net effect from the profiles in the loop
  const pMap = new Map(profiles.map((p) => [p.cardName, p]));
  const resources = [];
  const events = [];

  for (const cardName of cards) {
    const p = pMap.get(cardName);
    if (!p) continue;
    for (const prod of p.produces) {
      if ("category" in prod && (prod.category === "life" || prod.category === "cards")) {
        resources.push(prod);
      }
    }
    for (const e of p.causesEvents) {
      events.push(e);
    }
  }

  // Check if infinite: all mana requirements satisfied and blocking consumed
  const allProduced = chain.flatMap((s) => s.produces);
  const allRequired = chain.flatMap((s) => s.requires);
  const manaProduced = allProduced.filter((p) => isManaToken(p.token));
  const manaRequired = allRequired.filter((r) => isManaToken(r.token));
  const { satisfied } = canSatisfyRequirements(manaProduced, manaRequired);

  return {
    cards,
    description: `Loop: ${cards.join(" → ")} → ${cards[0]}`,
    steps,
    netEffect: {
      resources,
      attributes: [],
      events,
    },
    isInfinite: satisfied,
  };
}
