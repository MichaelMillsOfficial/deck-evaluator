/**
 * Interaction Engine Types
 *
 * All event types, resources, effects, ability AST nodes, card profiles,
 * and interaction types for the oracle text compiler.
 */

import type {
  CardType,
  Supertype,
  Subtype,
  Controller,
  Zone,
  GameObjectRef,
  RefModifier,
  AttachmentType,
} from "./game-model";
import type { Speed, Layer, Phase, Step } from "./rules/types";

// Re-export game-model types so internal modules can import from a single source
export type {
  CardType,
  Supertype,
  Subtype,
  Controller,
  Zone,
  GameObjectRef,
  RefModifier,
  AttachmentType,
} from "./game-model";

// ═══════════════════════════════════════════════════════════════════
// EVENTS — Primitive event types built from zone transitions and
// state changes. All higher-level game events derive from these.
// ═══════════════════════════════════════════════════════════════════

// ─── Zone Transition ───
// An object moves between zones. This is the fundamental building block.
// "Dies" = { from: "battlefield", to: "graveyard" } for a permanent
// "ETB"  = { to: "battlefield" }
// "Cast" = { to: "stack" }
export interface ZoneTransition {
  kind: "zone_transition";
  /** undefined = any zone (or newly created, e.g. tokens) */
  from?: Zone;
  /** undefined = any destination (e.g., LTB triggers fire regardless of where the object goes) */
  to?: Zone;
  object: GameObjectRef;
  /** "sacrifice", "destroy", "exile", "mill", "discard", "cast" */
  cause?: string;
  /** Which card performed this action (for source tracking) */
  source?: string;
}

// ─── State Change ───
// A property on an object or player changes
export interface StateChange {
  kind: "state_change";
  property: StateProperty;
  /** If on an object (counters, tap state, etc.) */
  object?: GameObjectRef;
  /** If on a player (life total, etc.) */
  player?: Controller;
  /** How much changed (+1, -3, etc.) */
  delta?: number | string;
}

export type StateProperty =
  | "tapped"
  | "counters"
  | "life_total"
  | "phase"
  | "power"
  | "toughness"
  | "controller"
  | "transformed"
  | "face"
  | "mana_pool"
  | "phased"; // Phasing does NOT cause zone transitions (CR 702.26d)

// ─── Player Action ───
// Things a player actively decides to do
export interface PlayerAction {
  kind: "player_action";
  action: PlayerActionType;
  object?: GameObjectRef;
  /**
   * Zone-of-origin: where was this spell cast FROM?
   * Critical for: Rebound (cast from hand), Escape (cast from GY),
   * Flashback (exile after resolution if cast from GY),
   * Bolas's Citadel (cast from library top → pay life = MV)
   */
  castFrom?: Zone;
  details?: Record<string, unknown>;
}

export type PlayerActionType =
  | "cast_spell"
  | "activate_ability"
  | "play_land"
  | "play_from_zone"
  | "declare_attacker"
  | "declare_blocker"
  | "pay_cost"
  | "sacrifice" // CR 701.17a — distinct from the zone transition it causes
  | "search_library" // CR 701.19
  | "shuffle_library" // CR 701.20
  | "venture" // CR 309 — venture into the dungeon
  | "draw" // CR 120 — "whenever you draw a card"
  | "discard" // CR 701.8 — "whenever you discard a card"
  | "attack" // "whenever you attack" / "whenever one or more creatures attack"
  | "mill" // "whenever you mill"
  | "create_token" // "whenever you create a token"
  | "gain_life" // "whenever you gain life"
  | "lose_life"; // "whenever you lose life"

// ─── Phase Trigger ───
// "At the beginning of your upkeep"
export interface PhaseTrigger {
  kind: "phase_trigger";
  phase: Phase;
  step: Step;
  /** "your" upkeep vs "each player's" vs "each opponent's" */
  player?: Controller;
}

