"use client";

import { useMemo, useState } from "react";
import type { EnrichedCard } from "@/lib/types";
import { Eyebrow, Tag } from "@/components/ui";
import {
  bandFor,
  type CardInclusion,
  type DeckMetaResult,
  type MetaBand,
} from "@/lib/edhrec-meta";
import styles from "./MetaHeatList.module.css";

type SortKey = "spicy" | "stock" | "name";
type FilterKey = "all" | "staple" | "niche" | "spice";

const BAR_CLASS: Record<MetaBand, string> = {
  staple: styles.barStaple,
  standard: styles.barStandard,
  niche: styles.barNiche,
  spice: styles.barSpice,
};

export interface MetaHeatListProps {
  meta: DeckMetaResult;
  cardMap: Record<string, EnrichedCard> | null;
}

/** The per-card "inclusion heat list" for /reading/cards: every scored card
 * with its EDHREC inclusion, sortable spicy→stock and filterable, with card
 * art on hover. Rendered only when meta data is present (ok / thin). */
export default function MetaHeatList({ meta, cardMap }: MetaHeatListProps) {
  const [sort, setSort] = useState<SortKey>("spicy");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = meta.cards.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (filter === "staple") return c.inclusion >= 0.6;
      if (filter === "niche") return c.inclusion >= 0.1 && c.inclusion < 0.6;
      if (filter === "spice") return c.inclusion < 0.1;
      return true;
    });
    out = [...out].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "stock") return b.inclusion - a.inclusion;
      return a.inclusion - b.inclusion; // spicy first
    });
    return out;
  }, [meta.cards, sort, filter, query]);

  if (meta.status !== "ok" && meta.status !== "thin") return null;

  return (
    <section className={styles.wrap} data-testid="meta-heat-list">
      <Eyebrow>Stock ↔ Spicy · by card</Eyebrow>
      <p className={styles.basis} data-testid="meta-heat-basis">
        {meta.ratedCount} of {meta.ratedCount + meta.unratedCount} cards rated by EDHREC
        {meta.unratedCount > 0 ? ` · ${meta.unratedCount} unrated, not shown` : ""}
      </p>

      <div className={styles.toolbar}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Sort</span>
          <select
            className={styles.select}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            data-testid="meta-sort"
          >
            <option value="spicy">Spiciest first</option>
            <option value="stock">Most stock first</option>
            <option value="name">Name A–Z</option>
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Filter</span>
          <select
            className={styles.select}
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterKey)}
            data-testid="meta-filter"
          >
            <option value="all">All cards</option>
            <option value="staple">Staples (60%+)</option>
            <option value="niche">Niche (10–60%)</option>
            <option value="spice">Spice (&lt;10%)</option>
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Find</span>
          <input
            className={styles.search}
            type="text"
            placeholder="card name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="meta-search"
          />
        </label>
        <span className={styles.count} data-testid="meta-row-count">
          {rows.length} card{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className={styles.list}>
        {rows.length === 0 ? (
          <p className={styles.empty}>No cards match.</p>
        ) : (
          rows.map((card) => (
            <MetaHeatRow key={card.name} card={card} enriched={cardMap?.[card.name]} />
          ))
        )}
      </div>
    </section>
  );
}

function MetaHeatRow({ card, enriched }: { card: CardInclusion; enriched?: EnrichedCard }) {
  const [open, setOpen] = useState(false);
  const band = bandFor(card.inclusion);
  const pct = Math.round(card.inclusion * 100);

  return (
    <div className={styles.row} data-testid={`meta-row-${card.name}`}>
      <span className={styles.nameWrap}>
        <button
          type="button"
          className={styles.name}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={() => setOpen((o) => !o)}
          aria-label={`${card.name} card art`}
        >
          {card.name}
        </button>
        {band === "spice" ? <Tag variant="warn">Spice</Tag> : null}
        {open && enriched?.imageUris ? (
          <span role="tooltip" className={styles.preview} data-testid="meta-card-preview">
            <img
              src={enriched.imageUris.normal}
              alt={`${card.name} card`}
              className={styles.previewImage}
            />
          </span>
        ) : open && enriched ? (
          <span role="tooltip" className={styles.preview} data-testid="meta-card-preview">
            <span className={styles.previewMeta}>
              <span className={styles.previewName}>{card.name}</span>
              <span className={styles.previewType}>{enriched.typeLine}</span>
            </span>
          </span>
        ) : null}
      </span>
      <span className={styles.bar}>
        <span
          className={[styles.barFill, BAR_CLASS[band]].join(" ")}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </span>
      <span className={[styles.pct, band === "spice" && styles.pctSpice].filter(Boolean).join(" ")}>
        {pct}%
      </span>
    </div>
  );
}
