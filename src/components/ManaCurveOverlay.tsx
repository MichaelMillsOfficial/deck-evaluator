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
  LabelList,
} from "recharts";
import ChartContainer from "@/components/ChartContainer";
import type { ManaCurveOverlayBucket } from "@/lib/deck-comparison";

interface ManaCurveOverlayProps {
  data: ManaCurveOverlayBucket[];
  labelA: string;
  labelB: string;
}

const COLOR_A = "#9333ea"; // purple
const COLOR_B = "#06b6d4"; // cyan/teal

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
  const totalA = payload.find((p) => p.dataKey === "totalA")?.value ?? 0;
  const totalB = payload.find((p) => p.dataKey === "totalB")?.value ?? 0;
  if (totalA === 0 && totalB === 0) return null;

  return (
    <div className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 text-slate-300">CMC {label}</p>
      <p style={{ color: COLOR_A }}>
        {labelA}: {totalA} {totalA === 1 ? "spell" : "spells"}
      </p>
      <p style={{ color: COLOR_B }}>
        {labelB}: {totalB} {totalB === 1 ? "spell" : "spells"}
      </p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderLabel(props: any) {
  const { x = 0, y = 0, width = 0, value = 0 } = props;
  if (!value) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 4}
      fill="#cbd5e1"
      textAnchor="middle"
      fontSize={10}
    >
      {value}
    </text>
  );
}

export default function ManaCurveOverlay({ data, labelA, labelB }: ManaCurveOverlayProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return (
    <section
      data-testid="mana-curve-overlay"
      aria-labelledby="curve-overlay-heading"
    >
      <h3
        id="curve-overlay-heading"
        className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400"
      >
        Mana Curve Comparison
      </h3>

      <ChartContainer
        height={240}
        ariaLabel={`Mana curve comparison chart showing ${labelA} in purple and ${labelB} in cyan, grouped by converted mana cost.`}
      >
        <BarChart data={data} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
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
            content={<CustomTooltip labelA={labelA} labelB={labelB} />}
            cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
          />
          <Legend
            formatter={(value) => (value === "totalA" ? labelA : labelB)}
            wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }}
          />
          <Bar
            dataKey="totalA"
            name="totalA"
            fill={COLOR_A}
            radius={[3, 3, 0, 0]}
            isAnimationActive={!prefersReducedMotion}
          >
            <LabelList dataKey="totalA" content={renderLabel} />
          </Bar>
          <Bar
            dataKey="totalB"
            name="totalB"
            fill={COLOR_B}
            radius={[3, 3, 0, 0]}
            isAnimationActive={!prefersReducedMotion}
          >
            <LabelList dataKey="totalB" content={renderLabel} />
          </Bar>
        </BarChart>
      </ChartContainer>
    </section>
  );
}
