"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeckData, DeckTheme, EnrichedCard } from "@/lib/types";
import type {
  DrawnHand,
  HandCard,
  HandEvaluationContext,
  RankedHand,
  SimulationStats,
} from "@/lib/opening-hand";
import {
  buildPool,
  buildCommandZone,
  buildCardCache,
  computePipWeights,
  drawHand,
  evaluateHandQuality,
  findTopHands,
  runSimulation,
} from "@/lib/opening-hand";
import {
  computeColorDistribution,
  resolveCommanderIdentity,
  type MtgColor,
} from "@/lib/color-distribution";
import HandDisplay from "@/components/HandDisplay";
import HandSimulationStats from "@/components/HandSimulationStats";
import TopHands from "@/components/TopHands";
import HandBuilder from "@/components/HandBuilder";
import CollapsiblePanel from "@/components/CollapsiblePanel";
import SectionNav from "@/components/SectionNav";
import styles from "./HandSimulator.module.css";

const MAX_MULLIGANS = 3;

const HANDS_SECTIONS = [
  { id: "sim-stats", label: "Sim Stats" },
  { id: "top-hands", label: "Top Hands" },
  { id: "draw-hand", label: "Draw Hand" },
  { id: "hand-builder", label: "Hand Builder" },
] as const;

interface HandSimulatorProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard>;
  deckThemes?: DeckTheme[];
  expandedSections: Set<string>;
  onToggleSection: (id: string) => void;
}

export default function HandSimulator({
  deck,
  cardMap,
  deckThemes = [],
  expandedSections,
  onToggleSection,
}: HandSimulatorProps) {
  const [currentHand, setCurrentHand] = useState<DrawnHand | null>(null);
  const [mulliganCount, setMulliganCount] = useState(0);
  // Simulation results are stored together with the inputs they were computed
  // from, so "loading" is derived (stale result = loading) instead of being
  // toggled via setState inside the effect.
  const [simResult, setSimResult] = useState<{
    inputs: {
      pool: HandCard[];
      commanderIdentity: Set<MtgColor>;
      commandZone: HandCard[];
      context: HandEvaluationContext | undefined;
    };
    stats: SimulationStats;
    topHands: RankedHand[];
  } | null>(null);

  const pool = useMemo(() => buildPool(deck, cardMap), [deck, cardMap]);
  const commandZone = useMemo(() => buildCommandZone(deck, cardMap), [deck, cardMap]);
  const commanderIdentity = useMemo(
    () => resolveCommanderIdentity(deck, cardMap),
    [deck, cardMap]
  );

  const context: HandEvaluationContext | undefined = useMemo(() => {
    if (!pool.length) return undefined;
    const distribution = computeColorDistribution(deck, cardMap);
    const pipWeights = computePipWeights({ ...distribution.pips }, commanderIdentity);
    return {
      deckThemes,
      cardCache: buildCardCache(pool),
      pipWeights,
    };
  }, [pool, deckThemes, deck, cardMap, commanderIdentity]);

  useEffect(() => {
    if (!pool.length) return;
    // Defer to next frame to avoid blocking render
    const id = requestAnimationFrame(() => {
      const stats = runSimulation(pool, commanderIdentity, 1000, commandZone, context);
      const top = findTopHands(pool, commanderIdentity, 5, 2000, commandZone, context);
      setSimResult({
        inputs: { pool, commanderIdentity, commandZone, context },
        stats,
        topHands: top,
      });
    });
    return () => cancelAnimationFrame(id);
  }, [pool, commanderIdentity, commandZone, context]);

  // A result computed from stale inputs means a fresh run is in flight.
  const simFresh =
    simResult !== null &&
    simResult.inputs.pool === pool &&
    simResult.inputs.commanderIdentity === commanderIdentity &&
    simResult.inputs.commandZone === commandZone &&
    simResult.inputs.context === context;
  const simLoading = pool.length > 0 && !simFresh;
  const simStats = simFresh ? simResult.stats : null;
  const topHands = simFresh ? simResult.topHands : [];

  const drawNewHand = useCallback(
    (mulliganNumber: number) => {
      const handSize = 7 - mulliganNumber;
      const cards = drawHand(pool, handSize);
      const quality = evaluateHandQuality(
        cards,
        mulliganNumber,
        commanderIdentity,
        commandZone,
        context
      );
      const hand: DrawnHand = {
        cards,
        quality,
        mulliganNumber,
      };
      setCurrentHand(hand);
    },
    [pool, commanderIdentity, commandZone, context]
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

  const handleNewHand = handleDrawHand;

  const handleSelectSection = useCallback(
    (id: string) => {
      onToggleSection(id);
    },
    [onToggleSection]
  );

  return (
    <div data-testid="hand-simulator" className={styles.root}>
      <SectionNav
        sections={HANDS_SECTIONS}
        expandedSections={expandedSections}
        onSelectSection={handleSelectSection}
      />

      <CollapsiblePanel
        id="sim-stats"
        title="Simulation Statistics"
        expanded={expandedSections.has("sim-stats")}
        onToggle={() => onToggleSection("sim-stats")}
      >
        <HandSimulationStats stats={simStats} loading={simLoading} />
      </CollapsiblePanel>

      <CollapsiblePanel
        id="top-hands"
        title="Top 5 Best Hands"
        expanded={expandedSections.has("top-hands")}
        onToggle={() => onToggleSection("top-hands")}
      >
        <TopHands hands={topHands} loading={simLoading} />
      </CollapsiblePanel>

      <CollapsiblePanel
        id="draw-hand"
        title="Draw Hand"
        expanded={expandedSections.has("draw-hand")}
        onToggle={() => onToggleSection("draw-hand")}
      >
        {/* Action buttons */}
        <div className={styles.buttonRow}>
          {!currentHand ? (
            <button
              type="button"
              onClick={handleDrawHand}
              data-testid="draw-hand-btn"
              className={styles.btnPrimary}
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
                className={styles.btnOutline}
              >
                Mulligan{mulliganCount > 0 ? ` (${mulliganCount}/${MAX_MULLIGANS})` : ""}
              </button>
              <button
                type="button"
                onClick={handleNewHand}
                data-testid="new-hand-btn"
                className={styles.btnSecondary}
              >
                New Hand
              </button>
            </>
          )}
        </div>

        {/* Hand display */}
        {currentHand && (
          <div className={styles.handDisplayWrapper}>
            <HandDisplay hand={currentHand} commandZone={commandZone} />
          </div>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel
        id="hand-builder"
        title="Hand Builder"
        expanded={expandedSections.has("hand-builder")}
        onToggle={() => onToggleSection("hand-builder")}
      >
        <HandBuilder pool={pool} commanderIdentity={commanderIdentity} commandZone={commandZone} context={context} />
      </CollapsiblePanel>
    </div>
  );
}
