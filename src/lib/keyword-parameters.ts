/**
 * Extracts the numeric parameter for a parameterized keyword (e.g. Ward 2,
 * Connive 3, Casualty 2) from a card's oracle text.
 *
 * Returns null when the keyword is missing, or its argument is non-numeric
 * (e.g. "ward {X}" or "ward — pay 2 life"). When the keyword appears multiple
 * times with different numeric arguments, the maximum is returned.
 *
 * Both `{N}` (mana-brace integer) and bare `N` arguments are recognized.
 */
export function extractKeywordParameter(
  text: string,
  keyword: string,
): number | null {
  if (!text || !keyword) return null;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b\\s*\\{?(\\d+)\\}?`, "gi");
  let max: number | null = null;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const n = parseInt(match[1], 10);
    if (!Number.isNaN(n) && (max === null || n > max)) max = n;
  }
  return max;
}
