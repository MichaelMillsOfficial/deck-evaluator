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
import styles from "./InteractionSection.module.css";

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

// Per-type badge CSS module class names
const INTERACTION_TYPE_BADGE_CLASSES: Record<InteractionType, string> = {
  enables:      styles.typeBadgeEnables,
  triggers:     styles.typeBadgeTriggers,
  amplifies:    styles.typeBadgeAmplifies,
  protects:     styles.typeBadgeProtects,
  recurs:       styles.typeBadgeRecurs,
  reduces_cost: styles.typeBadgeReduces,
  tutors_for:   styles.typeBadgeTutors,
  blocks:       styles.typeBadgeBlocks,
  conflicts:    styles.typeBadgeConflicts,
  loops_with:   styles.typeBadgeLoops,
};

// Per-type filter pill active classes
const TYPE_FILTER_PILL_CLASSES: Record<InteractionType, string> = {
  enables:      styles.filterPillTypeEnables,
  triggers:     styles.filterPillTypeTriggers,
  amplifies:    styles.filterPillTypeAmplifies,
  protects:     styles.filterPillTypeProtects,
  recurs:       styles.filterPillTypeRecurs,
  reduces_cost: styles.filterPillTypeReduces,
  tutors_for:   styles.filterPillTypeTutors,
  blocks:       styles.filterPillTypeBlocks,
  conflicts:    styles.filterPillTypeConflicts,
  loops_with:   styles.filterPillTypeLoops,
};

// Per-type group heading colors (keep as inline style so data-driven color is clear)
const INTERACTION_GROUP_COLORS: Record<InteractionType, string> = {
  enables:      "var(--status-ok)",
  triggers:     "#93c5fd",
  amplifies:    "var(--status-watch)",
  protects:     "#67e8f9",
  recurs:       "#6ee7b7",
  reduces_cost: "#bef264",
  tutors_for:   "#a5b4fc",
  blocks:       "var(--status-warn)",
  conflicts:    "#fba64c",
  loops_with:   "var(--accent)",
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
          <div role="alert" className={styles.errorBoundary}>
            <p className={styles.errorBoundaryTitle}>
              Interaction analysis encountered an error
            </p>
            <p className={styles.errorBoundaryDetail}>
              {this.state.error?.message ?? "An unexpected error occurred while rendering interactions."}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className={styles.errorBoundaryRetry}
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
      className={styles.showMoreBtn}
    >
      Show {Math.min(remaining, PAGE_SIZE)} more ({remaining} remaining)
    </button>
  );
}

function StrengthBar({ strength }: { strength: number }) {
  const pct = strengthPercent(strength);
  const fillClass =
    pct >= 75
      ? styles.strengthFill
      : pct >= 50
      ? styles.strengthFillMid
      : styles.strengthFillLow;

  return (
    <span
      className={styles.strengthBarWrapper}
      aria-label={`Interaction strength: ${pct}%`}
    >
      <span className={styles.strengthTrack}>
        <span
          className={fillClass}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className={styles.strengthPct}>
        {pct}%
      </span>
    </span>
  );
}

