import type { MetricDiff } from "@/lib/deck-comparison";

interface MetricComparisonTableProps {
  diffs: MetricDiff[];
  labelA: string;
  labelB: string;
}

function DiffCell({ diff, diffLabel }: { diff: number; diffLabel: string }) {
  if (diff === 0) {
    return <span className="text-slate-500">{diffLabel}</span>;
  }
  if (diff > 0) {
    // B is higher — neutral (neither good nor bad without context)
    return <span className="text-emerald-400">{diffLabel}</span>;
  }
  return <span className="text-red-400">{diffLabel}</span>;
}

function formatValue(value: number, unit?: string): string {
  if (unit === "%") return `${value}%`;
  if (unit === "/ 100") return `${value}/100`;
  return String(value);
}

export default function MetricComparisonTable({ diffs, labelA, labelB }: MetricComparisonTableProps) {
  return (
    <section aria-labelledby="metric-comparison-heading">
      <h3
        id="metric-comparison-heading"
        className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400"
      >
        Metric Comparison
      </h3>

      <div
        data-testid="metric-comparison-table"
        className="overflow-x-auto rounded-lg border border-slate-700"
      >
        <table className="table-auto w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-900/50">
              <th className="px-3 py-2.5 text-left font-medium text-slate-400">Metric</th>
              <th className="px-3 py-2.5 text-right font-medium text-purple-300">
                {labelA}
              </th>
              <th className="px-3 py-2.5 text-right font-medium text-cyan-400">
                {labelB}
              </th>
              <th className="px-3 py-2.5 text-right font-medium text-slate-400">
                Difference
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {diffs.map((row) => (
              <tr
                key={row.label}
                data-testid="metric-row"
                className="transition-colors hover:bg-slate-700/20 motion-reduce:transition-none"
              >
                <td className="px-3 py-2.5 text-slate-300">{row.label}</td>
                <td className="px-3 py-2.5 text-right font-mono text-purple-300">
                  {formatValue(row.valueA, row.unit)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-cyan-400">
                  {formatValue(row.valueB, row.unit)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono">
                  <DiffCell diff={row.diff} diffLabel={row.diffLabel} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
