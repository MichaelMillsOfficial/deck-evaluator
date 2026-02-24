# Add a new synergy axis

Add a new synergy detection axis to the deck synergy engine. The axis: $ARGUMENTS

## Background

The synergy system lives in:
- `src/lib/synergy-axes.ts` — individual axis detector functions
- `src/lib/synergy-engine.ts` — scoring engine that uses axis detectors
- `src/lib/known-combos.ts` — hardcoded combo registry
- `src/lib/types.ts` — synergy type definitions

Each axis has a `detect(card: EnrichedCard) -> relevance (0-1)` function that checks oracle text, keywords, subtypes, and type lines.

## Steps

### 1. Write failing tests first

Add to `tests/unit/synergy-axes.spec.ts`:

```ts
test.describe("newAxisDetector", () => {
  test("Card Name (reason) → high relevance", () => {
    const card = makeCard({
      name: "Card Name",
      oracleText: "relevant oracle text",
      keywords: ["Keyword"],
    });
    expect(newAxisDetector(card)).toBeGreaterThan(0.5);
  });

  test("irrelevant card → 0", () => {
    const card = makeCard({ oracleText: "unrelated text" });
    expect(newAxisDetector(card)).toBe(0);
  });
});
```

Use real MTG cards. Test 0 for irrelevant, 0.3-0.5 for tangential, 0.7-1.0 for core strategy cards.

### 2. Implement the detector in `src/lib/synergy-axes.ts`

Follow the existing detector pattern:
- Named regex constants at module top: `const AXIS_PATTERN_RE = /pattern/i;`
- Export the detector function returning 0-1 relevance score
- Higher relevance for cards that are central to the strategy

### 3. Register in the axis map

Add to the `SYNERGY_AXES` map/array in `synergy-axes.ts` so the engine picks it up automatically.

### 4. Define conflicts (if any)

If this axis has anti-synergy with another axis (like `graveyard` vs `graveyardHate`), register the conflict in `synergy-engine.ts`.

### 5. Add known combos (if applicable)

If there are well-known 2-card combos for this strategy, add them to `src/lib/known-combos.ts`.

### 6. Verify

```bash
npx playwright test --config playwright.unit.config.ts tests/unit/synergy-axes.spec.ts
npx playwright test --config playwright.unit.config.ts tests/unit/synergy-engine.spec.ts
```
