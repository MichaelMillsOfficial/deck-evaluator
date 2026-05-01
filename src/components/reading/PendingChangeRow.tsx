"use client";

import { Card } from "@/components/ui/Card";
import { Eyebrow } from "@/components/ui/Eyebrow";
import type { PendingAdd } from "@/contexts/PendingChangesContext";
import type { ReplacementCandidate } from "@/lib/candidate-analysis";

interface PendingChangeRowProps {
  add: PendingAdd;
  /** Replacement suggestions from candidate analysis */
  suggestions: ReplacementCandidate[];
  /** Set of cut names already used by other pairs */
  excludedCutNames: Set<string>;
  /** Called when the user selects a suggestion inline */
  onPickSuggestion: (cutName: string) => void;
  /** Called when user wants to open the full deck picker sheet */
  onOpenPicker: () => void;
  /** Called when user clicks Unpair on a chip-pair */
  onUnpair: () => void;
}

/**
 * PendingChangeRow renders the pairing zone for a single pending add.
 *
 * States:
 * - Unpaired: shows NEEDS PAIRING eyebrow + inline suggestion list + "Pick from your deck" button
 * - Paired: shows a chip-pair button "Adding X → Cutting Y" with an Unpair button
 */
export default function PendingChangeRow({
  add,
  suggestions,
  excludedCutNames,
  onPickSuggestion,
  onOpenPicker,
  onUnpair,
}: PendingChangeRowProps) {
  const isPaired = add.pairedCutName !== undefined;

  if (isPaired) {
    return (
      <div
        data-testid="pending-change-paired"
        style={{ marginTop: "var(--space-3)" }}
      >
        <button
          type="button"
          aria-label={`Adding ${add.name}, cutting ${add.pairedCutName}. Activate to unpair.`}
          onClick={onUnpair}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "var(--space-2) var(--space-4)",
            borderRadius: "var(--radius-lg)",
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            color: "var(--ink-secondary)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-eyebrow)",
            letterSpacing: "var(--tracking-eyebrow)",
            cursor: "pointer",
            transition: "opacity 150ms ease",
          }}
          className="motion-reduce:transition-none"
        >
          <span
            style={{
              color: "var(--ink-primary)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-xs)",
            }}
          >
            Adding
          </span>
          <span
            style={{
              color: "var(--accent)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-xs)",
              fontWeight: "var(--weight-semibold)",
            }}
          >
            {add.name}
          </span>
          <span
            style={{
              color: "var(--ink-secondary)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-xs)",
            }}
          >
            →
          </span>
          <span
            style={{
              color: "var(--ink-primary)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-xs)",
            }}
          >
            Cutting
          </span>
          <span
            style={{
              color: "var(--accent)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-xs)",
              fontWeight: "var(--weight-semibold)",
            }}
          >
            {add.pairedCutName}
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="currentColor"
            style={{ width: 14, height: 14, marginLeft: "var(--space-1)" }}
          >
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
          <span
            style={{
              color: "var(--ink-secondary)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-xs)",
            }}
          >
            Unpair
          </span>
        </button>
      </div>
    );
  }

  // Unpaired state
  const availableSuggestions = suggestions.filter(
    (s) => !excludedCutNames.has(s.cardName)
  );

  const helpId = `${add.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "")}-unpaired-help`;

  return (
    <Card
      data-testid="pending-change-unpaired"
      aria-describedby={helpId}
      style={{ marginTop: "var(--space-4)", padding: "var(--space-4)" }}
    >
      <Eyebrow
        as="span"
        style={{ color: "var(--accent)" }}
        data-testid="needs-pairing-eyebrow"
      >
        NEEDS PAIRING
      </Eyebrow>

      <p
        id={helpId}
        style={{
          marginTop: "var(--space-2)",
          marginBottom: "var(--space-3)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-sm)",
          color: "var(--ink-secondary)",
        }}
      >
        Choose a card to cut, or this add won&apos;t apply to the compare.
      </p>

      {availableSuggestions.length > 0 && (
        <div style={{ marginBottom: "var(--space-3)" }}>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-eyebrow)",
              letterSpacing: "var(--tracking-eyebrow)",
              color: "var(--ink-tertiary)",
              marginBottom: "var(--space-2)",
            }}
          >
            USE A SUGGESTION
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-2)",
            }}
          >
            {availableSuggestions.slice(0, 5).map((s) => (
              <button
                key={s.cardName}
                type="button"
                data-testid="use-suggestion"
                onClick={() => onPickSuggestion(s.cardName)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--space-1)",
                  padding: "var(--space-1) var(--space-3)",
                  borderRadius: "var(--radius-full)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--ink-primary)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-xs)",
                  cursor: "pointer",
                  transition: "opacity 150ms ease",
                }}
                className="motion-reduce:transition-none"
              >
                Cut {s.cardName}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onOpenPicker}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "var(--space-2) var(--space-4)",
          borderRadius: "var(--radius-lg)",
          background: "transparent",
          border: "1px solid var(--border)",
          color: "var(--ink-secondary)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-sm)",
          cursor: "pointer",
          transition: "opacity 150ms ease",
        }}
        className="motion-reduce:transition-none"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{ width: 16, height: 16 }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6.75h12.5M3.75 10h12.5m-12.5 3.25h12.5"
          />
        </svg>
        Pick from your deck
      </button>
    </Card>
  );
}
