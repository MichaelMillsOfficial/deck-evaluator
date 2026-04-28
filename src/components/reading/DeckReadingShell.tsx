"use client";

import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import { DeckSidebar, DeckDrawer } from "@/components/DeckSidebar";
import DeckMobileTopBar from "@/components/DeckMobileTopBar";
import styles from "./DeckReadingShell.module.css";

function AlertIcon() {
  return (
    <svg
      className={styles.alertIcon}
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
  );
}

function DismissIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

/**
 * Shared chrome for every /reading/* sub-route: persistent sidebar (desktop),
 * drawer (mobile), top bar (mobile), enrichment status alerts, and the
 * Discord export modal. The page-specific content is rendered inside the
 * content panel via {children}.
 *
 * Activetab is route-aware — the sidebar derives it from usePathname().
 */
export default function DeckReadingShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const {
    payload,
    enrichLoading,
    enrichError,
    commanderWarning,
    analysisResults,
    retryEnrichment,
    dismissEnrichError,
    dismissNotFound,
    dismissCommanderWarning,
    clearSession,
  } = useDeckSession();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [parseWarningsDismissed, setParseWarningsDismissed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const deck = payload?.deck ?? null;
  const cardMap = payload?.cardMap ?? null;
  const parseWarnings = payload?.parseWarnings ?? [];
  const notFoundCount = payload?.notFoundCount ?? 0;

  const handleNewReading = useCallback(() => {
    clearSession();
    router.push("/");
  }, [clearSession, router]);

  if (!deck) return null;

  return (
    <>
      <div
        ref={containerRef}
        tabIndex={-1}
        className={styles.shell}
        aria-label="Deck reading"
      >
        <DeckMobileTopBar
          deckName={deck.name}
          enrichLoading={enrichLoading}
          cardMap={cardMap}
          enrichError={enrichError}
          onOpenDrawer={() => setDrawerOpen(true)}
        />

        <DeckDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          deck={deck}
          cardMap={cardMap}
          enrichLoading={enrichLoading}
          enrichError={enrichError}
          analysisResults={analysisResults}
          onNewReading={handleNewReading}
        />

        <div className={styles.layout}>
          <DeckSidebar
            deck={deck}
            cardMap={cardMap}
            enrichLoading={enrichLoading}
            enrichError={enrichError}
            analysisResults={analysisResults}
            onNewReading={handleNewReading}
          />

          <div className={styles.contentPanel}>
            <div className={styles.contentPanelInner}>{children}</div>
          </div>
        </div>

        {parseWarnings.length > 0 && !parseWarningsDismissed && (
          <div
            data-testid="parse-warnings"
            role="alert"
            className={`${styles.alert} ${styles.parseWarnings}`}
          >
            <div className={styles.alertContent}>
              <AlertIcon />
              <div className={styles.alertBody}>
                <p className={styles.alertTitle}>
                  Some lines could not be parsed and were skipped:
                </p>
                <ul className={styles.alertList}>
                  {parseWarnings.slice(0, 5).map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                  {parseWarnings.length > 5 && (
                    <li>...and {parseWarnings.length - 5} more</li>
                  )}
                </ul>
              </div>
            </div>
            <div className={styles.alertActions}>
              <button
                type="button"
                onClick={() => setParseWarningsDismissed(true)}
                className={styles.dismissButton}
                aria-label="Dismiss parse warnings"
              >
                <DismissIcon />
              </button>
            </div>
          </div>
        )}

        {enrichError && !enrichLoading && (
          <div role="alert" className={`${styles.alert} ${styles.alertWatch}`}>
            <div className={styles.alertContent}>
              <AlertIcon />
              <div className={styles.alertBody}>
                {enrichError}. The basic decklist is still available.
              </div>
            </div>
            <div className={styles.alertActions}>
              <button
                type="button"
                data-testid="enrich-retry-btn"
                disabled={enrichLoading}
                onClick={retryEnrichment}
                className={styles.retryButton}
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={() => {
                  dismissEnrichError();
                  containerRef.current?.focus();
                }}
                className={styles.dismissButton}
                aria-label="Dismiss warning"
              >
                <DismissIcon />
              </button>
            </div>
          </div>
        )}

        {notFoundCount > 0 && !enrichError && !enrichLoading && (
          <div role="alert" className={`${styles.alert} ${styles.alertWatch}`}>
            <div className={styles.alertContent}>
              <AlertIcon />
              <div className={styles.alertBody}>
                {notFoundCount} {notFoundCount === 1 ? "card" : "cards"} could
                not be found and {notFoundCount === 1 ? "is" : "are"} shown
                without details
              </div>
            </div>
            <div className={styles.alertActions}>
              <button
                type="button"
                onClick={dismissNotFound}
                className={styles.dismissButton}
                aria-label="Dismiss warning"
              >
                <DismissIcon />
              </button>
            </div>
          </div>
        )}

        {commanderWarning && !enrichLoading && (
          <div role="alert" className={`${styles.alert} ${styles.alertWatch}`}>
            <div className={styles.alertContent}>
              <AlertIcon />
              <div className={styles.alertBody}>{commanderWarning}</div>
            </div>
            <div className={styles.alertActions}>
              <button
                type="button"
                onClick={() => {
                  dismissCommanderWarning();
                  containerRef.current?.focus();
                }}
                className={styles.dismissButton}
                aria-label="Dismiss commander warning"
              >
                <DismissIcon />
              </button>
            </div>
          </div>
        )}

        <p className="sr-only" role="status" aria-live="polite">
          {cardMap && !enrichLoading ? "Card details loaded" : ""}
        </p>
      </div>
    </>
  );
}
