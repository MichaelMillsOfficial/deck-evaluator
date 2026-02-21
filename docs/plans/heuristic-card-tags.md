# Heuristic Card Tags — Implementation Plan

## Context

The deck evaluator enrichment pipeline fetches card metadata from Scryfall and displays it in an enriched table (mana cost, type line, expandable oracle text). However, players evaluating decks need to quickly assess **functional composition** — how many ramp cards, how much removal, enough card draw, etc. Currently they must read each card's oracle text individually.

This plan adds a `generateTags()` function that analyzes an `EnrichedCard`'s oracle text, keywords, and type line to produce heuristic functional role tags (Ramp, Removal, Card Draw, etc.), rendered as colored pill badges below each card name in the enriched table view.

**Scope decision:** Only functional tags are included (Ramp, Removal, Card Draw, etc.). Type-based tags (Creature, Artifact, Land) are excluded since the Type column already displays that information.

---

## Design Decisions

### Tags are computed at render time, not stored on `EnrichedCard`

**Reasoning:** Tags are deterministic given card data and cheap to compute (~10 regex checks per card). Computing at render time avoids changing the `EnrichedCard` type, keeps the API response shape stable, and lets tag rules evolve client-side without API changes. The function is a pure utility in `src/lib/`, testable in isolation.

### Each functional tag gets a distinct color

**Reasoning:** Different colors for different roles makes scanning a 100-card decklist significantly faster than monochrome tags. Colors use muted `bg-{color}-500/20` with `text-{color}-300` to fit the dark slate design system without being visually overwhelming.

| Tag | Background | Text |
|-----|-----------|------|
| Ramp | `bg-emerald-500/20` | `text-emerald-300` |
| Card Draw | `bg-blue-500/20` | `text-blue-300` |
| Removal | `bg-red-500/20` | `text-red-300` |
| Board Wipe | `bg-orange-500/20` | `text-orange-300` |
| Counterspell | `bg-cyan-500/20` | `text-cyan-300` |
| Tutor | `bg-yellow-500/20` | `text-yellow-300` |
| Protection | `bg-violet-500/20` | `text-violet-300` |
| Recursion | `bg-pink-500/20` | `text-pink-300` |

### Tags are display-only (not filterable)

**Reasoning:** Click-to-filter would require lifting state to `DeckList`, adding filter UI, and doubling scope. It's a natural follow-up but out of scope for this plan.

### Ramp vs Tutor disambiguation

**Reasoning:** Cards like Cultivate ("Search your library for up to two basic land cards") are Ramp, not Tutors. If `oracleText` matches "search your library" but is restricted to lands/basic lands, classify as Ramp only. Generic library searches ("Search your library for a card") get the Tutor tag. Cards that search for non-land cards get Tutor.

---

## Implementation Tasks

### Phase 1: Tag Generator (TDD)

- [ ] **1.1 Write tests for `generateTags()` in `e2e/card-tags.spec.ts`**

  Follow the pattern of `e2e/mana-parsers.spec.ts` — import from `@playwright/test`, import the function directly, no browser needed.

  Create a `makeCard(overrides: Partial<EnrichedCard>): EnrichedCard` helper with sensible defaults so each test only overrides relevant fields.

  **Test cases to cover:**

  *Ramp detection:*
  - Sol Ring (`oracleText: "{T}: Add {C}{C}."`) → `["Ramp"]`
  - Cultivate (`oracleText: "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle."`) → `["Ramp"]` (NOT Tutor)
  - Llanowar Elves (`oracleText: "{T}: Add {G}."`, `typeLine: "Creature — Elf Druid"`) → `["Ramp"]`
  - A vanilla creature with no mana ability → no Ramp tag

  *Card Draw detection:*
  - `oracleText: "Draw three cards."` → includes `"Card Draw"`
  - `oracleText: "Whenever a creature enters, draw a card."` → includes `"Card Draw"`
  - Card with `oracleText` containing "draw" in unrelated context (e.g. "withdraw") → no false positive

  *Removal detection:*
  - `oracleText: "Destroy target creature."` → `["Removal"]`
  - `oracleText: "Exile target nonland permanent."` → `["Removal"]`
  - `oracleText: "Return target creature to its owner's hand."` → `["Removal"]`

  *Board Wipe detection:*
  - `oracleText: "Destroy all creatures."` → `["Board Wipe", "Removal"]`
  - `oracleText: "Exile all nonland permanents."` → `["Board Wipe", "Removal"]`
  - Single-target removal → no Board Wipe

  *Counterspell detection:*
  - `oracleText: "Counter target spell."` → `["Counterspell"]`

  *Tutor detection:*
  - `oracleText: "Search your library for a card, put it into your hand, then shuffle."` → `["Tutor"]`
  - Cultivate (searches for basic lands) → NOT Tutor (already Ramp)

  *Protection detection:*
  - `keywords: ["Hexproof"]` → includes `"Protection"`
  - `oracleText: "Target creature gains indestructible until end of turn."` → `"Protection"`

  *Recursion detection:*
  - `oracleText: "Return target creature card from your graveyard to the battlefield."` → `["Recursion"]`
  - `oracleText: "Return target creature card from your graveyard to your hand."` → `["Recursion"]`

  *Multi-tag:*
  - Sol Ring → `["Ramp"]` (functional only, no type tags)
  - Board wipe sorcery → `["Board Wipe", "Removal"]`

  *Edge cases:*
  - Card with empty `oracleText` and no keywords → `[]`
  - Basic land with no relevant oracle text → `[]`

