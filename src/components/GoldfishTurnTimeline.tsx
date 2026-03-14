"use client";

import { useState, useCallback } from "react";
import CollapsiblePanel from "@/components/CollapsiblePanel";
import type { GoldfishGameLog, GoldfishTurnLog } from "@/lib/goldfish-simulator";

interface GoldfishTurnTimelineProps {
  game: GoldfishGameLog;
}

function TurnSummary({ log }: { log: GoldfishTurnLog }) {
  const parts: string[] = [];
  if (log.landPlayed) parts.push(`Land: ${log.landPlayed}`);
  if (log.spellsCast.length > 0) {
    parts.push(
      `${log.spellsCast.length} spell${log.spellsCast.length !== 1 ? "s" : ""}`
    );
  }
  if (parts.length === 0) parts.push("No plays");
  return (
    <span className="text-xs text-slate-400">
      {parts.join(" · ")} · {log.manaAvailable}
      <span className="text-slate-500"> mana</span>
    </span>
  );
}

export default function GoldfishTurnTimeline({ game }: GoldfishTurnTimelineProps) {
  const [expandedTurns, setExpandedTurns] = useState<Set<number>>(new Set());

  const toggleTurn = useCallback((turn: number) => {
    setExpandedTurns((prev) => {
      const next = new Set(prev);
      if (next.has(turn)) {
        next.delete(turn);
      } else {
        next.add(turn);
      }
      return next;
    });
  }, []);

  return (
    <div
      data-testid="goldfish-turn-timeline"
      className="space-y-2"
      aria-label="Sample game turn-by-turn breakdown"
    >
      {game.turnLogs.map((log) => (
        <CollapsiblePanel
          key={log.turn}
          id={`goldfish-turn-${log.turn}`}
          title={`Turn ${log.turn}${log.commanderCast ? " — Commander cast!" : ""}`}
          summary={<TurnSummary log={log} />}
          expanded={expandedTurns.has(log.turn)}
          onToggle={() => toggleTurn(log.turn)}
          testId={`goldfish-turn-panel-${log.turn}`}
        >
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
        </CollapsiblePanel>
      ))}
    </div>
  );
}