function CardPill({ name, highlight }: { name: string; highlight?: boolean }) {
  return (
    <span
      className={highlight ? styles.cardPillHighlight : styles.cardPill}
    >
      {name}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className={styles.emptyState}>{message}</p>;
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
        className={styles.conditionBadge}
      >
        Cond: game state
      </span>
    );
  }

  return (
    <span
      aria-label="This interaction has deck conditions"
      className={styles.conditionBadge}
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

  const badgeClass =
    INTERACTION_TYPE_BADGE_CLASSES[interaction.type] ?? styles.typeBadgeFallback;

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
      className={styles.itemCard}
    >
      <div className={styles.itemHeader}>
        <div className={styles.itemHeaderLeft}>
          <span
            data-testid="interaction-type"
            className={[styles.typeBadge, badgeClass].join(" ")}
          >
            {INTERACTION_TYPE_LABELS[interaction.type] ?? interaction.type}
          </span>
          {conditions.length > 0 && (
            <ConditionBadge conditions={conditions} />
          )}
          {isCommandZoneInteraction && (
            <span
              data-testid="command-zone-badge"
              className={styles.commandZoneBadge}
            >
              Command Zone
            </span>
          )}
        </div>
        <StrengthBar strength={interaction.strength} />
      </div>
      <div className={styles.rollupSummary} style={{ marginBottom: "var(--space-5)" }}>
        <CardPill name={interaction.cards[0]} />
        <span className={styles.cardArrow} aria-hidden="true">
          &rarr;
        </span>
        <CardPill name={interaction.cards[1]} />
      </div>
      <p className={styles.mechanical}>
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
            className={styles.disclosureToggle}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={[
                styles.disclosureChevron,
                showCitations ? styles.disclosureChevronOpen : "",
              ].join(" ")}
            >
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                clipRule="evenodd"
              />
            </svg>
            <span className={styles.disclosureLabel}>
              {showCitations ? "Hide" : "Show"} rules text
            </span>
          </button>

          <div
            id={citationsId}
            className={[
              styles.expandable,
              showCitations ? styles.expandableOpen : "",
            ].join(" ")}
            aria-hidden={!showCitations}
          >
            <div className={styles.expandableInner}>
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
  const badgeClass =
    INTERACTION_TYPE_BADGE_CLASSES[group.type] ?? styles.typeBadgeFallback;
  const verb =
    group.anchorRole === "source"
      ? INTERACTION_VERBS[group.type]?.sourceVerb ?? group.type
      : INTERACTION_VERBS[group.type]?.targetVerb ?? group.type;

  return (
    <div
      data-testid={`interaction-${type}-${index}`}
      className={styles.itemCard}
    >
      {/* Header row: type badge + strength */}
      <div className={styles.itemHeader}>
        <span
          data-testid="interaction-type"
          className={[styles.typeBadge, badgeClass].join(" ")}
        >
          {INTERACTION_TYPE_LABELS[group.type] ?? group.type}
        </span>
        <StrengthBar strength={group.maxStrength} />
      </div>

      {/* Summary line: anchor card + verb + count + noun */}
      <div className={styles.rollupSummary}>
        <CardPill name={group.anchorCard} highlight />
        <span className={styles.rollupSummaryText}>
          {verb}{" "}
          <span className={styles.rollupSummaryCount}>
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
        className={[styles.disclosureToggle, styles.disclosureToggleChain].join(" ")}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={[
            styles.disclosureChevron,
            open ? styles.disclosureChevronOpen : "",
          ].join(" ")}
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
        <span className={styles.disclosureLabel}>
          {open ? "Hide" : "Show"} {group.interactions.length} {group.targetNoun}
        </span>
      </button>

      {/* Expandable sub-list — grid trick for smooth height animation */}
      <div
        className={[
          styles.expandable,
          open ? styles.expandableOpen : "",
        ].join(" ")}
        aria-hidden={!open}
      >
        <div className={styles.expandableInner}>
          <div
            id={contentId}
            className={styles.rollupSubPanel}
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
    <div className={styles.rollupSubRow}>
      <CardPill name={targetCard} />
      <span
        className={styles.rollupSubMechanical}
        title={mechanical}
      >
        {mechanical}
      </span>
      <span className={styles.rollupSubPct}>
        {pct}%
      </span>
    </div>
  );
}

