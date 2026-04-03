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
  const accentClass =
    accent === "blue"
      ? "text-blue-300"
      : accent === "green"
        ? "text-green-300"
        : accent === "amber"
          ? "text-amber-300"
          : "text-purple-300";

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-bold ${accentClass}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
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
    <div className="space-y-3">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
        <div
          className="h-2 rounded-full bg-purple-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Simulation progress: ${progress}%`}
        />
      </div>
      <ul className="space-y-1.5">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2 text-sm">
            {step.status === "done" ? (
              <span className="text-green-400" aria-hidden="true">
                ✓
              </span>
            ) : step.status === "active" ? (
              <span className="animate-spin text-purple-400" aria-hidden="true">
                ◌
              </span>
            ) : (
              <span className="text-slate-600" aria-hidden="true">
                ○
              </span>
            )}
            <span
              className={
                step.status === "done"
                  ? "text-slate-300"
                  : step.status === "active"
                    ? "text-purple-300"
                    : "text-slate-500"
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
    <div data-testid="goldfish-simulator" className="space-y-6">
      {/* Config controls */}
      <section
        aria-labelledby="goldfish-config-heading"
        className="rounded-xl border border-slate-700 bg-slate-800/50 p-4"
      >
        <h4
          id="goldfish-config-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300"
        >
          Simulation Settings
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Turns slider */}
          <div>
            <label
              htmlFor="goldfish-turns"
              className="mb-1 flex justify-between text-xs text-slate-400"
            >
              <span>Turns</span>
              <span className="font-semibold text-slate-300">{config.turns}</span>
            </label>
            <input
              id="goldfish-turns"
              type="range"
              min={5}
              max={15}
              step={1}
              value={config.turns}
              onChange={handleTurnsChange}
              className="w-full accent-purple-500"
              data-testid="goldfish-turns-slider"
            />
            <div className="flex justify-between text-xs text-slate-600">
              <span>5</span>
              <span>15</span>
            </div>
          </div>

          {/* Iterations slider */}
          <div>
            <label
              htmlFor="goldfish-iterations"
              className="mb-1 flex justify-between text-xs text-slate-400"
            >
              <span>Iterations</span>
              <span className="font-semibold text-slate-300">
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
              className="w-full accent-purple-500"
              data-testid="goldfish-iterations-slider"
            />
            <div className="flex justify-between text-xs text-slate-600">
              <span>100</span>
              <span>5,000</span>
            </div>
          </div>

          {/* Play/Draw toggle */}
          <div>
            <p className="mb-1 text-xs text-slate-400">Position</p>
            <div className="flex gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="goldfish-position"
                  value="play"
                  checked={config.onThePlay}
                  onChange={handleOnThePlayChange}
                  className="accent-purple-500"
                  data-testid="goldfish-on-the-play"
                />
                <span className="text-slate-300">On the play</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="goldfish-position"
                  value="draw"
                  checked={!config.onThePlay}
                  onChange={handleOnThePlayChange}
                  className="accent-purple-500"
                  data-testid="goldfish-on-the-draw"
                />
                <span className="text-slate-300">On the draw</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Loading state */}
      {loading && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
          <h4 className="mb-3 text-sm font-semibold text-slate-300">
            Running {config.iterations.toLocaleString()} games...
          </h4>
          <ProgressSteps steps={steps} progress={progress} />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-800/50 bg-red-900/20 p-4 text-sm text-red-300">
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
              className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300"
            >
              Aggregate Statistics
            </h4>
            <p className="mb-3 text-xs text-slate-500 italic">
              Assumes optimal solitaire play with no interaction.
            </p>
            <div
              className="grid grid-cols-2 gap-3 sm:grid-cols-4"
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
              className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"
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
                className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300"
              >
                Ramp Sources ({stats.rampSources.length})
              </h4>
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-xs text-slate-500">
                      <th className="px-3 py-2 text-left font-semibold">Card</th>
                      <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Type</th>
                      <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">CMC</th>
                      <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Cast Rate</th>
                      <th className="px-3 py-2 text-right font-semibold whitespace-nowrap">Avg Turn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.rampSources.map((src: RampSource) => (
                      <tr
                        key={src.name}
                        className="border-b border-slate-700/50 last:border-0"
                      >
                        <td className="px-3 py-1.5 text-slate-300">{src.name}</td>
                        <td className="px-3 py-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            src.type === "rock"
                              ? "bg-amber-500/20 text-amber-300"
                              : src.type === "dork"
                                ? "bg-green-500/20 text-green-300"
                                : src.type === "land-search"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-red-500/20 text-red-300"
                          }`}>
                            {src.type === "rock" ? "Rock" : src.type === "dork" ? "Dork" : src.type === "land-search" ? "Land Search" : "Ritual"}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right text-slate-400">{src.cmc}</td>
                        <td className="px-3 py-1.5 text-right text-slate-300">{src.castRate}%</td>
                        <td className="px-3 py-1.5 text-right text-slate-400">
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
              className="rounded-xl border border-slate-700 bg-slate-800/50 p-4"
            >
              <h4
                id="goldfish-combo-heading"
                className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300"
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
              className="rounded-xl border border-slate-700 bg-slate-800/50 p-4"
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
              className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-300"
            >
              Mana Development
            </h4>
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
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
                <div className="mt-4">
                  <GoldfishTurnTimeline game={displayedGame} />
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && !error && !stats && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 text-center">
          <p className="text-slate-400">
            Simulation starting...
          </p>
        </div>
      )}
    </div>
  );
}
