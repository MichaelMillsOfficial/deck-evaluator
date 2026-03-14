"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { DeckData, EnrichedCard } from "@/lib/types";
import type { DeckAnalysisResults } from "@/lib/deck-analysis-aggregate";
import type { ViewTab } from "@/lib/view-tabs";
import { NAV_CATEGORIES, ALL_TABS, ENRICHMENT_REQUIRED_TABS } from "@/lib/view-tabs";
import { SYNERGY_AXES } from "@/lib/synergy-axes";
import {
  formatMarkdownReport,
  formatJsonReport,
} from "@/lib/export-report";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { useFocusTrap } from "@/hooks/useFocusTrap";

// ---------------------------------------------------------------------------
// Inline SVG icons (Heroicons outline 20x20)
// ---------------------------------------------------------------------------

function IconList() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h12.5M3.75 10h12.5m-12.5 3.25h12.5" />
    </svg>
  );
}

function IconChartBar() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5V17m4-6v6m4-9.5v9.5m4-13v13" />
    </svg>
  );
}

function IconPuzzle() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function IconHand() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.05 4.575a1.575 1.575 0 10-3.15 0v3m3.15-3v-1.5a1.575 1.575 0 013.15 0v1.5m-3.15 0l.075 5.925m3.075.75V4.575m0 0a1.575 1.575 0 013.15 0V15M6.9 7.575a1.575 1.575 0 10-3.15 0v8.175a6.75 6.75 0 006.75 6.75h2.018a5.25 5.25 0 003.712-1.538l1.732-1.732a5.25 5.25 0 001.538-3.712l.003-2.024a.668.668 0 01.198-.471 1.575 1.575 0 10-2.228-2.228 3.818 3.818 0 00-1.12 2.687M6.9 7.575V12m6.27 4.318A4.49 4.49 0 0116.35 15m.002 0h-.002" />
    </svg>
  );
}

function IconPlusCircle() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconArrowsRightLeft() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 3M21 7.5H7.5" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l7.5-7.5-7.5-7.5" />
    </svg>
  );
}

