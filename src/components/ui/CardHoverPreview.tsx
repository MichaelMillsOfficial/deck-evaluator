"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { EnrichedCard } from "@/lib/types";
import { useHoverIntent } from "@/hooks/useHoverIntent";
import styles from "./CardHoverPreview.module.css";

const PREVIEW_WIDTH = 240;
/** Scryfall "normal" art is 488×680 → ~1.393 tall. Used to estimate panel height. */
const CARD_RATIO = 680 / 488;
const GAP = 12;
const VIEWPORT_MARGIN = 8;

type RefCallback = (node: HTMLElement | null) => void;

export interface CardHoverPreviewRenderProps {
  active: boolean;
  /** Attach to the hit-area / positioning anchor element via `ref={anchorRef}`. */
  anchorRef: RefCallback;
  /** Spread on the same hit-area element (whole row or name cell). */
  anchorProps: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
  /** Spread on the focusable trigger (name button) for keyboard users. */
  focusProps: {
    onFocus: () => void;
    onBlur: () => void;
  };
  /** Flip open/closed (wire to a click for tap-to-preview). */
  toggle: () => void;
  /** Close immediately. */
  close: () => void;
}

export interface CardHoverPreviewProps {
  /** Card name — used for alt text and the text fallback. */
  name: string;
  /** Enriched data. When absent, no preview renders. */
  enriched?: EnrichedCard;
  /** Override the hover-open delay (ms). */
  openDelay?: number;
  /** test id applied to the portaled tooltip panel. */
  "data-testid"?: string;
  children: (props: CardHoverPreviewRenderProps) => ReactNode;
}

/**
 * Portaled, hover-intent card preview. Owns the open/close timing, renders the
 * caller's trigger via a render prop, and portals a floating card-art panel to
 * `document.body` — escaping any `transform` / `overflow` stacking context (e.g.
 * virtualized rows). The panel is side-anchored to the trigger's rect: it prefers
 * the right, flips left when tight, and clamps vertically into the viewport.
 */
export function CardHoverPreview({
  name,
  enriched,
  openDelay,
  "data-testid": testId,
  children,
}: CardHoverPreviewProps) {
  const { active, hoverProps, focusProps, toggle, close } = useHoverIntent(openDelay);
  // Callback-ref-via-state: the anchor element lives in state (not a ref), so it
  // is never read during render — and the setter can be handed to consumers.
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const previewRef = useRef<HTMLSpanElement | null>(null);

  // Position imperatively (write to the portal node's style) rather than via
  // state, so opening never triggers a cascading render and scroll repositions
  // stay cheap. Runs only from effects / event handlers, never during render.
  const reposition = useCallback(() => {
    const node = previewRef.current;
    if (!node || !anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Prefer the right side; flip to the left when it would overflow.
    let left = rect.right + GAP;
    if (left + PREVIEW_WIDTH + VIEWPORT_MARGIN > vw) {
      left = rect.left - GAP - PREVIEW_WIDTH;
    }
    if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;

    // Center on the row, then clamp into the viewport.
    const height = Math.min(PREVIEW_WIDTH * CARD_RATIO, vh - 2 * VIEWPORT_MARGIN);
    let top = rect.top + rect.height / 2 - height / 2;
    if (top < VIEWPORT_MARGIN) top = VIEWPORT_MARGIN;
    if (top + height + VIEWPORT_MARGIN > vh) top = vh - height - VIEWPORT_MARGIN;

    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
    node.style.visibility = "visible";
  }, [anchorEl]);

  useLayoutEffect(() => {
    if (!active) return;
    reposition();
    const onScrollOrResize = () => reposition();
    // Capture phase so nested scroll containers (virtualized lists) are caught.
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [active, reposition]);

  const anchorProps = {
    onMouseEnter: hoverProps.onMouseEnter,
    onMouseLeave: hoverProps.onMouseLeave,
  };

  const showPreview = active && enriched && typeof document !== "undefined";

  return (
    <>
      {children({ active, anchorRef: setAnchorEl, anchorProps, focusProps, toggle, close })}
      {showPreview
        ? createPortal(
            <span
              ref={previewRef}
              role="tooltip"
              data-testid={testId}
              className={styles.preview}
              // Hidden until the layout effect measures + places it (no flash).
              style={{ visibility: "hidden" }}
            >
              {enriched.imageUris ? (
                <img
                  src={enriched.imageUris.normal}
                  alt={`${name} card`}
                  className={styles.image}
                />
              ) : (
                <span className={styles.fallback}>
                  <span className={styles.fallbackName}>{name}</span>
                  <span className={styles.fallbackType}>{enriched.typeLine}</span>
                  {enriched.oracleText ? (
                    <span className={styles.fallbackOracle}>{enriched.oracleText}</span>
                  ) : null}
                </span>
              )}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
