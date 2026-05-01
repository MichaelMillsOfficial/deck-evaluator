"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import { usePendingChanges } from "@/contexts/PendingChangesContext";
import { readingRunningHead } from "@/lib/reading-format";
import SectionHeader, {
  type SectionStat,
} from "@/components/reading/SectionHeader";
import ChapterFooter from "@/components/reading/ChapterFooter";
import AdditionsPanel from "@/components/AdditionsPanel";

export default function AddPage() {
  const router = useRouter();
  const { payload, analysisResults } = useDeckSession();
  const {
    adds,
    addCandidate,
    removeCandidate,
    retryEnrich,
    pairAdd,
    unpairAdd,
    confirmedAdds,
    unpairedAddNames,
    confirmedCutNames,
    lastAnnouncement,
  } = usePendingChanges();

  const deck = payload?.deck;
  const cardMap = payload?.cardMap;
  const synergyAnalysis = analysisResults?.synergyAnalysis ?? null;

  const deckCardNames = useMemo(() => {
    const names = new Set<string>();
    if (!deck) return names;
    for (const section of [deck.commanders, deck.mainboard, deck.sideboard]) {
      for (const card of section) names.add(card.name);
    }
    return names;
  }, [deck]);

  const handleAdd = useCallback(
    async (name: string) => {
      await addCandidate(name);
    },
    [addCandidate]
  );

  const handleRemove = useCallback(
    (name: string) => {
      removeCandidate(name);
    },
    [removeCandidate]
  );

  const handleRetry = useCallback(
    async (name: string) => {
      await retryEnrich(name);
    },
    [retryEnrich]
  );

  const confirmedCount = confirmedAdds.length;
  const unpairedCount = unpairedAddNames.size;

  const stats = useMemo<SectionStat[] | undefined>(() => {
    if (!adds.length) return undefined;
    const synergyScores = adds
      .map((a) => a.analysis?.synergyScore)
      .filter((v): v is number => typeof v === "number");
    const avgSynergy =
      synergyScores.length > 0
        ? synergyScores.reduce((s, v) => s + v, 0) / synergyScores.length
        : null;
    const errorCount = adds.filter((a) => a.error).length;
    return [
      {
        label: "Trying",
        value: String(adds.length),
        sub: adds.length === 1 ? "candidate" : "candidates",
        accent: true,
      },
      {
        label: "Paired",
        value: String(confirmedCount),
        sub: `of ${adds.length}`,
        accent: confirmedCount > 0,
      },
      {
        label: "Unpaired",
        value: String(unpairedCount),
        sub: unpairedCount > 0 ? "won't apply" : "all paired",
        accent: false,
      },
      {
        label: "Avg Synergy",
        value: avgSynergy === null ? "—" : avgSynergy.toFixed(1),
        sub: errorCount > 0 ? `${errorCount} err` : "score / 10",
      },
    ];
  }, [adds, confirmedCount]);

  const candidates = useMemo(() => adds.map((a) => a.name), [adds]);
  const candidateCardMap = useMemo(
    () =>
      Object.fromEntries(
        adds.flatMap((a) => (a.enrichedCard ? [[a.name, a.enrichedCard]] : []))
      ),
    [adds]
  );
  const analyses = useMemo(
    () =>
      Object.fromEntries(
        adds.flatMap((a) => (a.analysis ? [[a.name, a.analysis]] : []))
      ),
    [adds]
  );
  const errors = useMemo(
    () =>
      Object.fromEntries(
        adds.flatMap((a) => (a.error ? [[a.name, a.error]] : []))
      ),
    [adds]
  );

  if (!cardMap || !synergyAnalysis || !payload) return null;

  const ctaLabel =
    confirmedCount > 0
      ? `Update Reading (${confirmedCount})`
      : "Update Reading";
  const ctaDisabled = confirmedCount === 0;

  return (
    <div
      role="tabpanel"
      id="tabpanel-deck-additions"
      aria-labelledby="tab-deck-additions"
    >
      {/* Aria-live region for pair/unpair announcements — always mounted so
          NVDA/JAWS see content updates rather than a newly-inserted node. */}
      <p role="status" aria-live="polite" className="sr-only">
        {lastAnnouncement ?? ""}
      </p>

      <SectionHeader
        slug="add"
        runningHead={readingRunningHead(payload.createdAt, payload.deck.name)}
        eyebrow="Candidates"
        title="Possible Additions"
        tagline="Try a card not in the deck and see how it would interact with the existing themes."
        stats={stats}
      />

      {/* Update Reading CTA */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          marginBottom: "var(--space-6)",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          disabled={ctaDisabled}
          onClick={() => router.push("/reading/compare")}
          aria-describedby={ctaDisabled ? "update-reading-hint" : undefined}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "var(--space-3) var(--space-6)",
            borderRadius: "var(--btn-radius)",
            background: ctaDisabled ? "var(--surface-2)" : "var(--accent-gradient)",
            color: ctaDisabled ? "var(--ink-secondary)" : "var(--ink-on-accent)",
            fontFamily: "var(--font-sans)",
            fontWeight: "var(--weight-semibold)",
            fontSize: "var(--text-sm)",
            border: "none",
            cursor: ctaDisabled ? "not-allowed" : "pointer",
            opacity: ctaDisabled ? 0.6 : 1,
            transition: "opacity 150ms ease",
          }}
          className="motion-reduce:transition-none"
        >
          {ctaLabel}
        </button>
        {ctaDisabled && adds.length > 0 && (
          <span
            id="update-reading-hint"
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--ink-secondary)",
              fontFamily: "var(--font-sans)",
            }}
          >
            Pair at least one add with a cut to compare
          </span>
        )}
        {!ctaDisabled && unpairedCount > 0 && (
          <span
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--ink-secondary)",
              fontFamily: "var(--font-sans)",
            }}
          >
            {unpairedCount} unpaired waiting
          </span>
        )}
      </div>

      <AdditionsPanel
        candidates={candidates}
        candidateCardMap={candidateCardMap}
        analyses={analyses}
        errors={errors}
        onAddCard={handleAdd}
        onRemoveCard={handleRemove}
        onRetryCard={handleRetry}
        deckCardNames={deckCardNames}
        onPairAdd={pairAdd}
        onUnpairAdd={unpairAdd}
        confirmedCutNames={confirmedCutNames}
        mainboard={deck?.mainboard ?? []}
        commanders={deck?.commanders ?? []}
        adds={adds}
        addNames={new Set(adds.map((a) => a.name))}
      />
      <ChapterFooter current="additions" />
    </div>
  );
}
