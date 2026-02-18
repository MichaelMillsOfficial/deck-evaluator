"use client";

import { useState, type FormEvent } from "react";

type InputMode = "url" | "text";

interface DeckInputProps {
  onSubmitUrl: (url: string) => void;
  onSubmitText: (text: string) => void;
  loading: boolean;
}

export default function DeckInput({ onSubmitUrl, onSubmitText, loading }: DeckInputProps) {
  const [mode, setMode] = useState<InputMode>("url");
  const [urlValue, setUrlValue] = useState("");
  const [textValue, setTextValue] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (mode === "url") {
      const trimmed = urlValue.trim();
      if (!trimmed) return;
      onSubmitUrl(trimmed);
    } else {
      const trimmed = textValue.trim();
      if (!trimmed) return;
      onSubmitText(trimmed);
    }
  };

  const activeTab = "border-blue-600 text-blue-600";
  const inactiveTab = "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300";

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="mb-3 flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${mode === "url" ? activeTab : inactiveTab}`}
          disabled={loading}
        >
          Import URL
        </button>
        <button
          type="button"
          onClick={() => setMode("text")}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${mode === "text" ? activeTab : inactiveTab}`}
          disabled={loading}
        >
          Paste Decklist
        </button>
      </div>

      {mode === "url" ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="url"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            placeholder="https://archidekt.com/decks/..."
            className="flex-1 rounded border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={loading}
            required
            aria-label="Deck URL"
          />
          <button
            type="submit"
            disabled={loading || !urlValue.trim()}
            className="rounded bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading..." : "Import Deck"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <textarea
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder={"1 Sol Ring\n1 Command Tower\nCOMMANDER:\n1 Atraxa, Praetors' Voice"}
            rows={10}
            className="w-full rounded border border-gray-300 px-4 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={loading}
            required
            aria-label="Decklist text"
          />
          <button
            type="submit"
            disabled={loading || !textValue.trim()}
            className="self-end rounded bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading..." : "Parse Decklist"}
          </button>
        </div>
      )}
    </form>
  );
}
