"use client";

import { useState, useMemo, useCallback } from "react";
import type { DeckData, EnrichedCard } from "@/lib/types";
import type { GoldfishCard, GoldfishConfig, RampSource, GoldfishGameLog } from "@/lib/goldfish-simulator";
import { DEFAULT_GOLDFISH_CONFIG, replayGoldfishGame, runGoldfishGame } from "@/lib/goldfish-simulator";
import { useGoldfishSimulation } from "@/hooks/useGoldfishSimulation";
import { randomSeed } from "@/lib/prng";
import { detectMilestones, captureSnapshotsAtTurns } from "@/lib/goldfish-milestones";
import { findCombosInDeck } from "@/lib/known-combos";
import { ComboAssemblyTracker } from "@/lib/combo-assembly-tracker";
import GoldfishManaChart from "@/components/GoldfishManaChart";
import GoldfishTurnTimeline from "@/components/GoldfishTurnTimeline";
import GoldfishGameSelector from "@/components/GoldfishGameSelector";
import type { GameSelection } from "@/components/GoldfishGameSelector";
import ComboAssemblyChart from "@/components/ComboAssemblyChart";
import BoardMilestones from "@/components/BoardMilestones";
import styles from "./GoldfishSimulator.module.css";

interface GoldfishSimulatorProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard>;
}

/** Build a minimal GoldfishCard stub for combo assembly tracking.
 *  The tracker only reads `.name` from cards, so a partial enriched stub suffices. */
function minimalGoldfishCard(name: string): GoldfishCard {
  return {
    name,
    enriched: { name } as EnrichedCard,
    tags: [],
  };
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "purple" | "blue" | "green" | "amber";
}

function StatCard({ label, value, sub, accent = "purple" }: StatCardProps) {
  const valueClass =
    accent === "blue"
      ? styles.statTileValueBlue
      : accent === "green"
        ? styles.statTileValueGreen
        : accent === "amber"
          ? styles.statTileValueAmber
          : styles.statTileValuePurple;

  return (
    <div className={styles.statTile}>
      <p className={styles.statTileLabel}>{label}</p>
      <p className={`${styles.statTileValue} ${valueClass}`}>{value}</p>
      {sub && <p className={styles.statTileSub}>{sub}</p>}
    </div>
  );
}