// ─── Damage Event ───
// Damage is both an effect AND a triggerable event.
// Without this, Niv-Mizzet + Curiosity is undetectable.
export interface DamageEvent {
  kind: "damage";
  source: GameObjectRef;
  target: GameObjectRef | Controller;
  quantity: number | "X";
  isCombatDamage: boolean;
}

// ─── Target Event ───
// "Whenever ~ becomes the target of a spell or ability" (CR 115.10)
// Needed for: Heroic triggers, Feather, hexproof/shroud/ward modeling
export interface TargetEvent {
  kind: "target";
  targetObject: GameObjectRef;
  sourceSpellOrAbility: GameObjectRef;
  controller: Controller;
}

// ─── Attachment Event ───
// Attach/detach for auras, equipment, fortifications
export interface AttachmentEvent {
  kind: "attachment";
  action: "attach" | "detach";
  attachedObject: GameObjectRef;
  attachedTo?: GameObjectRef;
  cause?: "sba" | "equip" | "aura_cast" | "reconfigure" | "bestow_falloff";
}

// ─── Game Event Union ───
export type GameEvent =
  | ZoneTransition
  | StateChange
  | PlayerAction
  | PhaseTrigger
  | DamageEvent
  | TargetEvent
  | AttachmentEvent;

// ═══════════════════════════════════════════════════════════════════
// RESOURCES — Player resources, object attributes, and game effects
// ═══════════════════════════════════════════════════════════════════

// ─── Player Resources ───
export interface ManaResource {
  category: "mana";
  color: "W" | "U" | "B" | "R" | "G" | "C" | "any";
  quantity: number | "X";
}

export interface LifeResource {
  category: "life";
  quantity: number | "X";
}

export interface CardsResource {
  category: "cards";
  quantity: number | "X";
  zone?: Zone;
}

export type PlayerResource = ManaResource | LifeResource | CardsResource;

// ─── Object Attributes ───
export interface CounterAttribute {
  category: "counter";
  counterType: string; // "+1/+1", "-1/-1", "charge", "loyalty", "shield", etc.
  quantity: number | "X";
}

export interface StatModification {
  category: "stat_mod";
  power: number | string;
  toughness: number | string;
}

export interface KeywordGrant {
  category: "keyword_grant";
  keyword: string;
}

export type ObjectAttribute =
  | CounterAttribute
  | StatModification
  | KeywordGrant;

// ─── Variable Quantities ───
export interface VariableQuantity {
  variable: true;
  countOf:
    | GameObjectRef
    | "cards_in_hand"
    | "life_total"
    | "power"
    | "toughness"
    | "creatures_controlled"
    | "permanents_controlled"
    | "devotion";
  whose?: Controller;
  multiplier?: number;
}

// ─── Token Definition ───
export interface TokenDefinition {
  types: CardType[];
  subtypes?: Subtype[];
  power?: number;
  toughness?: number;
  colors?: string[];
  keywords?: string[];
  name?: string;
}

// ─── Emblem ───
// CR 114 — Emblems exist in the command zone, cannot be interacted with,
// and have permanent effects for the rest of the game.
export interface Emblem {
  source: string;
  abilities: AbilityNode[];
}

// ─── Dungeon ───
// CR 309 — Dungeons exist in the command zone, players progress room by room.
export interface DungeonRoom {
  name: string;
  effect: Effect[];
  /** Names of rooms you can advance to (branching paths) */
  nextRooms: string[];
}

export interface Dungeon {
  name: string;
  rooms: DungeonRoom[];
  firstRoom: string;
  /** Names of rooms that complete the dungeon */
  finalRooms: string[];
}

// ═══════════════════════════════════════════════════════════════════
// GAME EFFECTS — Actions that happen as part of ability resolution
// ═══════════════════════════════════════════════════════════════════

export interface DamageEffect {
  category: "damage";
  quantity: number | "X";
  target: GameObjectRef | Controller;
  source?: GameObjectRef;
}

export interface CreateTokenEffect {
  category: "create_token";
  token: TokenDefinition;
  quantity: number | "X";
}

export interface DestroyEffect {
  category: "destroy";
  target: GameObjectRef;
}

