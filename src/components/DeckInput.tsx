"use client";

import { useState, type FormEvent } from "react";

interface DeckInputProps {
  onSubmit: (url: string) => void;
  loading: boolean;
}

export default function DeckInput({ onSubmit, loading }: DeckInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="url"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="https://www.moxfield.com/decks/... or https://archidekt.com/decks/..."
          className="flex-1 rounded border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
          disabled={loading}
          required
          aria-label="Deck URL"
        />
        <button
          type="submit"
          disabled={loading || !inputValue.trim()}
          className="rounded bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Loading..." : "Import Deck"}
        </button>
      </div>
    </form>
  );
}
