"use client";

/**
 * InteractionGraph
 *
 * Canvas 2D force-directed graph of card interactions.
 *
 * - Nodes: circles sized by centrality score, stroke-coloured by category
 * - Edges: lines coloured by interaction type, width by strength
 * - Dashed edges for conditional ("triggers") interactions
 * - Click to select node → detail panel slides in
 * - Hover to highlight connected edges / dim others
 * - Wheel to zoom, drag to pan
 * - +/- zoom buttons and reset-view button (bottom-right)
 * - Node labels rendered at zoom >= 1.4x
 * - cardSearch prop: highlights matching nodes, dims others, pans to first match
 * - selectedTypes filter: hides orphaned (zero-edge) nodes from canvas and layout
 * - Card/edge count and isolated-node badge (bottom-left)
 * - Web Worker for d3-force layout (never blocks the main thread)
 * - Visually-hidden accessible table mirrors the graph for screen readers
 * - Keyboard navigation: Tab to focus canvas, arrow keys between nodes, Enter select, Escape deselect
 * - Respects prefers-reduced-motion: skips animation, renders final positions immediately
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { InteractionAnalysis, InteractionType } from "@/lib/interaction-engine/types";
import type { CentralityResult } from "@/lib/interaction-centrality";
import {
  buildGraphData,
  type GraphNode,
  type GraphEdge,
} from "@/lib/interaction-graph-data";

// ─── Interaction type → canvas hex colour ────────────────────────────────────
// These match the Tailwind palette used in InteractionSection for consistency.
const TYPE_HEX: Record<InteractionType, string> = {
  enables: "#16a34a",    // green-600
  triggers: "#2563eb",   // blue-600
  amplifies: "#d97706",  // amber-600
  protects: "#0891b2",   // cyan-600
  recurs: "#059669",     // emerald-600
  reduces_cost: "#65a30d", // lime-600
  tutors_for: "#4f46e5", // indigo-600
  blocks: "#dc2626",     // red-600
  conflicts: "#ea580c",  // orange-600
  loops_with: "#c026d3", // fuchsia-600
};

const CATEGORY_STROKE: Record<string, string> = {
  engine: "#a855f7",    // purple-500
  contributor: "#6366f1", // indigo-400
  peripheral: "#64748b", // slate-500
  isolated: "#334155",   // slate-700
};

// ─── Constants ────────────────────────────────────────────────────────────────
const NODE_RADIUS_BASE = 8;
const NODE_RADIUS_SCALE = 12;
const NODE_RADIUS_MAX = 20;
const EDGE_WIDTH_BASE = 1;
const EDGE_WIDTH_SCALE = 3;
const ZOOM_SPEED = 0.001;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;

// ─── Props ────────────────────────────────────────────────────────────────────
interface InteractionGraphProps {
  analysis: InteractionAnalysis;
  centrality: CentralityResult;
  /** If provided, only show edges whose type is in this set */
  selectedTypes?: Set<InteractionType>;
  /** If provided, highlight matching nodes and pan to first match */
  cardSearch?: string;
  /** Height in pixels (default 480) */
  height?: number;
}

// ─── Transform state ─────────────────────────────────────────────────────────
interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

