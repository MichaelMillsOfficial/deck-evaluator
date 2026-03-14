"use client";

import { useState, useCallback } from "react";
import CollapsiblePanel from "@/components/CollapsiblePanel";
import ManaCost from "@/components/ManaCost";
import type {
  GoldfishGameLog,
  GoldfishTurnLog,
  GoldfishOpeningHand,
  CardDraw,
} from "@/lib/goldfish-simulator";

interface GoldfishTurnTimelineProps {
  game: GoldfishGameLog;
}

const VERDICT_STYLES: Record<string, string> = {
  "Strong Keep": "text-green-300 bg-green-500/20 border-green-500/30",
  Keepable: "text-blue-300 bg-blue-500/20 border-blue-500/30",
  Marginal: "text-yellow-300 bg-yellow-500/20 border-yellow-500/30",
  Mulligan: "text-red-300 bg-red-500/20 border-red-500/30",
};

function OpeningHandDisplay({ hand }: { hand: GoldfishOpeningHand }) {
  const verdictStyle = VERDICT_STYLES[hand.verdict] ?? "text-slate-300 bg-slate-500/20 border-slate-500/30";

  return (
    <div className="space-y-3">
      {/* Score + verdict badge */}
      <div className="flex items-center gap-3">
        <span
          className={`rounded-full border px-3 py-1 text-sm font-semibold ${verdictStyle}`}
        >
          {hand.verdict}
        </span>
        <span className="text-sm text-slate-400">
          Score: <span className="font-semibold text-slate-200">{Math.round(hand.score)}</span>
          <span className="text-slate-500">/100</span>
        </span>
      </div>

      {/* Card images row */}
      <div className="flex flex-wrap gap-2 justify-center">
        {hand.cards.map((card, i) => (
          <div key={`${card.name}-${i}`} className="flex flex-col items-center gap-1">
            {card.imageUri ? (
              <img
                src={card.imageUri}
                alt={card.name}
                width={110}
                height={154}
                className="rounded-lg shadow-lg border border-slate-600"
              />
            ) : (
              <div
                role="img"
                className="flex flex-col items-center justify-center rounded-lg border border-slate-600 bg-slate-700/50 text-center px-1"
                style={{ width: 110, height: 154 }}
                aria-label={card.name}
              >
                <p className="text-[9px] font-medium text-slate-200 leading-tight">
                  {card.name}
                </p>
                <ManaCost cost={card.manaCost} />
                <p className="mt-1 text-[8px] text-slate-400 leading-tight">
                  {card.typeLine}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reasoning */}
      {hand.reasoning.length > 0 && (
        <ul className="space-y-0.5 text-xs text-slate-400">
          {hand.reasoning.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TurnSummary({ log }: { log: GoldfishTurnLog }) {
  const parts: string[] = [];
  if (log.cardsDrawn.length > 0) {
    const drawStepCount = log.cardsDrawn.filter((d) => d.source === "draw-step").length;
    const spellDrawCount = log.cardsDrawn.length - drawStepCount;
    const drawParts: string[] = [];
    if (drawStepCount > 0) drawParts.push(`${drawStepCount} draw step`);
    if (spellDrawCount > 0) drawParts.push(`${spellDrawCount} from spells`);
    parts.push(`Drew ${log.cardsDrawn.length}`);
  }
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
        <OpeningHandDisplay hand={game.openingHand} />
      </CollapsiblePanel>

      {/* Turns */}
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
                          {draw.source === "draw-step" ? "Draw step" : "Card draw spell"}
                        </p>
                      </div>
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
        </CollapsiblePanel>
      ))}
    </div>
  );
}
