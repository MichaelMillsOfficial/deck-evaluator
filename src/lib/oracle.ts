export type OracleToken =
  | { type: "text"; value: string }
  | { type: "symbol"; value: string };

const SYMBOL_REGEX = /\{([^}]+)\}/g;

export function parseOracleText(text: string): OracleToken[] {
  if (!text) return [];

  const tokens: OracleToken[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(SYMBOL_REGEX)) {
    const matchStart = match.index!;
    if (matchStart > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, matchStart) });
    }
    tokens.push({ type: "symbol", value: match[1] });
    lastIndex = matchStart + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }

  return tokens;
}
