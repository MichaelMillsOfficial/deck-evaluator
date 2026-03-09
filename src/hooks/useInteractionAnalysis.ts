"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { EnrichedCard } from "@/lib/types";
import type { InteractionAnalysis, CardProfile } from "@/lib/interaction-engine";
import { profileCard, findInteractionsAsync } from "@/lib/interaction-engine";

export interface AnalysisStep {
  id: "profiling" | "detecting" | "finalizing";
  label: string;
  status: "pending" | "active" | "done";
}

const INITIAL_STEPS: AnalysisStep[] = [
  { id: "profiling", label: "Compiling oracle text", status: "pending" },
  { id: "detecting", label: "Detecting interactions", status: "pending" },
  { id: "finalizing", label: "Building dependency graph", status: "pending" },
];

export interface UseInteractionAnalysisResult {
  analysis: InteractionAnalysis | null;
  loading: boolean;
  error: string | null;
  steps: AnalysisStep[];
  progress: number; // 0-100
}

// ─── Session-level cache ──────────────────────────────────────
// Survives React re-renders and tab switches within a session.
// Cleared on page refresh. Keyed by sorted card names hash.

const sessionCache = new Map<string, InteractionAnalysis>();
const profileCache = new Map<string, CardProfile>();

function deckCacheKey(cardMap: Record<string, EnrichedCard>): string {
  // Simple hash of sorted card names — stable for same deck composition
  const sorted = Object.keys(cardMap).sort().join("\x1f");
  let hash = 5381;
  for (let i = 0; i < sorted.length; i++) {
    hash = ((hash << 5) + hash + sorted.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/**
 * Lazily computes interaction analysis when triggered.
 * Breaks computation into yielding steps so the browser can paint
 * progress updates between phases.
 *
 * Caches results in a module-level session Map so switching tabs
 * back and forth is instant.
 */
export function useInteractionAnalysis(
  cardMap: Record<string, EnrichedCard> | null,
  enabled: boolean
): UseInteractionAnalysisResult {
  const [analysis, setAnalysis] = useState<InteractionAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<AnalysisStep[]>(INITIAL_STEPS);
  const [progress, setProgress] = useState(0);
  const computedForRef = useRef<Record<string, EnrichedCard> | null>(null);
  const cancelledRef = useRef(false);

  const updateStep = useCallback(
    (stepId: AnalysisStep["id"], status: AnalysisStep["status"]) => {
      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, status } : s))
      );
    },
    []
  );

  useEffect(() => {
    if (!enabled || !cardMap) return;
    if (computedForRef.current === cardMap) return;

    cancelledRef.current = false;
    setLoading(true);
    setError(null);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })));
    setProgress(0);

    const yield_ = () =>
      new Promise<void>((resolve) => setTimeout(resolve, 0));

    const run = async () => {
      try {
        const cacheKey = deckCacheKey(cardMap);

        // Check session cache first — instant return if same deck
        const cached = sessionCache.get(cacheKey);
        if (cached) {
          updateStep("profiling", "done");
          updateStep("detecting", "done");
          updateStep("finalizing", "done");
          setProgress(100);
          computedForRef.current = cardMap;
          setAnalysis(cached);
          setLoading(false);
          return;
        }

        const cards = Object.values(cardMap);

        // Step 1: Profile cards in batches, yielding between batches
        // Reuse individually cached profiles where available
        updateStep("profiling", "active");
        setProgress(5);
        await yield_();

        const profiles: CardProfile[] = [];
        const batchSize = 15;
        for (let i = 0; i < cards.length; i += batchSize) {
          if (cancelledRef.current) return;
          const batch = cards.slice(i, i + batchSize);
          for (const card of batch) {
            const cachedProfile = profileCache.get(card.name);
            if (cachedProfile) {
              profiles.push(cachedProfile);
            } else {
              const profile = profileCard(card);
              profiles.push(profile);
              profileCache.set(card.name, profile);
            }
          }
          const pct = Math.min(
            40,
            5 + Math.round((i / cards.length) * 35)
          );
          setProgress(pct);
          await yield_();
        }

        if (cancelledRef.current) return;
        updateStep("profiling", "done");

        // Step 2: Interaction detection (async with yielding between pair batches)
        updateStep("detecting", "active");
        setProgress(45);
        await yield_();

        if (cancelledRef.current) return;
        const result = await findInteractionsAsync(
          profiles,
          (pairProgress) => {
            setProgress(45 + Math.round(pairProgress * 40));
          },
          () => cancelledRef.current
        );

        updateStep("detecting", "done");
        setProgress(85);
        await yield_();

        // Step 3: Finalize
        if (cancelledRef.current) return;
        updateStep("finalizing", "active");
        setProgress(90);
        await yield_();

        updateStep("finalizing", "done");
        setProgress(100);

        // Store in session cache for instant re-access
        sessionCache.set(cacheKey, result);

        computedForRef.current = cardMap;
        setAnalysis(result);
        setLoading(false);
      } catch (err) {
        if (!cancelledRef.current) {
          setError(
            err instanceof Error
              ? err.message
              : "Interaction analysis failed"
          );
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelledRef.current = true;
    };
  }, [cardMap, enabled, updateStep]);

  return { analysis, loading, error, steps, progress };
}
