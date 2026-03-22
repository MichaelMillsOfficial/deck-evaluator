/**
 * Force Layout Web Worker
 *
 * Runs d3-force simulation synchronously in a background thread.
 * The main thread sends node/edge data and receives back final (x, y) positions
 * after 300 ticks, without ever blocking the React render pipeline.
 *
 * Usage:
 *   const worker = new Worker(new URL('./force-layout.worker.ts', import.meta.url));
 *   worker.postMessage({ nodes, edges, width, height });
 *   worker.onmessage = (e) => { const { positions } = e.data; ... };
 */

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";

export interface ForceLayoutInput {
  nodes: { id: string; centrality: number }[];
  edges: { source: string; target: string; strength: number }[];
  width: number;
  height: number;
}

export interface ForceLayoutOutput {
  positions: { id: string; x: number; y: number }[];
}

// Internal node type that d3-force will mutate with x/y
interface SimNode extends SimulationNodeDatum {
  id: string;
  centrality: number;
}

// Internal edge type — source/target will be replaced by d3 with node objects
interface SimEdge extends SimulationLinkDatum<SimNode> {
  strength: number;
}

self.onmessage = (e: MessageEvent<ForceLayoutInput>) => {
  const { nodes, edges, width, height } = e.data;

  if (nodes.length === 0) {
    const result: ForceLayoutOutput = { positions: [] };
    self.postMessage(result);
    return;
  }

  // Shallow-copy nodes so d3-force can mutate x/y without affecting the
  // caller's objects.
  const simNodes: SimNode[] = nodes.map((n) => ({
    ...n,
    x: width / 2,
    y: height / 2,
  }));

  // d3-force link expects source/target as string IDs or node references.
  const simEdges: SimEdge[] = edges.map((e) => ({
    source: e.source as unknown as SimNode,
    target: e.target as unknown as SimNode,
    strength: e.strength,
  }));

  const simulation = forceSimulation(simNodes)
    .force(
      "link",
      forceLink<SimNode, SimEdge>(simEdges)
        .id((d) => d.id)
        .distance(80)
        .strength((link) => Math.max(0.1, Math.min(1, link.strength ?? 0.5)))
    )
    .force(
      "charge",
      forceManyBody<SimNode>().strength((d) => -150 - (d.centrality ?? 0) * 50)
    )
    .force("center", forceCenter(width / 2, height / 2))
    .force("collide", forceCollide<SimNode>().radius(20))
    .stop();

  // Run ticks synchronously — 300 gives a well-converged layout
  const TICK_COUNT = 300;
  for (let i = 0; i < TICK_COUNT; i++) {
    simulation.tick();
  }

  const positions: ForceLayoutOutput["positions"] = simNodes.map((n) => ({
    id: n.id,
    x: n.x ?? width / 2,
    y: n.y ?? height / 2,
  }));

  const result: ForceLayoutOutput = { positions };
  self.postMessage(result);
};
