"use client";

import { useState, useCallback } from "react";
import CollapsiblePanel from "@/components/CollapsiblePanel";
import GoldfishOpeningHandDisplay from "@/components/GoldfishOpeningHand";
import GoldfishTurnPanel from "@/components/GoldfishTurnPanel";
import type {
  GoldfishGameLog,
  GoldfishTurnLog,
} from "@/lib/goldfish-simulator";

interface GoldfishTurnTimelineProps {
  game: GoldfishGameLog;
}

function TurnSummary({ log }: { log: GoldfishTurnLog }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
      {/* Micro-badges */}
      {log.landPlayed && (
        <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
          {log.landPlayed.length > 12 ? log.landPlayed.slice(0, 12) + "…" : log.landPlayed}
        </span>
      )}
      {log.commanderCast && (
        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
          Commander
        </span>
      )}
      {log.spellsCast.length > 0 && (
        <span className="rounded-full bg-slate-700/50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
          {log.spellsCast.length} spell{log.spellsCast.length !== 1 ? "s" : ""}
        </span>
      )}
      <span className="text-slate-500">
        · {log.manaAvailable} mana
      </span>
    </span>
  );
}

export default function GoldfishTurnTimeline({ game }: GoldfishTurnTimelineProps) {
  const [expandedTurns, setExpandedTurns] = useState<Set<number>>(
    new Set([-1]) // -1 = opening hand, expanded by default
  );

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
      {/* Opening hand */}
      <CollapsiblePanel
        id="goldfish-opening-hand"
        title="Opening Hand"
        summary={
          <span className="text-xs text-slate-400">
            {game.openingHand.cards.length} cards ·{" "}
            <span className={
              game.openingHand.verdict === "Strong Keep"
                ? "text-green-400"
                : game.openingHand.verdict === "Keepable"
                  ? "text-blue-400"
                  : game.openingHand.verdict === "Marginal"
                    ? "text-yellow-400"
                    : "text-red-400"
            }>
              {game.openingHand.verdict}
            </span>
            {" · "}Score {Math.round(game.openingHand.score)}
          </span>
        }
        expanded={expandedTurns.has(-1)}
        onToggle={() => toggleTurn(-1)}
        testId="goldfish-opening-hand-panel"
      >
        <GoldfishOpeningHandDisplay hand={game.openingHand} />
      </CollapsiblePanel>

      {/* Turns */}
      {game.turnLogs.map((log, idx) => (
        <CollapsiblePanel
          key={log.turn}
          id={`goldfish-turn-${log.turn}`}
          title={`Turn ${log.turn}${log.commanderCast ? " — Commander cast!" : ""}`}
          summary={<TurnSummary log={log} />}
          expanded={expandedTurns.has(log.turn)}
          onToggle={() => toggleTurn(log.turn)}
          testId={`goldfish-turn-panel-${log.turn}`}
        >
          <GoldfishTurnPanel
            log={log}
          />
        </CollapsiblePanel>
      ))}
    </div>
  );
}
