"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { RemovalImpact } from "@/lib/interaction-engine/types";
import RemovalImpactInspector from "@/components/RemovalImpactInspector";

// ═══════════════════════════════════════════════════════════════
// PROPS
// ═══════════════════════════════════════════════════════════════

interface RemovalImpactFloatingPanelProps {
  impact: RemovalImpact | null;
  onClose: () => void;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function RemovalImpactFloatingPanel({
  impact,
  onClose,
}: RemovalImpactFloatingPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isOpen = impact !== null;

  // Dismiss on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [isOpen, onClose]);

  // Focus the close button when the panel opens
  useEffect(() => {
    if (isOpen) {
      // Defer focus to allow the panel animation to start
      const frame = requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [isOpen]);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  // Render into document.body so the panel's `position: fixed` is anchored
  // to the viewport — escaping any ancestor that creates a containing block
  // via transform, filter, backdrop-filter, will-change, or contain: paint.
  // Without this portal, the panel was being captured by ancestor
  // backdrop-filter rules and scrolling away with its parent.
  return createPortal(
    // No backdrop — panel floats without blocking page interaction.
    // Positioned fixed to the right side of the viewport so it stays
    // visible while the user scrolls or clicks cards in the centrality list.
    <div
      role="dialog"
      aria-modal="false"
      aria-label={`Removal impact: ${impact?.removedCard ?? ""}`}
      data-testid="removal-impact-floating-panel"
      className={[
        // Fixed to right edge, anchored near the top with clearance for the nav bar
        "fixed right-4 top-20 z-50",
        // Width: responsive — shrinks on small viewports
        "w-[min(22rem,calc(100vw-2rem))]",
        // Height: grows with content up to most of the viewport, then scrolls
        "flex flex-col max-h-[calc(100vh-6rem)]",
        // Dark theme surface matching the design system
        "rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60",
        // Slide-in animation (defined in globals.css)
        "removal-panel-enter",
      ].join(" ")}
    >
      {/* Panel header — always visible, never scrolls away */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-3 pb-2 border-b border-slate-700/60">
        <div className="flex items-center gap-2 min-w-0">
          {/* Icon */}
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5 shrink-0 text-purple-400"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            Removal Impact
          </span>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          aria-label="Close removal impact panel"
          onClick={onClose}
          className="shrink-0 rounded p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-700/60 transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      {/* Scrollable content — expands as nested items open, scrolls when it hits the viewport limit */}
      <div className="overflow-y-auto min-h-0 flex-1 p-4">
        <RemovalImpactInspector impact={impact} />
      </div>

      {/* Dismiss hint — always visible at the bottom */}
      <div className="shrink-0 px-4 py-2 border-t border-slate-700/60">
        <p className="text-[10px] text-slate-600 text-center">
          Press <kbd className="font-mono">Esc</kbd> to dismiss
        </p>
      </div>
    </div>,
    document.body,
  );
}
