# Deck Composition Scorecard

## Context

Commander decks rely on a balanced mix of functional categories to perform consistently -- enough ramp to deploy threats on time, enough removal to handle opponents' boards, enough card draw to avoid running out of gas. Community frameworks like the 8x8 Theory and the Command Zone Template provide recommended slot counts for each category, but no existing tool automatically validates a deck against these targets. Players must manually count cards in each category, a tedious and error-prone process across a 100-card singleton deck.

This feature adds a **Deck Composition Scorecard** section to the Analysis tab that leverages the existing `generateTags()` heuristic engine to count cards per functional category, compares those counts against configurable community-sourced target ranges, and surfaces green/yellow/red status indicators for each category. Each category row is expandable to show the specific cards assigned to it. An overall "deck health" summary aggregates the per-category statuses.

### Intended Outcome

After importing and enriching a deck, players switch to the Analysis tab and immediately see which functional categories are underserved, on-target, or overstocked -- with specific card lists for transparency. This is the app's primary competitive differentiator: no other MTG tool performs this validation automatically.

## Why

1. **Unique differentiator** -- EDHREC, Moxfield, and Archidekt all require manual tagging or provide no composition validation at all. Automated heuristic tagging plus template comparison is novel.
2. **High user value** -- The most common deckbuilding question is "do I have enough ramp / removal / draw?" This answers it instantly.
3. **Low implementation cost** -- Builds entirely on existing `card-tags.ts` infrastructure and `EnrichedCard` data. No new APIs, no new dependencies.

## Dependencies

**Existing code this builds on:**

| Dependency | Module | What It Provides |
|-----------|--------|------------------|
| Card tags | `src/lib/card-tags.ts` | `generateTags(card): string[]` — Ramp, Card Draw, Card Advantage, Removal, Board Wipe, Counterspell, Tutor, Cost Reduction, Protection, Recursion |
| Types | `src/lib/types.ts` | `DeckData`, `DeckCard`, `EnrichedCard` |
| DeckAnalysis | `src/components/DeckAnalysis.tsx` | Analysis tab container where this section will be added |
| LandBaseEfficiency | `src/components/LandBaseEfficiency.tsx` | UI pattern reference for score display, progress bars, color-coded badges |

**No dependencies on unbuilt features.** This can be built in parallel with any other planned feature.

## Existing Patterns to Reuse

| Pattern | Source File | How It Applies |
|---------|-------------|----------------|
| Pure computation function signature | `src/lib/land-base-efficiency.ts` | `(deck: DeckData, cardMap: Record<string, EnrichedCard>) => Result` |
| `makeCard()` / `makeDeck()` test helpers | `tests/unit/mana-curve.spec.ts` | Reuse in unit tests for composition scoring |
| Section heading + subtitle + content | `src/components/DeckAnalysis.tsx` | `<section aria-labelledby>` with uppercase tracking-wide h3 |
| Score color functions | `src/components/LandBaseEfficiency.tsx` | `getScoreColor()`, `getBadgeClasses()`, `getBarColor()` |
| Progress bars with `role="progressbar"` | `src/components/LandBaseEfficiency.tsx` | ARIA-compliant progress indicators |
| Expandable disclosure pattern | `src/components/EnrichedCardRow.tsx` | `aria-expanded`, `aria-controls`, Escape key |
| `data-testid` attributes | `src/components/LandBaseEfficiency.tsx` | `data-testid="efficiency-factor"` etc. |
| Mock enrichment responses in e2e | `e2e/deck-analysis.spec.ts` | `MOCK_ANALYSIS_RESPONSE` pattern with full `EnrichedCard` objects |
| Unit test structure | `tests/unit/card-tags.spec.ts` | Import from `@playwright/test`, `makeCard()` helper, `test.describe` blocks |

---

## Implementation Tasks

### Phase 1: Core Logic (`src/lib/deck-composition.ts`)

