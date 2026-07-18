"use client";

import { useMemo, useState } from "react";
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

/** Rows rendered per group before the "Show all" expansion. Keeps huge piles
 * responsive without a virtualization library. */
const ROWS_PER_GROUP = 60;

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
  } = useCrucibleSession();

  const [lens, setLens] = useState<CrucibleLens>("category");
  const [undecidedOnly, setUndecidedOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [notFoundDismissed, setNotFoundDismissed] = useState(false);

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
              ? `${group.cards.length} cards · no strong theme — prime cut fodder`
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

  if (!payload || !cardMap) return null;

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
      </header>

      {notFound.length > 0 && !notFoundDismissed ? (
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
            onClick={() => setNotFoundDismissed(true)}
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
            <div data-testid="crucible-groups">
              {groups.map((group) => {
                const isCollapsed = collapsed.has(group.id);
                const visibleCards = undecidedOnly
                  ? group.cards.filter(
                      ({ card }) =>
                        (payload.statuses[card.name] ?? "undecided") === "undecided"
                    )
                  : group.cards;
                const isExpanded = expandedGroups.has(group.id);
                const shownCards = isExpanded
                  ? visibleCards
                  : visibleCards.slice(0, ROWS_PER_GROUP);
                return (
                  <section key={group.id} className={styles.group}>
                    <button
                      type="button"
                      className={styles.groupHead}
                      aria-expanded={!isCollapsed}
                      aria-label={`${group.label} group`}
                      onClick={() => toggleCollapsed(group.id)}
                    >
                      <span className={styles.groupChevron} aria-hidden="true">
                        {isCollapsed ? "▸" : "▾"}
                      </span>
                      <span className={styles.groupLabel}>{group.label}</span>
                      {group.meta ? (
                        <span className={styles.groupMeta}>{group.meta}</span>
                      ) : null}
                    </button>
                    {!isCollapsed
                      ? shownCards.map(({ card, badge }) => (
                          <CrucibleCardRow
                            key={card.name}
                            card={card}
                            enriched={cardMap[card.name]}
                            status={payload.statuses[card.name] ?? "undecided"}
                            locked={payload.commanders.includes(card.name)}
                            keptQuantity={keptQuantityOf(payload, card)}
                            onSetKeptQuantity={(count) =>
                              setKeptQuantity(card.name, count)
                            }
                            offIdentity={
                              commanderIdentity !== null &&
                              (cardMap[card.name]?.colorIdentity ?? []).some(
                                (color) => !commanderIdentity.has(color)
                              )
                            }
                            synergyScore={synergy?.cardScores[card.name]?.score}
                            badge={badge}
                            onKeep={() =>
                              setStatus(
                                card.name,
                                payload.statuses[card.name] === "keep"
                                  ? "undecided"
                                  : "keep"
                              )
                            }
                            onCut={() =>
                              setStatus(
                                card.name,
                                payload.statuses[card.name] === "cut"
                                  ? "undecided"
                                  : "cut"
                              )
                            }
                          />
                        ))
                      : null}
                    {!isCollapsed && visibleCards.length > shownCards.length ? (
                      <button
                        type="button"
                        className={styles.groupShowAll}
                        onClick={() =>
                          setExpandedGroups((prev) => new Set(prev).add(group.id))
                        }
                      >
                        Show all {visibleCards.length}
                      </button>
                    ) : null}
                  </section>
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
