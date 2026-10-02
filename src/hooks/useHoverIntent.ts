"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Default rest before a hover opens the preview. */
export const HOVER_OPEN_DELAY = 350;
/** Grace period before a hover-out closes it, so the cursor can cross a gap. */
export const HOVER_CLOSE_DELAY = 120;

export interface HoverIntent {
  /** Whether the hovered surface should currently be shown. */
  active: boolean;
  /** Pointer handlers for the hit-area element. */
  hoverProps: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
  /** Focus handlers for the focusable trigger — focus opens instantly (a11y). */
  focusProps: {
    onFocus: () => void;
    onBlur: () => void;
  };
  /** Flip open/closed immediately (click / tap). */
  toggle: () => void;
  /** Close immediately. */
  close: () => void;
}

/**
 * Hover-intent gate: opens after `openDelay` of rest, closes after a short grace
 * period, and opens instantly on keyboard focus. Timers are cancelled on every
 * transition and on unmount, so rapid cursor sweeps never flicker the surface.
 */
export function useHoverIntent(openDelay: number = HOVER_OPEN_DELAY): HoverIntent {
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const openLater = useCallback(() => {
    clear();
    timer.current = setTimeout(() => setActive(true), openDelay);
  }, [clear, openDelay]);

  const closeLater = useCallback(() => {
    clear();
    timer.current = setTimeout(() => setActive(false), HOVER_CLOSE_DELAY);
  }, [clear]);

  const openNow = useCallback(() => {
    clear();
    setActive(true);
  }, [clear]);

  const close = useCallback(() => {
    clear();
    setActive(false);
  }, [clear]);

  const toggle = useCallback(() => {
    clear();
    setActive((open) => !open);
  }, [clear]);

  return {
    active,
    hoverProps: { onMouseEnter: openLater, onMouseLeave: closeLater },
    focusProps: { onFocus: openNow, onBlur: close },
    toggle,
    close,
  };
}
