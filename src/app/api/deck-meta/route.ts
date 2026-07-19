import { resolveEdhrecMeta } from "@/lib/edhrec-fetch";

const MAX_COMMANDERS = 4;
const MAX_NAME_LENGTH = 200;

/**
 * POST /api/deck-meta
 * Body: { commanders: string[] }
 * Returns an EDHREC inclusion envelope { source, commanderLabel, inclusionMap,
 * potentialDecks, error? }. Never throws to the client: an empty inclusionMap
 * is the "no-data" signal; `error` is set only on transport failure.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawCommanders = (body as Record<string, unknown>)?.commanders;
  if (!Array.isArray(rawCommanders)) {
    return Response.json(
      { error: "Missing required field: commanders (must be an array)" },
      { status: 400 }
    );
  }

  const commanders: string[] = [];
  for (const name of rawCommanders) {
    if (typeof name !== "string") continue;
    const trimmed = name.trim();
    if (!trimmed) continue;
    if (trimmed.length > MAX_NAME_LENGTH) {
      return Response.json(
        { error: `Commander name exceeds ${MAX_NAME_LENGTH} characters` },
        { status: 400 }
      );
    }
    commanders.push(trimmed);
    if (commanders.length >= MAX_COMMANDERS) break;
  }

  const envelope = await resolveEdhrecMeta(commanders);
  return Response.json(envelope);
}
