import type { PowerLevelComparison as PowerLevelComparisonData } from "@/lib/deck-comparison";

interface PowerLevelComparisonProps {
  data: PowerLevelComparisonData;
  labelA: string;
  labelB: string;
}

function PowerLevelBar({
  level,
  label,
}: {
  level: number;
  label: string;
}) {
  const pct = ((level - 1) / 9) * 100; // 1-10 scale → 0-100%
  const color =
    level <= 4
      ? "var(--color-good)"
      : level <= 7
        ? "var(--color-warn)"
        : "var(--color-danger)";

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "var(--space-1)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-xs)",
            color: "var(--ink-tertiary)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-sm)",
            color,
            fontWeight: "var(--weight-semibold)",
          }}
        >
          {level}/10
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={level}
        aria-valuemin={1}
        aria-valuemax={10}
        aria-label={`${label} power level: ${level} out of 10`}
        style={{
          height: 8,
          borderRadius: "var(--radius-full)",
          background: "var(--surface-2)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: "var(--radius-full)",
            background: color,
            transition: "width 400ms ease",
          }}
          className="motion-reduce:transition-none"
        />
      </div>
    </div>
  );
}

export default function PowerLevelComparison({
  data,
  labelA,
  labelB,
}: PowerLevelComparisonProps) {
  const { resultA, resultB, powerLevelDelta } = data;

  const deltaColor =
    powerLevelDelta === 0
      ? "var(--ink-tertiary)"
      : powerLevelDelta > 0
        ? "var(--color-danger)"
        : "var(--color-good)";

  return (
    <div
      data-testid="comparison-panel-power-level"
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
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
        }}
      >
        Power Level
        {powerLevelDelta !== 0 && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-sm)",
              color: deltaColor,
            }}
            aria-label={`Power level change: ${powerLevelDelta > 0 ? "+" : ""}${powerLevelDelta}`}
          >
            {powerLevelDelta > 0 ? "+" : ""}
            {powerLevelDelta}
          </span>
        )}
      </h3>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        <PowerLevelBar level={resultA.powerLevel} label={labelA} />
        <PowerLevelBar level={resultB.powerLevel} label={labelB} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-2)",
          marginTop: "var(--space-4)",
        }}
      >
        <div>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-xs)",
              color: "var(--ink-tertiary)",
            }}
          >
            {labelA}:{" "}
          </span>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-xs)",
              color: "var(--ink-secondary)",
              fontStyle: "italic",
            }}
          >
            {resultA.bandLabel}
          </span>
        </div>
        <div>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-xs)",
              color: "var(--ink-tertiary)",
            }}
          >
            {labelB}:{" "}
          </span>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-xs)",
              color: "var(--ink-secondary)",
              fontStyle: "italic",
            }}
          >
            {resultB.bandLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
