"use client";

import { Sheet } from "@/components/ui/Sheet";
import { usePendingChanges } from "@/contexts/PendingChangesContext";
import type { DeckData } from "@/lib/types";

interface EditModifiedDeckSheetProps {
  open: boolean;
  modifiedDeck: DeckData;
  onClose: () => void;
}

/**
 * EditModifiedDeckSheet — lets the user remove pending adds from the modified deck.
 *
 * Per design D6: only allows removing pending ADDS (cards introduced by swaps).
 * To "cut more cards" the user goes to /reading/add and pairs there.
 * The original mainboard cards (minus cuts) are shown read-only.
 */
export default function EditModifiedDeckSheet({
  open,
  modifiedDeck,
  onClose,
}: EditModifiedDeckSheetProps) {
  const { adds, confirmedAdds, removeCandidate } = usePendingChanges();

  const confirmedAddNames = new Set(confirmedAdds.map((a) => a.name));

  const handleRemoveAdd = (addName: string) => {
    removeCandidate(addName);
    // If no more adds, close the sheet
    if (confirmedAdds.length <= 1) {
      onClose();
    }
  };

  return (
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
            Remove a pending add to un-stage that swap. To cut additional cards,
            go to <strong>Additions</strong> and pair a new add.
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
                      <span style={{ color: "var(--color-emerald, #10b981)" }}>
                        + {a.name}
                      </span>
                      <span style={{ color: "var(--ink-tertiary)" }}>→</span>
                      <span style={{ color: "var(--color-red, #ef4444)" }}>
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
            MODIFIED MAINBOARD ({modifiedDeck.mainboard.reduce((s, c) => s + c.quantity, 0)} cards)
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
                    color: isNew ? "var(--color-emerald, #10b981)" : "var(--ink-secondary)",
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
                        color: "var(--color-emerald, #10b981)",
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
  );
}
