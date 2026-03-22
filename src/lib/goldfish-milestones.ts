import type { GoldfishGameLog, GoldfishTurnLog, PermanentSnapshot, PermanentCategory } from "./goldfish-simulator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MilestoneType =
  | "first_spell"
  | "commander_cast"
  | "combo_assembled"
  | "critical_mass";

export interface BoardMilestone {
  turn: number;
  type: MilestoneType;
  description: string;
  permanentCount: number;
  landCount: number;
  creatureCount: number;
  manaAvailable: number;
  /** Most common permanents across simulations at this milestone turn */
  topPermanents: { name: string; frequency: number }[];
}

// ---------------------------------------------------------------------------
// detectMilestones
// ---------------------------------------------------------------------------

/**
 * Post-processing pass over game logs to detect notable turns.
 * Returns milestone snapshots using median turn across all games.
 *
 * Detected milestones:
 * - first_spell: the median turn at which a non-land was first cast
 * - commander_cast: median first-cast turn when a commander was cast
 * - critical_mass: median turn when permanentCount first reached >= 7
 */
export function detectMilestones(gameLogs: GoldfishGameLog[]): BoardMilestone[] {
  if (gameLogs.length === 0) return [];

  const milestones: BoardMilestone[] = [];

  // --- first_spell milestone ---
  const firstSpellTurns: { turn: number; log: GoldfishTurnLog }[] = [];
  for (const game of gameLogs) {
    for (const turnLog of game.turnLogs) {
      if (turnLog.spellsCast.length > 0) {
        firstSpellTurns.push({ turn: turnLog.turn, log: turnLog });
        break;
      }
    }
  }
  if (firstSpellTurns.length > 0) {
    const medianEntry = getMedianEntry(firstSpellTurns);
    const topPerms = computeTopPermanents(
      gameLogs,
      medianEntry.turn,
      firstSpellTurns.length
    );
    milestones.push({
      turn: medianEntry.turn,
      type: "first_spell",
      description: `First spell cast on turn ${medianEntry.turn} (median across ${firstSpellTurns.length} games)`,
      permanentCount: medianEntry.log.permanentCount,
      landCount: countByCategory(medianEntry.log.permanents, "land"),
      creatureCount: countByCategory(medianEntry.log.permanents, "creature"),
      manaAvailable: medianEntry.log.manaAvailable,
      topPermanents: topPerms,
    });
  }

  // --- commander_cast milestone ---
  const commanderTurns: { turn: number; log: GoldfishTurnLog }[] = [];
  for (const game of gameLogs) {
    if (game.commanderFirstCastTurn === null) continue;
    const log = game.turnLogs.find((l) => l.turn === game.commanderFirstCastTurn);
    if (log) {
      commanderTurns.push({ turn: game.commanderFirstCastTurn, log });
    }
  }
  if (commanderTurns.length > 0) {
    const medianEntry = getMedianEntry(commanderTurns);
    const topPerms = computeTopPermanents(
      gameLogs,
      medianEntry.turn,
      commanderTurns.length
    );
    milestones.push({
      turn: medianEntry.turn,
      type: "commander_cast",
      description: `Commander first cast on turn ${medianEntry.turn} (median, ${commanderTurns.length} games)`,
      permanentCount: medianEntry.log.permanentCount,
      landCount: countByCategory(medianEntry.log.permanents, "land"),
      creatureCount: countByCategory(medianEntry.log.permanents, "creature"),
      manaAvailable: medianEntry.log.manaAvailable,
      topPermanents: topPerms,
    });
  }

  // --- critical_mass milestone ---
  const CRITICAL_MASS_THRESHOLD = 7;
  const criticalTurns: { turn: number; log: GoldfishTurnLog }[] = [];
  for (const game of gameLogs) {
    for (const turnLog of game.turnLogs) {
      if (turnLog.permanentCount >= CRITICAL_MASS_THRESHOLD) {
        criticalTurns.push({ turn: turnLog.turn, log: turnLog });
        break;
      }
    }
  }
  if (criticalTurns.length > 0) {
    const medianEntry = getMedianEntry(criticalTurns);
    const topPerms = computeTopPermanents(
      gameLogs,
      medianEntry.turn,
      criticalTurns.length
    );
    milestones.push({
      turn: medianEntry.turn,
      type: "critical_mass",
      description: `${CRITICAL_MASS_THRESHOLD}+ permanents reached on turn ${medianEntry.turn} (median, ${criticalTurns.length} games)`,
      permanentCount: medianEntry.log.permanentCount,
      landCount: countByCategory(medianEntry.log.permanents, "land"),
      creatureCount: countByCategory(medianEntry.log.permanents, "creature"),
      manaAvailable: medianEntry.log.manaAvailable,
      topPermanents: topPerms,
    });
  }

  return milestones;
}

