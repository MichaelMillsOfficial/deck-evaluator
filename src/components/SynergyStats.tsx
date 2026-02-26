"use client";

import { useState } from "react";
import type { DeckSynergyAnalysis } from "@/lib/types";

interface SynergyStatsProps {
  analysis: DeckSynergyAnalysis;
  spellbookComboCount?: number | null;
  spellbookNearComboCount?: number | null;
}

type ExpandedCard = "avg" | "combos" | "anti" | null;

function scoreBand(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Neutral";
  if (score >= 20) return "Questionable";
  return "Poor";
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform motion-reduce:transition-none ${
        expanded ? "rotate-180" : ""
      }`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function SynergyStats({
  analysis,
  spellbookComboCount,
  spellbookNearComboCount,
}: SynergyStatsProps) {
  const [expanded, setExpanded] = useState<ExpandedCard>(null);

  const scores = Object.values(analysis.cardScores);
  const avgScore =
    scores.length > 0
      ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
      : 0;

  // Score band breakdown
  const bands = { Excellent: 0, Good: 0, Neutral: 0, Questionable: 0, Poor: 0 };
  for (const s of scores) {
    bands[scoreBand(s.score) as keyof typeof bands]++;
  }

  function toggle(card: ExpandedCard) {
    setExpanded((prev) => (prev === card ? null : card));
  }

  function handleKeyDown(card: ExpandedCard, e: React.KeyboardEvent) {
    if (e.key === "Escape" && expanded === card) {
      e.preventDefault();
      setExpanded(null);
    }
  }

  return (
    <div className="mb-4 grid grid-cols-3 gap-3">
      {/* Avg Synergy */}
      <div
        className="rounded-lg border border-slate-700 bg-slate-800/50"
        data-testid="stat-avg-synergy"
      >
        <button
          type="button"
          onClick={() => toggle("avg")}
          onKeyDown={(e) => handleKeyDown("avg", e)}
          aria-expanded={expanded === "avg"}
          aria-controls="stat-avg-detail"
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Avg Synergy
            </p>
            <p className="mt-1 text-lg font-semibold text-white">
              {avgScore.toFixed(0)}
              <span className="text-sm font-normal text-slate-400">
                {" "}
                / 100
              </span>
            </p>
          </div>
          <Chevron expanded={expanded === "avg"} />
        </button>
        {expanded === "avg" && (
          <div
            id="stat-avg-detail"
            data-testid="score-band-breakdown"
            className="border-t border-slate-700 px-4 py-3"
          >
            <ul className="space-y-1 text-xs">
              {(
                Object.entries(bands) as [keyof typeof bands, number][]
              ).map(([band, count]) => (
                <li
                  key={band}
                  className="flex justify-between text-slate-300"
                >
                  <span>{band}</span>
                  <span className="font-medium text-white">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Known Combos */}
      <div
        className="rounded-lg border border-slate-700 bg-slate-800/50"
        data-testid="stat-combo-count"
      >
        <button
          type="button"
          onClick={() => toggle("combos")}
          onKeyDown={(e) => handleKeyDown("combos", e)}
          aria-expanded={expanded === "combos"}
          aria-controls="stat-combos-detail"
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {spellbookComboCount != null ? "Verified Combos" : "Known Combos"}
            </p>
            <p className="mt-1 text-lg font-semibold text-white">
              {spellbookComboCount != null
                ? spellbookComboCount
                : analysis.knownCombos.length}
            </p>
          </div>
          <Chevron expanded={expanded === "combos"} />
        </button>
        {expanded === "combos" && (
          <div
            id="stat-combos-detail"
            data-testid="combo-detail-list"
            className="border-t border-slate-700 px-4 py-3"
          >
            {analysis.knownCombos.length === 0 ? (
              <p className="text-xs text-slate-500">No combos detected.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {analysis.knownCombos.map((combo, i) => (
                  <li key={i} className="text-slate-300">
                    <p className="font-medium text-purple-300">
                      {combo.cards.join(" + ")}
                    </p>
                    <p className="mt-0.5 text-slate-400">
                      {combo.description}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Anti-Synergies */}
      <div
        className="rounded-lg border border-slate-700 bg-slate-800/50"
        data-testid="stat-anti-synergy-count"
      >
        <button
          type="button"
          onClick={() => toggle("anti")}
          onKeyDown={(e) => handleKeyDown("anti", e)}
          aria-expanded={expanded === "anti"}
          aria-controls="stat-anti-detail"
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Anti-Synergies
            </p>
            <p className="mt-1 text-lg font-semibold text-white">
              {analysis.antiSynergies.length}
            </p>
          </div>
          <Chevron expanded={expanded === "anti"} />
        </button>
        {expanded === "anti" && (
          <div
            id="stat-anti-detail"
            data-testid="anti-synergy-detail-list"
            className="border-t border-slate-700 px-4 py-3"
          >
            {analysis.antiSynergies.length === 0 ? (
              <p className="text-xs text-slate-500">
                No anti-synergies detected.
              </p>
            ) : (
              <ul className="space-y-2 text-xs">
                {analysis.antiSynergies.map((pair, i) => (
                  <li key={i} className="text-slate-300">
                    <p className="font-medium text-amber-300">
                      {pair.cards.join(" + ")}
                    </p>
                    <p className="mt-0.5 text-slate-400">
                      {pair.description}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
