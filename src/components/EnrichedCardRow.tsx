"use client";

import { useState, useCallback, memo } from "react";
import type { CardFace, EnrichedCard } from "@/lib/types";
import ManaCost from "@/components/ManaCost";
import CardTags from "@/components/CardTags";
import OracleText from "@/components/OracleText";
import { formatUSD } from "@/lib/budget-analysis";
import { getFaceDisplayMode } from "@/lib/card-layout";
import styles from "./EnrichedCardRow.module.css";

// ---------------------------------------------------------------------------
// CardFaceDetail — renders a single face's details (reused by tabs & inline)
// ---------------------------------------------------------------------------

function CardFaceDetail({ face }: { face: CardFace }) {
  return (
    <div
      className={styles.detailBlock}
      data-testid={`face-detail-${face.name.replace(/[^a-zA-Z0-9]/g, "-")}`}
    >
      <p className={styles.faceTypeline}>{face.typeLine}</p>
      {face.manaCost && (
        <div>
          <ManaCost cost={face.manaCost} />
        </div>
      )}
      {face.oracleText && <OracleText text={face.oracleText} />}
      <div className={styles.statRow}>
        {face.power !== null && face.toughness !== null && (
          <span>
            P/T: {face.power}/{face.toughness}
          </span>
        )}
        {face.loyalty !== null && <span>Loyalty: {face.loyalty}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multi-face detail renderers
// ---------------------------------------------------------------------------

function TabsFaceDetail({
  faces,
  activeFace,
  setActiveFace,
}: {
  faces: CardFace[];
  activeFace: number;
  setActiveFace: (i: number) => void;
}) {
  return (
    <div>
      <div className={styles.faceTabs} role="tablist" aria-label="Card faces">
        {faces.map((face, i) => (
          <button
            key={face.name}
            role="tab"
            aria-selected={i === activeFace}
            aria-controls={`face-panel-${i}`}
            onClick={() => setActiveFace(i)}
            className={[
              styles.faceTab,
              i === activeFace && styles.faceTabActive,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {face.name}
          </button>
        ))}
      </div>
      <div id={`face-panel-${activeFace}`} role="tabpanel">
        <CardFaceDetail face={faces[activeFace]} />
      </div>
    </div>
  );
}

function InlineFaceDetail({ faces }: { faces: CardFace[] }) {
  return (
    <div>
      {faces.map((face) => (
        <div key={face.name} className={styles.inlineFace}>
          <p className={styles.faceName}>{face.name}</p>
          <CardFaceDetail face={face} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EnrichedCardRow
// ---------------------------------------------------------------------------

interface EnrichedCardRowProps {
  card: EnrichedCard;
  quantity: number;
}

export default memo(function EnrichedCardRow({
  card,
  quantity,
}: EnrichedCardRowProps) {
  const [open, setOpen] = useState(false);
  const [activeFace, setActiveFace] = useState(0);

  const detailId = `card-detail-${card.name.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const displayMode = getFaceDisplayMode(card.layout);
  const isMultiFace = (card.cardFaces?.length ?? 0) > 1;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    },
    [open]
  );

  return (
    <>
      <tr className={styles.row}>
        <td className={styles.tdQty}>
          <span className="sr-only">{quantity}x </span>
          {quantity}
        </td>
        <td className={styles.tdCost}>
          <ManaCost cost={card.manaCost} />
        </td>
        <td className={styles.tdName}>
          <div className={styles.nameCell}>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={detailId}
              onClick={() => setOpen(!open)}
              onKeyDown={handleKeyDown}
              className={styles.nameButton}
            >
              <svg
                data-testid="expand-chevron"
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={[styles.chevron, open && styles.chevronOpen]
                  .filter(Boolean)
                  .join(" ")}
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
              <span className={styles.nameLabel}>
                {card.name}
                {card.flavorName && (
                  <span className={styles.flavorName}>
                    ({card.flavorName})
                  </span>
                )}
              </span>
            </button>
            <CardTags card={card} />
          </div>
        </td>
        <td className={styles.tdType}>{card.typeLine}</td>
      </tr>
      {open && (
        <tr id={detailId} className={styles.detailRow}>
          <td colSpan={4}>
            {/* Multi-face: tabs or inline based on layout */}
            {isMultiFace && displayMode === "tabs" && (
              <TabsFaceDetail
                faces={card.cardFaces}
                activeFace={activeFace}
                setActiveFace={setActiveFace}
              />
            )}
            {isMultiFace && displayMode === "inline" && (
              <InlineFaceDetail faces={card.cardFaces} />
            )}

            {/* Single-face or fallback: original rendering */}
            {(!isMultiFace || displayMode === "single") && (
              <div className={styles.detailBlock}>
                {/* Type line (visible on mobile since column is hidden) */}
                <p className={styles.detailMobileType}>{card.typeLine}</p>

                {/* Oracle text */}
                {card.oracleText && <OracleText text={card.oracleText} />}

                {/* Stats row */}
                <div className={styles.statRow}>
                  {card.power !== null && card.toughness !== null && (
                    <span>
                      P/T: {card.power}/{card.toughness}
                    </span>
                  )}
                  {card.loyalty !== null && <span>Loyalty: {card.loyalty}</span>}
                  {card.keywords.length > 0 && (
                    <span>Keywords: {card.keywords.join(", ")}</span>
                  )}
                  <span>Rarity: {card.rarity}</span>
                  {card.prices.usd != null && (
                    <span data-testid="card-price">
                      Price: {formatUSD(card.prices.usd)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Shared stats for multi-face cards (keywords, rarity, price) */}
            {isMultiFace && displayMode !== "single" && (
              <div className={styles.statRow} style={{ marginTop: "var(--space-5)" }}>
                {card.keywords.length > 0 && (
                  <span>Keywords: {card.keywords.join(", ")}</span>
                )}
                <span>Rarity: {card.rarity}</span>
                {card.prices.usd != null && (
                  <span data-testid="card-price">
                    Price: {formatUSD(card.prices.usd)}
                  </span>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
});
