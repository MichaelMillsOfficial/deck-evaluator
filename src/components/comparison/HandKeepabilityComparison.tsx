"use client";

import type { HandKeepabilityComparison as HandKeepabilityComparisonData } from "@/lib/deck-comparison";

interface HandKeepabilityComparisonProps {
  data: HandKeepabilityComparisonData;
  labelA: string;
  labelB: string;
}

function DeltaLabel({ delta, unit = "%" }: { delta: number; unit?: string }) {
  const formatted = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}${unit}`;
  const color =
    delta > 0
      ? "var(--color-good)"
      : delta < 0
        ? "var(--color-danger)"
        : "var(--ink-tertiary)";

  return (
    <span
      aria-label={`Change: ${formatted}`}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-sm)",
        color,
        fontWeight: "var(--weight-semibold)",
      }}
    >
      {formatted}
    </span>
  );
}

export default function HandKeepabilityComparison({
  data,
  labelA,
  labelB,
}: HandKeepabilityComparisonProps) {
  const { statsA, statsB, keepRateDelta, avgScoreDelta } = data;

  const keepRateA = (statsA.keepableRate * 100).toFixed(1);
  const keepRateB = (statsB.keepableRate * 100).toFixed(1);
  const avgScoreA = statsA.avgScore.toFixed(1);
  const avgScoreB = statsB.avgScore.toFixed(1);

  return (
    <div
      data-testid="comparison-panel-hand-keepability"
      style={{
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border)",
        background: "var(--card-bg)",
        padding: "var(--space-5)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-eyebrow)",
          letterSpacing: "var(--tracking-eyebrow)",
          color: "var(--accent)",
          marginBottom: "var(--space-2)",
        }}
      >
        HAND ANALYSIS
      </div>
      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "var(--text-lg)",
          color: "var(--ink-primary)",
          marginBottom: "var(--space-4)",
          margin: 0,
          marginBlockEnd: "var(--space-4)",
        }}
      >
        Hand Keepability
      </h3>

      <table
        style={{ width: "100%", borderCollapse: "collapse" }}
        aria-label="Hand keepability comparison"
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-xs)",
                color: "var(--ink-tertiary)",
                paddingBottom: "var(--space-2)",
                fontWeight: "var(--weight-medium)",
              }}
            >
              Metric
            </th>
            <th
              style={{
                textAlign: "right",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-xs)",
                color: "var(--ink-tertiary)",
                paddingBottom: "var(--space-2)",
                fontWeight: "var(--weight-medium)",
              }}
            >
              {labelA}
            </th>
            <th
              style={{
                textAlign: "right",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-xs)",
                color: "var(--ink-tertiary)",
                paddingBottom: "var(--space-2)",
                fontWeight: "var(--weight-medium)",
              }}
            >
              {labelB}
            </th>
            <th
              style={{
                textAlign: "right",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-xs)",
                color: "var(--ink-tertiary)",
                paddingBottom: "var(--space-2)",
                fontWeight: "var(--weight-medium)",
              }}
            >
              Δ
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <td
              style={{
                padding: "var(--space-2) 0",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-sm)",
                color: "var(--ink-secondary)",
              }}
            >
              Keep Rate
            </td>
            <td
              style={{
                textAlign: "right",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-sm)",
                color: "var(--ink-primary)",
                padding: "var(--space-2) 0",
              }}
            >
              {keepRateA}%
            </td>
            <td
              style={{
                textAlign: "right",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-sm)",
                color: "var(--ink-primary)",
                padding: "var(--space-2) 0",
              }}
            >
              {keepRateB}%
            </td>
            <td
              style={{
                textAlign: "right",
                padding: "var(--space-2) 0",
              }}
            >
              <DeltaLabel delta={keepRateDelta * 100} />
            </td>
          </tr>
          <tr
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <td
              style={{
                padding: "var(--space-2) 0",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-sm)",
                color: "var(--ink-secondary)",
              }}
            >
              Avg Score
            </td>
            <td
              style={{
                textAlign: "right",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-sm)",
                color: "var(--ink-primary)",
                padding: "var(--space-2) 0",
              }}
            >
              {avgScoreA}
            </td>
            <td
              style={{
                textAlign: "right",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-sm)",
                color: "var(--ink-primary)",
                padding: "var(--space-2) 0",
              }}
            >
              {avgScoreB}
            </td>
            <td
              style={{
                textAlign: "right",
                padding: "var(--space-2) 0",
              }}
            >
              <DeltaLabel delta={avgScoreDelta} unit="" />
            </td>
          </tr>
        </tbody>
      </table>

      {/* Screen reader note about simulation */}
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-xs)",
          color: "var(--ink-tertiary)",
          marginTop: "var(--space-3)",
        }}
        aria-label="Simulation note"
      >
        Based on 200 hand simulations per deck.
      </p>
    </div>
  );
}
