import styles from "./ManaCost.module.css";

export type ManaSymbol = "W" | "U" | "B" | "R" | "G" | "C" | "X" | string;

export type ManaCostProps = {
  /** Symbols in order, e.g. ["2", "U", "G"]. */
  symbols: ManaSymbol[];
  size?: "md" | "lg";
  className?: string;
};

const COLOR_KEY: Record<string, string> = {
  W: "w",
  U: "u",
  B: "b",
  R: "r",
  G: "g",
  C: "c",
};

const COLOR_LABEL: Record<string, string> = {
  W: "white",
  U: "blue",
  B: "black",
  R: "red",
  G: "green",
  C: "colorless",
};

function classify(symbol: string): { className: string; label: string; display: string } {
  const up = symbol.toUpperCase();
  if (up in COLOR_KEY) {
    return {
      className: styles[COLOR_KEY[up]],
      label: COLOR_LABEL[up],
      display: up,
    };
  }
  if (up === "X") {
    return { className: styles.c, label: "X", display: "X" };
  }
  // Generic numeric (treat as colorless visually)
  return { className: styles.c, label: "generic", display: up };
}

function buildAriaLabel(symbols: ManaSymbol[]): string {
  const colored: Record<string, number> = {};
  let generic = 0;
  let xCount = 0;
  for (const s of symbols) {
    const up = String(s).toUpperCase();
    if (up in COLOR_LABEL) {
      colored[up] = (colored[up] ?? 0) + 1;
    } else if (up === "X") {
      xCount += 1;
    } else {
      const n = Number(up);
      if (!Number.isNaN(n)) generic += n;
    }
  }
  const parts: string[] = [];
  if (generic > 0) parts.push(`${generic} generic`);
  if (xCount > 0) parts.push(`${xCount} X`);
  for (const k of ["W", "U", "B", "R", "G", "C"]) {
    if (colored[k]) {
      parts.push(`${colored[k]} ${COLOR_LABEL[k]}`);
    }
  }
  return parts.length === 0 ? "no mana cost" : `Mana cost: ${parts.join(", ")}`;
}

export function ManaCost({ symbols, size = "md", className }: ManaCostProps) {
  const classes = [styles.cost, size === "lg" && styles.lg, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={classes}
      role="img"
      aria-label={buildAriaLabel(symbols)}
    >
      {symbols.map((s, i) => {
        const { className: pipClass, display } = classify(String(s));
        return (
          <span
            key={i}
            data-pip
            className={[styles.pip, pipClass].filter(Boolean).join(" ")}
            aria-hidden="true"
          >
            {display}
          </span>
        );
      })}
    </span>
  );
}
