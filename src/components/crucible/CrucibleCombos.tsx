"use client";

import type { SpellbookCombo } from "@/lib/commander-spellbook";
import type { CruciblePayload } from "@/lib/crucible-session";
import { useCrucibleSession } from "@/contexts/CrucibleSessionContext";
import { Tag } from "@/components/ui";
import styles from "./crucible.module.css";

export type ComboState = "intact" | "possible" | "broken";

/** Derive a combo's live state from triage statuses: every piece kept means
 * intact, any piece cut means broken, otherwise still possible. Pieces not in
 * the pool at all (near-combo missing cards) leave the combo "possible". */
export function comboState(combo: SpellbookCombo, payload: CruciblePayload): ComboState {
  let allKept = true;
  for (const piece of combo.cards) {
    const status = payload.statuses[piece];
    if (status === "cut") return "broken";
    if (status !== "keep") allKept = false;
  }
  return allKept && combo.cards.length > 0 ? "intact" : "possible";
}

const STATE_TAG: Record<ComboState, { variant: "ok" | "watch" | "warn"; label: string }> = {
  intact: { variant: "ok", label: "Intact" },
  possible: { variant: "watch", label: "Possible" },
  broken: { variant: "warn", label: "Broken" },
};

export default function CrucibleCombos() {
  const { payload, combos, combosLoading, setStatus, restore } = useCrucibleSession();

  if (!payload) return null;

  const allCombos: SpellbookCombo[] = [
    ...(combos?.exactCombos ?? []),
    ...(combos?.nearCombos ?? []),
  ];

  return (
    <section data-testid="crucible-combos" aria-label="Combos in pile" className={styles.panel}>
      <h2 className={styles.panelTitle}>Combos in Pile</h2>
      {combosLoading ? (
        <p className={styles.panelMuted}>Consulting the Spellbook…</p>
      ) : allCombos.length === 0 ? (
        <p className={styles.panelMuted}>No known combos detected in this pile.</p>
      ) : (
        <ul className={styles.comboList}>
          {allCombos.map((combo) => {
            const state = comboState(combo, payload);
            const tag = STATE_TAG[state];
            const cutPieces = combo.cards.filter(
              (piece) => payload.statuses[piece] === "cut"
            );
            const undecidedPieces = combo.cards.filter(
              (piece) => payload.statuses[piece] === "undecided"
            );
            return (
              <li key={combo.id} className={`${styles.comboRow} ${styles[`combo_${state}`]}`}>
                <div className={styles.comboHead}>
                  <Tag variant={tag.variant}>{tag.label}</Tag>
                  <span className={styles.comboCards}>{combo.cards.join(" + ")}</span>
                </div>
                {combo.produces.length > 0 ? (
                  <p className={styles.comboProduces}>{combo.produces.join(" · ")}</p>
                ) : null}
                {state === "possible" && undecidedPieces.length > 0 ? (
                  <button
                    type="button"
                    className={styles.comboAction}
                    onClick={() => {
                      for (const piece of undecidedPieces) setStatus(piece, "keep");
                    }}
                  >
                    Keep all {combo.cards.length}
                  </button>
                ) : null}
                {state === "broken"
                  ? cutPieces.map((piece) => (
                      <button
                        key={piece}
                        type="button"
                        className={styles.comboAction}
                        onClick={() => restore(piece)}
                      >
                        Restore {piece}
                      </button>
                    ))
                  : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
