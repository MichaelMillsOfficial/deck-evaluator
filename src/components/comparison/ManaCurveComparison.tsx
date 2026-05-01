/**
 * ManaCurveComparison — comparison panel wrapping the existing ManaCurveOverlay.
 * Used by /reading/compare; the standalone /compare uses ManaCurveOverlay directly.
 */
import ManaCurveOverlay from "@/components/ManaCurveOverlay";
import type { ManaCurveOverlayBucket } from "@/lib/deck-comparison";

interface ManaCurveComparisonProps {
  data: ManaCurveOverlayBucket[];
  labelA: string;
  labelB: string;
}

export default function ManaCurveComparison({
  data,
  labelA,
  labelB,
}: ManaCurveComparisonProps) {
  return (
    <div
      data-testid="comparison-panel-mana-curve"
      style={{
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border)",
        background: "var(--card-bg)",
        padding: "var(--space-5)",
      }}
    >
      <ManaCurveOverlay data={data} labelA={labelA} labelB={labelB} />
    </div>
  );
}
