"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { EnrichedCard } from "@/lib/types";
import type { InteractionAnalysis, CardProfile } from "@/lib/interaction-engine";
import { profileCard, findInteractions } from "@/lib/interaction-engine";

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

/**
 * Lazily computes interaction analysis when triggered.
 * Breaks computation into yielding steps so the browser can paint
 * progress updates between phases.
 *
 * Only recomputes when cardMap reference changes.
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

    // Yield to browser between steps using setTimeout chains
    const yield_ = () =>
      new Promise<void>((resolve) => setTimeout(resolve, 0));

    const run = async () => {
      try {
        const cards = Object.values(cardMap);

        // Step 1: Profile cards in batches, yielding between batches
        updateStep("profiling", "active");
        setProgress(5);
        await yield_();

        const profiles: CardProfile[] = [];
        const batchSize = 15;
        for (let i = 0; i < cards.length; i += batchSize) {
          if (cancelledRef.current) return;
          const batch = cards.slice(i, i + batchSize);
          for (const card of batch) {
            profiles.push(profileCard(card));
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

        // Step 2: Interaction detection
        updateStep("detecting", "active");
        setProgress(45);
        await yield_();

        if (cancelledRef.current) return;
        const result = findInteractions(profiles);

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
