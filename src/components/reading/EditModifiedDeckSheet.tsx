"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { usePendingChanges } from "@/contexts/PendingChangesContext";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import CardSearchInput from "@/components/CardSearchInput";
import PairWithCutSheet from "@/components/reading/PairWithCutSheet";
import type { DeckData } from "@/lib/types";

interface EditModifiedDeckSheetProps {
  open: boolean;
  modifiedDeck: DeckData;
  onClose: () => void;
}

/**
 * EditModifiedDeckSheet — lets the user remove pending adds from the modified deck
 * or add a new card (which immediately opens PairWithCutSheet to pair it).
 *
 * Per design D6: only allows removing pending ADDS (cards introduced by swaps).
 * To "cut more cards" the user goes to /reading/add and pairs there, OR uses
 * the search input here which routes them to the pair flow inline.
 */
export default function EditModifiedDeckSheet({
  open,
  modifiedDeck,
  onClose,
}: EditModifiedDeckSheetProps) {
  const { confirmedAdds, confirmedCutNames, addCandidate, removeCandidate, pairAdd } =
    usePendingChanges();
  const { payload } = useDeckSession();

  // Name of the add currently pending a pair selection inside this sheet
  const [pendingPairName, setPendingPairName] = useState<string | null>(null);

  const confirmedAddNames = new Set(confirmedAdds.map((a) => a.name));

  // All names already in the deck or pending adds — excluded from the add search
  const deckCardNames = new Set<string>([
    ...(payload?.deck.commanders.map((c) => c.name) ?? []),
    ...(payload?.deck.mainboard.map((c) => c.name) ?? []),
    ...(payload?.deck.sideboard.map((c) => c.name) ?? []),
  ]);
  const allAddNames = new Set(confirmedAdds.map((a) => a.name));

  // Mainboard cards eligible to be cut (no commanders)
  const commanderNames = new Set(
    payload?.deck.commanders.map((c) => c.name) ?? []
  );
  const pickableMainboard = (payload?.deck.mainboard ?? []).filter(
    (c) => !commanderNames.has(c.name)
  );

  const handleRemoveAdd = (addName: string) => {
    removeCandidate(addName);
    if (confirmedAdds.length <= 1) {
      onClose();
    }
  };

  const handleSearchSelect = async (name: string) => {
    await addCandidate(name);
    // Immediately open PairWithCutSheet prefilled for this new add
    setPendingPairName(name);
  };

  const handlePairPick = (cutName: string) => {
    if (pendingPairName) {
      pairAdd(pendingPairName, cutName);
    }
    setPendingPairName(null);
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        eyebrow="Modified Deck"
        title="Edit Modified Deck"
      >
        <div
          style={{
            padding: "var(--space-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
            overflowY: "auto",
            flex: 1,
          }}
        >
          {/* Search-to-add input (Plan D6 / M11) */}
          <div>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-eyebrow)",
                letterSpacing: "var(--tracking-eyebrow)",
                color: "var(--accent)",
                marginBottom: "var(--space-3)",
              }}
            >
              ADD A CARD
            </p>
            <CardSearchInput
              deckCardNames={deckCardNames}
              candidateNames={[...allAddNames]}
              onAddCard={handleSearchSelect}
            />
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-xs)",
                color: "var(--ink-tertiary)",
                marginTop: "var(--space-2)",
              }}
            >
              Picking a card opens the pair-with-cut selector immediately.
            </p>
          </div>

          {/* Info banner */}
          <div
            style={{
              padding: "var(--space-3) var(--space-4)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-sm)",
                color: "var(--ink-secondary)",
                margin: 0,
              }}
            >
              Remove a pending add to un-stage that swap. To cut additional
              cards, go to <strong>Additions</strong> and pair a new add.
            </p>
          </div>

          {/* Pending adds section */}
          {confirmedAdds.length > 0 && (
            <div>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-eyebrow)",
                  letterSpacing: "var(--tracking-eyebrow)",
                  color: "var(--accent)",
                  marginBottom: "var(--space-3)",
                }}
              >
                STAGED SWAPS
              </p>
              <ul
                role="list"
                aria-label="Staged swaps"
                style={{ listStyle: "none", padding: 0, margin: 0 }}
              >
                {confirmedAdds.map((a) => (
                  <li key={a.name}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "var(--space-2) var(--space-3)",
                        marginBottom: "var(--space-1)",
                        borderRadius: "var(--radius-md)",
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-2)",
                          fontFamily: "var(--font-sans)",
                          fontSize: "var(--text-sm)",
                        }}
                      >
                        <span style={{ color: "var(--color-good)" }}>
                          + {a.name}
                        </span>
                        <span style={{ color: "var(--ink-tertiary)" }}>→</span>
                        <span style={{ color: "var(--color-danger)" }}>
                          − {a.pairedCutName}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAdd(a.name)}
                        aria-label={`Remove swap: adding ${a.name}, cutting ${a.pairedCutName}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 28,
                          height: 28,
                          borderRadius: "var(--radius-sm)",
                          background: "transparent",
                          border: "none",
                          color: "var(--ink-tertiary)",
                          cursor: "pointer",
                        }}
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          style={{ width: 16, height: 16 }}
                        >
                          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Modified mainboard preview (read-only) */}
          <div>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-eyebrow)",
                letterSpacing: "var(--tracking-eyebrow)",
                color: "var(--ink-tertiary)",
                marginBottom: "var(--space-3)",
              }}
            >
              MODIFIED MAINBOARD (
              {modifiedDeck.mainboard.reduce((s, c) => s + c.quantity, 0)}{" "}
              cards)
            </p>
            <ul
              role="list"
              aria-label="Modified mainboard"
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                maxHeight: 300,
                overflowY: "auto",
              }}
            >
              {modifiedDeck.mainboard.map((card) => {
                const isNew = confirmedAddNames.has(card.name);
                return (
                  <li
                    key={card.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      padding: "var(--space-1) var(--space-2)",
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-sm)",
                      color: isNew
                        ? "var(--color-good)"
                        : "var(--ink-secondary)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-xs)",
                        color: "var(--ink-tertiary)",
                        minWidth: 20,
                      }}
                    >
                      {card.quantity}×
                    </span>
                    <span>{card.name}</span>
                    {isNew && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--text-eyebrow)",
                          color: "var(--color-good)",
                          marginLeft: "auto",
                        }}
                      >
                        NEW
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </Sheet>

      {/* PairWithCutSheet opened inline after search-select */}
      <PairWithCutSheet
        open={pendingPairName !== null}
        addName={pendingPairName}
        mainboard={pickableMainboard}
        excludedCutNames={confirmedCutNames}
        onPick={handlePairPick}
        onClose={() => setPendingPairName(null)}
      />
    </>
  );
}
