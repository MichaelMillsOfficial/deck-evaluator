"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DeckData, EnrichedCard } from "@/lib/types";
import type { SpellbookCombo } from "@/lib/commander-spellbook";
import type { CandidateAnalysis } from "@/lib/candidate-analysis";
import { analyzeCandidateCard } from "@/lib/candidate-analysis";
import type { DeckAnalysisResults } from "@/lib/deck-analysis-aggregate";
import type { ViewTab } from "@/lib/view-tabs";
import DeckList from "@/components/DeckList";
import DeckAnalysis from "@/components/DeckAnalysis";
import SynergySection from "@/components/SynergySection";
import HandSimulator from "@/components/HandSimulator";
import AdditionsPanel from "@/components/AdditionsPanel";
import InteractionSection from "@/components/InteractionSection";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import GoldfishSimulator from "@/components/GoldfishSimulator";
import { useInteractionAnalysis } from "@/hooks/useInteractionAnalysis";
import {
  computeCompositionScorecard,
  AVAILABLE_TEMPLATES,
} from "@/lib/deck-composition";

interface DeckViewTabsProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard> | null;
  enrichLoading: boolean;
  spellbookCombos: {
    exactCombos: SpellbookCombo[];
    nearCombos: SpellbookCombo[];
  } | null;
  spellbookLoading: boolean;
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  analysisResults: DeckAnalysisResults | null;
}

