"use client";

import { useCallback, useMemo, useState } from "react";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import { useInteractionAnalysis } from "@/hooks/useInteractionAnalysis";
import { readingRunningHead } from "@/lib/reading-format";
import SectionHeader, {
  type SectionStat,
} from "@/components/reading/SectionHeader";
import InteractionSection from "@/components/InteractionSection";

export default function InteractionsPage() {
  const { payload } = useDeckSession();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );

  // Lazy: only run when this route is mounted (tab semantics replicated).
  const {
    analysis: interactionAnalysis,
    loading: interactionLoading,
    error: interactionError,
    steps: interactionSteps,
    progress: interactionProgress,
  } = useInteractionAnalysis(payload?.cardMap ?? null, true);

  const toggle = useCallback((id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const stats = useMemo<SectionStat[] | undefined>(() => {
    if (!interactionAnalysis) return undefined;
    const protect = interactionAnalysis.interactions.filter(
      (i) => i.type === "protects"
    ).length;
    const recurs = interactionAnalysis.interactions.filter(
      (i) => i.type === "recurs"
    ).length;
    return [
      {
        label: "Chains",
        value: String(interactionAnalysis.chains.length),
        sub: "multi-step",
        accent: true,
      },
      {
        label: "Protection",
        value: String(protect),
        sub: "interactions",
      },
      {
        label: "Recursion",
        value: String(recurs),
        sub: "loops & graveyard",
      },
    ];
  }, [interactionAnalysis]);

  if (!payload?.cardMap) return null;

  return (
    <section
      role="tabpanel"
      id="tabpanel-deck-interactions"
      aria-labelledby="tab-deck-interactions"
    >
      <SectionHeader
        slug="interactions"
        runningHead={readingRunningHead(payload.createdAt, payload.deck.name)}
        eyebrow="Interactions"
        title="The Mechanics in Play"
        tagline="Removal, protection, recursion, and chains — derived by compiling oracle text into action graphs."
        stats={stats}
      />
      <h2 id="interactions-heading" className="sr-only">
        Card Interactions
      </h2>
      <InteractionSection
        analysis={interactionAnalysis}
        loading={interactionLoading}
        error={interactionError}
        steps={interactionSteps}
        progress={interactionProgress}
        expandedSections={expandedSections}
        onToggleSection={toggle}
      />
    </section>
  );
}
