"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { EnrichedCard } from "@/lib/types";
import type { CandidateAnalysis } from "@/lib/candidate-analysis";
import { analyzeCandidateCard } from "@/lib/candidate-analysis";
import {
  type PendingAdd,
  confirmedAdds as computeConfirmedAdds,
  confirmedCutNames as computeConfirmedCutNames,
  unpairedAddNames as computeUnpairedAddNames,
  buildModifiedDeck as computeModifiedDeck,
  loadPendingChanges,
  savePendingChanges,
  clearPendingChanges,
} from "@/lib/pending-changes";
import { useDeckSession } from "@/contexts/DeckSessionContext";

// Re-export PendingAdd so consumers can import from context
export type { PendingAdd };

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface PendingChangesContextValue {
  adds: PendingAdd[];
  addCandidate: (name: string) => Promise<void>;
  removeCandidate: (name: string) => void;
  retryEnrich: (name: string) => Promise<void>;
  pairAdd: (addName: string, cutName: string) => void;
  unpairAdd: (addName: string) => void;
  clearAll: () => void;
  // Derived (memoized)
  confirmedAdds: PendingAdd[];
  confirmedCutNames: Set<string>;
  unpairedAddNames: Set<string>;
  buildModifiedDeck: (deck: import("@/lib/types").DeckData) => import("@/lib/types").DeckData;
  // Aria-live announcement for screen readers
  lastAnnouncement: string | null;
}

