"use client";

import { useState } from "react";
import type { DeckCard, EnrichedCard } from "@/lib/types";
import type { CrucibleCardStatus } from "@/lib/crucible-session";
import ManaCost from "@/components/ManaCost";
import { Input, Tag } from "@/components/ui";
import styles from "./crucible.module.css";

export interface CrucibleCardRowProps {
  card: DeckCard;
  enriched?: EnrichedCard;
  status: CrucibleCardStatus;
  offIdentity?: boolean;
  synergyScore?: number;
  /** Optional lens-specific annotation, e.g. "+2 axes" in the axis lens. */
  badge?: string;
  /** Commanders are forced to "keep"; their triage controls are disabled. */
  locked?: boolean;
  /** Currently kept copies (partial-keep aware). Drives the stepper shown on
   * stacked rows when onSetKeptQuantity is provided. */
  keptQuantity?: number;
  onKeep: () => void;
  onCut: () => void;
  onSetKeptQuantity?: (count: number) => void;
}

export default function CrucibleCardRow({
  card,
  enriched,
  status,
  offIdentity,
  synergyScore,
  badge,
  locked,
  keptQuantity,
  onKeep,
  onCut,
  onSetKeptQuantity,
}: CrucibleCardRowProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const statusClass =
    status === "cut" ? styles.rowCut : status === "keep" ? styles.rowKept : "";

  return (
    <div
      data-testid={`crucible-row-${card.name}`}
      data-status={status}
      className={`${styles.row} ${statusClass}`}
    >
      <span className={styles.rowQty}>{card.quantity}</span>
      <span className={styles.rowNameWrap}>
        <button
          type="button"
          data-testid="crucible-card-name"
          className={styles.rowName}
          onMouseEnter={() => setPreviewOpen(true)}
          onMouseLeave={() => setPreviewOpen(false)}
          onFocus={() => setPreviewOpen(true)}
          onBlur={() => setPreviewOpen(false)}
          onClick={() => setPreviewOpen((open) => !open)}
          aria-label={`${card.name} details`}
        >
          {card.name}
        </button>
        {previewOpen && enriched ? (
          <span
            data-testid="crucible-card-preview"
            role="tooltip"
            className={styles.preview}
          >
            {enriched.imageUris ? (
              <img
                src={enriched.imageUris.normal}
                alt={`${card.name} card`}
                className={styles.previewImage}
              />
            ) : (
              <>
                <span className={styles.previewName}>{card.name}</span>
                <span className={styles.previewType}>{enriched.typeLine}</span>
                {enriched.oracleText ? (
                  <span className={styles.previewOracle}>{enriched.oracleText}</span>
                ) : null}
              </>
            )}
          </span>
        ) : null}
      </span>
      {enriched?.manaCost ? <ManaCost cost={enriched.manaCost} /> : null}
      {badge ? <span className={styles.rowBadge}>{badge}</span> : null}
      {offIdentity ? <Tag variant="warn">Off-identity</Tag> : null}
      {synergyScore !== undefined ? (
        <span className={styles.rowSynergy} aria-label={`Synergy score ${synergyScore}`}>
          {synergyScore}
        </span>
      ) : null}
      <span className={styles.rowTriage}>
        {card.quantity > 1 && onSetKeptQuantity ? (
          <Input
            type="number"
            mono
            min={0}
            max={card.quantity}
            value={keptQuantity ?? 0}
            disabled={locked}
            aria-label={`Kept copies of ${card.name}`}
            className={styles.rowKeptQty}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next)) onSetKeptQuantity(next);
            }}
          />
        ) : null}
        <button
          type="button"
          className={`${styles.triageButton} ${status === "keep" ? styles.triageKeepOn : ""}`}
          aria-pressed={status === "keep"}
          aria-label={`Keep ${card.name}`}
          disabled={locked}
          onClick={onKeep}
        >
          ✓
        </button>
        <button
          type="button"
          className={`${styles.triageButton} ${status === "cut" ? styles.triageCutOn : ""}`}
          aria-pressed={status === "cut"}
          aria-label={`Cut ${card.name}`}
          disabled={locked}
          onClick={onCut}
        >
          ✕
        </button>
      </span>
    </div>
  );
}
