"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import CosmicLoader from "@/components/ritual/CosmicLoader";

/** Minimum visible time for the ritual loader, in milliseconds. Even when
 * enrichment finishes faster (e.g. cached or mocked), the loader holds for
 * this long so the transition feels deliberate rather than flickered. */
const MIN_RITUAL_MS = 2000;

declare global {
  interface Window {
    /** Test-only escape hatch. When `true` (set via Playwright's
     * `addInitScript` in the fixture), the ritual minimum floor is bypassed
     * so e2e suites don't pay 2s on every import. Real users always see the
     * full ritual. */
    __SKIP_RITUAL_FLOOR__?: boolean;
  }
}

function getFloorMs(): number {
  if (typeof window === "undefined") return MIN_RITUAL_MS;
  return window.__SKIP_RITUAL_FLOOR__ ? 0 : MIN_RITUAL_MS;
}

export default function RitualPage() {
  const router = useRouter();
  const {
    hydration,
    payload,
    enrichError,
  } = useDeckSession();

  /** Locked at first render so a re-render mid-loop doesn't reset the floor. */
  const startedAtRef = useRef<number>(Date.now());

  // No session → bounce back to the import screen.
  useEffect(() => {
    if (hydration === "absent") {
      router.replace("/");
    }
  }, [hydration, router]);

  // Once enrichment terminates (success cardMap or hard error) and the floor
  // has elapsed, forward to /reading. The session provider keeps running so
  // /reading sees fresh state on arrival.
  useEffect(() => {
    if (hydration !== "hydrated" || !payload) return;

    const enrichmentTerminal =
      payload.cardMap !== null || enrichError !== null;
    if (!enrichmentTerminal) return;

    const elapsed = Date.now() - startedAtRef.current;
    const remaining = Math.max(0, getFloorMs() - elapsed);

    const timeout = setTimeout(() => {
      router.replace("/reading");
    }, remaining);

    return () => clearTimeout(timeout);
  }, [hydration, payload, enrichError, router]);

  if (hydration !== "hydrated") return null;

  return <CosmicLoader />;
}
