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
import type { TagComparison } from "@/lib/deck-comparison";

interface TagComparisonChartProps {
  data: TagComparison[];
  labelA: string;
  labelB: string;
}

const COLOR_A = "#9333ea"; // purple
const COLOR_B = "#06b6d4"; // cyan/teal

// Maximum number of tags to show in chart before truncating
const MAX_TAGS_CHART = 12;

function CustomTooltip({
  active,
  payload,
  label,
  labelA,
  labelB,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: string;
  labelA: string;
  labelB: string;
}) {
  if (!active || !payload?.length) return null;
  const countA = payload.find((p) => p.dataKey === "countA")?.value ?? 0;
  const countB = payload.find((p) => p.dataKey === "countB")?.value ?? 0;

  return (
    <div className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-medium text-slate-200">{label}</p>
      <p style={{ color: COLOR_A }}>
        {labelA}: {countA}
      </p>
      <p style={{ color: COLOR_B }}>
        {labelB}: {countB}
      </p>
    </div>
  );
}

export default function TagComparisonChart({ data, labelA, labelB }: TagComparisonChartProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Only show tags where at least one deck has cards with that tag
  const filteredData = data.filter((t) => t.countA > 0 || t.countB > 0).slice(0, MAX_TAGS_CHART);

  return (
    <section
      data-testid="tag-comparison-chart"
      aria-labelledby="tag-comparison-heading"
    >
      <h3
        id="tag-comparison-heading"
        className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400"
      >
        Tag Comparison
      </h3>

      {filteredData.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No tags found in either deck.</p>
      ) : (
        <>
          {/* Chart — hidden on mobile, shown on sm+ */}
          <div className="hidden sm:block">
            <ChartContainer
              height={320}
              ariaLabel={`Tag comparison chart showing card tag counts for ${labelA} in purple and ${labelB} in cyan.`}
            >
              <BarChart
                data={filteredData}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 80, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#334155" }}
                />
                <YAxis
                  type="category"
                  dataKey="tag"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={76}
                />
                <Tooltip
                  content={<CustomTooltip labelA={labelA} labelB={labelB} />}
                  cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
                />
                <Legend
                  formatter={(value) => (value === "countA" ? labelA : labelB)}
                  wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }}
                />
                <Bar
                  dataKey="countA"
                  name="countA"
                  fill={COLOR_A}
                  radius={[0, 3, 3, 0]}
                  isAnimationActive={!prefersReducedMotion}
                />
                <Bar
                  dataKey="countB"
                  name="countB"
                  fill={COLOR_B}
                  radius={[0, 3, 3, 0]}
                  isAnimationActive={!prefersReducedMotion}
                />
              </BarChart>
            </ChartContainer>
          </div>

          {/* Table fallback — shown on mobile, hidden on sm+ */}
          <div className="block sm:hidden overflow-x-auto rounded-lg border border-slate-700">
            <table className="table-auto w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/50">
                  <th className="px-3 py-2 text-left font-medium text-slate-400">Tag</th>
                  <th className="px-3 py-2 text-right font-medium text-purple-300">{labelA}</th>
                  <th className="px-3 py-2 text-right font-medium text-cyan-400">{labelB}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredData.map((row) => (
                  <tr key={row.tag} className="hover:bg-slate-700/20">
                    <td className="px-3 py-2 text-slate-300">{row.tag}</td>
                    <td className="px-3 py-2 text-right font-mono text-purple-300">{row.countA}</td>
                    <td className="px-3 py-2 text-right font-mono text-cyan-400">{row.countB}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
