/**
 * Keyword Database — Keyword → Structured Ability Expansion
 *
 * Each keyword entry returns AbilityNode[] representing all abilities
 * the keyword grants. Parameters (e.g., Ward 3, Crew 4) are passed in
 * and substituted into the structured output.
 */

import type {
  AbilityNode,
  TriggeredAbility,
  ActivatedAbility,
  StaticAbility,
  ReplacementAbility,
  KeywordAbility,
  Cost,
  Effect,
  GameEvent,
  ZoneTransition,
  StateChange,
  PlayerAction,
  PhaseTrigger,
  DamageEvent,
  TargetEvent,
  Condition,
  EffectDuration,
  CrewCost,
  SaddleCost,
  PayLifeCost,
  SacrificeCost,
  ManaCostUnit,
  ExileCost,
  DiscardCost,
  TapCost,
  CostSubstitutionEffect,
} from "./types";
import type { Speed, Layer } from "./rules/types";
import type { GameObjectRef, Zone, Controller } from "./game-model";

// ─── Keyword Entry ───
export interface KeywordEntry {
  /** The keyword name (lowercase) */
  keyword: string;
  /** Whether this keyword takes a parameter (e.g., "3" for Ward 3) */
  hasParameter: boolean;
  /** Category for grouping */
  category: KeywordCategory;
  /** Comprehensive Rules reference */
  crReference: string;
  /**
   * Expand the keyword into structured ability nodes.
   * @param parameter — The keyword parameter (e.g., "3" for Ward 3, "Swamp" for Swampwalk)
   * @param cardName — The card name (for self-references in effects)
   */
  expand: (parameter?: string, cardName?: string) => AbilityNode[];
}

export type KeywordCategory =
  | "simple"
  | "cost_modifying"
  | "zone_casting"
  | "permanent_type"
  | "complex"
  | "damage_routing"
  | "copy_generation"
  | "counter_interaction"
  | "alternative_casting"
  | "trigger_pattern"
  | "maintenance"
  | "attachment"
  | "progression"
  | "resource_token";

// ─── Helper: Creature-reference object ───
function creatureRef(controller?: Controller): GameObjectRef {
  return {
    types: ["creature"],
    quantity: "one",
    modifiers: [],
    controller,
  };
}

// ═══════════════════════════════════════════════════════════════════
// KEYWORD DATABASE
// ═══════════════════════════════════════════════════════════════════

