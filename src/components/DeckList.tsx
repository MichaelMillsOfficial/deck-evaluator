"use client";

import type { DeckCard, DeckData } from "@/lib/types";

function DeckSection({ title, cards }: { title: string; cards: DeckCard[] }) {
  if (cards.length === 0) return null;

  const totalCards = cards.reduce((sum, c) => sum + c.quantity, 0);

  return (
    <div className="mb-6">
      <h2 className="mb-2 border-b border-slate-700 pb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
        {title}{" "}
        <span className="text-xs font-normal text-slate-500">
          ({totalCards})
        </span>
      </h2>
      <ul className="space-y-0.5">
        {cards.map((card) => (
          <li key={card.name} className="flex items-baseline gap-2 text-sm">
            <span className="w-6 shrink-0 text-right font-mono text-slate-500">
              {card.quantity}
            </span>
            <span className="text-slate-200">{card.name}</span>
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
    <div data-testid="deck-display" className="w-full rounded-xl border border-slate-700 bg-slate-800/50 p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">{deck.name}</h1>
        <p className="mt-0.5 text-xs text-slate-400">
          via{" "}
          <a
            href={deck.url}
            target="_blank"
            rel="noopener noreferrer"
            className="capitalize text-purple-400 hover:underline"
          >
            {deck.source}
          </a>
          {" · "}
          {totalCards} cards
        </p>
      </div>

      <DeckSection title="Commander" cards={deck.commanders} />
      <DeckSection title="Mainboard" cards={deck.mainboard} />
      <DeckSection title="Sideboard" cards={deck.sideboard} />
    </div>
  );
}
