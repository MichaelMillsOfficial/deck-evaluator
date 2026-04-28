import type { ReactNode } from "react";
import { StatTile } from "@/components/ui";
import styles from "./SectionHeader.module.css";

export interface SectionStat {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
}

export interface SectionHeaderProps {
  /** Mono uppercase label, e.g. "DECK LIST". */
  eyebrow: ReactNode;
  /** Spectral display title. */
  title: ReactNode;
  /** Italic Spectral one-line description below the title. */
  tagline: ReactNode;
  /** Stable testid suffix — produces e.g. data-testid="section-header-cards". */
  slug: string;
  /**
   * Optional "running head" line above the eyebrow — typically
   * "READING · 04.28.26 · DECK NAME". Carries the editorial date thread
   * from /reading down into each chapter.
   */
  runningHead?: ReactNode;
  /**
   * Optional 2-4 chapter epigraph stats. Mirrors the ReadingHero stat
   * strip but at smaller scale, so each detail page opens with the same
   * eyebrow + serif-number rhythm.
   */
  stats?: SectionStat[];
}

export default function SectionHeader({
  eyebrow,
  title,
  tagline,
  slug,
  runningHead,
  stats,
}: SectionHeaderProps) {
  return (
    <header
      data-testid={`section-header-${slug}`}
      className={styles.header}
    >
      {runningHead ? (
        <p className={styles.runningHead}>{runningHead}</p>
      ) : null}
      <span className={styles.eyebrow}>{eyebrow}</span>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.tagline}>{tagline}</p>
      {stats && stats.length > 0 ? (
        <div
          data-testid={`section-stats-${slug}`}
          className={styles.stats}
          style={{ "--stat-count": stats.length } as React.CSSProperties}
        >
          {stats.map((stat, idx) => (
            <StatTile
              key={idx}
              label={stat.label}
              value={stat.value}
              sub={stat.sub}
              accent={stat.accent}
            />
          ))}
        </div>
      ) : null}
    </header>
  );
}
