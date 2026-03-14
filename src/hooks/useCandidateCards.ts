"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DeckData, EnrichedCard } from "@/lib/types";
import type { CandidateAnalysis } from "@/lib/candidate-analysis";
import { analyzeCandidateCard } from "@/lib/candidate-analysis";
import type { DeckSynergyAnalysis } from "@/lib/types";

interface UseCandidateCardsResult {
  candidates: string[];
  candidateCardMap: Record<string, EnrichedCard>;
  candidateAnalyses: Record<string, CandidateAnalysis>;
  candidateErrors: Record<string, string>;
  deckCardNames: Set<string>;
  handleAddCandidate: (name: string) => Promise<void>;
  handleRemoveCandidate: (name: string) => void;
  handleRetryCandidate: (name: string) => Promise<void>;
}

export function useCandidateCards(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard> | null,
  synergyAnalysis: DeckSynergyAnalysis | null
): UseCandidateCardsResult {
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

  return {
    candidates,
    candidateCardMap,
    candidateAnalyses,
    candidateErrors,
    deckCardNames,
    handleAddCandidate,
    handleRemoveCandidate,
    handleRetryCandidate,
  };
}
