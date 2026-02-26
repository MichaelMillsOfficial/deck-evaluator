"use client";

import { useState, useEffect } from "react";
import type { DeckData, EnrichedCard } from "@/lib/types";
import {
  validateCommanderDeck,
  buildEdhrecUrl,
  type CommanderValidationResult,
} from "@/lib/commander-validation";

interface CommanderSectionProps {
  deck: DeckData;
  cardMap: Record<string, EnrichedCard>;
}

interface CommanderRules {
  bannedSet: Set<string>;
  gameChangerNames: Set<string>;
}

export default function CommanderSection({
  deck,
  cardMap,
}: CommanderSectionProps) {
  const [rules, setRules] = useState<CommanderRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRules() {
      try {
        const res = await fetch("/api/commander-rules");
        if (!res.ok) throw new Error("Failed to fetch Commander rules");
        const data = await res.json();
        if (cancelled) return;
        setRules({
          bannedSet: new Set(data.banned as string[]),
          gameChangerNames: new Set(
            (data.gameChangers as { name: string }[]).map((g) => g.name)
          ),
        });
      } catch {
        if (!cancelled) setFetchError("Could not load Commander rules.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRules();
    return () => {
      cancelled = true;
    };
  }, []);

  const validation: CommanderValidationResult | null = rules
    ? validateCommanderDeck(
        deck,
        cardMap,
        rules.bannedSet,
        rules.gameChangerNames
      )
    : null;

  return (
    <section aria-labelledby="commander-heading">
      <h3 id="commander-heading" className="sr-only">
        Commander
      </h3>

      {loading && (
        <p className="text-sm text-slate-400">
          Loading Commander rules...
        </p>
      )}

      {fetchError && (
        <p className="text-sm text-red-400">{fetchError}</p>
      )}

      {validation && !loading && !fetchError && (
        <>
          {!validation.hasCommander && (
            <p className="text-sm text-slate-400">
              No commander detected in this deck.
            </p>
          )}

          {validation.hasCommander && validation.isValid && (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm text-green-400">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                    clipRule="evenodd"
                  />
                </svg>
                Valid Commander deck
              </p>
              <a
                href={buildEdhrecUrl(validation.commanderNames)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 underline"
              >
                View on EDHREC
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3.5 w-3.5"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5zm7.25-.75a.75.75 0 01.75-.75h3.5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0V6.31l-5.47 5.47a.75.75 0 11-1.06-1.06l5.47-5.47H12.25a.75.75 0 01-.75-.75z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </div>
          )}

          {validation.hasCommander && !validation.isValid && (
            <ul className="space-y-2">
              {validation.errors.map((err, i) => (
                <li key={i} className="text-sm">
                  <p className="text-red-400">{err.message}</p>
                  {err.cards && err.cards.length > 0 && (
                    <ul className="mt-1 ml-4 list-disc text-slate-300 text-xs">
                      {err.cards.map((card) => (
                        <li key={card}>{card}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
