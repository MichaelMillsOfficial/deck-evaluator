"use client";

import { useState, useMemo } from "react";
import type { DeckData, EnrichedCard } from "@/lib/types";
import type { GoldfishConfig } from "@/lib/goldfish-simulator";
import { DEFAULT_GOLDFISH_CONFIG } from "@/lib/goldfish-simulator";
import { useGoldfishSimulation } from "@/hooks/useGoldfishSimulation";
import GoldfishManaChart from "@/components/GoldfishManaChart";
import GoldfishTurnTimeline from "@/components/GoldfishTurnTimeline";

interface GoldfishSimulatorProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard>;
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

  // Stable config reference to avoid re-triggering simulation on every render
  const stableConfig = useMemo(() => config, [config]);

  const { result, loading, error, steps, progress } = useGoldfishSimulation(
    deck,
    cardMap,
    stableConfig,
    true // always enabled when this component is mounted
  );

  const stats = result?.stats;

  // Pick a representative sample game (first game with most spells)
  const sampleGame = useMemo(() => {
    if (!result?.games.length) return null;
    const sorted = [...result.games].sort(
      (a, b) =>
        b.turnLogs.reduce((s, l) => s + l.spellsCast.length, 0) -
        a.turnLogs.reduce((s, l) => s + l.spellsCast.length, 0)
    );
    return sorted[0] ?? null;
  }, [result]);

  const manaT4 = stats ? (stats.avgManaByTurn[3] ?? 0).toFixed(2) : "—";
  const commanderCastRate = stats
    ? `${(stats.commanderCastRate * 100).toFixed(1)}%`
    : "—";
  const avgSpells = stats ? stats.avgTotalSpellsCast.toFixed(1) : "—";
  const rampAccel = stats ? `+${stats.rampAcceleration.toFixed(2)}` : "—";

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
          </section>

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

          {/* Turn timeline for sample game */}
          {sampleGame && (
            <section aria-labelledby="goldfish-timeline-heading">
              <h4
                id="goldfish-timeline-heading"
                className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300"
              >
                Sample Game
              </h4>
              <p className="mb-3 text-xs text-slate-400">
                Turn-by-turn breakdown of a representative game (highest spell count)
              </p>
              <GoldfishTurnTimeline game={sampleGame} />
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
