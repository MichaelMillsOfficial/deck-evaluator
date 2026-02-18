import { parseDecklist } from "@/lib/decklist-parser";

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

  const { text } = body as { text?: string };

  if (!text || typeof text !== "string" || !text.trim()) {
    return Response.json(
      { error: "Missing required field: text" },
      { status: 400 }
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
