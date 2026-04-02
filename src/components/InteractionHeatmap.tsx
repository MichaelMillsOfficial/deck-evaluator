"use client";

/**
 * InteractionHeatmap
 *
 * NxN heatmap of card interaction strengths with:
 *
 * - Paginated view (default 30 cards/page) with prev/next cycling + "All" mode
 * - Sticky DOM row labels and column headers (stay visible while scrolling)
 * - Canvas 2D cell grid with dual encoding (colour + diagonal density pattern)
 * - Sort modes: Centrality (default), Alphabetical, Interaction count
 * - Colour ramp with clear zero/nonzero distinction
 * - cardSearch prop: dims non-matching cells, highlights matching rows/columns
 * - Persistent tooltip: stays until cursor moves to a different cell
 * - Keyboard navigation: arrow keys move focus cell, Enter/Space pins tooltip
 * - Touch support: tap to show tooltip, tap elsewhere to dismiss
 * - CSS zoom slider for zooming into regions of the matrix
 * - Scroll overflow shadow indicators on all four edges
 * - Color legend with tick marks
 * - Accessible: native <table> sr-only mirrors the data, aria-live cell announcements
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
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;

// ─── Colour ramp ─────────────────────────────────────────────────────────────
function strengthToColor(normalised: number): string {
  if (normalised === 0) return "#1e293b";

  const stops: [number, [number, number, number]][] = [
    [0.01, [59, 42, 120]],
    [0.25, [88, 28, 163]],
    [0.5, [126, 34, 206]],
    [0.75, [168, 85, 247]],
    [1.0, [232, 121, 249]],
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

/** Draw diagonal stripes as a secondary encoding for interaction strength.
 *  Stronger interactions = denser stripes.  Zero = no stripes. */
