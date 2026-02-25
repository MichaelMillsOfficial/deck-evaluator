import type { PowerLevelResult } from "@/lib/power-level";

interface PowerLevelEstimatorProps {
  result: PowerLevelResult;
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

function getBarColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

function getRawScoreBarColor(rawScore: number): string {
  if (rawScore >= 70) return "bg-red-500";
  if (rawScore >= 50) return "bg-orange-500";
  if (rawScore >= 30) return "bg-yellow-500";
  return "bg-green-500";
}

export default function PowerLevelEstimator({
  result,
}: PowerLevelEstimatorProps) {
  return (
    <section aria-labelledby="power-level-heading">
      <h3
        id="power-level-heading"
        className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300"
      >
        Power Level Estimator
      </h3>
      <p className="mb-4 text-xs text-slate-400">
        Transparent, explainable power level score based on 8 weighted factors
      </p>

      {/* Main score display */}
      <div className="mb-5 flex items-center gap-5">
        {/* Large power level number */}
        <div className="flex flex-col items-center">
          <span
            data-testid="power-level-score"
            className={`text-5xl font-bold leading-none ${getPowerLevelColor(result.powerLevel)}`}
          >
            {result.powerLevel}
          </span>
          <span className="mt-1 text-xs text-slate-400">/ 10</span>
        </div>

        {/* Band label and description */}
        <div className="flex flex-col gap-2">
          <span
            data-testid="power-level-band"
            className={`inline-block w-fit rounded border px-2 py-0.5 text-xs font-semibold ${getBandBadgeClasses(result.powerLevel)}`}
          >
            {result.bandLabel}
          </span>
          <p className="max-w-xs text-xs text-slate-400">
            {result.bandDescription}
          </p>
        </div>

        {/* Raw score */}
        <div className="ml-auto flex flex-col items-end gap-1">
          <div className="flex items-baseline gap-1">
            <span
              data-testid="power-level-raw-score"
              className="text-xl font-semibold text-slate-200"
            >
              {result.rawScore}
            </span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-700">
            <div
              role="progressbar"
              aria-valuenow={result.rawScore}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Raw power level score"
              className={`h-full rounded-full transition-all ${getRawScoreBarColor(result.rawScore)}`}
              style={{ width: `${result.rawScore}%` }}
            />
          </div>
          <span className="text-xs text-slate-500">raw score</span>
        </div>
      </div>

      {/* Factor breakdown */}
      <div className="space-y-2">
        {result.factors.map((factor) => (
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
    </section>
  );
}
