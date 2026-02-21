"use client";

const PIP_REGEX = /\{([^}]+)\}/g;

const COLOR_NAMES: Record<string, string> = {
  W: "white",
  U: "blue",
  B: "black",
  R: "red",
  G: "green",
  C: "colorless",
};

const PIP_COLORS: Record<string, string> = {
  W: "bg-amber-300 text-amber-900",
  U: "bg-blue-500 text-white",
  B: "bg-gray-900 text-gray-300 ring-1 ring-gray-600",
  R: "bg-red-600 text-white",
  G: "bg-green-600 text-white",
  C: "bg-gray-500 text-white",
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

function getPipStyle(symbol: string): string {
  if (symbol in PIP_COLORS) return PIP_COLORS[symbol];
  // Generic/numeric or special — use gray
  return "bg-gray-600 text-white";
}

function getPipDisplay(symbol: string): string {
  if (symbol in COLOR_NAMES) return symbol;
  if (/^([WUBRG])\/([WUBRG])$/.test(symbol)) return symbol;
  if (/^([WUBRG])\/P$/.test(symbol)) return symbol.split("/")[0];
  return symbol;
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
        <span
          key={key}
          aria-hidden="true"
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold leading-none ${getPipStyle(symbol)}`}
        >
          {getPipDisplay(symbol)}
        </span>
      ))}
    </span>
  );
}
