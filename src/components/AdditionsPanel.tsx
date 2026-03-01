"use client";

import type { EnrichedCard } from "@/lib/types";
import type { CandidateAnalysis } from "@/lib/candidate-analysis";
import CardSearchInput from "@/components/CardSearchInput";
import CandidateCardRow from "@/components/CandidateCardRow";

interface AdditionsPanelProps {
  candidates: string[];
  candidateCardMap: Record<string, EnrichedCard>;
  analyses: Record<string, CandidateAnalysis>;
  onAddCard: (name: string) => void;
  onRemoveCard: (name: string) => void;
  deckCardNames: Set<string>;
}

export default function AdditionsPanel({
  candidates,
  candidateCardMap,
  analyses,
  onAddCard,
  onRemoveCard,
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
            if (!card) return null;
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
