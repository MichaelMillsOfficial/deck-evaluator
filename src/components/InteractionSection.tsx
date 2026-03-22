"use client";

import type {
  InteractionAnalysis,
  Interaction,
  InteractionChain,
  InteractionLoop,
  InteractionBlocker,
  InteractionEnabler,
  InteractionType,
  RemovalImpact,
  Condition,
} from "@/lib/interaction-engine";
import { analyzeSatisfiability } from "@/lib/interaction-engine/satisfiability-analyzer";
import type { AnalysisStep } from "@/hooks/useInteractionAnalysis";
import { useEffect, useMemo, useState, lazy, Suspense, Component, type ReactNode } from "react";
import CollapsiblePanel from "@/components/CollapsiblePanel";
import CentralityRanking from "@/components/CentralityRanking";
import RemovalImpactFloatingPanel from "@/components/RemovalImpactFloatingPanel";
import { CitationList } from "@/components/InteractionCitation";
import {
  rollUpInteractions,
  INTERACTION_VERBS,
  type RolledUpGroup,
  type DisplayInteractionItem,
} from "@/lib/interaction-rollup";
import { computeCentrality } from "@/lib/interaction-centrality";
import { computeAllRemovalImpacts } from "@/lib/interaction-removal-impact";
import { extractCitations } from "@/lib/interaction-citations";

// ─── Lazy-loaded visualisation components (d3-force not in initial bundle) ────
const InteractionGraph = lazy(() => import("@/components/InteractionGraph"));
const InteractionHeatmap = lazy(() => import("@/components/InteractionHeatmap"));

const PAGE_SIZE = 20;

interface InteractionSectionProps {
  analysis: InteractionAnalysis | null;
  loading: boolean;
  error: string | null;
  steps: AnalysisStep[];
  progress: number;
  expandedSections: Set<string>;
  onToggleSection: (id: string) => void;
}

const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  enables: "Enables",
  triggers: "Triggers",
  amplifies: "Amplifies",
  protects: "Protects",
  recurs: "Recurs",
  reduces_cost: "Reduces Cost",
  tutors_for: "Tutors For",
  blocks: "Blocks",
  conflicts: "Conflicts",
  loops_with: "Loops With",
};

const INTERACTION_TYPE_COLORS: Record<InteractionType, string> = {
  enables: "bg-green-600/60 text-green-100",
  triggers: "bg-blue-600/60 text-blue-100",
  amplifies: "bg-amber-600/60 text-amber-100",
  protects: "bg-cyan-600/60 text-cyan-100",
  recurs: "bg-emerald-600/60 text-emerald-100",
  reduces_cost: "bg-lime-600/60 text-lime-100",
  tutors_for: "bg-indigo-600/60 text-indigo-100",
  blocks: "bg-red-600/60 text-red-100",
  conflicts: "bg-orange-600/60 text-orange-100",
  loops_with: "bg-fuchsia-600/60 text-fuchsia-100",
};

const TYPE_FILTER_COLORS: Record<InteractionType, { active: string; border: string }> = {
  enables: { active: "border-green-500 bg-green-900/30 text-green-300", border: "border-green-600/40" },
  triggers: { active: "border-blue-500 bg-blue-900/30 text-blue-300", border: "border-blue-600/40" },
  amplifies: { active: "border-amber-500 bg-amber-900/30 text-amber-300", border: "border-amber-600/40" },
  protects: { active: "border-cyan-500 bg-cyan-900/30 text-cyan-300", border: "border-cyan-600/40" },
  recurs: { active: "border-emerald-500 bg-emerald-900/30 text-emerald-300", border: "border-emerald-600/40" },
  reduces_cost: { active: "border-lime-500 bg-lime-900/30 text-lime-300", border: "border-lime-600/40" },
  tutors_for: { active: "border-indigo-500 bg-indigo-900/30 text-indigo-300", border: "border-indigo-600/40" },
  blocks: { active: "border-red-500 bg-red-900/30 text-red-300", border: "border-red-600/40" },
  conflicts: { active: "border-orange-500 bg-orange-900/30 text-orange-300", border: "border-orange-600/40" },
  loops_with: { active: "border-fuchsia-500 bg-fuchsia-900/30 text-fuchsia-300", border: "border-fuchsia-600/40" },
};

const INTERACTION_GROUP_COLORS: Record<InteractionType, string> = {
  enables: "text-green-400",
  triggers: "text-blue-400",
  amplifies: "text-amber-400",
  protects: "text-cyan-400",
  recurs: "text-emerald-400",
  reduces_cost: "text-lime-400",
  tutors_for: "text-indigo-400",
  blocks: "text-red-400",
  conflicts: "text-orange-400",
  loops_with: "text-fuchsia-400",
};

type GroupMode = "type" | "card" | "strength";
type ViewMode = "list" | "graph" | "heatmap";

function strengthPercent(strength: number): number {
  return Math.round(strength * 100);
}

// ═══════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// Error Boundary
// ═══════════════════════════════════════════════════════════════

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class InteractionErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div role="alert" className="rounded-lg border border-red-700/50 bg-red-900/20 px-4 py-5">
            <p className="text-sm font-semibold text-red-300 mb-1">
              Interaction analysis encountered an error
            </p>
            <p className="text-xs text-red-400/80">
              {this.state.error?.message ?? "An unexpected error occurred while rendering interactions."}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-3 rounded-md border border-red-700/50 bg-red-900/30 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-900/50 transition-colors"
            >
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════
// Pagination helper
// ═══════════════════════════════════════════════════════════════

function ShowMoreButton({
  shown,
  total,
  onShowMore,
}: {
  shown: number;
  total: number;
  onShowMore: () => void;
}) {
  if (shown >= total) return null;
  const remaining = total - shown;
  return (
    <button
      type="button"
      onClick={onShowMore}
      className="w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:border-slate-600 hover:bg-slate-700/50 transition-colors cursor-pointer"
    >
      Show {Math.min(remaining, PAGE_SIZE)} more ({remaining} remaining)
    </button>
  );
}

