"use client";

import { useCallback, useState } from "react";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import { useInteractionAnalysis } from "@/hooks/useInteractionAnalysis";
import SectionHeader from "@/components/reading/SectionHeader";
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

  if (!payload?.cardMap) return null;

  return (
    <section
      role="tabpanel"
      id="tabpanel-deck-interactions"
      aria-labelledby="tab-deck-interactions"
    >
      <SectionHeader
        slug="interactions"
        eyebrow="Interactions"
        title="The Mechanics in Play"
        tagline="Removal, protection, recursion, and chains — derived by compiling oracle text into action graphs."
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
