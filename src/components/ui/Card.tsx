import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";
import styles from "./Card.module.css";

export type CardVariant = "surface" | "accent" | "outline";

export type CardProps = ComponentPropsWithoutRef<"div"> & {
  variant?: CardVariant;
  eyebrow?: ReactNode;
  title?: ReactNode;
  footer?: ReactNode;
};

export function Card({
  variant = "surface",
  eyebrow,
  title,
  footer,
  className,
  children,
  ...rest
}: CardProps) {
  const classes = [styles.card, styles[variant], className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      {eyebrow ? <Eyebrow className={styles.eyebrow}>{eyebrow}</Eyebrow> : null}
      {title ? <h3 className={styles.title}>{title}</h3> : null}
      {children}
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  );
}