function StrengthBar({ strength }: { strength: number }) {
  const pct = strengthPercent(strength);
  const barColor =
    pct >= 75
      ? "bg-purple-500"
      : pct >= 50
      ? "bg-purple-600/70"
      : pct >= 25
      ? "bg-slate-500"
      : "bg-slate-600";

  return (
    <span
      className="ml-auto flex items-center gap-1.5 shrink-0"
      aria-label={`Interaction strength: ${pct}%`}
    >
      <span className="w-14 h-1.5 rounded-full bg-slate-700 overflow-hidden">
        <span
          className={`block h-full rounded-full ${barColor} transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-[10px] tabular-nums text-slate-500 w-7 text-right">
        {pct}%
      </span>
    </span>
  );
}

function CardPill({ name, highlight }: { name: string; highlight?: boolean }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium leading-none ${
        highlight
          ? "bg-purple-900/30 border border-purple-600/50 text-purple-200"
          : "bg-slate-700/80 border border-slate-600/50 text-slate-200"
      }`}
    >
      {name}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-xs text-slate-500 italic py-1">{message}</p>;
}

// ─── Condition annotation badge ──────────────────────────────────

function ConditionBadge({ conditions }: { conditions: Condition[] }) {
  // Only show for conditions that have structured checks
  const structured = conditions.filter((c) => c.structured);
  if (structured.length === 0) return null;

  // Pick the most restrictive condition to display (lowest score)
  let minScore = 1.0;
  let hasRuntime = false;
  for (const cond of structured) {
    const result = analyzeSatisfiability(cond, []); // empty deck → use check type only for label
    if (cond.structured?.check === "runtime") {
      hasRuntime = true;
    } else {
      minScore = Math.min(minScore, result.score);
    }
  }

  // We can't pass deckCards here without prop-drilling, so show a simplified
  // label derived purely from the condition type (not deck composition).
  // The score already adjusted the interaction.strength — this badge just
  // communicates "this interaction has a condition" to the user.
  if (hasRuntime && minScore >= 0.9) {
    return (
      <span
        aria-label="Condition: requires game state"
        className="rounded-full px-2 py-0.5 text-[9px] font-semibold bg-slate-700/60 text-slate-400 border border-slate-600/40"
      >
        Cond: game state
      </span>
    );
  }

  return (
    <span
      aria-label="This interaction has deck conditions"
      className="rounded-full px-2 py-0.5 text-[9px] font-semibold bg-slate-700/60 text-slate-400 border border-slate-600/40"
    >
      Conditional
    </span>
  );
}

function InteractionItem({
  interaction,
  index,
  type,
  profiles,
}: {
  interaction: Interaction;
  index: number;
  type: string;
  profiles?: InteractionAnalysis["profiles"];
}) {
  const [showCitations, setShowCitations] = useState(false);
  const citationsId = `citations-${interaction.cards[0].replace(/\s+/g, "-")}-${interaction.cards[1].replace(/\s+/g, "-")}-${index}`;

  // Lazy-compute citations only when toggle is opened
  const citations = useMemo(() => {
    if (!showCitations || !profiles) return [];
    return extractCitations(interaction, profiles);
  }, [showCitations, interaction, profiles]);

  // Gather conditions from both cards' profiles for annotation
  const conditions = useMemo((): Condition[] => {
    if (!profiles) return [];
    const result: Condition[] = [];
    for (const cardName of interaction.cards) {
      const profile = profiles[cardName];
      if (profile?.requires) {
        result.push(...profile.requires.filter((c) => c.structured));
      }
    }
    return result;
  }, [interaction.cards, profiles]);

  const badgeColors =
    INTERACTION_TYPE_COLORS[interaction.type] ?? "bg-slate-600/60 text-slate-100";

  // Detect command zone interactions (eminence)
  const isCommandZoneInteraction = profiles != null && interaction.cards.some(
    (cardName) => {
      const profile = profiles[cardName];
      return profile?.commander?.eminence != null && profile.commander.eminence.length > 0;
    }
  );

  return (
    <div
      data-testid={`interaction-${type}-${index}`}
      className="rounded-lg border border-slate-700 bg-slate-800/30 p-3 hover:bg-slate-700/30 hover:border-slate-600 transition-colors duration-150"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            data-testid="interaction-type"
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeColors}`}
          >
            {INTERACTION_TYPE_LABELS[interaction.type] ?? interaction.type}
          </span>
          {conditions.length > 0 && (
            <ConditionBadge conditions={conditions} />
          )}
          {isCommandZoneInteraction && (
            <span
              data-testid="command-zone-badge"
              className="inline-flex items-center rounded-full border border-amber-700/50 bg-amber-900/40 px-1.5 py-0.5 text-[9px] font-medium text-amber-300"
            >
              Command Zone
            </span>
          )}
        </div>
        <StrengthBar strength={interaction.strength} />
      </div>
      <div className="flex items-center gap-2 mb-2">
        <CardPill name={interaction.cards[0]} />
        <span className="text-slate-500 text-sm" aria-hidden="true">
          &rarr;
        </span>
        <CardPill name={interaction.cards[1]} />
      </div>
      <p className="text-xs text-slate-400 leading-relaxed mb-2">
        {interaction.mechanical}
      </p>

      {/* Citation toggle */}
      {profiles && (
        <>
          <button
            type="button"
            data-testid="show-citations-toggle"
            aria-expanded={showCitations}
            aria-controls={citationsId}
            onClick={() => setShowCitations((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && showCitations) setShowCitations(false);
            }}
            className="group flex items-center gap-1 text-[11px] text-slate-500 hover:text-purple-300 transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400 rounded min-h-[44px] py-2"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-3 w-3 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
                showCitations ? "rotate-90" : ""
              }`}
            >
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                clipRule="evenodd"
              />
            </svg>
            <span className="underline-offset-2 group-hover:underline">
              {showCitations ? "Hide" : "Show"} rules text
            </span>
          </button>

          <div
            id={citationsId}
            className={`grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none ease-out ${
              showCitations ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
            aria-hidden={!showCitations}
          >
            <div className="overflow-hidden">
              <CitationList citations={citations} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Rolled-up interaction group with expandable sub-list
// ═══════════════════════════════════════════════════════════════

function RolledUpInteractionItem({
  group,
  index,
  type,
}: {
  group: RolledUpGroup;
  index: number;
  type: string;
}) {
  const [open, setOpen] = useState(false);
  // Stable ID using anchor card + type (avoids index-based collisions across group modes)
  const contentId = `rollup-content-${group.anchorCard.replace(/\s+/g, "-")}-${group.type}-${index}`;
  const badgeColors =
    INTERACTION_TYPE_COLORS[group.type] ?? "bg-slate-600/60 text-slate-100";
  const verb =
    group.anchorRole === "source"
      ? INTERACTION_VERBS[group.type]?.sourceVerb ?? group.type
      : INTERACTION_VERBS[group.type]?.targetVerb ?? group.type;

  return (
    <div
      data-testid={`interaction-${type}-${index}`}
      className="rounded-lg border border-slate-700 bg-slate-800/30 p-3 transition-colors duration-150"
    >
      {/* Header row: type badge + strength */}
      <div className="flex items-center justify-between mb-2">
        <span
          data-testid="interaction-type"
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeColors}`}
        >
          {INTERACTION_TYPE_LABELS[group.type] ?? group.type}
        </span>
        <StrengthBar strength={group.maxStrength} />
      </div>

      {/* Summary line: anchor card + verb + count + noun */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <CardPill name={group.anchorCard} highlight />
        <span className="text-xs text-slate-300">
          {verb}{" "}
          <span className="font-semibold text-slate-200 tabular-nums">
            {group.interactions.length}
          </span>{" "}
          {group.targetNoun}
        </span>
      </div>

      {/* Expandable toggle */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
        className="group flex items-center gap-1 text-xs text-slate-500 hover:text-sky-300 transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400 rounded"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-3 w-3 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
            open ? "rotate-90" : ""
          }`}
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
        <span className="underline-offset-2 group-hover:underline">
          {open ? "Hide" : "Show"} {group.interactions.length} {group.targetNoun}
        </span>
      </button>

      {/* Expandable sub-list — grid trick for smooth height animation */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <div
            id={contentId}
            className="mt-2 rounded-md border border-slate-700/60 bg-slate-900/40 py-1 divide-y divide-slate-700/30"
          >
            {group.interactions.map((inter, i) => {
              const targetCard =
                group.anchorRole === "source"
                  ? inter.cards[1]
                  : inter.cards[0];
              return (
                <RolledUpSubRow
                  key={`${targetCard}-${i}`}
                  targetCard={targetCard}
                  mechanical={inter.mechanical}
                  strength={inter.strength}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function RolledUpSubRow({
  targetCard,
  mechanical,
  strength,
}: {
  targetCard: string;
  mechanical: string;
  strength: number;
}) {
  const pct = strengthPercent(strength);
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-700/20 transition-colors duration-100">
      <CardPill name={targetCard} />
      <span
        className="text-[11px] text-slate-400 truncate min-w-0 flex-1"
        title={mechanical}
      >
        {mechanical}
      </span>
      <span className="text-[10px] tabular-nums text-slate-500 shrink-0 w-7 text-right">
        {pct}%
      </span>
    </div>
  );
}

function ChainItem({ chain, index }: { chain: InteractionChain; index: number }) {
  const [open, setOpen] = useState(false);
  const contentId = `chain-detail-${index}`;

  // Map interaction types to readable labels and colors
  const typeLabel = (t: string) => {
    switch (t) {
      case "enables": return { text: "enables", color: "text-emerald-400" };
      case "triggers": return { text: "triggers", color: "text-amber-400" };
      case "recurs": return { text: "recurs", color: "text-violet-400" };
      case "reduces_cost": return { text: "reduces cost of", color: "text-cyan-400" };
      default: return { text: t, color: "text-slate-400" };
    }
  };

  return (
    <div
      data-testid={`chain-${index}`}
      className="rounded-lg border border-slate-700 bg-slate-800/30 p-3 hover:bg-slate-700/30 hover:border-slate-600 transition-colors duration-150"
    >
      {/* Card flow header */}
      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
        {chain.cards.map((card, i) => (
          <span key={`${card}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && (
              <span className="text-slate-500 text-xs" aria-hidden="true">
                &rarr;
              </span>
            )}
            <CardPill name={card} />
          </span>
        ))}
        {chain.strength !== undefined && (
          <span className="ml-auto text-[10px] text-slate-500 tabular-nums">
            {Math.round(chain.strength * 100)}%
          </span>
        )}
      </div>

      {/* Reasoning summary */}
      {chain.reasoning && (
        <p className="text-xs text-slate-300 leading-relaxed mb-1.5 italic">
          {chain.reasoning}
        </p>
      )}

      {/* Expandable step-by-step detail */}
      {chain.steps.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={contentId}
            onClick={() => setOpen((v) => !v)}
            className="group flex items-center gap-1 text-xs text-slate-500 hover:text-sky-300 transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400 rounded"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-3 w-3 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
                open ? "rotate-90" : ""
              }`}
            >
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                clipRule="evenodd"
              />
            </svg>
            <span className="underline-offset-2 group-hover:underline">
              Step-by-step breakdown
            </span>
          </button>

          <div
            id={contentId}
            className={`grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none ease-out ${
              open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
            aria-hidden={!open}
          >
            <div className="overflow-hidden">
              <ol className="mt-2 space-y-0" aria-label="Chain steps">
                {chain.steps.map((step, i) => {
                  const label = typeLabel(step.interactionType);
                  return (
                    <li key={i} className="relative pl-8 pb-3 last:pb-0">
                      {/* Vertical connector */}
                      {i < chain.steps.length - 1 && (
                        <span
                          aria-hidden="true"
                          className="absolute left-[13px] top-6 bottom-0 w-px bg-slate-700"
                        />
                      )}
                      {/* Step number circle */}
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-0.5 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-sky-900/60 text-[11px] font-semibold text-sky-300 ring-1 ring-sky-700/60"
                      >
                        {i + 1}
                      </span>
                      {/* Step content */}
                      <div className="pt-0.5">
                        <div className="flex flex-wrap items-center gap-1 text-xs">
                          <CardPill name={step.from} />
                          <span className={`font-medium ${label.color}`}>
                            {label.text}
                          </span>
                          <CardPill name={step.to} />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Loop "How it works" expandable panel ───────────────────────
// Renders step-by-step gameplay instructions for a loop with a
// vertical connector line, net effect summary, and prerequisites.

function LoopHowItWorks({ loop, id }: { loop: InteractionLoop; id: string }) {
  const [open, setOpen] = useState(false);
  const contentId = `loop-howto-${id}`;

  const hasSteps = loop.steps.length > 0;
  const hasNet =
    loop.netEffect.resources.length > 0 ||
    loop.netEffect.attributes.length > 0;
  const hasRequires = (loop.requires ?? []).length > 0;

  if (!hasSteps && !hasNet && !hasRequires) return null;

  return (
    <div className="mt-2.5">
      {/* Disclosure button */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-1 text-xs text-slate-500 hover:text-fuchsia-300 transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-fuchsia-400 rounded"
      >
        {/* Chevron */}
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-3 w-3 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
            open ? "rotate-90" : ""
          }`}
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
        <span className="underline-offset-2 group-hover:underline">
          How it works
        </span>
      </button>

      {/* Expandable content — grid trick for smooth height animation */}
      <div
        id={contentId}
        className={`grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <div className="mt-2.5 rounded-md border border-slate-700/60 bg-slate-900/60 px-3 pt-3 pb-2.5 space-y-3">
            {/* Steps */}
            {hasSteps && (
              <ol className="space-y-0" aria-label="Loop steps">
                {loop.steps.map((step, i) => {
                  const isLast = i === loop.steps.length - 1;
                  return (
                    <li key={i} className="flex gap-2.5">
                      {/* Step number + vertical connector */}
                      <div className="flex flex-col items-center shrink-0">
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-fuchsia-900/60 border border-fuchsia-700/40 text-[9px] font-bold tabular-nums text-fuchsia-300 shrink-0"
                          aria-hidden="true"
                        >
                          {i + 1}
                        </span>
                        {/* Connector line — hidden after last step */}
                        {!isLast && (
                          <span
                            className="mt-0.5 mb-0.5 w-px flex-1 min-h-[10px] bg-fuchsia-800/30"
                            aria-hidden="true"
                          />
                        )}
                      </div>

                      {/* Step content */}
                      <div className={`${isLast ? "pb-0" : "pb-2"} min-w-0`}>
                        {/* From → To card reference */}
                        <div className="flex flex-wrap items-center gap-1 mb-0.5">
                          <span className="rounded bg-slate-700/70 border border-slate-600/40 px-1.5 py-px text-[10px] font-medium text-slate-200 leading-none shrink-0">
                            {step.from}
                          </span>
                          {step.to && step.to !== step.from && (
                            <>
                              <span
                                className="text-slate-600 text-[10px]"
                                aria-hidden="true"
                              >
                                &rarr;
                              </span>
                              <span className="rounded bg-slate-700/70 border border-slate-600/40 px-1.5 py-px text-[10px] font-medium text-slate-200 leading-none shrink-0">
                                {step.to}
                              </span>
                            </>
                          )}
                        </div>
                        {/* Step description */}
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </li>
                  );
                })}

                {/* Loop-back indicator */}
                <li className="flex gap-2.5">
                  <div className="flex flex-col items-center shrink-0">
                    <span
                      className="flex h-5 w-5 items-center justify-center text-fuchsia-400 text-sm font-bold"
                      aria-hidden="true"
                    >
                      &#8634;
                    </span>
                  </div>
                  <div className="pt-0.5 min-w-0">
                    <p className="text-[10px] text-fuchsia-400/70 italic leading-relaxed">
                      {loop.isInfinite
                        ? "Repeat indefinitely — the loop has no natural stopping point."
                        : `Returns to step 1 — repeat as desired.`}
                    </p>
                  </div>
                </li>
              </ol>
            )}

            {/* Net effect */}
            {hasNet && (
              <div className="border-t border-slate-700/50 pt-2">
                <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                  Net per cycle
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {loop.netEffect.resources.map((r, i) => {
                    let label: string;
                    if (r.category === "mana") {
                      label = `+${r.quantity} {${r.color}} mana`;
                    } else if (r.category === "life") {
                      const isNegative = typeof r.quantity === "number" && r.quantity < 0;
                      label = isNegative ? `${r.quantity} life` : `+${r.quantity} life`;
                    } else if (r.category === "cards") {
                      label = `+${r.quantity} card${r.quantity !== 1 ? "s" : ""}`;
                    } else {
                      const _exhaustive: never = r;
                      label = `resource`;
                    }
                    return (
                      <span
                        key={`res-${i}`}
                        className="rounded bg-slate-800/80 border border-slate-600/40 px-2 py-0.5 text-xs text-slate-300 tabular-nums"
                      >
                        {label}
                      </span>
                    );
                  })}
                  {loop.netEffect.attributes.map((a, i) => {
                    let label: string;
                    if (a.category === "counter") {
                      label = `+${a.quantity} ${a.counterType} counter`;
                    } else if (a.category === "stat_mod") {
                      label = `+${a.power}/+${a.toughness}`;
                    } else {
                      // KeywordGrant — show the granted keyword
                      label = a.keyword;
                    }
                    return (
                      <span
                        key={`attr-${i}`}
                        className="rounded bg-slate-800/80 border border-slate-600/40 px-2 py-0.5 text-xs text-slate-300"
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Prerequisites */}
            {hasRequires && (
              <div className="border-t border-slate-700/50 pt-2">
                <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                  Requires each iteration
                </div>
                <ul className="space-y-0.5">
                  {(loop.requires ?? []).map((cond, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-1.5 text-xs text-slate-400"
                    >
                      <span
                        className="mt-1 h-1 w-1 rounded-full bg-slate-500 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{cond.predicate}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoopItem({ loop, index }: { loop: InteractionLoop; index: number }) {
  const loopId = loop.cards.join("-") + `-${index}`;

  return (
    <div
      data-testid={`loop-${index}`}
      className="rounded-lg border border-fuchsia-700/30 bg-fuchsia-900/5 p-3 hover:bg-fuchsia-900/10 hover:border-fuchsia-700/50 transition-colors duration-150"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-fuchsia-300">
          {loop.isInfinite ? "Infinite Loop" : "Loop"}
        </span>
        {loop.isInfinite && (
          <span className="rounded-full bg-fuchsia-600/80 border border-fuchsia-500/50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fuchsia-100 flex items-center gap-1">
            <span aria-hidden="true">&infin;</span> Infinite
          </span>
        )}
      </div>
      {/* Loop cycle visualization */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {loop.cards.map((card, i) => (
          <span key={`${card}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && (
              <span className="text-fuchsia-500/60 text-xs" aria-hidden="true">
                &rarr;
              </span>
            )}
            <CardPill name={card} />
          </span>
        ))}
        <span
          className="text-fuchsia-400 text-sm font-bold"
          title={`Loops back to ${loop.cards[0]}`}
          aria-label={`Loops back to ${loop.cards[0]}`}
        >
          &#8634;
        </span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{loop.description}</p>

      {/* "How it works" expandable section */}
      <LoopHowItWorks loop={loop} id={loopId} />
    </div>
  );
}

function BlockerItem({ blocker, index }: { blocker: InteractionBlocker; index: number }) {
  return (
    <div
      data-testid={`blocker-${index}`}
      className="rounded-lg border border-slate-600/50 bg-slate-800/30 p-3 hover:bg-slate-700/30 hover:border-slate-500/50 transition-colors duration-150"
    >
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <span className="rounded bg-slate-600/80 border border-slate-500/50 px-2 py-0.5 text-xs font-medium text-slate-200 leading-none">
          {blocker.blocker}
        </span>
        <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
          Blocks {blocker.blockedInteractions.length} interaction
          {blocker.blockedInteractions.length !== 1 ? "s" : ""}
        </span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{blocker.description}</p>
    </div>
  );
}

function EnablerItem({ enabler, index }: { enabler: InteractionEnabler; index: number }) {
  return (
    <div
      data-testid={`enabler-${index}`}
      className="rounded-lg border border-green-700/30 bg-green-900/5 p-3 hover:bg-green-900/10 hover:border-green-700/50 transition-colors duration-150"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-green-700/60 border border-green-600/40 px-2 py-0.5 text-xs font-medium text-green-100 leading-none">
          {enabler.enabler}
        </span>
        {enabler.isRequired && (
          <span className="rounded-full bg-green-700/60 border border-green-600/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-100">
            Key Enabler
          </span>
        )}
        <span className="text-xs text-green-400/80">
          enables {enabler.enabledInteractions.length} interaction
          {enabler.enabledInteractions.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Loading state with step progress
// ═══════════════════════════════════════════════════════════════

function LoadingState({ steps, progress }: { steps: AnalysisStep[]; progress: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Analyzing interactions"
      className="py-10 px-4 flex flex-col items-center gap-5"
    >
      <span className="text-sm font-semibold text-slate-300">
        Analyzing card interactions
      </span>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-purple-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="w-full max-w-xs space-y-1.5">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center gap-2 text-xs">
            {step.status === "done" && (
              <svg className="h-3.5 w-3.5 text-green-400 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
            {step.status === "active" && (
              <svg className="h-3.5 w-3.5 animate-spin text-purple-400 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {step.status === "pending" && (
              <span className="h-3.5 w-3.5 shrink-0 flex items-center justify-center">
                <span className="block h-1.5 w-1.5 rounded-full bg-slate-600" />
              </span>
            )}
            <span
              className={
                step.status === "done"
                  ? "text-slate-500"
                  : step.status === "active"
                  ? "text-slate-200 font-medium"
                  : "text-slate-600"
              }
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Summary Dashboard
// ═══════════════════════════════════════════════════════════════

function SummaryDashboard({ analysis }: { analysis: InteractionAnalysis }) {
  const totalInteractions = analysis.interactions.length;
  const totalLoops = analysis.loops.length;
  const infiniteLoops = analysis.loops.filter((l) => l.isInfinite).length;
  const totalEnablers = analysis.enablers.length;
  const topEnabler = analysis.enablers[0]?.enabler;

  return (
    <div className="mb-5">
      {/* Primary stats - 3 large cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <div className="rounded-lg border border-purple-700/50 bg-purple-900/10 px-4 py-4">
          <div className="text-2xl font-bold tabular-nums text-purple-300">{totalInteractions}</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Interactions</div>
          <div className="mt-1 text-xs text-slate-500">detected</div>
        </div>
        <div className="rounded-lg border border-fuchsia-700/40 bg-fuchsia-900/10 px-4 py-4">
          <div className="text-2xl font-bold tabular-nums text-fuchsia-300">{totalLoops}</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Loops Found</div>
          {infiniteLoops > 0 && (
            <div className="mt-1 text-xs text-fuchsia-400">{infiniteLoops} infinite</div>
          )}
        </div>
        <div className="rounded-lg border border-green-700/40 bg-green-900/10 px-4 py-4">
          <div className="text-2xl font-bold tabular-nums text-green-300">{totalEnablers}</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Key Enablers</div>
          {topEnabler && (
            <div className="mt-1 text-xs text-slate-500 truncate">Top: {topEnabler}</div>
          )}
        </div>
      </div>

      {/* Secondary stats */}
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs text-slate-400 tabular-nums">
          Chains: {analysis.chains.length}
        </span>
        <span className="rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs text-slate-400 tabular-nums">
          Blockers: {analysis.blockers.length}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Filter Controls
// ═══════════════════════════════════════════════════════════════

function FilterControls({
  interactions,
  activeTypes,
  onToggleType,
  cardSearch,
  onCardSearch,
  minStrength,
  onMinStrength,
  groupMode,
  onGroupMode,
  viewMode,
  onViewMode,
}: {
  interactions: Interaction[];
  activeTypes: Set<InteractionType>;
  onToggleType: (type: InteractionType) => void;
  cardSearch: string;
  onCardSearch: (s: string) => void;
  minStrength: number;
  onMinStrength: (s: number) => void;
  groupMode: GroupMode;
  onGroupMode: (m: GroupMode) => void;
  viewMode: ViewMode;
  onViewMode: (m: ViewMode) => void;
}) {
  // Count by type for badges
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of interactions) {
      counts[i.type] = (counts[i.type] || 0) + 1;
    }
    return counts;
  }, [interactions]);

  const typesPresent = Object.keys(typeCounts).sort(
    (a, b) => (typeCounts[b] || 0) - (typeCounts[a] || 0)
  );

  return (
    <div className="mb-4 space-y-3">
      {/* Card search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
            clipRule="evenodd"
          />
        </svg>
        <input
          type="text"
          value={cardSearch}
          onChange={(e) => onCardSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800/80 pl-8 pr-8 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-colors"
          placeholder="Filter by card name..."
          aria-label="Filter interactions by card name"
        />
        {cardSearch && (
          <button
            type="button"
            onClick={() => onCardSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
            aria-label="Clear search"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        )}
      </div>

      {/* Type filter pills + strength + grouping in one row */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        {/* Type pills */}
        <div className="flex flex-wrap gap-1.5 flex-1">
          <button
            type="button"
            onClick={() => {
              // Clear all active types
              for (const t of activeTypes) onToggleType(t as InteractionType);
            }}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer shrink-0 ${
              activeTypes.size === 0
                ? "border-purple-500 bg-purple-900/30 text-purple-300"
                : "border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-400"
            }`}
            aria-pressed={activeTypes.size === 0}
          >
            All {interactions.length}
          </button>
          {typesPresent.map((type) => {
            const isActive = activeTypes.has(type as InteractionType);
            const colors = TYPE_FILTER_COLORS[type as InteractionType];
            return (
              <button
                key={type}
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => onToggleType(type as InteractionType)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                  isActive
                    ? colors?.active ?? "border-slate-400 bg-slate-700 text-slate-200"
                    : "border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-400 hover:text-slate-200"
                }`}
              >
                {INTERACTION_TYPE_LABELS[type as InteractionType] ?? type} {typeCounts[type]}
              </button>
            );
          })}
        </div>

        {/* Strength threshold */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-slate-500">Min:</span>
          {[
            { label: "All", value: 0 },
            { label: "25%+", value: 0.25 },
            { label: "50%+", value: 0.5 },
            { label: "75%+", value: 0.75 },
          ].map(({ label, value }) => (
            <button
              key={label}
              type="button"
              onClick={() => onMinStrength(value)}
              className={`rounded-full border px-2 py-0.5 text-xs transition-colors cursor-pointer ${
                minStrength === value
                  ? "border-purple-500 bg-purple-900/30 text-purple-300"
                  : "border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grouping toggle + View mode toggle on the same row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Group-by (only relevant in list mode) */}
        <div className={`flex items-center gap-1.5 transition-opacity ${viewMode !== "list" ? "opacity-40 pointer-events-none" : ""}`}>
          <span className="text-xs text-slate-500">Group by:</span>
          {(["type", "card", "strength"] as GroupMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onGroupMode(mode)}
              aria-pressed={groupMode === mode}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors cursor-pointer ${
                groupMode === mode
                  ? "border-purple-500 bg-purple-900/20 text-purple-300 font-medium"
                  : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
              }`}
            >
              {mode === "type" ? "Type" : mode === "card" ? "Card" : "Strength"}
            </button>
          ))}
        </div>

        {/* View mode: List | Graph | Heatmap */}
        <div className="flex items-center gap-1" role="group" aria-label="View mode">
          {(["list", "graph", "heatmap"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onViewMode(mode)}
              aria-pressed={viewMode === mode}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors cursor-pointer ${
                viewMode === mode
                  ? "border-purple-500 bg-purple-900/20 text-purple-300 font-medium"
                  : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
              }`}
            >
              {mode === "list" ? "List" : mode === "graph" ? "Graph" : "Heatmap"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Grouped Interaction List
// ═══════════════════════════════════════════════════════════════

interface DisplayGroup {
  id: string;
  label: string;
  accentColor: string;
  /** Raw interactions for counting and backward compatibility */
  interactions: Interaction[];
  /** Rolled-up display items (rollup groups + individual entries) */
  displayItems: DisplayInteractionItem[];
}

/** Helper: get the interaction type from a display item */
function getItemType(item: DisplayInteractionItem): InteractionType {
  return item.kind === "rollup" ? item.type : item.interaction.type;
}

/** Helper: get the max strength from a display item */
function getItemStrength(item: DisplayInteractionItem): number {
  return item.kind === "rollup" ? item.maxStrength : item.interaction.strength;
}

/** Helper: get all card names from a display item */
function getItemCards(item: DisplayInteractionItem): string[] {
  if (item.kind === "rollup") {
    return [item.anchorCard, ...item.targetCards];
  }
  return [...item.interaction.cards];
}

function buildGroups(
  displayItems: DisplayInteractionItem[],
  rawInteractions: Interaction[],
  mode: GroupMode
): DisplayGroup[] {
  if (mode === "type") {
    const groups: Record<string, DisplayInteractionItem[]> = {};
    const rawGroups: Record<string, Interaction[]> = {};
    for (const item of displayItems) {
      const type = getItemType(item);
      if (!groups[type]) groups[type] = [];
      groups[type].push(item);
    }
    for (const i of rawInteractions) {
      if (!rawGroups[i.type]) rawGroups[i.type] = [];
      rawGroups[i.type].push(i);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => (rawGroups[b]?.length ?? 0) - (rawGroups[a]?.length ?? 0))
      .map(([type, items]) => ({
        id: type,
        label: INTERACTION_TYPE_LABELS[type as InteractionType] ?? type,
        accentColor: INTERACTION_GROUP_COLORS[type as InteractionType] ?? "text-slate-400",
        interactions: rawGroups[type] ?? [],
        displayItems: [...items].sort((a, b) => getItemStrength(b) - getItemStrength(a)),
      }));
  }

  if (mode === "card") {
    // Use Sets for O(1) dedup (avoids O(n^2) from .includes())
    const cardGroupSets = new Map<string, Set<DisplayInteractionItem>>();
    const rawCardGroups: Record<string, Interaction[]> = {};
    for (const item of displayItems) {
      const cards = getItemCards(item);
      for (const card of cards) {
        if (!cardGroupSets.has(card)) cardGroupSets.set(card, new Set());
        cardGroupSets.get(card)!.add(item);
      }
    }
    const cardGroups: Record<string, DisplayInteractionItem[]> = {};
    for (const [card, set] of cardGroupSets) {
      cardGroups[card] = [...set];
    }
    for (const i of rawInteractions) {
      for (const card of i.cards) {
        if (!rawCardGroups[card]) rawCardGroups[card] = [];
        rawCardGroups[card].push(i);
      }
    }
    return Object.entries(cardGroups)
      .sort(([a], [b]) => (rawCardGroups[b]?.length ?? 0) - (rawCardGroups[a]?.length ?? 0))
      .map(([card, items]) => ({
        id: card,
        label: card,
        accentColor: "text-purple-400",
        interactions: rawCardGroups[card] ?? [],
        displayItems: [...items].sort((a, b) => getItemStrength(b) - getItemStrength(a)),
      }));
  }

  // strength mode
  const high: DisplayInteractionItem[] = [];
  const mid: DisplayInteractionItem[] = [];
  const low: DisplayInteractionItem[] = [];
  const rawHigh: Interaction[] = [];
  const rawMid: Interaction[] = [];
  const rawLow: Interaction[] = [];
  for (const item of displayItems) {
    const s = getItemStrength(item);
    if (s >= 0.75) high.push(item);
    else if (s >= 0.5) mid.push(item);
    else low.push(item);
  }
  for (const i of rawInteractions) {
    if (i.strength >= 0.75) rawHigh.push(i);
    else if (i.strength >= 0.5) rawMid.push(i);
    else rawLow.push(i);
  }
  const groups: DisplayGroup[] = [];
  if (high.length > 0) groups.push({ id: "high", label: "High (75%+)", accentColor: "text-green-400", interactions: rawHigh, displayItems: high.sort((a, b) => getItemStrength(b) - getItemStrength(a)) });
  if (mid.length > 0) groups.push({ id: "mid", label: "Mid (50-75%)", accentColor: "text-amber-400", interactions: rawMid, displayItems: mid.sort((a, b) => getItemStrength(b) - getItemStrength(a)) });
  if (low.length > 0) groups.push({ id: "low", label: "Low (< 50%)", accentColor: "text-slate-400", interactions: rawLow, displayItems: low.sort((a, b) => getItemStrength(b) - getItemStrength(a)) });
  return groups;
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export default function InteractionSection(props: InteractionSectionProps) {
  return (
    <InteractionErrorBoundary>
      <InteractionSectionInner {...props} />
    </InteractionErrorBoundary>
  );
}

function InteractionSectionInner({
  analysis,
  loading,
  error,
  steps,
  progress,
  expandedSections,
  onToggleSection,
}: InteractionSectionProps) {
  // Filter state
  const [activeTypes, setActiveTypes] = useState<Set<InteractionType>>(new Set());
  const [cardSearch, setCardSearch] = useState("");
  const [minStrength, setMinStrength] = useState(0);
  const [groupMode, setGroupMode] = useState<GroupMode>("type");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Centrality + removal impact state
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  // Pagination state — per-group limits for interactions, plus section-level for others
  const [groupPages, setGroupPages] = useState<Record<string, number>>({});
  const [chainPage, setChainPage] = useState(PAGE_SIZE);
  const [blockerPage, setBlockerPage] = useState(PAGE_SIZE);
  const [enablerPage, setEnablerPage] = useState(PAGE_SIZE);

  const getGroupLimit = (groupId: string) => groupPages[groupId] ?? PAGE_SIZE;
  const showMoreGroup = (groupId: string) =>
    setGroupPages((prev) => ({
      ...prev,
      [groupId]: (prev[groupId] ?? PAGE_SIZE) + PAGE_SIZE,
    }));

  const toggleType = (type: InteractionType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // Filtered interactions
  const filteredInteractions = useMemo(() => {
    if (!analysis) return [];
    return analysis.interactions.filter((i) => {
      if (activeTypes.size > 0 && !activeTypes.has(i.type)) return false;
      if (i.strength < minStrength) return false;
      if (cardSearch.trim()) {
        const term = cardSearch.toLowerCase().trim();
        if (
          !i.cards[0].toLowerCase().includes(term) &&
          !i.cards[1].toLowerCase().includes(term)
        )
          return false;
      }
      return true;
    });
  }, [analysis, activeTypes, minStrength, cardSearch]);

  // Reset pagination when filters change (moved out of useMemo to avoid side effects)
  useEffect(() => {
    setGroupPages({});
  }, [activeTypes, minStrength, cardSearch]);

  // Close the floating panel when the Card Centrality section is collapsed
  useEffect(() => {
    if (!expandedSections.has("ie-centrality")) {
      setSelectedCard(null);
    }
  }, [expandedSections]);

  // Apply rollup to filtered interactions
  const rolledUpItems = useMemo(
    () => rollUpInteractions(filteredInteractions, analysis?.profiles ?? {}),
    [filteredInteractions, analysis?.profiles]
  );

  // Grouped interactions (using rolled-up display items)
  const groups = useMemo(
    () => buildGroups(rolledUpItems, filteredInteractions, groupMode),
    [rolledUpItems, filteredInteractions, groupMode]
  );

  // Centrality scores — computed from full analysis (not filtered)
  const centralityResult = useMemo(() => {
    if (!analysis) return null;
    return computeCentrality(analysis);
  }, [analysis]);

  // Removal impact index — all cards, pre-built for O(1) lookup
  const removalImpacts = useMemo(() => {
    if (!analysis) return null;
    return computeAllRemovalImpacts(analysis);
  }, [analysis]);

  // Selected card's removal impact
  const selectedImpact: RemovalImpact | null = useMemo(() => {
    if (!selectedCard || !removalImpacts) return null;
    return removalImpacts.get(selectedCard) ?? null;
  }, [selectedCard, removalImpacts]);

  const hasActiveFilters = activeTypes.size > 0 || cardSearch.trim() !== "" || minStrength > 0;
  const totalCount = analysis?.interactions.length ?? 0;

  return (
    <div>
      {/* Beta banner */}
      <div
        data-testid="interactions-beta-banner"
        className="mb-4 rounded-lg border border-purple-700/50 bg-purple-900/20 px-4 py-3 flex items-start gap-2"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3.5 w-3.5 shrink-0 mt-0.5 text-purple-400"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-xs text-purple-300 leading-relaxed">
          <span className="font-semibold text-purple-200">Interaction Engine (Beta)</span>
          {" — "}This feature uses a deterministic oracle text compiler to detect mechanical
          card interactions. Results may be incomplete for complex cards.
        </p>
      </div>

      {/* Loading state with progress steps */}
      {loading && <LoadingState steps={steps} progress={progress} />}

      {/* Error state */}
      {error && (
        <div role="alert" className="rounded-lg border border-red-700/50 bg-red-900/20 px-4 py-3 mb-4">
          <p className="text-xs text-red-300">
            <span className="font-semibold">Analysis error:</span> {error}
          </p>
        </div>
      )}

      {/* Results */}
      {analysis && !loading && (
        <div data-testid="interactions-content">
          {/* Summary dashboard */}
          <div data-testid="interaction-stats">
            <SummaryDashboard analysis={analysis} />
          </div>

          {/* Filter controls */}
          <FilterControls
            interactions={analysis.interactions}
            activeTypes={activeTypes}
            onToggleType={toggleType}
            cardSearch={cardSearch}
            onCardSearch={setCardSearch}
            minStrength={minStrength}
            onMinStrength={setMinStrength}
            groupMode={groupMode}
            onGroupMode={setGroupMode}
            viewMode={viewMode}
            onViewMode={setViewMode}
          />

          {/* Filter active summary */}
          {hasActiveFilters && (
            <div className="text-xs text-slate-500 flex items-center gap-2 mb-3">
              <span>
                Showing {filteredInteractions.length} of {totalCount} interactions
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveTypes(new Set());
                  setCardSearch("");
                  setMinStrength(0);
                }}
                className="text-purple-400 hover:text-purple-300 underline"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Sections */}
          <div className="space-y-3">
            {/* Card Centrality & Removal Impact — always shown regardless of view mode */}
            {centralityResult && centralityResult.scores.length > 0 && (
              <CollapsiblePanel
                id="ie-centrality"
                title="Card Centrality & Removal Impact"
                summary={`${centralityResult.scores.length} cards ranked`}
                expanded={expandedSections.has("ie-centrality")}
                onToggle={() => onToggleSection("ie-centrality")}
                testId="centrality-panel"
              >
                <div>
                  <p className="text-[11px] text-slate-500 italic mb-2">
                    Click a card to see what breaks if you remove it.
                  </p>
                  <CentralityRanking
                    scores={centralityResult.scores}
                    selectedCard={selectedCard}
                    onSelectCard={setSelectedCard}
                    profiles={analysis.profiles}
                  />
                </div>
              </CollapsiblePanel>
            )}

            {/* Floating removal impact panel — lives outside CollapsiblePanel so it overlays all content */}
            <RemovalImpactFloatingPanel
              impact={selectedImpact}
              onClose={() => setSelectedCard(null)}
            />

            {/* ─── Graph view ──────────────────────────────────────────────── */}
            {viewMode === "graph" && (
              <div data-testid="interaction-graph-view">
                <Suspense
                  fallback={
                    <div
                      aria-live="polite"
                      className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800/30 py-16 text-xs text-slate-500"
                    >
                      <span className="animate-pulse">Loading graph…</span>
                    </div>
                  }
                >
                  <InteractionGraph
                    analysis={analysis}
                    centrality={centralityResult ?? { scores: [], maxScore: 0, medianScore: 0 }}
                    selectedTypes={activeTypes.size > 0 ? activeTypes : undefined}
                  />
                </Suspense>
              </div>
            )}

            {/* ─── Heatmap view ─────────────────────────────────────────────── */}
            {viewMode === "heatmap" && (
              <div data-testid="interaction-heatmap-view">
                <Suspense
                  fallback={
                    <div
                      aria-live="polite"
                      className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800/30 py-16 text-xs text-slate-500"
                    >
                      <span className="animate-pulse">Loading heatmap…</span>
                    </div>
                  }
                >
                  <InteractionHeatmap
                    analysis={analysis}
                    centrality={centralityResult ?? { scores: [], maxScore: 0, medianScore: 0 }}
                    selectedTypes={activeTypes.size > 0 ? activeTypes : undefined}
                  />
                </Suspense>
              </div>
            )}

            {/* ─── List view (default) ─────────────────────────────────────── */}
            {viewMode === "list" && (
              <>
                {/* Loops first if any exist */}
                {analysis.loops.length > 0 && (
                  <CollapsiblePanel
                    id="ie-loops"
                    title="Loops"
                    summary={`${analysis.loops.length} detected${analysis.loops.filter((l) => l.isInfinite).length > 0 ? ` (${analysis.loops.filter((l) => l.isInfinite).length} infinite)` : ""}`}
                    expanded={expandedSections.has("ie-loops")}
                    onToggle={() => onToggleSection("ie-loops")}
                  >
                    <div className="space-y-2">
                      {analysis.loops.map((loop, i) => (
                        <LoopItem key={loop.cards.join("-")} loop={loop} index={i} />
                      ))}
                    </div>
                  </CollapsiblePanel>
                )}

                {/* Enablers */}
                {analysis.enablers.length > 0 && (
                  <CollapsiblePanel
                    id="ie-enablers"
                    title="Key Enablers"
                    summary={`${analysis.enablers.length} cards`}
                    expanded={expandedSections.has("ie-enablers")}
                    onToggle={() => onToggleSection("ie-enablers")}
                  >
                    <div className="space-y-2">
                      {analysis.enablers.slice(0, enablerPage).map((enabler, i) => (
                        <EnablerItem key={enabler.enabler} enabler={enabler} index={i} />
                      ))}
                      <ShowMoreButton
                        shown={Math.min(enablerPage, analysis.enablers.length)}
                        total={analysis.enablers.length}
                        onShowMore={() => setEnablerPage((p) => p + PAGE_SIZE)}
                      />
                    </div>
                  </CollapsiblePanel>
                )}

                {/* Interactions (filtered + grouped) */}
                <CollapsiblePanel
                  id="ie-interactions"
                  title="Interactions"
                  summary={
                    hasActiveFilters
                      ? `${filteredInteractions.length} of ${totalCount}`
                      : `${totalCount} detected`
                  }
                  expanded={expandedSections.has("ie-interactions")}
                  onToggle={() => onToggleSection("ie-interactions")}
                >
                  {filteredInteractions.length === 0 ? (
                    <EmptyState
                      message={
                        hasActiveFilters
                          ? "No interactions match the current filters."
                          : "No mechanical interactions detected."
                      }
                    />
                  ) : (
                    <div className="space-y-4">
                      {groups.map((group) => {
                        const limit = getGroupLimit(group.id);
                        const visible = group.displayItems.slice(0, limit);
                        return (
                          <div key={group.id}>
                            <h4
                              className={`mb-2 text-[10px] font-bold uppercase tracking-widest ${group.accentColor}`}
                            >
                              {group.label}{" "}
                              <span className="text-slate-500 font-normal">
                                ({group.interactions.length})
                              </span>
                            </h4>
                            <div className="space-y-2">
                              {visible.map((item, i) =>
                                item.kind === "rollup" ? (
                                  <RolledUpInteractionItem
                                    key={`rollup-${item.anchorCard}-${item.type}-${i}`}
                                    group={item}
                                    index={i}
                                    type={group.id}
                                  />
                                ) : (
                                  <InteractionItem
                                    key={`${item.interaction.cards[0]}-${item.interaction.cards[1]}-${item.interaction.type}`}
                                    interaction={item.interaction}
                                    index={i}
                                    type={group.id}
                                    profiles={analysis?.profiles}
                                  />
                                )
                              )}
                              <ShowMoreButton
                                shown={visible.length}
                                total={group.displayItems.length}
                                onShowMore={() => showMoreGroup(group.id)}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CollapsiblePanel>

                {/* Chains */}
                {analysis.chains.length > 0 && (
                  <CollapsiblePanel
                    id="ie-chains"
                    title="Chains"
                    summary={`${analysis.chains.length} detected`}
                    expanded={expandedSections.has("ie-chains")}
                    onToggle={() => onToggleSection("ie-chains")}
                  >
                    <div className="space-y-2">
                      {analysis.chains.slice(0, chainPage).map((chain, i) => (
                        <ChainItem key={chain.cards.join("-")} chain={chain} index={i} />
                      ))}
                      <ShowMoreButton
                        shown={Math.min(chainPage, analysis.chains.length)}
                        total={analysis.chains.length}
                        onShowMore={() => setChainPage((p) => p + PAGE_SIZE)}
                      />
                    </div>
                  </CollapsiblePanel>
                )}

                {/* Blockers */}
                {analysis.blockers.length > 0 && (
                  <CollapsiblePanel
                    id="ie-blockers"
                    title="Blockers"
                    summary={`${analysis.blockers.length} detected`}
                    expanded={expandedSections.has("ie-blockers")}
                    onToggle={() => onToggleSection("ie-blockers")}
                  >
                    <div className="space-y-2">
                      {analysis.blockers.slice(0, blockerPage).map((blocker, i) => (
                        <BlockerItem key={blocker.blocker} blocker={blocker} index={i} />
                      ))}
                      <ShowMoreButton
                        shown={Math.min(blockerPage, analysis.blockers.length)}
                        total={analysis.blockers.length}
                        onShowMore={() => setBlockerPage((p) => p + PAGE_SIZE)}
                      />
                    </div>
                  </CollapsiblePanel>
                )}

                {/* Loops empty state (shown as panel only when none exist) */}
                {analysis.loops.length === 0 && (
                  <CollapsiblePanel
                    id="ie-loops"
                    title="Loops"
                    summary="0 detected"
                    expanded={expandedSections.has("ie-loops")}
                    onToggle={() => onToggleSection("ie-loops")}
                  >
                    <EmptyState message="No loops detected." />
                  </CollapsiblePanel>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
