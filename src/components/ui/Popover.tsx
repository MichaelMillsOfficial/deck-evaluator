"use client";

import {
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import styles from "./Popover.module.css";

export type PopoverProps = {
  open: boolean;
  onClose: () => void;
  /**
   * Ref to the positioned container holding both the trigger and this
   * popover. Clicks outside it close the popover; the container must be
   * `position: relative` (or otherwise positioned) for anchoring.
   */
  anchorRef: RefObject<HTMLElement | null>;
  ariaLabel?: string;
  className?: string;
  children?: ReactNode;
  "data-testid"?: string;
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Non-modal anchored surface: floats below its trigger inside a positioned
 * anchor, closes on Escape or outside click, and moves focus to its first
 * focusable on open (restoring it on close). Unlike `Sheet`, it neither
 * traps focus nor scrims the page — the rest of the UI stays interactive.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  ariaLabel,
  className,
  children,
  "data-testid": testId,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Same latest-callback pattern as Sheet: callers pass inline closures, and
  // re-running the open effect per parent render would re-snap focus.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    const handleMouseDown = (e: MouseEvent) => {
      const anchor = anchorRef.current;
      if (anchor && !anchor.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleMouseDown);

    const t = window.setTimeout(() => {
      const node = panelRef.current;
      if (!node) return;
      const focusables = node.querySelectorAll<HTMLElement>(FOCUSABLE);
      (focusables[0] ?? node).focus();
    }, 0);

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleMouseDown);
      window.clearTimeout(t);
      restoreRef.current?.focus?.();
    };
  }, [open, anchorRef]);

  if (!open) return null;

  const classes = [styles.popover, className].filter(Boolean).join(" ");
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={ariaLabel}
      className={classes}
      data-testid={testId}
      tabIndex={-1}
    >
      {children}
    </div>
  );
}
