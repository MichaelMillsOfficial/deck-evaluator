# Evaluate Detection Accuracy

Audit the accuracy of the card tagging and/or synergy axis detection systems against real MTG cards. Focus area: $ARGUMENTS

## Purpose

This skill bridges MTG domain knowledge with the codebase's regex-based detection systems. Use it to find false positives, false negatives, and edge cases in `src/lib/card-tags.ts` and `src/lib/synergy-axes.ts`.

## Process

### 1. Select Test Cards

Choose 10-20 real MTG cards that stress-test the detection area being audited. Include:

- **Clear positives**: Cards that obviously belong (e.g., Swords to Plowshares for Removal)
- **Clear negatives**: Cards that obviously don't belong
- **Edge cases**: Cards that are ambiguous or use unusual templating
- **False positive candidates**: Cards whose oracle text might accidentally match
- **Multi-tag cards**: Cards that should trigger multiple detections
- **DFCs / Adventures / MDFCs**: Cards with unusual oracle text structure

### 2. Fetch Real Oracle Text

For each test card, get the actual oracle text from Scryfall:

```bash
curl -s "https://api.scryfall.com/cards/named?exact=Card+Name" | jq '{name, oracle_text, keywords, type_line}'
```

### 3. Run Against Current Detection

For tags, mentally (or actually) execute `generateTags()` against each card's data:
- Read the regexes in `src/lib/card-tags.ts`
- Check which patterns would match the real oracle text
- Note any surprising matches or misses

For synergy axes, evaluate each axis's `detect()` function:
- Read the regexes in `src/lib/synergy-axes.ts`
- Calculate the expected relevance score (0-1) for each axis
- Note scores that seem too high or too low

### 4. Classify Results

For each card, report:

```
## Card: [Name]
Oracle: "..."
Keywords: [...]

### Tags
| Tag | Expected | Detected | Status |
|-----|----------|----------|--------|
| Ramp | Yes | Yes | OK |
| Removal | No | Yes | FALSE POSITIVE — regex matches "exile target" in unrelated context |
| Card Draw | Yes | No | FALSE NEGATIVE — uses "draw" with unusual templating |

### Synergy Axes
| Axis | Expected Relevance | Detected | Status |
|------|-------------------|----------|--------|
| Graveyard | 0.7 | 0.3 | UNDER-SCORED — flashback keyword detected but reanimate pattern missed |
```

### 5. Propose Fixes

For each issue found, propose a specific fix:

**For false negatives** (missed detection):
- Identify the oracle text pattern that should match
- Propose a new or modified regex
- Ensure the fix doesn't introduce false positives

**For false positives** (incorrect detection):
- Identify why the current regex matches
- Propose an exclusion rule or tighter regex
- Provide a counter-example to test

**For scoring issues** (wrong relevance):
- Identify which sub-pattern is over/under-weighted
- Propose adjusted score values

### 6. Write Regression Tests

For every issue found, write a unit test that captures it:

```ts
// False negative: [Card Name] should be tagged [Tag]
test("[Card Name] (reason) → [Tag]", () => {
  const card = makeCard({
    name: "Card Name",
    oracleText: "real oracle text from Scryfall",
    keywords: ["Real", "Keywords"],
    typeLine: "Real Type Line",
  });
  expect(generateTags(card)).toContain("Tag");
});

// False positive: [Card Name] should NOT be tagged [Tag]
test("[Card Name] (reason) → no [Tag]", () => {
  const card = makeCard({
    name: "Card Name",
    oracleText: "real oracle text that falsely matches",
  });
  expect(generateTags(card)).not.toContain("Tag");
});
```

### 7. Implement and Verify

1. Add the regression tests (they should fail first for false negatives / pass-incorrectly for false positives)
2. Update the regex patterns in `card-tags.ts` or `synergy-axes.ts`
3. Run the full test suite:

```bash
npx playwright test --config playwright.unit.config.ts tests/unit/card-tags.spec.ts
npx playwright test --config playwright.unit.config.ts tests/unit/synergy-axes.spec.ts
```

## Common Edge Cases to Check

### Oracle Text Patterns
- **Modal spells** ("Choose one —"): May have removal text in one mode but not be primarily removal
- **ETB vs cast triggers**: "When ~ enters" vs "When you cast ~"
- **Self-referential**: "Sacrifice ~" is NOT a sacrifice outlet (it's a cost)
- **Conditional effects**: "If you control a Dragon, destroy target creature" — still Removal
- **Negative text**: "can't be countered" contains "counter" — should NOT tag as Counterspell
- **DFC back faces**: Oracle text may contain both faces separated by `//`

### Keyword Subtleties
- **Keyword abilities vs keyword actions**: "Flying" (ability) vs "destroy" (action)
- **Ability words**: Landfall, Constellation — NOT keywords in Scryfall data, they're ability words
- **Keyword counters**: "Flying counter" is different from having Flying

### Type Line Patterns
- **Artifact Creature**: Is both an artifact AND a creature — should score on both axes
- **Enchantment Creature**: Similarly dual-typed
- **Kindred (Tribal)**: "Kindred Instant" has tribal implications
- **Legendary**: Relevant for commander eligibility, not for synergy detection

## Useful Scryfall Searches for Bulk Testing

```bash
# Cards with unusual "destroy" patterns (false positive risk for Removal)
curl -s "https://api.scryfall.com/cards/search?q=o%3A%22destroy+target%22+-t%3Ainstant+-t%3Asorcery&order=edhrec" | jq '.data[:5] | .[].name'

# Cards with "counter" that aren't counterspells
curl -s "https://api.scryfall.com/cards/search?q=o%3Acounter+-o%3A%22counter+target%22&order=edhrec" | jq '.data[:5] | .[].name'

# Cards with "search your library" that aren't tutors
curl -s "https://api.scryfall.com/cards/search?q=o%3A%22search+your+library%22+o%3Aland&order=edhrec" | jq '.data[:5] | .[].name'
```
