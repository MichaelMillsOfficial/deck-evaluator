"use client";

import { useState } from "react";
import type { EnrichedCard } from "@/lib/types";
import type { SpellbookCombo } from "@/lib/commander-spellbook";

interface VerifiedCombosProps {
  exactCombos: SpellbookCombo[];
  loading: boolean;
  cardMap: Record<string, EnrichedCard>;
}

function ComboItem({
  combo,
  index,
  variant,
  cardMap,
}: {
  combo: SpellbookCombo;
  index: number;
  variant: "exact" | "near";
  cardMap: Record<string, EnrichedCard>;
}) {
  const [expanded, setExpanded] = useState(false);
  const testIdPrefix = variant === "exact" ? "verified-combo-item" : "near-combo-item";
  const detailId = `${testIdPrefix}-detail-${index}`;

  const accentBorder =
    variant === "exact" ? "border-purple-500/30" : "border-amber-500/30";
  const accentBg =
    variant === "exact" ? "bg-purple-500/10" : "bg-amber-500/10";
  const accentText =
    variant === "exact" ? "text-purple-300" : "text-amber-300";
  const badgeBg =
    variant === "exact" ? "bg-purple-500/20" : "bg-amber-500/20";

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && expanded) {
      e.preventDefault();
      setExpanded(false);
    }
  }

  return (
    <li
      data-testid={`${testIdPrefix}-${index}`}
      className={`rounded-lg border ${accentBorder} ${accentBg}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-expanded={expanded}
        aria-controls={detailId}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${accentText}`}>
            {combo.cards.join(" + ")}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">{combo.description}</p>
          {combo.produces.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1" data-testid="combo-produces">
              {combo.produces.map((p, idx) => (
                <span
                  key={`${p}-${idx}`}
                  className="rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] font-medium text-slate-300"
                >
                  {p}
                </span>
              ))}
            </div>
          )}
          {variant === "near" && combo.missingCards.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              <span className="text-[10px] text-amber-400 font-medium">Missing:</span>
              {combo.missingCards.map((name) => (
                <span
                  key={name}
                  data-testid={`missing-card-${name}`}
                  className="rounded-full border border-dashed border-amber-500/40 px-2 py-0.5 text-[10px] font-medium text-amber-400"
                >
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {combo.bracketTag && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeBg} ${accentText}`}
            >
              Bracket {combo.bracketTag}
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeBg} ${accentText}`}
          >
            {variant === "exact" ? "Verified" : "Near"}
          </span>
          <svg
            aria-hidden="true"
            className={`h-4 w-4 text-slate-400 transition-transform motion-reduce:transition-none ${
              expanded ? "rotate-180" : ""
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </button>
      {expanded && (
        <div
          id={detailId}
          data-testid="combo-card-images"
          className="border-t border-slate-700/50 px-3 py-3"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            {combo.cards.map((cardName) => {
              const enriched = cardMap[cardName];
              const imageUrl = enriched?.imageUris?.normal;
              const isMissing = combo.missingCards.includes(cardName);
              return (
                <div
                  key={cardName}
                  className={`flex-1 ${isMissing ? "opacity-50" : ""}`}
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={cardName}
                      className={`w-full rounded-lg ${
                        isMissing ? "border-2 border-dashed border-amber-500/40" : ""
                      }`}
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className={`flex items-center justify-center rounded-lg border px-4 py-8 ${
                        isMissing
                          ? "border-dashed border-amber-500/40 bg-amber-500/5"
                          : "border-slate-700 bg-slate-800"
                      }`}
                    >
                      <p
                        className={`text-sm ${
                          isMissing ? "text-amber-400" : "text-slate-400"
                        }`}
                      >
                        {cardName}
                        {isMissing && (
                          <span className="block text-[10px] mt-1">(not in deck)</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {combo.templateRequirements.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-medium text-slate-400">
                Also requires:
              </p>
              {combo.templateRequirements.map((req, idx) => (
                <p key={`${req}-${idx}`} className="text-xs italic text-slate-300 mt-0.5">
                  {req}
                </p>
              ))}
            </div>
          )}
          {combo.manaNeeded && (
            <p className="mt-2 text-[10px] text-slate-400">
              Mana needed: <span className="text-slate-300">{combo.manaNeeded}</span>
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function LoadingShimmer() {
  return (
    <div data-testid="spellbook-loading" className="space-y-2 animate-pulse motion-reduce:animate-none">
      <div className="h-12 rounded-lg bg-slate-700/30" />
      <div className="h-12 rounded-lg bg-slate-700/30" />
    </div>
  );
}

export default function VerifiedCombos({
  exactCombos,
  loading,
  cardMap,
}: VerifiedCombosProps) {
  if (loading) {
    return <LoadingShimmer />;
  }

  // Render the exact combos section content
  return (
    <div data-testid="verified-combos-section">
      {exactCombos.length > 0 ? (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Verified Combos
            </h4>
            <span className="text-[10px] text-slate-500">
              via Commander Spellbook
            </span>
          </div>
          <ul className="space-y-2">
            {exactCombos.map((combo, i) => (
              <ComboItem
                key={combo.id}
                combo={combo}
                index={i}
                variant="exact"
                cardMap={cardMap}
              />
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          No verified combos found in Commander Spellbook.
        </p>
      )}
    </div>
  );
}

export function NearCombos({
  nearCombos,
  loading,
  cardMap,
}: {
  nearCombos: SpellbookCombo[];
  loading: boolean;
  cardMap: Record<string, EnrichedCard>;
}) {
  if (loading) {
    return <LoadingShimmer />;
  }

  if (nearCombos.length === 0) {
    return null;
  }

  return (
    <div data-testid="near-combos-section">
      <div className="mb-2 flex items-center gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-400">
          Almost There
        </h4>
        <span className="text-[10px] text-slate-500">
          1-2 cards away
        </span>
      </div>
      <ul className="space-y-2">
        {nearCombos.map((combo, i) => (
          <ComboItem
            key={combo.id}
            combo={combo}
            index={i}
            variant="near"
            cardMap={cardMap}
          />
        ))}
      </ul>
    </div>
  );
}
