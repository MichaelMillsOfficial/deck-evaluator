"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import ChartContainer from "@/components/ChartContainer";
import type { TypePriceSummary, RolePriceSummary } from "@/lib/budget-analysis";
import { formatUSD } from "@/lib/budget-analysis";

interface PriceByCategoryChartProps {
  byType: TypePriceSummary[];
  byRole: RolePriceSummary[];
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
  const cost = payload[0].value;
  if (cost === 0) return null;
  return (
    <div className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm shadow-lg">
      <p className="text-slate-300">{label}</p>
      <p className="font-semibold text-purple-300">{formatUSD(cost)}</p>
    </div>
  );
}

export default function PriceByCategoryChart({
  byType,
  byRole,
}: PriceByCategoryChartProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const typeData = byType.map((t) => ({ name: t.type, totalCost: t.totalCost }));
  const roleData = byRole.map((r) => ({ name: r.tag, totalCost: r.totalCost }));

  return (
    <div className="space-y-6">
      {typeData.length > 0 && (
        <div data-testid="budget-by-type">
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Spending by Card Type
          </h4>
          <ChartContainer
            height={Math.max(160, typeData.length * 32 + 40)}
            ariaLabel="Spending by card type chart"
          >
            <BarChart
              data={typeData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#334155"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "#334155" }}
                tickFormatter={(v: number) => formatUSD(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={75}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
              />
              <Bar
                dataKey="totalCost"
                fill="#9333ea"
                radius={[0, 3, 3, 0]}
                isAnimationActive={!prefersReducedMotion}
              />
            </BarChart>
          </ChartContainer>
        </div>
      )}

      {roleData.length > 0 && (
        <div data-testid="budget-by-role">
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Spending by Role
          </h4>
          <p className="mb-2 text-xs text-slate-500">
            Cards with multiple roles are counted in each category
          </p>
          <ChartContainer
            height={Math.max(160, roleData.length * 32 + 40)}
            ariaLabel="Spending by role chart"
          >
            <BarChart
              data={roleData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#334155"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "#334155" }}
                tickFormatter={(v: number) => formatUSD(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={95}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
              />
              <Bar
                dataKey="totalCost"
                fill="#c084fc"
                radius={[0, 3, 3, 0]}
                isAnimationActive={!prefersReducedMotion}
              />
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </div>
  );
}
