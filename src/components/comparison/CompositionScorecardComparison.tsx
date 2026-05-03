import type { CompositionComparison } from "@/lib/deck-comparison";
import type { CategoryStatus } from "@/lib/deck-composition";

interface CompositionScorecardComparisonProps {
  data: CompositionComparison;
  labelA: string;
  labelB: string;
}

function statusColor(status: CategoryStatus): string {
  switch (status) {
    case "good":
      return "var(--color-good)";
    case "low":
      return "var(--color-warn)";
    case "high":
      return "var(--color-warn)";
    case "critical":
      return "var(--color-danger)";
  }
}

function DeltaIndicator({ delta }: { delta: number }) {
  if (delta === 0)
    return (
      <span style={{ color: "var(--ink-tertiary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>
        0
      </span>
    );
  const color =
    delta > 0
      ? "var(--color-good)"
      : "var(--color-danger)";
  return (
    <span
      style={{
        color,
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--weight-semibold)",
      }}
    >
      {delta > 0 ? "+" : ""}
      {delta}
    </span>
  );
}

export default function CompositionScorecardComparison({
  data,
  labelA,
  labelB,
}: CompositionScorecardComparisonProps) {
  const { resultA, resultB } = data;

  // Merge categories from both results
  const allTags = new Set([
    ...resultA.categories.map((c) => c.tag),
    ...resultB.categories.map((c) => c.tag),
  ]);

  const rows = [...allTags].map((tag) => {
    const catA = resultA.categories.find((c) => c.tag === tag);
    const catB = resultB.categories.find((c) => c.tag === tag);
    const countA = catA?.count ?? 0;
    const countB = catB?.count ?? 0;
    const label = catA?.label ?? catB?.label ?? tag;
    const statusA = catA?.status ?? "critical";
    const statusB = catB?.status ?? "critical";
    return { tag, label, countA, countB, statusA, statusB, delta: countB - countA };
  });

  return (
    <div
      data-testid="comparison-panel-composition"
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
        COMPOSITION
      </div>
      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "var(--text-lg)",
          color: "var(--ink-primary)",
          margin: 0,
          marginBlockEnd: "var(--space-4)",
        }}
      >
        Scorecard
      </h3>

      <table
        style={{ width: "100%", borderCollapse: "collapse" }}
        aria-label="Composition scorecard comparison"
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
              Category
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
          {rows.map((row) => (
            <tr
              key={row.tag}
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
                {row.label}
              </td>
              <td
                style={{
                  textAlign: "right",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-sm)",
                  color: statusColor(row.statusA),
                  padding: "var(--space-2) 0",
                }}
              >
                {row.countA}
              </td>
              <td
                style={{
                  textAlign: "right",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-sm)",
                  color: statusColor(row.statusB),
                  padding: "var(--space-2) 0",
                }}
              >
                {row.countB}
              </td>
              <td
                style={{
                  textAlign: "right",
                  padding: "var(--space-2) 0",
                }}
              >
                <DeltaIndicator delta={row.delta} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Overall health summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-2)",
          marginTop: "var(--space-4)",
          paddingTop: "var(--space-3)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-xs)",
            color: "var(--ink-tertiary)",
          }}
        >
          {labelA}: <em style={{ color: "var(--ink-secondary)" }}>{resultA.overallHealth}</em>
        </p>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-xs)",
            color: "var(--ink-tertiary)",
          }}
        >
          {labelB}: <em style={{ color: "var(--ink-secondary)" }}>{resultB.overallHealth}</em>
        </p>
      </div>
    </div>
  );
}
