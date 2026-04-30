"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface CardLookupInputProps {
  onCardSelected: (name: string, quantity: number) => string;
  disabled?: boolean;
}

export default function CardLookupInput({
  onCardSelected,
  disabled = false,
}: CardLookupInputProps) {
  const [query, setQuery] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [networkError, setNetworkError] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        setIsOpen(true);
        setActiveIndex(-1);
        setNetworkError(true);
        return;
      }
      const json = (await res.json()) as { suggestions: string[] };
      setSuggestions(json.suggestions);
      // Keep the listbox open even when empty so the user gets the
      // "No cards match" affordance instead of a silently-disappearing UI.
      setIsOpen(true);
      setActiveIndex(-1);
      setNetworkError(false);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setSuggestions([]);
      setIsOpen(true);
      setActiveIndex(-1);
      setNetworkError(true);
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
      setNetworkError(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 300);
  };

  const selectCard = (name: string) => {
    const status = onCardSelected(name, quantity);

    // Show status message
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    setStatusMessage(status);
    statusTimerRef.current = setTimeout(() => {
      setStatusMessage("");
    }, 2000);

    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    setActiveIndex(-1);
    setNetworkError(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Always prevent Enter from bubbling to the form
    if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && activeIndex >= 0 && activeIndex < suggestions.length) {
        selectCard(suggestions[activeIndex]);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (!isOpen || suggestions.length === 0) return;

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
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
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
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return (
    <div>
      <label
        htmlFor="card-lookup-input"
        className="mb-1 block text-sm font-medium text-slate-300"
      >
        Add cards by search
      </label>

      <div ref={containerRef} className="flex gap-2">
        <input
          type="number"
          min={1}
          max={99}
          value={quantity}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val >= 1 && val <= 99) setQuantity(val);
          }}
          aria-label="Card quantity"
          disabled={disabled}
          className="w-16 min-h-[44px] rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-center text-sm text-white focus:border-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 disabled:cursor-not-allowed disabled:opacity-50"
        />

        <div className="relative flex-1">
          <input
            ref={inputRef}
            id="card-lookup-input"
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls="card-lookup-listbox"
            aria-activedescendant={
              activeIndex >= 0
                ? `card-lookup-option-${activeIndex}`
                : undefined
            }
            aria-autocomplete="list"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search for a card to add..."
            disabled={disabled}
            className="w-full min-h-[44px] rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm text-white placeholder-slate-400 focus:border-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 disabled:cursor-not-allowed disabled:opacity-50"
          />

          {loading && (
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-purple-400 motion-reduce:animate-none" />
            </div>
          )}

          {isOpen && (suggestions.length > 0 || !loading) && (
            <ul
              ref={listboxRef}
              id="card-lookup-listbox"
              role="listbox"
              className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-600 bg-slate-800 shadow-lg"
            >
              {suggestions.length > 0 ? (
                suggestions.map((name, i) => (
                  <li
                    key={name}
                    id={`card-lookup-option-${i}`}
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
                ))
              ) : (
                <li
                  role="status"
                  aria-live="polite"
                  className="cursor-default px-4 py-2 text-sm italic text-slate-400"
                >
                  No cards match.
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      <div
        data-testid="card-lookup-status"
        aria-live="polite"
        aria-atomic="true"
        className="mt-1 h-5 text-xs text-emerald-400"
      >
        {statusMessage}
      </div>

      {networkError && (
        <div
          data-testid="card-lookup-error"
          role="alert"
          aria-live="polite"
          className="mt-1 text-xs text-rose-400"
        >
          Couldn&rsquo;t reach Scryfall. Try again.
        </div>
      )}
    </div>
  );
}
