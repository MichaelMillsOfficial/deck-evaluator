// ---------------------------------------------------------------------------
// AnalysisSummaryCard — Satori-compatible JSX component for PNG export
//
// IMPORTANT: This component uses Satori's subset of flexbox CSS.
// - Use only `display: 'flex'` (no grid)
// - No Tailwind classes — use inline styles with hex color values only
// - No external images (CORS issues with Scryfall CDN)
// - No Recharts or SVG charts (Satori cannot render them)
// - All color values must be hex strings
// ---------------------------------------------------------------------------

export interface AnalysisSummaryCardProps {
  deckName: string;
  commanders: string[];
  cardCount: number;
  powerLevel: number;
  bracket: number;
  bracketName: string;
  averageCmc: number;
  keepableRate: number;
  landEfficiencyScore: number;
  themes: string[];
  combos: { cards: string[]; description: string }[];
  manaCurve: { cmc: string; count: number }[];
  exportDate: string;
}

const styles = {
  container: {
    display: "flex" as const,
    flexDirection: "column" as const,
    width: 600,
    height: 450,
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    fontFamily: "Inter",
    padding: 24,
  },
  header: {
    display: "flex" as const,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
    borderBottom: "1px solid #334155",
    paddingBottom: 12,
    marginBottom: 16,
  },
  headerLeft: {
    display: "flex" as const,
    flexDirection: "column" as const,
    gap: 2,
    flex: 1,
  },
  headerRight: {
    display: "flex" as const,
    flexDirection: "column" as const,
    alignItems: "flex-end" as const,
    gap: 4,
  },
  deckName: {
    display: "flex" as const,
    fontSize: 20,
    fontWeight: 700,
    color: "#f8fafc",
    lineHeight: 1.2,
  },
  commander: {
    display: "flex" as const,
    fontSize: 13,
    color: "#a78bfa",
    lineHeight: 1.3,
  },
  cardCount: {
    display: "flex" as const,
    fontSize: 12,
    color: "#94a3b8",
  },
  appLabel: {
    display: "flex" as const,
    fontSize: 11,
    color: "#7c3aed",
    fontWeight: 600,
  },
  section: {
    display: "flex" as const,
    flexDirection: "column" as const,
    marginBottom: 14,
  },
  sectionTitle: {
    display: "flex" as const,
    fontSize: 11,
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 6,
  },
  statsRow: {
    display: "flex" as const,
    flexDirection: "row" as const,
    gap: 12,
    flexWrap: "wrap" as const,
  },
  statBox: {
    display: "flex" as const,
    flexDirection: "column" as const,
    backgroundColor: "#1e293b",
    borderRadius: 6,
    padding: "8px 12px",
    minWidth: 90,
    flex: 1,
  },
  statLabel: {
    display: "flex" as const,
    fontSize: 10,
    color: "#64748b",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statValue: {
    display: "flex" as const,
    fontSize: 20,
    fontWeight: 700,
    color: "#f1f5f9",
    lineHeight: 1,
  },
  statSub: {
    display: "flex" as const,
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
  curveContainer: {
    display: "flex" as const,
    flexDirection: "row" as const,
    alignItems: "flex-end" as const,
    gap: 3,
    height: 50,
  },
  curveBarWrapper: {
    display: "flex" as const,
    flexDirection: "column" as const,
    alignItems: "center" as const,
    justifyContent: "flex-end" as const,
    flex: 1,
    height: 50,
    gap: 2,
  },
  curveLabel: {
    display: "flex" as const,
    fontSize: 9,
    color: "#64748b",
    textAlign: "center" as const,
  },
  themesRow: {
    display: "flex" as const,
    flexDirection: "row" as const,
    gap: 6,
    flexWrap: "wrap" as const,
  },
  themePill: {
    display: "flex" as const,
    backgroundColor: "#4c1d95",
    borderRadius: 4,
    padding: "3px 8px",
    fontSize: 11,
    color: "#c4b5fd",
    fontWeight: 500,
  },
  comboList: {
    display: "flex" as const,
    flexDirection: "column" as const,
    gap: 3,
  },
  comboItem: {
    fontSize: 11,
    color: "#cbd5e1",
    display: "flex" as const,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
  },
  comboDot: {
    display: "flex" as const,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#9333ea",
    flexShrink: 0,
  },
  footer: {
    display: "flex" as const,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginTop: "auto",
    borderTop: "1px solid #1e293b",
    paddingTop: 8,
  },
  footerText: {
    display: "flex" as const,
    fontSize: 10,
    color: "#475569",
  },
};

export function AnalysisSummaryCard({
  deckName,
  commanders,
  cardCount,
  powerLevel,
  bracket,
  bracketName,
  averageCmc,
  keepableRate,
  landEfficiencyScore,
  themes,
  combos,
  manaCurve,
  exportDate,
}: AnalysisSummaryCardProps) {
  const displayCombos = combos.slice(0, 3);
  const displayThemes = themes.slice(0, 5);
  const commanderText =
    commanders.length > 0 ? commanders.join(" & ") : "No Commander";

  // Normalize curve bars to max height of 42px
  const maxCount = Math.max(...manaCurve.map((b) => b.count), 1);
  const curveBuckets = manaCurve.filter((b) => b.count > 0).slice(0, 10);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.deckName}>{deckName}</div>
          <div style={styles.commander}>{commanderText}</div>
          <div style={styles.cardCount}>{`${cardCount} cards`}</div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.appLabel}>MTG Deck Evaluator</div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Overview</div>
        <div style={styles.statsRow}>
          <div style={styles.statBox}>
            <div style={styles.statLabel}>Power Level</div>
            <div style={{ ...styles.statValue, color: "#a78bfa" }}>{powerLevel}</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statLabel}>Bracket</div>
            <div style={styles.statValue}>{bracket}</div>
            <div style={styles.statSub}>{bracketName}</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statLabel}>Avg CMC</div>
            <div style={styles.statValue}>{averageCmc.toFixed(1)}</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statLabel}>Keep Rate</div>
            <div style={styles.statValue}>{`${keepableRate}%`}</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statLabel}>Land Eff.</div>
            <div style={styles.statValue}>{landEfficiencyScore}</div>
            <div style={styles.statSub}>/100</div>
          </div>
        </div>
      </div>

      {/* Mana Curve */}
      {curveBuckets.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Mana Curve</div>
          <div style={styles.curveContainer}>
            {curveBuckets.map((bucket) => {
              const barHeight = Math.max(4, Math.round((bucket.count / maxCount) * 42));
              return (
                <div key={bucket.cmc} style={styles.curveBarWrapper}>
                  <div
                    style={{
                      display: "flex" as const,
                      width: "100%",
                      height: barHeight,
                      backgroundColor: "#9333ea",
                      borderRadius: "2px 2px 0 0",
                      minHeight: 4,
                    }}
                  />
                  <div style={styles.curveLabel}>{bucket.cmc}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Synergy Themes */}
      {displayThemes.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Themes</div>
          <div style={styles.themesRow}>
            {displayThemes.map((theme) => (
              <div key={theme} style={styles.themePill}>
                {theme}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Known Combos */}
      {displayCombos.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>{`Combos (${combos.length})`}</div>
          <div style={styles.comboList}>
            {displayCombos.map((combo, i) => (
              <div key={i} style={styles.comboItem}>
                <div style={styles.comboDot} />
                <div style={{ display: "flex" as const }}>{combo.cards.slice(0, 3).join(" + ")}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={styles.footer}>
        <div style={styles.footerText}>deck-evaluator.app</div>
        <div style={styles.footerText}>{`Exported ${exportDate}`}</div>
      </div>
    </div>
  );
}