function ChainItem({ chain, index }: { chain: InteractionChain; index: number }) {
  const [open, setOpen] = useState(false);
  const contentId = `chain-detail-${index}`;

  // Map interaction types to readable labels and CSS classes
  const typeLabel = (t: string): { text: string; className: string } => {
    switch (t) {
      case "enables":      return { text: "enables",          className: styles.chainTypeLabelEnables };
      case "triggers":     return { text: "triggers",         className: styles.chainTypeLabelTriggers };
      case "recurs":       return { text: "recurs",           className: styles.chainTypeLabelRecurs };
      case "reduces_cost": return { text: "reduces cost of",  className: styles.chainTypeLabelReduces };
      default:             return { text: t,                  className: styles.chainTypeLabelDefault };
    }
  };

  return (
    <div
      data-testid={`chain-${index}`}
      className={styles.itemCard}
    >
      {/* Card flow header */}
      <div className={styles.chainCards}>
        {chain.cards.map((card, i) => (
          <span key={`${card}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-3)" }}>
            {i > 0 && (
              <span className={styles.cardArrow} aria-hidden="true">
                &rarr;
              </span>
            )}
            <CardPill name={card} />
          </span>
        ))}
        {chain.strength !== undefined && (
          <span className={styles.chainStrengthPct}>
            {Math.round(chain.strength * 100)}%
          </span>
        )}
      </div>

      {/* Reasoning summary */}
      {chain.reasoning && (
        <p className={styles.chainReasoning}>
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
            className={[styles.disclosureToggle, styles.disclosureToggleChain].join(" ")}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={[
                styles.disclosureChevron,
                open ? styles.disclosureChevronOpen : "",
              ].join(" ")}
            >
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                clipRule="evenodd"
              />
            </svg>
            <span className={styles.disclosureLabel}>
              Step-by-step breakdown
            </span>
          </button>

          <div
            id={contentId}
            className={[
              styles.expandable,
              open ? styles.expandableOpen : "",
            ].join(" ")}
            aria-hidden={!open}
          >
            <div className={styles.expandableInner}>
              <ol className={styles.chainStepsList} aria-label="Chain steps">
                {chain.steps.map((step, i) => {
                  const label = typeLabel(step.interactionType);
                  return (
                    <li key={i} className={styles.chainStep}>
                      {/* Vertical connector */}
                      {i < chain.steps.length - 1 && (
                        <span
                          aria-hidden="true"
                          className={styles.chainConnector}
                        />
                      )}
                      {/* Step number circle */}
                      <span
                        aria-hidden="true"
                        className={styles.chainStepNum}
                      >
                        {i + 1}
                      </span>
                      {/* Step content */}
                      <div className={styles.chainStepContent}>
                        <div className={styles.chainStepCards}>
                          <CardPill name={step.from} />
                          <span className={label.className}>
                            {label.text}
                          </span>
                          <CardPill name={step.to} />
                        </div>
                        <p className={styles.chainStepDesc}>
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
    <div className={styles.howItWorksWrapper}>
      {/* Disclosure button */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((v) => !v)}
        className={[styles.disclosureToggle, styles.disclosureToggleLoop].join(" ")}
      >
        {/* Chevron */}
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={[
            styles.disclosureChevron,
            open ? styles.disclosureChevronOpen : "",
          ].join(" ")}
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
        <span className={styles.disclosureLabel}>
          How it works
        </span>
      </button>

      {/* Expandable content — grid trick for smooth height animation */}
      <div
        id={contentId}
        className={[
          styles.expandable,
          open ? styles.expandableOpen : "",
        ].join(" ")}
        aria-hidden={!open}
      >
        <div className={styles.expandableInner}>
          <div className={styles.howItWorksContent}>
            {/* Steps */}
            {hasSteps && (
              <ol className={styles.loopStepsList} aria-label="Loop steps">
                {loop.steps.map((step, i) => {
                  const isLast = i === loop.steps.length - 1;
                  return (
                    <li key={i} className={styles.loopStep}>
                      {/* Step number + vertical connector */}
                      <div className={styles.loopStepMarker}>
                        <span
                          className={styles.loopStepNum}
                          aria-hidden="true"
                        >
                          {i + 1}
                        </span>
                        {/* Connector line — hidden after last step */}
                        {!isLast && (
                          <span
                            className={styles.loopStepConnector}
                            aria-hidden="true"
                          />
                        )}
                      </div>

                      {/* Step content */}
                      <div className={isLast ? styles.loopStepBodyLast : styles.loopStepBody}>
                        {/* From → To card reference */}
                        <div className={styles.loopStepFromTo}>
                          <span className={styles.loopStepFromPill}>
                            {step.from}
                          </span>
                          {step.to && step.to !== step.from && (
                            <>
                              <span
                                className={styles.loopStepArrow}
                                aria-hidden="true"
                              >
                                &rarr;
                              </span>
                              <span className={styles.loopStepFromPill}>
                                {step.to}
                              </span>
                            </>
                          )}
                        </div>
                        {/* Step description */}
                        <p className={styles.loopStepDesc}>
                          {step.description}
                        </p>
                      </div>
                    </li>
                  );
                })}

                {/* Loop-back indicator */}
                <li className={styles.loopBackRow}>
                  <div className={styles.loopStepMarker}>
                    <span
                      className={styles.loopBackIcon}
                      aria-hidden="true"
                    >
                      &#8634;
                    </span>
                  </div>
                  <div className={styles.loopStepBodyLast}>
                    <p className={styles.loopBackText}>
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
              <div className={styles.netEffectSection}>
                <div className={styles.netEffectLabel}>
                  Net per cycle
                </div>
                <div className={styles.netEffectPills}>
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
                        className={styles.netEffectPill}
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
                        className={styles.netEffectPill}
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
              <div className={styles.prereqSection}>
                <div className={styles.prereqLabel}>
                  Requires each iteration
                </div>
                <ul className={styles.prereqList}>
                  {(loop.requires ?? []).map((cond, i) => (
                    <li
                      key={i}
                      className={styles.prereqItem}
                    >
                      <span
                        className={styles.prereqDot}
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
      className={[styles.itemCard, styles.itemCardLoop].join(" ")}
    >
      <div className={styles.loopHeader}>
        <span className={styles.loopLabel}>
          {loop.isInfinite ? "Infinite Loop" : "Loop"}
        </span>
        {loop.isInfinite && (
          <span className={styles.loopInfiniteBadge}>
            <span aria-hidden="true">&infin;</span> Infinite
          </span>
        )}
      </div>
      {/* Loop cycle visualization */}
      <div className={styles.loopCards}>
        {loop.cards.map((card, i) => (
          <span key={`${card}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-3)" }}>
            {i > 0 && (
              <span className={styles.loopArrow} aria-hidden="true">
                &rarr;
              </span>
            )}
            <CardPill name={card} />
          </span>
        ))}
        <span
          className={styles.loopBackArrow}
          title={`Loops back to ${loop.cards[0]}`}
          aria-label={`Loops back to ${loop.cards[0]}`}
        >
          &#8634;
        </span>
      </div>
      <p className={styles.loopDescription}>{loop.description}</p>

      {/* "How it works" expandable section */}
      <LoopHowItWorks loop={loop} id={loopId} />
    </div>
  );
}

