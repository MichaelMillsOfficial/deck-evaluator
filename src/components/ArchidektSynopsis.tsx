"use client";

import type { DeckData } from "@/lib/types";
import { Button } from "@/components/ui";
import styles from "./ArchidektSynopsis.module.css";

interface ArchidektSynopsisProps {
  deck: DeckData;
  onContinue: () => void;
  onChooseAnother: () => void;
  loading?: boolean;
}

export default function ArchidektSynopsis({
  deck,
  onContinue,
  onChooseAnother,
  loading = false,
}: ArchidektSynopsisProps) {
  const mainboardCount = deck.mainboard.reduce(
    (sum, card) => sum + card.quantity,
    0
  );
  const sideboardCount = deck.sideboard.reduce(
    (sum, card) => sum + card.quantity,
    0
  );
  const commanderCount = deck.commanders.reduce(
    (sum, card) => sum + card.quantity,
    0
  );
  const totalCount = mainboardCount + sideboardCount + commanderCount;

  return (
    <section
      data-testid="archidekt-synopsis"
      className={styles.synopsis}
      aria-label="Archidekt deck synopsis"
    >
      <div>
        <p className={styles.eyebrow}>Imported from Archidekt</p>
        <h3 className={styles.title}>{deck.name}</h3>
      </div>

      <a
        href={deck.url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.deckLink}
      >
        View on archidekt.com
      </a>

      {deck.commanders.length > 0 && (
        <div className={styles.commanderRow}>
          <span className={styles.commanderLabel}>
            {deck.commanders.length === 1 ? "Commander" : "Commanders"}
          </span>
          <div className={styles.commanderPills}>
            {deck.commanders.map((c) => (
              <span key={c.name} className={styles.commanderPill}>
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={styles.counts}>
        <div className={styles.countItem}>
          <span className={styles.countLabel}>Mainboard</span>
          <span className={styles.countValue}>{mainboardCount}</span>
        </div>
        <div className={styles.countItem}>
          <span className={styles.countLabel}>Sideboard</span>
          <span className={styles.countValue}>{sideboardCount}</span>
        </div>
        <div className={styles.countItem}>
          <span className={styles.countLabel}>Total</span>
          <span className={styles.countValue}>{totalCount}</span>
        </div>
      </div>

      <div className={styles.actions}>
        <Button
          type="button"
          variant="secondary"
          onClick={onChooseAnother}
          disabled={loading}
        >
          Choose another deck
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={onContinue}
          disabled={loading}
        >
          Continue to reading
        </Button>
      </div>
    </section>
  );
}
