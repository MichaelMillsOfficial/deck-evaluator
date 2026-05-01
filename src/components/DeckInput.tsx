"use client";

import { useState, useRef, useCallback, type FormEvent } from "react";
import CommanderInput from "@/components/CommanderInput";
import CardLookupInput from "@/components/CardLookupInput";
import ArchidektSynopsis from "@/components/ArchidektSynopsis";
import { Button, Input, Textarea } from "@/components/ui";
import { isArchidektUrl } from "@/lib/archidekt";
import type { DeckData } from "@/lib/types";
import styles from "./DeckInput.module.css";

type ImportTab = "manual" | "moxfield" | "archidekt";

/**
 * "navigate" — DeckInput owns the Archidekt fetch and surfaces a synopsis;
 *   on Continue it calls onConfirmArchidektDeck so the parent can persist
 *   the deck and route forward.
 * "inline"   — Legacy behavior: DeckInput just passes the URL string up via
 *   onSubmitUrl and does not show a synopsis. Used by CompareImportSlot
 *   which expects the URL submit to flow into its own enrichment pipeline.
 */
export type DeckInputMode = "navigate" | "inline";

interface DeckInputProps {
  /**
   * Called when the user submits a URL in inline mode. Required when
   * mode === "inline" (the parent owns the fetch + state). In navigate
   * mode the URL is fetched inside DeckInput, so this is unused.
   */
  onSubmitUrl?: (url: string) => void | Promise<void>;
  onSubmitText: (text: string, commanders?: string[]) => void | Promise<void>;
  /**
   * Called when the user confirms an Archidekt deck from the synopsis card.
   * Required when mode === "navigate".
   */
  onConfirmArchidektDeck?: (deck: DeckData, warnings: string[]) => void;
  loading: boolean;
  mode?: DeckInputMode;
}

const EXAMPLE_DECKLIST = `COMMANDER:
1 Atraxa, Praetors' Voice

1 Sol Ring
1 Command Tower
1 Arcane Signet
1 Swords to Plowshares
1 Counterspell
1 Cultivate
1 Kodama's Reach
1 Beast Within
1 Anguished Unmaking
1 Deepglow Skate`;

const tabs: { key: ImportTab; label: string }[] = [
  { key: "manual", label: "Manual Import" },
  { key: "moxfield", label: "Moxfield" },
  { key: "archidekt", label: "Archidekt" },
];