export interface ExileEffect {
  category: "exile";
  target: GameObjectRef;
  from?: Zone;
}

export interface ReturnEffect {
  category: "return";
  target: GameObjectRef;
  from: Zone;
  to: Zone;
}

// ─── Restriction Effects ───
// "Can't" effects (CR 101.2) — ABSOLUTE, override "can" effects.
export interface RestrictionEffect {
  category: "restriction";
  restricts:
    | "attack"
    | "block"
    | "cast"
    | "activate"
    | "gain_life"
    | "search_library"
    | "draw"
    | "untap"
    | "play_land"
    | "enter_battlefield"
    | "lose_game"
    | "win_game"
    | "prevent_damage"
    | "counter";
  target: GameObjectRef | Controller;
  exception?: Condition;
  /** "from outside your hand" (Drannith), "more than one card each turn" (Narset) */
  scope?: string;
}

// ─── Copy Effects ───
export interface CopyEffect {
  category: "copy";
  target?: GameObjectRef;
  namedCard?: string;
  copyType: "spell" | "permanent" | "token" | "named_card";
  modifications?: Effect[];
  quantity?: number | "X";
  /** If true, the copy is "cast" → triggers "whenever you cast" */
  castCopy?: boolean;
}

// ─── Zone-Casting Permissions ───
export interface ZoneCastPermission {
  category: "zone_cast_permission";
  fromZone: Zone;
  position?: "top" | "any";
  cardFilter?: GameObjectRef;
  alternativeCost?: Cost[] | "pay_life_equal_to_mv";
  grantedAbility?: string;
  controller?: Controller;
}

// ─── Game Designations ───
export interface GameDesignation {
  category: "designation";
  designation: "city_blessing" | "monarch" | "initiative" | "day_night";
  isPermanent: boolean;
  acquireCondition?: Condition;
  triggers?: GameEvent[];
  loseCondition?: GameEvent;
}

// ─── Player Counters ───
export interface PlayerCounterEffect {
  category: "player_counter";
  counterType: "poison" | "experience" | "energy" | "rad" | "ticket";
  quantity: number | "X" | VariableQuantity;
  target: Controller;
  winLossCondition?: {
    threshold: number;
    result: "win" | "lose";
  };
}

// ─── Extra Phases ───
export interface ExtraPhaseEffect {
  category: "extra_phase";
  phase?: Phase;
  step?: Step;
  quantity?: number | "X" | VariableQuantity;
}

// ─── Win Conditions ───
export interface WinConditionEffect {
  category: "win_condition";
  type: "win" | "lose";
  target: Controller;
  condition?: Condition;
  gameMemory?: {
    tracks: string;
    threshold?: number;
  };
}

// ─── Type-Changing Effects ───
// Layer 4 static effects that modify card types.
export interface TypeChangeEffect {
  category: "type_change";
  target: GameObjectRef;
  addTypes?: (CardType | Subtype)[];
  removeTypes?: (CardType | Subtype)[];
  /** Maskwood Nexus: every creature type */
  setAllCreatureTypes?: boolean;
  /** "choose a creature type" at ETB */
  chooseType?: boolean;
  /** Maskwood: also applies to non-battlefield creature cards */
  appliesToZones?: Zone[];
}

// ─── Extra Turn Effects ───
export interface ExtraTurnEffect {
  category: "extra_turn";
  player: Controller;
  quantity: number | "X";
  skipPhases?: Phase[];
  /** Nexus of Fate shuffles back into library */
  selfRecurring?: boolean;
}

// ─── Player Control Effects ───
// Mindslaver and Emrakul: "You control target player during their next turn."
// CR 720: distinct from controlling an OBJECT (Layer 2).
export interface PlayerControlEffect {
  category: "player_control";
  target: Controller;
  controller: Controller;
  duration: EffectDuration;
}

