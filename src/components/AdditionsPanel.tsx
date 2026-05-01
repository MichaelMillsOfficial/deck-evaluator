"use client";

import { useState } from "react";
import type { DeckCard, EnrichedCard } from "@/lib/types";
import type { CandidateAnalysis } from "@/lib/candidate-analysis";
import type { PendingAdd } from "@/contexts/PendingChangesContext";
import CardSearchInput from "@/components/CardSearchInput";
import CandidateCardRow from "@/components/CandidateCardRow";
import PairWithCutSheet from "@/components/reading/PairWithCutSheet";
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
  // Pairing props (optional for backward compat)
  onPairAdd?: (addName: string, cutName: string) => void;
  onUnpairAdd?: (addName: string) => void;
  confirmedCutNames?: Set<string>;
  mainboard?: DeckCard[];
  commanders?: DeckCard[];
  /** Full pending adds array from PendingChangesContext */
  adds?: PendingAdd[];
  /** All current add names (to build PendingAdd objects inline) */
  addNames?: Set<string>;
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
  onPairAdd,
  onUnpairAdd,
  confirmedCutNames = new Set(),
  mainboard = [],
  commanders = [],
  adds: addsProp = [],
  addNames = new Set(),
}: AdditionsPanelProps) {
  // Build a lookup map from name → PendingAdd for quick access
  const addsMap = new Map(addsProp.map((a) => [a.name, a]));
  // Track which add currently has the picker sheet open
  const [pickerForAddName, setPickerForAddName] = useState<string | null>(null);

  // Mainboard cards excludable from the picker (no commanders)
  const commanderNames = new Set(commanders.map((c) => c.name));
  const pickableMainboard = mainboard.filter((c) => !commanderNames.has(c.name));

  const handlePickCut = (cutName: string) => {
    if (pickerForAddName && onPairAdd) {
      onPairAdd(pickerForAddName, cutName);
    }
    setPickerForAddName(null);
  };

  const showPairingZone = !!onPairAdd;

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
        <ul
          className={styles.candidateList}
          aria-label="Pending additions"
          style={{ listStyle: "none", padding: 0, margin: 0 }}
        >
          {candidates.map((name) => {
            const card = candidateCardMap[name];
            const error = errors[name];

            if (!card && error) {
              return (
                <li key={name}>
                  <div
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
                </li>
              );
            }

            if (!card) {
              return (
                <li key={name}>
                  <div
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
                </li>
              );
            }

            // Look up real PendingAdd from the adds map (includes pairedCutName)
            const pendingAdd: PendingAdd | undefined = showPairingZone
              ? addsMap.get(name) ?? { name, enrichedCard: card, analysis: analyses[name] }
              : undefined;

            return (
              <li key={name}>
                <CandidateCardRow
                  card={card}
                  analysis={analyses[name] ?? null}
                  onRemove={() => onRemoveCard(name)}
                  add={showPairingZone ? pendingAdd : undefined}
                  onPickSuggestion={
                    showPairingZone && onPairAdd
                      ? (cutName) => onPairAdd(name, cutName)
                      : undefined
                  }
                  onOpenPicker={
                    showPairingZone
                      ? () => setPickerForAddName(name)
                      : undefined
                  }
                  onUnpair={
                    showPairingZone && onUnpairAdd
                      ? () => onUnpairAdd(name)
                      : undefined
                  }
                  excludedCutNames={confirmedCutNames}
                />
              </li>
            );
          })}
        </ul>
      )}

      {/* Shared Pick from your deck sheet — one instance at panel level */}
      {showPairingZone && (
        <PairWithCutSheet
          open={pickerForAddName !== null}
          addName={pickerForAddName}
          mainboard={pickableMainboard}
          excludedCutNames={confirmedCutNames}
          onPick={handlePickCut}
          onClose={() => setPickerForAddName(null)}
        />
      )}
    </section>
  );
}
