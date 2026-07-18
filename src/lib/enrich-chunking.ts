/** /api/deck-enrich rejects requests above this many unique names, so
 * clients enrich larger pools in batches of this size. The route derives its
 * MAX_UNIQUE_NAMES cap from this constant, keeping the two in sync. */
export const ENRICH_CHUNK_SIZE = 250;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
