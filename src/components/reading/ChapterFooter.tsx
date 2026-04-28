import Link from "next/link";
import { readingNeighbors, type ViewTab } from "@/lib/view-tabs";
import styles from "./ChapterFooter.module.css";

export interface ChapterFooterProps {
  /** The current chapter — the footer derives prev/next from READING_ORDER. */
  current: ViewTab;
}

/**
 * Magazine-style running footer for every /reading/* sub-route.
 * Shows ← previous chapter on the left, "All sections" pointer in the
 * middle that returns to /reading, and next chapter → on the right.
 * Quiet mono uppercase typography matching the chapter eyebrow rhythm.
 */
export default function ChapterFooter({ current }: ChapterFooterProps) {
  const { prev, next } = readingNeighbors(current);

  return (
    <nav
      data-testid={`chapter-footer-${current}`}
      aria-label="Chapter navigation"
      className={styles.footer}
    >
      <div className={styles.slot} data-position="prev">
        {prev ? (
          <Link href={prev.route} className={styles.link}>
            <span aria-hidden="true">←</span>
            <span className={styles.label}>{prev.label}</span>
          </Link>
        ) : (
          <span className={styles.spacer} aria-hidden="true" />
        )}
      </div>

      <div className={styles.slot} data-position="index">
        <Link href="/reading" className={styles.indexLink}>
          All sections
        </Link>
      </div>

      <div className={styles.slot} data-position="next">
        {next ? (
          <Link href={next.route} className={styles.link}>
            <span className={styles.label}>{next.label}</span>
            <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <span className={styles.spacer} aria-hidden="true" />
        )}
      </div>
    </nav>
  );
}
