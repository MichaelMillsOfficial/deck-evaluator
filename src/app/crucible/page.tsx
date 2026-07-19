"use client";

import { useCrucibleSession } from "@/contexts/CrucibleSessionContext";
import CosmicLoader from "@/components/ritual/CosmicLoader";
import CrucibleImport from "@/components/crucible/CrucibleImport";
import CrucibleWorkbench from "@/components/crucible/CrucibleWorkbench";
import { Button, Card } from "@/components/ui";

export default function CruciblePage() {
  const {
    hydration,
    payload,
    cardMap,
    enrichError,
    enrichProgress,
    retryEnrichment,
    clearCrucible,
  } = useCrucibleSession();

  if (hydration === "pending") return null;

  if (!payload) {
    return <CrucibleImport />;
  }

  if (enrichError) {
    return (
      <main style={{ maxWidth: 560, margin: "0 auto", padding: "var(--space-16)" }}>
        <Card
          variant="outline"
          eyebrow="THE CRUCIBLE"
          title="The pile resisted the reading"
        >
          <p style={{ color: "var(--ink-secondary)", marginBottom: "var(--space-8)" }}>
            {enrichError}
          </p>
          <div style={{ display: "flex", gap: "var(--space-6)" }}>
            <Button variant="primary" onClick={retryEnrichment}>
              Try again
            </Button>
            <Button variant="ghost" onClick={clearCrucible}>
              Start over
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  if (cardMap === null) {
    const { done, total } = enrichProgress;
    const tagline =
      total > 1
        ? `The pile is being weighed — part ${Math.min(done + 1, total)} of ${total}.`
        : "The pile is being weighed.";
    return <CosmicLoader tagline={tagline} />;
  }

  return <CrucibleWorkbench />;
}
