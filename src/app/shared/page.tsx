"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DeckData, EnrichedCard } from "@/lib/types";
import Link from "next/link";
import { decodeDeckPayload, buildDeckFromCompactPayload } from "@/lib/deck-codec";
import { parseDecklist } from "@/lib/decklist-parser";
import type { ShareAnalysisSummary } from "@/lib/share-analysis-summary";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import {
  generateDeckId,
  type DeckSessionPayload,
} from "@/lib/deck-session";

/**
 * Shared deck loader. Decodes the URL-encoded deck payload, enriches via
 * Scryfall (using set+collector_number identifiers when present, falling
 * back to card names), then hands the resulting session off to /reading
 * so the shared deck experience matches the rest of the app.
 *
 * Phase 4 reshape: this page no longer owns its own sidebar/tabs UI.
 * Once decoding + enrichment finish, we call setPayload with the
 * already-enriched cardMap (so the provider doesn't refetch) and push to
 * /reading. The verdict landing + sub-routes do the rest.
 */
function SharedDeckContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setPayload } = useDeckSession();
  const d = searchParams.get("d");

  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [instantSummary, setInstantSummary] =
    useState<ShareAnalysisSummary | null>(null);

  const enrichAbortRef = useRef<AbortController | null>(null);

  const handoff = useCallback(
    (deck: DeckData, cardMap: Record<string, EnrichedCard>) => {
      const payload: DeckSessionPayload = {
        deckId: generateDeckId(),
        deck,
        parseWarnings: [],
        cardMap,
        notFoundCount: 0,
        spellbookCombos: null,
        createdAt: Date.now(),
      };
      setPayload(payload);
      router.push("/reading");
    },
    [setPayload, router]
  );

  const enrichByName = useCallback(
    async (deck: DeckData) => {
      const allCards = [
        ...deck.commanders,
        ...deck.mainboard,
        ...deck.sideboard,
      ];
      const uniqueNames = [...new Set(allCards.map((c) => c.name))];
      if (uniqueNames.length === 0) return;

      enrichAbortRef.current?.abort();
      const controller = new AbortController();
      enrichAbortRef.current = controller;

      try {
        const res = await fetch("/api/deck-enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardNames: uniqueNames }),
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(30_000),
          ]),
        });
        if (!res.ok) {
          setEnrichError("Could not load card details");
          return;
        }
        const json = await res.json();
        handoff(deck, json.cards as Record<string, EnrichedCard>);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setEnrichError("Could not load card details");
      }
    },
    [handoff]
  );

  useEffect(() => {
    if (!d) {
      setDecodeError("No deck data provided");
      return;
    }

    void (async () => {
      try {
        const payload = await decodeDeckPayload(d);

        if (payload.version === 3 || payload.version === 2) {
          if (payload.version === 3 && payload.summary) {
            setInstantSummary(payload.summary);
          }

          const allTuples = [
            ...payload.commanders,
            ...payload.mainboard,
            ...payload.sideboard,
          ];

          const idTuples = allTuples.filter(([set]) => set !== "_");
          const nameTuples = allTuples.filter(([set]) => set === "_");

          try {
            const cards: Record<string, EnrichedCard> = {};

            if (idTuples.length > 0) {
              const res = await fetch("/api/deck-enrich", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  identifiers: idTuples.map(([set, num]) => ({
                    set,
                    collector_number: num,
                  })),
                }),
              });
              if (res.ok) {
                const json = await res.json();
                Object.assign(cards, json.cards);
              }
            }

            if (nameTuples.length > 0) {
              const names = nameTuples.map(([, name]) => name);
              const res = await fetch("/api/deck-enrich", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cardNames: names }),
              });
              if (res.ok) {
                const json = await res.json();
                Object.assign(cards, json.cards);
              }
            }

            const deck = buildDeckFromCompactPayload(payload, cards);
            handoff(deck, cards);
          } catch {
            setEnrichError("Could not load card details");
          }
        } else {
          // v1: text-based; parse, then enrich by name.
          const { deck } = parseDecklist(
            payload.text,
            payload.commanders ? { commanders: payload.commanders } : undefined
          );
          await enrichByName(deck);
        }
      } catch {
        setDecodeError("Invalid or corrupted share link");
      }
    })();
  }, [d, enrichByName, handoff]);

  if (decodeError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-8 text-center">
          <h1 className="text-xl font-bold text-white mb-2">
            Unable to Load Deck
          </h1>
          <p className="text-sm text-red-400 mb-4">{decodeError}</p>
          <Link
            href="/"
            className="inline-block rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            Import Your Own Deck
          </Link>
        </div>
      </div>
    );
  }

  if (enrichError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
          <h1 className="text-xl font-bold text-white mb-2">
            Could Not Load Card Details
          </h1>
          <p className="text-sm text-amber-400 mb-4">{enrichError}</p>
          <Link
            href="/"
            className="inline-block rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            Try Importing Manually
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-center">
      <div
        data-testid="shared-banner"
        className="mb-6 rounded-lg border border-purple-500/20 bg-purple-500/10 px-4 py-3 text-sm text-purple-300 flex items-center justify-between"
      >
        <span>Loading shared deck</span>
        <Link
          href="/"
          className="text-purple-400 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400 rounded-sm"
        >
          Import your own deck
        </Link>
      </div>

      {instantSummary && (
        <div
          data-testid="instant-summary"
          className="mb-6 rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-left"
        >
          <h2 className="text-sm font-semibold text-slate-300 mb-3">
            Viewing a shared deck analysis
          </h2>
          <div className="flex flex-wrap gap-3 mb-3">
            <span className="rounded border border-slate-600 bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300">
              PL {instantSummary.pl}
            </span>
            <span className="rounded border border-slate-600 bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300">
              Bracket {instantSummary.br}
            </span>
            <span className="rounded border border-slate-600 bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300">
              Avg CMC {instantSummary.avg}
            </span>
            <span className="rounded border border-slate-600 bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300">
              {instantSummary.kr}% keep rate
            </span>
            {instantSummary.combos > 0 && (
              <span className="rounded border border-purple-600/40 bg-purple-600/10 px-2 py-0.5 text-xs text-purple-300">
                {instantSummary.combos} combo{instantSummary.combos !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {instantSummary.themes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {instantSummary.themes.map((theme) => (
                <span
                  key={theme}
                  className="rounded-full bg-purple-600/20 px-2 py-0.5 text-xs text-purple-300"
                >
                  {theme}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-sm text-slate-400 animate-pulse">
        Loading shared deck...
      </p>
    </div>
  );
}

export default function SharedPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-12 text-center">
          <p className="text-sm text-slate-400 animate-pulse">Loading...</p>
        </div>
      }
    >
      <SharedDeckContent />
    </Suspense>
  );
}
