"use client";

import { useCallback, useState } from "react";
import type {
  BracketResult,
  BracketConstraint,
  DowngradeRecommendation,
} from "@/lib/bracket-estimator";
import { BRACKET_NAMES } from "@/lib/bracket-estimator";
import type { PowerLevelResult } from "@/lib/power-level";

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------

function getBracketColor(bracket: number): string {
  switch (bracket) {
    case 1:
      return "text-green-400";
    case 2:
      return "text-blue-400";
    case 3:
      return "text-yellow-400";
    case 4:
      return "text-orange-400";
    case 5:
      return "text-red-400";
    default:
      return "text-slate-400";
  }
}

function getBracketBadgeClasses(bracket: number): string {
  switch (bracket) {
    case 1:
      return "bg-green-900/50 border-green-700 text-green-400";
    case 2:
      return "bg-blue-900/50 border-blue-700 text-blue-400";
    case 3:
      return "bg-yellow-900/50 border-yellow-700 text-yellow-400";
    case 4:
      return "bg-orange-900/50 border-orange-700 text-orange-400";
    case 5:
      return "bg-red-900/50 border-red-700 text-red-400";
    default:
      return "bg-slate-900/50 border-slate-700 text-slate-400";
  }
}

function getBracketBgClasses(bracket: number, active: boolean): string {
  if (!active) return "bg-slate-800/30 border-slate-700/50 text-slate-500";
  switch (bracket) {
    case 1:
      return "bg-green-900/40 border-green-600 text-green-300";
    case 2:
      return "bg-blue-900/40 border-blue-600 text-blue-300";
    case 3:
      return "bg-yellow-900/40 border-yellow-600 text-yellow-300";
    case 4:
      return "bg-orange-900/40 border-orange-600 text-orange-300";
    case 5:
      return "bg-red-900/40 border-red-600 text-red-300";
    default:
      return "bg-slate-800/30 border-slate-700/50 text-slate-500";
  }
}

function getPowerLevelColor(powerLevel: number): string {
  if (powerLevel <= 3) return "text-green-400";
  if (powerLevel <= 5) return "text-yellow-400";
  if (powerLevel <= 7) return "text-orange-400";
  if (powerLevel <= 9) return "text-red-400";
  return "text-purple-400";
}

function getBandBadgeClasses(powerLevel: number): string {
  if (powerLevel <= 3)
    return "bg-green-900/50 text-green-400 border-green-700";
  if (powerLevel <= 5)
    return "bg-yellow-900/50 text-yellow-400 border-yellow-700";
  if (powerLevel <= 7)
    return "bg-orange-900/50 text-orange-400 border-orange-700";
  if (powerLevel <= 9)
    return "bg-red-900/50 text-red-400 border-red-700";
  return "bg-purple-900/50 text-purple-400 border-purple-700";
}

function getRawScoreBarColor(rawScore: number): string {
  if (rawScore >= 70) return "bg-red-500";
  if (rawScore >= 50) return "bg-orange-500";
  if (rawScore >= 30) return "bg-yellow-500";
  return "bg-green-500";
}

function getBarColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

