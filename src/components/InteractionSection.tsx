"use client";

import type {
  InteractionAnalysis,
  Interaction,
  InteractionChain,
  InteractionLoop,
  InteractionBlocker,
  InteractionEnabler,
} from "@/lib/interaction-engine";
import { useMemo } from "react";
import CollapsiblePanel from "@/components/CollapsiblePanel";

interface InteractionSectionProps {
  analysis: InteractionAnalysis | null;
  loading: boolean;
  error: string | null;
  expandedSections: Set<string>;
  onToggleSection: (id: string) => void;
}

const INTERACTION_TYPE_LABELS: Record<string, string> = {
  enables: "Enables",
  triggers: "Triggers",
  amplifies: "Amplifies",
  protects: "Protects",
  tutors_for: "Tutors For",
  recurs: "Recurs",
  reduces_cost: "Reduces Cost",
  blocks: "Blocks",
  conflicts: "Conflicts",
  loops_with: "Loops With",
};

// Per-type color schemes for the interaction type badge
const INTERACTION_TYPE_COLORS: Record<string, string> = {
  enables: "bg-green-600/60 text-green-100",
  triggers: "bg-blue-600/60 text-blue-100",
  amplifies: "bg-amber-600/60 text-amber-100",
  protects: "bg-cyan-600/60 text-cyan-100",
  tutors_for: "bg-violet-600/60 text-violet-100",
  recurs: "bg-emerald-600/60 text-emerald-100",
  reduces_cost: "bg-lime-600/60 text-lime-100",
  blocks: "bg-red-600/60 text-red-100",
  conflicts: "bg-orange-600/60 text-orange-100",
  loops_with: "bg-fuchsia-600/60 text-fuchsia-100",
};

// Per-type group heading accent colors
const INTERACTION_GROUP_COLORS: Record<string, string> = {
  enables: "text-green-400",
  triggers: "text-blue-400",
  amplifies: "text-amber-400",
  protects: "text-cyan-400",
  tutors_for: "text-violet-400",
  recurs: "text-emerald-400",
  reduces_cost: "text-lime-400",
  blocks: "text-red-400",
  conflicts: "text-orange-400",
  loops_with: "text-fuchsia-400",
};

function strengthPercent(strength: number): number {
  return Math.round(strength * 100);
}

// Inline strength bar — compact, sits right-aligned in the row
function StrengthBar({ strength }: { strength: number }) {
  const pct = strengthPercent(strength);
  // Choose bar color based on strength level
  const barColor =
    pct >= 75
      ? "bg-purple-500"
      : pct >= 50
      ? "bg-purple-600/70"
      : pct >= 25
      ? "bg-slate-500"
      : "bg-slate-600";

  return (
    <span className="ml-auto flex items-center gap-1.5 shrink-0">
      <span className="w-12 h-1.5 rounded-full bg-slate-700 overflow-hidden">
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

// Styled card name pill consistent with the app's card reference style
function CardPill({ name }: { name: string }) {
  return (
    <span className="rounded bg-slate-700/80 border border-slate-600/50 px-2 py-0.5 text-xs font-medium text-slate-200 leading-none">
      {name}
    </span>
  );
}

// Empty state consistent with other tabs
function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-xs text-slate-500 italic py-1">{message}</p>
  );
}