export const KEYWORD_DATABASE: KeywordEntry[] = [
  // ─── Simple Keywords ───
  {
    keyword: "flying",
    hasParameter: false,
    category: "simple",
    crReference: "CR 702.9",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "evasion",
            details: {
              canBeBlockedBy: "creatures with flying or reach",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "haste",
    hasParameter: false,
    category: "simple",
    crReference: "CR 702.10",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "remove_summoning_sickness",
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "lifelink",
    hasParameter: false,
    category: "simple",
    crReference: "CR 702.15",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "damage_also_gains_life",
            details: {
              description:
                "Damage dealt by this creature also causes its controller to gain that much life",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "deathtouch",
    hasParameter: false,
    category: "simple",
    crReference: "CR 702.2",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "deathtouch",
            details: {
              description:
                "Any amount of damage this deals to a creature is enough to destroy it (SBA 704.5f)",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "trample",
    hasParameter: false,
    category: "simple",
    crReference: "CR 702.19",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "trample",
            details: {
              description:
                "Excess combat damage may be assigned to defending player or planeswalker",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "indestructible",
    hasParameter: false,
    category: "simple",
    crReference: "CR 702.12",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "indestructible",
            details: {
              description:
                'Prevents "destroy" effects and lethal damage destruction. ' +
                "Does NOT prevent: sacrifice, exile, -X/-X to 0 toughness, legend rule, " +
                "or being returned/bounced.",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "hexproof",
    hasParameter: false,
    category: "simple",
    crReference: "CR 702.11",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "targeting_restriction",
            details: {
              cantBeTargetedBy: "opponents",
              description:
                "Can't be the target of spells or abilities opponents control",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "shroud",
    hasParameter: false,
    category: "simple",
    crReference: "CR 702.18",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "targeting_restriction",
            details: {
              cantBeTargetedBy: "any",
              description:
                "Can't be the target of spells or abilities (including yours)",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "ward",
    hasParameter: true,
    category: "simple",
    crReference: "CR 702.21",
    expand: (parameter?: string) => [
      {
        abilityType: "triggered",
        trigger: {
          kind: "target",
          targetObject: { types: [], quantity: "one", modifiers: [], self: true },
          sourceSpellOrAbility: { types: [], quantity: "one", modifiers: [] },
          controller: "opponent",
        } as TargetEvent,
        effects: [
          {
            type: "counter_unless_pays",
            details: {
              cost: parameter ?? "unknown",
              description: `Counter that spell or ability unless its controller pays ${parameter}`,
            },
          },
        ],
        condition: undefined,
        speed: "instant" as const,
      } as TriggeredAbility,
    ],
  },
  {
    keyword: "protection",
    hasParameter: true,
    category: "simple",
    crReference: "CR 702.16",
    expand: (parameter?: string) => [
      {
        abilityType: "static",
        effects: [
          {
            type: "protection",
            details: {
              from: parameter ?? "unknown",
              // DEBT: Damage prevented, Enchanted/Equipped detach,
              // Blocked prevented, Targeted prevented
              damagePreventedFrom: parameter,
              cantBeEnchantedOrEquippedBy: parameter,
              cantBeBlockedBy: parameter,
              cantBeTargetedBy: parameter,
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "phasing",
    hasParameter: false,
    category: "simple",
    crReference: "CR 702.26",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "phasing",
            details: {
              description:
                "Phases out during untap step, phases back in next untap. " +
                "Does NOT cause zone transitions (CR 702.26d). " +
                "Auras/Equipment stay attached through phasing.",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "first strike",
    hasParameter: false,
    category: "simple",
    crReference: "CR 702.7",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "first_strike",
            details: {
              description: "Deals combat damage in the first combat damage step",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "double strike",
    hasParameter: false,
    category: "simple",
    crReference: "CR 702.4",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "double_strike",
            details: {
              description:
                "Deals combat damage in both first strike and regular combat damage steps",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "vigilance",
    hasParameter: false,
    category: "simple",
    crReference: "CR 702.20",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "vigilance",
            details: {
              description: "Attacking doesn't cause this creature to tap",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "reach",
    hasParameter: false,
    category: "simple",
    crReference: "CR 702.17",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "reach",
            details: {
              description: "Can block creatures with flying",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "menace",
    hasParameter: false,
    category: "simple",
    crReference: "CR 702.110",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "evasion",
            details: {
              description: "Can't be blocked except by two or more creatures",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "flash",
    hasParameter: false,
    category: "simple",
    crReference: "CR 702.8",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "flash",
            details: {
              description: "You may cast this spell any time you could cast an instant",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "defender",
    hasParameter: false,
    category: "simple",
    crReference: "CR 702.3",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "restriction",
            gameEffect: {
              category: "restriction",
              restricts: "attack",
              target: { types: [], quantity: "one", modifiers: [], self: true },
            },
          },
        ],
      } as StaticAbility,
    ],
  },

  // ─── Cost-Modifying Keywords ───
  {
    keyword: "convoke",
    hasParameter: false,
    category: "cost_modifying",
    crReference: "CR 702.51",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "cost_reduction",
            details: {
              mechanic: "convoke",
              description:
                "Each creature you tap while casting reduces cost by {1} or one mana of that creature's color",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "delve",
    hasParameter: false,
    category: "cost_modifying",
    crReference: "CR 702.66",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "cost_reduction",
            details: {
              mechanic: "delve",
              description:
                "Each card you exile from your graveyard while casting reduces cost by {1}",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "affinity",
    hasParameter: true,
    category: "cost_modifying",
    crReference: "CR 702.41",
    expand: (parameter?: string) => [
      {
        abilityType: "static",
        effects: [
          {
            type: "cost_reduction",
            details: {
              mechanic: "affinity",
              for: parameter ?? "artifacts",
              description: `Costs {1} less for each ${parameter ?? "artifact"} you control`,
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "emerge",
    hasParameter: true,
    category: "cost_modifying",
    crReference: "CR 702.119",
    expand: (parameter?: string) => [
      {
        abilityType: "static",
        effects: [
          {
            type: "alternative_cost",
            details: {
              mechanic: "emerge",
              cost: parameter,
              description: `You may cast this by sacrificing a creature and paying ${parameter} minus that creature's mana value`,
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "improvise",
    hasParameter: false,
    category: "cost_modifying",
    crReference: "CR 702.126",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "cost_reduction",
            details: {
              mechanic: "improvise",
              description:
                "Each artifact you tap while casting reduces cost by {1}",
            },
          },
        ],
      } as StaticAbility,
    ],
  },

  // ─── Zone-Casting Keywords ───
  {
    keyword: "flashback",
    hasParameter: true,
    category: "zone_casting",
    crReference: "CR 702.34",
    expand: (parameter?: string) => [
      {
        abilityType: "static",
        effects: [
          {
            type: "zone_cast_permission",
            gameEffect: {
              category: "zone_cast_permission",
              fromZone: "graveyard" as Zone,
              position: "any",
              alternativeCost: parameter
                ? [{ costType: "mana", mana: parameter } as ManaCostUnit]
                : [],
            },
            details: {
              mechanic: "flashback",
              exileAfter: true,
              description: `You may cast this from your graveyard for ${parameter}. Exile it afterwards.`,
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "escape",
    hasParameter: true,
    category: "zone_casting",
    crReference: "CR 702.138",
    expand: (parameter?: string) => [
      {
        abilityType: "static",
        effects: [
          {
            type: "zone_cast_permission",
            gameEffect: {
              category: "zone_cast_permission",
              fromZone: "graveyard" as Zone,
              position: "any",
            },
            details: {
              mechanic: "escape",
              cost: parameter,
              description: `You may cast this from your graveyard for its escape cost (${parameter})`,
              zoneOfOriginConditional: true,
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "retrace",
    hasParameter: false,
    category: "zone_casting",
    crReference: "CR 702.80",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "zone_cast_permission",
            gameEffect: {
              category: "zone_cast_permission",
              fromZone: "graveyard" as Zone,
              position: "any",
            },
            details: {
              mechanic: "retrace",
              additionalCost: "discard a land card",
              description:
                "You may cast this from your graveyard by discarding a land card as an additional cost",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "jump-start",
    hasParameter: false,
    category: "zone_casting",
    crReference: "CR 702.133",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "zone_cast_permission",
            gameEffect: {
              category: "zone_cast_permission",
              fromZone: "graveyard" as Zone,
              position: "any",
            },
            details: {
              mechanic: "jump-start",
              additionalCost: "discard a card",
              exileAfter: true,
              description:
                "You may cast this from your graveyard by discarding a card. Exile it afterwards.",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "unearth",
    hasParameter: true,
    category: "zone_casting",
    crReference: "CR 702.84",
    expand: (parameter?: string) => [
      {
        abilityType: "activated",
        costs: [{ costType: "mana", mana: parameter ?? "" } as ManaCostUnit],
        effects: [
          {
            type: "return_from_graveyard",
            zoneTransition: {
              kind: "zone_transition",
              from: "graveyard",
              to: "battlefield",
              object: { types: [], quantity: "one", modifiers: [], self: true },
            } as ZoneTransition,
            details: {
              gainsHaste: true,
              exileAtEndOfTurn: true,
              exileIfWouldLeave: true,
            },
          },
        ],
        condition: undefined,
        speed: "sorcery" as Speed,
      } as ActivatedAbility,
    ],
  },
  {
    keyword: "foretell",
    hasParameter: true,
    category: "zone_casting",
    crReference: "CR 702.143",
    expand: (parameter?: string) => [
      {
        abilityType: "static",
        effects: [
          {
            type: "zone_cast_permission",
            details: {
              mechanic: "foretell",
              exileCost: "{2}",
              castCost: parameter,
              description:
                `During your turn, you may pay {2} to exile this face-down. ` +
                `On a later turn, cast it for ${parameter}.`,
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "rebound",
    hasParameter: false,
    category: "zone_casting",
    crReference: "CR 702.88",
    expand: () => [
      {
        abilityType: "replacement",
        replaces: {
          kind: "zone_transition",
          to: "graveyard",
          object: { types: [], quantity: "one", modifiers: [], self: true },
        } as ZoneTransition,
        with: [
          {
            type: "exile_instead",
            zoneTransition: {
              kind: "zone_transition",
              to: "exile",
              object: { types: [], quantity: "one", modifiers: [], self: true },
            } as ZoneTransition,
            details: {
              condition: "if cast from hand",
              delayedTrigger: "at beginning of your next upkeep, cast from exile for free",
            },
          },
        ],
        condition: {
          type: "if",
          predicate: "this spell was cast from your hand",
        },
        mode: "replace" as const,
      } as ReplacementAbility,
    ],
  },

  // ─── Permanent-Type Keywords ───
  {
    keyword: "crew",
    hasParameter: true,
    category: "permanent_type",
    crReference: "CR 702.122",
    expand: (parameter?: string) => {
      const threshold = parseInt(parameter ?? "0", 10);
      return [
        {
          abilityType: "activated",
          costs: [{ costType: "crew", powerThreshold: threshold } as CrewCost],
          effects: [
            {
              type: "type_change",
              gameEffect: {
                category: "type_change",
                target: {
                  types: [],
                  quantity: "one",
                  modifiers: [],
                  self: true,
                },
                addTypes: ["creature"],
              },
              duration: { type: "until_end_of_turn" },
            },
          ],
          condition: undefined,
          speed: "sorcery" as Speed,
        } as ActivatedAbility,
      ];
    },
  },
  {
    keyword: "saddle",
    hasParameter: true,
    category: "permanent_type",
    crReference: "CR 702.168",
    expand: (parameter?: string) => {
      const threshold = parseInt(parameter ?? "0", 10);
      return [
        {
          abilityType: "activated",
          costs: [
            { costType: "saddle", powerThreshold: threshold } as SaddleCost,
          ],
          effects: [
            {
              type: "set_saddled_state",
              details: {
                description: "This Mount becomes saddled until end of turn",
              },
              duration: { type: "until_end_of_turn" },
            },
          ],
          condition: undefined,
          speed: "sorcery" as Speed,
        } as ActivatedAbility,
      ];
    },
  },

  // ─── Complex Multi-Ability Keywords ───
  {
    keyword: "suspend",
    hasParameter: true,
    category: "complex",
    crReference: "CR 702.62",
    expand: (parameter?: string) => {
      const timeCounters = parseInt(parameter ?? "0", 10);
      return [
        // Upkeep trigger: remove a time counter
        {
          abilityType: "triggered",
          trigger: {
            kind: "phase_trigger",
            phase: "beginning",
            step: "upkeep",
            player: "you",
          } as PhaseTrigger,
          effects: [
            {
              type: "remove_counter",
              attribute: {
                category: "counter",
                counterType: "time",
                quantity: 1,
              },
            },
          ],
          condition: {
            type: "if",
            predicate: "this card is suspended (in exile with time counters)",
          },
          speed: "instant" as const,
        } as TriggeredAbility,
        // Last counter trigger: cast without paying mana cost
        {
          abilityType: "triggered",
          trigger: {
            kind: "state_change",
            property: "counters",
            object: { types: [], quantity: "one", modifiers: [], self: true },
          } as StateChange,
          effects: [
            {
              type: "cast_without_paying",
              details: {
                gainsHaste: true,
                timeCounters,
              },
            },
          ],
          condition: {
            type: "if",
            predicate: "the last time counter was removed",
          },
          speed: "instant" as const,
        } as TriggeredAbility,
      ];
    },
  },
  {
    keyword: "cascade",
    hasParameter: false,
    category: "complex",
    crReference: "CR 702.85",
    expand: () => [
      {
        abilityType: "triggered",
        trigger: {
          kind: "player_action",
          action: "cast_spell",
          object: { types: [], quantity: "one", modifiers: [], self: true },
        } as PlayerAction,
        effects: [
          {
            type: "cascade",
            details: {
              description:
                "Exile cards from library top until you exile a nonland card with lesser MV. " +
                "You may cast it without paying its mana cost. " +
                "Put the rest on the bottom in random order.",
              isCast: true, // The cascaded card IS cast → triggers further "whenever you cast"
              canChain: true, // If found card has cascade, it cascades again
            },
          },
        ],
        condition: undefined,
        speed: "instant" as const,
      } as TriggeredAbility,
    ],
  },
  {
    keyword: "discover",
    hasParameter: true,
    category: "complex",
    crReference: "CR 702.165",
    expand: (parameter?: string) => [
      {
        abilityType: "triggered",
        trigger: {
          kind: "player_action",
          action: "cast_spell",
          object: { types: [], quantity: "one", modifiers: [], self: true },
        } as PlayerAction,
        effects: [
          {
            type: "discover",
            details: {
              maxMV: parameter,
              description:
                `Exile cards from library top until you exile a nonland card with MV ${parameter} or less. ` +
                "Cast it without paying its mana cost OR put it into your hand. " +
                "Put the rest on the bottom in random order.",
              castOptionIsCast: true,
              handOptionBreaksChain: true,
            },
          },
        ],
        condition: undefined,
        speed: "instant" as const,
      } as TriggeredAbility,
    ],
  },
  {
    keyword: "kicker",
    hasParameter: true,
    category: "complex",
    crReference: "CR 702.33",
    expand: (parameter?: string) => [
      {
        abilityType: "static",
        effects: [
          {
            type: "optional_additional_cost",
            details: {
              mechanic: "kicker",
              cost: parameter,
              description: `You may pay an additional ${parameter} as you cast this spell`,
              conditional: "If this spell was kicked",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "multikicker",
    hasParameter: true,
    category: "complex",
    crReference: "CR 702.33",
    expand: (parameter?: string) => [
      {
        abilityType: "static",
        effects: [
          {
            type: "optional_additional_cost",
            details: {
              mechanic: "multikicker",
              cost: parameter,
              repeatable: true,
              description: `You may pay an additional ${parameter} any number of times as you cast this spell`,
              conditional: "For each time this spell was kicked",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "eminence",
    hasParameter: false,
    category: "complex",
    crReference: "CR 702.14 (variant)",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "zone_ability",
            details: {
              functionsFrom: ["command", "battlefield"],
              description:
                "This ability functions from the command zone as well as the battlefield",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "partner",
    hasParameter: false,
    category: "complex",
    crReference: "CR 702.124",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "commander_multiplicity",
            details: {
              mechanic: "partner",
              description:
                "You can have two commanders if both have partner",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "initiative",
    hasParameter: false,
    category: "complex",
    crReference: "CR 702.172",
    expand: () => [
      // Take the initiative designation
      {
        abilityType: "static",
        effects: [
          {
            type: "designation",
            gameEffect: {
              category: "designation",
              designation: "initiative",
              isPermanent: false,
            },
          },
        ],
      } as StaticAbility,
      // Upkeep venture trigger
      {
        abilityType: "triggered",
        trigger: {
          kind: "phase_trigger",
          phase: "beginning",
          step: "upkeep",
          player: "you",
        } as PhaseTrigger,
        effects: [
          {
            type: "venture",
            details: { dungeon: "Undercity" },
          },
        ],
        condition: {
          type: "if",
          predicate: "you have the initiative",
        },
        speed: "instant" as const,
      } as TriggeredAbility,
    ],
  },

  // ─── Damage-Routing Keywords ───
  {
    keyword: "infect",
    hasParameter: false,
    category: "damage_routing",
    crReference: "CR 702.90",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "damage_routing",
            details: {
              toCreatures: "-1/-1 counters (not damage)",
              toPlayers: "poison counters (not life loss)",
              description:
                "Damage to creatures is dealt as -1/-1 counters. " +
                "Damage to players is dealt as poison counters. 10 poison = loss.",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "wither",
    hasParameter: false,
    category: "damage_routing",
    crReference: "CR 702.79",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "damage_routing",
            details: {
              toCreatures: "-1/-1 counters (not damage)",
              toPlayers: "normal damage",
              description:
                "Damage to creatures is dealt as -1/-1 counters. Normal damage to players.",
            },
          },
        ],
      } as StaticAbility,
    ],
  },

  // ─── Copy-Generation Keywords ───
  {
    keyword: "storm",
    hasParameter: false,
    category: "copy_generation",
    crReference: "CR 702.40",
    expand: () => [
      {
        abilityType: "triggered",
        trigger: {
          kind: "player_action",
          action: "cast_spell",
          object: { types: [], quantity: "one", modifiers: [], self: true },
        } as PlayerAction,
        effects: [
          {
            type: "create_copies",
            gameEffect: {
              category: "copy",
              copyType: "spell",
              castCopy: false, // Storm copies are NOT "cast"
            },
            details: {
              count: "storm_count",
              description:
                "Copy this spell for each other spell cast before it this turn. " +
                "Storm copies are NOT cast — they don't trigger 'whenever you cast'.",
            },
          },
        ],
        condition: undefined,
        speed: "instant" as const,
      } as TriggeredAbility,
    ],
  },
  {
    keyword: "replicate",
    hasParameter: true,
    category: "copy_generation",
    crReference: "CR 702.56",
    expand: (parameter?: string) => [
      {
        abilityType: "triggered",
        trigger: {
          kind: "player_action",
          action: "cast_spell",
          object: { types: [], quantity: "one", modifiers: [], self: true },
        } as PlayerAction,
        effects: [
          {
            type: "create_copies",
            gameEffect: {
              category: "copy",
              copyType: "spell",
              castCopy: false,
            },
            details: {
              cost: parameter,
              description: `Pay ${parameter} any number of times. Create that many copies.`,
            },
          },
        ],
        condition: undefined,
        speed: "instant" as const,
      } as TriggeredAbility,
    ],
  },
  {
    keyword: "cipher",
    hasParameter: false,
    category: "copy_generation",
    crReference: "CR 702.99",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "encode",
            details: {
              description:
                "Exile this spell card encoded on a creature you control. " +
                "Whenever that creature deals combat damage to a player, " +
                "you may cast a copy (IS cast → triggers cascade etc.).",
              castCopy: true,
            },
          },
        ],
      } as StaticAbility,
    ],
  },

  // ─── Counter-Interaction Keywords ───
  {
    keyword: "proliferate",
    hasParameter: false,
    category: "counter_interaction",
    crReference: "CR 701.27",
    expand: () => [
      {
        abilityType: "static", // Modeled as an effect type, not a keyword ability
        effects: [
          {
            type: "proliferate",
            details: {
              description:
                "Choose any number of permanents and/or players with counters. " +
                "Add one counter of each kind already there. " +
                "Interacts with: +1/+1, loyalty, poison, experience, energy, lore, charge.",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "adapt",
    hasParameter: true,
    category: "counter_interaction",
    crReference: "CR 702.139",
    expand: (parameter?: string) => {
      const n = parseInt(parameter ?? "1", 10);
      return [
        {
          abilityType: "activated",
          costs: [],
          effects: [
            {
              type: "put_counters",
              attribute: {
                category: "counter",
                counterType: "+1/+1",
                quantity: n,
              },
            },
          ],
          condition: {
            type: "if",
            predicate: "this creature has no +1/+1 counters on it",
          },
          speed: "sorcery" as Speed,
        } as ActivatedAbility,
      ];
    },
  },
  {
    keyword: "evolve",
    hasParameter: false,
    category: "counter_interaction",
    crReference: "CR 702.100",
    expand: () => [
      {
        abilityType: "triggered",
        trigger: {
          kind: "zone_transition",
          to: "battlefield",
          object: creatureRef("you"),
        } as ZoneTransition,
        effects: [
          {
            type: "put_counters",
            attribute: {
              category: "counter",
              counterType: "+1/+1",
              quantity: 1,
            },
          },
        ],
        condition: {
          type: "if",
          predicate:
            "the entering creature has greater power or toughness than this creature",
        },
        speed: "instant" as const,
      } as TriggeredAbility,
    ],
  },
  {
    keyword: "undying",
    hasParameter: false,
    category: "complex",
    crReference: "CR 702.93",
    expand: () => [
      {
        abilityType: "triggered",
        trigger: {
          kind: "zone_transition",
          from: "battlefield",
          to: "graveyard",
          object: { types: [], quantity: "one", modifiers: [], self: true },
          cause: "dies",
        } as ZoneTransition,
        effects: [
          {
            type: "return",
            gameEffect: {
              category: "return",
              target: { types: [], quantity: "one", modifiers: [], self: true },
              from: "graveyard",
              to: "battlefield",
            },
          },
          {
            type: "put_counter",
            attribute: {
              category: "counter",
              counterType: "+1/+1",
              quantity: 1,
            },
          },
        ],
        condition: {
          type: "if",
          predicate: "it had no +1/+1 counters on it",
        },
        speed: "instant" as const,
      } as TriggeredAbility,
    ],
  },
  {
    keyword: "persist",
    hasParameter: false,
    category: "complex",
    crReference: "CR 702.79",
    expand: () => [
      {
        abilityType: "triggered",
        trigger: {
          kind: "zone_transition",
          from: "battlefield",
          to: "graveyard",
          object: { types: [], quantity: "one", modifiers: [], self: true },
          cause: "dies",
        } as ZoneTransition,
        effects: [
          {
            type: "return",
            gameEffect: {
              category: "return",
              target: { types: [], quantity: "one", modifiers: [], self: true },
              from: "graveyard",
              to: "battlefield",
            },
          },
          {
            type: "put_counter",
            attribute: {
              category: "counter",
              counterType: "-1/-1",
              quantity: 1,
            },
          },
        ],
        condition: {
          type: "if",
          predicate: "it had no -1/-1 counters on it",
        },
        speed: "instant" as const,
      } as TriggeredAbility,
    ],
  },

  // ─── Alternative Casting Keywords ───
  {
    keyword: "evoke",
    hasParameter: true,
    category: "alternative_casting",
    crReference: "CR 702.74",
    expand: (parameter?: string) => [
      {
        abilityType: "static",
        effects: [
          {
            type: "alternative_cost",
            details: {
              mechanic: "evoke",
              cost: parameter,
              description: `You may cast this for ${parameter}. If you do, sacrifice it when it enters.`,
              mandatorySacrifice: true,
              etbStillTriggers: true,
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "ninjutsu",
    hasParameter: true,
    category: "alternative_casting",
    crReference: "CR 702.49",
    expand: (parameter?: string) => [
      {
        abilityType: "activated",
        costs: [
          { costType: "mana", mana: parameter ?? "" } as ManaCostUnit,
        ],
        effects: [
          {
            type: "ninjutsu",
            details: {
              description:
                `Pay ${parameter}, return an unblocked attacking creature to hand: ` +
                "Put this card onto the battlefield tapped and attacking.",
            },
          },
        ],
        condition: undefined,
        speed: "instant" as Speed,
      } as ActivatedAbility,
    ],
  },
  {
    keyword: "dash",
    hasParameter: true,
    category: "alternative_casting",
    crReference: "CR 702.109",
    expand: (parameter?: string) => [
      {
        abilityType: "static",
        effects: [
          {
            type: "alternative_cost",
            details: {
              mechanic: "dash",
              cost: parameter,
              description: `You may cast this for ${parameter}. If you do, it gains haste and returns to hand at end step.`,
              gainsHaste: true,
              returnToHandAtEndStep: true,
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "bestow",
    hasParameter: true,
    category: "alternative_casting",
    crReference: "CR 702.103",
    expand: (parameter?: string) => [
      {
        abilityType: "static",
        effects: [
          {
            type: "alternative_cost",
            details: {
              mechanic: "bestow",
              cost: parameter,
              description:
                `You may cast this as an Aura for ${parameter}. ` +
                "If enchanted creature leaves, this becomes a creature.",
              castsAsAura: true,
              falloffBecomesCreature: true,
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "overload",
    hasParameter: true,
    category: "alternative_casting",
    crReference: "CR 702.96",
    expand: (parameter?: string) => [
      {
        abilityType: "static",
        effects: [
          {
            type: "alternative_cost",
            details: {
              mechanic: "overload",
              cost: parameter,
              description: `You may cast this for ${parameter}. If you do, replace "target" with "each" in the text.`,
              replacesTargetWithEach: true,
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "mutate",
    hasParameter: true,
    category: "alternative_casting",
    crReference: "CR 702.140",
    expand: (parameter?: string) => [
      {
        abilityType: "static",
        effects: [
          {
            type: "alternative_cost",
            details: {
              mechanic: "mutate",
              cost: parameter,
              description:
                `Pay ${parameter} to cast targeting a non-Human creature you own. ` +
                "Merge over or under — top has characteristics, all abilities accumulate.",
            },
          },
        ],
      } as StaticAbility,
    ],
  },

  // ─── Trigger-Pattern Keywords ───
  {
    keyword: "landfall",
    hasParameter: false,
    category: "trigger_pattern",
    crReference: "CR 702 (informal)",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "trigger_pattern",
            details: {
              triggerEvent: "land enters the battlefield under your control",
              primitiveEvent: {
                kind: "zone_transition",
                to: "battlefield",
                object: { types: ["land"], quantity: "one", modifiers: [], controller: "you" },
              },
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "constellation",
    hasParameter: false,
    category: "trigger_pattern",
    crReference: "CR 702 (informal)",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "trigger_pattern",
            details: {
              triggerEvent: "enchantment enters the battlefield under your control",
              primitiveEvent: {
                kind: "zone_transition",
                to: "battlefield",
                object: { types: ["enchantment"], quantity: "one", modifiers: [], controller: "you" },
              },
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "alliance",
    hasParameter: false,
    category: "trigger_pattern",
    crReference: "CR 702 (informal)",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "trigger_pattern",
            details: {
              triggerEvent: "creature enters the battlefield under your control",
              primitiveEvent: {
                kind: "zone_transition",
                to: "battlefield",
                object: { types: ["creature"], quantity: "one", modifiers: [], controller: "you" },
              },
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "magecraft",
    hasParameter: false,
    category: "trigger_pattern",
    crReference: "CR 702 (informal)",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "trigger_pattern",
            details: {
              triggerEvent: "you cast or copy an instant or sorcery spell",
              primitiveEvent: {
                kind: "player_action",
                action: "cast_spell",
                object: { types: ["instant", "sorcery"], quantity: "one", modifiers: [] },
              },
            },
          },
        ],
      } as StaticAbility,
    ],
  },

  // ─── Maintenance Keywords ───
  {
    keyword: "cumulative upkeep",
    hasParameter: true,
    category: "maintenance",
    crReference: "CR 702.24",
    expand: (parameter?: string) => [
      {
        abilityType: "triggered",
        trigger: {
          kind: "phase_trigger",
          phase: "beginning",
          step: "upkeep",
          player: "you",
        } as PhaseTrigger,
        effects: [
          {
            type: "cumulative_upkeep",
            details: {
              addAgeCounter: true,
              costPerCounter: parameter,
              sacrificeIfNotPaid: true,
              description: `Add an age counter, then pay ${parameter} for each age counter or sacrifice.`,
            },
          },
        ],
        condition: undefined,
        speed: "instant" as const,
      } as TriggeredAbility,
    ],
  },
  {
    keyword: "echo",
    hasParameter: true,
    category: "maintenance",
    crReference: "CR 702.30",
    expand: (parameter?: string) => [
      {
        abilityType: "triggered",
        trigger: {
          kind: "phase_trigger",
          phase: "beginning",
          step: "upkeep",
          player: "you",
        } as PhaseTrigger,
        effects: [
          {
            type: "echo",
            details: {
              cost: parameter,
              sacrificeIfNotPaid: true,
              description: `At the beginning of your upkeep, pay ${parameter} or sacrifice. Only triggers once (first upkeep after ETB).`,
            },
          },
        ],
        condition: {
          type: "if",
          predicate: "this permanent entered the battlefield since your last upkeep",
        },
        speed: "instant" as const,
      } as TriggeredAbility,
    ],
  },

  // ─── Attachment Keywords ───
  {
    keyword: "equip",
    hasParameter: true,
    category: "attachment",
    crReference: "CR 702.6",
    expand: (parameter?: string) => [
      {
        abilityType: "activated",
        costs: [{ costType: "mana", mana: parameter ?? "" } as ManaCostUnit],
        effects: [
          {
            type: "attach",
            details: {
              attachmentType: "equipment",
              target: "creature you control",
              description: `Attach to target creature you control. Equip only as a sorcery.`,
            },
          },
        ],
        condition: undefined,
        speed: "sorcery" as Speed,
      } as ActivatedAbility,
    ],
  },
  {
    keyword: "reconfigure",
    hasParameter: true,
    category: "attachment",
    crReference: "CR 702.151",
    expand: (parameter?: string) => [
      {
        abilityType: "activated",
        costs: [{ costType: "mana", mana: parameter ?? "" } as ManaCostUnit],
        effects: [
          {
            type: "attach",
            details: {
              attachmentType: "equipment",
              description:
                `Pay ${parameter}: Attach to target creature you control (loses creature type while attached). ` +
                "Or unattach (becomes Equipment creature again).",
              losesCreatureWhileAttached: true,
            },
          },
        ],
        condition: undefined,
        speed: "sorcery" as Speed,
      } as ActivatedAbility,
    ],
  },
  {
    keyword: "living weapon",
    hasParameter: false,
    category: "attachment",
    crReference: "CR 702.92",
    expand: () => [
      {
        abilityType: "triggered",
        trigger: {
          kind: "zone_transition",
          to: "battlefield",
          object: { types: [], quantity: "one", modifiers: [], self: true },
        } as ZoneTransition,
        effects: [
          {
            type: "create_token_and_attach",
            gameEffect: {
              category: "create_token",
              token: {
                types: ["creature"],
                subtypes: ["Phyrexian", "Germ"],
                power: 0,
                toughness: 0,
                colors: ["B"],
              },
              quantity: 1,
            },
            details: {
              attachToToken: true,
            },
          },
        ],
        condition: undefined,
        speed: "instant" as const,
      } as TriggeredAbility,
    ],
  },

  // ─── Resource Token Keywords ───
  {
    keyword: "treasure",
    hasParameter: false,
    category: "resource_token",
    crReference: "CR 111.10",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "token_definition",
            details: {
              tokenType: "Treasure",
              types: ["artifact"],
              subtypes: ["Treasure"],
              ability: "{T}, Sacrifice this artifact: Add one mana of any color.",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "food",
    hasParameter: false,
    category: "resource_token",
    crReference: "CR 111.10",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "token_definition",
            details: {
              tokenType: "Food",
              types: ["artifact"],
              subtypes: ["Food"],
              ability: "{2}, {T}, Sacrifice this artifact: You gain 3 life.",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "clue",
    hasParameter: false,
    category: "resource_token",
    crReference: "CR 111.10",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "token_definition",
            details: {
              tokenType: "Clue",
              types: ["artifact"],
              subtypes: ["Clue"],
              ability: "{2}, Sacrifice this artifact: Draw a card.",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "blood",
    hasParameter: false,
    category: "resource_token",
    crReference: "CR 111.10",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "token_definition",
            details: {
              tokenType: "Blood",
              types: ["artifact"],
              subtypes: ["Blood"],
              ability:
                "{1}, {T}, Discard a card, Sacrifice this artifact: Draw a card.",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "map",
    hasParameter: false,
    category: "resource_token",
    crReference: "CR 111.10",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "token_definition",
            details: {
              tokenType: "Map",
              types: ["artifact"],
              subtypes: ["Map"],
              ability:
                "{1}, {T}, Sacrifice this artifact: Target creature you control explores.",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
  {
    keyword: "powerstone",
    hasParameter: false,
    category: "resource_token",
    crReference: "CR 111.10",
    expand: () => [
      {
        abilityType: "static",
        effects: [
          {
            type: "token_definition",
            details: {
              tokenType: "Powerstone",
              types: ["artifact"],
              subtypes: ["Powerstone"],
              ability:
                "{T}: Add {C}. This mana can't be spent to cast nonartifact spells.",
            },
          },
        ],
      } as StaticAbility,
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
// LOOKUP FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Look up a keyword by name (case-insensitive).
 */
export function lookupKeyword(keyword: string): KeywordEntry | undefined {
  return KEYWORD_DATABASE.find(
    (entry) => entry.keyword.toLowerCase() === keyword.toLowerCase()
  );
}

/**
 * Expand a keyword into its structured ability nodes.
 * Returns undefined if the keyword is not in the database.
 */
export function expandKeyword(
  keyword: string,
  parameter?: string,
  cardName?: string
): AbilityNode[] | undefined {
  const entry = lookupKeyword(keyword);
  if (!entry) return undefined;
  return entry.expand(parameter, cardName);
}

/**
 * Get all keywords in a specific category.
 */
export function getKeywordsByCategory(
  category: KeywordCategory
): KeywordEntry[] {
  return KEYWORD_DATABASE.filter((entry) => entry.category === category);
}

/**
 * Check if a keyword exists in the database.
 */
export function hasKeyword(keyword: string): boolean {
  return lookupKeyword(keyword) !== undefined;
}

/**
 * Get all keyword names in the database.
 */
export function getAllKeywordNames(): string[] {
  return KEYWORD_DATABASE.map((entry) => entry.keyword);
}
