"use client";

import { useEffect, useRef, useState } from "react";
import type { EnrichedCard } from "@/lib/types";
import type { InteractionAnalysis } from "@/lib/interaction-engine";
import { profileCard, findInteractions } from "@/lib/interaction-engine";

interface UseInteractionAnalysisResult {
  analysis: InteractionAnalysis | null;
  loading: boolean;
  error: string | null;
}

/**
 * Lazily computes interaction analysis when triggered.
 * Profiles each card via the interaction engine's oracle text compiler,
 * then runs pairwise interaction detection.
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
  const computedForRef = useRef<Record<string, EnrichedCard> | null>(null);

  useEffect(() => {
    // Only run when enabled and we have cards
    if (!enabled || !cardMap) return;

    // Skip if already computed for this exact cardMap
    if (computedForRef.current === cardMap) return;

    setLoading(true);
    setError(null);

    // Use setTimeout to avoid blocking the main thread during profiling
    const timeoutId = setTimeout(() => {
      try {
        // Profile each card
        const profiles = Object.values(cardMap).map((card) =>
          profileCard(card)
        );

        // Run interaction detection
        const result = findInteractions(profiles);

        computedForRef.current = cardMap;
        setAnalysis(result);
        setLoading(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Interaction analysis failed"
        );
        setLoading(false);
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [cardMap, enabled]);

  return { analysis, loading, error };
}
