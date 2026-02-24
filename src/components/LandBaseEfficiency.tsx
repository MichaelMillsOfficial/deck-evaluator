import type { LandBaseEfficiencyResult } from "@/lib/land-base-efficiency";

interface LandBaseEfficiencyProps {
  result: LandBaseEfficiencyResult;
}

function getScoreColor(score: number): string {
  if (score >= 90) return "text-green-400";
  if (score >= 75) return "text-emerald-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function getBadgeClasses(score: number): string {
  if (score >= 90) return "bg-green-900/50 text-green-400 border-green-700";
  if (score >= 75)
    return "bg-emerald-900/50 text-emerald-400 border-emerald-700";
  if (score >= 60) return "bg-yellow-900/50 text-yellow-400 border-yellow-700";
  if (score >= 40) return "bg-orange-900/50 text-orange-400 border-orange-700";
  return "bg-red-900/50 text-red-400 border-red-700";
}

function getBarColor(score: number): string {
  if (score >= 90) return "bg-green-500";
  if (score >= 75) return "bg-emerald-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

export default function LandBaseEfficiency({
  result,
}: LandBaseEfficiencyProps) {
  return (
    <section aria-labelledby="land-efficiency-heading">
      <h3
        id="land-efficiency-heading"
        className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300"
      >
        Land Base Efficiency
      </h3>
      <p className="mb-4 text-xs text-slate-400">
        How well the mana base supports the deck&apos;s color and tempo needs
      </p>

      {/* Overall score display */}
      <div className="mb-5 flex items-center gap-4">
        <div className="flex flex-col items-center">
          <span
            data-testid="efficiency-overall-score"
            className={`text-3xl font-bold ${getScoreColor(result.overallScore)}`}
          >
            {result.overallScore}
          </span>
          <span className="text-xs text-slate-400">/ 100</span>
        </div>

        <div className="flex flex-col gap-1">
          <span
            data-testid="efficiency-score-label"
            className={`inline-block w-fit rounded border px-2 py-0.5 text-xs font-medium ${getBadgeClasses(result.overallScore)}`}
          >
            {result.scoreLabel}
          </span>

          {/* Overall progress bar */}
          <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-700">
            <div
              role="progressbar"
              aria-valuenow={result.overallScore}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Overall land base efficiency"
              className={`h-full rounded-full transition-all ${getBarColor(result.overallScore)}`}
              style={{ width: `${result.overallScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Factor breakdown */}
      <div className="space-y-3">
        {result.factors.map((factor) => (
          <div
            key={factor.name}
            data-testid="efficiency-factor"
            className="rounded-lg bg-slate-800/40 px-3 py-2"
          >
            <div className="mb-1 flex items-center justify-between">
              <span
                data-testid="factor-name"
                className="text-sm font-medium text-slate-200"
              >
                {factor.name}
              </span>
              <span
                data-testid="factor-score"
                className={`text-sm font-semibold ${getScoreColor(factor.score)}`}
              >
                {factor.score}
              </span>
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

            <p className="text-xs text-slate-400">{factor.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
