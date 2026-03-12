/**
 * Reasoning Engine — Public API
 *
 * Bridge layer between the interaction engine's parsed card profiles
 * and the synergy engine's pair generation. Classifies effect polarity
 * and target intent to filter false positive synergy pairs.
 */

// Types
export type {
  EffectPolarity,
  TargetIntent,
  EffectCategory,
  AnnotatedEffect,
  CardIntentSummary,
  DeckReasoningContext,
  IntentOverride,
  SynergyAnalysisOptions,
} from "./types";

// Effect classifier
export {
  classifyEffectPolarity,
  inferTargetIntent,
  categorizeEffect,
  classifyAbilityEffects,
} from "./effect-classifier";

// Intent resolver
export {
  buildCardIntentSummary,
  buildDeckIntentSummaries,
  mapEffectToAxes,
} from "./intent-resolver";

// Deck context
export {
  analyzeDeckContext,
  generateIntentOverrides,
  applyDeckContext,
} from "./deck-context";