function IconChevronDown({ rotated }: { rotated?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      width="16"
      height="16"
      aria-hidden="true"
      className={`transition-transform duration-200 motion-reduce:transition-none ${rotated ? "rotate-180" : ""}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
      <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.474l6.733-3.367A2.52 2.52 0 0113 4.5z" />
    </svg>
  );
}

function IconX() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tab icon map
// ---------------------------------------------------------------------------

const TAB_ICONS: Record<ViewTab, React.ReactNode> = {
  list: <IconList />,
  analysis: <IconChartBar />,
  synergy: <IconPuzzle />,
  interactions: <IconBolt />,
  hands: <IconHand />,
  additions: <IconPlusCircle />,
  suggestions: <IconArrowsRightLeft />,
};

// ---------------------------------------------------------------------------
// Enrichment status indicator
// ---------------------------------------------------------------------------

function EnrichmentStatus({
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
      <span className="flex items-center gap-1 text-xs text-purple-300" title="Loading card details...">
        <svg className="h-3.5 w-3.5 animate-spin motion-reduce:hidden" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="sr-only">Loading card details</span>
      </span>
    );
  }
  if (!enrichLoading && cardMap && !enrichError) {
    return (
      <span className="text-xs text-green-400" title="Card details loaded">
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
        </svg>
        <span className="sr-only">Card details loaded</span>
      </span>
    );
  }
  if (!enrichLoading && enrichError) {
    return (
      <span className="text-xs text-amber-400" title="Card enrichment error">
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        <span className="sr-only">Card enrichment error</span>
      </span>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Nav button
// ---------------------------------------------------------------------------

function NavButton({
  tabKey,
  label,
  badge,
  isActive,
  isDisabled,
  collapsed,
  onClick,
  onKeyDown,
}: {
  tabKey: ViewTab;
  label: string;
  badge?: string;
  isActive: boolean;
  isDisabled: boolean;
  collapsed: boolean;
  onClick: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const icon = TAB_ICONS[tabKey];

  return (
    <button
      id={`tab-deck-${tabKey}`}
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-deck-${tabKey}`}
      tabIndex={isActive ? 0 : -1}
      type="button"
      onClick={() => !isDisabled && onClick()}
      onKeyDown={onKeyDown}
      disabled={isDisabled}
      title={collapsed ? label : undefined}
      className={`group flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:opacity-40 disabled:cursor-not-allowed ${
        isActive
          ? "bg-purple-600/20 text-purple-300 border-l-2 border-purple-500 pl-[calc(0.5rem-2px)]"
          : "text-slate-300 hover:text-white hover:bg-slate-800 border-l-2 border-transparent pl-[calc(0.5rem-2px)]"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && (
        <span className="min-w-0 truncate flex items-center gap-1.5">
          {label}
          {badge && (
            <span className="bg-purple-600/80 px-1.5 py-0.5 text-[10px] font-bold text-purple-100 rounded-full leading-none">
              {badge}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Share menu
// ---------------------------------------------------------------------------

function ShareMenu({
  analysisResults,
  enrichLoading,
  onCopyMarkdown,
  onCopyJson,
  onDiscord,
  onShareLink,
  copyFeedback,
  collapsed,
}: {
  analysisResults: DeckAnalysisResults | null;
  enrichLoading: boolean;
  onCopyMarkdown: () => void;
  onCopyJson: () => void;
  onDiscord: () => void;
  onShareLink: () => void;
  copyFeedback: string | null;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape (stopPropagation prevents drawer from also closing)
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const disabled = !analysisResults || enrichLoading;

  return (
    <div className="relative">
      {copyFeedback && (
        <span className="block mb-1 text-xs text-green-400 text-center">{copyFeedback}</span>
      )}
      <button
        ref={buttonRef}
        type="button"
        data-testid="share-button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        title={disabled ? "Waiting for card enrichment..." : "Share deck analysis"}
        className={`flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:opacity-40 disabled:cursor-not-allowed ${collapsed ? "w-9 px-2 justify-center" : "w-full justify-center"}`}
      >
        <IconShare />
        {!collapsed && "Share"}
      </button>

      {open && (
        <div
          ref={menuRef}
          data-testid="share-menu"
          aria-label="Share options"
          className="absolute bottom-full left-0 mb-1 w-52 rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-lg z-40"
        >
          <button
            type="button"
            onClick={() => { onCopyMarkdown(); setOpen(false); }}
            disabled={!analysisResults}
            className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Copy as Markdown
          </button>
          <button
            type="button"
            onClick={() => { onCopyJson(); setOpen(false); }}
            disabled={!analysisResults}
            className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Copy as JSON
          </button>
          <button
            type="button"
            onClick={() => { onDiscord(); setOpen(false); }}
            disabled={!analysisResults}
            className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export to Discord...
          </button>
          <div className="border-t border-slate-700 my-1" />
          <button
            type="button"
            onClick={() => { onShareLink(); setOpen(false); }}
            disabled={disabled}
            className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Copy Share Link
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar inner content (shared between desktop and drawer)
// ---------------------------------------------------------------------------

interface SidebarContentProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard> | null;
  enrichLoading: boolean;
  enrichError: string | null;
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  analysisResults: DeckAnalysisResults | null;
  onOpenDiscordModal?: () => void;
  onCopyShareLink?: () => void;
  collapsed: boolean;
  onClose?: () => void;
}

function SidebarContent({
  deck,
  cardMap,
  enrichLoading,
  enrichError,
  activeTab,
  onTabChange,
  analysisResults,
  onOpenDiscordModal,
  onCopyShareLink,
  collapsed,
  onClose,
}: SidebarContentProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["deck", "insights", "tools", "actions"])
  );
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const analysisDisabled = !cardMap || enrichLoading;

  // Flat ordered list of all tabs for keyboard navigation
  const allTabKeys = ALL_TABS.map((t) => t.key);

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      const currentIndex = allTabKeys.indexOf(activeTab);
      let newIndex = currentIndex;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        newIndex = (currentIndex + 1) % allTabKeys.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        newIndex = (currentIndex - 1 + allTabKeys.length) % allTabKeys.length;
      } else if (e.key === "Home") {
        newIndex = 0;
      } else if (e.key === "End") {
        newIndex = allTabKeys.length - 1;
      } else {
        return;
      }

      e.preventDefault();

      // Skip disabled tabs
      let nextIndex = newIndex;
      for (let attempts = 0; attempts < allTabKeys.length; attempts++) {
        const target = allTabKeys[nextIndex];
        const isDisabled = ENRICHMENT_REQUIRED_TABS.has(target) && analysisDisabled;
        if (!isDisabled) break;
        if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "Home") {
          nextIndex = (nextIndex + 1) % allTabKeys.length;
        } else {
          nextIndex = (nextIndex - 1 + allTabKeys.length) % allTabKeys.length;
        }
      }

      onTabChange(allTabKeys[nextIndex]);
      const nextButton = document.getElementById(`tab-deck-${allTabKeys[nextIndex]}`);
      nextButton?.focus();
    },
    [activeTab, allTabKeys, analysisDisabled, onTabChange]
  );

  const totalCards =
    deck.commanders.reduce((s, c) => s + c.quantity, 0) +
    deck.mainboard.reduce((s, c) => s + c.quantity, 0) +
    deck.sideboard.reduce((s, c) => s + c.quantity, 0);

  const commanderNames = deck.commanders.map((c) => c.name);

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
  };

  const handleCopyJson = async () => {
    if (!analysisResults) return;
    try {
      const json = formatJsonReport(analysisResults, deck);
      await navigator.clipboard.writeText(json);
      showFeedback("JSON copied!");
    } catch { /* ignore */ }
  };

  const handleNavClick = (tab: ViewTab) => {
    onTabChange(tab);
    onClose?.();
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden">
      {/* Deck identity */}
      {!collapsed && (
        <div className="px-3 pt-4 pb-3 border-b border-slate-700/60">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white truncate" title={deck.name}>
                {deck.name}
              </h2>
              {commanderNames.length > 0 && (
                <p className="mt-0.5 text-xs text-slate-300 truncate" title={commanderNames.join(" & ")}>
                  {commanderNames.join(" & ")}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-slate-400">
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
                    <span className="capitalize text-purple-400">{deck.source}</span>
                  )}
                </span>
                <span>{totalCards} cards</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <EnrichmentStatus
                enrichLoading={enrichLoading}
                cardMap={cardMap}
                enrichError={enrichError}
              />
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md p-1 text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 md:hidden"
                  aria-label="Close navigation"
                >
                  <IconX />
                </button>
              )}
            </div>
          </div>

          {/* Bracket/power badge */}
          {analysisResults && (
            <span
              data-testid="bracket-power-badge"
              className="mt-2 inline-block rounded border px-1.5 py-0.5 text-xs font-semibold bg-slate-700/50 border-slate-600 text-slate-300"
            >
              B{analysisResults.bracketResult.bracket} | PL
              {analysisResults.powerLevel.powerLevel}
            </span>
          )}
        </div>
      )}

      {/* Collapsed: show enrichment icon only */}
      {collapsed && (
        <div className="px-2 pt-3 pb-2 border-b border-slate-700/60 flex justify-center">
          <EnrichmentStatus
            enrichLoading={enrichLoading}
            cardMap={cardMap}
            enrichError={enrichError}
          />
        </div>
      )}

      {/* Theme pills */}
      {!collapsed && analysisResults && analysisResults.synergyAnalysis.deckThemes.length > 0 && (
        <div className="px-3 py-2 border-b border-slate-700/60">
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
        </div>
      )}

      {/* Hand stats */}
      {!collapsed && analysisResults?.simulationStats && (
        <div className="px-3 py-2 border-b border-slate-700/60">
          <div data-testid="hand-stats" className="flex items-center gap-2 text-xs text-slate-400">
            <span>{Math.round(analysisResults.simulationStats.keepableRate * 100)}% keep</span>
            <span aria-hidden="true">·</span>
            <span>{analysisResults.simulationStats.avgLandsInOpener.toFixed(1)} lands</span>
          </div>
        </div>
      )}

      {/* Nav groups */}
      <nav role="tablist" aria-label="Deck view" className="flex-1 px-2 py-2">
        {NAV_CATEGORIES.map((category) => {
          const isExpanded = expandedCategories.has(category.id);
          return (
            <div key={category.id} className="mb-1">
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className="flex w-full items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded"
                  aria-expanded={isExpanded}
                >
                  {category.label}
                  <IconChevronDown rotated={!isExpanded} />
                </button>
              )}

              {(collapsed || isExpanded) && (
                <div className={collapsed ? "flex flex-col items-center gap-1 py-1" : "space-y-0.5"}>
                  {category.items.map((tabKey) => {
                    const tabDef = ALL_TABS.find((t) => t.key === tabKey)!;
                    const isDisabled = ENRICHMENT_REQUIRED_TABS.has(tabKey) && analysisDisabled;
                    return (
                      <NavButton
                        key={tabKey}
                        tabKey={tabKey}
                        label={tabDef.label}
                        badge={tabDef.badge}
                        isActive={activeTab === tabKey}
                        isDisabled={isDisabled}
                        collapsed={collapsed}
                        onClick={() => handleNavClick(tabKey)}
                        onKeyDown={handleTabKeyDown}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Share button */}
      <div className="px-2 py-3 border-t border-slate-700/60">
        <ShareMenu
          analysisResults={analysisResults}
          enrichLoading={enrichLoading}
          onCopyMarkdown={handleCopyMarkdown}
          onCopyJson={handleCopyJson}
          onDiscord={() => onOpenDiscordModal?.()}
          onShareLink={() => onCopyShareLink?.()}
          copyFeedback={copyFeedback}
          collapsed={collapsed}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop sidebar
// ---------------------------------------------------------------------------

export interface DeckSidebarProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard> | null;
  enrichLoading: boolean;
  enrichError: string | null;
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  analysisResults: DeckAnalysisResults | null;
  onOpenDiscordModal?: () => void;
  onCopyShareLink?: () => void;
}

export function DeckSidebar({
  deck,
  cardMap,
  enrichLoading,
  enrichError,
  activeTab,
  onTabChange,
  analysisResults,
  onOpenDiscordModal,
  onCopyShareLink,
}: DeckSidebarProps) {
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  return (
    <div
      data-testid="deck-header"
      style={{ width: collapsed ? 52 : 240 }}
      className="hidden md:flex flex-col sticky top-0 h-screen shrink-0 bg-slate-900 border-r border-slate-700/60 transition-[width] duration-200 motion-reduce:transition-none overflow-hidden"
    >
      <SidebarContent
        deck={deck}
        cardMap={cardMap}
        enrichLoading={enrichLoading}
        enrichError={enrichError}
        activeTab={activeTab}
        onTabChange={onTabChange}
        analysisResults={analysisResults}
        onOpenDiscordModal={onOpenDiscordModal}
        onCopyShareLink={onCopyShareLink}
        collapsed={collapsed}
      />

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-400 shrink-0"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile drawer
// ---------------------------------------------------------------------------

export interface DeckDrawerProps extends DeckSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function DeckDrawer({
  open,
  onClose,
  deck,
  cardMap,
  enrichLoading,
  enrichError,
  activeTab,
  onTabChange,
  analysisResults,
  onOpenDiscordModal,
  onCopyShareLink,
}: DeckDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(drawerRef, open);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div
      className={`md:hidden fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
      aria-modal="true"
      role="dialog"
      aria-label="Navigation"
    >
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className={`absolute top-0 left-0 h-full bg-slate-900 border-r border-slate-700/60 transition-transform duration-200 motion-reduce:transition-none ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{ width: "min(280px, 85vw)" }}
      >
        {open && (
          <SidebarContent
            deck={deck}
            cardMap={cardMap}
            enrichLoading={enrichLoading}
            enrichError={enrichError}
            activeTab={activeTab}
            onTabChange={onTabChange}
            analysisResults={analysisResults}
            onOpenDiscordModal={onOpenDiscordModal}
            onCopyShareLink={onCopyShareLink}
            collapsed={false}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
