"use client";

import { useCrucibleSession } from "@/contexts/CrucibleSessionContext";
import { cutCards } from "@/lib/crucible-session";
import styles from "./crucible.module.css";

export default function CutPile() {
  const { payload, restore } = useCrucibleSession();

  if (!payload) return null;
  const cuts = cutCards(payload);

  return (
    <section data-testid="crucible-cut-pile" aria-label="Cut pile" className={styles.panel}>
      <h2 className={styles.panelTitle}>Cut Pile · {cuts.length}</h2>
      <p className={styles.panelMuted}>
        Cuts are never deleted. Restore any of them, or seal the deck and they become
        the sideboard.
      </p>
      {cuts.length === 0 ? (
        <p className={styles.panelMuted}>Nothing has been cut yet.</p>
      ) : (
        <ul className={styles.suggestionList}>
          {cuts.map((card) => (
            <li
              key={card.name}
              data-testid={`crucible-row-${card.name}`}
              data-status="cut"
              className={styles.suggestionRow}
            >
              <span className={styles.rowQty}>{card.quantity}</span>
              <span className={styles.suggestionName}>{card.name}</span>
              <button
                type="button"
                className={styles.comboAction}
                aria-label={`Restore ${card.name}`}
                onClick={() => restore(card.name)}
              >
                ↩ Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
