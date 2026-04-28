"use client";

import { useDeckSession } from "@/contexts/DeckSessionContext";
import SectionHeader from "@/components/reading/SectionHeader";
import DeckList from "@/components/DeckList";

export default function CardsPage() {
  const { payload, enrichLoading } = useDeckSession();
  if (!payload) return null;
  const { deck, cardMap } = payload;

  return (
    <div
      role="tabpanel"
      id="tabpanel-deck-list"
      aria-labelledby="tab-deck-list"
    >
      <SectionHeader
        slug="cards"
        eyebrow="Cards"
        title="The Decklist"
        tagline="Every card grouped by zone with mana cost and tags."
      />
      <DeckList
        deck={deck}
        cardMap={cardMap}
        enrichLoading={enrichLoading}
      />
    </div>
  );
}
