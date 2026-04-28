import styles from "./CurveConstellation.module.css";

export type ManaCurve = {
  /** Counts indexed by CMC bucket — index 7 is "7+". Length must be 8. */
  buckets: [number, number, number, number, number, number, number, number];
};

export type CurveConstellationProps = {
  curve: ManaCurve;
  className?: string;
};

const LABELS = ["0", "1", "2", "3", "4", "5", "6", "7+"];

const VIEW_W = 200;
const VIEW_H = 70;
const PAD_X = 12;
const TOP = 22;
const BASE = 50;
const MIN_R = 1.4;
const MAX_R = 6.5;

export function CurveConstellation({ curve, className }: CurveConstellationProps) {
  const max = Math.max(1, ...curve.buckets);
  const step = (VIEW_W - PAD_X * 2) / (LABELS.length - 1);

  const points = curve.buckets.map((count, i) => {
    const ratio = count / max;
    const r = count === 0 ? MIN_R : MIN_R + Math.sqrt(ratio) * (MAX_R - MIN_R);
    const cx = PAD_X + i * step;
    // Vertical position: more cards drift toward top (drama)
    const cy = BASE - ratio * (BASE - TOP);
    return { count, r, cx, cy };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.cx.toFixed(2)} ${p.cy.toFixed(2)}`)
    .join(" ");

  const total = curve.buckets.reduce((s, n) => s + n, 0);

  return (
    <div className={[styles.wrap, className].filter(Boolean).join(" ")}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Mana curve: ${total} cards across ${LABELS.length} CMC buckets`}
      >
        <path className={styles.line} d={linePath} />
        {points.map((p, i) => (
          <g key={i} data-planet>
            {p.count > 0 ? (
              <circle
                cx={p.cx}
                cy={p.cy}
                r={p.r + 2.4}
                className={styles.planetGlow}
              />
            ) : null}
            <circle
              cx={p.cx}
              cy={p.cy}
              r={p.r}
              className={[styles.planet, p.count === 0 && styles.planetEmpty]
                .filter(Boolean)
                .join(" ")}
            />
            {p.count > 0 ? (
              <text x={p.cx} y={p.cy - p.r - 2.5} className={styles.count}>
                {p.count}
              </text>
            ) : null}
            <text x={p.cx} y={VIEW_H - 4} className={styles.label}>
              {LABELS[i]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