function ProgressSteps({
  steps,
  progress,
}: {
  steps: { id: string; label: string; status: string }[];
  progress: number;
}) {
  return (
    <div>
      <div className={styles.progressTrack}>
        <div
          className={styles.progressFill}
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Simulation progress: ${progress}%`}
        />
      </div>
      <ul className={styles.stepsList}>
        {steps.map((step) => (
          <li key={step.id} className={styles.stepItem}>
            {step.status === "done" ? (
              <span className={styles.stepIconDone} aria-hidden="true">
                ✓
              </span>
            ) : step.status === "active" ? (
              <span className={styles.stepIconActive} aria-hidden="true">
                ◌
              </span>
            ) : (
              <span className={styles.stepIconPending} aria-hidden="true">
                ○
              </span>
            )}
            <span
              className={
                step.status === "done"
                  ? styles.stepLabelDone
                  : step.status === "active"
                    ? styles.stepLabelActive
                    : styles.stepLabelPending
              }
            >
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function GoldfishSimulator({ deck, cardMap }: GoldfishSimulatorProps) {
  const [config, setConfig] = useState<GoldfishConfig>(DEFAULT_GOLDFISH_CONFIG);
  const [activeSelection, setActiveSelection] = useState<GameSelection>({
    type: "notable",
    index: 0,
  });

  // Stable config reference to avoid re-triggering simulation on every render
  const stableConfig = useMemo(() => config, [config]);

  const { result, loading, error, steps, progress } = useGoldfishSimulation(
    deck,
    cardMap,
    stableConfig,
    true // always enabled when this component is mounted
  );

  const stats = result?.stats;

  // Compute displayed game based on selection
  const displayedGame = useMemo<GoldfishGameLog | null>(() => {
    if (!result) return null;

    if (activeSelection.type === "notable") {
      const notable = result.notableGames[activeSelection.index];
      if (!notable) return result.games[0] ?? null;
      const summary = result.gameSummaries[notable.summaryIndex];
      if (!summary) return result.games[0] ?? null;
      return replayGoldfishGame(result.pool, result.commandZone, config, summary.seed);
    }

    if (activeSelection.type === "random") {
      // Pick a random summary from the batch
      const idx = Math.floor(Math.random() * result.gameSummaries.length);
      const summary = result.gameSummaries[idx];
      if (!summary) return result.games[0] ?? null;
      return replayGoldfishGame(result.pool, result.commandZone, config, summary.seed);
    }

    if (activeSelection.type === "new") {
      // Generate a fresh game with a new seed
      const seed = randomSeed();
      return runGoldfishGame(result.pool, result.commandZone, config, seed);
    }

    return result.games[0] ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, activeSelection]);

  const handleGameSelect = useCallback((selection: GameSelection) => {
    setActiveSelection(selection);
  }, []);

  const manaT4 = stats ? (stats.avgManaByTurn[3] ?? 0).toFixed(2) : "—";
  const commanderCastRate = stats
    ? `${(stats.commanderCastRate * 100).toFixed(1)}%`
    : "—";
  const avgSpells = stats ? stats.avgTotalSpellsCast.toFixed(1) : "—";
  const rampAccel = stats ? `+${stats.rampAcceleration.toFixed(2)}` : "—";

  // Advanced stats
  const avgBoardT5 = result
    ? (() => {
        const t5Logs = result.games.map((g) => g.turnLogs.find((l) => l.turn === 5)).filter(Boolean);
        if (t5Logs.length === 0) return "—";
        const avg = t5Logs.reduce((s, l) => s + (l?.permanentCount ?? 0), 0) / t5Logs.length;
        return avg.toFixed(1);
      })()
    : "—";

  const stallRate = result
    ? (() => {
        const stalled = result.games.filter((g) => {
          const t5Spells = g.turnLogs
            .filter((l) => l.turn <= 5)
            .reduce((s, l) => s + l.spellsCast.length, 0);
          return t5Spells < 3;
        }).length;
        return `${((stalled / result.games.length) * 100).toFixed(0)}%`;
      })()
    : "—";

  // Combo assembly stats
  const deckCardNames = useMemo(() => {
    if (!deck) return [];
    return [
      ...deck.commanders.map((c) => c.name),
      ...deck.mainboard.map((c) => c.name),
    ];
  }, [deck]);

  const detectedCombos = useMemo(
    () => findCombosInDeck(deckCardNames),
    [deckCardNames]
  );

  const comboStats = useMemo(() => {
    if (!result || detectedCombos.length === 0) return null;
    // Build trackers from the stored game state snapshots
    // (We compute combo stats as a post-processing pass over game logs)
    const trackers = result.games.map((game) => {
      const tracker = new ComboAssemblyTracker(
        detectedCombos.map((c) => ({
          id: c.id,
          name: c.id,
          cards: c.cards,
          zoneRequirements: c.zoneRequirements,
        }))
      );
      // Update tracker from each turn's hand/graveyard data
      // Note: we use simplified zone detection from turn logs
      for (const turnLog of game.turnLogs) {
        const fakeState = {
          hand: turnLog.hand.map((n) => minimalGoldfishCard(n)),
          battlefield: turnLog.permanents.map((p) => ({
            card: minimalGoldfishCard(p.name),
            tapped: p.tapped,
            summoningSick: false,
            producedMana: [],
            enteredTurn: p.enteredTurn,
          })),
          library: [],
          graveyard: turnLog.graveyard.map((n) => minimalGoldfishCard(n)),
          exile: turnLog.exile.map((n) => minimalGoldfishCard(n)),
          commandZone: [],
          manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
          landsPlayedThisTurn: 0,
          commanderTaxPaid: 0,
          turn: turnLog.turn,
          treasureCount: 0,
          rampLandsSearched: 0,
          random: Math.random,
        };
        tracker.update(fakeState, turnLog.turn);
      }
      return tracker;
    });
    return ComboAssemblyTracker.aggregateStats(trackers, result.games[0]?.turnLogs.length ?? 10);
  }, [result, detectedCombos]);

  const bestComboAssemblyRate = comboStats
    ? (() => {
        if (comboStats.perCombo.length === 0) return null;
        const best = comboStats.perCombo.reduce((max, c) =>
          c.assemblyRate > max.assemblyRate ? c : max
        );
        return best.assemblyRate > 0
          ? `${(best.assemblyRate * 100).toFixed(0)}%`
          : null;
      })()
    : null;

  // Board state milestones
  const milestones = useMemo(() => {
    if (!result) return [];
    return [
      ...detectMilestones(result.games),
      ...captureSnapshotsAtTurns(result.games, [3, 5, 8]),
    ].sort((a, b) => a.turn - b.turn);
  }, [result]);

  function handleIterationsChange(e: React.ChangeEvent<HTMLInputElement>) {
    setConfig((prev) => ({ ...prev, iterations: parseInt(e.target.value, 10) }));
  }

  function handleTurnsChange(e: React.ChangeEvent<HTMLInputElement>) {
    setConfig((prev) => ({ ...prev, turns: parseInt(e.target.value, 10) }));
  }

  function handleOnThePlayChange(e: React.ChangeEvent<HTMLInputElement>) {
    setConfig((prev) => ({ ...prev, onThePlay: e.target.value === "play" }));
  }

  return (
    <div data-testid="goldfish-simulator" className={styles.simulator}>
      {/* Config controls */}
      <section
        aria-labelledby="goldfish-config-heading"
        className={styles.panel}
      >
        <h4
          id="goldfish-config-heading"
          className={styles.sectionHeadingSmall}
        >
          Simulation Settings
        </h4>
        <div className={styles.controlsGrid}>
          {/* Turns slider */}
          <div className={styles.controlGroup}>
            <label
              htmlFor="goldfish-turns"
              className={styles.sliderLabel}
            >
              <span>Turns</span>
              <span className={styles.sliderLabelValue}>{config.turns}</span>
            </label>
            <input
              id="goldfish-turns"
              type="range"
              min={5}
              max={15}
              step={1}
              value={config.turns}
              onChange={handleTurnsChange}
              className={styles.slider}
              data-testid="goldfish-turns-slider"
            />
            <div className={styles.sliderRange}>
              <span>5</span>
              <span>15</span>
            </div>
          </div>

          {/* Iterations slider */}
          <div className={styles.controlGroup}>
            <label
              htmlFor="goldfish-iterations"
              className={styles.sliderLabel}
            >
              <span>Iterations</span>
              <span className={styles.sliderLabelValue}>
                {config.iterations.toLocaleString()}
              </span>
            </label>
            <input
              id="goldfish-iterations"
              type="range"
              min={100}
              max={5000}
              step={100}
              value={config.iterations}
              onChange={handleIterationsChange}
              className={styles.slider}
              data-testid="goldfish-iterations-slider"
            />
            <div className={styles.sliderRange}>
              <span>100</span>
              <span>5,000</span>
            </div>
          </div>

          {/* Play/Draw toggle */}
          <div className={styles.controlGroup}>
            <p className={styles.positionLabel}>Position</p>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="goldfish-position"
                  value="play"
                  checked={config.onThePlay}
                  onChange={handleOnThePlayChange}
                  className={styles.radioInput}
                  data-testid="goldfish-on-the-play"
                />
                <span>On the play</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="goldfish-position"
                  value="draw"
                  checked={!config.onThePlay}
                  onChange={handleOnThePlayChange}
                  className={styles.radioInput}
                  data-testid="goldfish-on-the-draw"
                />
                <span>On the draw</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Loading state */}
      {loading && (
        <div className={styles.panel}>
          <h4 className={styles.loadingHeading}>
            Running {config.iterations.toLocaleString()} games...
          </h4>
          <ProgressSteps steps={steps} progress={progress} />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className={styles.errorPanel}>
          Simulation error: {error}
        </div>
      )}

      {/* Results */}
      {stats && !loading && (
        <>
          {/* Stat cards */}
          <section aria-labelledby="goldfish-stats-heading">
            <h4
              id="goldfish-stats-heading"
              className={styles.sectionHeading}
            >
              Aggregate Statistics
            </h4>
            <p className={styles.statsTagline}>
              Assumes optimal solitaire play with no interaction.
            </p>
            <div
              className={styles.statGrid}
              data-testid="goldfish-stat-cards"
            >
              <StatCard
                label="Avg Mana at T4"
                value={manaT4}
                sub="available mana"
                accent="purple"
              />
              <StatCard
                label="Avg Spells/Game"
                value={avgSpells}
                sub="across all turns"
                accent="blue"
              />
              <StatCard
                label="Commander Cast Rate"
                value={commanderCastRate}
                sub={
                  stats.avgCommanderTurn
                    ? `avg turn ${stats.avgCommanderTurn.toFixed(1)}`
                    : "no commander"
                }
                accent="green"
              />
              <StatCard
                label="Ramp Acceleration"
                value={rampAccel}
                sub="mana vs baseline at T4"
                accent="amber"
              />
            </div>

            {/* Advanced stat cards */}
            <div
              className={styles.statGridSecondary}
              data-testid="goldfish-advanced-stat-cards"
            >
              <StatCard
                label="Combo Assembly"
                value={bestComboAssemblyRate ?? "—"}
                sub={bestComboAssemblyRate ? "best combo rate" : "no combos detected"}
                accent="purple"
              />
              <StatCard
                label="Avg Board T5"
                value={avgBoardT5}
                sub="permanents in play"
                accent="blue"
              />
              <StatCard
                label="Stall Rate"
                value={stallRate}
                sub="< 3 spells by T5"
                accent="amber"
              />
              <StatCard
                label="Commander Tax"
                value={stats.avgCommanderTaxTotal > 0
                  ? `+${stats.avgCommanderTaxTotal.toFixed(1)}`
                  : "0"}
                sub={stats.avgCommanderRecasts > 0
                  ? `${stats.avgCommanderRecasts.toFixed(2)} avg recasts`
                  : "no recasts"}
                accent="green"
              />
            </div>
          </section>

          {/* Ramp sources breakdown */}
          {stats.rampSources.length > 0 && (
            <section aria-labelledby="goldfish-ramp-heading">
              <h4
                id="goldfish-ramp-heading"
                className={styles.sectionHeading}
              >
                Ramp Sources ({stats.rampSources.length})
              </h4>
              <div className={styles.tablePanel}>
                <table className={styles.table}>
                  <thead className={styles.tableHead}>
                    <tr>
                      <th>Card</th>
                      <th>Type</th>
                      <th>CMC</th>
                      <th>Cast Rate</th>
                      <th>Avg Turn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.rampSources.map((src: RampSource) => (
                      <tr
                        key={src.name}
                        className={styles.tableRow}
                      >
                        <td className={styles.tdName}>{src.name}</td>
                        <td className={styles.tdType}>
                          <span className={`${styles.badge} ${
                            src.type === "rock"
                              ? styles.badgeRock
                              : src.type === "dork"
                                ? styles.badgeDork
                                : src.type === "land-search"
                                  ? styles.badgeLandSearch
                                  : styles.badgeRitual
                          }`}>
                            {src.type === "rock" ? "Rock" : src.type === "dork" ? "Dork" : src.type === "land-search" ? "Land Search" : "Ritual"}
                          </span>
                        </td>
                        <td className={styles.tdNum}>{src.cmc}</td>
                        <td className={`${styles.tdNum} ${styles.tdNumPrimary}`}>{src.castRate}%</td>
                        <td className={styles.tdNum}>
                          {src.avgCastTurn !== null ? `T${src.avgCastTurn}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Combo assembly tracking */}
          {comboStats && comboStats.perCombo.length > 0 && (
            <section
              aria-labelledby="goldfish-combo-heading"
              className={styles.panel}
            >
              <h4
                id="goldfish-combo-heading"
                className={styles.sectionHeading}
              >
                Combo Assembly
              </h4>
              <ComboAssemblyChart comboStats={comboStats} />
            </section>
          )}

          {/* Board state milestones */}
          {milestones.length > 0 && (
            <section
              aria-labelledby="goldfish-milestones-outer-heading"
              className={styles.panel}
            >
              <span id="goldfish-milestones-outer-heading" className="sr-only">
                Board State Milestones
              </span>
              <BoardMilestones milestones={milestones} />
            </section>
          )}

          {/* Mana development chart */}
          <section aria-labelledby="goldfish-chart-heading">
            <h4
              id="goldfish-chart-heading"
              className={styles.sectionHeading}
            >
              Mana Development
            </h4>
            <div className={styles.chartWrapper}>
              <GoldfishManaChart stats={stats} turns={config.turns} />
            </div>
          </section>

          {/* Game selector + turn timeline */}
          {result && (
            <section aria-labelledby="goldfish-timeline-heading">
              <GoldfishGameSelector
                notableGames={result.notableGames}
                activeSelection={activeSelection}
                onSelect={handleGameSelect}
              />

              {displayedGame && (
                <div className={styles.timelineWrapper}>
                  <GoldfishTurnTimeline game={displayedGame} />
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && !error && !stats && (
        <div className={styles.emptyPanel}>
          <p className={styles.emptyText}>
            Simulation starting...
          </p>
        </div>
      )}
    </div>
  );
}
