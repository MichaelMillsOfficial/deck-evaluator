"use client";

import type { EnrichedCard } from "@/lib/types";
import styles from "./DeckMobileTopBar.module.css";

function IconBars3() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      width="20"
      height="20"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6.75h12.5M3.75 10h12.5m-12.5 3.25h12.5"
      />
    </svg>
  );
}

function EnrichmentStatusCompact({
  enrichLoading,
  cardMap,
  enrichError,
}: {
  enrichLoading: boolean;
  cardMap: Record<string, EnrichedCard> | null;
  enrichError: string | null;
}) {
  if (enrichLoading) {
    return (
      <span
        className={`${styles.status} ${styles.statusLoading}`}
        title="Loading card details..."
      >
        <svg
          className={styles.statusSpinner}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            opacity="0.25"
          />
          <path
            fill="currentColor"
            opacity="0.85"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="sr-only">Loading card details</span>
      </span>
    );
  }
  if (!enrichLoading && cardMap && !enrichError) {
    return (
      <span
        className={`${styles.status} ${styles.statusOk}`}
        title="Card details loaded"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
        <span className="sr-only">Card details loaded</span>
      </span>
    );
  }
  if (!enrichLoading && enrichError) {
    return (
      <span
        className={`${styles.status} ${styles.statusError}`}
        title="Card enrichment error"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
        <span className="sr-only">Card enrichment error</span>
      </span>
    );
  }
  return null;
}

interface DeckMobileTopBarProps {
  deckName: string;
  enrichLoading: boolean;
  cardMap: Record<string, EnrichedCard> | null;
  enrichError: string | null;
  onOpenDrawer: () => void;
}

export default function DeckMobileTopBar({
  deckName,
  enrichLoading,
  cardMap,
  enrichError,
  onOpenDrawer,
}: DeckMobileTopBarProps) {
  return (
    <div className={styles.bar}>
      <button
        type="button"
        onClick={onOpenDrawer}
        className={styles.menuButton}
        aria-label="Open navigation"
      >
        <IconBars3 />
      </button>

      <span className={styles.deckName}>{deckName}</span>

      <EnrichmentStatusCompact
        enrichLoading={enrichLoading}
        cardMap={cardMap}
        enrichError={enrichError}
      />
    </div>
  );
}
