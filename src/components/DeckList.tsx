"use client";

import type { DeckCard, DeckData } from "@/lib/types";

function DeckSection({ title, cards }: { title: string; cards: DeckCard[] }) {
  if (cards.length === 0) return null;

  const totalCards = cards.reduce((sum, c) => sum + c.quantity, 0);

  return (
    <div className="mb-6">
      <h3 className="mb-2 border-b border-slate-700 pb-1 text-sm font-semibold uppercase tracking-wide text-slate-300">
        {title}{" "}
        <span className="text-xs font-normal text-slate-400">
          ({totalCards})
        </span>
      </h3>
      <ul className="space-y-0.5">
        {cards.map((card, index) => (
          <li
            key={`${card.name}-${index}`}
            className="flex items-baseline gap-2 text-sm min-w-0"
          >
            <span
              aria-hidden="true"
              className="w-6 shrink-0 text-right font-mono text-slate-400"
            >
              {card.quantity}
            </span>
            <span className="text-slate-200 min-w-0 truncate">
              <span className="sr-only">{card.quantity}x </span>
              {card.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DeckList({ deck }: { deck: DeckData }) {
  const totalCards =
    deck.commanders.reduce((s, c) => s + c.quantity, 0) +
    deck.mainboard.reduce((s, c) => s + c.quantity, 0) +
    deck.sideboard.reduce((s, c) => s + c.quantity, 0);

  return (
    <section
      aria-label={`Deck: ${deck.name}`}
      className="w-full rounded-xl border border-slate-700 bg-slate-800/50 p-6"
    >
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">{deck.name}</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          via{" "}
          {deck.url ? (
            <a
              href={deck.url}
              target="_blank"
              rel="noopener noreferrer"
              className="capitalize text-purple-400 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400 rounded-sm"
            >
              {deck.source}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <span className="capitalize text-purple-400">{deck.source}</span>
          )}
          {" \u00b7 "}
          {totalCards} cards
        </p>
      </div>

      <DeckSection title="Commander" cards={deck.commanders} />
      <DeckSection title="Mainboard" cards={deck.mainboard} />
      <DeckSection title="Sideboard" cards={deck.sideboard} />
    </section>
  );
}
