// ---------------------------------------------------------------------------
// Share Analysis Summary
// Compact representation of DeckAnalysisResults for inclusion in share URLs.
// Designed to stay under 200 bytes as JSON.
// ---------------------------------------------------------------------------

import type { DeckAnalysisResults } from "./deck-analysis-aggregate";

export interface ShareAnalysisSummary {
  pl: number;       // power level (1-10, 1 decimal)
  br: number;       // bracket (1-5, integer)
  avg: number;      // average CMC (1 decimal)
  kr: number;       // keepable rate 0-100 (integer)
  themes: string[]; // top 3 synergy theme names
  combos: number;   // combo count (integer)
  budget: number;   // total cost in cents (integer)
}

/**
 * Build a compact summary of deck analysis results for embedding in share URLs.
 * The returned object serializes to under 200 bytes of JSON.
 */
export function buildShareSummary(results: DeckAnalysisResults): ShareAnalysisSummary {
  const pl = Math.round(results.powerLevel.powerLevel * 10) / 10;
  const br = results.bracketResult.bracket;
  const avg = Math.round(results.manaBaseMetrics.averageCmc * 10) / 10;
  const kr = Math.round(results.simulationStats.keepableRate * 100);
  const themes = results.synergyAnalysis.deckThemes
    .slice(0, 3)
    .map((t) => t.axisName);
  const combos = results.synergyAnalysis.knownCombos.length;
  const budget = Math.round((results.budgetAnalysis.totalCost ?? 0) * 100);

  return { pl, br, avg, kr, themes, combos, budget };
}
