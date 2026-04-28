import styles from "./ColorPie.module.css";

export type ColorDistribution = {
  W?: number;
  U?: number;
  B?: number;
  R?: number;
  G?: number;
  C?: number;
};

export type ColorPieProps = {
  distribution: ColorDistribution;
  size?: number;
  showLegend?: boolean;
  className?: string;
};

const ORDER = ["W", "U", "B", "R", "G", "C"] as const;
const COLOR_VAR: Record<(typeof ORDER)[number], string> = {
  W: "var(--mana-w)",
  U: "var(--mana-u)",
  B: "var(--mana-b)",
  R: "var(--mana-r)",
  G: "var(--mana-g)",
  C: "var(--mana-c)",
};
const LABEL: Record<(typeof ORDER)[number], string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
  C: "Colorless",
};
const DOT_CLASS: Record<(typeof ORDER)[number], string> = {
  W: styles.dotW,
  U: styles.dotU,
  B: styles.dotB,
  R: styles.dotR,
  G: styles.dotG,
  C: styles.dotC,
};

export function ColorPie({
  distribution,
  size = 96,
  showLegend = true,
  className,
}: ColorPieProps) {
  const entries = ORDER.map((k) => ({ key: k, value: distribution[k] ?? 0 })).filter(
    (e) => e.value > 0,
  );
  const total = entries.reduce((sum, e) => sum + e.value, 0);

  const radius = 40;
  const stroke = 14;
  const cx = 50;
  const cy = 50;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className={[styles.wrap, className].filter(Boolean).join(" ")}>
      <svg
        className={styles.svg}
        width={size}
        height={size}
        viewBox="0 0 100 100"
        role="img"
        aria-label={`Color distribution: ${entries
          .map((e) => `${e.value} ${LABEL[e.key]}`)
          .join(", ")}`}
      >
        {/* Faint base ring so an empty pie is still visible */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        {entries.map((e) => {
          const fraction = total === 0 ? 0 : e.value / total;
          const length = fraction * circumference;
          const seg = (
            <circle
              key={e.key}
              data-segment={e.key}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={COLOR_VAR[e.key]}
              strokeWidth={stroke}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          offset += length;
          return seg;
        })}
      </svg>
      {showLegend && entries.length > 0 ? (
        <ul className={styles.legend}>
          {entries.map((e) => (
            <li key={e.key} className={styles.legendItem}>
              <span className={[styles.dot, DOT_CLASS[e.key]].join(" ")} aria-hidden="true" />
              {LABEL[e.key]} · {e.value}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
