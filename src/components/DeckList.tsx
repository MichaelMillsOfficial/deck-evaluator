"use client";

import type { DeckCard, DeckData, EnrichedCard } from "@/lib/types";
import EnrichedCardRow from "@/components/EnrichedCardRow";

function DeckSectionSimple({
  title,
  cards,
}: {
  title: string;
  cards: DeckCard[];
}) {
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
        {cards.map((card) => (
          <li
            key={card.name}
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

function DeckSectionEnriched({
  title,
  cards,
  cardMap,
}: {
  title: string;
  cards: DeckCard[];
  cardMap: Record<string, EnrichedCard>;
}) {
  if (cards.length === 0) return null;

  const totalCards = cards.reduce((sum, c) => sum + c.quantity, 0);
  const sectionId = `section-${title.toLowerCase()}`;

  return (
    <div className="mb-6">
      <h3
        id={sectionId}
        className="mb-2 border-b border-slate-700 pb-1 text-sm font-semibold uppercase tracking-wide text-slate-300"
      >
        {title}{" "}
        <span className="text-xs font-normal text-slate-400">
          ({totalCards})
        </span>
      </h3>
      <table className="w-full text-sm" data-testid={`enriched-${title.toLowerCase()}`} aria-labelledby={sectionId}>
        <thead>
          <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
            <th scope="col" className="pb-1 pr-2 w-10 text-right">Qty</th>
            <th scope="col" className="pb-1 px-2 w-24">Cost</th>
            <th scope="col" className="pb-1 px-2">Name</th>
            <th scope="col" className="pb-1 pl-2 hidden sm:table-cell">Type</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => {
            const enriched = cardMap[card.name];
            if (enriched) {
              return (
                <EnrichedCardRow
                  key={card.name}
                  card={enriched}
                  quantity={card.quantity}
                />
              );
            }
            // Fallback for cards not in the map
            return (
              <tr key={card.name} className="border-b border-slate-700/50">
                <td className="py-1.5 pr-2 text-right font-mono text-slate-400 w-10">
                  <span className="sr-only">{card.quantity}x </span>
                  {card.quantity}
                </td>
                <td className="py-1.5 px-2 w-24" />
                <td className="py-1.5 px-2 text-slate-200">{card.name}</td>
                <td className="py-1.5 pl-2 hidden sm:table-cell" />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DeckSection({
  title,
  cards,
  cardMap,
}: {
  title: string;
  cards: DeckCard[];
  cardMap?: Record<string, EnrichedCard> | null;
}) {
  if (cardMap) {
    return <DeckSectionEnriched title={title} cards={cards} cardMap={cardMap} />;
  }
  return <DeckSectionSimple title={title} cards={cards} />;
}

interface DeckListProps {
  deck: DeckData;
  cardMap?: Record<string, EnrichedCard> | null;
}

export default function DeckList({ deck, cardMap }: DeckListProps) {
  const totalCards =
    deck.commanders.reduce((s, c) => s + c.quantity, 0) +
    deck.mainboard.reduce((s, c) => s + c.quantity, 0) +
    deck.sideboard.reduce((s, c) => s + c.quantity, 0);

  return (
    <section
      data-testid="deck-display"
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

      <DeckSection title="Commander" cards={deck.commanders} cardMap={cardMap} />
      <DeckSection title="Mainboard" cards={deck.mainboard} cardMap={cardMap} />
      <DeckSection title="Sideboard" cards={deck.sideboard} cardMap={cardMap} />
    </section>
  );
}
