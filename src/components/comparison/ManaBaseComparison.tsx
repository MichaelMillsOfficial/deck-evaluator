/**
 * ManaBaseComparison — comparison panel wrapping the existing MetricComparisonTable
 * plus a per-color pip / source / ratio "pressure" cross-tab.
 *
 * Surfaces the case where adds increase a color's pip demand without lifting
 * its source count (e.g. three RRR spells added, no new red lands).
 *
 * Used by /reading/compare; the standalone /compare uses MetricComparisonTable directly.
 */
import MetricComparisonTable from "@/components/MetricComparisonTable";
import type {
  ManaPressureComparison,
  ManaPressureVerdict,
  MetricDiff,
} from "@/lib/deck-comparison";

interface ManaBaseComparisonProps {
  diffs: MetricDiff[];
  pressure: ManaPressureComparison;
  labelA: string;
  labelB: string;
}

const COLOR_NAMES: Record<string, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
};

const VERDICT_LABEL: Record<ManaPressureVerdict, string> = {
  improved: "Improved",
  pressure: "Under pressure",
  underserved: "Underserved",
  neutral: "Steady",
};

const VERDICT_TOKEN: Record<ManaPressureVerdict, string> = {
  improved: "var(--color-good)",
  pressure: "var(--color-warn)",
  underserved: "var(--color-danger)",
  neutral: "var(--ink-tertiary)",
};

function formatRatio(r: number): string {
  if (!Number.isFinite(r)) return "—";
  return r.toFixed(2);
}

function manaSymbolUrl(color: string): string {
  return `https://svgs.scryfall.io/card-symbols/${color}.svg`;
}

export default function ManaBaseComparison({
  diffs,
  pressure,
  labelA,
  labelB,
}: ManaBaseComparisonProps) {
  // Only show colors that have demand on at least one side
  const visibleRows = pressure.byColor.filter(
    (c) => c.pipsA > 0 || c.pipsB > 0
  );

  return (
    <div
      data-testid="comparison-panel-mana-base"
      style={{
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border)",
        background: "var(--card-bg)",
        padding: "var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
      }}
    >
      <MetricComparisonTable diffs={diffs} labelA={labelA} labelB={labelB} />

      {visibleRows.length > 0 && (
        <section
          aria-labelledby="mana-pressure-heading"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
            paddingTop: "var(--space-4)",
            borderTop: "1px solid var(--border)",
          }}
        >
          <header
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "var(--space-3)",
              flexWrap: "wrap",
            }}
          >
            <h3
              id="mana-pressure-heading"
              style={{
                margin: 0,
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-eyebrow)",
                letterSpacing: "var(--tracking-eyebrow)",
                color: "var(--accent)",
                textTransform: "uppercase",
              }}
            >
              Color Pressure
            </h3>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-xs)",
                color: "var(--ink-tertiary)",
              }}
            >
              {pressure.anyPressure
                ? pressure.worstColor
                  ? `Watch ${COLOR_NAMES[pressure.worstColor]} — pip demand outpacing sources.`
                  : "Some colors lack source coverage."
                : "Sources keep pace with pip demand."}
            </p>
          </header>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-sm)",
            }}
          >
            <thead>
              <tr
                style={{
                  textAlign: "left",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-xs)",
                  letterSpacing: "var(--tracking-eyebrow)",
                  textTransform: "uppercase",
                  color: "var(--ink-tertiary)",
                }}
              >
                <th
                  scope="col"
                  style={{ paddingBottom: "var(--space-2)", fontWeight: "var(--weight-regular)" }}
                >
                  Color
                </th>
                <th
                  scope="col"
                  style={{
                    paddingBottom: "var(--space-2)",
                    fontWeight: "var(--weight-regular)",
                    textAlign: "right",
                  }}
                >
                  Pips ({labelA} → {labelB})
                </th>
                <th
                  scope="col"
                  style={{
                    paddingBottom: "var(--space-2)",
                    fontWeight: "var(--weight-regular)",
                    textAlign: "right",
                  }}
                >
                  Sources
                </th>
                <th
                  scope="col"
                  style={{
                    paddingBottom: "var(--space-2)",
                    fontWeight: "var(--weight-regular)",
                    textAlign: "right",
                  }}
                >
                  Ratio
                </th>
                <th
                  scope="col"
                  style={{
                    paddingBottom: "var(--space-2)",
                    fontWeight: "var(--weight-regular)",
                    textAlign: "right",
                  }}
                >
                  Verdict
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={row.color}
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <td style={{ padding: "var(--space-2) 0" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                      }}
                    >
                      <img
                        src={manaSymbolUrl(row.color)}
                        alt=""
                        aria-hidden="true"
                        width={18}
                        height={18}
                        style={{ flexShrink: 0 }}
                      />
                      <span style={{ color: "var(--ink-secondary)" }}>
                        {COLOR_NAMES[row.color] ?? row.color}
                      </span>
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "var(--space-2) 0",
                      textAlign: "right",
                      fontFamily: "var(--font-mono)",
                      color: "var(--ink-secondary)",
                    }}
                  >
                    {row.pipsA} → {row.pipsB}
                    {row.pipsDelta !== 0 && (
                      <span
                        aria-label={`pip change ${row.pipsDelta > 0 ? "up" : "down"} ${Math.abs(row.pipsDelta)}`}
                        style={{
                          marginLeft: "var(--space-2)",
                          color:
                            row.pipsDelta > 0
                              ? "var(--color-warn)"
                              : "var(--ink-tertiary)",
                        }}
                      >
                        ({row.pipsDelta > 0 ? "+" : ""}
                        {row.pipsDelta})
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "var(--space-2) 0",
                      textAlign: "right",
                      fontFamily: "var(--font-mono)",
                      color: "var(--ink-secondary)",
                    }}
                  >
                    {row.sourcesA} → {row.sourcesB}
                    {row.sourcesDelta !== 0 && (
                      <span
                        aria-label={`source change ${row.sourcesDelta > 0 ? "up" : "down"} ${Math.abs(row.sourcesDelta)}`}
                        style={{
                          marginLeft: "var(--space-2)",
                          color:
                            row.sourcesDelta > 0
                              ? "var(--color-good)"
                              : "var(--color-danger)",
                        }}
                      >
                        ({row.sourcesDelta > 0 ? "+" : ""}
                        {row.sourcesDelta})
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "var(--space-2) 0",
                      textAlign: "right",
                      fontFamily: "var(--font-mono)",
                      color: "var(--ink-secondary)",
                    }}
                  >
                    {formatRatio(row.ratioA)} → {formatRatio(row.ratioB)}
                  </td>
                  <td
                    style={{
                      padding: "var(--space-2) 0",
                      textAlign: "right",
                      color: VERDICT_TOKEN[row.verdict],
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-xs)",
                      letterSpacing: "var(--tracking-eyebrow)",
                      textTransform: "uppercase",
                    }}
                  >
                    {VERDICT_LABEL[row.verdict]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
