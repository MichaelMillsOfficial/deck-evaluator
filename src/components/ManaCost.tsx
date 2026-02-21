"use client";

import ManaSymbol from "@/components/ManaSymbol";

const PIP_REGEX = /\{([^}]+)\}/g;

const COLOR_NAMES: Record<string, string> = {
  W: "white",
  U: "blue",
  B: "black",
  R: "red",
  G: "green",
  C: "colorless",
};

function getAriaLabel(manaCost: string): string {
  if (!manaCost) return "No mana cost";

  const parts: string[] = [];
  for (const match of manaCost.matchAll(PIP_REGEX)) {
    const symbol = match[1];

    if (symbol in COLOR_NAMES) {
      parts.push(COLOR_NAMES[symbol]);
    } else if (symbol === "X") {
      parts.push("X");
    } else if (/^\d+$/.test(symbol)) {
      parts.push(`${symbol} generic`);
    } else if (/^([WUBRG])\/([WUBRG])$/.test(symbol)) {
      const [c1, c2] = symbol.split("/");
      parts.push(`${COLOR_NAMES[c1]} or ${COLOR_NAMES[c2]}`);
    } else if (/^([WUBRG])\/P$/.test(symbol)) {
      const color = symbol.split("/")[0];
      parts.push(`Phyrexian ${COLOR_NAMES[color]}`);
    } else {
      parts.push(symbol);
    }
  }

  return `Mana cost: ${parts.join(", ")}`;
}

export default function ManaCost({ cost }: { cost: string }) {
  if (!cost) return null;

  const pips: Array<{ symbol: string; key: number }> = [];
  let i = 0;
  for (const match of cost.matchAll(PIP_REGEX)) {
    pips.push({ symbol: match[1], key: i++ });
  }

  if (pips.length === 0) return null;

  return (
    <span
      aria-label={getAriaLabel(cost)}
      className="inline-flex items-center gap-0.5"
    >
      {pips.map(({ symbol, key }) => (
        <ManaSymbol key={key} symbol={symbol} />
      ))}
    </span>
  );
}