function BlockerItem({ blocker, index }: { blocker: InteractionBlocker; index: number }) {
  return (
    <div
      data-testid={`blocker-${index}`}
      className={[styles.itemCard, styles.itemCardBlocker].join(" ")}
    >
      <div className={styles.enablerMeta} style={{ marginBottom: "var(--space-3)" }}>
        <span className={styles.blockerPill}>
          {blocker.blocker}
        </span>
        <span className={styles.blockerCountBadge}>
          Blocks {blocker.blockedInteractions.length} interaction
          {blocker.blockedInteractions.length !== 1 ? "s" : ""}
        </span>
      </div>
      <p className={styles.mechanical}>{blocker.description}</p>
    </div>
  );
}

function EnablerItem({ enabler, index }: { enabler: InteractionEnabler; index: number }) {
  return (
    <div
      data-testid={`enabler-${index}`}
      className={[styles.itemCard, styles.itemCardEnabler].join(" ")}
    >
      <div className={styles.enablerMeta}>
        <span className={styles.enablerPill}>
          {enabler.enabler}
        </span>
        {enabler.isRequired && (
          <span className={styles.enablerKeyBadge}>
            Key Enabler
          </span>
        )}
        <span className={styles.enablerCount}>
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
      className={styles.loadingState}
    >
      <span className={styles.loadingHeading}>
        Analyzing card interactions
      </span>

      {/* Progress bar */}
      <div className={styles.progressTrack}>
        <div
          className={styles.progressFill}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step list */}
      <div className={styles.stepsList}>
        {steps.map((step) => (
          <div key={step.id} className={styles.stepRow}>
            {step.status === "done" && (
              <svg className={styles.stepIconDone} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
            {step.status === "active" && (
              <svg className={styles.stepIconActive} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {step.status === "pending" && (
              <span className={styles.stepIconPendingWrapper}>
                <span className={styles.stepIconPendingDot} />
              </span>
            )}
            <span
              className={
                step.status === "done"
                  ? styles.stepLabelDone
                  : step.status === "active"
                  ? styles.stepLabelActive
                  : styles.stepLabelPending
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
    <div className={styles.summaryDashboard}>
      {/* Primary stats - 3 large cards */}
      <div className={styles.summaryGrid}>
        <div className={[styles.statTile, styles.statTileAccent].join(" ")}>
          <div className={[styles.statTileValue, styles.statTileValueAccent].join(" ")}>{totalInteractions}</div>
          <div className={styles.statTileLabel}>Interactions</div>
          <div className={styles.statTileSub}>detected</div>
        </div>
        <div className={[styles.statTile, styles.statTileLoop].join(" ")}>
          <div className={[styles.statTileValue, styles.statTileValueLoop].join(" ")}>{totalLoops}</div>
          <div className={styles.statTileLabel}>Loops Found</div>
          {infiniteLoops > 0 && (
            <div className={styles.statTileSubAccent}>{infiniteLoops} infinite</div>
          )}
        </div>
        <div className={[styles.statTile, styles.statTileOk].join(" ")}>
          <div className={[styles.statTileValue, styles.statTileValueOk].join(" ")}>{totalEnablers}</div>
          <div className={styles.statTileLabel}>Key Enablers</div>
          {topEnabler && (
            <div className={styles.statTileSub} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Top: {topEnabler}</div>
          )}
        </div>
      </div>

      {/* Secondary stats */}
      <div className={styles.secondaryStats}>
        <span className={styles.secondaryPill}>
          Chains: {analysis.chains.length}
        </span>
        <span className={styles.secondaryPill}>
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
    <div className={styles.filterControls}>
      {/* Card search */}
      <div className={styles.searchWrapper}>
        <svg
          className={styles.searchIcon}
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
          className={styles.searchInput}
          placeholder="Filter by card name..."
          aria-label="Filter interactions by card name"
        />
        {cardSearch && (
          <button
            type="button"
            onClick={() => onCardSearch("")}
            className={styles.searchClearBtn}
            aria-label="Clear search"
          >
            <svg className="" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        )}
      </div>

      {/* Type filter pills + strength + grouping in one row */}
      <div className={styles.typeStrengthRow}>
        {/* Type pills */}
        <div className={styles.typePillsGroup}>
          <button
            type="button"
            onClick={() => {
              // Clear all active types
              for (const t of activeTypes) onToggleType(t as InteractionType);
            }}
            className={[
              styles.filterPillBase,
              activeTypes.size === 0 ? styles.filterPillAll : "",
            ].join(" ")}
            aria-pressed={activeTypes.size === 0}
          >
            All {interactions.length}
          </button>
          {typesPresent.map((type) => {
            const isActive = activeTypes.has(type as InteractionType);
            const activeClass = TYPE_FILTER_PILL_CLASSES[type as InteractionType] ?? "";
            return (
              <button
                key={type}
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => onToggleType(type as InteractionType)}
                className={[
                  styles.filterPillBase,
                  isActive ? activeClass : "",
                ].join(" ")}
              >
                {INTERACTION_TYPE_LABELS[type as InteractionType] ?? type} {typeCounts[type]}
              </button>
            );
          })}
        </div>

        {/* Strength threshold */}
        <div className={styles.strengthGroup}>
          <span className={styles.strengthLabel}>Min:</span>
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
              className={[
                styles.filterPillBase,
                minStrength === value ? styles.filterPillAll : "",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grouping toggle + View mode toggle on the same row */}
      <div className={styles.groupViewRow}>
        {/* Group-by (only relevant in list mode) */}
        <div className={[
          styles.groupModeGroup,
          viewMode !== "list" ? styles.groupModeGroupDisabled : "",
        ].join(" ")}>
          <span className={styles.groupModeLabel}>Group by:</span>
          {(["type", "card", "strength"] as GroupMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onGroupMode(mode)}
              aria-pressed={groupMode === mode}
              className={[
                styles.segmentBtn,
                groupMode === mode ? styles.segmentBtnActive : "",
              ].join(" ")}
            >
              {mode === "type" ? "Type" : mode === "card" ? "Card" : "Strength"}
            </button>
          ))}
        </div>

        {/* View mode: List | Graph | Heatmap */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }} role="group" aria-label="View mode">
          {(["list", "graph", "heatmap"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onViewMode(mode)}
              aria-pressed={viewMode === mode}
              className={[
                styles.segmentBtn,
                viewMode === mode ? styles.segmentBtnActive : "",
              ].join(" ")}
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
        accentColor: INTERACTION_GROUP_COLORS[type as InteractionType] ?? "var(--ink-tertiary)",
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
        accentColor: "var(--accent)",
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
  if (high.length > 0) groups.push({ id: "high", label: "High (75%+)", accentColor: "var(--status-ok)", interactions: rawHigh, displayItems: high.sort((a, b) => getItemStrength(b) - getItemStrength(a)) });
  if (mid.length > 0) groups.push({ id: "mid", label: "Mid (50-75%)", accentColor: "var(--status-watch)", interactions: rawMid, displayItems: mid.sort((a, b) => getItemStrength(b) - getItemStrength(a)) });
  if (low.length > 0) groups.push({ id: "low", label: "Low (< 50%)", accentColor: "var(--ink-tertiary)", interactions: rawLow, displayItems: low.sort((a, b) => getItemStrength(b) - getItemStrength(a)) });
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
        className={styles.betaBanner}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={styles.betaBannerIcon}
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
            clipRule="evenodd"
          />
        </svg>
        <p className={styles.betaBannerText}>
          <span className={styles.betaBannerBold}>Interaction Engine (Beta)</span>
          {" — "}This feature uses a deterministic oracle text compiler to detect mechanical
          card interactions. Results may be incomplete for complex cards.
        </p>
      </div>

      {/* Loading state with progress steps */}
      {loading && <LoadingState steps={steps} progress={progress} />}

      {/* Error state */}
      {error && (
        <div role="alert" className={styles.errorAlert}>
          <p>
            <span style={{ fontWeight: "var(--weight-semibold)" }}>Analysis error:</span> {error}
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
            <div className={styles.filterSummary}>
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
                className={styles.clearFiltersBtn}
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Sections */}
          <div className={styles.sectionList}>
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
                  <p className={styles.centralityNote}>
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
                      className={styles.vizFallback}
                      style={{ height: 680 }}
                    >
                      <span className={styles.vizFallbackPulse}>Loading graph…</span>
                    </div>
                  }
                >
                  <InteractionGraph
                    analysis={analysis}
                    centrality={centralityResult ?? { scores: [], maxScore: 0, medianScore: 0 }}
                    selectedTypes={activeTypes.size > 0 ? activeTypes : undefined}
                    cardSearch={cardSearch}
                  />
                </Suspense>
              </div>
            )}

            {/* ─── Heatmap view ─────────────────────────────────────────────── */}
            {viewMode === "heatmap" && (
              <div data-testid="interaction-heatmap-view" className={styles.heatmapWrapper}>
                <Suspense
                  fallback={
                    <div
                      aria-live="polite"
                      className={styles.vizFallback}
                      style={{ paddingTop: "var(--space-32)", paddingBottom: "var(--space-32)" }}
                    >
                      <span className={styles.vizFallbackPulse}>Loading heatmap…</span>
                    </div>
                  }
                >
                  <InteractionHeatmap
                    analysis={analysis}
                    centrality={centralityResult ?? { scores: [], maxScore: 0, medianScore: 0 }}
                    selectedTypes={activeTypes.size > 0 ? activeTypes : undefined}
                    cardSearch={cardSearch}
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
                    <div className={styles.loopsList}>
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
                    <div className={styles.enablersList}>
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
                    <div className={styles.groupItems} style={{ gap: "var(--space-10)" }}>
                      {groups.map((group) => {
                        const limit = getGroupLimit(group.id);
                        const visible = group.displayItems.slice(0, limit);
                        return (
                          <div key={group.id}>
                            <h4
                              className={styles.groupHeading}
                              style={{ color: group.accentColor }}
                            >
                              {group.label}{" "}
                              <span className={styles.groupCount}>
                                ({group.interactions.length})
                              </span>
                            </h4>
                            <div className={styles.groupItems}>
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
                    <div className={styles.chainsList}>
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
                    <div className={styles.blockersList}>
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