// ─── Cost Substitution Effects ───
// K'rrik: {B} → 2 life. Defiler of Faith: {W} → 2 life for white permanent spells.
// These are global static effects modifying OTHER cards' costs.
export interface CostSubstitutionEffect {
  category: "cost_substitution";
  /** Mana symbol being replaced: "W", "B", etc. */
  replacesSymbol: string;
  /** What you pay instead */
  withCost: Cost;
  /** What spells/abilities this applies to */
  appliesTo: GameObjectRef;
  /** K'rrik: true (abilities too), Defiler: false (spells only) */
  appliesToAbilities: boolean;
  optional: boolean;
  /** Which color of spells this applies to */
  colorFilter?: string;
}

// ─── Create Emblem Effects ───
export interface CreateEmblemEffect {
  category: "create_emblem";
  emblem: Emblem;
}

// ─── Game Effect Union ───
export type GameEffect =
  | DamageEffect
  | CreateTokenEffect
  | DestroyEffect
  | ExileEffect
  | ReturnEffect
  | RestrictionEffect
  | CopyEffect
  | ZoneCastPermission
  | GameDesignation
  | PlayerCounterEffect
  | ExtraPhaseEffect
  | WinConditionEffect
  | TypeChangeEffect
  | ExtraTurnEffect
  | PlayerControlEffect
  | CostSubstitutionEffect
  | CreateEmblemEffect;

// ═══════════════════════════════════════════════════════════════════
// COSTS — What must be paid to cast spells or activate abilities
// ═══════════════════════════════════════════════════════════════════

export interface TapCost {
  costType: "tap";
}
export interface UntapCost {
  costType: "untap";
}
export interface ManaCostUnit {
  costType: "mana";
  mana: string;
}
export interface SacrificeCost {
  costType: "sacrifice";
  object: GameObjectRef;
}
export interface DiscardCost {
  costType: "discard";
  object?: GameObjectRef;
  quantity?: number;
}
export interface PayLifeCost {
  costType: "pay_life";
  quantity: number | "X";
}
export interface RemoveCounterCost {
  costType: "remove_counter";
  counterType: string;
  quantity: number;
  from?: GameObjectRef;
}
export interface ExileCost {
  costType: "exile";
  object: GameObjectRef;
  from?: Zone;
}
export interface RevealCost {
  costType: "reveal";
  object: GameObjectRef;
  from?: Zone;
}

// ─── Collective Threshold Costs ───
// Crew/Saddle require tapping creatures whose TOTAL power meets threshold.
export interface CrewCost {
  costType: "crew";
  powerThreshold: number;
}
export interface SaddleCost {
  costType: "saddle";
  powerThreshold: number;
}

// ─── Planeswalker Loyalty Cost ───
// CR 606.3 — Sorcery speed only, once per turn per planeswalker.
export interface LoyaltyCost {
  costType: "loyalty";
  /** +2, -3, 0, etc. */
  delta: number;
}

export type Cost =
  | TapCost
  | UntapCost
  | ManaCostUnit
  | SacrificeCost
  | DiscardCost
  | PayLifeCost
  | RemoveCounterCost
  | ExileCost
  | RevealCost
  | CrewCost
  | SaddleCost
  | LoyaltyCost;

// ─── Casting Cost (full picture) ───
export interface CastingCost {
  /** Printed mana cost → determines mana value (NEVER changes) */
  manaCost: string;
  /** Computed CMC (always static) */
  manaValue: number;
  /** Mandatory: "As an additional cost, sacrifice a creature" */
  additionalCosts: Cost[];
  /** Optional (Kicker): pay for bonus effects */
  optionalCosts?: {
    mechanic: string;
    costs: Cost[];
    bonusEffects: Effect[];
    repeatable?: boolean;
  }[];
  /** Alternative: replaces the mana cost entirely */
  alternativeCosts?: {
    costs: Cost[];
    condition?: Condition;
    description: string;
  }[];
  /** Delayed: cost comes due LATER (Pacts) */
  delayedCosts?: {
    trigger: GameEvent;
    costs: Cost[];
    penalty?: Effect;
  }[];
  /** Convoke, Delve, Improvise, Affinity, Emerge */
  costReductions?: {
    mechanic: string;
    reducesBy: string;
    payWith: Cost;
  }[];
  /** Suspend: exile from hand with time counters */
  suspend?: {
    timeCounters: number;
    cost: Cost[];
  };
}

