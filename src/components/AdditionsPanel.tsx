"use client";

import type { EnrichedCard } from "@/lib/types";
import type { CandidateAnalysis } from "@/lib/candidate-analysis";
import CardSearchInput from "@/components/CardSearchInput";
import CandidateCardRow from "@/components/CandidateCardRow";
import styles from "./AdditionsPanel.module.css";

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
        className={styles.heading}
      >
        Possible Additions
      </h3>
      <p className={styles.description}>
        Search for candidate cards and evaluate their impact on your deck
      </p>

      <CardSearchInput
        deckCardNames={deckCardNames}
        candidateNames={candidates}
        onAddCard={onAddCard}
      />

      {candidates.length === 0 ? (
        <p className={styles.emptyState}>
          Search for cards to evaluate as possible additions
        </p>
      ) : (
        <div className={styles.candidateList}>
          {candidates.map((name) => {
            const card = candidateCardMap[name];
            const error = errors[name];

            if (!card && error) {
              return (
                <div
                  key={name}
                  role="alert"
                  data-testid="candidate-error"
                  className={styles.errorCard}
                >
                  <div className={styles.errorCardInner}>
                    <div className={styles.errorCardText}>
                      <span className={styles.errorCardName}>
                        {name}
                      </span>
                      <p className={styles.errorCardMessage}>{error}</p>
                    </div>
                    <div className={styles.errorCardActions}>
                      <button
                        type="button"
                        onClick={() => onRetryCard(name)}
                        className={styles.retryBtn}
                      >
                        Retry
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveCard(name)}
                        className={styles.removeBtn}
                        aria-label={`Remove ${name}`}
                      >
                        <svg
                          className={styles.removeBtnIcon}
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
                  className={styles.loadingCard}
                >
                  <div className={styles.loadingCardInner}>
                    <div
                      className={styles.loadingSpinner}
                      aria-hidden="true"
                    />
                    <span className={styles.loadingCardName}>
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