function getConstraintTypeLabel(type: BracketConstraint["type"]): string {
  switch (type) {
    case "game-changer":
      return "Game Changers";
    case "two-card-combo":
      return "Two-Card Combos";
    case "extra-turn":
      return "Extra Turns";
    case "mass-land-denial":
      return "Mass Land Denial";
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BracketScale({ activeBracket }: { activeBracket: number }) {
  return (
    <div data-testid="bracket-scale" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((b) => (
        <div
          key={b}
          className={`flex-1 rounded border px-2 py-1.5 text-center text-xs font-semibold transition-colors ${getBracketBgClasses(b, b === activeBracket)}`}
        >
          B{b}
          <span className="ml-1 hidden sm:inline text-[10px] font-normal opacity-75">
            {BRACKET_NAMES[b]}
          </span>
        </div>
      ))}
    </div>
  );
}

interface CascadeStep {
  label: string;
  badge?: string;
  badgeBracket?: number;
  cards?: string[];
  explanation?: string;
  isFinal?: boolean;
}

function buildCascadeSteps(
  bracketResult: BracketResult,
  powerLevel: PowerLevelResult
): CascadeStep[] {
  const steps: CascadeStep[] = [];

  // First step: base
  steps.push({
    label: "Base",
    badge: "B1",
    badgeBracket: 1,
    explanation: "All decks start at Bracket 1 (Exhibition)",
  });

  // Low power → stays at B1
  if (bracketResult.bracket <= 2 && powerLevel.powerLevel <= 3) {
    steps.push({
      label: "Low power level",
      badge: `PL ${powerLevel.powerLevel}`,
      badgeBracket: 1,
      explanation: `Power level ${powerLevel.powerLevel}/10 — casual play patterns keep this in the lower brackets`,
    });
  }

  // Constraint steps sorted by minBracket ascending
  const sorted = [...bracketResult.constraints].sort(
    (a, b) => a.minBracket - b.minBracket
  );
  for (const constraint of sorted) {
    steps.push({
      label: getConstraintTypeLabel(constraint.type),
      badge: `B${constraint.minBracket}+`,
      badgeBracket: constraint.minBracket,
      cards: constraint.cards,
      explanation: constraint.explanation,
    });
  }

  // cEDH signals for B5
  if (bracketResult.bracket >= 5) {
    steps.push({
      label: "cEDH signals",
      badge: "B5",
      badgeBracket: 5,
      explanation: `Power level ${powerLevel.powerLevel}/10, ${Math.round(bracketResult.cedhStapleOverlap)}% cEDH staple overlap`,
    });
  }

  // Final result
  steps.push({
    label: `Result: Bracket ${bracketResult.bracket} (${bracketResult.bracketName})`,
    isFinal: true,
    badgeBracket: bracketResult.bracket,
  });

  return steps;
}

function BracketCascade({
  bracketResult,
  powerLevel,
}: {
  bracketResult: BracketResult;
  powerLevel: PowerLevelResult;
}) {
  const steps = buildCascadeSteps(bracketResult, powerLevel);

  return (
    <div data-testid="bracket-cascade" className="relative ml-3 border-l-2 border-slate-700 pl-4 space-y-3">
      {steps.map((step, i) => (
        <div key={i} className="relative">
          {/* Timeline dot */}
          <div
            className={`absolute -left-[calc(1rem+5px)] top-1.5 h-2.5 w-2.5 rounded-full border-2 ${
              step.isFinal
                ? `${getBracketColor(step.badgeBracket ?? 1).replace("text-", "bg-")} border-transparent`
                : "bg-slate-800 border-slate-500"
            }`}
          />

          {step.isFinal ? (
            <div
              className={`rounded-lg border px-3 py-2 ${getBracketBadgeClasses(step.badgeBracket ?? 1)}`}
            >
              <span className="text-sm font-semibold">{step.label}</span>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-200">
                  {step.label}
                </span>
                {step.badge && (
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-xs font-semibold ${getBracketBadgeClasses(step.badgeBracket ?? 1)}`}
                  >
                    {step.badge}
                  </span>
                )}
              </div>
              {step.explanation && (
                <p className="mt-0.5 text-xs text-slate-400">
                  {step.explanation}
                </p>
              )}
              {step.cards && step.cards.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {step.cards.map((card) => (
                    <span
                      key={card}
                      className="rounded bg-slate-700/60 px-1.5 py-0.5 text-xs text-slate-300"
                    >
                      {card}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RecommendationSection({
  recommendation,
}: {
  recommendation: DowngradeRecommendation;
}) {
  return (
    <div data-testid="bracket-recommendation" className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-300">
          To play in Bracket {recommendation.targetBracket}
        </span>
        <span
          className={`rounded border px-1.5 py-0.5 text-xs font-semibold ${getBracketBadgeClasses(recommendation.targetBracket)}`}
        >
          {recommendation.targetBracketName}
        </span>
      </div>
      {recommendation.removals.map((removal) => (
        <div
          key={removal.type}
          className="ml-2 flex flex-wrap items-center gap-1 text-xs text-slate-400"
        >
          <span>Remove {getConstraintTypeLabel(removal.type)}:</span>
          {removal.cards.map((card) => (
            <span
              key={card}
              className="rounded bg-slate-700/60 px-1.5 py-0.5 text-slate-300"
            >
              {card}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface DeckClassificationProps {
  bracketResult: BracketResult;
  powerLevel: PowerLevelResult;
}

export default function DeckClassification({
  bracketResult,
  powerLevel,
}: DeckClassificationProps) {
  const [factorsExpanded, setFactorsExpanded] = useState(false);

  const handleFactorsKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && factorsExpanded) {
        e.preventDefault();
        setFactorsExpanded(false);
      }
    },
    [factorsExpanded]
  );

  return (
    <section aria-labelledby="deck-classification-heading">
      <h3
        id="deck-classification-heading"
        className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300"
      >
        Deck Classification
      </h3>
      <p className="mb-4 text-xs text-slate-400">
        Unified bracket &amp; power level assessment for pre-game conversations
      </p>

      {/* Hero row */}
      <div className="mb-5 flex items-start justify-between gap-4">
        {/* Left: Bracket */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <span
              data-testid="bracket-number"
              className={`text-5xl font-bold leading-none ${getBracketColor(bracketResult.bracket)}`}
            >
              {bracketResult.bracket}
            </span>
            <span className="mt-1 text-xs text-slate-400">/ 5</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span
              data-testid="bracket-name"
              className={`inline-block w-fit rounded border px-2 py-0.5 text-xs font-semibold ${getBracketBadgeClasses(bracketResult.bracket)}`}
            >
              {bracketResult.bracketName}
            </span>
            <span className="text-xs text-slate-500">
              Combo:{" "}
              {bracketResult.comboSource === "local+spellbook"
                ? "local + Spellbook"
                : "local only"}
            </span>
          </div>
        </div>

        {/* Right: Power Level */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1.5 items-end">
            <span
              data-testid="power-level-band"
              className={`inline-block w-fit rounded border px-2 py-0.5 text-xs font-semibold ${getBandBadgeClasses(powerLevel.powerLevel)}`}
            >
              {powerLevel.bandLabel}
            </span>
            <div className="flex items-center gap-2">
              <div className="flex items-baseline gap-1">
                <span
                  data-testid="power-level-raw-score"
                  className="text-sm font-semibold text-slate-200"
                >
                  {powerLevel.rawScore}
                </span>
                <span className="text-xs text-slate-400">/ 100</span>
              </div>
              <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-700">
                <div
                  role="progressbar"
                  aria-valuenow={powerLevel.rawScore}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Raw power level score"
                  className={`h-full rounded-full transition-all ${getRawScoreBarColor(powerLevel.rawScore)}`}
                  style={{ width: `${powerLevel.rawScore}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <span
              data-testid="power-level-score"
              className={`text-5xl font-bold leading-none ${getPowerLevelColor(powerLevel.powerLevel)}`}
            >
              {powerLevel.powerLevel}
            </span>
            <span className="mt-1 text-xs text-slate-400">/ 10</span>
          </div>
        </div>
      </div>

      {/* Bracket scale */}
      <div className="mb-5">
        <BracketScale activeBracket={bracketResult.bracket} />
      </div>

      {/* Cascade timeline */}
      <div className="mb-5">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Classification Cascade
        </h4>
        <BracketCascade
          bracketResult={bracketResult}
          powerLevel={powerLevel}
        />
      </div>

      {/* Downgrade recommendations */}
      {bracketResult.recommendations.length > 0 && (
        <div className="mb-5">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Downgrade Recommendations
          </h4>
          <div className="space-y-3 rounded-lg bg-slate-800/40 px-3 py-2">
            {bracketResult.recommendations.map((rec) => (
              <RecommendationSection
                key={rec.targetBracket}
                recommendation={rec}
              />
            ))}
          </div>
        </div>
      )}

      {/* Power Level Factors — collapsible sub-section */}
      <div>
        <button
          type="button"
          data-testid="power-level-factors-toggle"
          aria-expanded={factorsExpanded}
          aria-controls="power-level-factors-content"
          onClick={() => setFactorsExpanded((prev) => !prev)}
          onKeyDown={handleFactorsKeyDown}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-700/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-inset"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 motion-reduce:transition-none ${
              factorsExpanded ? "rotate-90" : ""
            }`}
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Power Level Factors ({powerLevel.factors.length} factors)
          </span>
        </button>

        {factorsExpanded && (
          <div id="power-level-factors-content" className="mt-2 space-y-2 px-1">
            {powerLevel.factors.map((factor) => (
              <div
                key={factor.id}
                data-testid="power-level-factor"
                className="rounded-lg bg-slate-800/40 px-3 py-2"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-200">
                    {factor.name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-500">
                      {Math.round(factor.weight * 100)}% weight
                    </span>
                    <span
                      className={`text-sm font-semibold ${factor.score >= 60 ? "text-orange-400" : factor.score >= 30 ? "text-yellow-400" : "text-green-400"}`}
                    >
                      {factor.score}
                    </span>
                  </div>
                </div>

                <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-slate-700">
                  <div
                    role="progressbar"
                    aria-valuenow={factor.score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${factor.name} score`}
                    className={`h-full rounded-full transition-all ${getBarColor(factor.score)}`}
                    style={{ width: `${factor.score}%` }}
                  />
                </div>

                <p className="text-xs text-slate-400">{factor.explanation}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
