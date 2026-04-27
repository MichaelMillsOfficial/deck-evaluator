import type { GoldfishGameState } from "./goldfish-simulator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Zone =
  | "hand"
  | "battlefield"
  | "library"
  | "graveyard"
  | "exile"
  | "command_zone";

export interface ComboPieceStatus {
  cardName: string;
  zone: Zone;
  turnFirstAvailable: number | null;
}

export interface ComboAssemblySnapshot {
  comboId: string;
  comboName: string;
  pieces: ComboPieceStatus[];
  assembledOnTurn: number | null;
  fullyAssembled: boolean;
}

export interface ComboAssemblyStats {
  perCombo: {
    comboId: string;
    comboName: string;
    /** null if never assembled in any game */
    avgAssemblyTurn: number | null;
    /** 0-1, fraction of games where assembled by end of simulation */
    assemblyRate: number;
    /** cumulative assembly probability per turn (0-indexed, length = turns) */
    assemblyByTurn: number[];
    pieceStats: {
      cardName: string;
      avgTurnFirstDrawn: number | null;
      drawRate: number;
    }[];
  }[];
}

interface ComboConfig {
  id: string;
  name: string;
  cards: string[];
  /** Override which zones count as "available" for each card name */
  zoneRequirements?: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Internal state per combo
// ---------------------------------------------------------------------------

interface PieceState {
  cardName: string;
  /** Zones required for this piece to count as assembled */
  requiredZones: Zone[];
  currentZone: Zone;
  turnFirstAvailable: number | null;
}

interface ComboState {
  id: string;
  name: string;
  pieces: PieceState[];
  assembledOnTurn: number | null;
}

// ---------------------------------------------------------------------------
// Default available zones for assembly
// ---------------------------------------------------------------------------

const DEFAULT_AVAILABLE_ZONES: Zone[] = ["hand", "battlefield"];

// ---------------------------------------------------------------------------
// ComboAssemblyTracker
// ---------------------------------------------------------------------------

/**
 * Tracks assembly of combos across turns of a goldfish simulation game.
 * One tracker instance = one game.
 */
export class ComboAssemblyTracker {
  private combos: ComboState[];

  constructor(combos: ComboConfig[]) {
    this.combos = combos.map((c) => ({
      id: c.id,
      name: c.name,
      assembledOnTurn: null,
      pieces: c.cards.map((cardName) => ({
        cardName,
        requiredZones: resolveRequiredZones(cardName, c.zoneRequirements),
        currentZone: "library" as Zone,
        turnFirstAvailable: null,
      })),
    }));
  }

  /**
   * Update piece locations from the current game state.
   * Call once per turn after executeTurn().
   */
  update(state: GoldfishGameState, turn: number): void {
    // Build name → zone map from state
    const zoneMap = buildZoneMap(state);

    for (const combo of this.combos) {
      for (const piece of combo.pieces) {
        const zone = zoneMap.get(piece.cardName) ?? "library";
        piece.currentZone = zone;

        // A piece is "available" if it's in one of its required zones
        const isAvailable = piece.requiredZones.includes(zone);

        if (isAvailable && piece.turnFirstAvailable === null) {
          piece.turnFirstAvailable = turn;
        }
      }

      // Check if all pieces are now in their required zones
      if (combo.assembledOnTurn === null) {
        const fullyAssembled = combo.pieces.every((p) =>
          p.requiredZones.includes(p.currentZone)
        );
        if (fullyAssembled) {
          combo.assembledOnTurn = turn;
        }
      }
    }
  }

  /**
   * Get current assembly snapshots for all combos.
   */
  getSnapshots(): ComboAssemblySnapshot[] {
    return this.combos.map((combo) => ({
      comboId: combo.id,
      comboName: combo.name,
      pieces: combo.pieces.map((p) => ({
        cardName: p.cardName,
        zone: p.currentZone,
        turnFirstAvailable: p.turnFirstAvailable,
      })),
      assembledOnTurn: combo.assembledOnTurn,
      fullyAssembled: combo.assembledOnTurn !== null,
    }));
  }

