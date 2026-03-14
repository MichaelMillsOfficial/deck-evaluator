"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import ChartContainer from "@/components/ChartContainer";
import type { GoldfishAggregateStats } from "@/lib/goldfish-simulator";

interface GoldfishManaChartProps {
  stats: GoldfishAggregateStats;
  turns: number;
}

interface ChartDataPoint {
  turn: number;
  manaAvailable: number;
  manaUsed: number;
  spellsCast: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string }[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 text-slate-300">Turn {label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.dataKey === "manaAvailable"
            ? "Avg mana available"
            : p.dataKey === "manaUsed"
              ? "Avg mana used"
              : "Avg spells cast"}
          : <span className="font-semibold">{p.value.toFixed(2)}</span>
        </p>
      ))}
    </div>
  );
}

export default function GoldfishManaChart({ stats, turns }: GoldfishManaChartProps) {
  const data: ChartDataPoint[] = Array.from({ length: turns }, (_, i) => ({
    turn: i + 1,
    manaAvailable: stats.avgManaByTurn[i] ?? 0,
    manaUsed: stats.avgManaUsedByTurn[i] ?? 0,
    spellsCast: stats.avgSpellsByTurn[i] ?? 0,
  }));

  return (
    <ChartContainer
      ariaLabel="Goldfish simulator mana development chart showing average mana available, mana used, and spells cast per turn"
      height={260}
    >
      <LineChart
        data={data}
        margin={{ top: 8, right: 24, left: 0, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey="turn"
          tick={{ fill: "#94a3b8", fontSize: 12 }}
          label={{
            value: "Turn",
            position: "insideBottom",
            offset: -2,
            fill: "#64748b",
            fontSize: 11,
          }}
        />
        <YAxis
          yAxisId="mana"
          tick={{ fill: "#94a3b8", fontSize: 12 }}
          label={{
            value: "Mana",
            angle: -90,
            position: "insideLeft",
            fill: "#64748b",
            fontSize: 11,
          }}
        />
        <YAxis
          yAxisId="spells"
          orientation="right"
          tick={{ fill: "#94a3b8", fontSize: 12 }}
          label={{
            value: "Spells",
            angle: 90,
            position: "insideRight",
            fill: "#64748b",
            fontSize: 11,
          }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "#94a3b8", paddingTop: 8 }}
          formatter={(value: string) => {
            if (value === "manaAvailable") return "Avg Mana Available";
            if (value === "manaUsed") return "Avg Mana Used";
            if (value === "spellsCast") return "Avg Spells Cast";
            return value;
          }}
        />
        <Line
          yAxisId="mana"
          type="monotone"
          dataKey="manaAvailable"
          stroke="#a855f7"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          yAxisId="mana"
          type="monotone"
          dataKey="manaUsed"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          yAxisId="spells"
          type="monotone"
          dataKey="spellsCast"
          stroke="#22c55e"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          strokeDasharray="5 5"
        />
      </LineChart>
    </ChartContainer>
  );
}
