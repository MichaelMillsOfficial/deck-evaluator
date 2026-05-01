/**
 * ColorAnalysisComparison — comparison panel wrapping the existing TagComparisonChart.
 * Used by /reading/compare; the standalone /compare uses TagComparisonChart directly.
 */
import TagComparisonChart from "@/components/TagComparisonChart";
import type { TagComparison } from "@/lib/deck-comparison";

interface ColorAnalysisComparisonProps {
  data: TagComparison[];
  labelA: string;
  labelB: string;
}

export default function ColorAnalysisComparison({
  data,
  labelA,
  labelB,
}: ColorAnalysisComparisonProps) {
  return (
    <div
      data-testid="comparison-panel-color-analysis"
      style={{
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border)",
        background: "var(--card-bg)",
        padding: "var(--space-5)",
      }}
    >
      <TagComparisonChart data={data} labelA={labelA} labelB={labelB} />
    </div>
  );
}
