"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CategoryFillList from "@/components/CategoryFillList";
import WeakCardList from "@/components/WeakCardList";
import UpgradeList from "@/components/UpgradeList";
import CollapsiblePanel from "@/components/CollapsiblePanel";
import {
  identifyWeakCards,
  selectUpgradeCandidates,
  deriveGapsFromScorecard,
} from "@/lib/card-suggestions";
import type {
  WeakCard,
  CategoryFillRecommendation,
  UpgradeSuggestion,
  SuggestionsApiRequest,
  SuggestionsApiResponse,
} from "@/lib/card-suggestions";
import type { DeckData, EnrichedCard, DeckSynergyAnalysis } from "@/lib/types";
import type { CompositionScorecardResult } from "@/lib/deck-composition";
import { resolveCommanderIdentity } from "@/lib/color-distribution";

interface SuggestionsPanelProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard>;
  synergyAnalysis: DeckSynergyAnalysis;
  scorecard: CompositionScorecardResult;
}

type FetchStatus = "idle" | "loading" | "success" | "error";

function buildCacheKey(
  deck: DeckData,
  scorecard: CompositionScorecardResult
): string {
  return `${deck.name}::${scorecard.templateId}::${deck.commanders.map((c) => c.name).join(",")}`;
}

export default function SuggestionsPanel({
  deck,
  cardMap,
  synergyAnalysis,
  scorecard,
}: SuggestionsPanelProps) {
  // -------------------------------------------------------------------------
  // Client-side weak card identification (fast, no API call)
  // -------------------------------------------------------------------------
  const weakCards = useMemo<WeakCard[]>(() => {
    return identifyWeakCards(
      deck,
      cardMap,
      synergyAnalysis.cardScores,
      scorecard
    );
  }, [deck, cardMap, synergyAnalysis, scorecard]);

  // -------------------------------------------------------------------------
  // Gap and upgrade derivation
  // -------------------------------------------------------------------------
  const gaps = useMemo(() => deriveGapsFromScorecard(scorecard), [scorecard]);

  const upgradeCandidates = useMemo(
    () => selectUpgradeCandidates(deck, cardMap, synergyAnalysis.cardScores),
    [deck, cardMap, synergyAnalysis]
  );

  const colorIdentity = useMemo(() => {
    const identity = resolveCommanderIdentity(deck, cardMap);
    return Array.from(identity);
  }, [deck, cardMap]);

  const deckCardNames = useMemo(() => {
    const names: string[] = [];
    for (const section of [deck.commanders, deck.mainboard, deck.sideboard]) {
      for (const card of section) {
        names.push(card.name);
      }
    }
    return names;
  }, [deck]);

  // -------------------------------------------------------------------------
  // API fetching state (category fills + upgrades)
  // -------------------------------------------------------------------------
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [categoryFills, setCategoryFills] = useState<
    CategoryFillRecommendation[]
  >([]);
  const [upgrades, setUpgrades] = useState<UpgradeSuggestion[]>([]);

  // Cache to avoid redundant API calls
  const cacheRef = useRef<
    Map<string, { categoryFills: CategoryFillRecommendation[]; upgrades: UpgradeSuggestion[] }>
  >(new Map());

  const cacheKey = buildCacheKey(deck, scorecard);

  // -------------------------------------------------------------------------
  // Expanded section state
  // -------------------------------------------------------------------------
  const [expandedSections, setExpandedSections] = useState({
    fills: true,
    weak: true,
    upgrades: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // -------------------------------------------------------------------------
  // Fetch suggestions from API
  // -------------------------------------------------------------------------
  const fetchSuggestions = useCallback(
    async (bustCache = false) => {
        // Skip if nothing to fetch
        if (gaps.length === 0 && upgradeCandidates.length === 0) {
          setCategoryFills([]);
          setUpgrades([]);
          setFetchStatus("success");
          return;
        }

        // Check cache first
        if (!bustCache && cacheRef.current.has(cacheKey)) {
          const cached = cacheRef.current.get(cacheKey)!;
          setCategoryFills(cached.categoryFills);
          setUpgrades(cached.upgrades);
          setFetchStatus("success");
          return;
        }

        setFetchStatus("loading");
        setFetchError(null);

        const payload: SuggestionsApiRequest = {
          gaps,
          colorIdentity,
          deckCardNames,
          upgradeCandidates,
        };

        try {
          const res = await fetch("/api/card-suggestions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            throw new Error(err.error ?? `API error: ${res.status}`);
          }

          const data = (await res.json()) as SuggestionsApiResponse;
          const fills = data.categoryFills ?? [];
          const upgs = data.upgrades ?? [];

          cacheRef.current.set(cacheKey, {
            categoryFills: fills,
            upgrades: upgs,
          });

          setCategoryFills(fills);
          setUpgrades(upgs);
          setFetchStatus("success");
        } catch (err) {
          const msg =
            err instanceof Error
              ? err.message
              : "Failed to load suggestions";
          setFetchError(msg);
          setFetchStatus("error");
        }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cacheKey, gaps, colorIdentity, deckCardNames, upgradeCandidates]
  );

  // Auto-fetch on mount or when dependencies change
  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // -------------------------------------------------------------------------
  // Verdict banner
  // -------------------------------------------------------------------------
  const totalWeakCount = weakCards.length;
  const totalGapCount = gaps.length;
  const hasIssues = totalWeakCount > 0 || totalGapCount > 0;

  const verdictText = hasIssues
    ? `We found ${[
        totalGapCount > 0
          ? `${totalGapCount} area${totalGapCount !== 1 ? "s" : ""} where your deck could improve`
          : null,
        totalWeakCount > 0
          ? `${totalWeakCount} card${totalWeakCount !== 1 ? "s" : ""} that might be worth swapping out`
          : null,
      ]
        .filter(Boolean)
        .join(" and ")}.`
    : "Your deck looks solid!";

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <section
      data-testid="suggestions-panel"
      aria-labelledby="suggestions-heading"
    >
      <h3
        id="suggestions-heading"
        className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300"
      >
        Swap Suggestions
      </h3>
      <p className="mb-4 text-xs text-slate-400">
        Cards to consider cutting and what to add instead
      </p>

      {/* Verdict banner */}
      <div
        data-testid="suggestions-verdict"
        className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
          hasIssues
            ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
            : "border-green-500/30 bg-green-500/10 text-green-300"
        }`}
      >
        {hasIssues ? (
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="mt-0.5 h-4 w-4 shrink-0 text-green-400"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
              clipRule="evenodd"
            />
          </svg>
        )}
        <span>{verdictText}</span>
      </div>

      <div className="flex flex-col gap-4">
        {/* ----------------------------------------------------------------- */}
        {/* Section 1: Cards Your Deck Needs (Category Fills)                 */}
        {/* ----------------------------------------------------------------- */}
        <CollapsiblePanel
          id="suggestions-fills"
          title="Cards Your Deck Needs"
          expanded={expandedSections.fills}
          onToggle={() => toggleSection("fills")}
          testId="suggestions-fills-panel"
          summary={
            gaps.length > 0 ? (
              <span className="text-xs text-slate-400">
                {gaps.length} categor{gaps.length !== 1 ? "ies" : "y"} underserved
              </span>
            ) : undefined
          }
        >
          {fetchStatus === "loading" && (
            <div
              data-testid="suggestions-loading"
              className="flex items-center gap-2 text-sm text-slate-400 py-2"
            >
              <svg
                className="h-4 w-4 animate-spin motion-reduce:hidden"
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
              Loading recommendations...
            </div>
          )}

          {fetchStatus === "error" && (
            <div
              data-testid="suggestions-api-error"
              className="flex flex-col gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
            >
              <p>Could not load fill recommendations: {fetchError}</p>
              <button
                type="button"
                data-testid="refresh-suggestions"
                onClick={() => fetchSuggestions(true)}
                className="self-start rounded bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-red-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                Retry
              </button>
            </div>
          )}

          {(fetchStatus === "success" || (gaps.length === 0 && fetchStatus !== "loading")) && (
            <CategoryFillList categoryFills={categoryFills} />
          )}
        </CollapsiblePanel>

        {/* ----------------------------------------------------------------- */}
        {/* Section 2: Consider Cutting (Weak Cards)                          */}
        {/* ----------------------------------------------------------------- */}
        <CollapsiblePanel
          id="suggestions-weak"
          title="Consider Cutting"
          expanded={expandedSections.weak}
          onToggle={() => toggleSection("weak")}
          testId="suggestions-weak-panel"
          summary={
            weakCards.length > 0 ? (
              <span className="text-xs text-slate-400">
                {weakCards.length} card{weakCards.length !== 1 ? "s" : ""} underperforming
              </span>
            ) : undefined
          }
        >
          <WeakCardList weakCards={weakCards} />
        </CollapsiblePanel>

        {/* ----------------------------------------------------------------- */}
        {/* Section 3: Better Alternatives (Upgrades)                         */}
        {/* ----------------------------------------------------------------- */}
        <CollapsiblePanel
          id="suggestions-upgrades"
          title="Better Alternatives"
          expanded={expandedSections.upgrades}
          onToggle={() => toggleSection("upgrades")}
          testId="suggestions-upgrades-panel"
          summary={
            upgrades.length > 0 ? (
              <span className="text-xs text-slate-400">
                {upgrades.length} card{upgrades.length !== 1 ? "s" : ""} with alternatives
              </span>
            ) : undefined
          }
        >
          {fetchStatus === "loading" && (
            <div className="text-sm text-slate-400 py-2">
              Loading upgrade alternatives...
            </div>
          )}

          {fetchStatus === "error" && (
            <div className="text-sm text-slate-400 py-2">
              Could not load upgrades due to an error.
            </div>
          )}

          {fetchStatus === "success" && <UpgradeList upgrades={upgrades} />}
        </CollapsiblePanel>
      </div>

      {/* Refresh button */}
      {fetchStatus === "success" && (gaps.length > 0 || upgradeCandidates.length > 0) && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            data-testid="refresh-suggestions"
            onClick={() => fetchSuggestions(true)}
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 transition-colors"
          >
            Refresh Suggestions
          </button>
        </div>
      )}
    </section>
  );
}