// ═══════════════════════════════════════════════════════════════════
// EFFECT DURATION — How long effects last
// ═══════════════════════════════════════════════════════════════════

export type EffectDuration =
  | { type: "permanent" }
  | { type: "until_end_of_turn" }
  | { type: "until_next_turn" }
  | { type: "until_condition"; condition: Condition }
  | { type: "end_the_turn" }
  | { type: "delayed"; trigger: GameEvent };

// ═══════════════════════════════════════════════════════════════════
// CONDITIONS — Predicates that gate ability effects
// ═══════════════════════════════════════════════════════════════════

export interface Condition {
  type: "if" | "unless" | "as_long_as";
  /** Phase 1: preserved as text */
  predicate: string;
  /** Phase 2+: parsed predicate */
  structured?: {
    check: string;
    object?: GameObjectRef;
    count?: number;
    zone?: Zone;
    comparison?: "less_than" | "greater_equal" | "equal";
    /** Devotion color(s): ["R", "G"] for Xenagos */
    devotionColors?: string[];
  };
}

// ═══════════════════════════════════════════════════════════════════
// EFFECTS — What happens when an ability resolves
// ═══════════════════════════════════════════════════════════════════

export interface Effect {
  type: string;
  target?: GameObjectRef;
  quantity?: number | "X" | VariableQuantity;
  resource?: PlayerResource;
  attribute?: ObjectAttribute;
  gameEffect?: GameEffect;
  zoneTransition?: ZoneTransition;
  /** Which card performed this action (for zone tracking) */
  source?: string;
  /** "exile [target] until ~ leaves the battlefield" */
  linkedReturn?: {
    trigger: GameEvent;
    returnTo: Zone;
  };
  duration?: EffectDuration;
  /** Named card reference: "Gisela, the Broken Blade" */
  namedCardRef?: string;
  details?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════
// ABILITY AST NODES — Parsed ability representations
// ═══════════════════════════════════════════════════════════════════

export type AbilityType =
  | "triggered"
  | "activated"
  | "static"
  | "replacement"
  | "keyword"
  | "spell_effect";

// ─── Modal Abilities ───
export interface ModalMode {
  effects: Effect[];
  description?: string;
}

export interface ModalConfig {
  modes: ModalMode[];
  chooseCount: number | "all";
  /** Gala Greeters = per_turn, Garth = per_game */
  depletion?: "per_turn" | "per_game";
  upgradeCondition?: {
    condition: Condition;
    upgradedChooseCount: number | "all";
  };
}

// ─── Triggered Ability ───
export interface TriggeredAbility {
  abilityType: "triggered";
  /** undefined when the parser couldn't classify the trigger — the ability's
   *  effects are still parsed, but no triggersOn entry is created. */
  trigger?: GameEvent;
  effects: Effect[];
  condition?: Condition;
  speed: "instant";
  modal?: ModalConfig;
}

// ─── Activated Ability ───
export interface ActivatedAbility {
  abilityType: "activated";
  costs: Cost[];
  effects: Effect[];
  condition?: Condition;
  speed: Speed;
  modal?: ModalConfig;
}

// ─── Static Ability ───
export interface StaticAbility {
  abilityType: "static";
  effects: Effect[];
  condition?: Condition;
  affectedObjects?: GameObjectRef;
  layer?: Layer;
  /** Scaling: per_object, threshold, devotion, or count-based */
  scaling?: {
    type: "per_object" | "threshold" | "devotion" | "count";
    countOf: GameObjectRef;
    constraint?: string;
    perUnitEffect?: Effect;
    thresholdCount?: number;
    thresholdEffect?: Effect;
  };
}

// ─── Replacement Ability ───
// "If [event] would happen, [modified event / different event] instead."
// CR 614 — These PREVENT the original event from occurring.
export interface ReplacementAbility {
  abilityType: "replacement";
  /** The event being intercepted */
  replaces: GameEvent;
  /** What happens instead / in addition */
  with: Effect[];
  condition?: Condition;
  affectedObjects?: GameObjectRef;
  /**
   * CR 614.1a modes:
   * - replace: original event entirely replaced (Rest in Peace)
   * - modify: original event still happens with changed parameters (Doubling Season)
   * - add: original event happens, additional effects also occur (Torbran)
   * - redirect: original event redirected to different target (Deflecting Palm)
   * - prevent: damage prevention (CR 615). "Damage can't be prevented" overrides.
   */
  mode: "replace" | "modify" | "add" | "redirect" | "prevent";
  /** For prevention shields: "prevent the next 3" */
  preventionAmount?: number | "all";
}

// ─── Keyword Ability ───
export interface KeywordAbility {
  abilityType: "keyword";
  keyword: string;
  /** "3" for Ward 3, "Swamp" for Swampwalk */
  parameter?: string;
}

// ─── Spell Effect ───
export interface SpellEffect {
  abilityType: "spell_effect";
  effects: Effect[];
  castingCost: CastingCost;
  condition?: Condition;
  modal?: ModalConfig;
}

// ─── Ability Node Union ───
export type AbilityNode =
  | TriggeredAbility
  | ActivatedAbility
  | StaticAbility
  | ReplacementAbility
  | KeywordAbility
  | SpellEffect;

// ═══════════════════════════════════════════════════════════════════
// CARD PROFILE — Summarized capabilities for interaction matching
// ═══════════════════════════════════════════════════════════════════

export interface CardProfile {
  cardName: string;
  cardTypes: CardType[];
  supertypes: Supertype[];
  subtypes: Subtype[];
  abilities: AbilityNode[];
  castingCost?: CastingCost;