export default function DeckInput({
  onSubmitUrl,
  onSubmitText,
  onConfirmArchidektDeck,
  loading,
  mode = "navigate",
}: DeckInputProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>("manual");
  const [textValue, setTextValue] = useState("");
  const [commanders, setCommanders] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Archidekt URL flow state (only used when mode === "navigate")
  const [archidektUrl, setArchidektUrl] = useState("");
  const [archidektDeck, setArchidektDeck] = useState<DeckData | null>(null);
  const [archidektWarnings, setArchidektWarnings] = useState<string[]>([]);
  const [archidektError, setArchidektError] = useState<string | null>(null);
  const [archidektLoading, setArchidektLoading] = useState(false);

  const handleCardLookup = useCallback(
    (name: string, quantity: number): string => {
      const cardLineRe = /^(\d+)x?\s+(.+)$/;
      const zoneLineRe = /^(commander|sideboard|mainboard|companion):?\s*$/i;
      let statusMsg = `Added ${quantity} ${name}`;

      setTextValue((prev) => {
        if (!prev) return `${quantity} ${name}`;

        const lines = prev.split("\n");

        // Determine the last zone header and track which zone each line is in,
        // so we only consolidate cards within the mainboard zone.
        let lastZone: string | null = null;
        const lineZones: (string | null)[] = [];
        for (let i = 0; i < lines.length; i++) {
          const zm = lines[i].trim().match(zoneLineRe);
          if (zm) lastZone = zm[1].toLowerCase();
          lineZones[i] = lastZone;
        }

        // Only consolidate if the matching card is in mainboard (or no headers)
        for (let i = 0; i < lines.length; i++) {
          const zone = lineZones[i];
          if (zone !== null && zone !== "mainboard") continue;
          const match = lines[i].match(cardLineRe);
          if (match && match[2].toLowerCase() === name.toLowerCase()) {
            const newQty = parseInt(match[1], 10) + quantity;
            lines[i] = `${newQty} ${name}`;
            statusMsg = `Updated ${name} to ${newQty}`;
            return lines.join("\n");
          }
        }

        // If the last zone in the textarea is sideboard or commander,
        // insert a MAINBOARD: header before appending.
        const tailZone = lastZone;
        const needsHeader =
          tailZone === "sideboard" ||
          tailZone === "commander" ||
          tailZone === "companion";

        if (needsHeader) {
          statusMsg = `Added ${quantity} ${name} (mainboard)`;
          const suffix = `\n\nMAINBOARD:\n${quantity} ${name}`;
          return prev.endsWith("\n")
            ? prev.trimEnd() + suffix
            : prev + suffix;
        }

        // Append as new line
        return prev.endsWith("\n")
          ? prev + `${quantity} ${name}`
          : prev + `\n${quantity} ${name}`;
      });

      // Scroll textarea to bottom after React renders
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });

      return statusMsg;
    },
    []
  );

  const handleTextSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = textValue.trim();
    if (!trimmed) return;
    onSubmitText(trimmed, commanders.length > 0 ? commanders : undefined);
  };

  const handleArchidektSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = archidektUrl.trim();
    if (!trimmed) return;

    if (mode === "inline") {
      // Legacy path: parent handles fetch + state.
      onSubmitUrl?.(trimmed);
      return;
    }

    if (!isArchidektUrl(trimmed)) {
      setArchidektError(
        "Please enter a valid Archidekt deck URL (https://archidekt.com/decks/<id>)."
      );
      return;
    }

    setArchidektLoading(true);
    setArchidektError(null);

    try {
      const res = await fetch(
        `/api/deck?url=${encodeURIComponent(trimmed)}`
      );
      const json = await res.json();

      if (!res.ok) {
        setArchidektError(
          json.error ?? `Request failed with status ${res.status}`
        );
        setArchidektLoading(false);
        return;
      }

      const { warnings, ...deckFields } = json as DeckData & {
        warnings?: string[];
      };
      const deck = deckFields as DeckData;
      setArchidektDeck(deck);
      setArchidektWarnings(warnings ?? []);
      setArchidektLoading(false);
    } catch (err) {
      setArchidektError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again."
      );
      setArchidektLoading(false);
    }
  };

  const handleArchidektContinue = () => {
    if (archidektDeck && onConfirmArchidektDeck) {
      onConfirmArchidektDeck(archidektDeck, archidektWarnings);
    }
  };

  const handleArchidektReset = () => {
    setArchidektDeck(null);
    setArchidektWarnings([]);
    setArchidektError(null);
    setArchidektUrl("");
  };

  const loadExample = () => {
    setTextValue(EXAMPLE_DECKLIST);
    setCommanders([]);
  };

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    // Mirror the disabled state on the tab buttons: don't allow keyboard
    // arrow / Home / End nav while a fetch is in flight, otherwise the
    // user could leave the Archidekt tab mid-request and trigger a state
    // update against an unmounted form.
    if (loading || archidektLoading) return;

    const tabKeys = tabs.map((t) => t.key);
    const currentIndex = tabKeys.indexOf(activeTab);
    let newIndex = currentIndex;

    if (e.key === "ArrowRight") {
      newIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === "ArrowLeft") {
      newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === "Home") {
      newIndex = 0;
    } else if (e.key === "End") {
      newIndex = tabs.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    setActiveTab(tabKeys[newIndex]);

    const nextButton = document.getElementById(`tab-${tabKeys[newIndex]}`);
    nextButton?.focus();
  };

  const placeholders: Record<ImportTab, string> = {
    manual:
      "COMMANDER:\n1 Atraxa, Praetors' Voice\n\n1 Sol Ring\n1 Command Tower",
    moxfield:
      "Paste your Moxfield export here...\n\n1 Sol Ring\n1 Command Tower",
    archidekt:
      "Paste your Archidekt export here...\n\n1 Sol Ring\n1 Command Tower",
  };

  const isArchidektTab = activeTab === "archidekt";
  const showArchidektSynopsis =
    isArchidektTab && mode === "navigate" && archidektDeck !== null;

  return (
    <section aria-label="Deck import" className={styles.panel}>
      {/* Tab bar */}
      <div role="tablist" aria-label="Deck import method" className={styles.tabBar}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            id={`tab-${tab.key}`}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`tabpanel-${tab.key}`}
            tabIndex={activeTab === tab.key ? 0 : -1}
            type="button"
            onClick={() => {
              setActiveTab(tab.key);
              setCommanders([]);
              // Reset Archidekt state when leaving the tab
              if (tab.key !== "archidekt") {
                setArchidektDeck(null);
                setArchidektWarnings([]);
                setArchidektError(null);
              }
            }}
            onKeyDown={handleTabKeyDown}
            className={styles.tab}
            disabled={loading || archidektLoading}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {showArchidektSynopsis && archidektDeck ? (
          <ArchidektSynopsis
            deck={archidektDeck}
            loading={loading}
            onContinue={handleArchidektContinue}
            onChooseAnother={handleArchidektReset}
          />
        ) : isArchidektTab ? (
            <form
              onSubmit={handleArchidektSubmit}
              aria-busy={archidektLoading || loading}
              className={styles.form}
            >
              <div
                data-testid="archidekt-import-guide"
                className={styles.guide}
              >
                <p className={styles.guideTitle}>
                  How to import from Archidekt
                </p>
                <ol className={styles.guideList}>
                  <li>
                    Open your deck on{" "}
                    <span className={styles.guideAccent}>archidekt.com</span>
                  </li>
                  <li>
                    Copy the URL from your browser
                    {" "}(<span className={styles.guideAccent}>
                      https://archidekt.com/decks/&lt;id&gt;
                    </span>
                    )
                  </li>
                  <li>Paste it below and press Import Deck</li>
                </ol>
              </div>

              <div>
                <label htmlFor="archidekt-url" className={styles.label}>
                  Archidekt deck URL
                </label>
                <Input
                  id="archidekt-url"
                  type="url"
                  inputMode="url"
                  value={archidektUrl}
                  onChange={(e) => setArchidektUrl(e.target.value)}
                  placeholder="https://archidekt.com/decks/123456"
                  disabled={archidektLoading}
                  required
                  invalid={!!archidektError}
                />
              </div>

              {archidektError && (
                <p
                  role="alert"
                  data-testid="archidekt-error"
                  className={styles.inlineError}
                >
                  {archidektError}
                </p>
              )}

              <div className={styles.actions}>
                <div className={styles.actionsLeft} />
                <Button
                  type="submit"
                  variant="primary"
                  disabled={
                    archidektLoading || loading || !archidektUrl.trim()
                  }
                >
                  {archidektLoading || loading ? "Loading..." : "Import Deck"}
                </Button>
              </div>
            </form>
        ) : (
          <form
            onSubmit={handleTextSubmit}
            aria-busy={loading}
            className={styles.form}
          >
            {/* Moxfield export instructions */}
            {activeTab === "moxfield" && (
              <div data-testid="moxfield-export-guide" className={styles.guide}>
                <p className={styles.guideTitle}>How to import from Moxfield</p>
                <ol className={styles.guideList}>
                  <li>
                    Open your deck on{" "}
                    <span className={styles.guideAccent}>moxfield.com</span>
                  </li>
                  <li>
                    Click <strong>Export</strong> →{" "}
                    <strong>Copy for MTGO</strong>
                  </li>
                  <li>Paste the copied text below</li>
                </ol>
              </div>
            )}

            {/* Commander input (optional — hidden on Moxfield tab since MTGO export includes commanders) */}
            {activeTab !== "moxfield" && (
              <CommanderInput
                value={commanders}
                onChange={setCommanders}
                disabled={loading}
              />
            )}

            {/* Card lookup (manual tab only) */}
            {activeTab === "manual" && (
              <CardLookupInput
                onCardSelected={handleCardLookup}
                disabled={loading}
              />
            )}

            {/* Zone format guide (manual tab only) */}
            {activeTab === "manual" && (
              <details
                data-testid="zone-format-guide"
                className={styles.zoneGuide}
              >
                <summary className={styles.zoneSummary}>
                  Zone headers &amp; decklist format
                </summary>
                <div className={styles.zoneBody}>
                  <p>
                    You can optionally organize your decklist into zones using
                    headers. Each header marks the start of a section — all
                    cards below it belong to that zone until the next header.
                  </p>
                  <ul>
                    <li>
                      <code>COMMANDER:</code> — your commander(s), max 2
                    </li>
                    <li>
                      <code>MAINBOARD:</code> — the main deck (default if no
                      header)
                    </li>
                    <li>
                      <code>SIDEBOARD:</code> — sideboard cards
                    </li>
                    <li>
                      <code>COMPANION:</code> — treated as sideboard
                    </li>
                  </ul>
                  <p>
                    Cards added via search are always placed in the mainboard.
                    If no headers are used, all cards default to mainboard. You
                    can also select your commander using the input above
                    instead of a <code>COMMANDER:</code> header.
                  </p>
                </div>
              </details>
            )}

            {/* Decklist textarea */}
            <div>
              <label htmlFor="decklist" className={styles.label}>
                Decklist
              </label>
              <Textarea
                ref={textareaRef}
                id="decklist"
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                placeholder={placeholders[activeTab]}
                rows={10}
                mono
                disabled={loading}
                required
              />
            </div>

            {/* Actions */}
            <div className={styles.actions}>
              <div className={styles.actionsLeft}>
                {activeTab === "manual" && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={loadExample}
                    disabled={loading}
                  >
                    Load Example
                  </Button>
                )}
              </div>
              <Button
                type="submit"
                variant="primary"
                disabled={loading || !textValue.trim()}
              >
                {loading ? "Loading..." : "Import Deck"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
