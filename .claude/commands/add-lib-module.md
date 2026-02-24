# Add a new pure utility module to src/lib/

Create a new pure TypeScript module in `src/lib/` following the established codebase patterns. The module purpose: $ARGUMENTS

## Required patterns

### File structure
1. Place at `src/lib/<kebab-case-name>.ts`
2. **No React imports** — all `src/lib/` modules are pure TypeScript, no JSX
3. Import types with `import type { EnrichedCard } from "./types"` (relative, not `@/lib/`)
4. Use named exports only — no default exports

### Code conventions
- Define regex constants at module top as `const SCREAMING_SNAKE_CASE = /pattern/`
- Define lookup sets as `const SCREAMING_SNAKE_CASE = new Set([...])`
- Scoring/weight constants at top: `const BASE_SCORE = 50;`
- Unexported internal helpers come before the main exported function
- The primary exported function goes at the bottom with a JSDoc comment: `/** Main entry point */`

### Type conventions
- If new shared types are needed, append them to `src/lib/types.ts` in a labeled section:
  ```ts
  // Feature-name types
  export interface NewType { ... }
  ```
- Use `EnrichedCard` from `./types` as the standard card data shape
- Use `DeckData` from `./types` for deck-level data
- Use `DeckCard` (`{ name: string; quantity: number }`) for card references
- Use `ManaPips` (`{ W, U, B, R, G, C: number }`) for pip counts

### Tag color format (if adding new tags)
- Always use the pattern: `{ bg: "bg-{color}-500/20", text: "text-{color}-300" }`
- Add to `TAG_COLORS` in `src/lib/card-tags.ts`

## Corresponding unit test

After creating the module, create `tests/unit/<kebab-case-name>.spec.ts` following the TDD workflow:

```ts
import { test, expect } from "@playwright/test";
import { functionName } from "../../src/lib/<module-name>";
import type { EnrichedCard } from "../../src/lib/types";

function makeCard(overrides: Partial<EnrichedCard> = {}): EnrichedCard {
  return {
    name: "Test Card", manaCost: "", cmc: 0, colorIdentity: [], colors: [],
    typeLine: "Creature", supertypes: [], subtypes: [], oracleText: "",
    keywords: [], power: null, toughness: null, loyalty: null, rarity: "common",
    imageUris: null, manaPips: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    producedMana: [], flavorName: null,
    ...overrides,
  };
}

test.describe("functionName — Category", () => {
  test("description → expected result", () => {
    // ...
  });
});
```

Run with: `npx playwright test --config playwright.unit.config.ts tests/unit/<name>.spec.ts`