  // ─── Multi-Face Card Support ───
  layout:
    | "normal"
    | "mdfc"
    | "transform"
    | "meld"
    | "adventure"
    | "split"
    | "flip";
  faces?: CardProfile[];
  meldPair?: string;
  meldResult?: string;

  // ─── Summarized capabilities ───

  /** What the card generates (mana, life, cards, tokens, counters) */
  produces: (PlayerResource | ObjectAttribute | CreateTokenEffect)[];

  /** What the card requires as costs to operate */
  consumes: Cost[];

  /** What game events trigger this card's abilities */
  triggersOn: GameEvent[];

  /** What game events this card's effects cause */
  causesEvents: GameEvent[];

  /** Abilities this card grants to other objects */
  grants: {
    ability: KeywordGrant | StatModification | string;
    to: GameObjectRef;
    layer?: Layer;
  }[];

  /** Replacement effects — intercept events and change outcomes */
  replacements: {
    replaces: GameEvent;
    with: Effect[];
    affectedObjects?: GameObjectRef;
    mode: "replace" | "modify" | "add" | "redirect" | "prevent";
  }[];

  /** Zone tracking — effects that exile/move with source tracking */
  linkedEffects: {
    effect: Effect;
    source: string;
    returnCondition?: {
      trigger: GameEvent;
      returnTo: Zone;
    };
  }[];

  /** Conditions required for the card to function */
  requires: Condition[];

  /** Continuous effects (anthems, cost reduction, etc.) */
  staticEffects: {
    effect: Effect;
    layer?: Layer;
    affectedObjects?: GameObjectRef;
  }[];

  /** "can't" rules this card imposes */
  restrictions: RestrictionEffect[];

  /** Copy effects this card creates */
  copies: CopyEffect[];

  /** Zone-casting permissions (Bolas's Citadel, Underworld Breach) */
  zoneCastPermissions: ZoneCastPermission[];

  /** What speeds this card operates at */
  speeds: Speed[];

  /** Abilities that function from non-battlefield zones */
  zoneAbilities: {
    ability: AbilityNode;
    functionsFrom: Zone;
  }[];

  /** Game designations this card can grant (monarch, initiative) */
  designations: GameDesignation[];

  /** Type-changing effects (Maskwood Nexus, Arcane Adaptation) */
  typeChanges: TypeChangeEffect[];

