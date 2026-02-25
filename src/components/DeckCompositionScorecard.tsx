"use client";

import { useState, useCallback, useId } from "react";
import type { DeckData, EnrichedCard } from "@/lib/types";
import {
  computeCompositionScorecard,
  AVAILABLE_TEMPLATES,
  type CategoryResult,
  type CompositionTemplate,
  type OverallHealth,
} from "@/lib/deck-composition";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DeckCompositionScorecardProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard>;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function getStatusColor(status: CategoryResult["status"]): string {
  switch (status) {
    case "good":
      return "text-green-400";
    case "low":
      return "text-yellow-400";
    case "critical":
      return "text-red-400";
    case "high":
      return "text-blue-400";
  }
}

function getStatusBadgeClasses(status: CategoryResult["status"]): string {
  switch (status) {
    case "good":
      return "bg-green-900/50 text-green-400 border-green-700";
    case "low":
      return "bg-yellow-900/50 text-yellow-400 border-yellow-700";
    case "critical":
      return "bg-red-900/50 text-red-400 border-red-700";
    case "high":
      return "bg-blue-900/50 text-blue-400 border-blue-700";
  }
}

function getStatusBarColor(status: CategoryResult["status"]): string {
  switch (status) {
    case "good":
      return "bg-green-500";
    case "low":
      return "bg-yellow-500";
    case "critical":
      return "bg-red-500";
    case "high":
      return "bg-blue-500";
  }
}

function getStatusIcon(status: CategoryResult["status"]): React.ReactNode {
  switch (status) {
    case "good":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 text-green-400 shrink-0"
        >
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "low":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 text-yellow-400 shrink-0"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "critical":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 text-red-400 shrink-0"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "high":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 text-blue-400 shrink-0"
        >
          <path
            fillRule="evenodd"
            d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
            clipRule="evenodd"
          />
        </svg>
      );
  }
}

function getHealthBannerClasses(health: OverallHealth): string {
  switch (health) {
    case "healthy":
      return "bg-green-900/40 border-green-700 text-green-300";
    case "needs-attention":
      return "bg-yellow-900/40 border-yellow-700 text-yellow-300";
    case "major-gaps":
      return "bg-red-900/40 border-red-700 text-red-300";
  }
}

function getHealthIcon(health: OverallHealth): React.ReactNode {
  switch (health) {
    case "healthy":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5 text-green-400 shrink-0"
        >
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "needs-attention":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5 text-yellow-400 shrink-0"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "major-gaps":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5 text-red-400 shrink-0"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      );
  }
}

// ---------------------------------------------------------------------------
// CategoryRow sub-component
// ---------------------------------------------------------------------------

interface CategoryRowProps {
  category: CategoryResult;
}

