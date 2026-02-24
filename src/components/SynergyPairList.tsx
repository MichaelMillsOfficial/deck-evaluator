"use client";

import type { SynergyPair } from "@/lib/types";

interface SynergyPairListProps {
  pairs: SynergyPair[];
  variant: "synergy" | "anti-synergy";
  title: string;
  testId: string;
}

function strengthLabel(strength: number): string {
  if (strength >= 0.8) return "Strong";
  if (strength >= 0.5) return "Moderate";
  return "Weak";
}

export default function SynergyPairList({
  pairs,
  variant,
  title,
  testId,
}: SynergyPairListProps) {
  if (pairs.length === 0) return null;

  const accentBorder =
    variant === "synergy" ? "border-purple-500/30" : "border-amber-500/30";
  const accentBg =
    variant === "synergy" ? "bg-purple-500/10" : "bg-amber-500/10";
  const accentText =
    variant === "synergy" ? "text-purple-300" : "text-amber-300";
  const badgeBg =
    variant === "synergy" ? "bg-purple-500/20" : "bg-amber-500/20";

  return (
    <div className="mb-4" data-testid={testId}>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h4>
      <ul className="space-y-2">
        {pairs.map((pair, i) => (
          <li
            key={`${pair.cards.join("-")}-${i}`}
            data-testid={`pair-item-${i}`}
            className={`rounded-lg border ${accentBorder} ${accentBg} px-3 py-2`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`text-sm font-medium ${accentText}`}>
                  {pair.cards.join(" + ")}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {pair.description}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeBg} ${accentText}`}
              >
                {pair.type === "combo"
                  ? "Combo"
                  : strengthLabel(pair.strength)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
