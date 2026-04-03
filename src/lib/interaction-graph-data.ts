/**
 * Interaction Graph Data
 *
 * Transforms an InteractionAnalysis + CentralityResult into two visual
 * representations:
 *
 *   1. GraphData — nodes (cards) and edges (interactions) for force-directed graph
 *   2. HeatmapData — NxN matrix of aggregate interaction strengths for heatmap
 *
 * All computation is pure and synchronous.  Canvas rendering components import
 * these helpers and only re-derive data when the analysis reference changes.
 */

import type { InteractionAnalysis, InteractionType } from "./interaction-engine/types";
import type { CentralityResult, CentralityCategory } from "./interaction-centrality";

// ═══════════════════════════════════════════════════════════════
// EXPORTED TYPES
// ═══════════════════════════════════════════════════════════════

export interface GraphNode {
  id: string;
  /** Centrality weighted score (from CentralityResult) */
  centrality: number;
  /** Engine / contributor / peripheral / isolated */
  category: CentralityCategory;
  /** Total interactions this card appears in */
  interactionCount: number;
  /** Number of loops this card participates in */
  loopCount: number;
  /** Number of chains this card participates in */
  chainCount: number;
  /** Layout position — populated by force-layout worker, initially undefined */
  x?: number;
  y?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: InteractionType;
  strength: number;
  /** Precise mechanical description */
  mechanical: string;
  /**
   * True for trigger-conditional interaction types ("triggers").
   * These render as dashed lines to indicate conditionality.
   */
  isConditional: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface HeatmapData {
  /** Card names sorted by centrality rank (highest first), capped at 30 */
  cardNames: string[];
  /** matrix[i][j] = sum of interaction strengths between cardNames[i] and cardNames[j] */
  matrix: number[][];
  /** Dominant interaction type at each cell (null when no interactions) */
  typeMatrix: (InteractionType | null)[][];
  /** Maximum value in the matrix (for colour scale normalisation) */
  maxStrength: number;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

/** Interaction types that are event-conditional — rendered as dashed edges */
const CONDITIONAL_TYPES: ReadonlySet<InteractionType> = new Set<InteractionType>([
  "triggers",
]);

/** Maximum cards shown in the heatmap by default */
const HEATMAP_MAX_CARDS = 30;

// ═══════════════════════════════════════════════════════════════
// buildGraphData
// ═══════════════════════════════════════════════════════════════

/**
 * Build graph nodes and edges from an InteractionAnalysis.
 *
 * Nodes are created for every card that appears in at least one interaction,
 * chain, or loop.  Cards that exist only in analysis.profiles but participate
 * in nothing are excluded (they are "isolated" and belong in the utility area
 * if the Canvas renderer wants to show them, but the graph data itself is
 * sparse).
 *
 * Edges are one-to-one with interactions — bidirectional pairs are NOT merged
 * because preserving directionality helps the renderer draw arrows correctly.
 */
export function buildGraphData(
  analysis: InteractionAnalysis,
  centrality: CentralityResult
): GraphData {
  // Build centrality lookup: cardName → CentralityScore
  const centralityMap = new Map(
    centrality.scores.map((s) => [s.cardName, s])
  );

  // Accumulate per-card counts for loop and chain membership
  const loopCounts = new Map<string, number>();
  const chainCounts = new Map<string, number>();

  for (const loop of analysis.loops) {
    for (const card of loop.cards) {
      loopCounts.set(card, (loopCounts.get(card) ?? 0) + 1);
    }
  }

  for (const chain of analysis.chains) {
    for (const card of chain.cards) {
      chainCounts.set(card, (chainCounts.get(card) ?? 0) + 1);
    }
  }

  // Collect all card names that participate in at least one interaction, loop, or chain
  const participatingCards = new Set<string>();
  for (const interaction of analysis.interactions) {
    participatingCards.add(interaction.cards[0]);
    participatingCards.add(interaction.cards[1]);
  }
  for (const loop of analysis.loops) {
    for (const card of loop.cards) participatingCards.add(card);
  }
  for (const chain of analysis.chains) {
    for (const card of chain.cards) participatingCards.add(card);
  }

  if (participatingCards.size === 0) {
    return { nodes: [], edges: [] };
  }

  // Compute per-card interaction counts
  const interactionCounts = new Map<string, number>();
  for (const interaction of analysis.interactions) {
    const [a, b] = interaction.cards;
    interactionCounts.set(a, (interactionCounts.get(a) ?? 0) + 1);
    interactionCounts.set(b, (interactionCounts.get(b) ?? 0) + 1);
  }

  // Build nodes
  const nodes: GraphNode[] = [];
  for (const cardName of participatingCards) {
    const score = centralityMap.get(cardName);
    nodes.push({
      id: cardName,
      centrality: score?.weightedScore ?? 0,
      category: score?.category ?? "isolated",
      interactionCount: interactionCounts.get(cardName) ?? 0,
      loopCount: loopCounts.get(cardName) ?? 0,
      chainCount: chainCounts.get(cardName) ?? 0,
    });
  }

  // Build edges
  const edges: GraphEdge[] = analysis.interactions.map((interaction) => ({
    source: interaction.cards[0],
    target: interaction.cards[1],
    type: interaction.type,
    strength: interaction.strength,
    mechanical: interaction.mechanical,
    isConditional: CONDITIONAL_TYPES.has(interaction.type),
  }));

  return { nodes, edges };
}

// ═══════════════════════════════════════════════════════════════
// buildHeatmapData
// ═══════════════════════════════════════════════════════════════

/**
 * Build an NxN heatmap matrix from an InteractionAnalysis.
 *
 * Cards are sorted by centrality rank (highest first) and capped at
 * HEATMAP_MAX_CARDS.  Only cards that participate in at least one
 * interaction are included.
 *
 * matrix[i][j] = sum of all interaction strengths between cardNames[i] and
 * cardNames[j] (symmetric, diagonal = 0).
 *
 * typeMatrix[i][j] = the dominant interaction type (highest strength) at
 * that cell, or null if no interactions.
 */
export function buildHeatmapData(
  analysis: InteractionAnalysis,
  centrality: CentralityResult
): HeatmapData {
  if (analysis.interactions.length === 0 && analysis.loops.length === 0) {
    return {
      cardNames: [],
      matrix: [],
      typeMatrix: [],
      maxStrength: 0,
    };
  }

  // Collect cards that participate in interactions
  const participatingCards = new Set<string>();
  for (const interaction of analysis.interactions) {
    participatingCards.add(interaction.cards[0]);
    participatingCards.add(interaction.cards[1]);
  }

  if (participatingCards.size === 0) {
    return { cardNames: [], matrix: [], typeMatrix: [], maxStrength: 0 };
  }

  // Sort participating cards by centrality rank (rank 1 = best)
  const centralityRankMap = new Map(
    centrality.scores.map((s) => [s.cardName, s.rank])
  );

  const sortedCards = [...participatingCards].sort((a, b) => {
    const rankA = centralityRankMap.get(a) ?? Number.MAX_SAFE_INTEGER;
    const rankB = centralityRankMap.get(b) ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;
    return a.localeCompare(b);
  });

  // Cap at HEATMAP_MAX_CARDS
  const cardNames = sortedCards.slice(0, HEATMAP_MAX_CARDS);
  const N = cardNames.length;

  // Build index map for O(1) lookup
  const indexMap = new Map(cardNames.map((name, i) => [name, i]));

  // Initialise NxN zero matrices
  const matrix: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  const strengthByType: Map<string, Map<InteractionType, number>> = new Map();

  // Populate matrices — only for cards in our capped list
  for (const interaction of analysis.interactions) {
    const i = indexMap.get(interaction.cards[0]);
    const j = indexMap.get(interaction.cards[1]);
    if (i === undefined || j === undefined || i === j) continue;

    matrix[i][j] += interaction.strength;
    matrix[j][i] += interaction.strength;

    // Track dominant type per cell pair (canonical key: smaller index first)
    const cellKey = `${Math.min(i, j)}-${Math.max(i, j)}`;
    if (!strengthByType.has(cellKey)) strengthByType.set(cellKey, new Map());
    const typeMap = strengthByType.get(cellKey)!;
    typeMap.set(
      interaction.type,
      (typeMap.get(interaction.type) ?? 0) + interaction.strength
    );
  }

  // Build typeMatrix: for each cell, pick the type with the highest total strength
  const typeMatrix: (InteractionType | null)[][] = Array.from(
    { length: N },
    () => new Array(N).fill(null)
  );

  for (const [cellKey, typeMap] of strengthByType) {
    const [iStr, jStr] = cellKey.split("-");
    const i = parseInt(iStr, 10);
    const j = parseInt(jStr, 10);

    let dominantType: InteractionType | null = null;
    let maxTypeStrength = 0;
    for (const [type, strength] of typeMap) {
      if (strength > maxTypeStrength) {
        maxTypeStrength = strength;
        dominantType = type;
      }
    }

    typeMatrix[i][j] = dominantType;
    typeMatrix[j][i] = dominantType;
  }

  // Compute max cell value (excluding diagonal)
  let maxStrength = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i !== j && matrix[i][j] > maxStrength) {
        maxStrength = matrix[i][j];
      }
    }
  }

  return { cardNames, matrix, typeMatrix, maxStrength };
}
