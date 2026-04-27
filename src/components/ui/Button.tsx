import type { ButtonHTMLAttributes, ForwardedRef } from "react";
import { forwardRef } from "react";
import styles from "./Button.module.css";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "icon";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

function ButtonImpl(
  {
    variant = "primary",
    size = "md",
    className,
    type = "button",
    children,
    ...rest
  }: ButtonProps,
  ref: ForwardedRef<HTMLButtonElement>,
) {
  const sizeClass = variant === "icon" ? undefined : styles[size];
  const classes = [styles.btn, styles[variant], sizeClass, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button ref={ref} type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}

export const Button = forwardRef(ButtonImpl);
Button.displayName = "Button";
