"use client";

import { useState } from "react";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import { Eyebrow, Tag, Button } from "@/components/ui";
import {
  metaHeadline,
  stockSpicyLabel,
  type MetaLens,
  type MetaBand,
  type DeckMetaResult,
} from "@/lib/edhrec-meta";
import styles from "./MetaPanel.module.css";

const LENSES: Array<{ key: MetaLens; label: string }> = [
  { key: "coverage", label: "Coverage × Spice" },
  { key: "percentile", label: "Percentile" },
  { key: "mean", label: "Mean" },
];

const BANDS: Array<{ key: MetaBand; label: string; seg: string; range: string }> = [
  { key: "staple", label: "Staple", seg: styles.segStaple, range: "90%+" },
  { key: "standard", label: "Standard", seg: styles.segStandard, range: "50–90%" },
  { key: "niche", label: "Niche", seg: styles.segNiche, range: "10–50%" },
  { key: "spice", label: "Spice", seg: styles.segSpice, range: "<10%" },
];

const SOURCE_LABEL: Record<string, string> = {
  pair: "EDHREC pair page",
  combined: "combined from both commanders",
  primary: "based on the primary commander",
};

/** The deck-level "Stock ↔ Spicy" read on /reading, with a lens switcher and
 * distribution bands. Neutral framing throughout — never a graded score. */
export default function MetaPanel() {
  const { payload, metaLoading, retryMeta } = useDeckSession();
  const [lens, setLens] = useState<MetaLens>("coverage");

  const meta = payload?.deckMeta ?? null;

  // While loading with no result yet, render nothing (hero already carries the deck).
  if (!meta && metaLoading) return null;
  if (!meta) return null;

  if (meta.status === "no-data") {
    return (
      <section data-testid="meta-panel" className={styles.panel}>
        <Eyebrow>Stock ↔ Spicy</Eyebrow>
        <div className={styles.empty} data-testid="meta-no-data">
          <p className={styles.emptyTitle}>No meta read yet</p>
          <p className={styles.emptyBody}>
            EDHREC has no page for this commander. We&apos;ll show the deck&apos;s spice
            story once enough decks are registered.
          </p>
        </div>
      </section>
    );
  }

  if (meta.status === "error") {
    return (
      <section data-testid="meta-panel" className={styles.panel}>
        <Eyebrow>Stock ↔ Spicy</Eyebrow>
        <div className={styles.empty} data-testid="meta-error">
          <p className={styles.emptyTitle}>Couldn&apos;t reach EDHREC</p>
          <p className={styles.emptyBody}>
            The rest of your reading is unaffected — this panel just needs its data.
          </p>
          <div className={styles.errorActions}>
            <Button variant="secondary" size="sm" onClick={retryMeta} data-testid="meta-retry">
              Retry
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const isThin = meta.status === "thin";

  return (
    <section
      data-testid="meta-panel"
      data-status={meta.status}
      className={styles.panel}
    >
      <div className={styles.header}>
        <div className={styles.headline}>
          <Eyebrow>Stock ↔ Spicy</Eyebrow>
          <p className={[styles.label, isThin && styles.thin].filter(Boolean).join(" ")}>
            {stockSpicyLabel(meta.coverage.pct)}
          </p>
          <p data-testid="meta-readout" className={styles.readout}>
            {metaHeadline(meta, lens)}
          </p>
          {meta.source && meta.source !== "pair" && (
            <div className={styles.source}>
              <Tag variant="ghost" data-testid="meta-source">
                {SOURCE_LABEL[meta.source]}
              </Tag>
            </div>
          )}
        </div>

        <div className={styles.lens} role="group" aria-label="Scoring lens">
          {LENSES.map((l) => (
            <button
              key={l.key}
              type="button"
              className={styles.lensBtn}
              aria-pressed={lens === l.key}
              onClick={() => setLens(l.key)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <MetaBands meta={meta} thin={isThin} />

      {isThin && (
        <p className={styles.caveat} data-testid="meta-thin-caveat">
          Low confidence — only {meta.potentialDecks} decks on record. Treat this as a
          hint, not a verdict.
        </p>
      )}
    </section>
  );
}

function MetaBands({ meta, thin }: { meta: DeckMetaResult; thin: boolean }) {
  const total = BANDS.reduce((sum, b) => sum + meta.bandCounts[b.key], 0);
  if (total === 0) return null;

  return (
    <div className={[styles.bands, thin && styles.thin].filter(Boolean).join(" ")}>
      <div className={styles.bar} data-testid="meta-bands">
        {BANDS.map((b) => {
          const count = meta.bandCounts[b.key];
          if (count === 0) return null;
          return (
            <div
              key={b.key}
              className={[styles.seg, b.seg].join(" ")}
              style={{ width: `${(count / total) * 100}%` }}
              title={`${b.label}: ${count}`}
            >
              {count}
            </div>
          );
        })}
      </div>
      <div className={styles.legend}>
        {BANDS.map((b) => (
          <span key={b.key} className={styles.legendItem}>
            <span className={[styles.swatch, b.seg].join(" ")} />
            {b.label} · {b.range}
            <span className={styles.legendCount}>{meta.bandCounts[b.key]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