const PendingChangesContext = createContext<PendingChangesContextValue | null>(
  null
);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function PendingChangesProvider({ children }: { children: ReactNode }) {
  const { payload, analysisResults } = useDeckSession();
  const [adds, setAdds] = useState<PendingAdd[]>([]);
  const [lastAnnouncement, setLastAnnouncement] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  const deckId = payload?.deckId ?? null;
  const cardMap = payload?.cardMap ?? null;
  const deck = payload?.deck ?? null;
  const synergyAnalysis = analysisResults?.synergyAnalysis ?? null;

  // ---------------------------------------------------------------------------
  // Hydrate from sessionStorage on mount (when deckId becomes available)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!deckId || hydratedRef.current) return;
    hydratedRef.current = true;

    const saved = loadPendingChanges(deckId);
    if (!saved || saved.length === 0) return;

    // Restore serialized adds as PendingAdd entries (without enrichedCard/analysis)
    const restored: PendingAdd[] = saved.map((s) => ({
      name: s.name,
      pairedCutName: s.pairedCutName,
    }));
    setAdds(restored);

    // Re-enrich each restored add asynchronously (fire-and-forget)
    for (const add of restored) {
      // The enrich function will be triggered via the re-enrich logic once deck
      // data is available. We trigger a silent re-enrich below.
    }
  }, [deckId]);

  // ---------------------------------------------------------------------------
  // Persist whenever adds change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!deckId) return;
    savePendingChanges(deckId, adds);
  }, [deckId, adds]);

  // ---------------------------------------------------------------------------
  // Re-enrich any restored adds that are missing enrichedCard
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!cardMap || !synergyAnalysis || !deck) return;
    const needsEnrich = adds.filter((a) => !a.enrichedCard && !a.error);
    if (needsEnrich.length === 0) return;

    for (const add of needsEnrich) {
      // Trigger enrichment (we don't await here — it updates state internally)
      void enrichAdd(add.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardMap, synergyAnalysis, deck, adds.map((a) => a.name).join(",")]);

  // ---------------------------------------------------------------------------
  // Core enrich helper
  // ---------------------------------------------------------------------------
  const enrichAdd = useCallback(
    async (name: string) => {
      if (!cardMap || !synergyAnalysis || !deck) return;

      // Clear any previous error
      setAdds((prev) =>
        prev.map((a) => (a.name === name ? { ...a, error: undefined } : a))
      );

      try {
        const res = await fetch("/api/deck-enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardNames: [name] }),
        });

        if (!res.ok) {
          setAdds((prev) =>
            prev.map((a) =>
              a.name === name
                ? { ...a, error: "Failed to fetch card data" }
                : a
            )
          );
          return;
        }

        const json = (await res.json()) as {
          cards: Record<string, EnrichedCard>;
        };
        const enrichedCard = json.cards[name];

        if (!enrichedCard) {
          setAdds((prev) =>
            prev.map((a) =>
              a.name === name ? { ...a, error: "Card not found" } : a
            )
          );
          return;
        }

        const fullMap = { ...cardMap, [name]: enrichedCard };
        const analysis = analyzeCandidateCard(
          enrichedCard,
          deck,
          fullMap,
          synergyAnalysis
        );

        setAdds((prev) =>
          prev.map((a) =>
            a.name === name ? { ...a, enrichedCard, analysis } : a
          )
        );
      } catch {
        setAdds((prev) =>
          prev.map((a) =>
            a.name === name
              ? { ...a, error: "Network error — check your connection" }
              : a
          )
        );
      }
    },
    [cardMap, synergyAnalysis, deck]
  );

  // ---------------------------------------------------------------------------
  // addCandidate
  // ---------------------------------------------------------------------------
  const addCandidate = useCallback(
    async (name: string) => {
      if (!cardMap || !synergyAnalysis) return;
      // No-op if already in the list
      if (adds.some((a) => a.name === name)) return;

      setAdds((prev) => [...prev, { name }]);
      await enrichAdd(name);
    },
    [cardMap, synergyAnalysis, adds, enrichAdd]
  );

  // ---------------------------------------------------------------------------
  // removeCandidate
  // ---------------------------------------------------------------------------
  const removeCandidate = useCallback((name: string) => {
    setAdds((prev) => prev.filter((a) => a.name !== name));
  }, []);

  // ---------------------------------------------------------------------------
  // retryEnrich
  // ---------------------------------------------------------------------------
  const retryEnrich = useCallback(
    async (name: string) => {
      await enrichAdd(name);
    },
    [enrichAdd]
  );

  // ---------------------------------------------------------------------------
  // pairAdd — strict 1:1: cutName cannot already be used by another pair
  // ---------------------------------------------------------------------------
  const pairAdd = useCallback(
    (addName: string, cutName: string) => {
      // Enforce 1:1 — same cut can't be paired twice
      const alreadyUsed = adds.some(
        (a) => a.pairedCutName === cutName && a.name !== addName
      );
      if (alreadyUsed) return;

      const confirmedCount = adds.filter(
        (a) => a.pairedCutName !== undefined
      ).length;

      setAdds((prev) =>
        prev.map((a) =>
          a.name === addName ? { ...a, pairedCutName: cutName } : a
        )
      );

      // New confirmed count (this add becomes confirmed)
      const newConfirmedCount = confirmedCount + 1;
      const totalAdds = adds.length;
      setLastAnnouncement(
        `${addName} paired with ${cutName}. ${newConfirmedCount} of ${totalAdds} additions paired.`
      );
    },
    [adds]
  );

  // ---------------------------------------------------------------------------
  // unpairAdd
  // ---------------------------------------------------------------------------
  const unpairAdd = useCallback(
    (addName: string) => {
      const confirmedCount = adds.filter(
        (a) => a.pairedCutName !== undefined
      ).length;
      const newCount = Math.max(0, confirmedCount - 1);
      const totalAdds = adds.length;

      setAdds((prev) =>
        prev.map((a) =>
          a.name === addName ? { ...a, pairedCutName: undefined } : a
        )
      );

      setLastAnnouncement(
        `${addName} unpaired. ${newCount} of ${totalAdds} additions paired.`
      );
    },
    [adds]
  );

  // ---------------------------------------------------------------------------
  // clearAll
  // ---------------------------------------------------------------------------
  const clearAll = useCallback(() => {
    setAdds([]);
    clearPendingChanges();
    setLastAnnouncement(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Derived memos
  // ---------------------------------------------------------------------------
  const confirmedAdds = useMemo(() => computeConfirmedAdds(adds), [adds]);
  const confirmedCutNames = useMemo(
    () => computeConfirmedCutNames(adds),
    [adds]
  );
  const unpairedAddNames = useMemo(() => computeUnpairedAddNames(adds), [adds]);

  const buildModifiedDeck = useCallback(
    (d: Parameters<typeof computeModifiedDeck>[0]) =>
      computeModifiedDeck(d, adds),
    [adds]
  );

  const value: PendingChangesContextValue = {
    adds,
    addCandidate,
    removeCandidate,
    retryEnrich,
    pairAdd,
    unpairAdd,
    clearAll,
    confirmedAdds,
    confirmedCutNames,
    unpairedAddNames,
    buildModifiedDeck,
    lastAnnouncement,
  };

  return (
    <PendingChangesContext.Provider value={value}>
      {children}
    </PendingChangesContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePendingChanges(): PendingChangesContextValue {
  const ctx = useContext(PendingChangesContext);
  if (!ctx) {
    throw new Error(
      "usePendingChanges must be used within PendingChangesProvider"
    );
  }
  return ctx;
}
