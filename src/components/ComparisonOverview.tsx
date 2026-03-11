"use client";

import { useState } from "react";
import type { CardOverlap } from "@/lib/deck-comparison";

interface ComparisonOverviewProps {
  overlap: CardOverlap;
  labelA: string;
  labelB: string;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

interface CardListProps {
  id: string;
  cards: { name: string; quantityA?: number; quantityB?: number; quantity?: number }[];
  labelA?: string;
  labelB?: string;
}

function CardList({ id, cards, labelA, labelB }: CardListProps) {
  if (cards.length === 0) {
    return (
      <p id={id} className="px-1 py-2 text-sm text-slate-500 italic">
        No cards
      </p>
    );
  }

  return (
    <ul id={id} className="max-h-64 overflow-y-auto divide-y divide-slate-700/50">
      {cards.map((card) => (
        <li key={card.name} className="flex items-center justify-between px-1 py-1.5 text-sm">
          <span className="text-slate-200">{card.name}</span>
          {card.quantity !== undefined && (
            <span className="ml-2 shrink-0 text-slate-400">×{card.quantity}</span>
          )}
          {card.quantityA !== undefined && card.quantityB !== undefined && (
            <span className="ml-2 shrink-0 text-xs text-slate-500">
              <span title={labelA} className="text-purple-400">×{card.quantityA}</span>
              {" / "}
              <span title={labelB} className="text-cyan-400">×{card.quantityB}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function ComparisonOverview({ overlap, labelA, labelB }: ComparisonOverviewProps) {
  const [sharedOpen, setSharedOpen] = useState(false); // collapsed by default
  const [uniqueAOpen, setUniqueAOpen] = useState(true); // expanded by default
  const [uniqueBOpen, setUniqueBOpen] = useState(true); // expanded by default

  const overlapPct = Math.round(overlap.overlapPercentage);

  return (
    <section
      data-testid="comparison-overview"
      aria-labelledby="comparison-overview-heading"
      className="space-y-5"
    >
      <h3
        id="comparison-overview-heading"
        className="text-sm font-semibold uppercase tracking-wide text-slate-400"
      >
        Card Overlap
      </h3>

      {/* Summary stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-center">
          <p
            data-testid="shared-count"
            className="text-2xl font-bold text-purple-400"
          >
            {overlap.sharedCount}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">Shared</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-center">
          <p
            data-testid="unique-a-count"
            className="text-2xl font-bold text-purple-300"
          >
            {overlap.uniqueToACount}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Only in <span className="text-purple-300">{labelA}</span>
          </p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-center">
          <p
            data-testid="unique-b-count"
            className="text-2xl font-bold text-cyan-400"
          >
            {overlap.uniqueToBCount}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Only in <span className="text-cyan-400">{labelB}</span>
          </p>
        </div>
      </div>

      {/* Overlap percentage progress bar */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="text-slate-400">Overlap</span>
          <span className="font-semibold text-white">{overlapPct}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={overlapPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Card overlap: ${overlapPct}%`}
          className="h-2 w-full overflow-hidden rounded-full bg-slate-700"
        >
          <div
            className="h-full rounded-full bg-purple-500 transition-all motion-reduce:transition-none"
            style={{ width: `${overlapPct}%` }}
          />
        </div>
      </div>

      {/* Expandable card lists */}
      <div className="space-y-2">
        {/* Unique to A — expanded by default */}
        <div className="rounded-lg border border-slate-700">
          <button
            type="button"
            aria-expanded={uniqueAOpen}
            aria-controls="unique-a-list"
            onClick={() => setUniqueAOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-white transition-colors hover:bg-slate-700/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded-lg motion-reduce:transition-none"
          >
            <span>
              Only in <span className="text-purple-300">{labelA}</span>
              <span className="ml-2 text-slate-400">({overlap.uniqueToACount})</span>
            </span>
            <ChevronIcon open={uniqueAOpen} />
          </button>
          {uniqueAOpen && (
            <div className="border-t border-slate-700 px-3 py-2">
              <CardList id="unique-a-list" cards={overlap.uniqueToA} />
            </div>
          )}
        </div>

        {/* Unique to B — expanded by default */}
        <div className="rounded-lg border border-slate-700">
          <button
            type="button"
            aria-expanded={uniqueBOpen}
            aria-controls="unique-b-list"
            onClick={() => setUniqueBOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-white transition-colors hover:bg-slate-700/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded-lg motion-reduce:transition-none"
          >
            <span>
              Only in <span className="text-cyan-400">{labelB}</span>
              <span className="ml-2 text-slate-400">({overlap.uniqueToBCount})</span>
            </span>
            <ChevronIcon open={uniqueBOpen} />
          </button>
          {uniqueBOpen && (
            <div className="border-t border-slate-700 px-3 py-2">
              <CardList id="unique-b-list" cards={overlap.uniqueToB} />
            </div>
          )}
        </div>

        {/* Shared cards — collapsed by default */}
        <div className="rounded-lg border border-slate-700">
          <button
            type="button"
            aria-expanded={sharedOpen}
            aria-controls="shared-list"
            onClick={() => setSharedOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-white transition-colors hover:bg-slate-700/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded-lg motion-reduce:transition-none"
          >
            <span>
              Shared cards
              <span className="ml-2 text-slate-400">({overlap.sharedCount})</span>
            </span>
            <ChevronIcon open={sharedOpen} />
          </button>
          {sharedOpen && (
            <div className="border-t border-slate-700 px-3 py-2">
              <CardList
                id="shared-list"
                cards={overlap.shared}
                labelA={labelA}
                labelB={labelB}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
