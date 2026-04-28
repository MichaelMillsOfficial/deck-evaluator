import type { ReactNode } from "react";
import styles from "./SectionHeader.module.css";

export interface SectionHeaderProps {
  /** Mono uppercase label, e.g. "COMPOSITION". */
  eyebrow: ReactNode;
  /** Spectral display title. */
  title: ReactNode;
  /** Italic Spectral one-line description below the title. */
  tagline: ReactNode;
  /** Stable testid suffix — produces e.g. data-testid="section-header-composition". */
  slug: string;
}

export default function SectionHeader({
  eyebrow,
  title,
  tagline,
  slug,
}: SectionHeaderProps) {
  return (
    <header
      data-testid={`section-header-${slug}`}
      className={styles.header}
    >
      <span className={styles.eyebrow}>{eyebrow}</span>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.tagline}>{tagline}</p>
    </header>
  );
}
