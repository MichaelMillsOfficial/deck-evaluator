import type { ComponentPropsWithoutRef } from "react";
import styles from "./Eyebrow.module.css";

type EyebrowProps = ComponentPropsWithoutRef<"div"> & {
  as?: "div" | "span" | "p";
};

export function Eyebrow({
  as: Tag = "div",
  className,
  children,
  ...rest
}: EyebrowProps) {
  return (
    <Tag
      className={[styles.eyebrow, className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </Tag>
  );
}