  /** Win conditions (Approach of the Second Sun, Thassa's Oracle) */
  winConditions: WinConditionEffect[];

  /** Cost substitution effects (K'rrik, Defilers) */
  costSubstitutions: CostSubstitutionEffect[];

  /** Extra turn effects (Time Warp, Nexus of Fate) */
  extraTurns: ExtraTurnEffect[];

  /** Player control effects (Mindslaver, Emrakul) */
  playerControl: PlayerControlEffect[];

  /** Raw oracle text for fallback pattern matching when parser misses patterns */
  rawOracleText?: string;

  /** Commander-specific fields */
  commander?: {
    hasPartner?: boolean;
    hasBackground?: boolean;
    eminence?: AbilityNode[];
    companionRestriction?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════
// LEXER TOKEN TYPES
// ═══════════════════════════════════════════════════════════════════

export type TokenType =
  | "TRIGGER_WORD"
  | "COST_SEPARATOR"
  | "ABILITY_SEPARATOR"
  | "CARD_TYPE"
  | "SUPERTYPE"
  | "SUBTYPE"
  | "ZONE"
  | "ZONE_TRANSITION"
  | "STATE_CHANGE"
  | "PLAYER_ACTION"
  | "CONTROLLER"
  | "QUANTITY"
  | "EFFECT_VERB"
  | "MANA_SYMBOL"
  | "KEYWORD"
  | "MODIFIER"
  | "COUNTER_TYPE"
  | "CONJUNCTION"
  | "CONDITIONAL"
  | "MODAL"
  | "PUNCTUATION"
  | "TEXT"
  | "NUMBER"
  | "STAT_MOD";

export interface Token {
  type: TokenType;
  value: string;
  /** Character offset in original text */
  position: number;
  /** Canonical form (e.g., "enters the battlefield" → "etb") */
  normalized?: string;
}

// ═══════════════════════════════════════════════════════════════════
// INTERACTION TYPES
// ═══════════════════════════════════════════════════════════════════

export type InteractionType =
  | "enables"
  | "triggers"
  | "amplifies"
  | "protects"
  | "tutors_for"
  | "recurs"
  | "reduces_cost"
  | "blocks"
  | "conflicts"
  | "loops_with";

export interface Interaction {
  cards: [string, string];
  type: InteractionType;
  strength: number;
  /** Precise explanation of how they interact */
  mechanical: string;
  /** The specific events involved */
  events: GameEvent[];
  timing?: Speed;
}

export interface InteractionChain {
  cards: string[];
  description: string;
  reasoning: string;
  strength: number;
  steps: {
    from: string;
    to: string;
    event: GameEvent;
    description: string;
    interactionType: string;
  }[];
}

export interface InteractionLoop {
  cards: string[];
  description: string;
  steps: InteractionChain["steps"];
  netEffect: {
    resources: PlayerResource[];
    attributes: ObjectAttribute[];
    events: GameEvent[];
  };
  isInfinite: boolean;
  requires?: Condition[];
}

// ─── Interaction Dependency Graph ───

export interface InteractionBlocker {
  blocker: string;
  mechanism: ReplacementAbility | RestrictionEffect;
  mechanismType: "replacement" | "restriction";
  blockedEvents: GameEvent[];
  blockedInteractions: Interaction[];
  description: string;
}

export interface InteractionEnabler {
  enabler: string;
  enabledInteractions: Interaction[];
  /** true = interactions don't work without it */
  isRequired: boolean;
}

export interface RemovalImpact {
  removedCard: string;
  interactionsLost: Interaction[];
  interactionsUnblocked: Interaction[];
  chainsDisrupted: InteractionChain[];
  loopsDisrupted: InteractionLoop[];
  description: string;
}

// ─── Full Analysis Result ───
export interface InteractionAnalysis {
  profiles: Record<string, CardProfile>;
  interactions: Interaction[];
  chains: InteractionChain[];
  loops: InteractionLoop[];
  blockers: InteractionBlocker[];
  enablers: InteractionEnabler[];
}
