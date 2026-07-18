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
        if (payload.commanders.includes(card.name)) return false;
        const enriched = cardMap[card.name];
        return enriched ? isLegalCommander(enriched) : false;
      })
      .map((card) => card.name);
  }, [payload, cardMap]);

  if (!payload) return null;

  const commanders = payload.commanders;

  const candidateButtons = (label: string) => (
    <span className={styles.commanderCandidates}>
      {candidates.slice(0, MAX_CANDIDATES_SHOWN).map((name) => (
        <Button
          key={name}
          variant="secondary"
          size="sm"
          aria-label={`Choose ${name}`}
          onClick={() => setCommanders([...commanders, name])}
        >
          {name}
        </Button>
      ))}
      {candidates.length > MAX_CANDIDATES_SHOWN ? (
        <span className={styles.commanderMore}>
          +{candidates.length - MAX_CANDIDATES_SHOWN} more {label} in the pile
        </span>
      ) : null}
    </span>
  );

  if (commanders.length > 0) {
    return (
      <div data-testid="crucible-commander-picker" className={styles.commanderPicker}>
        <span className={styles.commanderEyebrow}>
          {commanders.length === 2 ? "Commanders" : "Commander"}
        </span>
        {commanders.map((name) => (
          <span key={name} className={styles.commanderName}>
            {name}
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove ${name}`}
              onClick={() => setCommanders(commanders.filter((n) => n !== name))}
            >
              Remove
            </Button>
          </span>
        ))}
        {commanders.length === 1 && candidates.length > 0 ? (
          <>
            <span className={styles.commanderMore}>Add a partner:</span>
            {candidateButtons("legendaries")}
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div data-testid="crucible-commander-picker" className={styles.commanderPicker}>
      <span className={styles.commanderEyebrow}>Choose a commander</span>
      {candidates.length === 0 ? (
        <Tag variant="watch">No legal commanders in the pile</Tag>
      ) : (
        candidateButtons("legendaries")
      )}
    </div>
  );
}
