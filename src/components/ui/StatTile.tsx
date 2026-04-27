import type { ComponentPropsWithoutRef, ReactNode } from "react";
import styles from "./StatTile.module.css";

export type StatTileProps = ComponentPropsWithoutRef<"div"> & {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
};

export function StatTile({
  label,
  value,
  sub,
  accent,
  className,
  ...rest
}: StatTileProps) {
  return (
    <div
      className={[styles.tile, className].filter(Boolean).join(" ")}
      {...rest}
    >
      <div className={styles.label}>{label}</div>
      <div
        className={[styles.value, accent && styles.accent]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </div>
      {sub ? <div className={styles.sub}>{sub}</div> : null}
    </div>
  );
}
