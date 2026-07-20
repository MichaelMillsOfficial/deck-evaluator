"use client";

import { useDeckSession } from "@/contexts/DeckSessionContext";
import { readingRunningHead } from "@/lib/reading-format";
import SectionHeader from "@/components/reading/SectionHeader";
import ChapterFooter from "@/components/reading/ChapterFooter";
import MetaPanel from "@/components/reading/MetaPanel";
import MetaHeatList from "@/components/reading/MetaHeatList";

export default function MetaPage() {
  const { payload } = useDeckSession();
  if (!payload) return null;
  const { deck, cardMap, deckMeta } = payload;

  return (
    <div role="tabpanel" id="tabpanel-meta" aria-labelledby="tab-meta">
      <SectionHeader
        slug="meta"
        runningHead={readingRunningHead(payload.createdAt, deck.name)}
        eyebrow="Meta"
        title="Stock ↔ Spicy"
        tagline="How conventional this deck's card choices are for its commander, read from how often each card shows up in EDHREC's registered decks."
      />
      <MetaPanel />
      {deckMeta && <MetaHeatList meta={deckMeta} cardMap={cardMap} />}
      <ChapterFooter current="meta" />
    </div>
  );
}
