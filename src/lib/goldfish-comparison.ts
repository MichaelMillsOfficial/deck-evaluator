import type { GoldfishResult, GoldfishAggregateStats } from "./goldfish-simulator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GoldfishComparison {
  deckA: { name: string; stats: GoldfishAggregateStats };
  deckB: { name: string; stats: GoldfishAggregateStats };
  deltas: {
    /** B minus A per turn */
    avgManaByTurn: number[];
    /** B minus A per turn */
    avgSpellsByTurn: number[];
    /** B minus A */
    commanderCastRate: number;
    /** B minus A */
    rampAcceleration: number;
    /** B minus A */
    avgTotalSpellsCast: number;
  };
  advantages: {
    metric: string;
    winner: "A" | "B" | "tie";
    magnitude: number;
  }[];
}

// ---------------------------------------------------------------------------
// compareGoldfishResults
// ---------------------------------------------------------------------------

/**
 * Pure arithmetic comparison of two GoldfishResult objects.
 * Deltas are always (B - A). Positive delta means B is higher.
 */
export function compareGoldfishResults(
  a: GoldfishResult,
  aName: string,
  b: GoldfishResult,
  bName: string
): GoldfishComparison {
  const statsA = a.stats;
  const statsB = b.stats;

  // Per-turn array deltas
  const avgManaByTurn = computeArrayDelta(
    statsA.avgManaByTurn,
    statsB.avgManaByTurn
  );
  const avgSpellsByTurn = computeArrayDelta(
    statsA.avgSpellsByTurn,
    statsB.avgSpellsByTurn
  );

  // Scalar deltas
  const commanderCastRate =
    Math.round((statsB.commanderCastRate - statsA.commanderCastRate) * 10000) / 10000;
  const rampAcceleration =
    Math.round((statsB.rampAcceleration - statsA.rampAcceleration) * 10000) / 10000;
  const avgTotalSpellsCast =
    Math.round((statsB.avgTotalSpellsCast - statsA.avgTotalSpellsCast) * 1000) / 1000;

  const deltas = {
    avgManaByTurn,
    avgSpellsByTurn,
    commanderCastRate,
    rampAcceleration,
    avgTotalSpellsCast,
  };

  // Build advantages array
  const advantages = computeAdvantages(statsA, statsB);

  return {
    deckA: { name: aName, stats: statsA },
    deckB: { name: bName, stats: statsB },
    deltas,
    advantages,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute per-element delta (B - A) for two arrays.
 * Pads shorter array with zeros.
 */
function computeArrayDelta(a: number[], b: number[]): number[] {
  const len = Math.max(a.length, b.length);
  const result: number[] = [];
  for (let i = 0; i < len; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    result.push(Math.round((bVal - aVal) * 10000) / 10000);
  }
  return result;
}

/**
 * Determine which deck wins each metric.
 * For most metrics, higher is better (more mana, more spells, higher commander rate).
 * Returns an advantage entry per scalar metric.
 */
function computeAdvantages(
  statsA: GoldfishAggregateStats,
  statsB: GoldfishAggregateStats
): { metric: string; winner: "A" | "B" | "tie"; magnitude: number }[] {
  const METRICS: {
    key: keyof GoldfishAggregateStats;
    label: string;
    higherIsBetter: boolean;
  }[] = [
    { key: "avgTotalSpellsCast", label: "avgTotalSpellsCast", higherIsBetter: true },
    { key: "commanderCastRate", label: "commanderCastRate", higherIsBetter: true },
    { key: "rampAcceleration", label: "rampAcceleration", higherIsBetter: true },
  ];

  return METRICS.map(({ key, label, higherIsBetter }) => {
    const valA = statsA[key];
    const valB = statsB[key];

    if (typeof valA !== "number" || typeof valB !== "number") {
      return { metric: label, winner: "tie" as const, magnitude: 0 };
    }

    const diff = valB - valA;
    const magnitude = Math.round(Math.abs(diff) * 1000) / 1000;

    const EPSILON = 0.0001;
    if (Math.abs(diff) < EPSILON) {
      return { metric: label, winner: "tie" as const, magnitude: 0 };
    }

    // diff > 0 means B is higher
    const bIsHigher = diff > 0;
    const winner = higherIsBetter
      ? bIsHigher
        ? "B"
        : "A"
      : bIsHigher
      ? "A"
      : "B";

    return { metric: label, winner, magnitude };
  });
}
