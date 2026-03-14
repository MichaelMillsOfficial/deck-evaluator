"use client";

import { useState, useRef, useCallback, type FormEvent } from "react";
import CommanderInput from "@/components/CommanderInput";
import CardLookupInput from "@/components/CardLookupInput";

type ImportTab = "manual" | "moxfield" | "archidekt";

interface DeckInputProps {
  onSubmitUrl: (url: string) => void | Promise<void>;
  onSubmitText: (text: string, commanders?: string[]) => void | Promise<void>;
  loading: boolean;
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
  onSubmitText,
  loading,
}: DeckInputProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>("manual");
  const [textValue, setTextValue] = useState("");
  const [commanders, setCommanders] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = textValue.trim();
    if (!trimmed) return;
    onSubmitText(trimmed, commanders.length > 0 ? commanders : undefined);
  };

  const loadExample = () => {
    setTextValue(EXAMPLE_DECKLIST);
    setCommanders([]);
  };

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
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

  return (
    <section
      aria-label="Deck import"
      className="w-full rounded-xl border border-slate-700 bg-slate-800/50 p-6"
    >
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Deck import method"
        className="mb-6 flex rounded-lg bg-slate-900 p-1"
      >
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
            }}
            onKeyDown={handleTabKeyDown}
            className={`flex-1 min-h-[44px] rounded-md px-3 py-2.5 sm:px-4 sm:py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
              activeTab === tab.key
                ? "bg-slate-600 text-white"
                : "text-slate-300 hover:text-white"
            }`}
            disabled={loading}
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
        <form
          onSubmit={handleSubmit}
          aria-busy={loading}
          className="flex flex-col gap-4"
        >
          {/* Moxfield export instructions */}
          {activeTab === "moxfield" && (
            <div
              data-testid="moxfield-export-guide"
              className="rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 text-sm text-slate-300"
            >
              <p className="mb-2 font-medium text-white">
                How to import from Moxfield:
              </p>
              <ol className="list-inside list-decimal space-y-1 text-slate-400">
                <li>
                  Open your deck on{" "}
                  <span className="text-purple-400">moxfield.com</span>
                </li>
                <li>
                  Click <strong className="text-slate-300">Export</strong> →{" "}
                  <strong className="text-slate-300">Copy for MTGO</strong>
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
              className="rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2 text-sm text-slate-400"
            >
              <summary className="cursor-pointer select-none font-medium text-slate-300 hover:text-white">
                Zone headers &amp; decklist format
              </summary>
              <div className="mt-2 space-y-2">
                <p>
                  You can optionally organize your decklist into zones using
                  headers. Each header marks the start of a section — all cards
                  below it belong to that zone until the next header.
                </p>
                <ul className="list-inside list-disc space-y-1 text-slate-400">
                  <li>
                    <code className="text-purple-400">COMMANDER:</code> — your
                    commander(s), max 2
                  </li>
                  <li>
                    <code className="text-purple-400">MAINBOARD:</code> — the
                    main deck (default if no header)
                  </li>
                  <li>
                    <code className="text-purple-400">SIDEBOARD:</code> — sideboard
                    cards
                  </li>
                  <li>
                    <code className="text-purple-400">COMPANION:</code> — treated
                    as sideboard
                  </li>
                </ul>
                <p>
                  Cards added via search are always placed in the mainboard.
                  If no headers are used, all cards default to mainboard.
                  You can also select your commander using the input above
                  instead of a <code className="text-purple-400">COMMANDER:</code>{" "}
                  header.
                </p>
              </div>
            </details>
          )}

          {/* Decklist textarea */}
          <div>
            <label
              htmlFor="decklist"
              className="mb-1 block text-sm font-medium text-slate-300"
            >
              Decklist
            </label>
            <textarea
              ref={textareaRef}
              id="decklist"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder={placeholders[activeTab]}
              rows={10}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 font-mono text-sm text-white placeholder-slate-400 focus:border-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading}
              required
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              {activeTab === "manual" && (
                <button
                  type="button"
                  onClick={loadExample}
                  disabled={loading}
                  className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Load Example
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !textValue.trim()}
              className="rounded-lg bg-purple-600 px-6 py-2 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Loading..." : "Import Deck"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
