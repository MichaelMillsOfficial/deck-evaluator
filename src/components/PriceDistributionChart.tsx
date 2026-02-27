"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import ChartContainer from "@/components/ChartContainer";
import type { PriceDistributionBucket } from "@/lib/budget-analysis";

interface PriceDistributionChartProps {
  data: PriceDistributionBucket[];
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const count = payload[0].value;
  if (count === 0) return null;
  return (
    <div className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm shadow-lg">
      <p className="text-slate-300">{label}</p>
      <p className="font-semibold text-purple-300">
        {count} {count === 1 ? "card" : "cards"}
      </p>
    </div>
  );
}

export default function PriceDistributionChart({
  data,
}: PriceDistributionChartProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return (
    <ChartContainer
      height={200}
      ariaLabel="Price distribution chart"
    >
      <BarChart
        data={data}
        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#334155"
          vertical={false}
        />
        <XAxis
          dataKey="label"
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
          dataKey="count"
          fill="#9333ea"
          radius={[3, 3, 0, 0]}
          isAnimationActive={!prefersReducedMotion}
        />
      </BarChart>
    </ChartContainer>
  );
}
