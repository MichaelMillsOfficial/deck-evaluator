# Add a new MTG card tag

Add a new heuristic card tag to the tagging system. The tag: $ARGUMENTS

## Steps

### 1. Add detection regex(es) to `src/lib/card-tags.ts`

Add named regex constants at the module level in SCREAMING_SNAKE_CASE, placed alongside existing constants:

```ts
const NEW_TAG_RE = /\bpattern\b/i;
```

Use these MTG oracle text conventions:
- Mana symbols: `\{[WUBRGC]\}`, `\{T\}` (tap), `\{\d+\}` (generic)
- Keywords: match with `\b` word boundaries
- Oracle text patterns: "destroy target", "exile target", "draw a card", "search your library", etc.
- Always use case-insensitive `/i` flag for oracle text matching

### 2. Add detection logic in `generateTags()`

Follow the existing pattern — check regex against `card.oracleText`, `card.keywords`, `card.typeLine`, or `card.subtypes`:

```ts
// Tag Name
if (NEW_TAG_RE.test(text)) {
  tags.add("Tag Name");
}
```

Consider exclusion rules (like Ramp excludes basic lands, Tutor excludes land-search-only).

### 3. Add tag color to `TAG_COLORS`

Follow the exact format — `bg-{color}-500/20` + `text-{color}-300`:

```ts
"Tag Name": { bg: "bg-{color}-500/20", text: "text-{color}-300" },
```

Available colors not yet used: lime, teal, rose, indigo, fuchsia, stone.

### 4. Write unit tests in `tests/unit/card-tags.spec.ts`

Add a new `test.describe` block following the existing pattern:

```ts
test.describe("generateTags — Tag Name", () => {
  test("Card Name (reason) → Tag Name", () => {
    const card = makeCard({
      name: "Card Name",
      oracleText: "relevant oracle text",
      typeLine: "Card Type",
    });
    expect(generateTags(card)).toContain("Tag Name");
  });

  test("unrelated card → no Tag Name", () => {
    const card = makeCard({ oracleText: "irrelevant text" });
    expect(generateTags(card)).not.toContain("Tag Name");
  });
});
```

Use real MTG card names and oracle text for authenticity. Test both positive matches and exclusions.

### 5. Verify

```bash
npx playwright test --config playwright.unit.config.ts tests/unit/card-tags.spec.ts
```
