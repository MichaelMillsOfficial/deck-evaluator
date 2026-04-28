import styles from "./CosmosBackground.module.css";

// Deterministic star field — chosen offline to avoid hydration mismatch and
// to keep the layout consistent across reloads. Coordinates are in a
// 0–100 SVG viewBox; the SVG itself stretches to fill the viewport.
type Star = { cx: number; cy: number; r: number; delay: number; duration: number };

const STARS: Star[] = [
  { cx: 4, cy: 8, r: 0.18, delay: 0.0, duration: 4.0 },
  { cx: 12, cy: 22, r: 0.22, delay: 1.2, duration: 5.2 },
  { cx: 19, cy: 6, r: 0.14, delay: 2.4, duration: 3.6 },
  { cx: 27, cy: 38, r: 0.2, delay: 0.6, duration: 4.8 },
  { cx: 33, cy: 14, r: 0.16, delay: 1.8, duration: 4.2 },
  { cx: 41, cy: 71, r: 0.24, delay: 0.3, duration: 5.6 },
  { cx: 47, cy: 28, r: 0.12, delay: 2.1, duration: 3.4 },
  { cx: 54, cy: 56, r: 0.2, delay: 1.5, duration: 4.4 },
  { cx: 61, cy: 12, r: 0.18, delay: 0.9, duration: 5.0 },
  { cx: 67, cy: 84, r: 0.22, delay: 2.7, duration: 4.6 },
  { cx: 73, cy: 41, r: 0.14, delay: 0.4, duration: 3.8 },
  { cx: 79, cy: 19, r: 0.2, delay: 1.7, duration: 5.4 },
  { cx: 86, cy: 64, r: 0.16, delay: 2.2, duration: 4.0 },
  { cx: 92, cy: 32, r: 0.18, delay: 0.7, duration: 4.6 },
  { cx: 96, cy: 9, r: 0.12, delay: 1.3, duration: 3.2 },
  { cx: 8, cy: 47, r: 0.16, delay: 2.0, duration: 4.8 },
  { cx: 16, cy: 78, r: 0.2, delay: 0.5, duration: 5.2 },
  { cx: 23, cy: 91, r: 0.14, delay: 1.4, duration: 3.6 },
  { cx: 30, cy: 60, r: 0.22, delay: 2.5, duration: 4.4 },
  { cx: 38, cy: 4, r: 0.18, delay: 0.8, duration: 5.0 },
  { cx: 45, cy: 88, r: 0.16, delay: 1.6, duration: 4.2 },
  { cx: 52, cy: 18, r: 0.12, delay: 2.3, duration: 3.4 },
  { cx: 58, cy: 76, r: 0.2, delay: 0.2, duration: 4.8 },
  { cx: 64, cy: 35, r: 0.18, delay: 1.9, duration: 5.6 },
  { cx: 70, cy: 8, r: 0.14, delay: 2.6, duration: 3.8 },
  { cx: 76, cy: 67, r: 0.22, delay: 0.6, duration: 4.6 },
  { cx: 82, cy: 49, r: 0.16, delay: 1.1, duration: 4.0 },
  { cx: 88, cy: 86, r: 0.18, delay: 2.4, duration: 5.0 },
  { cx: 94, cy: 54, r: 0.12, delay: 0.9, duration: 3.4 },
  { cx: 3, cy: 69, r: 0.2, delay: 2.0, duration: 4.4 },
  { cx: 11, cy: 95, r: 0.14, delay: 1.5, duration: 3.6 },
  { cx: 36, cy: 52, r: 0.16, delay: 0.4, duration: 5.2 },
  { cx: 49, cy: 81, r: 0.18, delay: 2.8, duration: 4.0 },
  { cx: 66, cy: 50, r: 0.12, delay: 1.0, duration: 3.8 },
  { cx: 80, cy: 6, r: 0.18, delay: 2.2, duration: 4.6 },
  { cx: 14, cy: 38, r: 0.14, delay: 0.7, duration: 5.4 },
  { cx: 25, cy: 25, r: 0.16, delay: 1.8, duration: 4.2 },
  { cx: 42, cy: 44, r: 0.12, delay: 2.5, duration: 3.4 },
  { cx: 57, cy: 90, r: 0.2, delay: 0.3, duration: 4.8 },
  { cx: 71, cy: 26, r: 0.14, delay: 1.6, duration: 5.0 },
];

export function CosmosBackground() {
  return (
    <div
      className={styles.cosmos}
      data-testid="cosmos-background"
      aria-hidden="true"
    >
      <svg
        className={styles.stars}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        focusable="false"
      >
        {STARS.map((s, i) => (
          <circle
            key={i}
            className={styles.star}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            style={{
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
            }}
          />
        ))}
      </svg>
    </div>
  );
}
