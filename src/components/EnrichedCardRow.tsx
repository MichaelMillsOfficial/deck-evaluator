"use client";

import { useState, useCallback } from "react";
import type { CardFace, EnrichedCard } from "@/lib/types";
import ManaCost from "@/components/ManaCost";
import CardTags from "@/components/CardTags";
import OracleText from "@/components/OracleText";
import { formatUSD } from "@/lib/budget-analysis";
import { getFaceDisplayMode } from "@/lib/card-layout";

// ---------------------------------------------------------------------------
// CardFaceDetail — renders a single face's details (reused by tabs & inline)
// ---------------------------------------------------------------------------

function CardFaceDetail({ face }: { face: CardFace }) {
  return (
    <div className="space-y-2 text-sm" data-testid={`face-detail-${face.name.replace(/[^a-zA-Z0-9]/g, "-")}`}>
      <p className="text-slate-400 text-xs">{face.typeLine}</p>
      {face.manaCost && (
        <div>
          <ManaCost cost={face.manaCost} />
        </div>
      )}
      {face.oracleText && <OracleText text={face.oracleText} />}
      <div className="flex flex-wrap gap-3 text-xs text-slate-400">
        {face.power !== null && face.toughness !== null && (
          <span>
            P/T: {face.power}/{face.toughness}
          </span>
        )}
        {face.loyalty !== null && <span>Loyalty: {face.loyalty}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multi-face detail renderers
// ---------------------------------------------------------------------------

function TabsFaceDetail({
  faces,
  activeFace,
  setActiveFace,
}: {
  faces: CardFace[];
  activeFace: number;
  setActiveFace: (i: number) => void;
}) {
  return (
    <div>
      <div className="flex gap-1 mb-2" role="tablist" aria-label="Card faces">
        {faces.map((face, i) => (
          <button
            key={face.name}
            role="tab"
            aria-selected={i === activeFace}
            aria-controls={`face-panel-${i}`}
            onClick={() => setActiveFace(i)}
            className={`px-2 py-0.5 text-xs rounded ${
              i === activeFace
                ? "text-purple-300 bg-purple-500/20"
                : "text-slate-400 bg-slate-700/50 hover:bg-slate-700 hover:text-slate-300"
            }`}
          >
            {face.name}
          </button>
        ))}
      </div>
      <div id={`face-panel-${activeFace}`} role="tabpanel">
        <CardFaceDetail face={faces[activeFace]} />
      </div>
    </div>
  );
}

function InlineFaceDetail({ faces }: { faces: CardFace[] }) {
  return (
    <div>
      {faces.map((face, i) => (
        <div key={face.name}>
          {i > 0 && <div className="border-t border-slate-700/50 mt-2 pt-2" />}
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
            {face.name}
          </p>
          <CardFaceDetail face={face} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EnrichedCardRow
// ---------------------------------------------------------------------------

interface EnrichedCardRowProps {
  card: EnrichedCard;
  quantity: number;
}

export default function EnrichedCardRow({
  card,
  quantity,
}: EnrichedCardRowProps) {
  const [open, setOpen] = useState(false);
  const [activeFace, setActiveFace] = useState(0);

  const detailId = `card-detail-${card.name.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const displayMode = getFaceDisplayMode(card.layout);
  const isMultiFace = (card.cardFaces?.length ?? 0) > 1;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    },
    [open]
  );

  return (
    <>
      <tr className="border-b border-slate-700/50 hover:bg-slate-700/30">
        <td className="py-1.5 pr-2 text-right font-mono text-slate-400 whitespace-nowrap">
          <span className="sr-only">{quantity}x </span>
          {quantity}
        </td>
        <td className="py-1.5 px-2 whitespace-nowrap">
          <ManaCost cost={card.manaCost} />
        </td>
        <td className="py-1.5 px-2">
          <div className="flex flex-col gap-1 min-w-0">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={detailId}
              onClick={() => setOpen(!open)}
              onKeyDown={handleKeyDown}
              className="flex items-center gap-1.5 min-h-[44px] min-w-0 text-left text-slate-200 hover:text-purple-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded-sm"
            >
              <svg
                data-testid="expand-chevron"
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
              <span className="min-w-0">
                {card.name}
                {card.flavorName && (
                  <span className="block text-xs text-slate-400 truncate">
                    ({card.flavorName})
                  </span>
                )}
              </span>
            </button>
            <CardTags card={card} />
          </div>
        </td>
        <td className="py-1.5 pl-2 text-slate-400 text-xs whitespace-nowrap hidden sm:table-cell">
          {card.typeLine}
        </td>
      </tr>
      {open && (
        <tr id={detailId} className="bg-slate-900/50">
          <td colSpan={4} className="px-4 py-3">
            {/* Multi-face: tabs or inline based on layout */}
            {isMultiFace && displayMode === "tabs" && (
              <TabsFaceDetail
                faces={card.cardFaces}
                activeFace={activeFace}
                setActiveFace={setActiveFace}
              />
            )}
            {isMultiFace && displayMode === "inline" && (
              <InlineFaceDetail faces={card.cardFaces} />
            )}

            {/* Single-face or fallback: original rendering */}
            {(!isMultiFace || displayMode === "single") && (
              <div className="space-y-2 text-sm">
                {/* Type line (visible on mobile since column is hidden) */}
                <p className="text-slate-400 sm:hidden">{card.typeLine}</p>

                {/* Oracle text */}
                {card.oracleText && <OracleText text={card.oracleText} />}

                {/* Stats row */}
                <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                  {card.power !== null && card.toughness !== null && (
                    <span>
                      P/T: {card.power}/{card.toughness}
                    </span>
                  )}
                  {card.loyalty !== null && <span>Loyalty: {card.loyalty}</span>}
                  {card.keywords.length > 0 && (
                    <span>Keywords: {card.keywords.join(", ")}</span>
                  )}
                  <span className="capitalize">Rarity: {card.rarity}</span>
                  {card.prices.usd != null && (
                    <span data-testid="card-price">Price: {formatUSD(card.prices.usd)}</span>
                  )}
                </div>
              </div>
            )}

            {/* Shared stats for multi-face cards (keywords, rarity, price) */}
            {isMultiFace && displayMode !== "single" && (
              <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-2">
                {card.keywords.length > 0 && (
                  <span>Keywords: {card.keywords.join(", ")}</span>
                )}
                <span className="capitalize">Rarity: {card.rarity}</span>
                {card.prices.usd != null && (
                  <span data-testid="card-price">Price: {formatUSD(card.prices.usd)}</span>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
