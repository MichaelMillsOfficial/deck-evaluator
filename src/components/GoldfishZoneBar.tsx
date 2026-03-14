"use client";

import { useState } from "react";
import type { GoldfishTurnLog, PermanentSnapshot } from "@/lib/goldfish-simulator";

interface GoldfishZoneBarProps {
  log: GoldfishTurnLog;
  previousLog?: GoldfishTurnLog;
}

interface ZoneCardProps {
  label: string;
  count: number;
  delta: number;
  color: string;
  borderColor: string;
  testId: string;
  expandable?: boolean;
  children?: React.ReactNode;
}

function ZoneCard({
  label,
  count,
  delta,
  color,
  borderColor,
  testId,
  expandable,
  children,
}: ZoneCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      data-testid={testId}
      className={`rounded-lg border border-slate-700/50 border-l-2 px-3 py-2 bg-slate-900/50 ${borderColor}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {expandable ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-300"
              aria-expanded={expanded}
            >
              <span
                className={`inline-block text-[10px] transition-transform ${expanded ? "rotate-90" : ""}`}
              >
                ▶
              </span>
              <span>{label}</span>
            </button>
          ) : (
            <span className="text-xs font-semibold text-slate-400">{label}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-bold ${color}`}>{count}</span>
          {delta > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${color} bg-slate-800/50`}>
              +{delta}
            </span>
          )}
        </div>
      </div>
      {expanded && children && (
        <div className="mt-2 border-t border-slate-700/50 pt-2">
          {children}
        </div>
      )}
    </div>
  );
}

function PermanentGroup({
  label,
  permanents,
  color,
  currentTurn,
}: {
  label: string;
  permanents: PermanentSnapshot[];
  color: string;
  currentTurn: number;
}) {
  if (permanents.length === 0) return null;

  // Deduplicate: group by name and count
  const grouped = new Map<string, { count: number; tapped: number; newThisTurn: number }>();
  for (const p of permanents) {
    const entry = grouped.get(p.name) ?? { count: 0, tapped: 0, newThisTurn: 0 };
    entry.count++;
    if (p.tapped) entry.tapped++;
    if (p.enteredTurn === currentTurn) entry.newThisTurn++;
    grouped.set(p.name, entry);
  }

  return (
    <div className="mb-1.5 last:mb-0">
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${color} mb-0.5`}>
        {label} ({permanents.length})
      </p>
      <ul className="space-y-0.5">
        {Array.from(grouped.entries()).map(([name, info]) => (
          <li key={name} className="flex items-center gap-1.5 text-[11px]">
            {info.count > 1 && (
              <span className="text-slate-500 font-semibold">{info.count}x</span>
            )}
            <span className={info.tapped > 0 ? "text-slate-500" : "text-slate-300"}>
              {name}
            </span>
            {info.tapped > 0 && info.tapped < info.count && (
              <span className="text-[9px] text-slate-600">({info.tapped} tapped)</span>
            )}
            {info.tapped > 0 && info.tapped === info.count && (
              <span className="text-[9px] text-slate-600">(tapped)</span>
            )}
            {info.newThisTurn > 0 && (
              <span className="rounded-full bg-emerald-500/15 px-1 py-0 text-[9px] font-medium text-emerald-400">
                new
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CardList({
  cards,
  emptyLabel,
}: {
  cards: string[];
  emptyLabel: string;
}) {
  if (cards.length === 0) {
    return <p className="text-[10px] text-slate-600 italic">{emptyLabel}</p>;
  }

  // Deduplicate
  const grouped = new Map<string, number>();
  for (const c of cards) {
    grouped.set(c, (grouped.get(c) ?? 0) + 1);
  }

  return (
    <ul className="space-y-0.5">
      {Array.from(grouped.entries()).map(([name, count]) => (
        <li key={name} className="text-[11px] text-slate-400">
          {count > 1 && <span className="text-slate-500 font-semibold mr-1">{count}x</span>}
          {name}
        </li>
      ))}
    </ul>
  );
}

export default function GoldfishZoneBar({ log, previousLog }: GoldfishZoneBarProps) {
  const prevPermanentCount = previousLog?.permanentCount ?? 0;
  const prevHandSize = previousLog?.handSize ?? 7;
  const prevGraveyardCount = previousLog?.graveyard?.length ?? 0;
  const prevExileCount = previousLog?.exile?.length ?? 0;

  const battlefieldDelta = log.permanentCount - prevPermanentCount;
  const handDelta = log.handSize - prevHandSize;
  const graveyardDelta = (log.graveyard?.length ?? 0) - prevGraveyardCount;
  const exileDelta = (log.exile?.length ?? 0) - prevExileCount;

  // Group permanents by category
  const lands = log.permanents.filter((p) => p.category === "land");
  const creatures = log.permanents.filter((p) => p.category === "creature");
  const artifacts = log.permanents.filter((p) => p.category === "artifact");
  const enchantments = log.permanents.filter((p) => p.category === "enchantment");
  const planeswalkers = log.permanents.filter((p) => p.category === "planeswalker");
  const tokens = log.permanents.filter((p) => p.category === "token");
  const otherNoncreatures = [...artifacts, ...enchantments, ...planeswalkers];

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-1 gap-2"
      data-testid={`goldfish-zone-bar-${log.turn}`}
    >
      <ZoneCard
        label="Battlefield"
        count={log.permanents.length}
        delta={Math.max(0, battlefieldDelta)}
        color="text-emerald-400"
        borderColor="border-l-emerald-500/50"
        testId={`zone-battlefield-${log.turn}`}
        expandable
      >
        <PermanentGroup
          label="Lands"
          permanents={lands}
          color="text-emerald-500"
          currentTurn={log.turn}
        />
        <PermanentGroup
          label="Creatures"
          permanents={creatures}
          color="text-red-400"
          currentTurn={log.turn}
        />
        {otherNoncreatures.length > 0 && (
          <PermanentGroup
            label="Noncreature"
            permanents={otherNoncreatures}
            color="text-blue-400"
            currentTurn={log.turn}
          />
        )}
        {tokens.length > 0 && (
          <PermanentGroup
            label="Tokens"
            permanents={tokens}
            color="text-amber-400"
            currentTurn={log.turn}
          />
        )}
      </ZoneCard>

      <ZoneCard
        label="Hand"
        count={log.handSize}
        delta={Math.max(0, handDelta)}
        color="text-sky-400"
        borderColor="border-l-sky-500/50"
        testId={`zone-hand-${log.turn}`}
        expandable
      >
        <CardList cards={log.hand} emptyLabel="Empty hand" />
      </ZoneCard>

      <ZoneCard
        label="Graveyard"
        count={log.graveyard?.length ?? 0}
        delta={Math.max(0, graveyardDelta)}
        color="text-rose-400"
        borderColor="border-l-rose-500/50"
        testId={`zone-graveyard-${log.turn}`}
        expandable
      >
        <CardList cards={log.graveyard ?? []} emptyLabel="Empty" />
      </ZoneCard>

      <ZoneCard
        label="Exile"
        count={log.exile?.length ?? 0}
        delta={Math.max(0, exileDelta)}
        color="text-amber-400"
        borderColor="border-l-amber-500/50"
        testId={`zone-exile-${log.turn}`}
        expandable
      >
        <CardList cards={log.exile ?? []} emptyLabel="Empty" />
      </ZoneCard>
    </div>
  );
}
