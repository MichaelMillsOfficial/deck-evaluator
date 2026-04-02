"use client";

/**
 * InteractionHeatmap
 *
 * Canvas 2D NxN heatmap of card interaction strengths.
 *
 * - Card count selector: 10 / 20 / 30 / 50 / All N (hidden when total ≤ 30)
 * - Sort modes: Centrality (default), Alphabetical, Interaction count
 * - Adaptive cell size based on card count (36px → 14px)
 * - Colour ramp: #1e293b (none) → #4c1d95 (weak) → #7e22ce (mod) → #a855f7 (strong) → #e879f9 (max)
 * - cardSearch prop: dims non-matching cells, highlights matching rows/columns
 * - "Showing X of Y" status line above canvas
 * - Hover tooltip: card pair + interaction count + strongest type
 * - Color legend bar below matrix
 * - Offscreen canvas for rendering; drawImage() to visible canvas
 * - Accessible: native <table> sr-only mirrors the data with aria-labels
 * - Respects prefers-reduced-motion (heatmap is static, so no change needed)
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
  buildHeatmapData,
  type HeatmapData,
} from "@/lib/interaction-graph-data";

// ─── Props ────────────────────────────────────────────────────────────────────
interface InteractionHeatmapProps {
  analysis: InteractionAnalysis;
  centrality: CentralityResult;
  selectedTypes?: Set<InteractionType>;
  /** When non-empty, dims non-matching cells and highlights matching rows/cols */
  cardSearch?: string;
}

// ─── Sort modes ───────────────────────────────────────────────────────────────
type SortMode = "centrality" | "alphabetical" | "interactions";

// ─── Adaptive sizing helpers ───────────────────────────────────────────────────
function getCellSize(n: number): number {
  if (n <= 10) return 36;
  if (n <= 20) return 28;
  if (n <= 30) return 22;
  if (n <= 50) return 18;
  return 14;
}

function getTruncateLen(n: number): number {
  if (n <= 10) return 22;
  if (n <= 20) return 17;
  if (n <= 30) return 14;
  if (n <= 50) return 11;
  return 9;
}

function getHeaderHeight(n: number): number {
  if (n <= 20) return 110;
  if (n <= 30) return 100;
  return 90;
}

function getLabelWidth(n: number): number {
  if (n <= 20) return 110;
  if (n <= 30) return 100;
  return 80;
}

// ─── Colour ramp (5 stops, dark slate → vivid fuchsia) ───────────────────────
function strengthToColor(
  normalised: number // 0–1
): string {
  // 0   → #1e293b (slate-800 — zero)
  // 0.2 → #4c1d95 (violet-900 — weak)
  // 0.5 → #7e22ce (purple-800 — moderate)
  // 0.8 → #a855f7 (purple-500 — strong)
  // 1.0 → #e879f9 (fuchsia-400 — max)
  const stops: [number, [number, number, number]][] = [
    [0,   [30,  41,  59]],   // #1e293b
    [0.2, [76,  29,  149]],  // #4c1d95
    [0.5, [126, 34,  206]],  // #7e22ce
    [0.8, [168, 85,  247]],  // #a855f7
    [1.0, [232, 121, 249]],  // #e879f9
  ];

  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (normalised <= t1) {
      const t = (normalised - t0) / (t1 - t0);
      const r = Math.round(c0[0] + t * (c1[0] - c0[0]));
      const g = Math.round(c0[1] + t * (c1[1] - c0[1]));
      const b = Math.round(c0[2] + t * (c1[2] - c0[2]));
      return `rgb(${r},${g},${b})`;
    }
  }
  return `rgb(232,121,249)`;
}

const INTERACTION_TYPE_LABELS: Partial<Record<InteractionType, string>> = {
  enables: "Enables",
  triggers: "Triggers",
  amplifies: "Amplifies",
  protects: "Protects",
  recurs: "Recurs",
  reduces_cost: "Reduces Cost",
  tutors_for: "Tutors For",
  blocks: "Blocks",
  conflicts: "Conflicts",
  loops_with: "Loops With",
};

