# Add a new API route

Create a new Next.js API route following the established codebase patterns. The route: $ARGUMENTS

## Required patterns

### File structure
1. Place at `src/app/api/<kebab-case-route>/route.ts`
2. Use `@/lib/...` import alias (not relative paths)
3. Export async function with explicit return type:
   ```ts
   export async function POST(request: Request): Promise<Response>
   ```

### Request handling
- Guard constants at top of file:
  ```ts
  const MAX_TEXT_LENGTH = 50_000;
  const MAX_UNIQUE_NAMES = 250;
  const MAX_NAME_LENGTH = 200;
  ```
- Always wrap JSON parsing in try/catch returning 400:
  ```ts
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  ```
- Manual TypeScript narrowing for input validation (no schema libraries):
  ```ts
  if (body === null || typeof body !== "object" || !("field" in body) ||
      typeof (body as Record<string, unknown>).field !== "string") {
    return Response.json({ error: "Missing required field: field (must be a string)" }, { status: 400 });
  }
  ```

### Error status codes
- `400` — bad request / validation failure
- `413` — payload too large
- `422` — unprocessable (e.g., no cards found)
- `502` — upstream API failure

### Upstream error pattern
```ts
} catch (err) {
  const message = err instanceof Error ? err.message : "Unknown error";
  console.error("[route-name] error:", message);
  return Response.json({ error: "Failed to fetch data from ExternalService" }, { status: 502 });
}
```

### Success response
```ts
return Response.json(data);  // implicit 200
```

## Corresponding e2e test

Create `e2e/api-<route-name>.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("POST /api/<route-name>", () => {
  test("returns 400 for missing body", async ({ request }) => {
    const res = await request.post("/api/<route-name>");
    expect(res.status()).toBe(400);
  });

  test("returns 200 with valid input", async ({ request }) => {
    const res = await request.post("/api/<route-name>", {
      data: { /* valid payload */ },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    // assert response shape
  });
});
```

Note: API e2e tests import directly from `@playwright/test` (not `./fixtures`) since they don't need the `deckPage` fixture.
