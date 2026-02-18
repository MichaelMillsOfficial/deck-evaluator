"use client";

import { useState, type FormEvent } from "react";

type ImportTab = "manual" | "moxfield" | "archidekt";

interface DeckInputProps {
  onSubmitUrl: (url: string) => void;
  onSubmitText: (text: string) => void;
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
  onSubmitUrl,
  onSubmitText,
  loading,
}: DeckInputProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>("manual");
  const [deckName, setDeckName] = useState("");
  const [format, setFormat] = useState("");
  const [textValue, setTextValue] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = textValue.trim();
    if (!trimmed) return;
    onSubmitText(trimmed);
  };

  const loadExample = () => {
    setTextValue(EXAMPLE_DECKLIST);
    setDeckName("Atraxa Superfriends");
    setFormat("Commander");
  };

  const placeholders: Record<ImportTab, string> = {
    manual:
      "1 Sol Ring\n1 Command Tower\nCOMMANDER:\n1 Atraxa, Praetors' Voice",
    moxfield:
      "Paste your Moxfield export here...\n\n1 Sol Ring\n1 Command Tower",
    archidekt:
      "Paste your Archidekt export here...\n\n1 Sol Ring\n1 Command Tower",
  };

  return (
    <div className="w-full rounded-xl border border-slate-700 bg-slate-800/50 p-6">
      {/* Tab bar */}
      <div className="mb-6 flex rounded-lg bg-slate-900 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-slate-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
            disabled={loading}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Deck Name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            Deck Name
          </label>
          <input
            type="text"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder="Enter deck name"
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
          />
        </div>

        {/* Format (manual tab only) */}
        {activeTab === "manual" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">
              Format
            </label>
            <input
              type="text"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              placeholder="e.g. Commander, Standard, Modern"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading}
            />
          </div>
        )}

        {/* Decklist textarea */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            Decklist
          </label>
          <textarea
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder={placeholders[activeTab]}
            rows={10}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 font-mono text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
            required
            aria-label="Decklist text"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div>
            {activeTab === "manual" && (
              <button
                type="button"
                onClick={loadExample}
                disabled={loading}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Load Example
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !textValue.trim()}
            className="rounded-lg bg-purple-600 px-6 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Loading..." : "Import Deck"}
          </button>
        </div>
      </form>
    </div>
  );
}
