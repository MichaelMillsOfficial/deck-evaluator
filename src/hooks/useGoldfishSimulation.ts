"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { DeckData, EnrichedCard } from "@/lib/types";
import type { GoldfishConfig, GoldfishResult } from "@/lib/goldfish-simulator";
import {
  runGoldfishGame,
  buildGoldfishPoolFromDeck,
  buildGoldfishCommandZoneFromDeck,
  computeAggregateStats,
  computeRampSources,
  DEFAULT_GOLDFISH_CONFIG,
} from "@/lib/goldfish-simulator";
import type { GoldfishGameLog } from "@/lib/goldfish-simulator";

export interface GoldfishStep {
  id: "building" | "simulating" | "aggregating";
  label: string;
  status: "pending" | "active" | "done";
}

const INITIAL_STEPS: GoldfishStep[] = [
  { id: "building", label: "Building pool", status: "pending" },
  { id: "simulating", label: "Running simulation", status: "pending" },
  { id: "aggregating", label: "Computing statistics", status: "pending" },
];

export interface UseGoldfishSimulationResult {
  result: GoldfishResult | null;
  loading: boolean;
  error: string | null;
  steps: GoldfishStep[];
  progress: number; // 0-100
}

// ─── Session-level cache ──────────────────────────────────────
// Keyed by deck cache key + config hash, survives tab switches within a session.

interface CacheEntry {
  result: GoldfishResult;
  config: GoldfishConfig;
}

const sessionCache = new Map<string, CacheEntry>();

function deckCacheKey(
  cardMap: Record<string, EnrichedCard>,
  config: GoldfishConfig
): string {
  const sorted = Object.keys(cardMap).sort().join("\x1f");
  const configStr = `${config.turns}:${config.iterations}:${config.onThePlay ? 1 : 0}`;
  const combined = sorted + "\x00" + configStr;
  let hash = 5381;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash + combined.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/**
 * Lazily computes goldfish simulation when triggered.
 * Breaks computation into yielding batches so the browser can paint
 * progress updates between iterations.
 *
 * Caches results in a module-level session Map so switching tabs
 * back and forth is instant.
 */
export function useGoldfishSimulation(
  deck: DeckData | null,
  cardMap: Record<string, EnrichedCard> | null,
  config: GoldfishConfig = DEFAULT_GOLDFISH_CONFIG,
  enabled: boolean
): UseGoldfishSimulationResult {
  const [result, setResult] = useState<GoldfishResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<GoldfishStep[]>(INITIAL_STEPS);
  const [progress, setProgress] = useState(0);
  const cancelledRef = useRef(false);
  const computedKeyRef = useRef<string | null>(null);

  const updateStep = useCallback(
    (stepId: GoldfishStep["id"], status: GoldfishStep["status"]) => {
      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, status } : s))
      );
    },
    []
  );

  useEffect(() => {
    if (!enabled || !deck || !cardMap) return;

    const cacheKey = deckCacheKey(cardMap, config);
    if (computedKeyRef.current === cacheKey) return;

    cancelledRef.current = false;
    setLoading(true);
    setError(null);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })));
    setProgress(0);

    const yield_ = () =>
      new Promise<void>((resolve) => setTimeout(resolve, 0));

    const run = async () => {
      try {
        // Check session cache first
        const cached = sessionCache.get(cacheKey);
        if (cached) {
          updateStep("building", "done");
          updateStep("simulating", "done");
          updateStep("aggregating", "done");
          setProgress(100);
          computedKeyRef.current = cacheKey;
          setResult(cached.result);
          setLoading(false);
          return;
        }

        // Step 1: Build pool
        updateStep("building", "active");
        setProgress(5);
        await yield_();

        if (cancelledRef.current) return;

        const pool = buildGoldfishPoolFromDeck(deck, cardMap);
        const commandZone = buildGoldfishCommandZoneFromDeck(deck, cardMap);

        updateStep("building", "done");
        updateStep("simulating", "active");
        setProgress(10);
        await yield_();

        if (cancelledRef.current) return;

        // Step 2: Run simulation in batches, yielding between batches
        const games: GoldfishGameLog[] = [];
        const batchSize = Math.max(10, Math.floor(config.iterations / 20));

        for (let i = 0; i < config.iterations; i += batchSize) {
          if (cancelledRef.current) return;

          const batchEnd = Math.min(i + batchSize, config.iterations);
          for (let j = i; j < batchEnd; j++) {
            games.push(runGoldfishGame(pool, commandZone, config));
          }

          const pct = 10 + Math.round((i / config.iterations) * 75);
          setProgress(pct);
          await yield_();
        }

        if (cancelledRef.current) return;

        updateStep("simulating", "done");
        updateStep("aggregating", "active");
        setProgress(85);
        await yield_();

        // Step 3: Compute aggregate stats
        const stats = computeAggregateStats(games, config.turns);
        stats.rampSources = computeRampSources(pool, commandZone, games);

        if (cancelledRef.current) return;

        updateStep("aggregating", "done");
        setProgress(100);

        const goldfishResult: GoldfishResult = { games, stats };
        sessionCache.set(cacheKey, { result: goldfishResult, config });
        computedKeyRef.current = cacheKey;
        setResult(goldfishResult);
        setLoading(false);
      } catch (err) {
        if (!cancelledRef.current) {
          setError(
            err instanceof Error ? err.message : "Goldfish simulation failed"
          );
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelledRef.current = true;
    };
  }, [deck, cardMap, config, enabled, updateStep]);

  return { result, loading, error, steps, progress };
}
