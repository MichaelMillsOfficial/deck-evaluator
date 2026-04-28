/**
 * Format a wall-clock timestamp as the magazine-style reading date used
 * in editorial running heads, e.g. `04.28.26`.
 */
export function formatReadingDate(timestamp: number): string {
  const d = new Date(timestamp);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}.${dd}.${yy}`;
}

/**
 * Build the running head shown above each chapter cover, e.g.
 * `READING · 04.28.26 · IMPORTED DECK`. Carries the date thread from
 * the reading hero down into every detail page.
 */
export function readingRunningHead(
  createdAt: number,
  deckName: string
): string {
  return `READING · ${formatReadingDate(createdAt)} · ${deckName}`;
}
