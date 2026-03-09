/**
 * MTG Rules Types — Stack, Layers, Priority, Timing, and State-Based Actions
 *
 * Phase 1 defines the type system. Future phases implement simulation
 * modules (stack.ts, layers.ts, state-based.ts).
 */

import type { GameObjectRef, Controller, Zone } from "../game-model";

// ─── Timing & Speed ───
/** instant: can be played any time you have priority
 *  sorcery: only during your main phase with empty stack
 *  mana_ability: doesn't use the stack at all (CR 605) */
export type Speed = "instant" | "sorcery" | "mana_ability";

// ─── Phases & Steps ───
export type Phase =
  | "beginning"
  | "precombat_main"
  | "combat"
  | "postcombat_main"
  | "ending";

export type Step =
  // Beginning phase
  | "untap"
  | "upkeep"
  | "draw"
  // Combat phase
  | "beginning_of_combat"
  | "declare_attackers"
  | "declare_blockers"
  | "combat_damage"
  | "end_of_combat"
  // Ending phase
  | "end"
  | "cleanup";

// ─── Layers (Comprehensive Rules 613) ───
// The 7-layer system determines how continuous effects interact.
// Effects in earlier layers are applied first.
export enum Layer {
  Copy = 1, // copy effects
  Control = 2, // control-changing effects
  Text = 3, // text-changing effects
  Type = 4, // type-changing effects
  Color = 5, // color-changing effects
  Ability = 6, // ability adding/removing effects
  PowerToughness = 7, // P/T setting and modifications
}

// Sub-layers within Layer 7 (CR 613.4)
export enum PTSublayer {
  /** Effects that set P/T to specific values */
  Characteristic = "7a",
  /** Effects that modify P/T (+1/+1, etc.) */
  Modification = "7b",
  /** +1/+1 and -1/-1 counters */
  CounterMod = "7c",
  /** Effects that switch P/T */
  Switch = "7d",
}

// ─── Continuous Effects ───
export interface ContinuousEffect {
  source: string;
  layer: Layer;
  sublayer?: PTSublayer;
  /** For ordering within same layer (CR 613.7) */
  timestamp: number;
  affectedObjects: GameObjectRef;
  modification: string;
}

// ─── Stack ───
export interface StackItem {
  source: string;
  abilityType: "spell" | "activated" | "triggered";
  speed: Speed;
  targets?: GameObjectRef[];
  // Effects are defined in the main types.ts
}

// ─── Priority ───
export interface PriorityState {
  activePlayer: Controller;
  phase: Phase;
  step?: Step;
  stackEmpty: boolean;
}

// ─── State-Based Actions (Comprehensive Rules 704) ───
// SBAs are checked whenever a player would receive priority.
// They explain HOW certain game states cause zone transitions that
// aren't directly caused by spells or abilities.

export interface StateBasedAction {
  id: string;
  /** Comprehensive rules reference */
  rule: string;
  /** Description of what triggers this SBA */
  check: string;
  /** The event it causes (usually a ZoneTransition) */
  consequenceDescription: string;
  /** How this affects interaction detection */
  interactionNote: string;
}

/**
 * State-based action definitions used by the engine to understand
 * indirect event paths. E.g., -X/-X effects cause deaths via SBA,
 * not via "destroy".
 */
export const STATE_BASED_ACTIONS: StateBasedAction[] = [
  {
    id: "zero_life",
    rule: "704.5a",
    check: "Player with 0 or less life",
    consequenceDescription: "Player loses the game",
    interactionNote:
      "Life drain combos win through this SBA. Platinum Angel prevents it.",
  },
  {
    id: "zero_toughness",
    rule: "704.5d",
    check: "Creature with 0 or less toughness",
    consequenceDescription:
      "Creature is put into its owner's graveyard (not destroyed)",
    interactionNote:
      "Indestructible does NOT save from 0 toughness. " +
      "Elesh Norn + death triggers: -2/-2 kills X/2 creatures → death triggers fire. " +
      "Coat of Arms removal may cascade: removing creatures shrinks others → more deaths.",
  },
  {
    id: "lethal_damage",
    rule: "704.5e",
    check: "Creature with damage >= toughness",
    consequenceDescription: "Creature is destroyed",
    interactionNote:
      "Indestructible DOES save from lethal damage. " +
      "Damage stays marked until cleanup step.",
  },
  {
    id: "deathtouch_damage",
    rule: "704.5f",
    check: "Creature dealt damage by a source with deathtouch",
    consequenceDescription: "Creature is destroyed (any amount = lethal)",
    interactionNote:
      "Even 1 damage from deathtouch source = lethal. " +
      "Indestructible saves. Trample + deathtouch: 1 damage to creature, rest to player.",
  },
  {
    id: "planeswalker_loyalty",
    rule: "704.5j",
    check: "Planeswalker with 0 loyalty",
    consequenceDescription:
      "Planeswalker is put into its owner's graveyard",
    interactionNote:
      "Activating a -X ability can trigger this. " +
      "Proliferate can add loyalty to prevent it. " +
      "Not 'destroyed' — indestructible PWs still die to 0 loyalty.",
  },
  {
    id: "legend_rule",
    rule: "704.5k",
    check:
      "Player controls two or more legendary permanents with the same name",
    consequenceDescription:
      "Owner chooses one, rest are put into graveyard (not destroyed)",
    interactionNote:
      "Clone + legendary = SBA puts one to GY → death triggers fire. " +
      "Indestructible doesn't help. " +
      "Sakashima variants bypass with name-change effects.",
  },
  {
    id: "counter_annihilation",
    rule: "704.5q",
    check:
      "Permanent has both +1/+1 and -1/-1 counters",
    consequenceDescription:
      "Remove pairs until only one type remains",
    interactionNote:
      "Undying (+1/+1 on return) + persist (-1/-1 on return) = " +
      "counters annihilate → creature can die again → infinite loop with sac outlet. " +
      "Also relevant for Hapatra/Mikaeus interactions.",
  },
  {
    id: "unattached_aura",
    rule: "704.5m",
    check: "Aura not attached to anything, or attached to illegal object",
    consequenceDescription:
      "Aura is put into its owner's graveyard",
    interactionNote:
      "Enchanted creature dies → Aura falls off → Aura goes to GY → " +
      "may trigger constellation/enchantress effects in reverse. " +
      "Totem armor: Aura is destroyed instead of enchanted permanent.",
  },
  {
    id: "token_cleanup",
    rule: "704.6",
    check: "Token not on the battlefield",
    consequenceDescription: "Token ceases to exist",
    interactionNote:
      "Tokens DO 'die' and trigger death triggers (Blood Artist). " +
      "After triggers resolve, the token ceases to exist in the graveyard. " +
      "Engine must process: (1) death triggers fire, (2) SBA → token gone.",
  },
];