// ─── Detail panel ─────────────────────────────────────────────────────────────
function NodeDetailPanel({
  node,
  edges,
  onClose,
}: {
  node: GraphNode;
  edges: GraphEdge[];
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [onClose]);

  const connectedEdges = edges.filter(
    (e) => e.source === node.id || e.target === node.id
  );

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={`Card detail: ${node.id}`}
      className="absolute top-2 right-2 w-56 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60 p-3 z-10 removal-panel-enter"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-200 truncate">
          {node.id}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close detail panel"
          className="ml-2 shrink-0 rounded p-1 text-slate-500 hover:text-slate-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      <div className="space-y-1 mb-2">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-500">Category</span>
          <span className="text-slate-300 capitalize">{node.category}</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-500">Interactions</span>
          <span className="text-slate-300 tabular-nums">{node.interactionCount}</span>
        </div>
        {node.loopCount > 0 && (
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-500">Loops</span>
            <span className="text-fuchsia-300 tabular-nums">{node.loopCount}</span>
          </div>
        )}
        {node.chainCount > 0 && (
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-500">Chains</span>
            <span className="text-sky-300 tabular-nums">{node.chainCount}</span>
          </div>
        )}
      </div>

      {connectedEdges.length > 0 && (
        <div className="border-t border-slate-700/60 pt-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
            Connections ({connectedEdges.length})
          </p>
          <ul className="space-y-0.5 max-h-32 overflow-y-auto">
            {connectedEdges.slice(0, 8).map((e, i) => {
              const partner = e.source === node.id ? e.target : e.source;
              return (
                <li key={i} className="flex items-start gap-1.5 text-[10px]">
                  <span
                    className="mt-0.5 h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ background: TYPE_HEX[e.type] }}
                    aria-hidden="true"
                  />
                  <span className="text-slate-300 truncate">{partner}</span>
                </li>
              );
            })}
            {connectedEdges.length > 8 && (
              <li className="text-[10px] text-slate-500 italic">
                +{connectedEdges.length - 8} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
function InteractionGraphInner({
  analysis,
  centrality,
  selectedTypes,
  cardSearch,
  height = 480,
}: InteractionGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const transformRef = useRef<Transform>({ scale: 1, tx: 0, ty: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const hoveredNodeRef = useRef<string | null>(null);
  const animFrameRef = useRef<number>(0);

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);

  // Derive graph data
  const graphData = useMemo(
    () => buildGraphData(analysis, centrality),
    [analysis, centrality]
  );

  // Apply type filter to edges
  const filteredEdges = useMemo(() => {
    if (!selectedTypes || selectedTypes.size === 0) return graphData.edges;
    return graphData.edges.filter((e) => selectedTypes.has(e.type));
  }, [graphData.edges, selectedTypes]);

  // Issue 4: hide orphaned nodes when a type filter is active
  const visibleNodes = useMemo(() => {
    if (!selectedTypes || selectedTypes.size === 0) return graphData.nodes;
    const connectedCards = new Set<string>();
    for (const edge of filteredEdges) {
      connectedCards.add(edge.source);
      connectedCards.add(edge.target);
    }
    return graphData.nodes.filter((n) => connectedCards.has(n.id));
  }, [graphData.nodes, filteredEdges, selectedTypes]);

  const hiddenCount = graphData.nodes.length - visibleNodes.length;

  // Issue 3: card search — derive matching node ids and their neighbors
  const searchMatches = useMemo(() => {
    if (!cardSearch) return null;
    const q = cardSearch.toLowerCase();
    const matching = new Set<string>(
      visibleNodes.filter((n) => n.id.toLowerCase().includes(q)).map((n) => n.id)
    );
    const neighbors = new Set<string>(matching);
    for (const edge of filteredEdges) {
      if (matching.has(edge.source)) neighbors.add(edge.target);
      if (matching.has(edge.target)) neighbors.add(edge.source);
    }
    return { matching, neighbors };
  }, [cardSearch, visibleNodes, filteredEdges]);

  // Accessibility: check for prefers-reduced-motion
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Node radius helper
  const nodeRadius = useCallback(
    (node: GraphNode): number => {
      const maxC = centrality.maxScore > 0 ? centrality.maxScore : 1;
      const r =
        NODE_RADIUS_BASE +
        (node.centrality / maxC) * NODE_RADIUS_SCALE;
      return Math.min(r, NODE_RADIUS_MAX);
    },
    [centrality.maxScore]
  );

  // ─── Canvas render ──────────────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const { scale, tx, ty } = transformRef.current;
    const positions = positionsRef.current;
    const hoveredNode = hoveredNodeRef.current;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(scale, scale);

    // Build a set of edges connected to the hovered node (for dimming)
    const hoveredEdgeEndpoints = new Set<string>();
    if (hoveredNode) {
      for (const edge of filteredEdges) {
        if (edge.source === hoveredNode || edge.target === hoveredNode) {
          hoveredEdgeEndpoints.add(edge.source);
          hoveredEdgeEndpoints.add(edge.target);
        }
      }
    }

    // ── Draw edges ────────────────────────────────────────────────────────────
    for (const edge of filteredEdges) {
      const src = positions.get(edge.source);
      const tgt = positions.get(edge.target);
      if (!src || !tgt) continue;

      const isConnectedToHover =
        !hoveredNode ||
        edge.source === hoveredNode ||
        edge.target === hoveredNode;

      // Issue 3: dim edges whose endpoints are not in search neighbors
      const isInSearch =
        !searchMatches ||
        (searchMatches.neighbors.has(edge.source) &&
          searchMatches.neighbors.has(edge.target));

      ctx.save();
      const baseAlpha = isConnectedToHover ? 0.85 : 0.15;
      ctx.globalAlpha = isInSearch ? baseAlpha : baseAlpha * 0.2;
      ctx.strokeStyle = TYPE_HEX[edge.type] ?? "#64748b";
      ctx.lineWidth = EDGE_WIDTH_BASE + edge.strength * EDGE_WIDTH_SCALE;

      if (edge.isConditional) {
        ctx.setLineDash([4, 4]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.stroke();
      ctx.restore();
    }

    // ── Draw nodes ────────────────────────────────────────────────────────────
    for (const node of visibleNodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;

      const r = nodeRadius(node);
      const isSelected = selectedNode?.id === node.id;
      const isHovered = hoveredNode === node.id;
      const isDimmedByHover =
        hoveredNode !== null &&
        !isHovered &&
        !hoveredEdgeEndpoints.has(node.id);

      // Issue 3: dim non-neighbors when search is active
      const isSearchMatch = searchMatches?.matching.has(node.id) ?? false;
      const isSearchNeighbor = searchMatches?.neighbors.has(node.id) ?? false;
      const isDimmedBySearch =
        searchMatches !== null && !isSearchNeighbor;

      ctx.save();
      ctx.globalAlpha =
        isDimmedBySearch ? 0.2 : isDimmedByHover ? 0.25 : 1;

      // Fill
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = "#1e293b"; // slate-800
      ctx.fill();

      // Stroke — Issue 3: highlight matching nodes with purple-500
      const isHighlightedSearch = isSearchMatch && !isSelected && !isHovered;
      ctx.lineWidth = isSelected || isHovered || isHighlightedSearch ? 2.5 : 1.5;
      ctx.strokeStyle =
        isSelected || isHovered || isHighlightedSearch
          ? "#a855f7" // purple-500
          : CATEGORY_STROKE[node.category] ?? "#64748b";
      if (isHighlightedSearch) ctx.lineWidth = 3;
      ctx.stroke();

      // Loop indicator: fuchsia glow ring
      if (node.loopCount > 0) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r + 3, 0, Math.PI * 2);
        ctx.strokeStyle = "#c026d3"; // fuchsia-600
        ctx.lineWidth = 1;
        ctx.globalAlpha = isDimmedBySearch || isDimmedByHover ? 0.1 : 0.5;
        ctx.stroke();
      }

      ctx.restore();
    }

    // Issue 2: Draw node labels at sufficient zoom (>= 1.4x)
    if (scale >= 1.4) {
      ctx.save();
      for (const node of visibleNodes) {
        const pos = positions.get(node.id);
        if (!pos) continue;
        const r = nodeRadius(node);
        const label = node.id.length > 18 ? node.id.slice(0, 17) + "\u2026" : node.id;
        const textX = pos.x;
        const textY = pos.y + r + 12;

        // Background rect for legibility
        ctx.font = "9px system-ui, sans-serif";
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(15, 23, 42, 0.8)"; // slate-950 at 80%
        ctx.fillRect(textX - textWidth / 2 - 2, textY - 9, textWidth + 4, 12);

        // Label text
        ctx.fillStyle = "#94a3b8"; // slate-400
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(label, textX, textY - 8);
      }
      ctx.restore();
    }

    ctx.restore();
  }, [visibleNodes, filteredEdges, nodeRadius, selectedNode, searchMatches]);

  // ─── Schedule render ──────────────────────────────────────────────────────
  const scheduleRender = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(render);
  }, [render]);

  // ─── Web Worker: launch layout ────────────────────────────────────────────
  useEffect(() => {
    if (graphData.nodes.length === 0) {
      setLayoutReady(true);
      return;
    }

    const canvas = canvasRef.current;
    const W = canvas?.offsetWidth ?? 800;
    const H = height;

    setLayoutReady(false);
    setWorkerError(null);

    if (prefersReducedMotion) {
      // Arrange nodes in a circle without simulation
      const N = graphData.nodes.length;
      const cx = W / 2;
      const cy = H / 2;
      const r = Math.min(W, H) * 0.38;
      const map = new Map<string, { x: number; y: number }>();
      graphData.nodes.forEach((node, i) => {
        const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
        map.set(node.id, {
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
        });
      });
      positionsRef.current = map;
      setLayoutReady(true);
      return;
    }

    // Terminate any existing worker before creating a new one
    workerRef.current?.terminate();

    let worker: Worker;
    try {
      worker = new Worker(
        new URL("../workers/force-layout.worker.ts", import.meta.url)
      );
    } catch {
      // Fallback: arrange in a circle if worker instantiation fails
      const N = graphData.nodes.length;
      const cx = W / 2;
      const cy = H / 2;
      const radius = Math.min(W, H) * 0.38;
      const map = new Map<string, { x: number; y: number }>();
      graphData.nodes.forEach((node, i) => {
        const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
        map.set(node.id, {
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
        });
      });
      positionsRef.current = map;
      setLayoutReady(true);
      return;
    }

    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { positions } = e.data as {
        positions: { id: string; x: number; y: number }[];
      };
      const map = new Map<string, { x: number; y: number }>();
      for (const p of positions) map.set(p.id, { x: p.x, y: p.y });
      positionsRef.current = map;
      setLayoutReady(true);
    };

    worker.onerror = () => {
      setWorkerError("Force layout worker failed — showing circular layout");
      const N = graphData.nodes.length;
      const cx = W / 2;
      const cy = H / 2;
      const radius = Math.min(W, H) * 0.38;
      const map = new Map<string, { x: number; y: number }>();
      graphData.nodes.forEach((node, i) => {
        const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
        map.set(node.id, {
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
        });
      });
      positionsRef.current = map;
      setLayoutReady(true);
    };

    worker.postMessage({
      nodes: graphData.nodes.map((n) => ({ id: n.id, centrality: n.centrality })),
      edges: filteredEdges.map((e) => ({
        source: e.source,
        target: e.target,
        strength: e.strength,
      })),
      width: W,
      height: H,
    });
    // Note: we pass graphData.nodes (all nodes) to the worker so the force layout
    // has the full graph, then visibleNodes gates which nodes are drawn on canvas.

    return () => worker.terminate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, centrality, height, prefersReducedMotion]);

  // ─── Render whenever layout or selection changes ───────────────────────────
  useEffect(() => {
    if (layoutReady) scheduleRender();
  }, [layoutReady, scheduleRender, selectedNode, filteredEdges]);

  // ─── Resize observer: set canvas dimensions ───────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ro = new ResizeObserver(() => {
      canvas.width = container.offsetWidth * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = `${container.offsetWidth}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); // reset to identity before scaling
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
      if (layoutReady) scheduleRender();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [height, layoutReady, scheduleRender]);

  // ─── Hit-test: find node under canvas (x, y) in world space ──────────────
  const hitTest = useCallback(
    (canvasX: number, canvasY: number): GraphNode | null => {
      const { scale, tx, ty } = transformRef.current;
      const wx = (canvasX - tx) / scale;
      const wy = (canvasY - ty) / scale;

      for (const node of visibleNodes) {
        const pos = positionsRef.current.get(node.id);
        if (!pos) continue;
        const r = nodeRadius(node);
        const dx = wx - pos.x;
        const dy = wy - pos.y;
        if (dx * dx + dy * dy <= (r + 2) * (r + 2)) return node;
      }
      return null;
    },
    [visibleNodes, nodeRadius]
  );

  // ─── Mouse event handlers ──────────────────────────────────────────────────
  const getLocalXY = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getLocalXY(e);
      if (!pos) return;
      const { x, y } = pos;

      if (isDraggingRef.current) {
        const dx = x - dragStartRef.current.x;
        const dy = y - dragStartRef.current.y;
        transformRef.current = {
          ...transformRef.current,
          tx: dragStartRef.current.tx + dx,
          ty: dragStartRef.current.ty + dy,
        };
        scheduleRender();
        return;
      }

      const hit = hitTest(x, y);
      const newHover = hit?.id ?? null;
      if (newHover !== hoveredNodeRef.current) {
        hoveredNodeRef.current = newHover;
        if (canvasRef.current) {
          canvasRef.current.style.cursor = newHover ? "pointer" : "grab";
        }
        scheduleRender();
      }
    },
    [hitTest, scheduleRender]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getLocalXY(e);
      if (!pos) return;
      const { x, y } = pos;
      isDraggingRef.current = true;
      dragStartRef.current = {
        x,
        y,
        tx: transformRef.current.tx,
        ty: transformRef.current.ty,
      };
      if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
    },
    []
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getLocalXY(e);
      if (!pos) return;
      const { x, y } = pos;
      const wasDragging = isDraggingRef.current;
      isDraggingRef.current = false;
      if (canvasRef.current) canvasRef.current.style.cursor = "grab";

      // Only select on click (not drag)
      const dx = Math.abs(x - dragStartRef.current.x);
      const dy = Math.abs(y - dragStartRef.current.y);
      if (wasDragging && (dx > 4 || dy > 4)) return;

      const hit = hitTest(x, y);
      setSelectedNode((prev) =>
        prev?.id === hit?.id ? null : hit
      );
    },
    [hitTest]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const pos = getLocalXY(e as unknown as React.MouseEvent<HTMLCanvasElement>);
      if (!pos) return;
      const { x, y } = pos;
      const delta = -e.deltaY * ZOOM_SPEED;
      const newScale = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, transformRef.current.scale * (1 + delta))
      );
      // Zoom toward cursor
      const ratio = newScale / transformRef.current.scale;
      transformRef.current = {
        scale: newScale,
        tx: x - ratio * (x - transformRef.current.tx),
        ty: y - ratio * (y - transformRef.current.ty),
      };
      scheduleRender();
    },
    [scheduleRender]
  );

  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
    hoveredNodeRef.current = null;
    scheduleRender();
  }, [scheduleRender]);

  // ─── Keyboard navigation ───────────────────────────────────────────────────
  const [focusedNodeIndex, setFocusedNodeIndex] = useState(0);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLCanvasElement>) => {
      if (visibleNodes.length === 0) return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedNodeIndex((i) => (i + 1) % visibleNodes.length);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedNodeIndex(
          (i) => (i - 1 + visibleNodes.length) % visibleNodes.length
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const node = visibleNodes[focusedNodeIndex];
        if (node) setSelectedNode((prev) => (prev?.id === node.id ? null : node));
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSelectedNode(null);
      }
    },
    [visibleNodes, focusedNodeIndex]
  );

  // ─── Reset view ────────────────────────────────────────────────────────────
  const resetView = useCallback(() => {
    transformRef.current = { scale: 1, tx: 0, ty: 0 };
    scheduleRender();
  }, [scheduleRender]);

  // ─── Issue 1: Button zoom (centered on canvas center) ─────────────────────
  const handleZoom = useCallback(
    (factor: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const cx = canvas.offsetWidth / 2;
      const cy = canvas.offsetHeight / 2;
      const current = transformRef.current;
      const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current.scale * factor));
      const ratio = newScale / current.scale;
      transformRef.current = {
        scale: newScale,
        tx: cx - ratio * (cx - current.tx),
        ty: cy - ratio * (cy - current.ty),
      };
      scheduleRender();
    },
    [scheduleRender]
  );

  // ─── Issue 3: Pan to first search match ────────────────────────────────────
  useEffect(() => {
    if (!cardSearch || !layoutReady || !searchMatches) return;
    const firstMatch = visibleNodes.find((n) =>
      n.id.toLowerCase().includes(cardSearch.toLowerCase())
    );
    if (!firstMatch) return;
    const pos = positionsRef.current.get(firstMatch.id);
    if (!pos) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const cw = canvas.offsetWidth;
    const ch = canvas.offsetHeight;
    const { scale } = transformRef.current;
    const targetTx = cw / 2 - pos.x * scale;
    const targetTy = ch / 2 - pos.y * scale;

    if (prefersReducedMotion) {
      transformRef.current = { ...transformRef.current, tx: targetTx, ty: targetTy };
      scheduleRender();
      return;
    }

    // Animate over 300ms
    const startTx = transformRef.current.tx;
    const startTy = transformRef.current.ty;
    const startTime = performance.now();
    const duration = 300;

    const animate = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      transformRef.current = {
        ...transformRef.current,
        tx: startTx + (targetTx - startTx) * eased,
        ty: startTy + (targetTy - startTy) * eased,
      };
      scheduleRender();
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [cardSearch, layoutReady, searchMatches, visibleNodes, prefersReducedMotion, scheduleRender]);

  // ─── Clean up ─────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      workerRef.current?.terminate();
    };
  }, []);

  // ─── Accessible table (sr-only) ───────────────────────────────────────────
  const srTable = useMemo(() => {
    if (visibleNodes.length === 0) return null;
    // Build adjacency: cardName → list of {partner, type, strength}
    const adj = new Map<string, { partner: string; type: string; strength: number }[]>();
    for (const node of visibleNodes) adj.set(node.id, []);
    for (const edge of filteredEdges) {
      adj.get(edge.source)?.push({ partner: edge.target, type: edge.type, strength: edge.strength });
      adj.get(edge.target)?.push({ partner: edge.source, type: edge.type, strength: edge.strength });
    }

    return (
      <table className="sr-only" aria-label="Interaction graph data">
        <thead>
          <tr>
            <th scope="col">Card</th>
            <th scope="col">Category</th>
            <th scope="col">Interactions</th>
          </tr>
        </thead>
        <tbody>
          {visibleNodes.map((node) => {
            const connections = adj.get(node.id) ?? [];
            return (
              <tr key={node.id}>
                <th scope="row">{node.id}</th>
                <td>{node.category}</td>
                <td>
                  {connections.map((c, i) => (
                    <span key={i}>
                      {c.partner} ({c.type}, {Math.round(c.strength * 100)}%)
                      {i < connections.length - 1 ? "; " : ""}
                    </span>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }, [visibleNodes, filteredEdges]);

  // ─── Empty state ───────────────────────────────────────────────────────────
  if (graphData.nodes.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800/30 text-xs text-slate-500 italic"
        style={{ height }}
      >
        No interactions to display — try removing type filters.
      </div>
    );
  }

  // Search label text for the "Focused on" indicator
  const searchLabel = cardSearch
    ? searchMatches && searchMatches.matching.size > 0
      ? Array.from(searchMatches.matching)[0]
      : null
    : null;

  return (
    <div ref={containerRef} className="relative w-full" style={{ height }}>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        role="application"
        aria-label="Interaction graph. Use arrow keys to navigate between nodes, Enter to select, Escape to deselect."
        tabIndex={0}
        className="block w-full rounded-lg border border-slate-700 bg-slate-800/20 outline-none focus-visible:ring-1 focus-visible:ring-purple-500"
        style={{ height, cursor: "grab" }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
      />

      {/* Loading overlay */}
      {!layoutReady && (
        <div
          aria-live="polite"
          className="absolute inset-0 flex items-center justify-center rounded-lg bg-slate-900/70 text-xs text-slate-400"
        >
          <span className="animate-pulse">Computing graph layout…</span>
        </div>
      )}

      {/* Worker error notice */}
      {workerError && (
        <div
          role="status"
          className="absolute top-2 left-2 rounded-md border border-amber-700/50 bg-amber-900/30 px-2 py-1 text-[10px] text-amber-300"
        >
          {workerError}
        </div>
      )}

      {/* Issue 1: Zoom in/out/reset buttons */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => handleZoom(1.3)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-600 bg-slate-800/90 text-sm text-slate-300 hover:bg-slate-700 hover:text-white focus-visible:ring-2 focus-visible:ring-purple-400"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => handleZoom(0.77)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-600 bg-slate-800/90 text-sm text-slate-300 hover:bg-slate-700 hover:text-white focus-visible:ring-2 focus-visible:ring-purple-400"
          aria-label="Zoom out"
        >
          &minus;
        </button>
        <button
          type="button"
          onClick={resetView}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-600 bg-slate-800/90 text-[9px] text-slate-400 hover:bg-slate-700 hover:text-white focus-visible:ring-2 focus-visible:ring-purple-400"
          aria-label="Reset view"
        >
          {"\u27F3"}
        </button>
      </div>

      {/* Issue 5: Card / edge count + Issue 4: isolated badge (bottom-left) */}
      <div className="absolute bottom-3 left-3 flex flex-col items-start gap-1 pointer-events-none">
        <div className="text-[11px] text-slate-500 tabular-nums">
          {visibleNodes.length} cards · {filteredEdges.length} connections
        </div>
        {/* Issue 4: isolated nodes badge */}
        {hiddenCount > 0 && (
          <div className="rounded-md border border-slate-600 bg-slate-800/90 px-2.5 py-1.5 text-[11px] text-slate-400">
            {hiddenCount} isolated cards hidden
          </div>
        )}
        {/* Issue 3: search focus indicator */}
        {searchLabel && (
          <div className="rounded-md border border-purple-700/50 bg-slate-800/90 px-2.5 py-1.5 text-[11px] text-purple-300 pointer-events-auto">
            Focused on: {searchLabel}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          edges={filteredEdges}
          onClose={() => setSelectedNode(null)}
        />
      )}

      {/* Accessible table (screen readers only) */}
      {srTable}
    </div>
  );
}

// Lazy-loadable export
export default InteractionGraphInner;
