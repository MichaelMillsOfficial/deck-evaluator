"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [open, setOpen] = useState<boolean | null>(null); // null = not yet determined

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

  // Set default open state once validation is available
  useEffect(() => {
    if (validation && open === null) {
      setOpen(validation.hasCommander);
    }
  }, [validation, open]);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    },
    [open]
  );

  const sectionId = "commander-section-content";

  return (
    <section aria-labelledby="commander-heading">
      <button
        type="button"
        aria-expanded={!!open}
        aria-controls={sectionId}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className="flex w-full items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded-sm"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 motion-reduce:transition-none ${
            open ? "rotate-90" : ""
          }`}
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
        <h3
          id="commander-heading"
          className="text-sm font-semibold uppercase tracking-wide text-slate-300"
        >
          Commander
        </h3>
        {validation && !loading && (
          <span className="ml-auto">
            {validation.hasCommander && validation.isValid ? (
              <span className="text-green-400 text-xs">Valid</span>
            ) : validation.hasCommander && !validation.isValid ? (
              <span className="text-red-400 text-xs">
                {validation.errors.length} issue
                {validation.errors.length !== 1 ? "s" : ""}
              </span>
            ) : null}
          </span>
        )}
      </button>

      {open && (
        <div id={sectionId} className="mt-3">
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
        </div>
      )}
    </section>
  );
}
