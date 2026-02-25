"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { DeckData, EnrichedCard } from "@/lib/types";
import {
  computePrecomputedQueries,
  getAvailableCategories,
  hypergeometricCdf,
  computeProbabilityCurve,
  getDeckSize,
  countCardsByTag,
} from "@/lib/hypergeometric";
import ChartContainer from "@/components/ChartContainer";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface HypergeometricCalculatorProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard>;
}

// ---------------------------------------------------------------------------
// Color-coding helpers for probability percentages
// ---------------------------------------------------------------------------

function getProbabilityColor(p: number): string {
  if (p >= 0.75) return "text-green-400";
  if (p >= 0.50) return "text-yellow-400";
  if (p >= 0.25) return "text-orange-400";
  return "text-red-400";
}

function getProbabilityBg(p: number): string {
  if (p >= 0.75) return "bg-green-900/40 border-green-700/60";
  if (p >= 0.50) return "bg-yellow-900/40 border-yellow-700/60";
  if (p >= 0.25) return "bg-orange-900/40 border-orange-700/60";
  return "bg-red-900/40 border-red-700/60";
}

function formatPercent(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Custom Recharts tooltip
// ---------------------------------------------------------------------------

function ProbabilityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].value;
  return (
    <div className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm shadow-lg">
      <p className="text-slate-300">Turn {label}</p>
      <p className={`font-semibold ${getProbabilityColor(p)}`}>
        {formatPercent(p)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Count cards by category helper
// ---------------------------------------------------------------------------

function countLandsInDeck(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): number {
  return [...deck.commanders, ...deck.mainboard].reduce((sum, card) => {
    const enriched = cardMap[card.name];
    if (!enriched) return sum;
    return enriched.typeLine.includes("Land") ? sum + card.quantity : sum;
  }, 0);
}

function countCategoryInDeck(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>,
  label: string
): number {
  if (label === "Lands") return countLandsInDeck(deck, cardMap);
  return countCardsByTag(deck, cardMap, label);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function HypergeometricCalculator({
  deck,
  cardMap,
}: HypergeometricCalculatorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [minSuccesses, setMinSuccesses] = useState<number>(1);
  const [turnNumber, setTurnNumber] = useState<number>(4);
  const [showCurve, setShowCurve] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const precomputedQueries = useMemo(
    () => computePrecomputedQueries(deck, cardMap),
    [deck, cardMap]
  );

  const availableCategories = useMemo(
    () => getAvailableCategories(deck, cardMap),
    [deck, cardMap]
  );

  // Set default category to first available
  const effectiveCategory =
    selectedCategory && availableCategories.some((c) => c.label === selectedCategory)
      ? selectedCategory
      : availableCategories[0]?.label ?? "";

  const deckSize = useMemo(() => getDeckSize(deck), [deck]);

  // Compute custom query result
  const queryResult = useMemo(() => {
    if (!effectiveCategory || deckSize === 0) return null;
    const K = countCategoryInDeck(deck, cardMap, effectiveCategory);
    if (K === 0) return null;
    // draws at turnNumber = 7 (opening) + (turnNumber - 1) additional draws
    const draws = 7 + (turnNumber - 1);
    const probability = hypergeometricCdf(deckSize, K, draws, minSuccesses);
    return { probability, K };
  }, [deck, cardMap, effectiveCategory, deckSize, minSuccesses, turnNumber]);

  // Probability curve data
  const curveData = useMemo(() => {
    if (!effectiveCategory || deckSize === 0 || !showCurve) return [];
    const K = countCategoryInDeck(deck, cardMap, effectiveCategory);
    if (K === 0) return [];
    return computeProbabilityCurve(deckSize, K, minSuccesses, 10, 7);
  }, [deck, cardMap, effectiveCategory, deckSize, minSuccesses, showCurve]);

  const hasAnyData = precomputedQueries.length > 0 || availableCategories.length > 0;

  if (!hasAnyData) {
    return (
      <section aria-labelledby="hypergeometric-heading">
        <h3
          id="hypergeometric-heading"
          className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300"
        >
          Draw Probability
        </h3>
        <p className="text-xs text-slate-400">
          Import and enrich a deck to see draw probability calculations.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="hypergeometric-heading">
      <h3
        id="hypergeometric-heading"
        className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300"
      >
        Draw Probability
      </h3>
      <p className="mb-4 text-xs text-slate-400">
        Hypergeometric probability of drawing key cards by a given turn
      </p>

      {/* Pre-computed stat cards */}
      {precomputedQueries.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {precomputedQueries.map((query) => (
            <div
              key={query.label}
              data-testid="precomputed-query"
              className={`rounded-lg border px-3 py-3 ${getProbabilityBg(query.probability)}`}
            >
              <p
                data-testid="precomputed-query-label"
                className="mb-1 text-xs font-medium text-slate-300"
              >
                {query.label}
              </p>
              <p
                data-testid="precomputed-query-probability"
                className={`text-xl font-bold ${getProbabilityColor(query.probability)}`}
              >
                {formatPercent(query.probability)}
              </p>
              <p className="mt-1 text-xs text-slate-400">{query.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Custom query builder */}
      {availableCategories.length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Custom Query
          </p>

          <div className="flex flex-wrap items-end gap-3">
            {/* Category selector */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="query-category"
                className="text-xs text-slate-400"
              >
                Category
              </label>
              <select
                id="query-category"
                data-testid="query-category-select"
                value={effectiveCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setShowCurve(false);
                }}
                className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                {availableCategories.map((cat) => (
                  <option key={cat.label} value={cat.label}>
                    {cat.label} ({cat.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Min successes */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="query-min-successes"
                className="text-xs text-slate-400"
              >
                At least
              </label>
              <input
                id="query-min-successes"
                data-testid="query-min-successes"
                type="number"
                min={1}
                max={20}
                value={minSuccesses}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                  setMinSuccesses(val);
                  setShowCurve(false);
                }}
                className="w-20 rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {/* Turn number */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="query-turn"
                className="text-xs text-slate-400"
              >
                By turn
              </label>
              <input
                id="query-turn"
                data-testid="query-turn-number"
                type="number"
                min={1}
                max={15}
                value={turnNumber}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                  setTurnNumber(val);
                  setShowCurve(false);
                }}
                className="w-20 rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {/* Result */}
            {queryResult !== null && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-400">Probability</span>
                <span
                  data-testid="query-result"
                  className={`text-xl font-bold ${getProbabilityColor(queryResult.probability)}`}
                >
                  {formatPercent(queryResult.probability)}
                </span>
              </div>
            )}
          </div>

          {/* Show curve toggle */}
          {queryResult !== null && (
            <div className="mt-3">
              <button
                data-testid="show-curve-btn"
                type="button"
                aria-pressed={showCurve}
                onClick={() => setShowCurve((prev) => !prev)}
                className="rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {showCurve ? "Hide Curve" : "Show Curve"}
              </button>
            </div>
          )}

          {/* Probability curve chart */}
          {showCurve && curveData.length > 0 && (
            <div className="mt-4" data-testid="probability-curve-chart">
              <ChartContainer
                height={200}
                ariaLabel={`Probability curve showing chance of drawing ${minSuccesses}+ ${effectiveCategory} cards across turns 1 to 10`}
              >
                <LineChart
                  data={curveData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="turn"
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "#334155" }}
                    label={{
                      value: "Turn",
                      position: "insideBottom",
                      offset: -2,
                      fill: "#64748b",
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                    domain={[0, 1]}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={<ProbabilityTooltip />}
                    cursor={{ stroke: "rgba(148, 163, 184, 0.2)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="probability"
                    stroke="#9333ea"
                    strokeWidth={2}
                    dot={{ fill: "#9333ea", r: 3 }}
                    activeDot={{ r: 5, fill: "#c084fc" }}
                    isAnimationActive={!prefersReducedMotion}
                  />
                </LineChart>
              </ChartContainer>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
