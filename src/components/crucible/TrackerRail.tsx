"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCrucibleSession } from "@/contexts/CrucibleSessionContext";
import { useDeckSession } from "@/contexts/DeckSessionContext";
import { generateDeckId, type DeckSessionPayload } from "@/lib/deck-session";
import { Button, Input, Sheet } from "@/components/ui";
import { comboState } from "./CrucibleCombos";
import styles from "./crucible.module.css";

const DEFAULT_DECK_NAME = "Forged in the Crucible";

/** Categories worth a health bar in the rail (targets from the template). */
const RAIL_CATEGORIES = ["Lands", "Ramp", "Card Draw", "Removal", "Board Wipe"];

function TrackerContent() {
  const {
    payload,
    keptTotal,
    keptScorecard,
    legality,
    combos,
    combosOverBy,
    deckName,
    setDeckName,
    finalize,
    clearCrucible,
  } = useCrucibleSession();
  const { setPayload } = useDeckSession();
  const router = useRouter();
  const [sealing, setSealing] = useState(false);

  const comboSummary = useMemo(() => {
    if (!payload || !combos) return null;
    const all = [...combos.exactCombos, ...combos.nearCombos];
    if (all.length === 0) return null;
    const counts = { intact: 0, possible: 0, broken: 0 };
    for (const combo of all) counts[comboState(combo, payload)]++;
    return counts;
  }, [payload, combos]);

  if (!payload) return null;

  const poolTotal = payload.pool.reduce((sum, c) => sum + c.quantity, 0);
  const canSeal = legality?.isValid === true && !sealing;

  const handleSeal = () => {
    const trimmed = deckName.trim();
    const deck = finalize(trimmed.length > 0 ? trimmed : DEFAULT_DECK_NAME);
    if (!deck) return;
    setSealing(true);
    const readingPayload: DeckSessionPayload = {
      deckId: generateDeckId(),
      deck,
      parseWarnings: [],
      cardMap: null,
      notFoundCount: 0,
      spellbookCombos: null,
      createdAt: Date.now(),
    };
    setPayload(readingPayload);
    clearCrucible();
    router.push("/ritual");
  };

  return (
    <>
      <p className={styles.trackerEyebrow}>The Reckoning</p>
      <p data-testid="crucible-kept-count" className={styles.trackerCount}>
        {keptTotal}
        <span className={styles.trackerCountOf}> / 100</span>
      </p>
      <p className={styles.trackerSub}>cards kept · {poolTotal} in pool</p>

      {keptScorecard ? (
        <div data-testid="crucible-category-health" className={styles.trackerSection}>
          <p className={styles.trackerEyebrow}>Category Health</p>
          {keptScorecard.categories
            .filter((category) => RAIL_CATEGORIES.includes(category.label))
            .map((category) => {
              const ratio =
                category.min > 0 ? Math.min(1, category.count / category.min) : 1;
              return (
                <div key={category.tag} className={styles.trackerCategory}>
                  <span className={styles.trackerCategoryName}>{category.label}</span>
                  <span className={styles.trackerBar}>
                    <span
                      className={`${styles.trackerBarFill} ${
                        category.status === "good" || category.status === "high"
                          ? styles.trackerBarOk
                          : ""
                      }`}
                      style={{ width: `${Math.round(ratio * 100)}%` }}
                    />
                  </span>
                  <span className={styles.trackerCategoryCount}>
                    {category.count}/{category.min}
                  </span>
                </div>
              );
            })}
        </div>
      ) : null}

      {combosOverBy > 0 ? (
        <div className={styles.trackerSection}>
          <p className={styles.trackerEyebrow}>Combos</p>
          <p className={styles.trackerLine}>
            Cut {combosOverBy} more unique {combosOverBy === 1 ? "card" : "cards"} to
            enable combo detection
          </p>
        </div>
      ) : comboSummary ? (
        <div className={styles.trackerSection}>
          <p className={styles.trackerEyebrow}>Combos</p>
          <p className={styles.trackerLine}>✓ {comboSummary.intact} intact in kept</p>
          <p className={styles.trackerLine}>◇ {comboSummary.possible} possible in pool</p>
          <p className={styles.trackerLine}>✕ {comboSummary.broken} broken by cuts</p>
        </div>
      ) : null}

      <div className={styles.trackerSection}>
        <p className={styles.trackerEyebrow}>Legality</p>
        {legality === null ? (
          <p className={styles.trackerLine}>Consulting the format rules…</p>
        ) : legality.isValid ? (
          <p className={`${styles.trackerLine} ${styles.trackerOk}`}>
            ✓ Legal Commander deck
          </p>
        ) : (
          legality.errors.slice(0, 4).map((error) => (
            <p key={error.message} className={`${styles.trackerLine} ${styles.trackerWarn}`}>
              ✕ {error.message}
            </p>
          ))
        )}
      </div>

      <div className={styles.deckNameField}>
        <p className={styles.trackerEyebrow}>Deck Name</p>
        <Input
          aria-label="Deck name"
          placeholder={DEFAULT_DECK_NAME}
          value={deckName}
          onChange={(e) => setDeckName(e.target.value)}
        />
      </div>

      <Button
        variant="primary"
        className={styles.sealButton}
        disabled={!canSeal}
        onClick={handleSeal}
      >
        Seal the Deck → Reading
      </Button>
    </>
  );
}

export default function TrackerRail() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <aside
        data-testid="crucible-tracker"
        aria-label="Deck tracker"
        className={styles.tracker}
      >
        <TrackerContent />
      </aside>
      <button
        type="button"
        className={styles.trackerToggle}
        onClick={() => setSheetOpen(true)}
      >
        Open tracker
      </button>
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        eyebrow="The Reckoning"
        title="Deck tracker"
      >
        <TrackerContent />
      </Sheet>
    </>
  );
}