function drawStripePattern(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  normalised: number
) {
  if (normalised === 0) return;
  // Stripe spacing: 12px (weak) → 4px (strong)
  const spacing = Math.round(12 - normalised * 8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  for (let d = -size; d < size * 2; d += spacing) {
    ctx.beginPath();
    ctx.moveTo(x + d, y);
    ctx.lineTo(x + d + size, y + size);
    ctx.stroke();
  }
  ctx.restore();
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
  row: number;
  col: number;
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
    grad.addColorStop(0, strengthToColor(0));
    grad.addColorStop(0.02, strengthToColor(0));
    grad.addColorStop(0.03, strengthToColor(0.01));
    grad.addColorStop(0.25, strengthToColor(0.25));
    grad.addColorStop(0.5, strengthToColor(0.5));
    grad.addColorStop(0.75, strengthToColor(0.75));
    grad.addColorStop(1.0, strengthToColor(1.0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Diagonal stripe overlay on legend to show dual encoding
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 1) {
      const norm = x / W;
      if (norm < 0.03) continue;
      const spacing = Math.round(12 - norm * 8);
      if (x % spacing === 0) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + H, H);
        ctx.stroke();
      }
    }
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
          aria-label="Colour legend: none to strong, with diagonal stripe density as secondary indicator"
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

// ─── Scroll shadow hook ──────────────────────────────────────────────────────
function useScrollShadows(ref: React.RefObject<HTMLDivElement | null>) {
  const [shadows, setShadows] = useState({ top: false, bottom: false, left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function update() {
      if (!el) return;
      setShadows({
        top: el.scrollTop > 2,
        bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 2,
        left: el.scrollLeft > 2,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
      });
    }

    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [ref]);

  return shadows;
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
  const [focusCell, setFocusCell] = useState<{ row: number; col: number } | null>(null);
  const [zoom, setZoom] = useState(1);

  const shadows = useScrollShadows(containerRef);

  // ─── Computed data ─────────────────────────────────────────────────────────
  const interactionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const interaction of analysis.interactions) {
      counts.set(interaction.cards[0], (counts.get(interaction.cards[0]) ?? 0) + 1);
      counts.set(interaction.cards[1], (counts.get(interaction.cards[1]) ?? 0) + 1);
    }
    return counts;
  }, [analysis.interactions]);

  const sortedCards = useMemo(() => {
    const s = new Set<string>();
    for (const interaction of analysis.interactions) {
      s.add(interaction.cards[0]);
      s.add(interaction.cards[1]);
    }
    let cards = [...s];

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
  const totalPages = pageSize > 0 ? Math.ceil(totalCards / pageSize) : 1;
  const clampedPage = Math.min(page, Math.max(0, totalPages - 1));
  const displayCards = pageSize > 0
    ? sortedCards.slice(clampedPage * pageSize, (clampedPage + 1) * pageSize)
    : sortedCards;

  useEffect(() => { setPage(0); }, [sortMode, selectedTypes, pageSize]);

  // Build matrix
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

  // ─── Search matching ───────────────────────────────────────────────────────
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

  // ─── Canvas render (cells + dual encoding stripes + focus ring) ────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || N === 0) return;

    const W = N * CELL_SIZE;
    const H = N * CELL_SIZE;

    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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

    // Cells with dual encoding
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

        // Diagonal stripe pattern (density encodes strength — colorblind friendly)
        drawStripePattern(ctx, x, y, CELL_SIZE, normalised);

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
        ctx.strokeRect(0, idx * CELL_SIZE, W, CELL_SIZE);
        ctx.strokeRect(idx * CELL_SIZE, 0, CELL_SIZE, H);
      }
    }

    // Keyboard focus ring
    if (focusCell && focusCell.row >= 0 && focusCell.row < N && focusCell.col >= 0 && focusCell.col < N) {
      const fx = focusCell.col * CELL_SIZE;
      const fy = focusCell.row * CELL_SIZE;
      ctx.strokeStyle = "#facc15"; // yellow-400 — high contrast against purple
      ctx.lineWidth = 2;
      ctx.strokeRect(fx + 1, fy + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }
  }, [cardNames, matrix, maxStrength, N, CELL_SIZE, matchingIndices, hasSearch, focusCell]);

  // ─── Hover tooltip (persists until cursor moves to a different cell) ───────
  const lastCellRef = useRef<string>("");

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      const j = Math.floor(mx / CELL_SIZE);
      const i = Math.floor(my / CELL_SIZE);

      const cellKey = `${i},${j}`;
      if (cellKey === lastCellRef.current) {
        // Same cell — only update cursor position for tooltip
        if (tooltip) {
          setTooltip((prev) => prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : null);
        }
        return;
      }
      lastCellRef.current = cellKey;

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
        row: i,
        col: j,
        cardA: cardNames[i],
        cardB: cardNames[j],
        strength,
        type: typeMatrix[i]?.[j] ?? null,
      });
    },
    [N, matrix, cardNames, typeMatrix, CELL_SIZE, tooltip]
  );

  const handleMouseLeave = useCallback(() => {
    lastCellRef.current = "";
    setTooltip(null);
  }, []);

  // ─── Touch support: tap to show tooltip ────────────────────────────────────
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || e.touches.length === 0) return;
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (touch.clientX - rect.left) * scaleX;
      const my = (touch.clientY - rect.top) * scaleY;

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

      e.preventDefault();
      setTooltip({
        clientX: touch.clientX,
        clientY: touch.clientY,
        row: i,
        col: j,
        cardA: cardNames[i],
        cardB: cardNames[j],
        strength,
        type: typeMatrix[i]?.[j] ?? null,
      });
      setFocusCell({ row: i, col: j });
    },
    [N, matrix, cardNames, typeMatrix, CELL_SIZE]
  );

  // ─── Keyboard navigation ──────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (N === 0) return;

      const current = focusCell ?? { row: 0, col: 0 };
      let { row, col } = current;
      let handled = true;

      switch (e.key) {
        case "ArrowUp":    row = Math.max(0, row - 1); break;
        case "ArrowDown":  row = Math.min(N - 1, row + 1); break;
        case "ArrowLeft":  col = Math.max(0, col - 1); break;
        case "ArrowRight": col = Math.min(N - 1, col + 1); break;
        case "Home":       row = 0; col = 0; break;
        case "End":        row = N - 1; col = N - 1; break;
        case "Escape":
          setFocusCell(null);
          setTooltip(null);
          return;
        case "Enter":
        case " ":
          // Pin/toggle tooltip at current focus cell
          if (row !== col && matrix[row]?.[col] > 0) {
            const canvas = canvasRef.current;
            if (canvas) {
              const rect = canvas.getBoundingClientRect();
              const cellCenterX = rect.left + (col + 0.5) * (rect.width / N);
              const cellCenterY = rect.top + (row + 0.5) * (rect.height / N);
              setTooltip((prev) =>
                prev && prev.row === row && prev.col === col
                  ? null
                  : {
                      clientX: cellCenterX,
                      clientY: cellCenterY,
                      row,
                      col,
                      cardA: cardNames[row],
                      cardB: cardNames[col],
                      strength: matrix[row][col],
                      type: typeMatrix[row]?.[col] ?? null,
                    }
              );
            }
          }
          e.preventDefault();
          return;
        default:
          handled = false;
      }

      if (handled) {
        e.preventDefault();
        setFocusCell({ row, col });
      }
    },
    [N, focusCell, matrix, cardNames, typeMatrix]
  );

  // ─── Dimensions ────────────────────────────────────────────────────────────
  const gridW = N * CELL_SIZE;
  const gridH = N * CELL_SIZE;

  // ─── Live region text for keyboard focus ───────────────────────────────────
  const focusCellAnnouncement = useMemo(() => {
    if (!focusCell || focusCell.row < 0 || focusCell.row >= N || focusCell.col < 0 || focusCell.col >= N) {
      return "";
    }
    const { row, col } = focusCell;
    if (row === col) return `${cardNames[row]} — self`;
    const strength = matrix[row]?.[col] ?? 0;
    if (strength === 0) return `${cardNames[row]} × ${cardNames[col]}: no interaction`;
    const pct = Math.round(strength * 100);
    const typeName = typeMatrix[row]?.[col] ? (INTERACTION_TYPE_LABELS[typeMatrix[row][col]!] ?? typeMatrix[row][col]) : "mixed";
    return `${cardNames[row]} × ${cardNames[col]}: ${pct}% strength, ${typeName}`;
  }, [focusCell, N, cardNames, matrix, typeMatrix]);

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

        {/* Pagination controls */}
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

      {/* Zoom + status row */}
      <div className="flex items-center gap-3">
        <p className="text-[11px] text-slate-500 flex-1" aria-live="polite">
          {statusText}
        </p>
        {/* Zoom control */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
            disabled={zoom <= ZOOM_MIN}
            className="rounded border border-slate-700 bg-slate-800/50 w-6 h-6 text-[13px] text-slate-400 hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="text-[11px] text-slate-400 tabular-nums w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
            disabled={zoom >= ZOOM_MAX}
            className="rounded border border-slate-700 bg-slate-800/50 w-6 h-6 text-[13px] text-slate-400 hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
            aria-label="Zoom in"
          >
            +
          </button>
          {zoom !== 1 && (
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="rounded border border-slate-700 bg-slate-800/50 px-1.5 h-6 text-[10px] text-slate-400 hover:border-slate-600 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Scroll container with overflow shadow indicators */}
      <div className="relative rounded-lg border border-slate-700">
        {/* Shadow overlays */}
        {shadows.top && (
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-4 z-10 rounded-t-lg"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)" }} />
        )}
        {shadows.bottom && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-4 z-10 rounded-b-lg"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)" }} />
        )}
        {shadows.left && (
          <div className="pointer-events-none absolute top-0 left-0 bottom-0 w-4 z-10 rounded-l-lg"
            style={{ background: "linear-gradient(to right, rgba(0,0,0,0.5), transparent)" }} />
        )}
        {shadows.right && (
          <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-4 z-10 rounded-r-lg"
            style={{ background: "linear-gradient(to left, rgba(0,0,0,0.5), transparent)" }} />
        )}

        <div
          ref={containerRef}
          className="w-full overflow-auto"
          style={{ maxHeight: "80vh" }}
          tabIndex={0}
          role="grid"
          aria-label={`Interaction heatmap: ${N} cards. Use arrow keys to navigate cells.`}
          onKeyDown={handleKeyDown}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `${LABEL_WIDTH}px ${gridW}px`,
              gridTemplateRows: `${HEADER_HEIGHT}px ${gridH}px`,
              width: LABEL_WIDTH + gridW,
              transform: zoom !== 1 ? `scale(${zoom})` : undefined,
              transformOrigin: "top left",
            }}
          >
            {/* ── Corner cell (sticky top + left) ─────────────────────── */}
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

            {/* ── Column headers (sticky top) ─────────────────────────── */}
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
                  const isFocused = focusCell?.col === j;
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
                          color: isFocused ? "#facc15" : dimmed ? "#475569" : isMatch ? "#c084fc" : "#94a3b8",
                          fontWeight: isMatch || isFocused ? 600 : 400,
                        }}
                      >
                        {name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Row labels (sticky left) ────────────────────────────── */}
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
                const isFocused = focusCell?.row === i;
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
                      color: isFocused ? "#facc15" : dimmed ? "#475569" : isMatch ? "#c084fc" : "#94a3b8",
                      fontWeight: isMatch || isFocused ? 600 : 400,
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

            {/* ── Cell canvas ─────────────────────────────────────────── */}
            <canvas
              ref={canvasRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onTouchStart={handleTouchStart}
              style={{
                display: "block",
                width: gridW,
                height: gridH,
                minWidth: gridW,
                minHeight: gridH,
              }}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      {/* Tooltip (fixed position) */}
      {tooltip && <HeatmapTooltip info={tooltip} />}

      {/* Keyboard focus announcements */}
      <div aria-live="assertive" className="sr-only">
        {focusCellAnnouncement}
      </div>

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
              <th key={name} scope="col">{name}</th>
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
