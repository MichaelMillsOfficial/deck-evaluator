import styles from "./ManaCost.module.css";

export type ManaSymbol = "W" | "U" | "B" | "R" | "G" | "C" | "X" | string;

export type ManaCostProps = {
  /** Symbols in order, e.g. ["2", "U", "G"] or ["W/U", "B/P"]. */
  symbols: ManaSymbol[];
  /** Pip diameter. md=16, lg=22. Override numerically for finer control. */
  size?: "md" | "lg" | number;
  className?: string;
};

const COLOR_LABEL: Record<string, string> = {
  W: "white",
  U: "blue",
  B: "black",
  R: "red",
  G: "green",
  C: "colorless",
  S: "snow",
};

function symbolToFilename(symbol: string): string {
  return symbol.replace(/\//g, "") + ".svg";
}

function describeSymbol(symbol: string): string {
  const up = symbol.toUpperCase();
  if (up in COLOR_LABEL) return COLOR_LABEL[up];
  if (up === "X" || up === "Y" || up === "Z") return up;
  if (/^\d+$/.test(up)) return `${up} generic`;
  // Hybrid color: W/U → "white or blue"
  const hybrid = up.match(/^([WUBRG])\/([WUBRG])$/);
  if (hybrid) return `${COLOR_LABEL[hybrid[1]]} or ${COLOR_LABEL[hybrid[2]]}`;
  // Hybrid generic-color: 2/W → "2 or white"
  const genHybrid = up.match(/^(\d+)\/([WUBRG])$/);
  if (genHybrid) return `${genHybrid[1]} or ${COLOR_LABEL[genHybrid[2]]}`;
  // Phyrexian: U/P → "Phyrexian blue"
  const phy = up.match(/^([WUBRG])\/P$/);
  if (phy) return `Phyrexian ${COLOR_LABEL[phy[1]]}`;
  if (up === "T") return "tap";
  if (up === "Q") return "untap";
  return up;
}

function buildAriaLabel(symbols: ManaSymbol[]): string {
  if (symbols.length === 0) return "no mana cost";

  const colored: Record<string, number> = {};
  let generic = 0;
  let xCount = 0;
  const others: string[] = [];

  for (const s of symbols) {
    const up = String(s).toUpperCase();
    if (up in COLOR_LABEL) {
      colored[up] = (colored[up] ?? 0) + 1;
      continue;
    }
    if (up === "X") {
      xCount += 1;
      continue;
    }
    if (/^\d+$/.test(up)) {
      generic += Number(up);
      continue;
    }
    others.push(describeSymbol(String(s)));
  }

  const parts: string[] = [];
  if (generic > 0) parts.push(`${generic} generic`);
  if (xCount > 0) parts.push(`${xCount} X`);
  for (const k of ["W", "U", "B", "R", "G", "C", "S"]) {
    if (colored[k]) parts.push(`${colored[k]} ${COLOR_LABEL[k]}`);
  }
  parts.push(...others);

  return `Mana cost: ${parts.join(", ")}`;
}

const SIZE_PX: Record<"md" | "lg", number> = { md: 16, lg: 22 };

export function ManaCost({ symbols, size = "md", className }: ManaCostProps) {
  const px = typeof size === "number" ? size : SIZE_PX[size];
  const classes = [styles.cost, className].filter(Boolean).join(" ");

  return (
    <span className={classes} role="img" aria-label={buildAriaLabel(symbols)}>
      {symbols.map((s, i) => (
        <img
          key={i}
          data-pip
          className={styles.pip}
          src={`https://svgs.scryfall.io/card-symbols/${symbolToFilename(String(s))}`}
          alt=""
          aria-hidden="true"
          loading="lazy"
          width={px}
          height={px}
        />
      ))}
    </span>
  );
}
