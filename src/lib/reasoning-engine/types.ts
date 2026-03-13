/**
 * Reasoning Engine Types
 *
 * Effect polarity classification, target intent inference,
 * and deck context override types for the synergy reasoning layer.
 */

import type { AbilityNode, Effect } from "../interaction-engine/types";

// ─── Effect Polarity ───
// Whether an effect is good or bad for the target's controller

export type EffectPolarity = "beneficial" | "harmful" | "neutral" | "contextual";

// ─── Target Intent ───
// Who the effect is strategically intended to target

export type TargetIntent = "self" | "opponent" | "either" | "cost";

// ─── Effect Category ───
// What the effect fundamentally does (for polarity reasoning)

export type EffectCategory =
  | "stat_buff"         // +N/+N, +N/+0, +0/+N
  | "stat_debuff"       // -N/-N, -N/-0, -0/-N, +N/-N (mixed with net negative toughness)
  | "keyword_grant"     // gains flying, hexproof, etc.
  | "removal_destroy"   // destroy target
  | "removal_exile"     // exile target
  | "removal_bounce"    // return to hand (opponent's)
  | "removal_damage"    // deals N damage to target creature
  | "board_wipe"        // destroy/exile all
  | "token_creation"    // create tokens
  | "card_draw"         // draw cards
  | "life_gain"         // you gain life
  | "life_loss"         // target player loses life
  | "counter_positive"  // +1/+1 counters, charge counters
  | "counter_negative"  // -1/-1 counters
  | "sacrifice"         // sacrifice as cost or effect
  | "discard"           // discard cards
  | "mill"              // mill cards
  | "reanimate"         // return from graveyard to battlefield
  | "protection"        // hexproof, indestructible, ward
  | "mana_production"   // add mana
  | "copy"              // copy spell/permanent
  | "control_change"    // gain control of target
  | "other";            // unclassified

// ─── Annotated Effect ───
// An effect from a CardProfile with polarity and intent classification

export interface AnnotatedEffect {
  /** Index of the ability in CardProfile.abilities */
  abilityIndex: number;
  /** The original effect from the interaction engine */
  effect: Effect;
  /** What this effect does */
  effectCategory: EffectCategory;
  /** Is this good or bad for the target? */
  polarity: EffectPolarity;
  /** Who should this target? */
  targetIntent: TargetIntent;
  /** How confident are we in the intent classification (0-1) */
  confidence: number;
  /** Is this effect part of an ability's cost? */
  isCostEffect: boolean;
  /** Can deck context change the intent? */
  contextOverridable: boolean;
  /** Human-readable explanation */
  reasoning: string;
}

// ─── Card Intent Summary ───
// Summarized intent for a single card, used during synergy pair generation

export interface CardIntentSummary {
  cardName: string;
  /** All classified effects */
  effects: AnnotatedEffect[];
  /**
   * Per-axis intent summary: for each synergy axis this card participates in,
   * what is the dominant target intent?
   * "self" = card's contributions to this axis are self-beneficial
   * "opponent" = card's contributions are opponent-directed (removal, -X/-X)
   * "both" = card has both self and opponent contributions on this axis
   */
  axisIntent: Record<string, TargetIntent>;
  /** Which abilities are modal? If so, track per-mode intents */
  hasModalAbilities: boolean;
}

// ─── Deck Reasoning Context ───
// Deck-level signals that can override individual effect intents

export interface DeckReasoningContext {
  /** Deck has creatures with death triggers (Blood Artist, Zulaport Cutthroat) */
  hasDeathTriggers: boolean;
  /** Deck has graveyard strategy (reanimate, flashback, delve) */
  hasGraveyardSynergy: boolean;
  /** Deck has 2+ cards with Madness keyword */
  hasMadnessPayoffs: boolean;
  /** Deck has Enrage or "whenever dealt damage" triggers */
  hasEnragePayoffs: boolean;
  /** Deck has creatures with Indestructible */
  hasIndestructible: boolean;
  /** Deck has creatures with Persist or Undying */
  hasPersistUndying: boolean;
  /** Active synergy axes (axes with 2+ cards above threshold) */
  activeAxes: Set<string>;
}

// ─── Intent Override ───
// A context-based override that changes an effect's target intent

export interface IntentOverride {
  /** Which effect category is being overridden */
  effectCategory: EffectCategory;
  /** Original intent before override */
  originalIntent: TargetIntent;
  /** New intent after override */
  overriddenIntent: TargetIntent;
  /** Why the override was applied */
  reason: string;
}

// ─── Synergy Analysis Options ───
// Options passed to analyzeDeckSynergy

export interface SynergyAnalysisOptions {
  /** Enable reasoning engine for intent-aware synergy filtering */
  reasoning?: boolean;
}
