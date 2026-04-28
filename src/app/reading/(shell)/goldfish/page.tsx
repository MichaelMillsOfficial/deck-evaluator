"use client";

import { useDeckSession } from "@/contexts/DeckSessionContext";
import { readingRunningHead } from "@/lib/reading-format";
import SectionHeader from "@/components/reading/SectionHeader";
import ChapterFooter from "@/components/reading/ChapterFooter";
import GoldfishSimulator from "@/components/GoldfishSimulator";

export default function GoldfishPage() {
  const { payload } = useDeckSession();
  if (!payload?.cardMap) return null;

  return (
    <section
      role="tabpanel"
      id="tabpanel-deck-goldfish"
      aria-labelledby="tab-deck-goldfish"
    >
      <SectionHeader
        slug="goldfish"
        runningHead={readingRunningHead(payload.createdAt, payload.deck.name)}
        eyebrow="Simulation"
        title="Goldfish Reading"
        tagline="Monte Carlo solitaire — mana development and spell casting across a thousand games over ten turns."
      />
      <h2 id="goldfish-heading" className="sr-only">
        Goldfish Simulator
      </h2>
      <GoldfishSimulator deck={payload.deck} cardMap={payload.cardMap} />
      <ChapterFooter current="goldfish" />
    </section>
  );
}
