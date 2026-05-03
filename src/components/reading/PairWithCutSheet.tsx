"use client";

import { useState, useMemo } from "react";
import { Sheet } from "@/components/ui/Sheet";
import type { DeckCard } from "@/lib/types";

interface PairWithCutSheetProps {
  open: boolean;
  /** The name of the add being paired */
  addName: string | null;
  /** Cards available to cut (mainboard, no commanders) */
  mainboard: DeckCard[];
  /** Names already used as cuts in other pairs */
  excludedCutNames: Set<string>;
  /** Called when user selects a cut */
  onPick: (cutName: string) => void;
  /** Called when sheet is closed without picking */
  onClose: () => void;
}

/**
 * PairWithCutSheet — a shared right-side Sheet that lets the user pick which
 * mainboard card to cut for a given pending add.
 *
 * Features:
 * - Local search input to filter the mainboard list
 * - Excludes cards already used as cuts in other pairings
 * - Pressing Escape or clicking the scrim closes the sheet (handled by Sheet)
 * - Focus is restored to the opener button when closed (handled by Sheet)
 */
export default function PairWithCutSheet({
  open,
  addName,
  mainboard,
  excludedCutNames,
  onPick,
  onClose,
}: PairWithCutSheetProps) {
  const [query, setQuery] = useState("");

  const filteredCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mainboard.filter(
      (c) =>
        !excludedCutNames.has(c.name) &&
        (q === "" || c.name.toLowerCase().includes(q))
    );
  }, [mainboard, excludedCutNames, query]);

  const handlePick = (name: string) => {
    onPick(name);
    setQuery("");
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={() => {
        setQuery("");
        onClose();
      }}
      eyebrow={addName ? `Pairing ${addName}` : "Choose a cut"}
      title="Pick a card to cut"
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
        {/* Search input */}
        <div>
          <label
            htmlFor="pair-cut-search"
            style={{
              display: "block",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-eyebrow)",
              letterSpacing: "var(--tracking-eyebrow)",
              color: "var(--ink-tertiary)",
              marginBottom: "var(--space-2)",
            }}
          >
            SEARCH DECK
          </label>
          <input
            id="pair-cut-search"
            type="text"
            placeholder="Filter cards…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            style={{
              width: "100%",
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--ink-primary)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-sm)",
              outline: "none",
            }}
          />
        </div>

        {/* Card list */}
        {filteredCards.length === 0 ? (
          <p
            style={{
              color: "var(--ink-tertiary)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-sm)",
              textAlign: "center",
              padding: "var(--space-8) 0",
            }}
          >
            {query ? "No cards match your search." : "No cards available to cut."}
          </p>
        ) : (
          <ul
            role="list"
            aria-label="Cards to cut"
            style={{ listStyle: "none", padding: 0, margin: 0 }}
          >
            {filteredCards.map((card) => (
              <li key={card.name}>
                <button
                  type="button"
                  onClick={() => handlePick(card.name)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "var(--space-3) var(--space-4)",
                    marginBottom: "var(--space-1)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--ink-primary)",
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-sm)",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "background 100ms ease",
                  }}
                  className="motion-reduce:transition-none"
                >
                  <span>{card.name}</span>
                  {card.quantity > 1 && (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-eyebrow)",
                        color: "var(--ink-tertiary)",
                        marginLeft: "var(--space-2)",
                      }}
                    >
                      ×{card.quantity}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
