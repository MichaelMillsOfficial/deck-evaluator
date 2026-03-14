"use client";

import { useState } from "react";
import type { GoldfishTurnLog } from "@/lib/goldfish-simulator";

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

export default function GoldfishZoneBar({ log, previousLog }: GoldfishZoneBarProps) {
  const prevPermanentCount = previousLog?.permanentCount ?? 0;
  const prevHandSize = previousLog?.handSize ?? 7;
  const prevGraveyardCount = previousLog?.graveyard?.length ?? 0;
  const prevExileCount = previousLog?.exile?.length ?? 0;

  const battlefieldDelta = log.permanentCount - prevPermanentCount;
  const handDelta = log.handSize - prevHandSize;
  const graveyardDelta = (log.graveyard?.length ?? 0) - prevGraveyardCount;
  const exileDelta = (log.exile?.length ?? 0) - prevExileCount;

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-1 gap-2"
      data-testid={`goldfish-zone-bar-${log.turn}`}
    >
      <ZoneCard
        label="Battlefield"
        count={log.permanentCount}
        delta={Math.max(0, battlefieldDelta)}
        color="text-emerald-400"
        borderColor="border-l-emerald-500/50"
        testId={`zone-battlefield-${log.turn}`}
        expandable
      >
        <p className="text-[10px] text-slate-500">
          {log.permanentCount} permanent{log.permanentCount !== 1 ? "s" : ""}
        </p>
      </ZoneCard>

      <ZoneCard
        label="Hand"
        count={log.handSize}
        delta={Math.max(0, handDelta)}
        color="text-sky-400"
        borderColor="border-l-sky-500/50"
        testId={`zone-hand-${log.turn}`}
      />

      <ZoneCard
        label="Graveyard"
        count={log.graveyard?.length ?? 0}
        delta={Math.max(0, graveyardDelta)}
        color="text-rose-400"
        borderColor="border-l-rose-500/50"
        testId={`zone-graveyard-${log.turn}`}
      />

      <ZoneCard
        label="Exile"
        count={log.exile?.length ?? 0}
        delta={Math.max(0, exileDelta)}
        color="text-amber-400"
        borderColor="border-l-amber-500/50"
        testId={`zone-exile-${log.turn}`}
      />
    </div>
  );
}
