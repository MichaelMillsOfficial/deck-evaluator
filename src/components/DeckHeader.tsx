"use client";

import { useState, useRef, useEffect } from "react";
import type { DeckData, EnrichedCard } from "@/lib/types";
import type { DeckAnalysisResults } from "@/lib/deck-analysis-aggregate";
import {
  formatMarkdownReport,
  formatJsonReport,
} from "@/lib/export-report";
import { SYNERGY_AXES } from "@/lib/synergy-axes";

export type ViewTab = "list" | "analysis" | "synergy" | "hands";

const tabs: { key: ViewTab; label: string }[] = [
  { key: "list", label: "Deck List" },
  { key: "analysis", label: "Analysis" },
  { key: "synergy", label: "Synergy" },
  { key: "hands", label: "Hands" },
];

interface DeckHeaderProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard> | null;
  enrichLoading: boolean;
  enrichError: string | null;
  notFoundCount: number;
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  analysisResults: DeckAnalysisResults | null;
  onOpenDiscordModal?: () => void;
  onCopyShareLink?: () => void;
}

export default function DeckHeader({
  deck,
  cardMap,
  enrichLoading,
  enrichError,
  activeTab,
  onTabChange,
  analysisResults,
  onOpenDiscordModal,
  onCopyShareLink,
}: DeckHeaderProps) {
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const shareButtonRef = useRef<HTMLButtonElement>(null);

  const analysisDisabled = !cardMap || enrichLoading;

  const totalCards =
    deck.commanders.reduce((s, c) => s + c.quantity, 0) +
    deck.mainboard.reduce((s, c) => s + c.quantity, 0) +
    deck.sideboard.reduce((s, c) => s + c.quantity, 0);

  const commanderNames = deck.commanders.map((c) => c.name);

  // Close share menu on outside click
  useEffect(() => {
    if (!shareMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        shareMenuRef.current &&
        !shareMenuRef.current.contains(e.target as Node) &&
        shareButtonRef.current &&
        !shareButtonRef.current.contains(e.target as Node)
      ) {
        setShareMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [shareMenuOpen]);

  // Close on Escape
  useEffect(() => {
    if (!shareMenuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShareMenuOpen(false);
        shareButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [shareMenuOpen]);

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const tabKeys = tabs.map((t) => t.key);
    const currentIndex = tabKeys.indexOf(activeTab);
    let newIndex = currentIndex;

    if (e.key === "ArrowRight") {
      newIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === "ArrowLeft") {
      newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === "Home") {
      newIndex = 0;
    } else if (e.key === "End") {
      newIndex = tabs.length - 1;
    } else {
      return;
    }

    e.preventDefault();

    let nextIndex = newIndex;
    for (let attempts = 0; attempts < tabs.length; attempts++) {
      const target = tabs[nextIndex];
      const isDisabled =
        (target.key === "analysis" ||
          target.key === "synergy" ||
          target.key === "hands") &&
        analysisDisabled;
      if (!isDisabled) break;
      if (e.key === "ArrowRight" || e.key === "Home") {
        nextIndex = (nextIndex + 1) % tabs.length;
      } else {
        nextIndex = (nextIndex - 1 + tabs.length) % tabs.length;
      }
    }

    onTabChange(tabKeys[nextIndex]);
    const nextButton = document.getElementById(
      `tab-deck-${tabKeys[nextIndex]}`
    );
    nextButton?.focus();
  };

  const showFeedback = (msg: string) => {
    setCopyFeedback(msg);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handleCopyMarkdown = async () => {
    if (!analysisResults) return;
    try {
      const md = formatMarkdownReport(analysisResults, deck);
      await navigator.clipboard.writeText(md);
      showFeedback("Markdown copied!");
    } catch { /* ignore */ }
    setShareMenuOpen(false);
  };

  const handleCopyJson = async () => {
    if (!analysisResults) return;
    try {
      const json = formatJsonReport(analysisResults, deck);
      await navigator.clipboard.writeText(json);
      showFeedback("JSON copied!");
    } catch { /* ignore */ }
    setShareMenuOpen(false);
  };

  const handleDiscord = () => {
    setShareMenuOpen(false);
    onOpenDiscordModal?.();
  };

  const handleShareLink = () => {
    setShareMenuOpen(false);
    onCopyShareLink?.();
  };

  return (
    <div
      data-testid="deck-header"
      className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-t-xl px-6 pt-4 pb-4"
    >
      {/* Deck identity row */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-white truncate">
            {deck.name}
          </h2>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-xs text-slate-400">
            {commanderNames.length > 0 && (
              <span className="text-slate-300">
                {commanderNames.join(" & ")}
              </span>
            )}
            <span>
              via{" "}
              {deck.url ? (
                <a
                  href={deck.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="capitalize text-purple-400 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400 rounded-sm"
                >
                  {deck.source}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <span className="capitalize text-purple-400">
                  {deck.source}
                </span>
              )}
            </span>
            <span>{totalCards} cards</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Bracket/Power badge */}
          {analysisResults && (
            <span
              data-testid="bracket-power-badge"
              className="rounded border px-1.5 py-0.5 text-xs font-semibold bg-slate-700/50 border-slate-600 text-slate-300"
            >
              B{analysisResults.bracketResult.bracket} | PL
              {analysisResults.powerLevel.powerLevel}
            </span>
          )}

          {/* Enrichment status indicator */}
          {enrichLoading && (
            <span
              className="flex items-center gap-1 text-xs text-purple-300"
              title="Loading card details..."
            >
              <svg
                className="h-3.5 w-3.5 animate-spin motion-reduce:hidden"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </span>
          )}
          {!enrichLoading && cardMap && !enrichError && (
            <span className="text-xs text-green-400" title="Card details loaded">
              <svg
                className="h-3.5 w-3.5"
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
            </span>
          )}
          {!enrichLoading && enrichError && (
            <span
              className="text-xs text-amber-400"
              title="Card enrichment error"
            >
              <svg
                className="h-3.5 w-3.5"
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
            </span>
          )}

          {/* Copy feedback */}
          {copyFeedback && (
            <span className="text-xs text-green-400">{copyFeedback}</span>
          )}

          {/* Share button + dropdown */}
          <div className="relative">
            <button
              ref={shareButtonRef}
              type="button"
              data-testid="share-button"
              disabled={!analysisResults || enrichLoading}
              onClick={() => setShareMenuOpen((prev) => !prev)}
              aria-expanded={shareMenuOpen}
              aria-haspopup="true"
              className="flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:opacity-40 disabled:cursor-not-allowed"
              title={
                !analysisResults || enrichLoading
                  ? "Waiting for card enrichment..."
                  : "Share deck analysis"
              }
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.474l6.733-3.367A2.52 2.52 0 0113 4.5z" />
              </svg>
              Share
            </button>

            {shareMenuOpen && (
              <div
                ref={shareMenuRef}
                data-testid="share-menu"
                aria-label="Share options"
                className="absolute right-0 top-full mt-1 w-52 rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-lg z-40"
              >
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  disabled={!analysisResults}
                  className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Copy as Markdown
                </button>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  disabled={!analysisResults}
                  className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Copy as JSON
                </button>
                <button
                  type="button"
                  onClick={handleDiscord}
                  disabled={!analysisResults}
                  className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Export to Discord...
                </button>
                <div className="border-t border-slate-700 my-1" />
                <button
                  type="button"
                  onClick={handleShareLink}
                  disabled={!analysisResults || enrichLoading}
                  className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Copy Share Link
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Theme pills + hand stats */}
      {analysisResults && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3">
          {/* Theme pills */}
          {analysisResults.synergyAnalysis.deckThemes.length > 0 && (
            <div data-testid="header-themes" className="flex flex-wrap items-center gap-1.5">
              {analysisResults.synergyAnalysis.deckThemes.slice(0, 3).map((theme) => {
                const axisDef = SYNERGY_AXES.find((a) => a.id === theme.axisId);
                const bg = axisDef?.color.bg ?? "bg-slate-500/20";
                const text = axisDef?.color.text ?? "text-slate-300";
                const label = theme.detail
                  ? `${theme.axisName} — ${theme.detail} (${theme.cardCount})`
                  : `${theme.axisName} (${theme.cardCount})`;
                return (
                  <span
                    key={theme.axisId}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${bg} ${text}`}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          )}

          {/* Hand simulation stats */}
          {analysisResults.simulationStats && (
            <div data-testid="hand-stats" className="flex items-center gap-2 text-xs text-slate-400">
              <span>{Math.round(analysisResults.simulationStats.keepableRate * 100)}% keep</span>
              <span aria-hidden="true">·</span>
              <span>{analysisResults.simulationStats.avgLandsInOpener.toFixed(1)} lands</span>
            </div>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Deck view"
        className="flex rounded-lg bg-slate-800 p-1"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const isDisabled =
            (tab.key === "analysis" ||
              tab.key === "synergy" ||
              tab.key === "hands") &&
            analysisDisabled;
          return (
            <button
              key={tab.key}
              id={`tab-deck-${tab.key}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-deck-${tab.key}`}
              tabIndex={isActive ? 0 : -1}
              type="button"
              onClick={() => !isDisabled && onTabChange(tab.key)}
              onKeyDown={handleTabKeyDown}
              disabled={isDisabled}
              className={`flex-1 min-h-[44px] rounded-md px-3 py-2.5 sm:px-4 sm:py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:cursor-not-allowed disabled:opacity-40 ${
                isActive
                  ? "bg-slate-600 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
