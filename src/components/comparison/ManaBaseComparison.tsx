/**
 * ManaBaseComparison — comparison panel wrapping the existing MetricComparisonTable.
 * Used by /reading/compare; the standalone /compare uses MetricComparisonTable directly.
 */
import MetricComparisonTable from "@/components/MetricComparisonTable";
import type { MetricDiff } from "@/lib/deck-comparison";

interface ManaBaseComparisonProps {
  diffs: MetricDiff[];
  labelA: string;
  labelB: string;
}

export default function ManaBaseComparison({
  diffs,
  labelA,
  labelB,
}: ManaBaseComparisonProps) {
  return (
    <div
      data-testid="comparison-panel-mana-base"
      style={{
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border)",
        background: "var(--card-bg)",
        padding: "var(--space-5)",
      }}
    >
      <MetricComparisonTable diffs={diffs} labelA={labelA} labelB={labelB} />
    </div>
  );
}
