"use client";

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { EnrichedCard } from "@/lib/types";
import type { CandidateAnalysis } from "@/lib/candidate-analysis";

interface CandidatesState {
  candidates: string[];
  setCandidates: Dispatch<SetStateAction<string[]>>;
  candidateCardMap: Record<string, EnrichedCard>;
  setCandidateCardMap: Dispatch<SetStateAction<Record<string, EnrichedCard>>>;
  candidateAnalyses: Record<string, CandidateAnalysis>;
  setCandidateAnalyses: Dispatch<SetStateAction<Record<string, CandidateAnalysis>>>;
  candidateErrors: Record<string, string>;
  setCandidateErrors: Dispatch<SetStateAction<Record<string, string>>>;
}

const CandidatesContext = createContext<CandidatesState | null>(null);

export function CandidatesProvider({ children }: { children: ReactNode }) {
  const [candidates, setCandidates] = useState<string[]>([]);
  const [candidateCardMap, setCandidateCardMap] = useState<
    Record<string, EnrichedCard>
  >({});
  const [candidateAnalyses, setCandidateAnalyses] = useState<
    Record<string, CandidateAnalysis>
  >({});
  const [candidateErrors, setCandidateErrors] = useState<
    Record<string, string>
  >({});

  return (
    <CandidatesContext.Provider
      value={{
        candidates,
        setCandidates,
        candidateCardMap,
        setCandidateCardMap,
        candidateAnalyses,
        setCandidateAnalyses,
        candidateErrors,
        setCandidateErrors,
      }}
    >
      {children}
    </CandidatesContext.Provider>
  );
}

export function useCandidates() {
  const ctx = useContext(CandidatesContext);
  if (!ctx) {
    throw new Error("useCandidates must be used within CandidatesProvider");
  }
  return ctx;
}
