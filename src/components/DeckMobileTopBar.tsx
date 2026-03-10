"use client";

import type { EnrichedCard } from "@/lib/types";

function IconBars3() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h12.5M3.75 10h12.5m-12.5 3.25h12.5" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
      <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.474l6.733-3.367A2.52 2.52 0 0113 4.5z" />
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
      <span className="flex items-center" title="Loading card details...">
        <svg className="h-4 w-4 animate-spin text-purple-300 motion-reduce:hidden" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="sr-only">Loading card details</span>
      </span>
    );
  }
  if (!enrichLoading && cardMap && !enrichError) {
    return (
      <span className="text-green-400" title="Card details loaded">
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
        </svg>
        <span className="sr-only">Card details loaded</span>
      </span>
    );
  }
  if (!enrichLoading && enrichError) {
    return (
      <span className="text-amber-400" title="Card enrichment error">
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
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
  hasAnalysis: boolean;
  onOpenDrawer: () => void;
  onShare?: () => void;
}

export default function DeckMobileTopBar({
  deckName,
  enrichLoading,
  cardMap,
  enrichError,
  hasAnalysis,
  onOpenDrawer,
  onShare,
}: DeckMobileTopBarProps) {
  return (
    <div className="md:hidden sticky top-0 z-40 flex items-center h-14 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700 px-3 gap-2">
      {/* Hamburger */}
      <button
        type="button"
        onClick={onOpenDrawer}
        className="shrink-0 rounded-md p-2 text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
        aria-label="Open navigation"
      >
        <IconBars3 />
      </button>

      {/* Deck name */}
      <span className="flex-1 min-w-0 text-sm font-semibold text-white truncate">
        {deckName}
      </span>

      {/* Enrichment status */}
      <EnrichmentStatusCompact
        enrichLoading={enrichLoading}
        cardMap={cardMap}
        enrichError={enrichError}
      />

      {/* Share button */}
      {onShare && (
        <button
          type="button"
          disabled={!hasAnalysis || enrichLoading}
          onClick={onShare}
          title={!hasAnalysis || enrichLoading ? "Waiting for card enrichment..." : "Share deck analysis"}
          className="shrink-0 flex items-center gap-1.5 rounded-md bg-purple-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <IconShare />
          <span className="hidden sm:inline">Share</span>
        </button>
      )}
    </div>
  );
}
