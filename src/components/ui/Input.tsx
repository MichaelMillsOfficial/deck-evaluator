import type { InputHTMLAttributes, ForwardedRef } from "react";
import { forwardRef } from "react";
import styles from "./Input.module.css";

export type InputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size"
> & {
  mono?: boolean;
  invalid?: boolean;
};

function InputImpl(
  { mono, invalid, className, ...rest }: InputProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  const classes = [styles.field, mono && styles.mono, className]
    .filter(Boolean)
    .join(" ");
  return (
    <input
      ref={ref}
      className={classes}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export const Input = forwardRef(InputImpl);
Input.displayName = "Input";
