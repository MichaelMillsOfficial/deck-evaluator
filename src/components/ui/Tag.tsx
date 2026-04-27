import type { ComponentPropsWithoutRef } from "react";
import styles from "./Tag.module.css";

export type TagVariant =
  | "accent"
  | "cyan"
  | "gold"
  | "ok"
  | "warn"
  | "watch"
  | "ghost";

export type TagProps = ComponentPropsWithoutRef<"span"> & {
  variant?: TagVariant;
};

export function Tag({
  variant = "accent",
  className,
  children,
  ...rest
}: TagProps) {
  const classes = [styles.tag, styles[variant], className]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}
