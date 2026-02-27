const SCRYFALL_AUTOCOMPLETE = "https://api.scryfall.com/cards/autocomplete";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (q.length < 2) {
    return Response.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `${SCRYFALL_AUTOCOMPLETE}?q=${encodeURIComponent(q)}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!res.ok) {
      return Response.json(
        { error: "Scryfall autocomplete request failed" },
        { status: 502 }
      );
    }

    const json = (await res.json()) as { data: string[] };
    return Response.json({ suggestions: json.data });
  } catch {
    return Response.json(
      { error: "Scryfall autocomplete request failed" },
      { status: 502 }
    );
  }
}
