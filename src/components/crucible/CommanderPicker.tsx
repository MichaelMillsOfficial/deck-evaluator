"use client";

import { useMemo } from "react";
import { useCrucibleSession } from "@/contexts/CrucibleSessionContext";
import { isLegalCommander } from "@/lib/commander-validation";
import { Button, Tag } from "@/components/ui";
import styles from "./crucible.module.css";

const MAX_CANDIDATES_SHOWN = 8;

export default function CommanderPicker() {
  const { payload, cardMap, setCommanders } = useCrucibleSession();

  const candidates = useMemo(() => {
    if (!payload || !cardMap) return [];
    return payload.pool
      .filter((card) => {
        const enriched = cardMap[card.name];
        return enriched ? isLegalCommander(enriched) : false;
      })
      .map((card) => card.name);
  }, [payload, cardMap]);

  if (!payload) return null;

  if (payload.commanders.length > 0) {
    return (
      <div data-testid="crucible-commander-picker" className={styles.commanderPicker}>
        <span className={styles.commanderEyebrow}>Commander</span>
        <span className={styles.commanderName}>{payload.commanders.join(" + ")}</span>
        <Button variant="ghost" size="sm" onClick={() => setCommanders([])}>
          Change commander
        </Button>
      </div>
    );
  }

  return (
    <div data-testid="crucible-commander-picker" className={styles.commanderPicker}>
      <span className={styles.commanderEyebrow}>Choose a commander</span>
      {candidates.length === 0 ? (
        <Tag variant="watch">No legal commanders in the pile</Tag>
      ) : (
        <span className={styles.commanderCandidates}>
          {candidates.slice(0, MAX_CANDIDATES_SHOWN).map((name) => (
            <Button
              key={name}
              variant="secondary"
              size="sm"
              aria-label={`Choose ${name}`}
              onClick={() => setCommanders([name])}
            >
              {name}
            </Button>
          ))}
          {candidates.length > MAX_CANDIDATES_SHOWN ? (
            <span className={styles.commanderMore}>
              +{candidates.length - MAX_CANDIDATES_SHOWN} more legendaries in the pile
            </span>
          ) : null}
        </span>
      )}
    </div>
  );
}