- [ ] **1.1** Create `src/lib/deck-composition.ts` with type definitions:

  ```typescript
  export interface CompositionTemplate {
    id: string;
    name: string;
    description: string;
    categories: CategoryTarget[];
  }

  export interface CategoryTarget {
    tag: string;          // matches a tag from generateTags() or "Lands"
    label: string;        // display name (may differ from tag)
    min: number;          // recommended minimum
    max: number;          // recommended maximum
    description: string;  // explanation of the category's role
  }

  export type CategoryStatus = "good" | "low" | "high" | "critical";

  export interface CategoryResult {
    tag: string;
    label: string;
    count: number;
    min: number;
    max: number;
    status: CategoryStatus;
    statusMessage: string;  // e.g., "Need 3+ more" or "On target"
    cards: { name: string; quantity: number }[];
  }

  export type OverallHealth = "healthy" | "needs-attention" | "major-gaps";

  export interface CompositionScorecardResult {
    templateId: string;
    templateName: string;
    categories: CategoryResult[];
    overallHealth: OverallHealth;
    healthSummary: string;
    untaggedCount: number;
    untaggedCards: { name: string; quantity: number }[];
  }
  ```

- [ ] **1.2** Define the 8x8 Theory template constant:

  ```typescript
  export const TEMPLATE_8X8: CompositionTemplate = {
    id: "8x8",
    name: "8×8 Theory",
    description: "8 categories × 8 cards = 64 non-land spells + 36 lands",
    categories: [
      { tag: "Lands", label: "Lands", min: 35, max: 38, description: "Mana-producing lands" },
      { tag: "Ramp", label: "Ramp", min: 7, max: 9, description: "Mana acceleration and land search" },
      { tag: "Card Draw", label: "Card Draw", min: 7, max: 9, description: "Draw effects and card advantage" },
      { tag: "Removal", label: "Removal", min: 7, max: 9, description: "Single-target and mass removal" },
      { tag: "Board Wipe", label: "Board Wipes", min: 2, max: 4, description: "Mass removal effects" },
      { tag: "Counterspell", label: "Counterspells", min: 2, max: 4, description: "Spell interaction" },
      { tag: "Tutor", label: "Tutors", min: 2, max: 4, description: "Library search effects" },
      { tag: "Protection", label: "Protection", min: 3, max: 5, description: "Hexproof, indestructible, and similar" },
      { tag: "Recursion", label: "Recursion", min: 2, max: 4, description: "Graveyard recovery effects" },
    ],
  };
  ```

- [ ] **1.3** Define the Command Zone Template constant:

  ```typescript
  export const TEMPLATE_COMMAND_ZONE: CompositionTemplate = {
    id: "command-zone",
    name: "Command Zone Template",
    description: "Josh Lee Kwai & Jimmy Wong's recommended starting framework",
    categories: [
      { tag: "Lands", label: "Lands", min: 36, max: 38, description: "Start at 37, adjust for curve and ramp" },
      { tag: "Ramp", label: "Ramp", min: 10, max: 12, description: "Mix of mana rocks and land-based ramp" },
      { tag: "Card Draw", label: "Card Draw", min: 10, max: 12, description: "Both burst and incremental draw" },
      { tag: "Removal", label: "Removal", min: 5, max: 8, description: "Instant-speed preferred" },
      { tag: "Board Wipe", label: "Board Wipes", min: 3, max: 4, description: "At least 2 creature wipes" },
      { tag: "Counterspell", label: "Counterspells", min: 2, max: 4, description: "Spell denial" },
      { tag: "Protection", label: "Protection", min: 3, max: 5, description: "Keep key pieces alive" },
      { tag: "Recursion", label: "Recursion", min: 2, max: 4, description: "Graveyard recovery" },
    ],
  };
  ```

