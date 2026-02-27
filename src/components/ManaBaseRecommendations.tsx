"use client";

import type {
  ManaBaseRecommendationsResult,
  ManaRecommendation,
  OverallHealth,
  RecommendationSeverity,
} from "@/lib/mana-recommendations";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ManaBaseRecommendationsProps {
  result: ManaBaseRecommendationsResult;
}

// ---------------------------------------------------------------------------
// Severity helpers
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

export default function ManaBaseRecommendations({
  result,
}: ManaBaseRecommendationsProps) {
  return (
    <section data-testid="mana-recommendations" aria-label="Mana Base Recommendations">
      {/* Health summary banner */}
      <div
        data-testid="recommendations-health-summary"
        className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 ${getHealthBannerClasses(result.overallHealth)}`}
        role="status"
        aria-live="polite"
      >
        {getHealthIcon(result.overallHealth)}
        <span className="text-sm font-medium">{result.summaryText}</span>
      </div>

      {/* Recommendation rows */}
      {result.recommendations.length > 0 ? (
        <div className="space-y-2">
          {result.recommendations.map((rec) => (
            <RecommendationRow key={rec.id} recommendation={rec} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
