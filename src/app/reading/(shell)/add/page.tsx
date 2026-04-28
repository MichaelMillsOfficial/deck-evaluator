"use client";

import { useCallback, useMemo } from "react";
import type { EnrichedCard } from "@/lib/types";
import { analyzeCandidateCard } from "@/lib/candidate-analysis";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import { useCandidates } from "@/contexts/CandidatesContext";
import SectionHeader from "@/components/reading/SectionHeader";
import AdditionsPanel from "@/components/AdditionsPanel";

export default function AddPage() {
  const { payload, analysisResults } = useDeckSession();
  const {
    candidates,
    setCandidates,
    candidateCardMap,
    setCandidateCardMap,
    candidateAnalyses,
    setCandidateAnalyses,
    candidateErrors,
    setCandidateErrors,
  } = useCandidates();

  const deck = payload?.deck;
  const cardMap = payload?.cardMap;
  const synergyAnalysis = analysisResults?.synergyAnalysis ?? null;

  const deckCardNames = useMemo(() => {
    const names = new Set<string>();
    if (!deck) return names;
    for (const section of [deck.commanders, deck.mainboard, deck.sideboard]) {
      for (const card of section) names.add(card.name);
    }
    return names;
  }, [deck]);

  const enrichCandidate = useCallback(
    async (name: string) => {
      if (!cardMap || !synergyAnalysis || !deck) return;

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
          setCandidateErrors((prev) => ({ ...prev, [name]: "Card not found" }));
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

  const handleAdd = useCallback(
    async (name: string) => {
      if (!cardMap || !synergyAnalysis) return;
      if (candidates.includes(name)) return;
      setCandidates((prev) => [...prev, name]);
      await enrichCandidate(name);
    },
    [cardMap, synergyAnalysis, candidates, enrichCandidate]
  );

  const handleRemove = useCallback((name: string) => {
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

  const handleRetry = useCallback(
    async (name: string) => {
      await enrichCandidate(name);
    },
    [enrichCandidate]
  );

  if (!cardMap || !synergyAnalysis) return null;

  return (
    <div
      role="tabpanel"
      id="tabpanel-deck-additions"
      aria-labelledby="tab-deck-additions"
    >
      <SectionHeader
        slug="add"
        eyebrow="Candidates"
        title="Possible Additions"
        tagline="Try a card not in the deck and see how it would interact with the existing themes."
      />
      <AdditionsPanel
        candidates={candidates}
        candidateCardMap={candidateCardMap}
        analyses={candidateAnalyses}
        errors={candidateErrors}
        onAddCard={handleAdd}
        onRemoveCard={handleRemove}
        onRetryCard={handleRetry}
        deckCardNames={deckCardNames}
      />
    </div>
  );
}