function CategoryRow({ category }: CategoryRowProps) {
  const [open, setOpen] = useState(false);
  const cardListId = useId();

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    },
    [open]
  );

  // Bar fill: scale count relative to max + some headroom
  const barMax = Math.max(category.max * 1.5, category.count);
  const barPct = barMax > 0 ? Math.min(100, (category.count / barMax) * 100) : 0;

  const statusBarColor = getStatusBarColor(category.status);

  return (
    <div
      data-testid="composition-category"
      className="rounded-lg bg-slate-800/40 px-3 py-2"
    >
      {/* Row header */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={cardListId}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className="flex w-full items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded-sm min-h-[44px]"
      >
        {/* Status icon */}
        {getStatusIcon(category.status)}

        {/* Label */}
        <span className="flex-1 text-sm font-medium text-slate-200">
          {category.label}
        </span>

        {/* Count badge */}
        <span
          className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${getStatusBadgeClasses(category.status)}`}
        >
          {category.count}
          <span className="ml-1 font-normal opacity-70">
            / {category.min}–{category.max}
          </span>
        </span>

        {/* Chevron */}
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-90" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Progress bar */}
      <div className="mb-1 mt-1 h-1.5 overflow-hidden rounded-full bg-slate-700">
        <div
          role="progressbar"
          aria-valuenow={category.count}
          aria-valuemin={0}
          aria-valuemax={category.max}
          aria-label={`${category.label}: ${category.count} of target ${category.min}–${category.max}`}
          className={`h-full rounded-full transition-all ${statusBarColor}`}
          style={{ width: `${barPct}%` }}
        />
      </div>

      {/* Status message */}
      <p className={`text-xs ${getStatusColor(category.status)}`}>
        {category.statusMessage}
      </p>

      {/* Expandable card list */}
      {open && (
        <div
          id={cardListId}
          data-testid="category-cards"
          className="mt-2 rounded-md bg-slate-900/50 px-3 py-2"
        >
          {category.cards.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No cards in this category</p>
          ) : (
            <ul className="space-y-0.5">
              {category.cards.map((card) => (
                <li
                  key={card.name}
                  className="flex items-center justify-between text-xs text-slate-300"
                >
                  <span>{card.name}</span>
                  {card.quantity > 1 && (
                    <span className="ml-2 text-slate-500 font-mono">
                      x{card.quantity}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DeckCompositionScorecard({
  deck,
  cardMap,
}: DeckCompositionScorecardProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<CompositionTemplate>(
    AVAILABLE_TEMPLATES[0]
  );
  const [untaggedOpen, setUntaggedOpen] = useState(false);

  const untaggedListId = useId();
  const headingId = useId();

  const handleUntaggedKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && untaggedOpen) {
        e.preventDefault();
        setUntaggedOpen(false);
      }
    },
    [untaggedOpen]
  );

  const result = computeCompositionScorecard(deck, cardMap, selectedTemplate);

  return (
    <section aria-labelledby={headingId}>
      {/* Heading */}
      <h3
        id={headingId}
        className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300"
      >
        Composition Scorecard
      </h3>
      <p className="mb-4 text-xs text-slate-400">
        Validate deck against community-sourced functional category targets
      </p>

      {/* Template selector */}
      <div className="mb-4">
        <label
          htmlFor="template-selector"
          className="mb-1 block text-xs text-slate-400"
        >
          Template
        </label>
        <select
          id="template-selector"
          data-testid="template-selector"
          value={selectedTemplate.id}
          onChange={(e) => {
            const tpl = AVAILABLE_TEMPLATES.find((t) => t.id === e.target.value);
            if (tpl) setSelectedTemplate(tpl);
          }}
          className="w-full rounded-md bg-slate-800/50 border border-slate-700 px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
        >
          {AVAILABLE_TEMPLATES.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">{selectedTemplate.description}</p>
      </div>

      {/* Health summary banner */}
      <div
        data-testid="composition-health-summary"
        className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 ${getHealthBannerClasses(result.overallHealth)}`}
        role="status"
        aria-live="polite"
      >
        {getHealthIcon(result.overallHealth)}
        <span className="text-sm font-medium">{result.healthSummary}</span>
      </div>

      {/* Category rows */}
      <div className="space-y-2">
        {result.categories.map((cat) => (
          <CategoryRow key={cat.tag} category={cat} />
        ))}
      </div>

      {/* Untagged cards */}
      {result.untaggedCount > 0 && (
        <div
          data-testid="composition-untagged"
          className="mt-3 rounded-lg bg-slate-800/40 px-3 py-2"
        >
          <button
            type="button"
            aria-expanded={untaggedOpen}
            aria-controls={untaggedListId}
            onClick={() => setUntaggedOpen((prev) => !prev)}
            onKeyDown={handleUntaggedKeyDown}
            className="flex w-full items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded-sm min-h-[44px]"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 text-slate-400 shrink-0"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                clipRule="evenodd"
              />
            </svg>
            <span className="flex-1 text-sm font-medium text-slate-300">
              Untagged cards
            </span>
            <span className="inline-flex items-center rounded border border-slate-600 px-2 py-0.5 text-xs font-semibold text-slate-400 bg-slate-900/50">
              {result.untaggedCount}
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 motion-reduce:transition-none ${untaggedOpen ? "rotate-90" : ""}`}
            >
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <p className="mt-1 text-xs text-slate-500">
            Cards with no functional tag — synergy/theme pieces or narrow effects
          </p>
          {untaggedOpen && (
            <div
              id={untaggedListId}
              className="mt-2 rounded-md bg-slate-900/50 px-3 py-2"
            >
              <ul className="space-y-0.5">
                {result.untaggedCards.map((card) => (
                  <li
                    key={card.name}
                    className="flex items-center justify-between text-xs text-slate-300"
                  >
                    <span>{card.name}</span>
                    {card.quantity > 1 && (
                      <span className="ml-2 text-slate-500 font-mono">
                        x{card.quantity}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
