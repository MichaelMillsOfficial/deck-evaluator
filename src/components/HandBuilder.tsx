"use client";

import { useCallback, useMemo, useState } from "react";
import type { HandCard, HandEvaluationContext } from "@/lib/opening-hand";
import type { DrawnHand } from "@/lib/opening-hand";
import { evaluateHandQuality } from "@/lib/opening-hand";
import type { MtgColor } from "@/lib/color-distribution";
import ManaCost from "@/components/ManaCost";
import HandDisplay from "@/components/HandDisplay";

interface HandBuilderProps {
  pool: HandCard[];
  commanderIdentity: Set<MtgColor | string>;
  commandZone?: HandCard[];
  context?: HandEvaluationContext;
}

interface UniqueCard {
  name: string;
  maxQuantity: number;
  enriched: HandCard["enriched"];
  isLand: boolean;
}

export default function HandBuilder({
  pool,
  commanderIdentity,
  commandZone = [],
  context,
}: HandBuilderProps) {
  const [selectedCards, setSelectedCards] = useState<Record<string, number>>({});
  const [result, setResult] = useState<DrawnHand | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Deduplicate pool into unique cards with max available quantity
  const uniqueCards: UniqueCard[] = useMemo(() => {
    const map = new Map<string, UniqueCard>();
    for (const card of pool) {
      const existing = map.get(card.name);
      if (existing) {
        existing.maxQuantity++;
      } else {
        map.set(card.name, {
          name: card.name,
          maxQuantity: 1,
          enriched: card.enriched,
          isLand: card.enriched.typeLine.includes("Land"),
        });
      }
    }
    // Sort: lands first, then non-lands by CMC
    return Array.from(map.values()).sort((a, b) => {
      if (a.isLand !== b.isLand) return a.isLand ? -1 : 1;
      if (!a.isLand && !b.isLand) return a.enriched.cmc - b.enriched.cmc;
      return a.name.localeCompare(b.name);
    });
  }, [pool]);

  const totalSelected = useMemo(
    () => Object.values(selectedCards).reduce((sum, n) => sum + n, 0),
    [selectedCards]
  );

  // Filter cards by search query (case-insensitive, matches name or type line)
  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return uniqueCards;
    const q = searchQuery.toLowerCase();
    return uniqueCards.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.enriched.typeLine.toLowerCase().includes(q)
    );
  }, [uniqueCards, searchQuery]);

  const handleIncrement = useCallback(
    (name: string, maxQty: number) => {
      if (totalSelected >= 7) return;
      setSelectedCards((prev) => {
        const current = prev[name] ?? 0;
        if (current >= maxQty) return prev;
        return { ...prev, [name]: current + 1 };
      });
      setResult(null);
    },
    [totalSelected]
  );

  const handleDecrement = useCallback((name: string) => {
    setSelectedCards((prev) => {
      const current = prev[name] ?? 0;
      if (current <= 0) return prev;
      const next = current - 1;
      if (next === 0) {
        const { [name]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [name]: next };
    });
    setResult(null);
  }, []);

  const handleClear = useCallback(() => {
    setSelectedCards({});
    setResult(null);
    setSearchQuery("");
  }, []);

  const handleAnalyze = useCallback(() => {
    // Build HandCard[] from selections
    const hand: HandCard[] = [];
    for (const [name, qty] of Object.entries(selectedCards)) {
      const card = uniqueCards.find((c) => c.name === name);
      if (!card) continue;
      for (let i = 0; i < qty; i++) {
        hand.push({
          name: card.name,
          quantity: card.maxQuantity,
          enriched: card.enriched,
        });
      }
    }

    const mulliganNumber = Math.max(0, 7 - hand.length);
    const quality = evaluateHandQuality(hand, mulliganNumber, commanderIdentity, commandZone, context);
    setResult({ cards: hand, quality, mulliganNumber });
  }, [selectedCards, uniqueCards, commanderIdentity, commandZone, context]);

  return (
    <div data-testid="hand-builder" className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center gap-3">
        <span
          data-testid="selected-count"
          className="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-300"
        >
          {totalSelected} / 7 cards selected
        </span>
        <button
          type="button"
          data-testid="analyze-hand-btn"
          onClick={handleAnalyze}
          disabled={totalSelected === 0}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Analyze Hand
        </button>
        {totalSelected > 0 && (
          <button
            type="button"
            data-testid="clear-selection-btn"
            onClick={handleClear}
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700"
          >
            Clear
          </button>
        )}
      </div>

      {/* Command Zone */}
      {commandZone.length > 0 && (
        <div
          data-testid="hand-builder-command-zone"
          className="rounded-lg border border-purple-500/30 bg-purple-950/20 p-2"
        >
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-purple-400">
            Command Zone (always available)
          </p>
          <div className="flex flex-wrap gap-2">
            {commandZone.map((card, idx) => (
              <div key={`cmd-${card.name}-${idx}`} className="flex items-center gap-1.5">
                <span className="text-xs text-purple-200">{card.name}</span>
                <ManaCost cost={card.enriched.manaCost} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          data-testid="hand-builder-search"
          placeholder="Search cards by name or type..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </div>

      {/* Card picker */}
      <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
        {uniqueCards.length === 0 ? (
          <p className="text-xs text-slate-500">No cards available.</p>
        ) : filteredCards.length === 0 ? (
          <p className="text-xs text-slate-500">
            No cards match &ldquo;{searchQuery}&rdquo;
          </p>
        ) : (
          <>
            {/* Lands section */}
            {filteredCards.some((c) => c.isLand) && (
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Lands
              </p>
            )}
            {filteredCards
              .filter((c) => c.isLand)
              .map((card) => (
                <CardPickerRow
                  key={card.name}
                  card={card}
                  selected={selectedCards[card.name] ?? 0}
                  totalSelected={totalSelected}
                  onIncrement={handleIncrement}
                  onDecrement={handleDecrement}
                />
              ))}

            {/* Non-lands section */}
            {filteredCards.some((c) => !c.isLand) && (
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Non-lands
              </p>
            )}
            {filteredCards
              .filter((c) => !c.isLand)
              .map((card) => (
                <CardPickerRow
                  key={card.name}
                  card={card}
                  selected={selectedCards[card.name] ?? 0}
                  totalSelected={totalSelected}
                  onIncrement={handleIncrement}
                  onDecrement={handleDecrement}
                />
              ))}
          </>
        )}
      </div>

      {/* Result */}
      {result && (
        <div data-testid="hand-builder-result">
          <HandDisplay hand={result} commandZone={commandZone} />
        </div>
      )}
    </div>
  );
}

function CardPickerRow({
  card,
  selected,
  totalSelected,
  onIncrement,
  onDecrement,
}: {
  card: UniqueCard;
  selected: number;
  totalSelected: number;
  onIncrement: (name: string, maxQty: number) => void;
  onDecrement: (name: string) => void;
}) {
  const testId = `card-picker-row-${card.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`;

  return (
    <div
      data-testid={testId}
      className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm text-slate-200">{card.name}</span>
        <ManaCost cost={card.enriched.manaCost} />
        <span className="hidden text-xs text-slate-500 sm:inline">
          {card.enriched.typeLine}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onDecrement(card.name)}
          disabled={selected <= 0}
          aria-label={`Remove ${card.name}`}
          className="flex h-7 w-7 items-center justify-center rounded border border-slate-600 text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          −
        </button>
        <span className="w-8 text-center text-xs text-slate-300">
          {selected}/{card.maxQuantity}
        </span>
        <button
          type="button"
          onClick={() => onIncrement(card.name, card.maxQuantity)}
          disabled={selected >= card.maxQuantity || totalSelected >= 7}
          aria-label={`Add ${card.name}`}
          className="flex h-7 w-7 items-center justify-center rounded border border-slate-600 text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>
    </div>
  );
}
