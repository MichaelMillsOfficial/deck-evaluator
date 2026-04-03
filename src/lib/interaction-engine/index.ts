/**
 * Interaction Engine — Public API
 *
 * Phase 1: Type definitions, game model, and keyword database.
 * Phase 2: Oracle text lexer (tokenization).
 * Phase 3: Parser (token stream → AbilityNode ASTs).
 * Phase 4: Capability extractor (profileCard).
 * Phase 5: Interaction detector (findInteractions).
 */

// Game model
export {
  type CardType,
  type Supertype,
  type Subtype,
  type Controller,
  type Zone,
  type ZoneProperties,
  type TypeFilter,
  type GameObjectRef,
  type RefModifier,
  type CompositeType,
  type AttachmentType,
  type AttachmentRelationship,
  PERMANENT_TYPES,
  ZONE_PROPERTIES,
  COMPOSITE_TYPES,
  isPermanentType,
  isSpellType,
  matchesCompositeType,
} from "./game-model";

// Rules types
export {
  type Speed,
  type Phase,
  type Step,
  Layer,
  PTSublayer,
  type ContinuousEffect,
  type StackItem,
  type PriorityState,
  type StateBasedAction,
  STATE_BASED_ACTIONS,
} from "./rules/types";

// Engine types
export type {
  // Events
  ZoneTransition,
  StateChange,
  PlayerAction,
  PhaseTrigger,
  DamageEvent,
  TargetEvent,
  AttachmentEvent,
  GameEvent,
  StateProperty,
  PlayerActionType,

  // Resources & Attributes
  ManaResource,
  LifeResource,
  CardsResource,
  PlayerResource,
  CounterAttribute,
  StatModification,
  KeywordGrant,
  ObjectAttribute,
  VariableQuantity,
  TokenDefinition,
  Emblem,
  Dungeon,
  DungeonRoom,

  // Game Effects
  DamageEffect,
  CreateTokenEffect,
  DestroyEffect,
  ExileEffect,
  ReturnEffect,
  RestrictionEffect,
  CopyEffect,
  ZoneCastPermission,
  GameDesignation,
  PlayerCounterEffect,
  ExtraPhaseEffect,
  WinConditionEffect,
  TypeChangeEffect,
  ExtraTurnEffect,
  PlayerControlEffect,
  CostSubstitutionEffect,
  CreateEmblemEffect,
  GameEffect,

  // Costs
  TapCost,
  UntapCost,
  ManaCostUnit,
  SacrificeCost,
  DiscardCost,
  PayLifeCost,
  RemoveCounterCost,
  ExileCost,
  RevealCost,
  CrewCost,
  SaddleCost,
  LoyaltyCost,
  Cost,
  CastingCost,

  // Duration & Conditions
  EffectDuration,
  Condition,
  ConditionCheck,
  SatisfiabilityResult,

  // Effects & Abilities
  Effect,
  AbilityType,
  ModalMode,
  ModalConfig,
  TriggeredAbility,
  ActivatedAbility,
  StaticAbility,
  ReplacementAbility,
  KeywordAbility,
  SpellEffect,
  AbilityNode,

  // Card Profile
  CardProfile,
  PartnerType,

  // Lexer
  TokenType,
  Token,

  // Interactions
  InteractionType,
  Interaction,
  InteractionChain,
  InteractionLoop,
  InteractionBlocker,
  InteractionEnabler,
  RemovalImpact,
  InteractionAnalysis,

  // Loop Chain Solver
  ObjectFilter,
  ResourceRequirement,
  ResourceProduction,
  LoopStep,
} from "./types";

// Lexer
export {
  splitAbilityBlocks,
  splitModalModes,
  normalizeSelfReferences,
  tokenizeAbility,
  tokenize,
} from "./lexer";

// Parser
export {
  parseAbility,
  parseAbilities,
} from "./parser";

// Capability extractor
export { profileCard } from "./capability-extractor";

// Interaction detector
export { findInteractions, findInteractionsAsync } from "./interaction-detector";

// Loop chain solver
export {
  extractLoopSteps,
  isNonLoopableSpell,
  solveChain,
  canSatisfyRequirements,
  detectLoopsFromChains,
} from "./loop-chain-solver";

// Eminence extractor
export {
  extractEminenceAbilities,
  parsePartnerInfo,
  parseCompanionRestriction,
} from "./eminence-extractor";

// Keyword database
export {
  type KeywordEntry,
  type KeywordCategory,
  KEYWORD_DATABASE,
  lookupKeyword,
  expandKeyword,
  getKeywordsByCategory,
  hasKeyword,
  getAllKeywordNames,
} from "./keyword-database";