// ---------------------------------------------------------------------------
// captureSnapshotsAtTurns
// ---------------------------------------------------------------------------

/**
 * Capture board state snapshots at specific turn numbers.
 * Aggregates data across all games that have data for that turn.
 */
export function captureSnapshotsAtTurns(
  gameLogs: GoldfishGameLog[],
  turns: number[]
): BoardMilestone[] {
  if (gameLogs.length === 0) return [];

  const snapshots: BoardMilestone[] = [];

  for (const targetTurn of turns) {
    const matchingLogs: GoldfishTurnLog[] = [];

    for (const game of gameLogs) {
      const turnLog = game.turnLogs.find((l) => l.turn === targetTurn);
      if (turnLog) {
        matchingLogs.push(turnLog);
      }
    }

    if (matchingLogs.length === 0) continue;

    const avgPermanentCount =
      Math.round(
        (matchingLogs.reduce((s, l) => s + l.permanentCount, 0) / matchingLogs.length) * 10
      ) / 10;
    const avgManaAvailable =
      Math.round(
        (matchingLogs.reduce((s, l) => s + l.manaAvailable, 0) / matchingLogs.length) * 10
      ) / 10;
    const avgLandCount =
      Math.round(
        (matchingLogs.reduce((s, l) => s + countByCategory(l.permanents, "land"), 0) /
          matchingLogs.length) *
          10
      ) / 10;
    const avgCreatureCount =
      Math.round(
        (matchingLogs.reduce((s, l) => s + countByCategory(l.permanents, "creature"), 0) /
          matchingLogs.length) *
          10
      ) / 10;

    const topPerms = computeTopPermanents(gameLogs, targetTurn, matchingLogs.length);

    snapshots.push({
      turn: targetTurn,
      type: "critical_mass",
      description: `Turn ${targetTurn} snapshot across ${matchingLogs.length} games`,
      permanentCount: avgPermanentCount,
      landCount: avgLandCount,
      creatureCount: avgCreatureCount,
      manaAvailable: avgManaAvailable,
      topPermanents: topPerms,
    });
  }

  return snapshots;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countByCategory(
  permanents: PermanentSnapshot[],
  category: PermanentCategory
): number {
  return permanents.filter((p) => p.category === category).length;
}

/**
 * Get the entry with the median turn from an array sorted-in-place.
 */
function getMedianEntry<T extends { turn: number }>(
  entries: T[]
): T {
  const sorted = [...entries].sort((a, b) => a.turn - b.turn);
  const mid = Math.floor(sorted.length / 2);
  return sorted[mid];
}

/**
 * Compute the most common permanents at a given turn across all game logs.
 * Returns top 5 by frequency.
 */
function computeTopPermanents(
  gameLogs: GoldfishGameLog[],
  turn: number,
  totalGames: number
): { name: string; frequency: number }[] {
  const counts = new Map<string, number>();

  for (const game of gameLogs) {
    const turnLog = game.turnLogs.find((l) => l.turn === turn);
    if (!turnLog) continue;

    // Count unique permanents per game (don't double-count duplicates in one game)
    const seenThisGame = new Set<string>();
    for (const perm of turnLog.permanents) {
      if (!seenThisGame.has(perm.name)) {
        seenThisGame.add(perm.name);
        counts.set(perm.name, (counts.get(perm.name) ?? 0) + 1);
      }
    }
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({
      name,
      frequency: Math.round((count / totalGames) * 1000) / 1000,
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 5);
}