- [ ] **1.4** Implement `computeCompositionScorecard()`:

  ```typescript
  export function computeCompositionScorecard(
    deck: DeckData,
    cardMap: Record<string, EnrichedCard>,
    template: CompositionTemplate
  ): CompositionScorecardResult
  ```

  Logic:
  1. Iterate all cards `[...deck.commanders, ...deck.mainboard, ...deck.sideboard]`
  2. For each card, look up `cardMap[card.name]`. If not found, skip.
  3. If `enriched.typeLine` includes "Land", count toward the "Lands" category. Otherwise, call `generateTags(enriched)` and map each tag to the appropriate category.
  4. A card can appear in multiple categories if it has multiple tags (e.g., Board Wipe + Removal).
  5. Track untagged non-land cards (cards where `generateTags()` returns empty array).
  6. For each `CategoryTarget`, produce a `CategoryResult` with status logic:
     - `count >= min && count <= max` → "good"
     - `count < min && count >= min - 2` → "low"
     - `count < min - 2` → "critical"
     - `count > max` → "high"
  7. Generate `statusMessage`: "On target", "Need N+ more", "Over by N", "Critically low — need N+ more"
  8. Compute `overallHealth`:
     - All "good" or "high" → "healthy"
     - Any "low" but no "critical" → "needs-attention"
     - Any "critical" → "major-gaps"
  9. Generate `healthSummary` string.

- [ ] **1.5** Implement `countCategoryCards()` helper — iterates deck cards, runs `generateTags()`, returns `Map<string, { name: string; quantity: number }[]>` mapping each tag to its contributing cards. Also returns land count and land card list. Treat "Card Advantage" tagged cards as also contributing to the "Card Draw" category.

- [ ] **1.6** Export `AVAILABLE_TEMPLATES` array containing both templates:

  ```typescript
  export const AVAILABLE_TEMPLATES: CompositionTemplate[] = [
    TEMPLATE_COMMAND_ZONE,  // default
    TEMPLATE_8X8,
  ];
  ```

### Phase 2: Unit Tests (`tests/unit/deck-composition.spec.ts`)

- [ ] **2.1** Create `tests/unit/deck-composition.spec.ts` with `makeCard()` and `makeDeck()` helpers
- [ ] **2.2** Test empty deck: all counts 0, all critical, major-gaps health
- [ ] **2.3** Test land counting: basic lands, non-basic lands, artifact lands counted; non-lands excluded
- [ ] **2.4** Test tag-based counting: single-tag cards, multi-tag cards (Board Wipe also counts as Removal), all 10 tags
- [ ] **2.5** Test status thresholds: count at min → good, at max → good, between → good, 1 below min → low, 3+ below → critical, above max → high
- [ ] **2.6** Test statusMessage strings: "On target", "Need N+ more", "Critically low — need N+ more", "Over by N"
- [ ] **2.7** Test overall health: all good → healthy, mixed with low → needs-attention, any critical → major-gaps
- [ ] **2.8** Test untagged cards: vanilla creatures counted, lands excluded from untagged
- [ ] **2.9** Test quantity multiplication: `quantity: 4` counts as 4
- [ ] **2.10** Test cards not in cardMap: skipped gracefully, no crash
- [ ] **2.11** Test template switching: same deck, different templates, different statuses
- [ ] **2.12** Test `cards` field: correct card names and quantities per category
- [ ] **2.13** Test Card Advantage merging: cards with "Card Advantage" tag counted toward "Card Draw" category

### Phase 3: UI Component (`src/components/DeckCompositionScorecard.tsx`)

- [ ] **3.1** Create `"use client"` component with props `{ deck: DeckData; cardMap: Record<string, EnrichedCard> }`
- [ ] **3.2** Template selector: dropdown/segmented button, Command Zone default, styled `bg-slate-800/50 border-slate-700`
- [ ] **3.3** Overall health summary banner: green/yellow/red based on health status, `data-testid="composition-health-summary"`
- [ ] **3.4** Category rows: label, count, target range, status indicator (checkmark/warning/alert), progress bar, `data-testid="composition-category"`
- [ ] **3.5** Expandable card list per category: disclosure pattern with `aria-expanded`, `aria-controls`, Escape key, `data-testid="category-cards"`
- [ ] **3.6** Untagged cards section: info row with expandable card names, `data-testid="composition-untagged"`
- [ ] **3.7** Accessibility: `<section aria-labelledby>`, focus indicators, `role="progressbar"` with aria attributes
- [ ] **3.8** Reduced motion: `motion-reduce:transition-none` on disclosure transitions

