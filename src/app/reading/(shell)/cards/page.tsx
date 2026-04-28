"use client";

import { useMemo } from "react";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import { readingRunningHead } from "@/lib/reading-format";
import SectionHeader, {
  type SectionStat,
} from "@/components/reading/SectionHeader";
import ChapterFooter from "@/components/reading/ChapterFooter";
import DeckList from "@/components/DeckList";

export default function CardsPage() {
  const { payload, enrichLoading } = useDeckSession();

  const deckRef = payload?.deck;
  const cardMapRef = payload?.cardMap;
  const stats = useMemo<SectionStat[] | undefined>(() => {
    if (!deckRef || !cardMapRef) return undefined;
    const allCards = [...deckRef.commanders, ...deckRef.mainboard, ...deckRef.sideboard];

    let total = 0;
    let lands = 0;
    let nonLandCmcSum = 0;
    let nonLandQty = 0;

    for (const card of allCards) {
      total += card.quantity;
      const enriched = cardMapRef[card.name];
      if (!enriched) continue;
      const isLand = enriched.typeLine?.includes("Land");
      if (isLand) {
        lands += card.quantity;
      } else {
        nonLandCmcSum += enriched.cmc * card.quantity;
        nonLandQty += card.quantity;
      }
    }

    const avgCmc = nonLandQty > 0 ? nonLandCmcSum / nonLandQty : 0;

    return [
      { label: "Total", value: String(total), sub: "cards" },
      { label: "Lands", value: String(lands), sub: "in deck" },
      {
        label: "Avg CMC",
        value: avgCmc.toFixed(1),
        sub: "non-land",
        accent: true,
      },
    ];
  }, [deckRef, cardMapRef]);

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
        runningHead={readingRunningHead(payload.createdAt, deck.name)}
        eyebrow="Deck list"
        title="The Decklist"
        tagline="Every card in the deck, grouped by zone, with the mana cost and the tags the analyzer pinned to it."
        stats={stats}
      />
      <DeckList
        deck={deck}
        cardMap={cardMap}
        enrichLoading={enrichLoading}
      />
      <ChapterFooter current="list" />
    </div>
  );
}
