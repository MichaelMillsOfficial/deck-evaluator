"use client";

import { useState } from "react";
import type { RemovalImpact } from "@/lib/interaction-engine/types";

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function isHardToReplace(impact: RemovalImpact): boolean {
  return (
    impact.interactionsLost.length >= 3 ||
    impact.chainsDisrupted.length >= 1 ||
    impact.loopsDisrupted.length >= 1
  );
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function ExpandableSection({
  title,
  count,
  children,
  id,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  id: string;
}) {
  const [open, setOpen] = useState(false);
  const contentId = `removal-detail-${id}`;

  if (count === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) setOpen(false);
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
          {title}{" "}
          <span className="tabular-nums text-slate-400">({count})</span>
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
          <div className="mt-2 rounded-md border border-slate-700/60 bg-slate-900/40 py-1 divide-y divide-slate-700/30">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

interface RemovalImpactInspectorProps {
  impact: RemovalImpact | null;
}

export default function RemovalImpactInspector({
  impact,
}: RemovalImpactInspectorProps) {
  if (!impact) {
    return (
      <div
        data-testid="removal-impact-inspector"
        className="rounded-lg border border-dashed border-slate-700 bg-slate-800/20 px-4 py-5 text-center"
      >
        <p className="text-xs text-slate-500 italic">
          Select a card above to see what breaks if you remove it.
        </p>
      </div>
    );
  }

  const hardToReplace = isHardToReplace(impact);
  const lostCount = impact.interactionsLost.length;
  const chainCount = impact.chainsDisrupted.length;
  const loopCount = impact.loopsDisrupted.length;
  const unblockedCount = impact.interactionsUnblocked.length;

  return (
    <div
      data-testid="removal-impact-inspector"
      className="rounded-lg border border-slate-700 bg-slate-800/30 p-4"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 mb-0.5">Removing</p>
          <p className="text-sm font-semibold text-slate-100 truncate">
            {impact.removedCard}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            hardToReplace
              ? "bg-red-900/50 border border-red-700/60 text-red-300"
              : "bg-green-900/40 border border-green-700/50 text-green-300"
          }`}
          aria-label={
            hardToReplace
              ? "This card is hard to replace"
              : "This card is safe to swap"
          }
        >
          {hardToReplace ? "Hard to Replace" : "Safe to Swap"}
        </span>
      </div>

      {/* Summary line */}
      <p
        data-testid="removal-impact-summary"
        className="text-xs text-slate-400 leading-relaxed mb-2"
      >
        {impact.description}
      </p>

      {/* Quick stats */}
      <div className="flex flex-wrap gap-2 mb-2">
        {lostCount > 0 && (
          <span className="rounded-full bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-[11px] text-slate-400 tabular-nums">
            {lostCount} interaction{lostCount !== 1 ? "s" : ""} lost
          </span>
        )}
        {chainCount > 0 && (
          <span className="rounded-full bg-sky-900/30 border border-sky-700/40 px-2.5 py-0.5 text-[11px] text-sky-300 tabular-nums">
            {chainCount} chain{chainCount !== 1 ? "s" : ""} broken
          </span>
        )}
        {loopCount > 0 && (
          <span className="rounded-full bg-fuchsia-900/30 border border-fuchsia-700/40 px-2.5 py-0.5 text-[11px] text-fuchsia-300 tabular-nums">
            {loopCount} loop{loopCount !== 1 ? "s" : ""} disrupted
          </span>
        )}
        {unblockedCount > 0 && (
          <span className="rounded-full bg-amber-900/30 border border-amber-700/40 px-2.5 py-0.5 text-[11px] text-amber-300 tabular-nums">
            {unblockedCount} unblocked
          </span>
        )}
        {lostCount === 0 && chainCount === 0 && loopCount === 0 && (
          <span className="text-xs text-slate-500 italic">
            No interactions to lose.
          </span>
        )}
      </div>

      {/* Expandable detail sections */}
      <ExpandableSection
        title="Lost interactions"
        count={lostCount}
        id={`lost-${impact.removedCard.replace(/\s+/g, "-")}`}
      >
        {impact.interactionsLost.map((inter, i) => {
          const partner =
            inter.cards[0] === impact.removedCard
              ? inter.cards[1]
              : inter.cards[0];
          return (
            <div
              key={i}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-700/20 transition-colors duration-100"
            >
              <span className="rounded bg-slate-700/80 border border-slate-600/50 px-2 py-0.5 text-xs font-medium text-slate-200 leading-none shrink-0">
                {partner}
              </span>
              <span
                className="text-[11px] text-slate-400 truncate min-w-0 flex-1"
                title={inter.mechanical}
              >
                {inter.mechanical}
              </span>
            </div>
          );
        })}
      </ExpandableSection>

      <ExpandableSection
        title="Chains disrupted"
        count={chainCount}
        id={`chains-${impact.removedCard.replace(/\s+/g, "-")}`}
      >
        {impact.chainsDisrupted.map((chain, i) => (
          <div
            key={i}
            className="px-2 py-1.5 hover:bg-slate-700/20 transition-colors duration-100"
          >
            <div className="flex flex-wrap gap-1 mb-0.5">
              {chain.cards.map((card, j) => (
                <span key={`${card}-${j}`} className="flex items-center gap-1">
                  {j > 0 && (
                    <span className="text-slate-600 text-[10px]">&rarr;</span>
                  )}
                  <span
                    className={`rounded px-1.5 py-px text-[10px] font-medium leading-none ${
                      card === impact.removedCard
                        ? "bg-red-900/40 border border-red-700/50 text-red-200"
                        : "bg-slate-700/60 border border-slate-600/40 text-slate-200"
                    }`}
                  >
                    {card}
                  </span>
                </span>
              ))}
            </div>
            {chain.reasoning && (
              <p className="text-[11px] text-slate-400 italic">
                {chain.reasoning}
              </p>
            )}
          </div>
        ))}
      </ExpandableSection>

      <ExpandableSection
        title="Loops disrupted"
        count={loopCount}
        id={`loops-${impact.removedCard.replace(/\s+/g, "-")}`}
      >
        {impact.loopsDisrupted.map((loop, i) => (
          <div
            key={i}
            className="px-2 py-1.5 hover:bg-slate-700/20 transition-colors duration-100"
          >
            <div className="flex flex-wrap items-center gap-1 mb-0.5">
              {loop.cards.map((card, j) => (
                <span key={`${card}-${j}`} className="flex items-center gap-1">
                  {j > 0 && (
                    <span className="text-fuchsia-600/60 text-[10px]">
                      &rarr;
                    </span>
                  )}
                  <span
                    className={`rounded px-1.5 py-px text-[10px] font-medium leading-none ${
                      card === impact.removedCard
                        ? "bg-red-900/40 border border-red-700/50 text-red-200"
                        : "bg-slate-700/60 border border-slate-600/40 text-slate-200"
                    }`}
                  >
                    {card}
                  </span>
                </span>
              ))}
              <span
                className="text-fuchsia-400/60 text-sm"
                aria-hidden="true"
                title="Loop"
              >
                &#8634;
              </span>
            </div>
            {loop.isInfinite && (
              <span className="text-[10px] text-fuchsia-400/70 italic">
                Infinite loop
              </span>
            )}
          </div>
        ))}
      </ExpandableSection>
    </div>
  );
}
