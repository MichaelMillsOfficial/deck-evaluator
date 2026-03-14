"use client";

import OracleText from "@/components/OracleText";
import type { OracleTextCitation } from "@/lib/interaction-citations";

// ═══════════════════════════════════════════════════════════════
// TIER CONFIG
// ═══════════════════════════════════════════════════════════════

const TIER_LABELS: Record<OracleTextCitation["tier"], string> = {
  ability: "Oracle text",
  typeline: "Type line",
  rule: "Rules note",
};

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

interface InteractionCitationProps {
  citation: OracleTextCitation;
}

export default function InteractionCitation({
  citation,
}: InteractionCitationProps) {
  return (
    <blockquote
      data-testid="interaction-citation"
      data-tier={citation.tier}
      className="bg-slate-900/50 border-l-2 border-purple-500 pl-3 py-1 rounded-sm"
    >
      {/* Attribution line */}
      <p className="text-[10px] font-semibold text-purple-400/80 mb-0.5 uppercase tracking-wide">
        {citation.cardName}{" "}
        <span className="font-normal text-slate-600">
          &mdash; {TIER_LABELS[citation.tier]}
        </span>
      </p>

      {/* The oracle text snippet */}
      <div className="text-xs text-slate-300 leading-relaxed italic">
        {citation.tier === "ability" ? (
          <OracleText text={citation.snippet} />
        ) : (
          <span>{citation.snippet}</span>
        )}
      </div>
    </blockquote>
  );
}

// ═══════════════════════════════════════════════════════════════
// CITATION LIST WRAPPER
// ═══════════════════════════════════════════════════════════════

interface CitationListProps {
  citations: OracleTextCitation[];
}

export function CitationList({ citations }: CitationListProps) {
  if (citations.length === 0) {
    return (
      <p className="text-[11px] text-slate-500 italic py-1">
        No rules text available.
      </p>
    );
  }

  return (
    <div className="space-y-2 mt-2">
      {citations.map((citation, i) => (
        <InteractionCitation key={`${citation.cardName}-${i}`} citation={citation} />
      ))}
    </div>
  );
}
