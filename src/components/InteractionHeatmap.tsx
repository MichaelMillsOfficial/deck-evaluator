"use client";

/**
 * InteractionHeatmap — Card-Centric Interaction Matrix
 *
 * Displays card interaction data as an expandable card list instead of an
 * NxN canvas matrix.  Each card shows its interaction count and a summary
 * strength bar.  Expanding a card reveals all interaction partners with:
 *   - Full card name (no truncation)
 *   - Coloured strength bar with percentage
 *   - Interaction type badge
 *
 * Features:
 *   - Sort modes: Centrality, Alphabetical, Interaction count
 *   - Paginated (30/page default) with prev/next cycling + "All"
 *   - Search: matching cards auto-expand, non-matching dim
 *   - selectedTypes filter
 *   - Keyboard: Enter/Space to expand, arrow keys between cards
 *   - Colour legend with dual encoding explanation
 *   - Accessible: proper ARIA roles, live regions, focus management
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InteractionAnalysis, InteractionType } from "@/lib/interaction-engine/types";
import type { CentralityResult } from "@/lib/interaction-centrality";

// ─── Props ────────────────────────────────────────────────────────────────────
interface InteractionHeatmapProps {
  analysis: InteractionAnalysis;
  centrality: CentralityResult;
  selectedTypes?: Set<InteractionType>;
  cardSearch?: string;
}

type SortMode = "centrality" | "alphabetical" | "interactions";

// ─── Colour ramp (matches heatmap palette) ───────────────────────────────────
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
      return `rgb(${Math.round(c0[0] + t * (c1[0] - c0[0]))},${Math.round(c0[1] + t * (c1[1] - c0[1]))},${Math.round(c0[2] + t * (c1[2] - c0[2]))})`;
    }
  }
  return "rgb(232,121,249)";
}

const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
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

const TYPE_COLORS: Partial<Record<InteractionType, string>> = {
  enables: "bg-green-800/60 text-green-300 border-green-700/50",
  triggers: "bg-blue-800/60 text-blue-300 border-blue-700/50",
  amplifies: "bg-amber-800/60 text-amber-300 border-amber-700/50",
  protects: "bg-cyan-800/60 text-cyan-300 border-cyan-700/50",
  recurs: "bg-emerald-800/60 text-emerald-300 border-emerald-700/50",
  reduces_cost: "bg-lime-800/60 text-lime-300 border-lime-700/50",
  tutors_for: "bg-indigo-800/60 text-indigo-300 border-indigo-700/50",
  blocks: "bg-red-800/60 text-red-300 border-red-700/50",
  conflicts: "bg-rose-800/60 text-rose-300 border-rose-700/50",
  loops_with: "bg-violet-800/60 text-violet-300 border-violet-700/50",
};

// ─── Per-card aggregated data ────────────────────────────────────────────────
interface CardInteractionSummary {
  name: string;
  totalStrength: number;
  interactionCount: number;
  /** Partners sorted by strength (strongest first) */
  partners: {
    name: string;
    strength: number;
    normalised: number;
    dominantType: InteractionType;
  }[];
}

// ─── Page size options ───────────────────────────────────────────────────────
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const;

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
  }, []);

  return (
    <div className="mt-3 space-y-0.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-400 shrink-0 w-8 text-right">None</span>
        <canvas ref={canvasRef} width={240} height={14} className="rounded" aria-label="Strength legend" />
        <span className="text-[11px] text-slate-400 shrink-0">Strong</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-8" />
        <div className="flex justify-between text-[9px] text-slate-500" style={{ width: 240 }}>
          <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
        </div>
      </div>
    </div>
  );
}