  /**
   * Aggregate statistics from multiple trackers (one per game simulation).
   */
  static aggregateStats(
    trackers: ComboAssemblyTracker[],
    turns: number
  ): ComboAssemblyStats {
    if (trackers.length === 0) {
      return { perCombo: [] };
    }

    // Get combo IDs from first tracker
    const firstTracker = trackers[0];
    const n = trackers.length;

    const perCombo = firstTracker.combos.map((comboTemplate, comboIndex) => {
      const comboId = comboTemplate.id;
      const comboName = comboTemplate.name;

      // Collect assembly turns across all games
      const assemblyTurns: number[] = [];
      for (const tracker of trackers) {
        const combo = tracker.combos[comboIndex];
        if (combo?.assembledOnTurn !== null && combo?.assembledOnTurn !== undefined) {
          assemblyTurns.push(combo.assembledOnTurn);
        }
      }

      const assemblyRate = assemblyTurns.length / n;
      const avgAssemblyTurn =
        assemblyTurns.length > 0
          ? assemblyTurns.reduce((a, b) => a + b, 0) / assemblyTurns.length
          : null;

      // Cumulative assembly probability by turn (0-indexed array of length `turns`)
      const assemblyCounts = new Array(turns).fill(0);
      for (const t of assemblyTurns) {
        // t is 1-based turn number, index is t-1
        const idx = Math.min(t - 1, turns - 1);
        assemblyCounts[idx]++;
      }
      // Convert to cumulative fractions
      const assemblyByTurn: number[] = [];
      let cumulative = 0;
      for (let i = 0; i < turns; i++) {
        cumulative += assemblyCounts[i];
        assemblyByTurn.push(Math.round((cumulative / n) * 1000) / 1000);
      }

      // Piece stats: draw rate and avg turn first available
      const pieceStats = comboTemplate.pieces.map((pieceTemplate, pieceIndex) => {
        const cardName = pieceTemplate.cardName;
        const drawTurns: number[] = [];

        for (const tracker of trackers) {
          const piece = tracker.combos[comboIndex]?.pieces[pieceIndex];
          if (piece?.turnFirstAvailable !== null && piece?.turnFirstAvailable !== undefined) {
            drawTurns.push(piece.turnFirstAvailable);
          }
        }

        return {
          cardName,
          avgTurnFirstDrawn:
            drawTurns.length > 0
              ? Math.round((drawTurns.reduce((a, b) => a + b, 0) / drawTurns.length) * 10) / 10
              : null,
          drawRate: Math.round((drawTurns.length / n) * 1000) / 1000,
        };
      });

      return {
        comboId,
        comboName,
        avgAssemblyTurn:
          avgAssemblyTurn !== null
            ? Math.round(avgAssemblyTurn * 10) / 10
            : null,
        assemblyRate: Math.round(assemblyRate * 1000) / 1000,
        assemblyByTurn,
        pieceStats,
      };
    });

    return { perCombo };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveRequiredZones(
  cardName: string,
  zoneRequirements?: Record<string, string[]>
): Zone[] {
  if (zoneRequirements && zoneRequirements[cardName]) {
    return zoneRequirements[cardName] as Zone[];
  }
  return DEFAULT_AVAILABLE_ZONES;
}

/**
 * Build a map of card name → zone from the current game state.
 * For cards that appear in multiple zones (unusual), battlefield wins.
 */
function buildZoneMap(state: GoldfishGameState): Map<string, Zone> {
  const map = new Map<string, Zone>();

  // Priority order: battlefield > hand > graveyard > exile > command_zone > library
  for (const card of state.library) {
    if (!map.has(card.name)) map.set(card.name, "library");
  }
  for (const card of state.exile) {
    map.set(card.name, "exile");
  }
  for (const card of state.commandZone) {
    map.set(card.name, "command_zone");
  }
  for (const card of state.graveyard) {
    map.set(card.name, "graveyard");
  }
  for (const card of state.hand) {
    map.set(card.name, "hand");
  }
  for (const perm of state.battlefield) {
    map.set(perm.card.name, "battlefield");
  }

  return map;
}