function InteractionItem({
  interaction,
  index,
  type,
}: {
  interaction: Interaction;
  index: number;
  type: string;
}) {
  const badgeColors =
    INTERACTION_TYPE_COLORS[interaction.type] ?? "bg-slate-600/60 text-slate-100";

  return (
    <div
      data-testid={`interaction-${type}-${index}`}
      className="rounded-md border border-slate-700 bg-slate-800/30 p-3 hover:bg-slate-700/30 hover:border-slate-600 transition-colors duration-150"
    >
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <CardPill name={interaction.cards[0]} />
        <span className="text-slate-500 text-xs" aria-hidden="true">
          &rarr;
        </span>
        <CardPill name={interaction.cards[1]} />
        <span
          data-testid="interaction-type"
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeColors}`}
        >
          {INTERACTION_TYPE_LABELS[interaction.type] ?? interaction.type}
        </span>
        <StrengthBar strength={interaction.strength} />
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        {interaction.mechanical}
      </p>
    </div>
  );
}

function ChainItem({ chain, index }: { chain: InteractionChain; index: number }) {
  return (
    <div
      data-testid={`chain-${index}`}
      className="rounded-md border border-slate-700 bg-slate-800/30 p-3 hover:bg-slate-700/30 hover:border-slate-600 transition-colors duration-150"
    >
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {chain.cards.map((card, i) => (
          <span key={card} className="flex items-center gap-1.5">
            {i > 0 && (
              <span className="text-slate-500 text-xs" aria-hidden="true">
                &rarr;
              </span>
            )}
            <CardPill name={card} />
          </span>
        ))}
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{chain.description}</p>
    </div>
  );
}

function LoopItem({ loop, index }: { loop: InteractionLoop; index: number }) {
  return (
    <div
      data-testid={`loop-${index}`}
      className="rounded-md border border-slate-700 bg-slate-800/30 p-3 hover:bg-slate-700/30 hover:border-slate-600 transition-colors duration-150"
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {loop.cards.map((card) => (
          <CardPill key={card} name={card} />
        ))}
        {loop.isInfinite && (
          <span className="rounded-full bg-fuchsia-600/80 border border-fuchsia-500/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fuchsia-100">
            Infinite
          </span>
        )}
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{loop.description}</p>
      {loop.netEffect.resources.length > 0 && (
        <p className="mt-1.5 text-[10px] text-slate-500 leading-relaxed">
          Net per cycle:{" "}
          {loop.netEffect.resources
            .map((r) => {
              const colorStr = r.category === "mana" ? ` ${r.color}` : "";
              return `${r.category}${colorStr} x${r.quantity}`;
            })
            .join(", ")}
        </p>
      )}
    </div>
  );
}

function BlockerItem({
  blocker,
  index,
}: {
  blocker: InteractionBlocker;
  index: number;
}) {
  return (
    <div
      data-testid={`blocker-${index}`}
      className="rounded-md border border-amber-700/40 bg-amber-900/10 p-3 hover:bg-amber-900/20 hover:border-amber-700/60 transition-colors duration-150"
    >
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <span className="rounded bg-amber-700/60 border border-amber-600/40 px-2 py-0.5 text-xs font-medium text-amber-100 leading-none">
          {blocker.blocker}
        </span>
        <span className="text-xs text-amber-400/80">
          blocks {blocker.blockedInteractions.length} interaction
          {blocker.blockedInteractions.length !== 1 ? "s" : ""}
        </span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{blocker.description}</p>
    </div>
  );
}

function EnablerItem({
  enabler,
  index,
}: {
  enabler: InteractionEnabler;
  index: number;
}) {
  return (
    <div
      data-testid={`enabler-${index}`}
      className="rounded-md border border-green-700/40 bg-green-900/10 p-3 hover:bg-green-900/20 hover:border-green-700/60 transition-colors duration-150"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-green-700/60 border border-green-600/40 px-2 py-0.5 text-xs font-medium text-green-100 leading-none">
          {enabler.enabler}
        </span>
        <span className="text-xs text-green-400/80">
          enables {enabler.enabledInteractions.length} interaction
          {enabler.enabledInteractions.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

export default function InteractionSection({
  analysis,
  loading,
  error,
  expandedSections,
  onToggleSection,
}: InteractionSectionProps) {
  // Group interactions by type for display (memoized)
  const groupedInteractions = useMemo(
    () => (analysis ? groupByType(analysis.interactions) : {}),
    [analysis]
  );

  const totalInteractions = analysis?.interactions.length ?? 0;
  const totalChains = analysis?.chains.length ?? 0;
  const totalLoops = analysis?.loops.length ?? 0;
  const totalBlockers = analysis?.blockers.length ?? 0;
  const totalEnablers = analysis?.enablers.length ?? 0;

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

      {/* Loading state */}
      {loading && (
        <div role="status" aria-live="polite" className="flex items-center gap-3 py-10 justify-center">
          <svg
            className="h-5 w-5 animate-spin text-purple-400"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-sm text-slate-400">
            Analyzing card interactions...
          </span>
        </div>
      )}

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
          {/* Summary stats */}
          <div
            data-testid="interaction-stats"
            className="mb-4 grid grid-cols-2 sm:grid-cols-5 gap-3"
          >
            <StatCard label="Interactions" value={totalInteractions} accent />
            <StatCard label="Chains" value={totalChains} />
            <StatCard label="Loops" value={totalLoops} />
            <StatCard label="Blockers" value={totalBlockers} />
            <StatCard label="Enablers" value={totalEnablers} />
          </div>

          {/* Interactions section */}
          <div className="space-y-3">
            <CollapsiblePanel
              id="ie-interactions"
              title="Interactions"
              summary={`${totalInteractions} detected`}
              expanded={expandedSections.has("ie-interactions")}
              onToggle={() => onToggleSection("ie-interactions")}
            >
              {totalInteractions === 0 ? (
                <EmptyState message="No mechanical interactions detected." />
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedInteractions).map(
                    ([type, interactions]) => {
                      const groupAccent =
                        INTERACTION_GROUP_COLORS[type] ?? "text-slate-400";
                      return (
                        <div key={type}>
                          <h4
                            className={`mb-2 text-[10px] font-bold uppercase tracking-widest ${groupAccent}`}
                          >
                            {INTERACTION_TYPE_LABELS[type] ?? type}{" "}
                            <span className="text-slate-500 font-normal">
                              ({interactions.length})
                            </span>
                          </h4>
                          <div className="space-y-2">
                            {[...interactions]
                              .sort((a, b) => b.strength - a.strength)
                              .map((interaction, i) => (
                                <InteractionItem
                                  key={`${interaction.cards[0]}-${interaction.cards[1]}-${type}`}
                                  interaction={interaction}
                                  index={i}
                                  type={type}
                                />
                              ))}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </CollapsiblePanel>

            {/* Chains section */}
            <CollapsiblePanel
              id="ie-chains"
              title="Chains"
              summary={`${totalChains} detected`}
              expanded={expandedSections.has("ie-chains")}
              onToggle={() => onToggleSection("ie-chains")}
            >
              {totalChains === 0 ? (
                <EmptyState message="No multi-card chains detected." />
              ) : (
                <div className="space-y-2">
                  {analysis.chains.map((chain, i) => (
                    <ChainItem key={chain.cards.join("-")} chain={chain} index={i} />
                  ))}
                </div>
              )}
            </CollapsiblePanel>

            {/* Loops section */}
            <CollapsiblePanel
              id="ie-loops"
              title="Loops"
              summary={`${totalLoops} detected`}
              expanded={expandedSections.has("ie-loops")}
              onToggle={() => onToggleSection("ie-loops")}
            >
              {totalLoops === 0 ? (
                <EmptyState message="No loops detected." />
              ) : (
                <div className="space-y-2">
                  {analysis.loops.map((loop, i) => (
                    <LoopItem key={loop.cards.join("-")} loop={loop} index={i} />
                  ))}
                </div>
              )}
            </CollapsiblePanel>

            {/* Blockers section */}
            <CollapsiblePanel
              id="ie-blockers"
              title="Blockers"
              summary={`${totalBlockers} detected`}
              expanded={expandedSections.has("ie-blockers")}
              onToggle={() => onToggleSection("ie-blockers")}
            >
              {totalBlockers === 0 ? (
                <EmptyState message="No interaction blockers detected." />
              ) : (
                <div className="space-y-2">
                  {analysis.blockers.map((blocker, i) => (
                    <BlockerItem key={blocker.blocker} blocker={blocker} index={i} />
                  ))}
                </div>
              )}
            </CollapsiblePanel>

            {/* Enablers section */}
            <CollapsiblePanel
              id="ie-enablers"
              title="Enablers"
              summary={`${totalEnablers} detected`}
              expanded={expandedSections.has("ie-enablers")}
              onToggle={() => onToggleSection("ie-enablers")}
            >
              {totalEnablers === 0 ? (
                <EmptyState message="No key enablers detected." />
              ) : (
                <div className="space-y-2">
                  {analysis.enablers.map((enabler, i) => (
                    <EnablerItem key={enabler.enabler} enabler={enabler} index={i} />
                  ))}
                </div>
              )}
            </CollapsiblePanel>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border bg-slate-800/50 px-3 py-3 text-center transition-colors ${
        accent
          ? "border-purple-700/50 bg-purple-900/10"
          : "border-slate-700"
      }`}
    >
      <div
        className={`text-xl font-bold tabular-nums ${
          accent ? "text-purple-300" : "text-white"
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">
        {label}
      </div>
    </div>
  );
}

function groupByType(
  interactions: Interaction[]
): Record<string, Interaction[]> {
  const groups: Record<string, Interaction[]> = {};
  for (const interaction of interactions) {
    const type = interaction.type;
    if (!groups[type]) groups[type] = [];
    groups[type].push(interaction);
  }
  return groups;
}
