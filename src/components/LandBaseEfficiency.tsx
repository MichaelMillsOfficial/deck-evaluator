import type { LandBaseEfficiencyResult } from "@/lib/land-base-efficiency";
import type {
  ManaBaseRecommendationsResult,
  ManaRecommendation,
  OverallHealth,
  RecommendationSeverity,
} from "@/lib/mana-recommendations";

interface LandBaseEfficiencyProps {
  result: LandBaseEfficiencyResult;
  recommendations?: ManaBaseRecommendationsResult;
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

// ---------------------------------------------------------------------------
// Severity helpers (moved from ManaBaseRecommendations)
// ---------------------------------------------------------------------------

function getSeverityIcon(severity: RecommendationSeverity): React.ReactNode {
  switch (severity) {
    case "critical":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 text-red-400 shrink-0"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "warning":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 text-yellow-400 shrink-0"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "suggestion":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 text-blue-400 shrink-0"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
            clipRule="evenodd"
          />
        </svg>
      );
  }
}

// ---------------------------------------------------------------------------
// Health banner helpers
// ---------------------------------------------------------------------------

function getHealthBannerClasses(health: OverallHealth): string {
  switch (health) {
    case "healthy":
      return "bg-green-900/40 border-green-700 text-green-300";
    case "needs-attention":
      return "bg-yellow-900/40 border-yellow-700 text-yellow-300";
    case "critical-issues":
      return "bg-red-900/40 border-red-700 text-red-300";
  }
}

function getHealthIcon(health: OverallHealth): React.ReactNode {
  switch (health) {
    case "healthy":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5 text-green-400 shrink-0"
        >
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "needs-attention":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5 text-yellow-400 shrink-0"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "critical-issues":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5 text-red-400 shrink-0"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      );
  }
}

// ---------------------------------------------------------------------------
// RecommendationRow sub-component
// ---------------------------------------------------------------------------

interface RecommendationRowProps {
  recommendation: ManaRecommendation;
}

function RecommendationRow({ recommendation }: RecommendationRowProps) {
  return (
    <div
      data-testid="recommendation-row"
      className="flex gap-2 rounded-lg bg-slate-800/40 px-3 py-2"
    >
      <div className="mt-0.5">{getSeverityIcon(recommendation.severity)}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-200">
          {recommendation.title}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {recommendation.explanation}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LandBaseEfficiency({
  result,
  recommendations,
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

      {/* Mana Base Recommendations (merged) */}
      {recommendations && (
        <div data-testid="mana-recommendations" className="mt-5">
          <div className="mb-4 border-t border-slate-700" />

          {/* Health summary banner */}
          <div
            data-testid="recommendations-health-summary"
            className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 ${getHealthBannerClasses(recommendations.overallHealth)}`}
            role="status"
            aria-live="polite"
          >
            {getHealthIcon(recommendations.overallHealth)}
            <span className="text-sm font-medium">
              {recommendations.summaryText}
            </span>
          </div>

          {/* Recommendation rows */}
          {recommendations.recommendations.length > 0 ? (
            <div className="space-y-2">
              {recommendations.recommendations.map((rec) => (
                <RecommendationRow key={rec.id} recommendation={rec} />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