export default function DeckViewTabs({
  deck,
  cardMap,
  enrichLoading,
  spellbookCombos,
  spellbookLoading,
  activeTab,
  analysisResults,
}: DeckViewTabsProps) {
  // Expanded section state persists across tab switches
  const [expandedSections, setExpandedSections] = useState<
    Record<string, Set<string>>
  >({
    analysis: new Set<string>(),
    synergy: new Set<string>(),
    hands: new Set<string>(),
    interactions: new Set<string>(),
    suggestions: new Set<string>(),
  });

  const synergyAnalysis = analysisResults?.synergyAnalysis ?? null;

  // Scorecard for the suggestions tab (uses the first template by default)
  const scorecard = useMemo(() => {
    if (!cardMap) return null;
    return computeCompositionScorecard(
      deck,
      cardMap,
      AVAILABLE_TEMPLATES[0]
    );
  }, [deck, cardMap]);

  // --- Interaction engine (lazy: only runs when tab is active) ---
  const {
    analysis: interactionAnalysis,
    loading: interactionLoading,
    error: interactionError,
    steps: interactionSteps,
    progress: interactionProgress,
  } = useInteractionAnalysis(cardMap, activeTab === "interactions");

  // --- Candidate state (persists across tab switches) ---
  const [candidates, setCandidates] = useState<string[]>([]);
  const [candidateCardMap, setCandidateCardMap] = useState<
    Record<string, EnrichedCard>
  >({});
  const [candidateAnalyses, setCandidateAnalyses] = useState<
    Record<string, CandidateAnalysis>
  >({});
  const [candidateErrors, setCandidateErrors] = useState<
    Record<string, string>
  >({});

  // Reset candidate state when deck or cardMap changes (new import)
  const prevDeckRef = useRef(deck);
  const prevCardMapRef = useRef(cardMap);
  useEffect(() => {
    if (deck !== prevDeckRef.current || cardMap !== prevCardMapRef.current) {
      prevDeckRef.current = deck;
      prevCardMapRef.current = cardMap;
      setCandidates([]);
      setCandidateCardMap({});
      setCandidateAnalyses({});
      setCandidateErrors({});
    }
  }, [deck, cardMap]);

  // Compute deck card names for filtering autocomplete
  const deckCardNames = useMemo(() => {
    const names = new Set<string>();
    for (const section of [deck.commanders, deck.mainboard, deck.sideboard]) {
      for (const card of section) {
        names.add(card.name);
      }
    }
    return names;
  }, [deck]);

  const enrichCandidate = useCallback(
    async (name: string) => {
      if (!cardMap || !synergyAnalysis) return;

      // Clear any previous error for this card
      setCandidateErrors((prev) => {
        if (!(name in prev)) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });

      try {
        const res = await fetch("/api/deck-enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardNames: [name] }),
        });
        if (!res.ok) {
          setCandidateErrors((prev) => ({
            ...prev,
            [name]: "Failed to fetch card data",
          }));
          return;
        }

        const json = (await res.json()) as {
          cards: Record<string, EnrichedCard>;
        };
        const enrichedCard = json.cards[name];
        if (!enrichedCard) {
          setCandidateErrors((prev) => ({
            ...prev,
            [name]: "Card not found",
          }));
          return;
        }

        setCandidateCardMap((prev) => ({ ...prev, [name]: enrichedCard }));

        const fullMap = { ...cardMap, [name]: enrichedCard };
        const analysis = analyzeCandidateCard(
          enrichedCard,
          deck,
          fullMap,
          synergyAnalysis
        );
        setCandidateAnalyses((prev) => ({ ...prev, [name]: analysis }));
      } catch {
        setCandidateErrors((prev) => ({
          ...prev,
          [name]: "Network error — check your connection",
        }));
      }
    },
    [cardMap, synergyAnalysis, deck]
  );

  const handleAddCandidate = useCallback(
    async (name: string) => {
      if (!cardMap || !synergyAnalysis) return;
      if (candidates.includes(name)) return;
      setCandidates((prev) => [...prev, name]);
      await enrichCandidate(name);
    },
    [cardMap, synergyAnalysis, candidates, enrichCandidate]
  );

  const handleRetryCandidate = useCallback(
    async (name: string) => {
      await enrichCandidate(name);
    },
    [enrichCandidate]
  );

  const handleRemoveCandidate = useCallback((name: string) => {
    setCandidates((prev) => prev.filter((c) => c !== name));
    setCandidateCardMap((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setCandidateAnalyses((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setCandidateErrors((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const handleToggleSection = useCallback(
    (tab: string, sectionId: string) => {
      setExpandedSections((prev) => {
        const current = prev[tab] ?? new Set<string>();
        const next = new Set(current);
        if (next.has(sectionId)) {
          next.delete(sectionId);
        } else {
          next.add(sectionId);
        }
        return { ...prev, [tab]: next };
      });
    },
    []
  );

  return (
    <div data-testid="deck-view-tabs">
      <div
        role="tabpanel"
        id="tabpanel-deck-list"
        aria-labelledby="tab-deck-list"
        hidden={activeTab !== "list"}
      >
        {activeTab === "list" && (
          <DeckList
            deck={deck}
            cardMap={cardMap}
            enrichLoading={enrichLoading}
          />
        )}
      </div>

      <div
        role="tabpanel"
        id="tabpanel-deck-analysis"
        aria-labelledby="tab-deck-analysis"
        hidden={activeTab !== "analysis"}
      >
        {activeTab === "analysis" && cardMap && !enrichLoading && (
          <DeckAnalysis
            deck={deck}
            cardMap={cardMap}
            expandedSections={expandedSections.analysis}
            onToggleSection={(id) => handleToggleSection("analysis", id)}
            spellbookCombos={spellbookCombos}
            analysisResults={analysisResults ?? undefined}
          />
        )}
      </div>

      <div
        role="tabpanel"
        id="tabpanel-deck-synergy"
        aria-labelledby="tab-deck-synergy"
        hidden={activeTab !== "synergy"}
      >
        {activeTab === "synergy" && cardMap && synergyAnalysis && (
          <section aria-labelledby="synergy-heading">
            <h3
              id="synergy-heading"
              className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300"
            >
              Card Synergy
            </h3>
            <p className="mb-4 text-xs text-slate-400">
              Synergy analysis, known combos, and anti-synergy warnings
            </p>
            <SynergySection
              deck={deck}
              analysis={synergyAnalysis}
              cardMap={cardMap}
              expandedSections={expandedSections.synergy}
              onToggleSection={(id) => handleToggleSection("synergy", id)}
              spellbookCombos={spellbookCombos}
              spellbookLoading={spellbookLoading}
            />
          </section>
        )}
      </div>

      <div
        role="tabpanel"
        id="tabpanel-deck-hands"
        aria-labelledby="tab-deck-hands"
        hidden={activeTab !== "hands"}
      >
        {activeTab === "hands" && cardMap && !enrichLoading && (
          <section aria-labelledby="hands-heading">
            <h3
              id="hands-heading"
              className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300"
            >
              Opening Hand Simulator
            </h3>
            <p className="mb-4 text-xs text-slate-400">
              Draw sample opening hands, evaluate quality, and view aggregate
              statistics
            </p>
            <HandSimulator
              deck={deck}
              cardMap={cardMap}
              deckThemes={synergyAnalysis?.deckThemes ?? []}
              expandedSections={expandedSections.hands ?? new Set<string>()}
              onToggleSection={(id) => handleToggleSection("hands", id)}
            />
          </section>
        )}
      </div>

      <div
        role="tabpanel"
        id="tabpanel-deck-additions"
        aria-labelledby="tab-deck-additions"
        hidden={activeTab !== "additions"}
      >
        {activeTab === "additions" && cardMap && !enrichLoading && (
          <AdditionsPanel
            candidates={candidates}
            candidateCardMap={candidateCardMap}
            analyses={candidateAnalyses}
            errors={candidateErrors}
            onAddCard={handleAddCandidate}
            onRemoveCard={handleRemoveCandidate}
            onRetryCard={handleRetryCandidate}
            deckCardNames={deckCardNames}
          />
        )}
      </div>

      <div
        role="tabpanel"
        id="tabpanel-deck-interactions"
        aria-labelledby="tab-deck-interactions"
        hidden={activeTab !== "interactions"}
      >
        {activeTab === "interactions" && cardMap && !enrichLoading && (
          <section aria-labelledby="interactions-heading">
            <h3
              id="interactions-heading"
              className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300"
            >
              Card Interactions
            </h3>
            <p className="mb-4 text-xs text-slate-400">
              Mechanical interaction analysis powered by oracle text compilation
            </p>
            <InteractionSection
              analysis={interactionAnalysis}
              loading={interactionLoading}
              error={interactionError}
              steps={interactionSteps}
              progress={interactionProgress}
              expandedSections={
                expandedSections.interactions ?? new Set<string>()
              }
              onToggleSection={(id) =>
                handleToggleSection("interactions", id)
              }
            />
          </section>
        )}
      </div>

      <div
        role="tabpanel"
        id="tabpanel-deck-goldfish"
        aria-labelledby="tab-deck-goldfish"
        hidden={activeTab !== "goldfish"}
      >
        {activeTab === "goldfish" && cardMap && !enrichLoading && (
          <section aria-labelledby="goldfish-heading">
            <h3
              id="goldfish-heading"
              className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300"
            >
              Goldfish Simulator
            </h3>
            <p className="mb-4 text-xs text-slate-400">
              Monte Carlo solitaire simulation: mana development and spell casting over {/* turns shown dynamically */}
              10 turns across 1,000+ games
            </p>
            <GoldfishSimulator deck={deck} cardMap={cardMap} />
          </section>
        )}
      </div>

      <div
        role="tabpanel"
        id="tabpanel-deck-suggestions"
        aria-labelledby="tab-deck-suggestions"
        hidden={activeTab !== "suggestions"}
      >
        {activeTab === "suggestions" &&
          cardMap &&
          !enrichLoading &&
          synergyAnalysis &&
          scorecard && (
            <SuggestionsPanel
              deck={deck}
              cardMap={cardMap}
              synergyAnalysis={synergyAnalysis}
              scorecard={scorecard}
            />
          )}
      </div>
    </div>
  );
}
