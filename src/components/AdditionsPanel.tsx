"use client";

import type { EnrichedCard } from "@/lib/types";
import type { CandidateAnalysis } from "@/lib/candidate-analysis";
import CardSearchInput from "@/components/CardSearchInput";
import CandidateCardRow from "@/components/CandidateCardRow";

interface AdditionsPanelProps {
  candidates: string[];
  candidateCardMap: Record<string, EnrichedCard>;
  analyses: Record<string, CandidateAnalysis>;
  errors: Record<string, string>;
  onAddCard: (name: string) => void;
  onRemoveCard: (name: string) => void;
  onRetryCard: (name: string) => void;
  deckCardNames: Set<string>;
}

export default function AdditionsPanel({
  candidates,
  candidateCardMap,
  analyses,
  errors,
  onAddCard,
  onRemoveCard,
  onRetryCard,
  deckCardNames,
}: AdditionsPanelProps) {
  return (
    <section aria-labelledby="additions-heading">
      <h3
        id="additions-heading"
        className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300"
      >
        Possible Additions
      </h3>
      <p className="mb-4 text-xs text-slate-400">
        Search for candidate cards and evaluate their impact on your deck
      </p>

      <CardSearchInput
        deckCardNames={deckCardNames}
        candidateNames={candidates}
        onAddCard={onAddCard}
      />

      {candidates.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-8">
          Search for cards to evaluate as possible additions
        </p>
      ) : (
        <div>
          {candidates.map((name) => {
            const card = candidateCardMap[name];
            const error = errors[name];

            if (!card && error) {
              return (
                <div
                  key={name}
                  role="alert"
                  data-testid="candidate-error"
                  className="rounded-lg border border-red-700/50 bg-slate-800/50 mb-3 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-slate-200">
                        {name}
                      </span>
                      <p className="text-xs text-red-400 mt-0.5">{error}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onRetryCard(name)}
                        className="rounded-md bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                      >
                        Retry
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveCard(name)}
                        className="rounded-sm p-1 text-slate-400 hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                        aria-label={`Remove ${name}`}
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            if (!card) {
              return (
                <div
                  key={name}
                  data-testid="candidate-loading"
                  className="rounded-lg border border-slate-700 bg-slate-800/50 mb-3 p-3"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-purple-400"
                      aria-hidden="true"
                    />
                    <span className="text-sm text-slate-300">
                      Loading {name}...
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <CandidateCardRow
                key={name}
                card={card}
                analysis={analyses[name] ?? null}
                onRemove={() => onRemoveCard(name)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
