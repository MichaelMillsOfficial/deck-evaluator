"use client";

import styles from "./crucible.module.css";

export type CrucibleLens =
  | "category"
  | "axis"
  | "type"
  | "mv"
  | "color"
  | "meta"
  | "list"
  | "gamechangers"
  | "charts"
  | "combos"
  | "cuts"
  | "cutpile";

const LENSES: { id: CrucibleLens; label: string }[] = [
  { id: "category", label: "By Category" },
  { id: "axis", label: "By Synergy Axis" },
  { id: "type", label: "By Type Line" },
  { id: "mv", label: "By Mana Value" },
  { id: "color", label: "By Color Identity" },
  { id: "meta", label: "By Meta (Stock ↔ Spicy)" },
  { id: "list", label: "Flat List" },
  { id: "gamechangers", label: "Game Changers" },
];

const INSIGHTS: { id: CrucibleLens; label: string }[] = [
  { id: "charts", label: "Charts" },
  { id: "combos", label: "Combos in Pile" },
  { id: "cuts", label: "Suggested Cuts" },
  { id: "cutpile", label: "Cut Pile" },
];

export interface LensSwitcherProps {
  active: CrucibleLens;
  onSelect: (lens: CrucibleLens) => void;
  undecidedOnly: boolean;
  onToggleUndecided: () => void;
  cutCount: number;
}

export default function LensSwitcher({
  active,
  onSelect,
  undecidedOnly,
  onToggleUndecided,
  cutCount,
}: LensSwitcherProps) {
  const renderButton = ({ id, label }: { id: CrucibleLens; label: string }) => (
    <button
      key={id}
      type="button"
      className={`${styles.lensButton} ${active === id ? styles.lensButtonActive : ""}`}
      aria-pressed={active === id}
      onClick={() => onSelect(id)}
    >
      <span className={styles.lensDot} aria-hidden="true" />
      {label}
      {id === "cutpile" && cutCount > 0 ? (
        <span className={styles.lensCount}>{cutCount}</span>
      ) : null}
    </button>
  );

  return (
    <nav
      data-testid="crucible-lens-switcher"
      aria-label="Crucible lenses"
      className={styles.lensNav}
    >
      <p className={styles.lensEyebrow}>Lenses</p>
      {LENSES.map(renderButton)}
      <hr className={styles.lensDivider} />
      <p className={styles.lensEyebrow}>Insight</p>
      {INSIGHTS.map(renderButton)}
      <hr className={styles.lensDivider} />
      <p className={styles.lensEyebrow}>Filter</p>
      <button
        type="button"
        className={`${styles.lensButton} ${undecidedOnly ? styles.lensButtonActive : ""}`}
        aria-pressed={undecidedOnly}
        onClick={onToggleUndecided}
      >
        <span className={styles.lensDot} aria-hidden="true" />
        Undecided only
      </button>
    </nav>
  );
}