- [ ] **1.2 Implement `generateTags()` in `src/lib/card-tags.ts`**

  Pure function, no React imports. Follow `src/lib/mana.ts` pattern.

  ```typescript
  import type { EnrichedCard } from "./types";

  export function generateTags(card: EnrichedCard): string[]
  ```

  **Detection heuristics (oracle text regex + keyword checks):**

  1. **Ramp** — oracle text matches mana production patterns:
     - `/\{T\}.*?[Aa]dd\s+\{[WUBRGC]\}/` (tap to add mana)
     - `/[Aa]dd\s+\{[WUBRGC]\}.*?\{[WUBRGC]\}/` (add multiple mana)
     - `/[Ss]earch your library for.+(?:basic )?land/` (land search = ramp)
     - Exclude basic lands (cards where `typeLine` is exactly "Basic Land — X")

  2. **Card Draw** — `/\bdraw\b.+?\bcards?\b/i` or `/\bdraw a card\b/i`
     - Use word boundary `\b` to avoid false positives on "withdraw", "drawn", etc.

  3. **Removal** — `/\b(destroy|exile)\s+target\b/i` or `/\breturn target.+?to its owner's hand\b/i` or `/\bdeals?\s+\d+\s+damage to\b.+?\btarget\b/i`

  4. **Board Wipe** — `/\b(destroy|exile)\s+all\b/i` or `/\ball creatures get -\d+\/-\d+/i`
     - Cards matching Board Wipe also get Removal tag

  5. **Counterspell** — `/\bcounter target\b.+?\bspell\b/i`

  6. **Tutor** — `/\bsearch your library\b/i` but NOT if the search is restricted to lands (already classified as Ramp). Heuristic: exclude if oracle text also matches `/land card/i` near the search phrase.

  7. **Protection** — check `keywords` for `["Hexproof", "Indestructible", "Shroud", "Ward"]`, or oracle text matches `/\bgains?\b.+?\b(hexproof|indestructible|protection|shroud)\b/i`

  8. **Recursion** — `/\breturn\b.+?\bfrom\b.+?\bgraveyard\b/i`

  Return deduplicated, sorted array. Export `TAG_COLORS` mapping each tag to `{ bg, text }` Tailwind classes.

- [ ] **1.3 Run tag generator tests and iterate until green**
  `npx playwright test e2e/card-tags.spec.ts` — adjust regex patterns as needed.

### Phase 2: UI Integration (TDD)

- [ ] **2.1 Write E2E tests for tag rendering in `e2e/deck-enrichment.spec.ts`**

  Add a `test.describe("Card Tags")` block. Update mock data to include cards with varied tag profiles:
  - Sol Ring (Ramp)
  - Swords to Plowshares (`oracleText: "Exile target creature. Its controller gains life equal to its power."` → Removal)
  - Counterspell (`oracleText: "Counter target spell."` → Counterspell)

  Tests:
  - Sol Ring displays a "Ramp" tag badge within the enriched table
  - Tag badges have `data-testid="card-tag"` for test targeting
  - Tags are visible without expanding the card detail row
  - Cards with no functional tags show no tag badges

- [ ] **2.2 Create `CardTags` component in `src/components/CardTags.tsx`**

  Small presentational component:
  - Receives `EnrichedCard`, calls `generateTags()`, renders pill badges
  - Container has `aria-label="Tags: Ramp, Removal"` for screen readers
  - Each pill: `rounded-full px-2 py-0.5 text-xs font-medium` with colors from `TAG_COLORS`
  - Returns `null` if no tags

- [ ] **2.3 Integrate `CardTags` into `EnrichedCardRow.tsx`**

  Render `<CardTags card={card} />` below the card name button in the Name column. Use a flex-column layout:
  ```
  <td>
    <div className="flex flex-col gap-1">
      <button ...>{card.name}</button>
      <CardTags card={card} />
    </div>
  </td>
  ```

  **File to modify:** `src/components/EnrichedCardRow.tsx`

- [ ] **2.4 Run full test suite and verify build**
  `npm test` — all 66+ tests pass. `npm run build` succeeds.

### Phase 3: Verification

- [ ] **3.1 Manual verification with real Scryfall data**
  - Import example Atraxa decklist → verify tags render correctly:
    - Sol Ring → "Ramp"
    - Swords to Plowshares → "Removal"
    - Counterspell → "Counterspell"
    - Cultivate → "Ramp" (not Tutor)
    - Command Tower → no tags (basic mana land, not ramp acceleration)
  - Verify tag colors are visible on dark background
  - Verify keyboard navigation still works (tags don't steal focus)
  - Verify tags don't break table layout on mobile viewports

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/card-tags.ts` | Create | `generateTags()` pure function + `TAG_COLORS` constant |
| `src/components/CardTags.tsx` | Create | Pill badge renderer component |
| `src/components/EnrichedCardRow.tsx` | Modify | Integrate `CardTags` below card name |
| `e2e/card-tags.spec.ts` | Create | Unit tests for `generateTags()` |
| `e2e/deck-enrichment.spec.ts` | Modify | E2E tests for tag badge rendering |

## Key Files to Reference (read-only)

| File | Why |
|------|-----|
| `src/lib/types.ts` | `EnrichedCard` interface — input shape for `generateTags()` |
| `src/lib/mana.ts` | Pattern for pure utility functions |
| `e2e/mana-parsers.spec.ts` | Pattern for unit-style Playwright tests |
| `e2e/deck-enrichment.spec.ts` | Pattern for mocking `/api/deck-enrich` in E2E tests |

## Verification

1. `npx playwright test e2e/card-tags.spec.ts` — tag generator unit tests pass
2. `npm test` — full suite green (including new tag E2E tests)
3. `npm run build` — production build succeeds
4. Manual: Import Atraxa example → Sol Ring shows "Ramp", Swords shows "Removal", Counterspell shows "Counterspell"
5. Manual: Tags render as colored pills below card names, no layout breakage
6. Manual: Keyboard-only navigation unaffected by tags
