"use client";

import { useCallback, useRef } from "react";

interface CollapsiblePanelProps {
  id: string;
  title: string;
  summary?: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  testId?: string;
}

export default function CollapsiblePanel({
  id,
  title,
  summary,
  expanded,
  onToggle,
  children,
  testId,
}: CollapsiblePanelProps) {
  const contentId = `panel-content-${id}`;
  const panelRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && expanded) {
        e.preventDefault();
        onToggle();
      }
    },
    [expanded, onToggle]
  );

  return (
    <div
      ref={panelRef}
      id={`panel-${id}`}
      data-testid={testId ?? `panel-${id}`}
      className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden"
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-700/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-inset"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 motion-reduce:transition-none ${
            expanded ? "rotate-90" : ""
          }`}
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          {title}
        </span>
        {summary && (
          <span className="ml-auto text-xs text-slate-400">{summary}</span>
        )}
      </button>

      {expanded && (
        <div id={contentId} className="px-4 pt-2 pb-5">
          {children}
        </div>
      )}
    </div>
  );
}
