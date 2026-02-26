"use client";

import { useCallback, useMemo, useState } from "react";
import type { DeckData, EnrichedCard } from "@/lib/types";
import type { DrawnHand } from "@/lib/opening-hand";
import {
  buildPool,
  drawHand,
  evaluateHandQuality,
  runSimulation,
} from "@/lib/opening-hand";
import { resolveCommanderIdentity } from "@/lib/color-distribution";
import HandDisplay from "@/components/HandDisplay";
import HandSimulationStats from "@/components/HandSimulationStats";

const MAX_MULLIGANS = 3;

interface HandSimulatorProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard>;
}

export default function HandSimulator({ deck, cardMap }: HandSimulatorProps) {
  const [currentHand, setCurrentHand] = useState<DrawnHand | null>(null);
  const [mulliganCount, setMulliganCount] = useState(0);

  const pool = useMemo(() => buildPool(deck, cardMap), [deck, cardMap]);
  const commanderIdentity = useMemo(
    () => resolveCommanderIdentity(deck, cardMap),
    [deck, cardMap]
  );

  const simStats = useMemo(
    () => runSimulation(deck, cardMap, 1000),
    [deck, cardMap]
  );

  const drawNewHand = useCallback(
    (mulliganNumber: number) => {
      const handSize = 7 - mulliganNumber;
      const cards = drawHand(pool, handSize);
      const quality = evaluateHandQuality(
        cards,
        mulliganNumber,
        commanderIdentity
      );
      const hand: DrawnHand = {
        cards,
        quality,
        mulliganNumber,
      };
      setCurrentHand(hand);
    },
    [pool, commanderIdentity]
  );

  const handleDrawHand = useCallback(() => {
    setMulliganCount(0);
    drawNewHand(0);
  }, [drawNewHand]);

  const handleMulligan = useCallback(() => {
    const newCount = mulliganCount + 1;
    setMulliganCount(newCount);
    drawNewHand(newCount);
  }, [mulliganCount, drawNewHand]);

  const handleNewHand = useCallback(() => {
    setMulliganCount(0);
    drawNewHand(0);
  }, [drawNewHand]);

  return (
    <div data-testid="hand-simulator" className="space-y-6">
      {/* Simulation stats at top */}
      <HandSimulationStats stats={simStats} />

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {!currentHand ? (
          <button
            type="button"
            onClick={handleDrawHand}
            data-testid="draw-hand-btn"
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            Draw Hand
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleMulligan}
              disabled={mulliganCount >= MAX_MULLIGANS}
              data-testid="mulligan-btn"
              className="rounded-lg border border-purple-500 px-4 py-2 text-sm font-medium text-purple-300 transition-colors hover:bg-purple-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Mulligan{mulliganCount > 0 ? ` (${mulliganCount}/${MAX_MULLIGANS})` : ""}
            </button>
            <button
              type="button"
              onClick={handleNewHand}
              data-testid="new-hand-btn"
              className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            >
              New Hand
            </button>
          </>
        )}
      </div>

      {/* Hand display */}
      {currentHand && <HandDisplay hand={currentHand} />}
    </div>
  );
}
