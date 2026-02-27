import type {
  BracketResult,
  BracketConstraint,
  DowngradeRecommendation,
} from "@/lib/bracket-estimator";

interface BracketEstimatorProps {
  result: BracketResult;
}

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

function getConstraintColor(constraint: BracketConstraint): string {
  if (constraint.minBracket >= 4) return "text-orange-400";
  if (constraint.minBracket >= 3) return "text-yellow-400";
  return "text-blue-400";
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

function ConstraintRow({ constraint }: { constraint: BracketConstraint }) {
  return (
    <div
      data-testid="bracket-constraint"
      className="rounded-lg bg-slate-800/40 px-3 py-2"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-200">
          {getConstraintTypeLabel(constraint.type)}
        </span>
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 text-xs font-semibold ${getBracketBadgeClasses(constraint.minBracket)}`}
        >
          B{constraint.minBracket}+
        </span>
      </div>
      <p className="text-xs text-slate-400">{constraint.explanation}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {constraint.cards.map((card) => (
          <span
            key={card}
            className="rounded bg-slate-700/60 px-1.5 py-0.5 text-xs text-slate-300"
          >
            {card}
          </span>
        ))}
      </div>
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

export default function BracketEstimator({
  result,
}: BracketEstimatorProps) {
  return (
    <section aria-labelledby="bracket-heading">
      <h3
        id="bracket-heading"
        className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300"
      >
        Bracket Estimator
      </h3>
      <p className="mb-4 text-xs text-slate-400">
        WotC Commander Bracket System — constraint-based classification for
        pre-game conversations
      </p>

      {/* Main bracket display */}
      <div className="mb-5 flex items-center gap-5">
        {/* Large bracket number */}
        <div className="flex flex-col items-center">
          <span
            data-testid="bracket-number"
            className={`text-5xl font-bold leading-none ${getBracketColor(result.bracket)}`}
          >
            {result.bracket}
          </span>
          <span className="mt-1 text-xs text-slate-400">/ 5</span>
        </div>

        {/* Bracket name badge and description */}
        <div className="flex flex-col gap-2">
          <span
            data-testid="bracket-name"
            className={`inline-block w-fit rounded border px-2 py-0.5 text-xs font-semibold ${getBracketBadgeClasses(result.bracket)}`}
          >
            {result.bracketName}
          </span>
          <p
            data-testid="bracket-description"
            className="max-w-xs text-xs text-slate-400"
          >
            {result.bracketDescription}
          </p>
        </div>

        {/* Combo source indicator */}
        <div className="ml-auto flex flex-col items-end gap-1">
          <span className="text-xs text-slate-500">
            Combo detection:{" "}
            {result.comboSource === "local+spellbook"
              ? "local + Commander Spellbook"
              : "local only"}
          </span>
          {result.bracket >= 4 && (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-semibold text-slate-200">
                  {Math.round(result.cedhStapleOverlap)}%
                </span>
                <span className="text-xs text-slate-400">cEDH overlap</span>
              </div>
              <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-700">
                <div
                  role="progressbar"
                  aria-valuenow={Math.round(result.cedhStapleOverlap)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="cEDH staple overlap"
                  className="h-full rounded-full bg-purple-500 transition-all"
                  style={{
                    width: `${Math.min(100, result.cedhStapleOverlap)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Constraint breakdown */}
      {result.constraints.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Constraint Violations
          </h4>
          <div className="space-y-2">
            {result.constraints
              .sort((a, b) => b.minBracket - a.minBracket)
              .map((constraint) => (
                <ConstraintRow
                  key={constraint.type}
                  constraint={constraint}
                />
              ))}
          </div>
        </div>
      )}

      {/* Downgrade recommendations */}
      {result.recommendations.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Downgrade Recommendations
          </h4>
          <div className="space-y-3 rounded-lg bg-slate-800/40 px-3 py-2">
            {result.recommendations.map((rec) => (
              <RecommendationSection
                key={rec.targetBracket}
                recommendation={rec}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
