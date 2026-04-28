import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Eyebrow } from "@/components/ui";
import styles from "./DeckHero.module.css";

export type DeckHeroProps = ComponentPropsWithoutRef<"section"> & {
  eyebrow: ReactNode;
  title: ReactNode;
  tagline?: ReactNode;
  /** Numeric score, typically 0–10. */
  score: number | string;
  /** Right-side meta after the score, e.g. "/10 · UPGRADED BRACKET". */
  scoreMeta?: ReactNode;
};

export function DeckHero({
  eyebrow,
  title,
  tagline,
  score,
  scoreMeta,
  className,
  ...rest
}: DeckHeroProps) {
  const classes = [styles.hero, className].filter(Boolean).join(" ");
  return (
    <section className={classes} {...rest}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className={styles.title}>{title}</h1>
      {tagline ? <p className={styles.tagline}>{tagline}</p> : null}
      <div className={styles.scoreRow}>
        <div className={styles.score} aria-label={`Score ${score}`}>
          {score}
        </div>
        {scoreMeta ? <div className={styles.scoreMeta}>{scoreMeta}</div> : null}
      </div>
    </section>
  );
}
