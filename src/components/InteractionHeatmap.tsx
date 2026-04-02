"use client";

/**
 * InteractionHeatmap
 *
 * NxN heatmap of card interaction strengths with:
 *
 * - Paginated view (default 30 cards/page) with prev/next cycling + "All" mode
 * - Sticky DOM row labels and column headers (stay visible while scrolling)
 * - Canvas 2D cell grid (only the NxN cells, no labels)
 * - Sort modes: Centrality (default), Alphabetical, Interaction count
 * - Colour ramp with clear zero/nonzero distinction
 * - cardSearch prop: dims non-matching cells, highlights matching rows/columns
 * - Hover tooltip with card pair + interaction count + type
 * - Color legend with tick marks
 * - Accessible: native <table> sr-only mirrors the data
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
import type { HeatmapData } from "@/lib/interaction-graph-data";

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

// ─── Adaptive sizing ─────────────────────────────────────────────────────────
function getCellSize(n: number): number {
  if (n <= 10) return 36;
  if (n <= 20) return 28;
  if (n <= 30) return 24;
  if (n <= 50) return 20;
  return 16;
}

const LABEL_WIDTH = 140;
const HEADER_HEIGHT = 130;
const LABEL_FONT_SIZE = 11;

// ─── Colour ramp (clearer zero/nonzero distinction) ─────────────────────────
function strengthToColor(normalised: number): string {
  if (normalised === 0) return "#1e293b"; // slate-800 — no interaction

  // Nonzero: start at a clearly visible violet, ramp up to fuchsia
  const stops: [number, [number, number, number]][] = [
    [0.01, [59,  42, 120]],   // visible violet (clearly distinct from zero)
    [0.25, [88,  28, 163]],   // violet-800
    [0.5,  [126, 34, 206]],   // purple-700
    [0.75, [168, 85, 247]],   // purple-500
    [1.0,  [232, 121, 249]],  // fuchsia-400
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
  return "rgb(232,121,249)";
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

// ─── Tooltip ──────────────────────────────────────────────────────────────────
interface TooltipInfo {
  clientX: number;
  clientY: number;
  cardA: string;
  cardB: string;
  strength: number;
  type: InteractionType | null;
}

function HeatmapTooltip({ info }: { info: TooltipInfo }) {
  return (
    <div
      role="tooltip"
      style={{
        position: "fixed",
        left: info.clientX + 12,
        top: info.clientY - 44,
        pointerEvents: "none",
        zIndex: 50,
      }}
      className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm shadow-lg max-w-[220px]"
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

// ─── Legend (with tick marks) ─────────────────────────────────────────────────
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
    // Discrete jump from zero to nonzero
    grad.addColorStop(0, strengthToColor(0));
    grad.addColorStop(0.02, strengthToColor(0));
    grad.addColorStop(0.03, strengthToColor(0.01));
    grad.addColorStop(0.25, strengthToColor(0.25));
    grad.addColorStop(0.5, strengthToColor(0.5));
    grad.addColorStop(0.75, strengthToColor(0.75));
    grad.addColorStop(1.0, strengthToColor(1.0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }, []);

  return (
    <div className="mt-3 space-y-0.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-400 shrink-0 w-8 text-right">None</span>
        <canvas
          ref={canvasRef}
          width={240}
          height={14}
          className="rounded"
          aria-label="Colour legend: none to strong"
        />
        <span className="text-[11px] text-slate-400 shrink-0">Strong</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-8" />
        <div className="flex justify-between text-[9px] text-slate-500" style={{ width: 240 }}>
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page size options ───────────────────────────────────────────────────────
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const;

// ─── Main component ───────────────────────────────────────────────────────────
export default function InteractionHeatmap({
  analysis,
  centrality,
  selectedTypes,
  cardSearch,
}: InteractionHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [pageSize, setPageSize] = useState<number>(30);
  const [page, setPage] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>("centrality");
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  // Interaction counts per card (for sort-by-interactions mode)
  const interactionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const interaction of analysis.interactions) {
      counts.set(interaction.cards[0], (counts.get(interaction.cards[0]) ?? 0) + 1);
      counts.set(interaction.cards[1], (counts.get(interaction.cards[1]) ?? 0) + 1);
    }
    return counts;
  }, [analysis.interactions]);

  // Full sorted card list
  const sortedCards = useMemo(() => {
    const s = new Set<string>();
    for (const interaction of analysis.interactions) {
      s.add(interaction.cards[0]);
      s.add(interaction.cards[1]);
    }
    let cards = [...s];

    // Apply type filter first
    if (selectedTypes && selectedTypes.size > 0) {
      const keep = new Set<string>();
      for (const interaction of analysis.interactions) {
        if (selectedTypes.has(interaction.type)) {
          keep.add(interaction.cards[0]);
          keep.add(interaction.cards[1]);
        }
      }
      cards = cards.filter((c) => keep.has(c));
    }

    // Sort
    if (sortMode === "alphabetical") {
      cards.sort((a, b) => a.localeCompare(b));
    } else if (sortMode === "interactions") {
      cards.sort((a, b) =>
        (interactionCounts.get(b) ?? 0) - (interactionCounts.get(a) ?? 0)
      );
    } else {
      const centralityRankMap = new Map(
        centrality.scores.map((s) => [s.cardName, s.rank])
      );
      cards.sort((a, b) => {
        const rankA = centralityRankMap.get(a) ?? Number.MAX_SAFE_INTEGER;
        const rankB = centralityRankMap.get(b) ?? Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;
        return a.localeCompare(b);
      });
    }

    return cards;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis.interactions, selectedTypes, sortMode, centrality.scores]);

  const totalCards = sortedCards.length;

  // Pagination
  const totalPages = pageSize > 0 ? Math.ceil(totalCards / pageSize) : 1;
  const clampedPage = Math.min(page, totalPages - 1);
  const displayCards = pageSize > 0
    ? sortedCards.slice(clampedPage * pageSize, (clampedPage + 1) * pageSize)
    : sortedCards;

  // Reset page when sort/filter/pageSize changes
  useEffect(() => { setPage(0); }, [sortMode, selectedTypes, pageSize]);

  // Build matrix for the displayed cards
  const displayHeatmap = useMemo((): HeatmapData => {
    const N = displayCards.length;
    if (N === 0) return { cardNames: [], matrix: [], typeMatrix: [], maxStrength: 0 };

    const indexMap = new Map(displayCards.map((c, i) => [c, i]));
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

    return { cardNames: displayCards, matrix, typeMatrix: typeMap, maxStrength };
  }, [displayCards, selectedTypes, analysis.interactions]);

  const { cardNames, matrix, typeMatrix, maxStrength } = displayHeatmap;
  const N = cardNames.length;
  const CELL_SIZE = getCellSize(N);

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

  // ─── Canvas render (cells only — no labels) ────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || N === 0) return;

    const W = N * CELL_SIZE;
    const H = N * CELL_SIZE;

    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, W, H);

    // Search highlight sweeps
    if (hasSearch) {
      ctx.fillStyle = "rgba(168, 85, 247, 0.12)";
      for (const idx of matchingIndices) {
        ctx.fillRect(0, idx * CELL_SIZE, W, CELL_SIZE);
        ctx.fillRect(idx * CELL_SIZE, 0, CELL_SIZE, H);
      }
    }

    // Cells
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const x = j * CELL_SIZE;
        const y = i * CELL_SIZE;

        if (i === j) {
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
          ctx.strokeStyle = "#0f172a";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
          continue;
        }

        const strength = matrix[i][j];
        const normalised = maxStrength > 0 ? Math.min(1, strength / maxStrength) : 0;

        if (hasSearch && !matchingIndices.has(i) && !matchingIndices.has(j)) {
          ctx.globalAlpha = 0.3;
        }

        ctx.fillStyle = strengthToColor(normalised);
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

        ctx.strokeStyle = "rgba(15,23,42,0.6)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);

        ctx.globalAlpha = 1.0;
      }
    }

    // Search highlight borders
    if (hasSearch) {
      for (const idx of matchingIndices) {
        ctx.strokeStyle = "#c084fc";
        ctx.lineWidth = 2;
        // Row highlight
        ctx.strokeRect(0, idx * CELL_SIZE, W, CELL_SIZE);
        // Column highlight
        ctx.strokeRect(idx * CELL_SIZE, 0, CELL_SIZE, H);
      }
    }
  }, [cardNames, matrix, maxStrength, N, CELL_SIZE, matchingIndices, hasSearch]);

  // ─── Hover tooltip ─────────────────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const j = Math.floor(mx / CELL_SIZE);
      const i = Math.floor(my / CELL_SIZE);

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
        clientX: e.clientX,
        clientY: e.clientY,
        cardA: cardNames[i],
        cardB: cardNames[j],
        strength,
        type: typeMatrix[i]?.[j] ?? null,
      });
    },
    [N, matrix, cardNames, typeMatrix, CELL_SIZE]
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  // ─── Dimensions ────────────────────────────────────────────────────────────
  const gridW = N * CELL_SIZE;
  const gridH = N * CELL_SIZE;

  // ─── Status line ───────────────────────────────────────────────────────────
  const statusText = useMemo(() => {
    const sortLabel =
      sortMode === "centrality" ? "centrality"
        : sortMode === "alphabetical" ? "A–Z"
        : "interaction count";
    if (pageSize === 0) {
      return `Showing all ${totalCards} cards, sorted by ${sortLabel}`;
    }
    const start = clampedPage * pageSize + 1;
    const end = Math.min((clampedPage + 1) * pageSize, totalCards);
    return `Showing cards ${start}–${end} of ${totalCards}, sorted by ${sortLabel}`;
  }, [sortMode, pageSize, totalCards, clampedPage]);

  // ─── Empty state ───────────────────────────────────────────────────────────
  if (totalCards === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800/30 py-12 text-xs text-slate-500 italic">
        No interactions to display — try removing type filters.
      </div>
    );
  }

  return (
    <div className="w-full space-y-3 overflow-hidden">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Sort mode */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-500 shrink-0">Sort:</span>
          {(["centrality", "alphabetical", "interactions"] as SortMode[]).map(
            (mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSortMode(mode)}
                className={`rounded-md border px-2 py-0.5 text-[11px] transition-colors cursor-pointer ${
                  sortMode === mode
                    ? "border-purple-500 bg-purple-900/20 text-purple-300 font-medium"
                    : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                }`}
              >
                {mode === "centrality" ? "Centrality"
                  : mode === "alphabetical" ? "A–Z"
                  : "Interactions"}
              </button>
            )
          )}
        </div>

        {/* Page size selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-500 shrink-0">Per page:</span>
          {PAGE_SIZE_OPTIONS.filter((s) => s < totalCards).map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setPageSize(size)}
              className={`rounded-md border px-2 py-0.5 text-[11px] transition-colors cursor-pointer ${
                pageSize === size
                  ? "border-purple-500 bg-purple-900/20 text-purple-300 font-medium"
                  : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
              }`}
            >
              {size}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPageSize(0)}
            className={`rounded-md border px-2 py-0.5 text-[11px] transition-colors cursor-pointer ${
              pageSize === 0
                ? "border-purple-500 bg-purple-900/20 text-purple-300 font-medium"
                : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
            }`}
          >
            All {totalCards}
          </button>
        </div>

        {/* Pagination controls (hidden when showing all) */}
        {pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              disabled={clampedPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-md border border-slate-700 bg-slate-800/50 px-2 py-0.5 text-[11px] text-slate-400 hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Previous page"
            >
              ‹ Prev
            </button>
            <span className="text-[11px] text-slate-400 tabular-nums">
              {clampedPage + 1} / {totalPages}
            </span>
            <button
              type="button"
              disabled={clampedPage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="rounded-md border border-slate-700 bg-slate-800/50 px-2 py-0.5 text-[11px] text-slate-400 hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Next page"
            >
              Next ›
            </button>
          </div>
        )}
      </div>

      {/* Status line */}
      <p className="text-[11px] text-slate-500" aria-live="polite">
        {statusText}
      </p>

      {/* Scroll container with sticky headers via CSS Grid */}
      <div
        ref={containerRef}
        className="w-full overflow-auto rounded-lg border border-slate-700"
        style={{ maxHeight: "80vh" }}
        tabIndex={0}
        role="region"
        aria-label={`Interaction heatmap: ${N} cards. Scroll to explore.`}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${LABEL_WIDTH}px ${gridW}px`,
            gridTemplateRows: `${HEADER_HEIGHT}px ${gridH}px`,
            width: LABEL_WIDTH + gridW,
          }}
        >
          {/* ── Corner cell (sticky top + left) ─────────────────────────── */}
          <div
            style={{
              position: "sticky",
              top: 0,
              left: 0,
              zIndex: 3,
              background: "#0f172a",
              borderBottom: "1px solid #334155",
              borderRight: "1px solid #334155",
            }}
          />

          {/* ── Column headers (sticky top) ─────────────────────────────── */}
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 2,
              background: "#0f172a",
              borderBottom: "1px solid #334155",
              height: HEADER_HEIGHT,
              width: gridW,
            }}
          >
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
              {cardNames.map((name, j) => {
                const isMatch = matchingIndices.has(j);
                const dimmed = hasSearch && !isMatch;
                return (
                  <div
                    key={name}
                    title={name}
                    style={{
                      position: "absolute",
                      left: j * CELL_SIZE,
                      bottom: 0,
                      width: CELL_SIZE,
                      height: HEADER_HEIGHT,
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "flex-start",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        transformOrigin: "bottom left",
                        transform: "rotate(-55deg) translateX(2px)",
                        fontSize: LABEL_FONT_SIZE,
                        lineHeight: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: HEADER_HEIGHT - 10,
                        color: dimmed ? "#475569" : isMatch ? "#c084fc" : "#94a3b8",
                        fontWeight: isMatch ? 600 : 400,
                      }}
                    >
                      {name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Row labels (sticky left) ────────────────────────────────── */}
          <div
            style={{
              position: "sticky",
              left: 0,
              zIndex: 1,
              background: "#0f172a",
              borderRight: "1px solid #334155",
              width: LABEL_WIDTH,
            }}
          >
            {cardNames.map((name, i) => {
              const isMatch = matchingIndices.has(i);
              const dimmed = hasSearch && !isMatch;
              return (
                <div
                  key={name}
                  title={name}
                  style={{
                    height: CELL_SIZE,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    paddingRight: 6,
                    fontSize: LABEL_FONT_SIZE,
                    color: dimmed ? "#475569" : isMatch ? "#c084fc" : "#94a3b8",
                    fontWeight: isMatch ? 600 : 400,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {name}
                </div>
              );
            })}
          </div>

          {/* ── Cell canvas ─────────────────────────────────────────────── */}
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
              display: "block",
              width: gridW,
              height: gridH,
              minWidth: gridW,
              minHeight: gridH,
            }}
            aria-label={`Interaction heatmap cells: ${N} cards`}
          />
        </div>
      </div>

      {/* Tooltip (fixed position — follows cursor) */}
      {tooltip && <HeatmapTooltip info={tooltip} />}

      {/* Colour legend */}
      <ColorLegend />

      {/* Accessible sr-only table */}
      <table className="sr-only" aria-label="Interaction heatmap data">
        <caption>
          Interaction strength matrix — {N} cards
          {pageSize > 0 && ` (page ${clampedPage + 1} of ${totalPages})`}
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
