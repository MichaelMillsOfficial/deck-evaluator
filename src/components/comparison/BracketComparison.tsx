import type { BracketComparison as BracketComparisonData } from "@/lib/deck-comparison";
import { BRACKET_NAMES } from "@/lib/bracket-estimator";

interface BracketComparisonProps {
  data: BracketComparisonData;
  labelA: string;
  labelB: string;
}

function BracketBadge({ bracket }: { bracket: number }) {
  const color =
    bracket <= 2
      ? "var(--color-good)"
      : bracket === 3
        ? "var(--color-warn)"
        : "var(--color-danger)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 40,
        height: 40,
        borderRadius: "var(--radius-full)",
        border: `2px solid ${color}`,
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        fontFamily: "var(--font-serif)",
        fontSize: "var(--text-lg)",
        fontWeight: "var(--weight-bold)",
        color,
      }}
      aria-label={`Bracket ${bracket}: ${BRACKET_NAMES[bracket]}`}
    >
      {bracket}
    </span>
  );
}

export default function BracketComparison({
  data,
  labelA,
  labelB,
}: BracketComparisonProps) {
  const { resultA, resultB, bracketDelta } = data;

  const deltaColor =
    bracketDelta === 0
      ? "var(--ink-tertiary)"
      : bracketDelta > 0
        ? "var(--color-danger)"
        : "var(--color-good)";

  return (
    <div
      data-testid="comparison-panel-bracket"
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
        POWER ASSESSMENT
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
        Bracket Estimate
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: "var(--space-4)",
        }}
      >
        {/* Slot A */}
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-xs)",
              color: "var(--ink-tertiary)",
              marginBottom: "var(--space-2)",
            }}
          >
            {labelA}
          </p>
          <BracketBadge bracket={resultA.bracket} />
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-xs)",
              color: "var(--ink-secondary)",
              marginTop: "var(--space-1)",
            }}
          >
            {resultA.bracketName}
          </p>
        </div>

        {/* Delta */}
        <div style={{ textAlign: "center" }}>
          {bracketDelta === 0 ? (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-sm)",
                color: "var(--ink-tertiary)",
              }}
            >
              =
            </span>
          ) : (
            <span
              aria-label={`Bracket change: ${bracketDelta > 0 ? "+" : ""}${bracketDelta}`}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-sm)",
                color: deltaColor,
                fontWeight: "var(--weight-semibold)",
              }}
            >
              {bracketDelta > 0 ? "↑" : "↓"}
              {Math.abs(bracketDelta)}
            </span>
          )}
        </div>

        {/* Slot B */}
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-xs)",
              color: "var(--ink-tertiary)",
              marginBottom: "var(--space-2)",
            }}
          >
            {labelB}
          </p>
          <BracketBadge bracket={resultB.bracket} />
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-xs)",
              color: "var(--ink-secondary)",
              marginTop: "var(--space-1)",
            }}
          >
            {resultB.bracketName}
          </p>
        </div>
      </div>
    </div>
  );
}
