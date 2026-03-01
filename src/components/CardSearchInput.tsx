"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface CardSearchInputProps {
  deckCardNames: Set<string>;
  candidateNames: string[];
  onAddCard: (name: string) => void;
  disabled?: boolean;
}

export default function CardSearchInput({
  deckCardNames,
  candidateNames,
  onAddCard,
  disabled = false,
}: CardSearchInputProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const excludedNames = useRef(new Set<string>());
  useEffect(() => {
    const excluded = new Set(deckCardNames);
    for (const name of candidateNames) {
      excluded.add(name);
    }
    excludedNames.current = excluded;
  }, [deckCardNames, candidateNames]);

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
      const filtered = json.suggestions.filter(
        (name) => !excludedNames.current.has(name)
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
  }, []);

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

  const selectCard = (name: string) => {
    onAddCard(name);
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    setActiveIndex(-1);
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
          selectCard(suggestions[activeIndex]);
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

  return (
    <div className="mb-4">
      <label
        htmlFor="card-search-input"
        className="mb-1 block text-sm font-medium text-slate-300"
      >
        Search for cards to add
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          id="card-search-input"
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="card-search-listbox"
          aria-activedescendant={
            activeIndex >= 0 ? `card-search-option-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Search for a card..."
          disabled={disabled}
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
            id="card-search-listbox"
            role="listbox"
            className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-600 bg-slate-800 shadow-lg"
          >
            {suggestions.map((name, i) => (
              <li
                key={name}
                id={`card-search-option-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                className={`cursor-pointer px-4 py-2 text-sm ${
                  i === activeIndex
                    ? "bg-slate-700 text-white"
                    : "text-slate-200 hover:bg-slate-700"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectCard(name);
                }}
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
