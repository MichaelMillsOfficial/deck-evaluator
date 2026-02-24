"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import ChartContainer from "@/components/ChartContainer";
import {
  MTG_COLORS,
  type ColorDistribution,
  type MtgColor,
} from "@/lib/color-distribution";

interface ColorDistributionChartProps {
  data: ColorDistribution;
  /** Colors in the commander's identity; empty set means show all 5 */
  commanderIdentity: Set<MtgColor>;
  /** Whether to show the colorless sources bar */
  showColorless?: boolean;
  onToggleColorless?: () => void;
}

const COLOR_MAP: Record<
  MtgColor,
  { fill: string; fillLight: string; name: string }
> = {
  W: { fill: "#F9D75E", fillLight: "#FBE89E", name: "White" },
  U: { fill: "#0E68AB", fillLight: "#5A9FCC", name: "Blue" },
  B: { fill: "#6B7280", fillLight: "#9CA3AF", name: "Black" },
  R: { fill: "#D32029", fillLight: "#E8787D", name: "Red" },
  G: { fill: "#00733E", fillLight: "#4DA87A", name: "Green" },
};

const COLORLESS_FILL = "#A78BFA";
const COLORLESS_FILL_LIGHT = "#C4B5FD";

interface ChartEntry {
  color: string;
  sources: number;
  pips: number;
  sourceFill: string;
  pipsFill: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const sources = payload.find((p) => p.dataKey === "sources")?.value ?? 0;
  const demand = payload.find((p) => p.dataKey === "pips")?.value ?? 0;
  if (sources === 0 && demand === 0) return null;
  return (
    <div className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-slate-200">{label}</p>
      <p className="text-slate-300">
        Sources: <span className="font-semibold text-purple-300">{sources}</span>
      </p>
      <p className="text-slate-300">
        Pips: <span className="font-semibold text-purple-300">{demand}</span>
      </p>
    </div>
  );
}

export default function ColorDistributionChart({
  data,
  commanderIdentity,
  showColorless = false,
  onToggleColorless,
}: ColorDistributionChartProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Filter to commander identity colors (or all 5 if no commander)
  const displayColors =
    commanderIdentity.size > 0
      ? MTG_COLORS.filter((c) => commanderIdentity.has(c))
      : [...MTG_COLORS];

  const chartData: ChartEntry[] = displayColors.map((color) => ({
    color: COLOR_MAP[color].name,
    sources: data.sources[color],
    pips: data.pips[color],
    sourceFill: COLOR_MAP[color].fill,
    pipsFill: COLOR_MAP[color].fillLight,
  }));

  if (showColorless) {
    chartData.push({
      color: "Colorless",
      sources: data.colorlessSources,
      pips: 0,
      sourceFill: COLORLESS_FILL,
      pipsFill: COLORLESS_FILL_LIGHT,
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-4">
        {/* Custom legend */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: "#0E68AB" }}
          />
          Sources
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: "#5A9FCC" }}
          />
          Demand (Pips)
        </div>
        {/* Colorless toggle */}
        {onToggleColorless && (
          <button
            type="button"
            onClick={onToggleColorless}
            aria-pressed={showColorless}
            className={`ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
              showColorless
                ? "border-purple-500 bg-purple-600/20 text-purple-300"
                : "border-slate-600 bg-slate-800/50 text-slate-400 hover:border-slate-500"
            }`}
            data-testid="toggle-colorless"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: COLORLESS_FILL }}
            />
            Colorless
          </button>
        )}
      </div>
      <ChartContainer
        height={240}
        ariaLabel="Color distribution chart. Mana sources versus pip demand by color."
      >
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#334155"
            vertical={false}
          />
          <XAxis
            dataKey="color"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "#334155" }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
          />
          <Bar
            dataKey="sources"
            radius={[3, 3, 0, 0]}
            isAnimationActive={!prefersReducedMotion}
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.sourceFill} />
            ))}
          </Bar>
          <Bar
            dataKey="pips"
            radius={[3, 3, 0, 0]}
            isAnimationActive={!prefersReducedMotion}
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.pipsFill} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}
