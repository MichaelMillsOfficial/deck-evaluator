"use client";

import type { DeckCard, DeckData } from "@/lib/types";

function DeckSection({ title, cards }: { title: string; cards: DeckCard[] }) {
  if (cards.length === 0) return null;

  const totalCards = cards.reduce((sum, c) => sum + c.quantity, 0);

  return (
    <div className="mb-6">
      <h2 className="mb-2 border-b border-gray-200 pb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}{" "}
        <span className="text-xs font-normal text-gray-400">
          ({totalCards})
        </span>
      </h2>
      <ul className="space-y-0.5">
        {cards.map((card) => (
          <li key={card.name} className="flex items-baseline gap-2 text-sm">
            <span className="w-6 shrink-0 text-right font-mono text-gray-500">
              {card.quantity}
            </span>
            <span>{card.name}</span>
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
    <div className="w-full max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold">{deck.name}</h1>
        <p className="mt-0.5 text-xs text-gray-400">
          via{" "}
          <a
            href={deck.url}
            target="_blank"
            rel="noopener noreferrer"
            className="capitalize text-blue-500 hover:underline"
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
