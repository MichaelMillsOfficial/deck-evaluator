"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCrucibleSession } from "@/contexts/CrucibleSessionContext";
import { decodeCruciblePile } from "@/lib/crucible-share";
import CosmicLoader from "@/components/ritual/CosmicLoader";
import CrucibleImport from "@/components/crucible/CrucibleImport";
import CrucibleWorkbench from "@/components/crucible/CrucibleWorkbench";
import { Button, Card } from "@/components/ui";

function CruciblePageContent() {
  const {
    hydration,
    payload,
    cardMap,
    enrichError,
    enrichProgress,
    retryEnrichment,
    clearCrucible,
    loadPile,
  } = useCrucibleSession();

  const searchParams = useSearchParams();
  const router = useRouter();
  const sharedParam = searchParams.get("p");

  // Decode a `?p=` shared pile once, then strip the param and load it into a
  // fresh session. Corrupt/foreign links fall back to the import screen with a
  // non-fatal notice.
  const consumedShareRef = useRef(false);
  const [shareState, setShareState] = useState<"idle" | "loading" | "error">(
    sharedParam ? "loading" : "idle"
  );

  useEffect(() => {
    if (!sharedParam || consumedShareRef.current) return;
    consumedShareRef.current = true;
    void (async () => {
      const decoded = await decodeCruciblePile(sharedParam);
      router.replace("/crucible");
      if (!decoded) {
        setShareState("error");
        return;
      }
      loadPile(decoded);
      setShareState("idle");
    })();
  }, [sharedParam, router, loadPile]);

  if (shareState === "loading") {
    return <CosmicLoader tagline="Unsealing the shared pile." />;
  }

  if (hydration === "pending") return null;

  if (!payload) {
    return (
      <>
        {shareState === "error" ? (
          <div
            role="status"
            data-testid="crucible-share-notice"
            style={{
              maxWidth: 720,
              margin: "0 auto",
              padding: "var(--space-8) var(--space-12) 0",
              color: "var(--status-warn)",
              fontSize: "var(--text-sm)",
            }}
          >
            That shared pile link was invalid or corrupted. Import a pile to
            begin.
          </div>
        ) : null}
        <CrucibleImport />
      </>
    );
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

export default function CruciblePage() {
  return (
    <Suspense fallback={null}>
      <CruciblePageContent />
    </Suspense>
  );
}
