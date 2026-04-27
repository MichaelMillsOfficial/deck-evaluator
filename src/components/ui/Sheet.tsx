"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Eyebrow } from "./Eyebrow";
import { Button } from "./Button";
import styles from "./Sheet.module.css";

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  eyebrow?: ReactNode;
  children?: ReactNode;
  /**
   * Optional accessible label override when no visible title is present.
   */
  ariaLabel?: string;
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  children,
  ariaLabel,
}: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const restoreRef = useRef<HTMLElement | null>(null);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab" && sheetRef.current) {
        const focusables = sheetRef.current.querySelectorAll<HTMLElement>(
          FOCUSABLE,
        );
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [open, onClose],
  );

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    document.addEventListener("keydown", handleKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the sheet on next tick.
    const t = window.setTimeout(() => {
      const node = sheetRef.current;
      if (!node) return;
      const focusables = node.querySelectorAll<HTMLElement>(FOCUSABLE);
      (focusables[0] ?? node).focus();
    }, 0);

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
      restoreRef.current?.focus?.();
    };
  }, [open, handleKey]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const labelledBy = title ? titleId : undefined;

  return createPortal(
    <>
      <div
        className={styles.scrim}
        onClick={onClose}
        aria-hidden="true"
        data-testid="sheet-scrim"
      />
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={!title ? ariaLabel : undefined}
        tabIndex={-1}
      >
        <div className={styles.grabber} aria-hidden="true" />
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            {title ? (
              <h2 id={labelledBy} className={styles.title}>
                {title}
              </h2>
            ) : null}
          </div>
          <Button
            variant="icon"
            aria-label="Close sheet"
            className={styles.close}
            onClick={onClose}
          >
            ×
          </Button>
        </div>
        {children}
      </div>
    </>,
    document.body,
  );
}