function truncateName(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + "…";
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
interface TooltipInfo {
  x: number;
  y: number;
  cardA: string;
  cardB: string;
  strength: number;
  type: InteractionType | null;
}

function HeatmapTooltip({ info }: { info: TooltipInfo }) {
  return (
    <div
      role="tooltip"
      style={{ left: info.x + 10, top: info.y - 40 }}
      className="pointer-events-none absolute z-20 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm shadow-lg max-w-[180px]"
    >
      <p className="text-xs font-semibold text-slate-200 truncate">{info.cardA}</p>
      <p className="text-xs font-semibold text-slate-200 truncate">{info.cardB}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">
        Strength: {Math.round(info.strength * 100)}%
        {info.type && (
          <> · {INTERACTION_TYPE_LABELS[info.type] ?? info.type}</>
        )}
      </p>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function ColorLegend() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    const stops = [0, 0.2, 0.5, 0.8, 1.0];
    stops.forEach((t) => grad.addColorStop(t, strengthToColor(t)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }, []);

  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="text-[10px] text-slate-500 shrink-0">None</span>
      <canvas
        ref={canvasRef}
        width={200}
        height={12}
        className="rounded"
        aria-label="Colour legend: none to strong"
      />
      <span className="text-[10px] text-slate-500 shrink-0">Strong</span>
    </div>
  );
}

// ─── Card limit options ───────────────────────────────────────────────────────
/** 0 is the sentinel value meaning "show all" */
const CARD_LIMIT_OPTIONS = [10, 20, 30, 50] as const;

// ─── Main component ───────────────────────────────────────────────────────────
export default function InteractionHeatmap({
  analysis,
  centrality,
  selectedTypes,
  cardSearch,
}: InteractionHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<OffscreenCanvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /** 0 = show all */
  const [cardLimit, setCardLimit] = useState<number>(30);
  const [sortMode, setSortMode] = useState<SortMode>("centrality");
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  // Build full heatmap data (all eligible cards, up to 30 by default)
  const baseHeatmap = useMemo(
    () => buildHeatmapData(analysis, centrality),
    [analysis, centrality]
  );

  // Interaction counts per card (for sort-by-interactions mode)
  const interactionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const interaction of analysis.interactions) {
      counts.set(interaction.cards[0], (counts.get(interaction.cards[0]) ?? 0) + 1);
      counts.set(interaction.cards[1], (counts.get(interaction.cards[1]) ?? 0) + 1);
    }
    return counts;
  }, [analysis.interactions]);

  // Total participating cards across the whole analysis (for selector + "All N" label)
  const totalParticipatingCards = useMemo(() => {
    const s = new Set<string>();
    for (const interaction of analysis.interactions) {
      s.add(interaction.cards[0]);
      s.add(interaction.cards[1]);
    }
    return s.size;
  }, [analysis.interactions]);

  // Sorted + limited card list
  const displayHeatmap = useMemo((): HeatmapData => {
    // Start from the baseHeatmap's card list (already sorted by centrality, capped at 30)
    let cards = [...baseHeatmap.cardNames];

    if (cardLimit === 0) {
      // Include all cards that appear in interactions
      const all = new Set<string>();
      for (const interaction of analysis.interactions) {
        all.add(interaction.cards[0]);
        all.add(interaction.cards[1]);
      }
      cards = [...all];
    }

    // Apply sort
    if (sortMode === "alphabetical") {
      cards = [...cards].sort((a, b) => a.localeCompare(b));
    } else if (sortMode === "interactions") {
      cards = [...cards].sort((a, b) =>
        (interactionCounts.get(b) ?? 0) - (interactionCounts.get(a) ?? 0)
      );
    } else {
      // centrality — rank-ordered, expand if showing all
      const centralityRankMap = new Map(
        centrality.scores.map((s) => [s.cardName, s.rank])
      );
      cards = [...cards].sort((a, b) => {
        const rankA = centralityRankMap.get(a) ?? Number.MAX_SAFE_INTEGER;
        const rankB = centralityRankMap.get(b) ?? Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;
        return a.localeCompare(b);
      });
    }

    // Apply card count limit (when not "show all")
    if (cardLimit > 0) {
      cards = cards.slice(0, cardLimit);
    }

    // Apply type filter — keep card if it has at least one interaction of a selected type
    let filteredCards = cards;
    if (selectedTypes && selectedTypes.size > 0) {
      const keep = new Set<string>();
      for (const interaction of analysis.interactions) {
        if (selectedTypes.has(interaction.type)) {
          keep.add(interaction.cards[0]);
          keep.add(interaction.cards[1]);
        }
      }
      filteredCards = cards.filter((c) => keep.has(c));
    }

    // Rebuild matrix for the final card list
    const N = filteredCards.length;
    if (N === 0) return { cardNames: [], matrix: [], typeMatrix: [], maxStrength: 0 };

    const indexMap = new Map(filteredCards.map((c, i) => [c, i]));
    const matrix: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
    const typeMap: (InteractionType | null)[][] = Array.from({ length: N }, () => new Array(N).fill(null));
    const typeStrength: Map<string, Map<InteractionType, number>> = new Map();

    for (const interaction of analysis.interactions) {
      if (selectedTypes && selectedTypes.size > 0 && !selectedTypes.has(interaction.type)) continue;
      const i = indexMap.get(interaction.cards[0]);
      const j = indexMap.get(interaction.cards[1]);
      if (i === undefined || j === undefined || i === j) continue;
      matrix[i][j] += interaction.strength;
      matrix[j][i] += interaction.strength;

      const cellKey = `${Math.min(i, j)}-${Math.max(i, j)}`;
      if (!typeStrength.has(cellKey)) typeStrength.set(cellKey, new Map());
      const tMap = typeStrength.get(cellKey)!;
      tMap.set(interaction.type, (tMap.get(interaction.type) ?? 0) + interaction.strength);
    }

    for (const [key, tMap] of typeStrength) {
      const [iStr, jStr] = key.split("-");
      const i = parseInt(iStr, 10);
      const j = parseInt(jStr, 10);
      let dom: InteractionType | null = null;
      let maxS = 0;
      for (const [t, s] of tMap) {
        if (s > maxS) { maxS = s; dom = t; }
      }
      typeMap[i][j] = dom;
      typeMap[j][i] = dom;
    }

    let maxStrength = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (i !== j && matrix[i][j] > maxStrength) maxStrength = matrix[i][j];
      }
    }

    return { cardNames: filteredCards, matrix, typeMatrix: typeMap, maxStrength };
  // Note: interactionCounts is intentionally omitted — it is derived from analysis.interactions
  // which is already in the dependency array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseHeatmap, cardLimit, sortMode, selectedTypes, analysis.interactions, centrality.scores]);

  const { cardNames, matrix, typeMatrix, maxStrength } = displayHeatmap;
  const N = cardNames.length;

  // ─── Adaptive sizing (recalculated whenever N changes) ──────────────────────
  const CELL_SIZE    = getCellSize(N);
  const TRUNCATE_LEN = getTruncateLen(N);
  const HEADER_HEIGHT = getHeaderHeight(N);
  const LABEL_WIDTH   = getLabelWidth(N);

  // ─── Search matching indices ─────────────────────────────────────────────────
  const matchingIndices = useMemo(() => {
    if (!cardSearch || cardSearch.trim() === "") return new Set<number>();
    const q = cardSearch.trim().toLowerCase();
    const result = new Set<number>();
    for (let i = 0; i < cardNames.length; i++) {
      if (cardNames[i].toLowerCase().includes(q)) result.add(i);
    }
    return result;
  }, [cardSearch, cardNames]);

  const hasSearch = matchingIndices.size > 0 || (cardSearch !== undefined && cardSearch.trim().length > 0);

  // ─── Canvas render ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || N === 0) return;

    const W = LABEL_WIDTH + N * CELL_SIZE;
    const H = HEADER_HEIGHT + N * CELL_SIZE;

    // Set canvas buffer size (style dimensions are set via JSX props)
    canvas.width = W;
    canvas.height = H;

    // Use OffscreenCanvas when available for perf
    let offscreen: OffscreenCanvas | null = null;
    let renderCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    try {
      offscreen = new OffscreenCanvas(W, H);
      offscreenRef.current = offscreen;
      renderCtx = offscreen.getContext("2d") as OffscreenCanvasRenderingContext2D;
    } catch {
      renderCtx = canvas.getContext("2d");
    }

    if (!renderCtx) return;
    const ctx = renderCtx;

    // Background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, W, H);

    // ── Search highlight: full row/column sweeps for matching cards ────────────
    if (hasSearch) {
      ctx.fillStyle = "rgba(168, 85, 247, 0.12)"; // purple-500 @12%
      for (const idx of matchingIndices) {
        // Highlight full row (across entire grid width)
        ctx.fillRect(LABEL_WIDTH, HEADER_HEIGHT + idx * CELL_SIZE, N * CELL_SIZE, CELL_SIZE);
        // Highlight full column (across entire grid height)
        ctx.fillRect(LABEL_WIDTH + idx * CELL_SIZE, HEADER_HEIGHT, CELL_SIZE, N * CELL_SIZE);
      }
    }

    // ── Cells ──────────────────────────────────────────────────────────────────
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const x = LABEL_WIDTH + j * CELL_SIZE;
        const y = HEADER_HEIGHT + i * CELL_SIZE;

        if (i === j) {
          // Diagonal — dark crosshatch
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
          ctx.strokeStyle = "#0f172a";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
          continue;
        }

        const strength = matrix[i][j];
        const normalised = maxStrength > 0 ? Math.min(1, strength / maxStrength) : 0;

        // When searching, dim non-matching cells to 30% opacity
        if (hasSearch && !matchingIndices.has(i) && !matchingIndices.has(j)) {
          ctx.globalAlpha = 0.3;
        }

        ctx.fillStyle = strengthToColor(normalised);
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

        // Cell border
        ctx.strokeStyle = "rgba(15,23,42,0.6)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);

        ctx.globalAlpha = 1.0;
      }
    }

    // ── Column headers (rotated 45°) ──────────────────────────────────────────
    const fontSize = Math.max(8, Math.min(10, CELL_SIZE - 10));
    ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = "bottom";

    for (let j = 0; j < N; j++) {
      const isMatch = matchingIndices.has(j);
      ctx.fillStyle = hasSearch && !isMatch ? "#475569" : "#94a3b8"; // dim if no match
      const x = LABEL_WIDTH + j * CELL_SIZE + CELL_SIZE / 2;
      const y = HEADER_HEIGHT - 4;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(truncateName(cardNames[j], TRUNCATE_LEN), 0, 0);
      ctx.restore();

      // 2px purple-400 border for matching column labels
      if (isMatch) {
        ctx.strokeStyle = "#c084fc"; // purple-400
        ctx.lineWidth = 2;
        ctx.strokeRect(
          LABEL_WIDTH + j * CELL_SIZE,
          HEADER_HEIGHT,
          CELL_SIZE,
          N * CELL_SIZE
        );
      }
    }

    // ── Row labels ─────────────────────────────────────────────────────────────
    ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";

    for (let i = 0; i < N; i++) {
      const isMatch = matchingIndices.has(i);
      ctx.fillStyle = hasSearch && !isMatch ? "#475569" : "#94a3b8";
      const y = HEADER_HEIGHT + i * CELL_SIZE + CELL_SIZE / 2;
      ctx.fillText(truncateName(cardNames[i], TRUNCATE_LEN), LABEL_WIDTH - 4, y);

      // 2px purple-400 border for matching row labels
      if (isMatch) {
        ctx.strokeStyle = "#c084fc"; // purple-400
        ctx.lineWidth = 2;
        ctx.strokeRect(
          LABEL_WIDTH,
          HEADER_HEIGHT + i * CELL_SIZE,
          N * CELL_SIZE,
          CELL_SIZE
        );
      }
    }

    ctx.textAlign = "left";

    // ── Copy offscreen to visible canvas ──────────────────────────────────────
    if (offscreen) {
      const onscreen = canvas.getContext("2d");
      if (onscreen) {
        onscreen.clearRect(0, 0, W, H);
        onscreen.drawImage(offscreen, 0, 0);
      }
    }
  }, [
    cardNames,
    matrix,
    maxStrength,
    N,
    CELL_SIZE,
    TRUNCATE_LEN,
    HEADER_HEIGHT,
    LABEL_WIDTH,
    matchingIndices,
    hasSearch,
  ]);

  // ─── Hover tooltip ─────────────────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const j = Math.floor((mx - LABEL_WIDTH) / CELL_SIZE);
      const i = Math.floor((my - HEADER_HEIGHT) / CELL_SIZE);

      if (i < 0 || i >= N || j < 0 || j >= N || i === j) {
        setTooltip(null);
        return;
      }

      const strength = matrix[i][j];
      if (strength === 0) {
        setTooltip(null);
        return;
      }

      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        cardA: cardNames[i],
        cardB: cardNames[j],
        strength,
        type: typeMatrix[i]?.[j] ?? null,
      });
    },
    [N, matrix, cardNames, typeMatrix, LABEL_WIDTH, CELL_SIZE, HEADER_HEIGHT]
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  // ─── Dynamic container sizing ────────────────────────────────────────────────
  // The canvas can be wider/taller than the viewport (e.g. 100 cards at 14px = 1480px).
  // Cap the container to a sensible viewport and let the user scroll WITHIN it.
  const canvasW = LABEL_WIDTH + N * CELL_SIZE;
  const canvasH = HEADER_HEIGHT + N * CELL_SIZE;
  // Let the container grow taller for large matrices — cap at 80vh so
  // it never pushes the page controls off-screen, but still shows much
  // more of the grid than the old 600px hard cap.
  const containerMaxHeight = canvasH + 16;
  // ─── Status line text ───────────────────────────────────────────────────────
  const statusText = useMemo(() => {
    const sortLabel =
      sortMode === "centrality"
        ? "centrality"
        : sortMode === "alphabetical"
        ? "A–Z"
        : "interaction count";
    if (N === totalParticipatingCards) {
      return `Showing all ${N} cards`;
    }
    return `Showing top ${N} of ${totalParticipatingCards} cards, sorted by ${sortLabel}`;
  }, [N, totalParticipatingCards, sortMode]);

  // ─── Empty state ───────────────────────────────────────────────────────────
  if (baseHeatmap.cardNames.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800/30 py-12 text-xs text-slate-500 italic">
        No interactions to display — try removing type filters.
      </div>
    );
  }

  return (
    <div className="space-y-3 min-w-0" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)" }}>
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Sort mode */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500 shrink-0">Sort:</span>
          {(["centrality", "alphabetical", "interactions"] as SortMode[]).map(
            (mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSortMode(mode)}
                className={`rounded-md border px-2 py-0.5 text-[10px] transition-colors cursor-pointer ${
                  sortMode === mode
                    ? "border-purple-500 bg-purple-900/20 text-purple-300 font-medium"
                    : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                }`}
              >
                {mode === "centrality"
                  ? "Centrality"
                  : mode === "alphabetical"
                  ? "A–Z"
                  : "Interactions"}
              </button>
            )
          )}
        </div>

        {/* Card count selector — only shown when total > 30 */}
        {totalParticipatingCards > 30 && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 shrink-0">Show:</span>
            {CARD_LIMIT_OPTIONS.map((limit) => (
              <button
                key={limit}
                type="button"
                onClick={() => setCardLimit(limit)}
                className={`rounded-md border px-2 py-0.5 text-[10px] transition-colors cursor-pointer ${
                  cardLimit === limit
                    ? "border-purple-500 bg-purple-900/20 text-purple-300 font-medium"
                    : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                }`}
              >
                {limit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCardLimit(0)}
              className={`rounded-md border px-2 py-0.5 text-[10px] transition-colors cursor-pointer ${
                cardLimit === 0
                  ? "border-purple-500 bg-purple-900/20 text-purple-300 font-medium"
                  : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
              }`}
            >
              All {totalParticipatingCards}
            </button>
          </div>
        )}
      </div>

      {/* Status line */}
      <p className="text-[11px] text-slate-500" aria-live="polite">
        {statusText}
      </p>

      {/* Scroll container: grid parent with minmax(0,1fr) constrains this div's
           width to the available space. overflow-auto creates internal scrollbars. */}
      <div
        ref={containerRef}
        className="relative overflow-auto rounded-lg border border-slate-700 min-w-0"
        style={{ maxHeight: `min(${containerMaxHeight}px, 80vh)` }}
        tabIndex={0}
        role="region"
        aria-label={`Interaction heatmap: ${N} cards. Scroll to explore.`}
      >
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ display: "block", width: canvasW, height: canvasH, minWidth: canvasW, minHeight: canvasH }}
          aria-label={`Interaction heatmap: ${N} cards`}
        />
        {tooltip && <HeatmapTooltip info={tooltip} />}
      </div>

      {/* Scroll hint when canvas is large enough that scrolling may be needed */}
      {N > 30 && (
        <p className="text-[10px] text-slate-500 italic">
          Scroll within the heatmap to see all {N} cards
        </p>
      )}

      {/* Colour legend */}
      <ColorLegend />

      {/* Accessible sr-only table */}
      <table className="sr-only" aria-label="Interaction heatmap data">
        <caption>
          Interaction strength matrix — {N} cards
        </caption>
        <thead>
          <tr>
            <th scope="col">Card</th>
            {cardNames.map((name) => (
              <th key={name} scope="col">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cardNames.map((rowCard, i) => (
            <tr key={rowCard}>
              <th scope="row">{rowCard}</th>
              {cardNames.map((colCard, j) => (
                <td
                  key={colCard}
                  aria-label={
                    i === j
                      ? `${rowCard} — self`
                      : matrix[i][j] > 0
                      ? `${rowCard} × ${colCard}: ${Math.round(matrix[i][j] * 100)}% (${typeMatrix[i]?.[j] ?? "mixed"})`
                      : `${rowCard} × ${colCard}: none`
                  }
                >
                  {i === j ? "—" : Math.round((matrix[i][j] ?? 0) * 100)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
