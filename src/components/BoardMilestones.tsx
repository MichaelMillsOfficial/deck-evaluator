"use client";

import { useState } from "react";
import type { BoardMilestone } from "@/lib/goldfish-milestones";

interface BoardMilestonesProps {
  milestones: BoardMilestone[];
}

const MILESTONE_LABELS: Record<string, string> = {
  first_spell: "First Spell",
  commander_cast: "Commander",
  combo_assembled: "Combo",
  critical_mass: "Board",
  snapshot: "Snapshot",
};

const MILESTONE_COLORS: Record<string, string> = {
  first_spell: "text-blue-300 border-blue-700 bg-blue-900/20",
  commander_cast: "text-purple-300 border-purple-700 bg-purple-900/20",
  combo_assembled: "text-amber-300 border-amber-700 bg-amber-900/20",
  critical_mass: "text-green-300 border-green-700 bg-green-900/20",
  snapshot: "text-slate-300 border-slate-700 bg-slate-800/40",
};

const MILESTONE_ACTIVE_COLORS: Record<string, string> = {
  first_spell: "border-blue-500 bg-blue-900/40 text-blue-200",
  commander_cast: "border-purple-500 bg-purple-900/40 text-purple-200",
  combo_assembled: "border-amber-500 bg-amber-900/40 text-amber-200",
  critical_mass: "border-green-500 bg-green-900/40 text-green-200",
  snapshot: "border-slate-400 bg-slate-700/50 text-slate-100",
};

function MilestoneCard({ milestone }: { milestone: BoardMilestone }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            {MILESTONE_LABELS[milestone.type] ?? milestone.type}
          </p>
          <p className="text-sm text-slate-300 mt-0.5">{milestone.description}</p>
        </div>
        <span className="shrink-0 rounded-full border border-slate-600 bg-slate-700 px-2 py-0.5 text-xs font-mono text-slate-300">
          T{milestone.turn}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
        <div>
          <p className="text-slate-500">Permanents</p>
          <p className="font-semibold text-slate-200">{milestone.permanentCount.toFixed(1)}</p>
        </div>
        <div>
          <p className="text-slate-500">Lands</p>
          <p className="font-semibold text-slate-200">{milestone.landCount.toFixed(1)}</p>
        </div>
        <div>
          <p className="text-slate-500">Creatures</p>
          <p className="font-semibold text-slate-200">{milestone.creatureCount.toFixed(1)}</p>
        </div>
        <div>
          <p className="text-slate-500">Mana</p>
          <p className="font-semibold text-slate-200">{milestone.manaAvailable.toFixed(1)}</p>
        </div>
      </div>

      {/* Top permanents */}
      {milestone.topPermanents.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1.5">Common board pieces</p>
          <div className="flex flex-wrap gap-1.5">
            {milestone.topPermanents.map((p) => (
              <span
                key={p.name}
                className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300"
              >
                {p.name}
                <span className="text-slate-500">{(p.frequency * 100).toFixed(0)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BoardMilestones({ milestones }: BoardMilestonesProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (milestones.length === 0) {
    return (
      <p className="text-sm text-slate-500">No board state milestones detected.</p>
    );
  }

  const selected = milestones[selectedIndex];

  return (
    <section aria-labelledby="board-milestones-heading" className="space-y-3">
      <h4
        id="board-milestones-heading"
        className="text-sm font-semibold uppercase tracking-wide text-slate-400"
      >
        Board State Milestones
      </h4>

      {/* Pill selector */}
      <nav aria-label="Milestone selector" className="flex flex-wrap gap-2">
        {milestones.map((milestone, i) => {
          const isActive = i === selectedIndex;
          const activeClass = MILESTONE_ACTIVE_COLORS[milestone.type] ?? "border-purple-500 bg-purple-900/30 text-purple-300";
          const inactiveClass = MILESTONE_COLORS[milestone.type] ?? "border-slate-600 bg-slate-800 text-slate-400";
          return (
            <button
              key={`${milestone.type}-${milestone.turn}`}
              type="button"
              onClick={() => setSelectedIndex(i)}
              aria-pressed={isActive}
              className={`min-h-[44px] rounded-full border px-3 py-1 text-xs transition-colors cursor-pointer ${
                isActive ? activeClass : `${inactiveClass} hover:border-purple-500 hover:text-slate-200`
              }`}
            >
              T{milestone.turn} — {MILESTONE_LABELS[milestone.type] ?? milestone.type}
            </button>
          );
        })}
      </nav>

      {/* Selected milestone card */}
      {selected && <MilestoneCard milestone={selected} />}
    </section>
  );
}
