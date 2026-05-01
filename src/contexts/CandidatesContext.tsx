"use client";

/**
 * CandidatesContext — thin shim over PendingChangesContext.
 *
 * This file is kept for backward compatibility with components that already
 * consume `useCandidates()`. It re-exports the same surface from
 * `PendingChangesContext` so existing callers continue to work unchanged.
 *
 * The shim is intended to be removed in a follow-up PR once all callers
 * migrate to `usePendingChanges()` directly.
 *
 * NOTE: CandidatesProvider is replaced by PendingChangesProvider in
 * src/app/reading/(shell)/layout.tsx. This export is kept only so that
 * any residual import of CandidatesProvider does not break at import time.
 */

import { type ReactNode } from "react";
import {
  PendingChangesProvider,
  usePendingChanges,
} from "@/contexts/PendingChangesContext";

/** @deprecated Use PendingChangesProvider instead. */
export function CandidatesProvider({ children }: { children: ReactNode }) {
  // The actual provider is PendingChangesProvider (installed by the shell layout).
  // This shim passes through without adding a second provider instance.
  return <>{children}</>;
}

/**
 * Backward-compatible hook. Returns a subset of PendingChangesContext
 * matching the old CandidatesContext surface.
 */
export function useCandidates() {
  const ctx = usePendingChanges();

  return {
    candidates: ctx.adds.map((a) => a.name),
    setCandidates: () => {
      // no-op: mutations go through addCandidate / removeCandidate
    },
    candidateCardMap: Object.fromEntries(
      ctx.adds.flatMap((a) => (a.enrichedCard ? [[a.name, a.enrichedCard]] : []))
    ),
    setCandidateCardMap: () => {
      // no-op
    },
    candidateAnalyses: Object.fromEntries(
      ctx.adds.flatMap((a) => (a.analysis ? [[a.name, a.analysis]] : []))
    ),
    setCandidateAnalyses: () => {
      // no-op
    },
    candidateErrors: Object.fromEntries(
      ctx.adds.flatMap((a) => (a.error ? [[a.name, a.error]] : []))
    ),
    setCandidateErrors: () => {
      // no-op
    },
    // New operations available to code that migrates to this shim
    addCandidate: ctx.addCandidate,
    removeCandidate: ctx.removeCandidate,
    retryEnrich: ctx.retryEnrich,
  };
}
