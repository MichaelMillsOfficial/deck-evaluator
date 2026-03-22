"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import ChartContainer from "@/components/ChartContainer";
import type { ComboAssemblyStats } from "@/lib/combo-assembly-tracker";

interface ComboAssemblyChartProps {
  comboStats: ComboAssemblyStats;
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const prob = payload[0].value;
  return (
    <div className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs shadow-lg">
      <p className="text-slate-300">Turn {label}</p>
      <p className="font-semibold text-purple-300">
        {(prob * 100).toFixed(1)}% assembled by now
      </p>
    </div>
  );
}

export default function ComboAssemblyChart({ comboStats }: ComboAssemblyChartProps) {
  const [selectedComboIndex, setSelectedComboIndex] = useState(0);

  if (comboStats.perCombo.length === 0) {
    return (
      <p className="text-sm text-slate-500">No combos detected in this deck.</p>
    );
  }

  const selectedCombo = comboStats.perCombo[selectedComboIndex];
  if (!selectedCombo) return null;

  // Build chart data from assemblyByTurn
  const chartData = selectedCombo.assemblyByTurn.map((prob, i) => ({
    turn: i + 1,
    probability: prob,
  }));

  // Find the first turn with assembly probability > 0
  const firstAssemblyIdx = chartData.findIndex((d) => d.probability > 0);

  return (
    <section aria-labelledby="combo-assembly-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h4
          id="combo-assembly-heading"
          className="text-sm font-semibold uppercase tracking-wide text-slate-400"
        >
          Combo Assembly Probability
        </h4>
        <p className="text-xs text-slate-500">
          {(selectedCombo.assemblyRate * 100).toFixed(1)}% assembled in simulation
        </p>
      </div>

      {/* Combo pill selector — only shown when multiple combos */}
      {comboStats.perCombo.length > 1 && (
        <nav
          aria-label="Combo selector"
          className="flex flex-wrap gap-2"
        >
          {comboStats.perCombo.map((combo, i) => (
            <button
              key={combo.comboId}
              type="button"
              onClick={() => setSelectedComboIndex(i)}
              aria-pressed={i === selectedComboIndex}
              className={`min-h-[44px] rounded-full border px-3 py-1 text-xs transition-colors cursor-pointer ${
                i === selectedComboIndex
                  ? "border-purple-500 bg-purple-900/30 text-purple-300"
                  : "border-slate-600 bg-slate-800 text-slate-400 hover:border-purple-500 hover:text-slate-200"
              }`}
            >
              {combo.comboName}
            </button>
          ))}
        </nav>
      )}

      {/* Bar chart */}
      <ChartContainer
        height={120}
        ariaLabel={`Combo assembly probability chart for ${selectedCombo.comboName}`}
      >
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 4, left: -28, bottom: 0 }}
        >
          <XAxis
            dataKey="turn"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#334155" }}
          />
          <YAxis
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            tick={{ fill: "#94a3b8", fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            domain={[0, 1]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148, 163, 184, 0.1)" }} />
          <Bar dataKey="probability" radius={[2, 2, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  firstAssemblyIdx !== -1 && index >= firstAssemblyIdx
                    ? "#a855f7" // purple-500 — assembled range
                    : "#334155" // slate-700 — not yet
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>

      {/* Screen reader table */}
      <table className="sr-only">
        <caption>Combo assembly probability by turn for {selectedCombo.comboName}</caption>
        <thead>
          <tr>
            <th>Turn</th>
            <th>Cumulative Assembly Probability</th>
          </tr>
        </thead>
        <tbody>
          {chartData.map((d) => (
            <tr key={d.turn}>
              <td>{d.turn}</td>
              <td>{(d.probability * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Piece breakdown */}
      {selectedCombo.pieceStats.length > 0 && (
        <details className="rounded-lg border border-slate-700 bg-slate-900/50">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 select-none">
            Piece breakdown
          </summary>
          <div className="px-3 pb-3 pt-1">
            <ul className="space-y-1.5">
              {selectedCombo.pieceStats.map((piece) => (
                <li key={piece.cardName} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{piece.cardName}</span>
                  <span className="flex gap-3 text-slate-500">
                    <span aria-label={`Draw rate: ${(piece.drawRate * 100).toFixed(0)}%`}>
                      Drawn {(piece.drawRate * 100).toFixed(0)}%
                    </span>
                    {piece.avgTurnFirstDrawn !== null && (
                      <span aria-label={`Average turn first drawn: ${piece.avgTurnFirstDrawn.toFixed(1)}`}>
                        Avg T{piece.avgTurnFirstDrawn.toFixed(1)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </section>
  );
}
