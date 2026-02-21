"use client";

import { useState, useCallback } from "react";
import type { EnrichedCard } from "@/lib/types";
import ManaCost from "@/components/ManaCost";
import CardTags from "@/components/CardTags";
import OracleText from "@/components/OracleText";

interface EnrichedCardRowProps {
  card: EnrichedCard;
  quantity: number;
}

export default function EnrichedCardRow({
  card,
  quantity,
}: EnrichedCardRowProps) {
  const [open, setOpen] = useState(false);

  const detailId = `card-detail-${card.name.replace(/[^a-zA-Z0-9]/g, "-")}`;

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
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
