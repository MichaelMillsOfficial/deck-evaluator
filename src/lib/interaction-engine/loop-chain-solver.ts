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

// ─── Artifact Resource Tokens (Epic 2.4) ───
const ARTIFACT_ON_BF = "permanent_on_bf:artifact";
const ARTIFACT_TO_GY = "permanent_to_gy:artifact";
const TAP_PERMANENT = "tap:artifact";
const UNTAP_PERMANENT = "untap:artifact";
const ETB_ARTIFACT = "etb:artifact";

function manaToken(color: string): string {
  return `mana_${color}`;
}

function isManaToken(token: string): boolean {
  return token.startsWith("mana_");
}

/**
 * Check if a token is an artifact-related token.
 */
function isArtifactToken(token: string): boolean {
  return token === ARTIFACT_ON_BF || token === ARTIFACT_TO_GY ||
    token === TAP_PERMANENT || token === UNTAP_PERMANENT ||
    token === ETB_ARTIFACT;
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
 * Resolve the numeric quantity from a GameObjectRef quantity field.
 * "one" → 1, "another" → 1, number → number, "X" → 1 (conservative), "all"/"each" → 99 (prohibitive).
 */
function resolveQuantity(quantity: GameObjectRef["quantity"]): number {
  if (typeof quantity === "number") return quantity;
  switch (quantity) {
    case "one":
    case "another":
      return 1;
    case "X":
      return 1; // Conservative: treat X as 1
    case "all":
    case "each":
      return 99; // Prohibitively high — prevents loop validation
    default:
      return 1;
  }
}

/**
 * Parse English word quantities from oracle text (e.g., "two" → 2, "ten" → 10).
 */
function parseWordQuantity(word: string): number {
  const map: Record<string, number> = {
    a: 1, an: 1, another: 1, one: 1,
    two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };
  const n = parseInt(word, 10);
  if (!isNaN(n)) return n;
  return map[word.toLowerCase()] ?? 1;
}

/**
 * Returns true if the profile represents a sorcery or instant — one-shot spells
 * that cannot form repeatable loops without external recursion.
 * Used by both the chain solver (Pass 2) and graph-based cycle detection (Pass 1).
 */
export function isNonLoopableSpell(profile: CardProfile): boolean {
  const types = profile.cardTypes?.map((t) => String(t).toLowerCase()) ?? [];
  return types.includes("sorcery") || types.includes("instant");
}

/**
 * Extract LoopSteps from a CardProfile's structured data and oracle text.
 *
 * Sorceries and instants are excluded: they are one-shot spells that cannot
 * form repeatable loops without external recursion (e.g., Underworld Breach).
 */
export function extractLoopSteps(profile: CardProfile): LoopStep[] {
  const steps: LoopStep[] = [];
  const card = profile.cardName;
  const types = profile.cardTypes?.map((t) => String(t)) ?? [];
  const subtypes = profile.subtypes?.map((t) => String(t)) ?? [];

  if (isNonLoopableSpell(profile)) return steps;

  // --- Structured extraction ---

  // 1. Sacrifice outlets from consumes
  for (const cost of profile.consumes) {
    if (cost.costType === "sacrifice" && cost.object?.types?.some((t) => t === "creature")) {
      const filter = extractFilter(cost.object);
      const sacQty = resolveQuantity(cost.object?.quantity ?? "one");

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
                [req(CREATURE_ON_BF, sacQty, filter)],
                [prod(CREATURE_DEATH, sacQty), prod(manaToken(color), qty)],
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
            [req(CREATURE_ON_BF, sacQty, filter)],
            [prod(CREATURE_DEATH, sacQty)],
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
            const isTreasure = tp.token?.name?.toLowerCase().includes("treasure") ||
              tp.token?.subtypes?.some((s: string) => /treasure/i.test(String(s)));
            if (isTreasure) {
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

            // Artifact creature tokens (Thopters, Wurms, Myr, Servos, etc.)
            const tokenTypes = tp.token?.types?.map((t: string) => String(t).toLowerCase()) ?? [];
            const isArtifactCreatureToken = tokenTypes.includes("artifact") && tokenTypes.includes("creature");
            if (isArtifactCreatureToken) {
              steps.push(
                step(
                  card,
                  "creature dies → create artifact creature token",
                  [req(CREATURE_DEATH, 1, filter)],
                  [prod(ETB_ARTIFACT), prod(CREATURE_ON_BF)],
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

  // 2b. ETB triggers that produce artifact creature tokens (Breya, Myr Battlesphere)
  for (const trigger of profile.triggersOn) {
    if (
      trigger.kind === "zone_transition" &&
      trigger.to === "battlefield"
    ) {
      const tokenProducers = profile.produces.filter(
        (p) => "category" in p && p.category === "create_token"
      );

      for (const tp of tokenProducers) {
        if ("category" in tp && tp.category === "create_token") {
          const tokenTypes = tp.token?.types?.map((t: string) => String(t).toLowerCase()) ?? [];
          const isArtifactCreatureToken = tokenTypes.includes("artifact") && tokenTypes.includes("creature");
          if (isArtifactCreatureToken) {
            steps.push(
              step(
                card,
                "enters battlefield → create artifact creature token",
                [req(CREATURE_ON_BF)],
                [prod(ETB_ARTIFACT), prod(CREATURE_ON_BF)],
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

  // --- Artifact structured extraction (Epic 2.4) ---

  const isArtifact = types.some((t) => /artifact/i.test(t));
  const isArtifactCreature = isArtifact && types.some((t) => /creature/i.test(t));

  // 10. Artifact sacrifice outlets
  for (const cost of profile.consumes) {
    if (cost.costType === "sacrifice" && cost.object?.types?.some((t) => t === "artifact")) {
      const filter = extractFilter(cost.object);
      const sacQty = resolveQuantity(cost.object?.quantity ?? "one");

      const manaProduced = profile.produces.filter(
        (p) => "category" in p && p.category === "mana"
      );

      if (manaProduced.length > 0) {
        for (const mp of manaProduced) {
          if ("category" in mp && mp.category === "mana") {
            const qty = typeof mp.quantity === "number" ? mp.quantity : 1;
            const color = mp.color === "any" ? "any" : (mp.color ?? "C");
            const productions: ResourceProduction[] = [
              prod(ARTIFACT_TO_GY, sacQty),
              prod(manaToken(color), qty),
            ];
            steps.push(
              step(
                card,
                `sacrifice artifact for ${color === "any" ? "any color" : `{${color}}`} mana`,
                [req(ARTIFACT_ON_BF, sacQty, filter)],
                productions,
                [],
                "structured",
                types,
                subtypes
              )
            );
          }
        }
      } else {
        steps.push(
          step(
            card,
            "sacrifice artifact",
            [req(ARTIFACT_ON_BF, sacQty, filter)],
            [prod(ARTIFACT_TO_GY, sacQty)],
            [],
            "structured",
            types,
            subtypes
          )
        );
      }
    }
  }

  // 11. Artifact death/GY triggers
  for (const trigger of profile.triggersOn) {
    if (trigger.kind !== "zone_transition" || trigger.to !== "graveyard") continue;
    const triggerTypes = trigger.object?.types?.map((t) => String(t)) ?? [];
    const isArtifactTrigger = triggerTypes.some((t) => t === "artifact");
    if (!isArtifactTrigger) continue;

    const filter = extractFilter(trigger.object);
    const isSacOutlet = profile.consumes.some(
      (c) => c.costType === "sacrifice" && c.object?.types?.some((t) => t === "artifact")
    );

    if (!isSacOutlet) {
      // Generic artifact-to-GY trigger step (effects handled by oracle fallback)
      steps.push(
        step(
          card,
          "artifact goes to graveyard trigger",
          [req(ARTIFACT_TO_GY, 1, filter)],
          [], // Productions filled by oracle fallback
          [],
          "structured",
          types,
          subtypes
        )
      );
    }
  }

  // 12. Tap-cost activated abilities on artifacts
  if (isArtifact) {
    for (const ability of profile.abilities) {
      if (ability.abilityType !== "activated") continue;
      const costs = ability.costs ?? [];
      const hasTapCost = costs.some((c) => c.costType === "tap");
      if (!hasTapCost) continue;

      const manaReqs: ResourceRequirement[] = [];
      for (const c of costs) {
        if (c.costType === "mana") {
          parseManaRequirements(c.mana, manaReqs);
        }
      }

      // Check for mana production
      const manaProduced = profile.produces.filter(
        (p) => "category" in p && p.category === "mana"
      );

      if (manaProduced.length > 0) {
        for (const mp of manaProduced) {
          if ("category" in mp && mp.category === "mana") {
            const qty = typeof mp.quantity === "number" ? mp.quantity : 1;
            const color = mp.color === "any" ? "any" : (mp.color ?? "C");
            steps.push(
              step(
                card,
                `tap for ${color === "any" ? "any color" : `{${color}}`} mana`,
                manaReqs,
                [prod(TAP_PERMANENT), prod(manaToken(color), qty)],
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
    /Sacrifice (another|a|two|three|four|five|six|seven|eight|nine|ten|\d+) creature[s]?[^.]*?:(.*?)(?:\.|$)/i
  );
  if (sacMatch) {
    const quantifier = sacMatch[1].toLowerCase();
    const isAnother = quantifier === "another";
    const filter: ObjectFilter | undefined = isAnother ? { self: false } : undefined;
    const oracleSacQty = parseWordQuantity(quantifier);
    const effectText = sacMatch[2] ?? "";

    // Check for mana production in effect
    const manaMatch = effectText.match(/Add \{([^}]+)\}\{([^}]+)\}/i);
    const anyManaMatch = effectText.match(/Add one mana of any color/i);
    const hasManaInOracle = !!(manaMatch || anyManaMatch);

    // Remove existing sac step for this card if oracle has better info (mana or quantity)
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
            [req(CREATURE_ON_BF, oracleSacQty, filter)],
            [prod(CREATURE_DEATH, oracleSacQty), prod(manaToken(color1)), prod(manaToken(color2))],
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
            [req(CREATURE_ON_BF, oracleSacQty, filter)],
            [prod(CREATURE_DEATH, oracleSacQty), prod(manaToken("any"))],
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
            [req(CREATURE_ON_BF, oracleSacQty, filter)],
            [prod(CREATURE_DEATH, oracleSacQty)],
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

  // ─── Artifact Oracle Fallback (Epic 2.4) ───

  // Artifact sacrifice outlets: "Sacrifice an artifact:" or "Sacrifice two artifacts:" etc.
  const artifactSacMatch = oracle.match(
    /Sacrifice (an?|another|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:nonland )?artifact(?:s|creature)?[^.]*?:(.*?)(?:\.|$)/i
  );
  if (artifactSacMatch && !alreadyProduces(ARTIFACT_TO_GY)) {
    const quantifier = artifactSacMatch[1].toLowerCase();
    const oracleSacQty = parseWordQuantity(quantifier);
    const effectText = artifactSacMatch[2] ?? "";
    const manaMatch = effectText.match(/Add \{([^}]+)\}(?:\{([^}]+)\})?/i);
    const anyManaMatch = effectText.match(/Add one mana of any color/i);

    const productions: ResourceProduction[] = [prod(ARTIFACT_TO_GY, oracleSacQty)];
    // If sacrificing an artifact creature, also produce creature_death
    if (/artifact creature/i.test(artifactSacMatch[0])) {
      productions.push(prod(CREATURE_DEATH, oracleSacQty));
    }

    if (manaMatch) {
      const sym1 = manaMatch[1];
      const color1 = sym1 === "C" ? "C" : sym1;
      productions.push(prod(manaToken(color1)));
      if (manaMatch[2]) {
        const sym2 = manaMatch[2];
        const color2 = sym2 === "C" ? "C" : sym2;
        productions.push(prod(manaToken(color2)));
      }
      steps.push(
        step(card, `sacrifice artifact for mana`, [req(ARTIFACT_ON_BF, oracleSacQty)], productions, [], "oracle", types, subtypes)
      );
    } else if (anyManaMatch) {
      productions.push(prod(manaToken("any")));
      steps.push(
        step(card, "sacrifice artifact for any mana", [req(ARTIFACT_ON_BF, oracleSacQty)], productions, [], "oracle", types, subtypes)
      );
    } else {
      steps.push(
        step(card, "sacrifice artifact", [req(ARTIFACT_ON_BF, oracleSacQty)], productions, [], "oracle", types, subtypes)
      );
    }
  }

  // Artifact death/GY triggers: "Whenever an artifact creature dies" or "Whenever an artifact ... is put into a graveyard"
  const artifactDeathMatch = oracle.match(
    /Whenever (?:an?|another)\s+artifact(?:\s+creature)?\s+(?:you control\s+)?(?:dies|is put into a graveyard from the battlefield)/i
  );
  if (artifactDeathMatch) {
    const isCreatureDeath = /artifact creature.*dies/i.test(oracle);
    const triggerToken = isCreatureDeath ? CREATURE_DEATH : ARTIFACT_TO_GY;

    // Check for untap effects
    if (/untap target artifact/i.test(oracle) || /untap all artifacts/i.test(oracle)) {
      if (!alreadyProduces(UNTAP_PERMANENT)) {
        steps.push(
          step(card, "artifact dies → untap artifact", [req(triggerToken)], [prod(UNTAP_PERMANENT)], [], "oracle", types, subtypes)
        );
      }
    }

    // Also add a generic artifact-to-GY trigger if not already present
    if (!steps.some((s) => s.card === card && s.requires.some((r) => r.token === ARTIFACT_TO_GY))) {
      steps.push(
        step(card, "artifact to graveyard trigger", [req(ARTIFACT_TO_GY)], [], [], "oracle", types, subtypes)
      );
    }
  }

  // Untap artifact patterns: "untap target artifact", "Untap all artifacts you control"
  if (/[Uu]ntap target artifact/i.test(oracle) && !alreadyProduces(UNTAP_PERMANENT)) {
    // Already handled if from a death trigger above, but catch standalone cases
    if (!steps.some((s) => s.card === card && s.produces.some((p) => p.token === UNTAP_PERMANENT))) {
      steps.push(
        step(card, "untap artifact", [], [prod(UNTAP_PERMANENT)], [], "oracle", types, subtypes)
      );
    }
  }

  // Clock of Omens pattern: "Tap two untapped artifacts you control: Untap target artifact."
  const clockMatch = oracle.match(/Tap (?:two|2) untapped artifacts you control.*?[Uu]ntap target artifact/i);
  if (clockMatch && !alreadyProduces(UNTAP_PERMANENT)) {
    steps.push(
      step(card, "tap two artifacts → untap artifact", [req(TAP_PERMANENT, 2)], [prod(UNTAP_PERMANENT)], [], "oracle", types, subtypes)
    );
  }

  // Tap-for-mana on artifacts (oracle fallback for "{T}: Add" patterns)
  const isArtifactType = types.some((t) => /artifact/i.test(t));
  if (isArtifactType) {
    const tapManaMatch = oracle.match(/\{T\}.*?:\s*Add\s+(\{[^}]+\}(?:\{[^}]+\})*)/i);
    if (tapManaMatch && !alreadyProduces(TAP_PERMANENT)) {
      const manaCostStr = tapManaMatch[1];
      const manaProds: ResourceProduction[] = [prod(TAP_PERMANENT)];
      const symbolRegex = /\{([^}]+)\}/g;
      let m;
      while ((m = symbolRegex.exec(manaCostStr)) !== null) {
        const sym = m[1];
        if (/^[WUBRGC]$/.test(sym)) {
          manaProds.push(prod(manaToken(sym)));
        } else if (sym === "C") {
          manaProds.push(prod(manaToken("C")));
        }
      }
      if (manaProds.length > 1) {
        steps.push(
          step(card, "tap for mana", [], manaProds, [], "oracle", types, subtypes)
        );
      }
    }

    // Untap self ability: "{N}: Untap ~" pattern
    const untapSelfMatch = oracle.match(/\{(\d+)\}.*?:\s*Untap/i);
    if (untapSelfMatch && !alreadyProduces(UNTAP_PERMANENT)) {
      const cost = parseInt(untapSelfMatch[1], 10);
      const manaReqs: ResourceRequirement[] = [];
      if (cost > 0) manaReqs.push(req(manaToken("generic"), cost));
      steps.push(
        step(card, "untap self", manaReqs, [prod(UNTAP_PERMANENT)], [], "oracle", types, subtypes)
      );
    }
  }

  // Nim Deathmantle pattern: "Whenever a nontoken creature dies, you may pay {N}. If you do, return that card to the battlefield"
  const deathmantleMatch = oracle.match(
    /Whenever a (nontoken )?creature dies.*?you may pay \{(\d+)\}.*?return (?:that card|it) to the battlefield/i
  );
  if (deathmantleMatch) {
    const isNontoken = !!deathmantleMatch[1];
    const manaCost = parseInt(deathmantleMatch[2], 10);
    const deathFilter: ObjectFilter | undefined = isNontoken ? { isToken: false } : undefined;
    const manaReqs: ResourceRequirement[] = [req(CREATURE_DEATH, 1, deathFilter)];
    if (manaCost > 0) manaReqs.push(req(manaToken("generic"), manaCost));

    const productions: ResourceProduction[] = [prod(CREATURE_ON_BF)];
    // If returning an artifact creature, also produce ETB_ARTIFACT
    productions.push(prod(ETB_ARTIFACT));

    steps.push(
      step(card, "creature dies → pay to return", manaReqs, productions, [], "oracle", types, subtypes)
    );
  }

  // Myr Retriever pattern: "When ~ dies, return another artifact card from your graveyard to your hand"
  const retrieverMatch = oracle.match(
    /When .+ dies, return another artifact card from your graveyard to your hand/i
  );
  if (retrieverMatch) {
    steps.push(
      step(card, "dies → return artifact to hand", [req(CREATURE_DEATH)], [prod(ARTIFACT_TO_GY)], [], "oracle", types, subtypes)
    );
  }

  // ─── Artifact Creature Token Creation (Oracle Fallback) ───

  // Death → artifact creature token (Wurmcoil Engine)
  if (/(When|Whenever).*dies.*create.*artifact creature token/i.test(oracle)) {
    if (!steps.some((s) => s.card === card && s.action === "creature dies → create artifact creature token")) {
      steps.push(
        step(card, "creature dies → create artifact creature token", [req(CREATURE_DEATH)], [prod(ETB_ARTIFACT), prod(CREATURE_ON_BF)], [], "oracle", types, subtypes)
      );
    }
  }

  // ETB → artifact creature token (Breya, Myr Battlesphere)
  if (/(When|Whenever).*enters the battlefield.*create.*artifact creature token/i.test(oracle)) {
    if (!steps.some((s) => s.card === card && s.action === "enters battlefield → create artifact creature token")) {
      steps.push(
        step(card, "enters battlefield → create artifact creature token", [req(CREATURE_ON_BF)], [prod(ETB_ARTIFACT), prod(CREATURE_ON_BF)], [], "oracle", types, subtypes)
      );
    }
  }

  // Sacrifice → artifact creature token (Thopter Foundry)
  if (/Sacrifice.*:.*[Cc]reate.*artifact creature token/i.test(oracle)) {
    if (!steps.some((s) => s.card === card && s.action === "sacrifice → create artifact creature token")) {
      steps.push(
        step(card, "sacrifice → create artifact creature token", [req(ARTIFACT_ON_BF)], [prod(ETB_ARTIFACT), prod(CREATURE_ON_BF)], [], "oracle", types, subtypes)
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

  // Artifact implicit conversions: ETB_ARTIFACT → ARTIFACT_ON_BF
  const hasArtifactETB = steps.some((s) =>
    s.produces.some((p) => p.token === ETB_ARTIFACT)
  );
  if (hasArtifactETB) {
    steps.push(
      step(
        "(Artifact ETB)",
        "artifact enters → on battlefield",
        [req(ETB_ARTIFACT)],
        [prod(ARTIFACT_ON_BF)],
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

/** Budget counter for subset enumeration. */
interface BudgetCounter {
  count: number;
  limit: number;
  exceeded: boolean;
}

/**
 * Build a connectivity graph: steps that share at least one token (produced by one,
 * required by the other) are connected. Returns indices of connected steps only.
 */
function filterConnectedSteps(steps: LoopStep[]): LoopStep[] {
  if (steps.length <= 6) return steps;

  // Build token-flow adjacency: step i connects to step j if i produces something j requires or vice versa
  const connected = new Set<number>();

  for (let i = 0; i < steps.length; i++) {
    for (let j = i + 1; j < steps.length; j++) {
      let linked = false;
      // Check if i's productions match j's requirements
      for (const p of [...steps[i].produces, ...steps[i].blocking]) {
        for (const r of steps[j].requires) {
          if (tokensMatch(p.token, r.token)) { linked = true; break; }
        }
        if (linked) break;
      }
      // Check reverse
      if (!linked) {
        for (const p of [...steps[j].produces, ...steps[j].blocking]) {
          for (const r of steps[i].requires) {
            if (tokensMatch(p.token, r.token)) { linked = true; break; }
          }
          if (linked) break;
        }
      }
      if (linked) {
        connected.add(i);
        connected.add(j);
      }
    }
  }

  return [...connected].sort((a, b) => a - b).map((i) => steps[i]);
}

/**
 * Check if a step involves artifact tokens (either requires or produces).
 */
function involvesArtifactTokens(s: LoopStep): boolean {
  return s.requires.some((r) => isArtifactToken(r.token)) ||
    s.produces.some((p) => isArtifactToken(p.token)) ||
    s.blocking.some((b) => isArtifactToken(b.token)) ||
    (s.cardTypes?.some((t) => /artifact/i.test(t)) ?? false);
}

/**
 * Find all valid loop chains from a set of steps.
 * A valid chain has: all requires satisfied, all blocking outputs consumed,
 * and at least one circular dependency.
 *
 * Uses split-pass enumeration: creature-only steps (max 10) and
 * artifact-involving steps (max 6), with connectivity pre-filter
 * and budget cutoff at 50,000 evaluations.
 */
export function solveChain(steps: LoopStep[]): LoopStep[][] {
  if (steps.length < 2) return [];

  // Synthesize granted return steps from step data
  synthesizeGrantedReturns(steps);

  const results: LoopStep[][] = [];
  const seen = new Set<string>();
  const budget: BudgetCounter = { count: 0, limit: 50_000, exceeded: false };

  // Pre-filter: only include steps connected to at least one other step
  const connected = filterConnectedSteps(steps);
  if (connected.length < 2) return [];

  // Split-pass enumeration: separate creature-only and artifact-involving steps
  const artifactSteps = connected.filter(involvesArtifactTokens);
  const creatureOnlySteps = connected.filter((s) => !involvesArtifactTokens(s));

  const enumeratePass = (passSteps: LoopStep[], maxSize: number) => {
    if (passSteps.length < 2) return;
    const limit = Math.min(passSteps.length, maxSize);

    for (let size = 2; size <= limit; size++) {
      if (budget.exceeded) break;
      enumerateSubsets(passSteps, size, 0, [], budget, (subset) => {
        const cardKey = [...new Set(subset.map((s) => s.card))].sort().join("+");
        if (seen.has(cardKey)) return;

        if (isValidChain(subset)) {
          seen.add(cardKey);
          results.push([...subset]);
        }
      });
    }
  };

  // Pass 1: creature-only steps (max subset 10)
  enumeratePass(creatureOnlySteps, 10);

  // Pass 2: artifact-involving steps (max subset 6)
  enumeratePass(artifactSteps, 6);

  // Pass 3: mixed steps — try combining artifact and creature steps
  // Only if both exist and budget remains
  if (!budget.exceeded && artifactSteps.length > 0 && creatureOnlySteps.length > 0) {
    enumeratePass(connected, 6);
  }

  return results;
}

function enumerateSubsets(
  steps: LoopStep[],
  targetSize: number,
  startIdx: number,
  current: LoopStep[],
  budget: BudgetCounter,
  callback: (subset: LoopStep[]) => void
): void {
  if (budget.exceeded) return;

  if (current.length === targetSize) {
    budget.count++;
    if (budget.count >= budget.limit) {
      budget.exceeded = true;
      return;
    }
    callback(current);
    return;
  }
  if (startIdx >= steps.length) return;
  if (steps.length - startIdx < targetSize - current.length) return;

  for (let i = startIdx; i < steps.length; i++) {
    if (budget.exceeded) return;
    current.push(steps[i]);
    enumerateSubsets(steps, targetSize, i + 1, current, budget, callback);
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
  // Parameterized token matching: "creature_death:artifact" matches "creature_death"
  // A qualified token satisfies an unqualified requirement of the same base
  if (produced.includes(":") && !required.includes(":")) {
    const base = produced.split(":")[0];
    if (base === required) return true;
  }
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
    (c) => c !== "(Treasure)" && c !== "(Artifact ETB)"
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
