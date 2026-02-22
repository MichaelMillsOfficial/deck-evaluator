"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import ChartContainer from "@/components/ChartContainer";
import {
  MTG_COLORS,
  type ColorDistribution,
  type MtgColor,
} from "@/lib/color-distribution";

interface ColorDistributionChartProps {
  data: ColorDistribution;
}

const COLOR_MAP: Record<MtgColor, { fill: string; name: string }> = {
  W: { fill: "#F9D75E", name: "White" },
  U: { fill: "#0E68AB", name: "Blue" },
  B: { fill: "#6B7280", name: "Black" },
  R: { fill: "#D32029", name: "Red" },
  G: { fill: "#00733E", name: "Green" },
};

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

  const chartData = MTG_COLORS.map((color) => ({
    color: COLOR_MAP[color].name,
    sources: data.sources[color],
    pips: data.pips[color],
    fill: COLOR_MAP[color].fill,
  }));

  return (
    <div>
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
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
            formatter={(value: string) =>
              value === "sources" ? "Sources" : "Demand (Pips)"
            }
          />
          <Bar
            dataKey="sources"
            fill="#9333ea"
            radius={[3, 3, 0, 0]}
            isAnimationActive={!prefersReducedMotion}
          />
          <Bar
            dataKey="pips"
            fill="#c084fc"
            radius={[3, 3, 0, 0]}
            isAnimationActive={!prefersReducedMotion}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
