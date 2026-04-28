"use client";

import styles from "./CosmicLoader.module.css";

const PHRASES = [
  "Drawing the stars",
  "Reading the lands",
  "Counting the signs",
] as const;

export interface CosmicLoaderProps {
  /** Italic Spectral subtitle below the incantation. */
  tagline?: string;
}

export default function CosmicLoader({
  tagline = "A reading is being prepared.",
}: CosmicLoaderProps) {
  return (
    <div
      data-testid="cosmic-loader"
      role="status"
      aria-live="polite"
      aria-label="Preparing your deck reading"
      className={styles.container}
    >
      <div className={styles.orbWrap} aria-hidden="true">
        <div className={styles.orbHalo} />
        <div className={`${styles.orbRing} ${styles.orbRingOuter}`} />
        <div className={styles.orbRing} />
        <div className={styles.orbCore}>
          <span className={`${styles.orbSpark} ${styles.orbSpark1}`} />
          <span className={`${styles.orbSpark} ${styles.orbSpark2}`} />
          <span className={`${styles.orbSpark} ${styles.orbSpark3}`} />
        </div>
      </div>

      <div className={styles.phrases}>
        {PHRASES.map((phrase, index) => (
          <span
            key={phrase}
            className={`${styles.phrase} ${styles[`phrase${index + 1}`]}`}
          >
            {phrase}
          </span>
        ))}
      </div>

      <p className={styles.tagline}>{tagline}</p>
    </div>
  );
}