### Phase 4: Integration into DeckAnalysis

- [ ] **4.1** Import `DeckCompositionScorecard` in `src/components/DeckAnalysis.tsx`
- [ ] **4.2** Render after CommanderSection, before Mana Curve:
  ```
  1. CommanderSection
  2. DeckCompositionScorecard (NEW)
  3. Mana Curve
  4. Color Distribution
  5. LandBaseEfficiency
  ```

### Phase 5: E2E Tests

- [ ] **5.1** Create mock enrichment data covering all tag categories plus an untagged vanilla creature
- [ ] **5.2** Test: "Composition Scorecard heading visible on Analysis tab"
- [ ] **5.3** Test: "displays health summary banner"
- [ ] **5.4** Test: "displays category rows with counts and status"
- [ ] **5.5** Test: "expanding a category shows card list"
- [ ] **5.6** Test: "template selector switches between templates"
- [ ] **5.7** Test: "untagged cards section shows when applicable"
- [ ] **5.8** Test: "section has proper ARIA structure"

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/deck-composition.ts` | Create | Templates, types, `computeCompositionScorecard()` |
| `src/components/DeckCompositionScorecard.tsx` | Create | UI: template selector, health banner, category rows with expand |
| `src/components/DeckAnalysis.tsx` | Modify | Import and render after CommanderSection |
| `tests/unit/deck-composition.spec.ts` | Create | Unit tests for composition scoring logic |
| `e2e/deck-analysis.spec.ts` | Modify | E2E tests for scorecard UI |

No changes to: `package.json`, `src/lib/types.ts`, `src/lib/card-tags.ts`, API routes, `DeckViewTabs.tsx`, `next.config.ts`.

---

## Edge Cases

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Deck with 0 cards in cardMap (enrichment failed) | All categories at 0, all "critical", health is "major-gaps" |
| Cards not found in cardMap | Silently skipped; no crash |
| Card with multiple tags (e.g., Board Wipe + Removal) | Appears in BOTH categories; counts are NOT mutually exclusive |
| Deck with no lands | Lands category shows 0, status "critical" |
| Deck with all lands (no spells) | All non-land categories at 0; Lands category likely "high" |
| Deck with 200+ cards (non-Commander) | Template ranges still apply; may show "high" for many categories |
| Very small deck (e.g., 5 cards) | Most categories will be "critical" |
| "Card Draw" vs "Card Advantage" tags | "Card Advantage" tagged cards also contribute to "Card Draw" category count |
| Quantity > 1 for same card | `card.quantity` multiplied into count |
| Commander cards | Included in tag counting — commanders contribute to functional categories |

## E2E User Scenarios

1. **Basic flow**: User pastes decklist → Import → enrichment → Analysis tab → Composition Scorecard shows category rows with green/yellow/red indicators
2. **Template switching**: User views under Command Zone → Ramp shows "low" at 5/10-12 → switches to 8x8 → Ramp shows "good" at 5/7-9
3. **Category drill-down**: User sees "Removal" marked "critical" at 2 → clicks to expand → sees specific card names → understands they need more interaction
4. **Untagged awareness**: User sees "15 cards with no functional tag" → expands → understands these are synergy/theme pieces
5. **Perfect deck**: All categories green → health summary says "All categories on target"

## Verification

1. `npx playwright test --config playwright.unit.config.ts tests/unit/deck-composition.spec.ts` — all unit tests pass
2. `npx playwright test e2e/deck-analysis.spec.ts` — all E2E tests pass
3. `npm test` — full suite green
4. `npm run build` — no TypeScript errors
5. Manual: import example deck → Analysis tab → Scorecard visible → categories correct → template switching works → expand/collapse works → keyboard navigation works