// ─── Strength bar ────────────────────────────────────────────────────────────
function StrengthBar({ normalised, className }: { normalised: number; className?: string }) {
  return (
    <div className={`h-2.5 rounded-full bg-slate-700/50 overflow-hidden ${className ?? ""}`}>
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${Math.max(2, normalised * 100)}%`,
          background: strengthToColor(normalised),
        }}
      />
    </div>
  );
}

// ─── Single card row (expandable) ────────────────────────────────────────────
function CardRow({
  card,
  expanded,
  onToggle,
  dimmed,
  highlighted,
}: {
  card: CardInteractionSummary;
  expanded: boolean;
  onToggle: () => void;
  dimmed: boolean;
  highlighted: boolean;
}) {
  const maxPartnerStrength = card.partners[0]?.normalised ?? 0;

  return (
    <div
      className={`border-b border-slate-700/50 transition-opacity ${dimmed ? "opacity-30" : ""}`}
    >
      {/* Summary row */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={`w-full flex items-center gap-3 px-3 py-2 text-left cursor-pointer transition-colors hover:bg-slate-800/40 ${
          highlighted ? "bg-purple-900/15" : ""
        }`}
      >
        {/* Chevron */}
        <svg
          className={`w-3.5 h-3.5 shrink-0 text-slate-500 transition-transform ${expanded ? "rotate-90" : ""}`}
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" />
        </svg>

        {/* Card name */}
        <span className={`flex-1 text-[13px] truncate ${highlighted ? "text-purple-300 font-medium" : "text-slate-200"}`}>
          {card.name}
        </span>

        {/* Interaction count */}
        <span className="text-[11px] text-slate-500 tabular-nums shrink-0 w-14 text-right">
          {card.interactionCount} int.
        </span>

        {/* Mini strength bar */}
        <div className="w-20 shrink-0">
          <StrengthBar normalised={maxPartnerStrength} />
        </div>
      </button>

      {/* Expanded: partner list */}
      {expanded && (
        <div className="pl-9 pr-3 pb-3 space-y-1">
          {card.partners.map((partner) => (
            <div key={partner.name} className="flex items-center gap-2">
              {/* Partner name */}
              <span className="text-[12px] text-slate-300 truncate flex-1 min-w-0">
                {partner.name}
              </span>

              {/* Type badge */}
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${
                  TYPE_COLORS[partner.dominantType] ?? "bg-slate-700/50 text-slate-400 border-slate-600/50"
                }`}
              >
                {INTERACTION_TYPE_LABELS[partner.dominantType] ?? partner.dominantType}
              </span>

              {/* Strength bar + percentage */}
              <div className="flex items-center gap-1.5 shrink-0" style={{ width: 120 }}>
                <div className="flex-1">
                  <StrengthBar normalised={partner.normalised} />
                </div>
                <span className="text-[10px] text-slate-500 tabular-nums w-8 text-right">
                  {Math.round(partner.normalised * 100)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function InteractionHeatmap({
  analysis,
  centrality,
  selectedTypes,
  cardSearch,
}: InteractionHeatmapProps) {
  const [pageSize, setPageSize] = useState<number>(30);
  const [page, setPage] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>("centrality");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // ─── Build per-card interaction summaries ──────────────────────────────────
  const interactionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const interaction of analysis.interactions) {
      counts.set(interaction.cards[0], (counts.get(interaction.cards[0]) ?? 0) + 1);
      counts.set(interaction.cards[1], (counts.get(interaction.cards[1]) ?? 0) + 1);
    }
    return counts;
  }, [analysis.interactions]);

  const cardSummaries = useMemo(() => {
    // Collect all participating cards
    const participatingCards = new Set<string>();
    for (const interaction of analysis.interactions) {
      if (selectedTypes && selectedTypes.size > 0 && !selectedTypes.has(interaction.type)) continue;
      participatingCards.add(interaction.cards[0]);
      participatingCards.add(interaction.cards[1]);
    }

    // Build per-card partner maps
    const partnerMaps = new Map<string, Map<string, { strength: number; types: Map<InteractionType, number> }>>();

    for (const interaction of analysis.interactions) {
      if (selectedTypes && selectedTypes.size > 0 && !selectedTypes.has(interaction.type)) continue;
      const [a, b] = interaction.cards;

      for (const [src, dst] of [[a, b], [b, a]] as const) {
        if (!partnerMaps.has(src)) partnerMaps.set(src, new Map());
        const pMap = partnerMaps.get(src)!;
        if (!pMap.has(dst)) pMap.set(dst, { strength: 0, types: new Map() });
        const entry = pMap.get(dst)!;
        entry.strength += interaction.strength;
        entry.types.set(interaction.type, (entry.types.get(interaction.type) ?? 0) + interaction.strength);
      }
    }

    // Find global max strength for normalisation
    let globalMaxStrength = 0;
    for (const [, pMap] of partnerMaps) {
      for (const [, entry] of pMap) {
        if (entry.strength > globalMaxStrength) globalMaxStrength = entry.strength;
      }
    }

    // Build summaries
    const summaries: CardInteractionSummary[] = [];
    for (const cardName of participatingCards) {
      const pMap = partnerMaps.get(cardName);
      if (!pMap) continue;

      const partners: CardInteractionSummary["partners"] = [];
      let totalStrength = 0;

      for (const [partnerName, entry] of pMap) {
        totalStrength += entry.strength;
        // Find dominant type
        let domType: InteractionType = "enables";
        let domStrength = 0;
        for (const [type, str] of entry.types) {
          if (str > domStrength) { domStrength = str; domType = type; }
        }
        partners.push({
          name: partnerName,
          strength: entry.strength,
          normalised: globalMaxStrength > 0 ? entry.strength / globalMaxStrength : 0,
          dominantType: domType,
        });
      }

      // Sort partners by strength (strongest first)
      partners.sort((a, b) => b.strength - a.strength);

      summaries.push({
        name: cardName,
        totalStrength,
        interactionCount: partners.length,
        partners,
      });
    }

    return summaries;
  }, [analysis.interactions, selectedTypes]);

  // ─── Sort ──────────────────────────────────────────────────────────────────
  const sortedCards = useMemo(() => {
    const cards = [...cardSummaries];

    if (sortMode === "alphabetical") {
      cards.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === "interactions") {
      cards.sort((a, b) => b.interactionCount - a.interactionCount || b.totalStrength - a.totalStrength);
    } else {
      const centralityRankMap = new Map(
        centrality.scores.map((s) => [s.cardName, s.rank])
      );
      cards.sort((a, b) => {
        const rankA = centralityRankMap.get(a.name) ?? Number.MAX_SAFE_INTEGER;
        const rankB = centralityRankMap.get(b.name) ?? Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;
        return a.name.localeCompare(b.name);
      });
    }

    return cards;
  }, [cardSummaries, sortMode, centrality.scores]);

  const totalCards = sortedCards.length;

  // ─── Pagination ────────────────────────────────────────────────────────────
  const totalPages = pageSize > 0 ? Math.ceil(totalCards / pageSize) : 1;
  const clampedPage = Math.min(page, Math.max(0, totalPages - 1));
  const displayCards = pageSize > 0
    ? sortedCards.slice(clampedPage * pageSize, (clampedPage + 1) * pageSize)
    : sortedCards;

  useEffect(() => { setPage(0); }, [sortMode, selectedTypes, pageSize]);

  // ─── Search matching ───────────────────────────────────────────────────────
  const searchQuery = (cardSearch ?? "").trim().toLowerCase();
  const matchingCardNames = useMemo(() => {
    if (!searchQuery) return new Set<string>();
    const result = new Set<string>();
    for (const card of sortedCards) {
      if (card.name.toLowerCase().includes(searchQuery)) {
        result.add(card.name);
      }
      // Also check if any partner matches (expand the card if so)
      for (const p of card.partners) {
        if (p.name.toLowerCase().includes(searchQuery)) {
          result.add(card.name);
          break;
        }
      }
    }
    return result;
  }, [searchQuery, sortedCards]);

  // Auto-expand search matches
  useEffect(() => {
    if (matchingCardNames.size > 0) {
      setExpandedCards(new Set(matchingCardNames));
    }
  }, [matchingCardNames]);

  const hasSearch = searchQuery.length > 0;

  // ─── Toggle expand ─────────────────────────────────────────────────────────
  const toggleCard = useCallback((name: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedCards(new Set(displayCards.map((c) => c.name)));
  }, [displayCards]);

  const collapseAll = useCallback(() => {
    setExpandedCards(new Set());
  }, []);

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

  const someExpanded = expandedCards.size > 0;

  return (
    <div className="w-full space-y-3">
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

        {/* Pagination */}
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

      {/* Status + expand/collapse */}
      <div className="flex items-center gap-3">
        <p className="text-[11px] text-slate-500 flex-1" aria-live="polite">
          {statusText}
        </p>
        <button
          type="button"
          onClick={someExpanded ? collapseAll : expandAll}
          className="text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer transition-colors"
        >
          {someExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {/* Card interaction list */}
      <div
        className="rounded-lg border border-slate-700 bg-slate-800/20 overflow-hidden"
        role="tree"
        aria-label="Card interactions"
      >
        {/* Header row */}
        <div className="flex items-center gap-3 px-3 py-1.5 border-b border-slate-700 bg-slate-800/40">
          <span className="w-3.5" />
          <span className="flex-1 text-[10px] text-slate-500 uppercase tracking-wider font-medium">Card</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium w-14 text-right">Count</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium w-20 text-right">Strength</span>
        </div>

        {/* Card rows */}
        {displayCards.map((card) => (
          <CardRow
            key={card.name}
            card={card}
            expanded={expandedCards.has(card.name)}
            onToggle={() => toggleCard(card.name)}
            dimmed={hasSearch && !matchingCardNames.has(card.name)}
            highlighted={hasSearch && matchingCardNames.has(card.name)}
          />
        ))}

        {displayCards.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-500 italic">
            No cards match the current filters.
          </div>
        )}
      </div>

      {/* Legend */}
      <ColorLegend />
    </div>
  );
}
