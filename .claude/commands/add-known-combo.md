# Add a known combo

Add a new combo to the known combo registry. The combo: $ARGUMENTS

## Steps

### 1. Verify card names via Scryfall

Before adding any combo, verify that all card names are exact Scryfall matches. The `findCombosInDeck()` function uses exact string matching against a `Set`, so names must be precise:

```bash
# Verify each card name
curl -s "https://api.scryfall.com/cards/named?exact=Card+Name" | jq '.name'
```

Common pitfalls:
- Apostrophes: `Thassa's Oracle` (not `Thassas Oracle`)
- Accented characters: `Bolas's Citadel` (double possessive)
- Full names: `Mikaeus, the Unhallowed` (include the comma and epithet)

### 2. Determine combo type

Choose from the four established types:

| Type | Definition | Example |
|------|-----------|---------|
| `"infinite"` | Creates an unbounded loop (mana, damage, tokens, etc.) | Dramatic Reversal + Isochron Scepter |
| `"wincon"` | Directly wins the game or effectively ends it | Thassa's Oracle + Demonic Consultation |
| `"lock"` | Prevents opponents from playing the game | Knowledge Pool + Drannith Magistrate |
| `"value"` | Generates significant recurring value but is bounded | Sensei's Divining Top + Bolas's Citadel |

### 3. Write a clear description

The description should explain the combo loop in one sentence:
- Start with the mechanic: "Infinite mana:", "Lock:", "Win:"
- Explain the loop clearly: which card does what, and how they feed back
- Example: `"Infinite mana: blink Drake to untap 5 lands, soulbond re-establishes"`

### 4. Add to `src/lib/known-combos.ts`

Place the combo in the appropriate section (Win Conditions, Infinite Combos, Locks, Value Engines) matching the existing organization:

```ts
{
  cards: ["Card Name A", "Card Name B"],
  description: "Type: explanation of the combo loop",
  type: "infinite",
},
```

For 3-card combos, include all three:
```ts
{
  cards: ["Card A", "Card B", "Card C"],
  description: "Win: explanation requiring all three pieces",
  type: "wincon",
},
```

### 5. Write unit tests in `tests/unit/known-combos.spec.ts`

Add tests within the existing file structure:

```ts
test("detects New Combo", () => {
  const cards = ["Card Name A", "Card Name B", "Other Card"];
  const combos = findCombosInDeck(cards);
  expect(combos).toContainEqual(
    expect.objectContaining({
      cards: expect.arrayContaining(["Card Name A", "Card Name B"]),
      type: "infinite",
    })
  );
});

test("does not detect partial New Combo", () => {
  const cards = ["Card Name A", "Unrelated Card"];
  const combos = findCombosInDeck(cards);
  const match = combos.find((c) =>
    c.cards.includes("Card Name A") && c.cards.includes("Card Name B")
  );
  expect(match).toBeUndefined();
});
```

### 6. Verify

```bash
npx playwright test --config playwright.unit.config.ts tests/unit/known-combos.spec.ts
```

## Combo Sourcing Guidelines

When identifying combos to add:
- **cEDH staples**: Thoracle combos, Ad Nauseam lines, Underworld Breach piles
- **Popular casual combos**: Exquisite Blood + Sanguine Bond, Peregrine Drake blinks
- **Format-specific locks**: Stax pieces that combine to create hard locks
- **2-card combos preferred**: These are most common and most impactful to detect
- **3-card combos**: Include only if they're well-known and have a single clear line
- Cards must be Commander-legal (check `f:commander` on Scryfall)
