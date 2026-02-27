"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface CommanderInputProps {
  value: string[];
  onChange: (commanders: string[]) => void;
  decklistText: string;
  disabled?: boolean;
}

export default function CommanderInput({
  value,
  onChange,
  decklistText,
  disabled = false,
}: CommanderInputProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Parse card names from decklist text for filtering
  const deckCardNames = useRef<Set<string>>(new Set());
  useEffect(() => {
    const names = new Set<string>();
    for (const line of decklistText.split(/\r?\n/)) {
      const match = line.trim().match(/^\d+x?\s+(.+)$/);
      if (match) names.add(match[1].trim());
    }
    deckCardNames.current = names;
  }, [decklistText]);

  const fetchSuggestions = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/card-autocomplete?q=${encodeURIComponent(q)}`,
        { signal: controller.signal }
      );
      if (!res.ok) {
        setSuggestions([]);
        return;
      }
      const json = (await res.json()) as { suggestions: string[] };
      // Filter to cards that exist in the decklist and aren't already selected
      const selectedSet = new Set(value);
      const filtered = json.suggestions.filter(
        (name) =>
          deckCardNames.current.has(name) && !selectedSet.has(name)
      );
      setSuggestions(filtered);
      setIsOpen(filtered.length > 0);
      setActiveIndex(-1);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 300);
  };

  const selectCommander = (name: string) => {
    onChange([...value, name]);
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const removeCommander = (name: string) => {
    onChange(value.filter((c) => c !== name));
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          selectCommander(suggestions[activeIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target as Node) &&
        listboxRef.current &&
        !listboxRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const isMaxed = value.length >= 2;

  return (
    <div className="mb-4">
      <label
        htmlFor="commander-input"
        className="mb-1 block text-sm font-medium text-slate-300"
      >
        Commander{" "}
        <span className="text-slate-500 font-normal">(optional)</span>
      </label>

      {/* Selected commander tags */}
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2" data-testid="commander-tags">
          {value.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-600/20 px-2.5 py-0.5 text-sm text-purple-300"
            >
              {name}
              <button
                type="button"
                onClick={() => removeCommander(name)}
                disabled={disabled}
                className="ml-1 rounded-sm text-purple-400 hover:text-purple-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                aria-label={`Remove ${name}`}
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Autocomplete input */}
      <div className="relative">
        <input
          ref={inputRef}
          id="commander-input"
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="commander-listbox"
          aria-activedescendant={
            activeIndex >= 0 ? `commander-option-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            isMaxed
              ? "Maximum 2 commanders selected"
              : "Search for a commander..."
          }
          disabled={disabled || isMaxed}
          className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm text-white placeholder-slate-400 focus:border-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 disabled:cursor-not-allowed disabled:opacity-50"
        />

        {loading && (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-purple-400" />
          </div>
        )}

        {isOpen && suggestions.length > 0 && (
          <ul
            ref={listboxRef}
            id="commander-listbox"
            role="listbox"
            className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-600 bg-slate-800 shadow-lg"
          >
            {suggestions.map((name, i) => (
              <li
                key={name}
                id={`commander-option-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                className={`cursor-pointer px-4 py-2 text-sm ${
                  i === activeIndex
                    ? "bg-slate-700 text-white"
                    : "text-slate-200 hover:bg-slate-700"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectCommander(name);
                }}
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-1 text-xs text-slate-500">
        Or include a <code className="text-slate-400">COMMANDER:</code> header
        in your decklist
      </p>
    </div>
  );
}
