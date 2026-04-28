"use client";

import { useCallback, useRef } from "react";
import styles from "./CollapsiblePanel.module.css";

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
      className={styles.panel}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        className={styles.toggle}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={[styles.chevron, expanded && styles.chevronOpen]
            .filter(Boolean)
            .join(" ")}
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
        <span className={styles.title}>{title}</span>
        {summary && <span className={styles.summary}>{summary}</span>}
      </button>

      {expanded && (
        <div id={contentId} className={styles.content}>
          {children}
        </div>
      )}
    </div>
  );
}
