"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import { encodeCompactDeckPayload } from "@/lib/deck-codec";
import type { ViewTab } from "@/lib/view-tabs";
import DeckViewTabs from "@/components/DeckViewTabs";
import { DeckSidebar, DeckDrawer } from "@/components/DeckSidebar";
import DeckMobileTopBar from "@/components/DeckMobileTopBar";
import DiscordExportModal from "@/components/DiscordExportModal";
import styles from "./DeckReadingView.module.css";

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

export default function DeckReadingView() {
  const router = useRouter();
  const {
    payload,
    enrichLoading,
    enrichError,
    spellbookLoading,
    commanderWarning,
    analysisResults,
    retryEnrichment,
    dismissEnrichError,
    dismissNotFound,
    dismissCommanderWarning,
    clearSession,
  } = useDeckSession();

  const [activeTab, setActiveTab] = useState<ViewTab>("list");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [discordModalOpen, setDiscordModalOpen] = useState(false);
  const [parseWarningsDismissed, setParseWarningsDismissed] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const deck = payload?.deck ?? null;
  const cardMap = payload?.cardMap ?? null;
  const spellbookCombos = payload?.spellbookCombos ?? null;
  const parseWarnings = payload?.parseWarnings ?? [];
  const notFoundCount = payload?.notFoundCount ?? 0;

  // Focus the results container on mount so screen readers land here.
  useEffect(() => {
    if (deck) {
      containerRef.current?.focus();
    }
  }, [deck]);

  // Generate the share URL once cardMap is available.
  useEffect(() => {
    if (!deck || !cardMap) {
      setShareUrl(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const encoded = await encodeCompactDeckPayload(deck, cardMap);
        if (!cancelled) {
          setShareUrl(`${window.location.origin}/shared?d=${encoded}`);
        }
      } catch {
        // Encoding error — leave shareUrl null.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deck, cardMap]);

  const handleCopyShareLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Clipboard error — silently fail.
    }
  }, [shareUrl]);

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
        className={styles.results}
        aria-label="Deck import results"
      >
        <DeckMobileTopBar
          deckName={deck.name}
          enrichLoading={enrichLoading}
          cardMap={cardMap}
          enrichError={enrichError}
          hasAnalysis={!!analysisResults}
          onOpenDrawer={() => setDrawerOpen(true)}
          onShare={handleCopyShareLink}
        />

        <DeckDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          deck={deck}
          cardMap={cardMap}
          enrichLoading={enrichLoading}
          enrichError={enrichError}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setDrawerOpen(false);
          }}
          analysisResults={analysisResults}
          onOpenDiscordModal={() => setDiscordModalOpen(true)}
          onCopyShareLink={handleCopyShareLink}
          onNewReading={handleNewReading}
        />

        <div className={styles.resultsLayout}>
          <DeckSidebar
            deck={deck}
            cardMap={cardMap}
            enrichLoading={enrichLoading}
            enrichError={enrichError}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            analysisResults={analysisResults}
            onOpenDiscordModal={() => setDiscordModalOpen(true)}
            onCopyShareLink={handleCopyShareLink}
            onNewReading={handleNewReading}
          />

          <div className={styles.contentPanel}>
            <div className={styles.contentPanelInner}>
              <DeckViewTabs
                deck={deck}
                cardMap={cardMap}
                enrichLoading={enrichLoading}
                spellbookCombos={spellbookCombos}
                spellbookLoading={spellbookLoading}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                analysisResults={analysisResults}
              />
            </div>
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

      {analysisResults && (
        <DiscordExportModal
          open={discordModalOpen}
          onClose={() => setDiscordModalOpen(false)}
          analysisResults={analysisResults}
          deck={deck}
          shareUrl={shareUrl ?? undefined}
        />
      )}
    </>
  );
}
