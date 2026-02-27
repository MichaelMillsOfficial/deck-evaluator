"use client";

import { useState } from "react";
import type { CardPriceEntry } from "@/lib/budget-analysis";
import { formatUSD } from "@/lib/budget-analysis";

interface TopExpensiveCardsTableProps {
  cards: CardPriceEntry[];
}

const DEFAULT_SHOW = 10;

export default function TopExpensiveCardsTable({
  cards,
}: TopExpensiveCardsTableProps) {
  const [showAll, setShowAll] = useState(false);

  if (cards.length === 0) {
    return (
      <p className="text-sm text-slate-400">No cards with price data.</p>
    );
  }

  const visible = showAll ? cards : cards.slice(0, DEFAULT_SHOW);
  const hasMore = cards.length > DEFAULT_SHOW;

  return (
    <div data-testid="budget-top-expensive">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 text-xs uppercase tracking-wide text-slate-400">
            <th scope="col" className="py-2 pr-2 text-right">#</th>
            <th scope="col" className="py-2 px-2 text-left">Card Name</th>
            <th scope="col" className="py-2 px-2 text-right">Qty</th>
            <th scope="col" className="py-2 px-2 text-right">Unit Price</th>
            <th scope="col" className="py-2 pl-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((entry, i) => (
            <tr
              key={entry.name}
              className={`border-b border-slate-700/50 ${
                i % 2 === 1 ? "bg-slate-800/30" : ""
              }`}
            >
              <td className="py-1.5 pr-2 text-right font-mono text-slate-500">
                {i + 1}
              </td>
              <td className="py-1.5 px-2 text-slate-200">{entry.name}</td>
              <td className="py-1.5 px-2 text-right font-mono text-slate-400">
                {entry.quantity}
              </td>
              <td className="py-1.5 px-2 text-right font-mono text-slate-400">
                {formatUSD(entry.unitPrice)}
              </td>
              <td className="py-1.5 pl-2 text-right font-mono text-white">
                {formatUSD(entry.totalPrice)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-xs text-purple-400 hover:text-purple-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded-sm"
          data-testid="budget-show-all-toggle"
        >
          {showAll
            ? "Show top 10"
            : `Show all ${cards.length} cards`}
        </button>
      )}
    </div>
  );
}
