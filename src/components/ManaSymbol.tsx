function symbolToFilename(symbol: string): string {
  return symbol.replace(/\//g, "") + ".svg";
}

const SIZE_MAP: Record<string, { px: number; className: string }> = {
  sm: { px: 16, className: "h-4 w-4" },
  md: { px: 20, className: "h-5 w-5" },
};

interface ManaSymbolProps {
  symbol: string;
  size?: "sm" | "md";
}

export default function ManaSymbol({
  symbol,
  size = "md",
}: ManaSymbolProps) {
  const filename = symbolToFilename(symbol);
  const { px, className } = SIZE_MAP[size];
  return (
    <img
      src={`https://svgs.scryfall.io/card-symbols/${filename}`}
      alt=""
      aria-hidden="true"
      loading="lazy"
      width={px}
      height={px}
      className={`${className} shrink-0 inline-block align-text-bottom`}
    />
  );
}
