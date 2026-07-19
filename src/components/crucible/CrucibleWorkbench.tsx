"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useCrucibleSession } from "@/contexts/CrucibleSessionContext";
import {
  groupByCategory,
  groupBySynergyAxis,
  groupByTypeLine,
  groupByManaValue,
  groupByColorIdentity,
  gameChangers,
  UNALIGNED_AXIS_ID,
} from "@/lib/crucible-grouping";
import { TEMPLATE_COMMAND_ZONE } from "@/lib/deck-composition";
import { keptQuantityOf } from "@/lib/crucible-session";
import { encodeCruciblePile, serializePileToDck } from "@/lib/crucible-share";
import type { DeckCard } from "@/lib/types";
import { Button } from "@/components/ui";
import CardSearchInput from "@/components/CardSearchInput";
import LensSwitcher, { type CrucibleLens } from "./LensSwitcher";
import CrucibleCardRow from "./CrucibleCardRow";
import CommanderPicker from "./CommanderPicker";
import TrackerRail from "./TrackerRail";
import CrucibleCharts from "./CrucibleCharts";
import CrucibleCombos from "./CrucibleCombos";
import SuggestedCuts from "./SuggestedCuts";
import CutPile from "./CutPile";
import styles from "./crucible.module.css";

/** Estimated pixel heights for the window virtualizer. The real heights are
 * measured after mount via `measureElement`; these only seed the first paint
 * and the scroll-range math for offscreen rows. */
const ROW_ESTIMATE = 64;
const HEADER_ESTIMATE = 52;

/** Extra rows rendered beyond the viewport on each side. Small piles fall well
 * under this window, so every row stays mounted and directly scroll-to-able. */
const OVERSCAN = 12;

/** Nothing is excluded from the add-card search: re-adding a name already in
 * the pile bumps its quantity (useful for basics), and singleton legality
 * flags any illegal duplicates. Stable references keep the input's exclusion
 * effect from re-running per render. */
const EMPTY_NAME_SET = new Set<string>();
const EMPTY_CANDIDATES: string[] = [];

interface RenderGroup {
  id: string;
  label: string;
  meta?: string;
  cards: { card: DeckCard; badge?: string }[];
}

/** A single virtualized item: either a group header or a card row. The visible
 * (non-collapsed, filtered) groups are flattened into one list of these so a
 * single window virtualizer can span every group. */
type FlatItem =
  | { kind: "header"; group: RenderGroup; collapsed: boolean }
  | { kind: "row"; groupId: string; card: DeckCard; badge?: string };

