import type { ComponentPropsWithoutRef, MouseEventHandler } from "react";
import { CardTag, type DeckRole } from "@/components/ui";
import { ManaCost, type ManaSymbol } from "./ManaCost";
import styles from "./CardRow.module.css";

export type CardRowProps = Omit<ComponentPropsWithoutRef<"div">, "onClick"> & {
  qty: number;
  name: string;
  cost?: ManaSymbol[];
  role?: DeckRole;
  /** Pre-formatted price string, e.g. "$4.20". */
  price?: string;
  onClick?: MouseEventHandler<HTMLDivElement | HTMLButtonElement>;
};

export function CardRow({
  qty,
  name,
  cost,
  role,
  price,
  onClick,
  className,
  ...rest
}: CardRowProps) {
  const interactive = Boolean(onClick);
  const classes = [styles.row, interactive && styles.interactive, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.(e as never);
              }
            }
          : undefined
      }
      {...rest}
    >
      <span className={styles.qty}>{qty}×</span>
      <span className={styles.name}>{name}</span>
      <span className={styles.cost}>
        {cost && cost.length > 0 ? <ManaCost symbols={cost} /> : null}
      </span>
      <span>{role ? <CardTag role={role} /> : null}</span>
      <span className={styles.price}>{price}</span>
    </div>
  );
}
