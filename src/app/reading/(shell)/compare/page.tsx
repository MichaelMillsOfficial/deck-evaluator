"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import { usePendingChanges } from "@/contexts/PendingChangesContext";
import { readingRunningHead } from "@/lib/reading-format";
import { computeExtendedDeckComparison } from "@/lib/deck-comparison";
import SectionHeader from "@/components/reading/SectionHeader";
import ChapterFooter from "@/components/reading/ChapterFooter";
import EditModifiedDeckSheet from "@/components/reading/EditModifiedDeckSheet";
import ManaCurveComparison from "@/components/comparison/ManaCurveComparison";
import ColorAnalysisComparison from "@/components/comparison/ColorAnalysisComparison";
import ManaBaseComparison from "@/components/comparison/ManaBaseComparison";
import HandKeepabilityComparison from "@/components/comparison/HandKeepabilityComparison";
import BracketComparison from "@/components/comparison/BracketComparison";
import PowerLevelComparison from "@/components/comparison/PowerLevelComparison";
import CompositionScorecardComparison from "@/components/comparison/CompositionScorecardComparison";

export default function ComparePage() {
  const { payload } = useDeckSession();
  const { confirmedAdds, buildModifiedDeck } = usePendingChanges();
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const deck = payload?.deck ?? null;
  const cardMap = payload?.cardMap ?? null;

  // Build modified deck when there are confirmed adds
  const modifiedDeck = useMemo(() => {
    if (!deck || confirmedAdds.length === 0) return null;
    return buildModifiedDeck(deck);
  }, [deck, confirmedAdds, buildModifiedDeck]);

  // Build augmented cardMap for slot B: merge original cardMap with the
  // enrichedCard from each confirmed add so all 7 panels see the new cards.
  const cardMapB = useMemo(() => {
    if (!cardMap) return null;
    const merged: typeof cardMap = { ...cardMap };
    for (const add of confirmedAdds) {
      if (add.enrichedCard) merged[add.name] = add.enrichedCard;
    }
    return merged;
  }, [cardMap, confirmedAdds]);

  // Check whether any confirmed add is still loading (enrichedCard missing)
  const hasPendingEnrich = confirmedAdds.some((a) => !a.enrichedCard && !a.error);

  // Compute extended comparison only when we have both decks and both card maps
  const comparison = useMemo(() => {
    if (!deck || !cardMap || !cardMapB || !modifiedDeck) return null;
    try {
      return computeExtendedDeckComparison(deck, cardMap, modifiedDeck, cardMapB);
    } catch {
      return null;
    }
  }, [deck, cardMap, cardMapB, modifiedDeck]);

  if (!payload) return null;

  const deckName = payload.deck.name;
  // In the modified-compare view the contrast that matters is "current state"
  // vs "after staged swaps", so labelA is always "Current" — the deck name is
  // already shown in the SectionHeader running head above.
  void deckName;
  const labelA = "Current";
  const labelB = "Modified";

  return (
    <div
      role="tabpanel"
      id="tabpanel-deck-compare"
      aria-labelledby="tab-deck-compare"
    >
      <SectionHeader
        slug="compare"
        runningHead={readingRunningHead(payload.createdAt, deckName)}
        eyebrow="Compare"
        title="Original vs Modified"
        tagline="See how your staged swaps change the deck's power level, bracket, hand keepability, and composition."
      />

      {/* Loading state — some confirmed adds are still enriching */}
      {hasPendingEnrich && !comparison && (
        <div
          style={{
            padding: "var(--space-8) var(--space-6)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)",
            background: "var(--surface-2)",
            textAlign: "center",
            marginBottom: "var(--space-6)",
          }}
          role="status"
          aria-live="polite"
        >
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-sm)",
              color: "var(--ink-secondary)",
              margin: 0,
            }}
          >
            Enriching added cards — comparison will appear once all cards are
            loaded.
          </p>
        </div>
      )}

      {/* Mode 1 — has confirmed pending changes: show all 7 panels */}
      {comparison && modifiedDeck ? (
        <div>
          {/* Toolbar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-4)",
              marginBottom: "var(--space-6)",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/reading/add"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-2)",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-sm)",
                color: "var(--ink-tertiary)",
                textDecoration: "none",
              }}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                style={{ width: 16, height: 16, flexShrink: 0 }}
              >
                <path
                  fillRule="evenodd"
                  d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
                  clipRule="evenodd"
                />
              </svg>
              Edit at Additions
            </Link>

            <button
              type="button"
              onClick={() => setEditSheetOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "var(--space-2) var(--space-4)",
                borderRadius: "var(--btn-radius)",
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--ink-secondary)",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-sm)",
                cursor: "pointer",
              }}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                style={{ width: 14, height: 14, flexShrink: 0 }}
              >
                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
              </svg>
              Edit modified deck
            </button>
          </div>

          {/* Swap summary eyebrow */}
          <div
            style={{
              marginBottom: "var(--space-6)",
              padding: "var(--space-3) var(--space-4)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-eyebrow)",
                letterSpacing: "var(--tracking-eyebrow)",
                color: "var(--accent)",
              }}
            >
              {confirmedAdds.length} STAGED SWAP{confirmedAdds.length !== 1 ? "S" : ""}
            </span>
            <div
              style={{
                display: "flex",
                gap: "var(--space-3)",
                flexWrap: "wrap",
              }}
            >
              {confirmedAdds.map((a) => (
                <span
                  key={a.name}
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-xs)",
                    color: "var(--ink-tertiary)",
                  }}
                >
                  <span style={{ color: "var(--color-good)" }}>
                    +{a.name}
                  </span>
                  {" → "}
                  <span style={{ color: "var(--color-danger)" }}>
                    −{a.pairedCutName}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* 7-panel grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 420px), 1fr))",
              gap: "var(--space-5)",
            }}
          >
            <ManaCurveComparison
              data={comparison.curveOverlay}
              labelA={labelA}
              labelB={labelB}
            />
            <HandKeepabilityComparison
              data={comparison.handKeepability}
              labelA={labelA}
              labelB={labelB}
            />
            <ColorAnalysisComparison
              data={comparison.tagComparison}
              labelA={labelA}
              labelB={labelB}
            />
            <BracketComparison
              data={comparison.bracketComparison}
              labelA={labelA}
              labelB={labelB}
            />
            <PowerLevelComparison
              data={comparison.powerLevelComparison}
              labelA={labelA}
              labelB={labelB}
            />
            <CompositionScorecardComparison
              data={comparison.compositionComparison}
              labelA={labelA}
              labelB={labelB}
            />
            {/* Mana base panel spans two columns to fit the per-color pressure table. */}
            <div style={{ gridColumn: "span 2" }}>
              <ManaBaseComparison
                diffs={comparison.metricDiffs}
                pressure={comparison.manaPressure}
                labelA={labelA}
                labelB={labelB}
              />
            </div>
          </div>

          {/* Edit modified deck sheet */}
          <EditModifiedDeckSheet
            open={editSheetOpen}
            modifiedDeck={modifiedDeck}
            onClose={() => setEditSheetOpen(false)}
          />
        </div>
      ) : (
        /* Mode 2 — no confirmed pending changes: empty state */
        <div
          style={{
            padding: "var(--space-12)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)",
            background: "var(--surface-2)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              marginBottom: "var(--space-4)",
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontSize: "var(--text-md)",
              color: "var(--ink-secondary)",
            }}
          >
            No staged swaps yet. Head to Additions to pair cards, then come back
            to see how your deck changes.
          </p>
          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/reading/add"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-3)",
                padding: "var(--space-4) var(--space-6)",
                borderRadius: "var(--btn-radius)",
                background: "var(--accent-gradient)",
                color: "var(--ink-on-accent)",
                fontFamily: "var(--font-sans)",
                fontWeight: "var(--weight-semibold)",
                fontSize: "var(--text-sm)",
                textDecoration: "none",
              }}
            >
              Stage some adds
            </Link>
            <Link
              href="/compare"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-3)",
                padding: "var(--space-4) var(--space-6)",
                borderRadius: "var(--btn-radius)",
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--ink-secondary)",
                fontFamily: "var(--font-sans)",
                fontWeight: "var(--weight-semibold)",
                fontSize: "var(--text-sm)",
                textDecoration: "none",
              }}
            >
              Compare two imported decks
            </Link>
          </div>
        </div>
      )}

      <ChapterFooter current="compare" />
    </div>
  );
}
