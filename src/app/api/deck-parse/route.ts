import { parseDecklist } from "@/lib/decklist-parser";

const MAX_TEXT_LENGTH = 50_000;

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (
    body === null ||
    typeof body !== "object" ||
    !("text" in body) ||
    typeof (body as Record<string, unknown>).text !== "string"
  ) {
    return Response.json(
      { error: "Missing required field: text (must be a string)" },
      { status: 400 }
    );
  }

  const text = ((body as { text: string }).text).trim();

  if (!text) {
    return Response.json(
      { error: "text field must not be empty" },
      { status: 400 }
    );
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return Response.json(
      { error: `Decklist text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` },
      { status: 413 }
    );
  }

  const deckData = parseDecklist(text);

  const totalCards =
    deckData.commanders.length +
    deckData.mainboard.length +
    deckData.sideboard.length;

  if (totalCards === 0) {
    return Response.json(
      { error: "No cards found in the provided decklist" },
      { status: 422 }
    );
  }

  return Response.json(deckData);
}
