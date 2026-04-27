import type { TextareaHTMLAttributes, ForwardedRef } from "react";
import { forwardRef } from "react";
import styles from "./Input.module.css";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  mono?: boolean;
  invalid?: boolean;
};

function TextareaImpl(
  { mono, invalid, className, ...rest }: TextareaProps,
  ref: ForwardedRef<HTMLTextAreaElement>,
) {
  const classes = [
    styles.field,
    styles.textarea,
    mono && styles.mono,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <textarea
      ref={ref}
      className={classes}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export const Textarea = forwardRef(TextareaImpl);
Textarea.displayName = "Textarea";
