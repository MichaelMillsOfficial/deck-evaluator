import type { DeckData } from "@/lib/types";
import type { DeckAnalysisResults } from "@/lib/deck-analysis-aggregate";

/**
 * Synthesize a one-line italic tagline summarizing the deck's character.
 *
 * The tagline lives in the verdict-first /reading hero. It should read
 * editorial — like the lede of a magazine review of the deck — not
 * a stat readout. Examples:
 *
 *   "A relentless landfall engine that wins decisively."
 *   "An Elf tribal swarm pressing wide for kills."
 *   "A patient lifegain build that scales over time."
 *   "A casual midrange list with broad answers."
 *   "A combo deck angling for a 2-piece kill."
 *
 * Pure function — no I/O, no randomness. Same input always yields the
 * same string so screenshots and snapshots stay stable.
 */
export function deckTagline(
  _deck: DeckData,
  analysis: DeckAnalysisResults
): string {
  const themes = analysis.synergyAnalysis.deckThemes;
  const topTheme = themes[0];
  const power = analysis.powerLevel.powerLevel;
  const knownCombos = analysis.synergyAnalysis.knownCombos;

  // ─── Power adjective ────────────────────────────────────────────────
  // Reads as the speed/sophistication of the deck. Used as the leading
  // word for theme-based taglines.
  const powerAdj = (() => {
    if (power >= 9) return "A relentless";
    if (power >= 7) return "An optimized";
    if (power >= 5) return "A focused";
    if (power >= 3) return "A patient";
    return "A casual";
  })();

  // ─── Combo callout ──────────────────────────────────────────────────
  // Only mentioned when there's a meaningful combo present and either no
  // theme exists or the theme isn't graveyard/sacrifice (where the combo
  // is implicit in the theme phrase).
  const comboPhrase = knownCombos.length > 0
    ? `${knownCombos.length}-piece combo finish`
    : null;

  // ─── No-theme fallbacks ─────────────────────────────────────────────
  if (!topTheme) {
    if (comboPhrase) {
      return `A combo deck angling for a ${comboPhrase}.`;
    }
    if (power >= 7) {
      return "An optimized goodstuff toolbox with broad answers.";
    }
    if (power <= 3) {
      return "A casual midrange list with broad answers.";
    }
    return "A focused midrange goodstuff list.";
  }

  // ─── Theme-driven taglines ──────────────────────────────────────────
  const tribe = topTheme.detail?.toLowerCase() ?? "";

  switch (topTheme.axisId) {
    case "landfall":
      return power >= 7
        ? `${powerAdj} landfall engine that wins decisively.`
        : `${powerAdj} landfall ramp build that scales over time.`;

    case "tribal": {
      const tribeWord = tribe || "creature";
      return power >= 7
        ? `${powerAdj} ${tribeWord} tribal swarm pressing wide for kills.`
        : `${powerAdj} ${tribeWord} tribal build that snowballs through the table.`;
    }

    case "tokens":
      return power >= 7
        ? `${powerAdj} go-wide token machine, fragile to sweepers.`
        : "Aggressive go-wide tokens, fragile to sweepers.";

    case "graveyard":
      return comboPhrase
        ? `${powerAdj} graveyard reanimator with a ${comboPhrase}.`
        : `${powerAdj} graveyard reanimator that recurs threats relentlessly.`;

    case "sacrifice":
      return `${powerAdj} sacrifice loop grinding value over time.`;

    case "spellslinger":
      return `${powerAdj} spellslinger that turns instants into wins.`;

    case "artifacts":
      return power >= 7
        ? `${powerAdj} artifact engine with explosive starts.`
        : `${powerAdj} artifact synergy build with steady payoffs.`;

    case "enchantments":
      return `${powerAdj} enchantment shell stacking permanents.`;

    case "lifegain":
      return power >= 7
        ? `${powerAdj} lifegain payoff list closing through the air.`
        : `${powerAdj} lifegain build that scales over time.`;

    case "counters":
      return `${powerAdj} +1/+1 counter machine snowballing on the battlefield.`;

    case "discard":
      return `${powerAdj} discard control deck stripping the table early.`;

    case "spellslinger":
      return `${powerAdj} spell-dense list that punches above its curve.`;

    case "supertypeMatter":
      return `${powerAdj} supertype-matters build leveraging legendary payoffs.`;

    case "keywordMatters":
      return `${powerAdj} keyword-matters list rewarding stacked abilities.`;

    case "graveyardHate":
      return `${powerAdj} graveyard-hate shell punishing recursive strategies.`;

    default:
      // Theme exists but we don't have a custom phrase — describe by
      // theme name with the power adjective.
      return `${powerAdj} ${topTheme.axisName.toLowerCase()} build.`;
  }
}
