"use client";

import type {
  GoldfishTurnLog,
  CardDraw,
  LibraryAction,
} from "@/lib/goldfish-simulator";
import GoldfishZoneBar from "@/components/GoldfishZoneBar";

interface GoldfishTurnPanelProps {
  log: GoldfishTurnLog;
  previousLog?: GoldfishTurnLog;
}

export default function GoldfishTurnPanel({ log, previousLog }: GoldfishTurnPanelProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-4">
      {/* Left column: actions */}
      <div className="space-y-3 text-sm">
        {/* Mana state */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-900/50 px-3 py-2">
            <p className="text-xs text-slate-500">Mana Available</p>
            <p className="font-semibold text-purple-300">{log.manaAvailable}</p>
          </div>
          <div className="rounded-lg bg-slate-900/50 px-3 py-2">
            <p className="text-xs text-slate-500">Mana Used</p>
            <p className="font-semibold text-blue-300">{log.manaUsed}</p>
          </div>
          <div className="rounded-lg bg-slate-900/50 px-3 py-2">
            <p className="text-xs text-slate-500">Hand Size</p>
            <p className="font-semibold text-slate-300">{log.handSize}</p>
          </div>
          <div className="rounded-lg bg-slate-900/50 px-3 py-2">
            <p className="text-xs text-slate-500">Permanents</p>
            <p className="font-semibold text-green-300">{log.permanentCount}</p>
          </div>
        </div>

        {/* Cards drawn */}
        {log.cardsDrawn.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cards Drawn ({log.cardsDrawn.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {log.cardsDrawn.map((draw: CardDraw, i: number) => (
                <div key={i} className="flex items-center gap-2 rounded bg-slate-900/50 px-2 py-1">
                  {draw.imageUri && (
                    <img
                      src={draw.imageUri}
                      alt={draw.name}
                      width={32}
                      height={45}
                      className="rounded border border-slate-600"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-sky-300">{draw.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {draw.source === "draw-step"
                        ? "Draw step"
                        : draw.source === "brainstorm"
                          ? "Brainstorm"
                          : draw.source === "ponder"
                            ? "Ponder"
                            : draw.source === "scry-kept"
                              ? "Scry (kept)"
                              : "Card draw spell"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Library manipulation */}
        {log.libraryActions && log.libraryActions.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Library Manipulation ({log.libraryActions.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {log.libraryActions.map((action: LibraryAction, i: number) => (
                <div key={i} className="flex items-center gap-2 rounded bg-slate-900/50 px-2 py-1">
                  {action.cardName && (
                    <span className="text-sm text-slate-300">{action.cardName}</span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      action.action === "kept-on-top"
                        ? "bg-cyan-500/20 text-cyan-300"
                        : action.action === "bottomed"
                          ? "bg-slate-500/20 text-slate-400"
                          : action.action === "graveyard"
                            ? "bg-rose-500/20 text-rose-300"
                            : action.action === "put-back-from-hand"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-purple-500/20 text-purple-300"
                    }`}
                  >
                    {action.action === "kept-on-top"
                      ? "Kept on top"
                      : action.action === "bottomed"
                        ? "Bottomed"
                        : action.action === "graveyard"
                          ? "To graveyard"
                          : action.action === "put-back-from-hand"
                            ? "Put back"
                            : "Shuffled"}
                  </span>
                  {action.source && (
                    <span className="text-[10px] text-slate-500">({action.source})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Land played */}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Land Played
          </p>
          {log.landPlayed ? (
            <p className="rounded bg-slate-900/50 px-2 py-1 text-emerald-300">
              {log.landPlayed}
            </p>
          ) : (
            <p className="text-xs text-slate-500 italic">No land played</p>
          )}
        </div>

        {/* Spells cast */}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Spells Cast {log.spellsCast.length > 0 && `(${log.spellsCast.length})`}
          </p>
          {log.spellsCast.length > 0 ? (
            <ul className="space-y-1">
              {log.spellsCast.map((spell, i) => (
                <li
                  key={i}
                  className="rounded bg-slate-900/50 px-2 py-1 text-slate-300"
                >
                  {spell}
                  {log.commanderCast && i === log.spellsCast.indexOf(spell) && spell.includes("Commander") && (
                    <span className="ml-2 text-xs text-amber-400">(Commander)</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 italic">No spells cast</p>
          )}
        </div>

        {/* Hand contents */}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Hand {log.hand.length > 0 && `(${log.hand.length})`}
          </p>
          {log.hand.length > 0 ? (
            <ul className="space-y-1">
              {log.hand.map((card, i) => (
                <li
                  key={i}
                  className="rounded bg-slate-900/50 px-2 py-1 text-slate-400"
                >
                  {card}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 italic">Empty hand</p>
          )}
        </div>
      </div>

      {/* Right column: zone bar */}
      <div className="order-first sm:order-last">
        <GoldfishZoneBar log={log} previousLog={previousLog} />
      </div>
    </div>
  );
}
