"use client";

import type { DeckCard, DeckData, EnrichedCard } from "@/lib/types";
import EnrichedCardRow from "@/components/EnrichedCardRow";
import styles from "./DeckList.module.css";

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
    <div className={styles.section}>
      <h3 className={styles.sectionHeading}>
        {title}
        <span className={styles.sectionCount}>({totalCards})</span>
      </h3>
      <ul className={styles.simpleList}>
        {cards.map((card) => (
          <li key={card.name} className={styles.simpleRow}>
            <span aria-hidden="true" className={styles.simpleQty}>
              {card.quantity}
            </span>
            <span className={styles.simpleName}>
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
    <div className={styles.section}>
      <h3 id={sectionId} className={styles.sectionHeading}>
        {title}
        <span className={styles.sectionCount}>({totalCards})</span>
      </h3>
      <table
        className={styles.table}
        data-testid={`enriched-${title.toLowerCase()}`}
        aria-labelledby={sectionId}
      >
        <thead>
          <tr className={styles.tableHeadRow}>
            <th scope="col" className={styles.thQty}>
              Qty
            </th>
            <th scope="col" className={styles.thCost}>
              Cost
            </th>
            <th scope="col" className={styles.thName}>
              Name
            </th>
            <th scope="col" className={styles.thType}>
              Type
            </th>
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
              <tr key={card.name} className={styles.fallbackRow}>
                <td className={styles.tdQty}>
                  <span className="sr-only">{card.quantity}x </span>
                  {card.quantity}
                </td>
                <td className={styles.tdCost} />
                <td className={styles.tdName}>{card.name}</td>
                <td className={styles.tdType} />
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
  enrichLoading?: boolean;
}

export default function DeckList({ deck, cardMap, enrichLoading }: DeckListProps) {
  return (
    <section data-testid="deck-display" aria-label={`Deck: ${deck.name}`}>
      {enrichLoading && (
        <div role="status" aria-live="polite" className={styles.loadingBanner}>
          <svg
            className={styles.loadingSpinner}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              opacity="0.25"
            />
            <path
              fill="currentColor"
              opacity="0.85"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Enriching card data...
        </div>
      )}

      <DeckSection title="Commander" cards={deck.commanders} cardMap={cardMap} />
      <DeckSection title="Mainboard" cards={deck.mainboard} cardMap={cardMap} />
      <DeckSection title="Sideboard" cards={deck.sideboard} cardMap={cardMap} />
    </section>
  );
}