export default function CrucibleWorkbench() {
  const {
    payload,
    cardMap,
    notFound,
    tagCache,
    synergy,
    addCard,
    setStatus,
    setKeptQuantity,
    deckName,
  } = useCrucibleSession();

  const [lens, setLens] = useState<CrucibleLens>("category");
  const [undecidedOnly, setUndecidedOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dismissedNotFound, setDismissedNotFound] = useState<Set<string>>(
    () => new Set()
  );
  const [shareCopied, setShareCopied] = useState(false);
  const [shareError, setShareError] = useState(false);

  const commanderIdentity = useMemo<Set<string> | null>(() => {
    if (!payload || !cardMap || payload.commanders.length === 0) return null;
    const identity = new Set<string>();
    for (const name of payload.commanders) {
      for (const color of cardMap[name]?.colorIdentity ?? []) identity.add(color);
    }
    return identity;
  }, [payload, cardMap]);

  const targetByLabel = useMemo(() => {
    const map = new Map<string, { min: number; max: number }>();
    for (const category of TEMPLATE_COMMAND_ZONE.categories) {
      map.set(category.label, { min: category.min, max: category.max });
      map.set(category.tag, { min: category.min, max: category.max });
    }
    return map;
  }, []);

  const groups = useMemo<RenderGroup[]>(() => {
    if (!payload || !cardMap) return [];
    const pool = payload.pool;
    switch (lens) {
      case "category":
        return groupByCategory(pool, cardMap, tagCache ?? undefined).map((group) => {
          const target = targetByLabel.get(group.label);
          const kept = group.cards.reduce(
            (sum, c) => sum + keptQuantityOf(payload, c),
            0
          );
          return {
            id: group.id,
            label: group.label,
            meta: `${group.cards.length} candidates · ${kept} kept${
              target ? ` · target ${target.min}–${target.max}` : ""
            }`,
            cards: group.cards.map((card) => ({ card })),
          };
        });
      case "axis":
        return groupBySynergyAxis(pool, cardMap).map((group) => ({
          id: `axis:${group.axisId}`,
          label: group.axisName,
          meta:
            group.axisId === UNALIGNED_AXIS_ID
              ? `${group.cards.length} cards · no strong theme - prime cut fodder`
              : `pool strength ${group.strength.toFixed(2)} · ${group.cards.length} cards`,
          cards: group.cards.map((card) => ({
            card,
            badge:
              card.otherAxes.length > 0 ? `+${card.otherAxes.length} axes` : undefined,
          })),
        }));
      case "type":
        return groupByTypeLine(pool, cardMap).map((group) => ({
          id: group.id,
          label: group.label,
          meta: `${group.cards.length} cards`,
          cards: group.cards.map((card) => ({ card })),
        }));
      case "mv":
        return groupByManaValue(pool, cardMap).map((group) => ({
          id: group.id,
          label: group.label === "Lands" ? "Lands" : `Mana value ${group.label}`,
          meta: `${group.cards.length} cards`,
          cards: group.cards.map((card) => ({ card })),
        }));
      case "color":
        return groupByColorIdentity(pool, cardMap).map((group) => ({
          id: group.id,
          label: group.label,
          meta: `${group.cards.length} cards`,
          cards: group.cards.map((card) => ({ card })),
        }));
      case "gamechangers": {
        const flagged = gameChangers(pool, cardMap);
        return [
          {
            id: "gamechangers",
            label: "Game Changers",
            meta: `${flagged.length} flagged · bracket-relevant`,
            cards: flagged.map((card) => ({ card })),
          },
        ];
      }
      case "list":
        return [
          {
            id: "all",
            label: "All Cards",
            meta: `${pool.length} unique names`,
            cards: [...pool]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((card) => ({ card })),
          },
        ];
      default:
        return [];
    }
  }, [payload, cardMap, tagCache, lens, targetByLabel]);

  const statuses = payload?.statuses;

  // Flatten the visible groups (respecting collapse + the undecided filter)
  // into a single item list so one window virtualizer can span every group.
  const flatItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];
    for (const group of groups) {
      const isCollapsed = collapsed.has(group.id);
      items.push({ kind: "header", group, collapsed: isCollapsed });
      if (isCollapsed) continue;
      for (const { card, badge } of group.cards) {
        if (
          undecidedOnly &&
          (statuses?.[card.name] ?? "undecided") !== "undecided"
        ) {
          continue;
        }
        items.push({ kind: "row", groupId: group.id, card, badge });
      }
    }
    return items;
  }, [groups, collapsed, undecidedOnly, statuses]);

  // Window virtualizer preserves the whole-page scroll UX (no inner
  // fixed-height scrollbox). scrollMargin is the list's offset from the top of
  // the document, captured via a callback ref (runs at commit, not during
  // render) so the virtualizer's scroll math lines up with the page scroll.
  // A ResizeObserver keeps it fresh when layout above the list changes height
  // after mount (e.g. dismissing the not-found banner shifts the list up);
  // its callback fires asynchronously, so it does not trip set-state-in-effect.
  const [scrollMargin, setScrollMargin] = useState(0);
  const scrollMarginObserverRef = useRef<ResizeObserver | null>(null);
  const setListRef = useCallback((node: HTMLDivElement | null) => {
    scrollMarginObserverRef.current?.disconnect();
    scrollMarginObserverRef.current = null;
    if (!node) return;
    const measure = () => {
      const top = node.offsetTop;
      setScrollMargin((prev) => (prev === top ? prev : top));
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(document.body);
      scrollMarginObserverRef.current = observer;
    }
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: flatItems.length,
    estimateSize: (index) =>
      flatItems[index]?.kind === "header" ? HEADER_ESTIMATE : ROW_ESTIMATE,
    overscan: OVERSCAN,
    scrollMargin,
    getItemKey: (index) => {
      const item = flatItems[index];
      return item.kind === "header"
        ? `header:${item.group.id}`
        : `row:${item.groupId}:${item.card.name}`;
    },
  });

  if (!payload || !cardMap) return null;

  const sharedPayload = payload;

  const handleSharePile = async () => {
    try {
      const encoded = await encodeCruciblePile(sharedPayload);
      const url = `${window.location.origin}/crucible?p=${encoded}`;
      await navigator.clipboard.writeText(url);
      setShareError(false);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setShareCopied(false);
      setShareError(true);
      window.setTimeout(() => setShareError(false), 4000);
    }
  };

  const handleDownloadDck = () => {
    const dck = serializePileToDck(sharedPayload, deckName);
    const blob = new Blob([dck], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "crucible-pile.dck";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const poolTotal = payload.pool.reduce((sum, c) => sum + c.quantity, 0);
  const isInsight = lens === "charts" || lens === "combos" || lens === "cuts" || lens === "cutpile";

  const toggleCollapsed = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <main data-testid="crucible-workbench" className={styles.workbench}>
      <header className={styles.workbenchHead}>
        <div>
          <p className={styles.workbenchEyebrow}>The Crucible</p>
          <p data-testid="crucible-pool-count" className={styles.workbenchCount}>
            {poolTotal} cards in the pile
          </p>
        </div>
        <CommanderPicker />
        <div className={styles.addSearch}>
          <CardSearchInput
            deckCardNames={EMPTY_NAME_SET}
            candidateNames={EMPTY_CANDIDATES}
            onAddCard={addCard}
          />
        </div>
        <div className={styles.shareActions}>
          <Button
            variant="secondary"
            size="sm"
            data-testid="crucible-share-pile"
            onClick={handleSharePile}
          >
            Share pile
          </Button>
          <Button
            variant="ghost"
            size="sm"
            data-testid="crucible-download-dck"
            onClick={handleDownloadDck}
          >
            Download .dck
          </Button>
          <span
            role="status"
            aria-live="polite"
            data-testid="crucible-share-status"
            className={styles.shareStatus}
          >
            {shareCopied
              ? "Copied"
              : shareError
                ? "Copy failed"
                : ""}
          </span>
        </div>
      </header>

      {notFound.some((name) => !dismissedNotFound.has(name)) ? (
        <div
          role="alert"
          data-testid="crucible-notfound-banner"
          className={styles.notFoundBanner}
        >
          <span>
            {notFound.length} {notFound.length === 1 ? "name" : "names"} could
            not be resolved and {notFound.length === 1 ? "appears" : "appear"}{" "}
            under &ldquo;Unresolved&rdquo;:{" "}
            {notFound.slice(0, 8).join(", ")}
            {notFound.length > 8 ? ` and ${notFound.length - 8} more` : ""}
          </span>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Dismiss unresolved-names warning"
            onClick={() => setDismissedNotFound(new Set(notFound))}
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      <div className={styles.workbenchGrid}>
        <LensSwitcher
          active={lens}
          onSelect={setLens}
          undecidedOnly={undecidedOnly}
          onToggleUndecided={() => setUndecidedOnly((v) => !v)}
          cutCount={
            payload.pool.filter((c) => payload.statuses[c.name] === "cut").length
          }
        />

        <div className={styles.workbenchMain}>
          {lens === "charts" ? <CrucibleCharts /> : null}
          {lens === "combos" ? <CrucibleCombos /> : null}
          {lens === "cuts" ? <SuggestedCuts /> : null}
          {lens === "cutpile" ? <CutPile /> : null}
          {!isInsight ? (
            <div
              ref={setListRef}
              data-testid="crucible-groups"
              className={styles.groups}
              style={{ height: virtualizer.getTotalSize() }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const item = flatItems[virtualItem.index];
                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    className={styles.vItem}
                    style={{
                      transform: `translateY(${
                        virtualItem.start - virtualizer.options.scrollMargin
                      }px)`,
                    }}
                  >
                    {item.kind === "header" ? (
                      <button
                        type="button"
                        className={styles.groupHead}
                        aria-expanded={!item.collapsed}
                        aria-label={`${item.group.label} group`}
                        onClick={() => toggleCollapsed(item.group.id)}
                      >
                        <span className={styles.groupChevron} aria-hidden="true">
                          {item.collapsed ? "▸" : "▾"}
                        </span>
                        <span className={styles.groupLabel}>
                          {item.group.label}
                        </span>
                        {item.group.meta ? (
                          <span className={styles.groupMeta}>
                            {item.group.meta}
                          </span>
                        ) : null}
                      </button>
                    ) : (
                      <CrucibleCardRow
                        card={item.card}
                        enriched={cardMap[item.card.name]}
                        status={payload.statuses[item.card.name] ?? "undecided"}
                        locked={payload.commanders.includes(item.card.name)}
                        keptQuantity={keptQuantityOf(payload, item.card)}
                        onSetKeptQuantity={(count) =>
                          setKeptQuantity(item.card.name, count)
                        }
                        offIdentity={
                          commanderIdentity !== null &&
                          (cardMap[item.card.name]?.colorIdentity ?? []).some(
                            (color) => !commanderIdentity.has(color)
                          )
                        }
                        synergyScore={synergy?.cardScores[item.card.name]?.score}
                        badge={item.badge}
                        onKeep={() =>
                          setStatus(
                            item.card.name,
                            payload.statuses[item.card.name] === "keep"
                              ? "undecided"
                              : "keep"
                          )
                        }
                        onCut={() =>
                          setStatus(
                            item.card.name,
                            payload.statuses[item.card.name] === "cut"
                              ? "undecided"
                              : "cut"
                          )
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <TrackerRail />
      </div>
    </main>
  );
}
