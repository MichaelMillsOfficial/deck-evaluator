"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from "recharts";
import ChartContainer from "@/components/ChartContainer";
import type { ManaCurveBucket } from "@/lib/mana-curve";

interface ManaCurveChartProps {
  data: ManaCurveBucket[];
  totalSpells: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const permanents =
    payload.find((p) => p.dataKey === "permanents")?.value ?? 0;
  const nonPermanents =
    payload.find((p) => p.dataKey === "nonPermanents")?.value ?? 0;
  const total = permanents + nonPermanents;
  if (total === 0) return null;
  return (
    <div className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm shadow-lg">
      <p className="text-slate-300">CMC {label}</p>
      <p className="font-semibold text-purple-300">
        {total} {total === 1 ? "spell" : "spells"}
      </p>
      <p className="text-slate-400">
        {permanents} {permanents === 1 ? "permanent" : "permanents"},{" "}
        {nonPermanents} {nonPermanents === 1 ? "non-permanent" : "non-permanents"}
      </p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderTotalLabel(props: any) {
  const { x = 0, y = 0, width = 0, value = 0, offset = 0 } = props;
  // value here is the nonPermanents value (top bar); we need the total
  // Recharts passes the data entry via props — access the full bucket
  const entry = props.payload as ManaCurveBucket | undefined;
  if (!entry) return null;
  const total = entry.permanents + entry.nonPermanents;
  if (total === 0) return null;
  // y is the top of the nonPermanents bar segment
  // If nonPermanents is 0, y will be at the top of permanents bar
  const labelY = value === 0 ? y - 6 + offset : y - 6;
  return (
    <text
      x={x + width / 2}
      y={labelY}
      fill="#cbd5e1"
      textAnchor="middle"
      fontSize={12}
    >
      {total}
    </text>
  );
}

export default function ManaCurveChart({
  data,
  totalSpells,
}: ManaCurveChartProps) {
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
    <div>
      <ChartContainer
        height={240}
        ariaLabel={`Mana curve bar chart. Distribution of ${totalSpells} non-land spells by converted mana cost.`}
      >
        <BarChart data={data} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#334155"
            vertical={false}
          />
          <XAxis
            dataKey="cmc"
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
            dataKey="permanents"
            stackId="cmc"
            fill="#9333ea"
            radius={[0, 0, 0, 0]}
            isAnimationActive={!prefersReducedMotion}
          />
          <Bar
            dataKey="nonPermanents"
            stackId="cmc"
            fill="#c084fc"
            radius={[3, 3, 0, 0]}
            isAnimationActive={!prefersReducedMotion}
          >
            <LabelList
              dataKey="nonPermanents"
              position="top"
              content={renderTotalLabel}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#9333ea" }} />
          Permanents
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#c084fc" }} />
          Non-permanents
        </span>
      </div>
    </div>
  );
}
