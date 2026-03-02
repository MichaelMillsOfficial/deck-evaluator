# Multi-Face Card Support

## Context

The deck evaluator currently stores and displays only the front face of double-faced and multi-faced MTG cards. When Scryfall returns `card_faces` data for cards like modal DFCs (Esika, God of the Tree // The Prismatic Bridge), transform cards (Delver of Secrets // Insectile Aberration), or adventure/omen cards (Bonecrusher Giant // Stomp), we discard everything except `card_faces[0]` during normalization. This means users cannot see back-face details, and analysis modules (tags, synergy axes, creature types) miss abilities that only appear on back faces.

The intended outcome is full multi-face awareness: the `EnrichedCard` type stores per-face data and layout information, analysis modules operate on combined oracle text from all faces, and the UI renders both faces — using **tabs for dual-image layouts** (transform, modal_dfc, battle) and **inline display for shared-image layouts** (adventure, omen, split, flip).

### Scope

**In scope:**
- Add `layout` and `cardFaces` fields to `EnrichedCard`
- Expand `ScryfallCardFace` to include all per-face fields (name, type_line, power, toughness, loyalty)
- Normalize combined oracle text for analysis (concatenated from all faces)
- Update `EnrichedCardRow` to render both faces (tabs vs inline based on layout)
- Update tag generation and synergy detection to use combined oracle text
- Add MDFC land count annotation to mana curve display

**Out of scope:**
- Meld card relationship tracking (treat each piece as independent card)
- Per-face tag attribution (tags are aggregated, not labeled per face)
- Reversible card layout (extremely rare, no special handling)

### Design Decisions

#### DD1: Combined oracle text for analysis

Top-level `oracleText` on `EnrichedCard` becomes the concatenated text of **all faces**, separated by `\n\n`. This means existing regex patterns in `card-tags.ts`, `synergy-axes.ts`, `creature-types.ts`, `supertypes.ts`, `land-base-efficiency.ts`, and `opening-hand.ts` automatically match against either face's text with zero refactoring. Per-face text is available via `cardFaces[n].oracleText` for display.

#### DD2: Layout-aware UI rendering

| Layout | Image behavior | UI treatment |
|--------|---------------|--------------|
| `transform` | Separate image per face | Tabs: "Front" / "Back" |
| `modal_dfc` | Separate image per face | Tabs: "Front" / "Back" |
| `battle` | Separate image per face | Tabs: "Front" / "Back" |
| `adventure` | Single shared image | Inline: creature details + adventure inset |
| `split` | Single shared image | Inline: both halves shown together |
| `flip` | Single shared image | Inline: both halves shown together |

Tab labels use face names (e.g., "Esika" / "The Prismatic Bridge") rather than generic "Front" / "Back".

#### DD3: Mana curve MDFC annotation

Modal DFCs with a land back face are counted in the mana curve at their front-face CMC (using Scryfall's top-level `cmc`). A separate annotation displays how many cards in the curve are MDFC lands, so users understand the true land count. No special CMC bucketing logic is needed.

#### DD4: Tailwind classes for face tabs

| Element | Classes |
|---------|---------|
| Tab container | `flex gap-1 mb-2` |
| Inactive tab | `px-2 py-0.5 text-xs rounded text-slate-400 bg-slate-700/50 hover:bg-slate-700 hover:text-slate-300` |
| Active tab | `px-2 py-0.5 text-xs rounded text-purple-300 bg-purple-500/20` |
| Inline face separator | `border-t border-slate-700/50 mt-2 pt-2` |
| Inline face label | `text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1` |

---

## Implementation Tasks

### Phase 1: Data Layer — Types & Normalization

- [x] 1.1 Add `CardFace` interface and update `EnrichedCard` in `src/lib/types.ts`
  ```typescript
  export interface CardFace {
    name: string;
    manaCost: string;
    typeLine: string;
    oracleText: string;
    power: string | null;
    toughness: string | null;
    loyalty: string | null;
    imageUris: { small: string; normal: string; large: string } | null;
  }
  ```
  Add to `EnrichedCard`:
  ```typescript
  layout: string;        // Scryfall layout value (e.g., "normal", "transform", "modal_dfc", "adventure", "split", "flip", "battle")
  cardFaces: CardFace[]; // Always populated; single-face cards get one entry
  ```

- [x] 1.2 Expand `ScryfallCardFace` in `src/lib/scryfall.ts`
  Add missing fields: `name`, `type_line`, `power`, `toughness`, `loyalty`

- [x] 1.3 Add `layout` to `ScryfallCard` interface in `src/lib/scryfall.ts`

- [x] 1.4 Update `normalizeToEnrichedCard()` in `src/lib/scryfall.ts`
  - Populate `layout` from `card.layout` (default `"normal"`)
  - Build `cardFaces` array from `card.card_faces` (or synthesize a single-entry array from top-level fields for normal-layout cards)
  - Set top-level `oracleText` to combined text from all faces (joined with `\n\n`)
  - Keep top-level `manaCost`, `power`, `toughness`, `loyalty`, `imageUris` as front-face values (unchanged behavior for table row display)

### Phase 2: Unit Tests — Data Layer

- [x] 2.1 Add unit tests for normalization in `tests/unit/scryfall-normalize.spec.ts`
  - Test: normal-layout card produces single-entry `cardFaces` with `layout: "normal"`
  - Test: transform DFC (e.g., Delver of Secrets) produces two `cardFaces`, `layout: "transform"`, combined `oracleText`, back face has no `manaCost`
  - Test: modal DFC (e.g., Esika) produces two `cardFaces`, `layout: "modal_dfc"`, both faces have `manaCost`
  - Test: adventure card (e.g., Bonecrusher Giant) produces two `cardFaces`, `layout: "adventure"`, combined `oracleText`
  - Test: split card (e.g., Fire // Ice) produces two `cardFaces`, `layout: "split"`
  - Test: top-level `oracleText` contains text from both faces
  - Test: top-level `manaCost`, `imageUris`, `power`, `toughness` remain front-face values

### Phase 3: Analysis Module Updates

Since top-level `oracleText` becomes the combined text of all faces, most analysis modules require **no code changes** — they already read `card.oracleText` and will automatically match against both faces' text.

- [x] 3.1 Verify `card-tags.ts` works with combined oracle text (add test cases)
  - Test: modal DFC with removal on back face gets "Removal" tag
  - Test: adventure card with card draw on adventure half gets "Card Draw" tag
  - Test: land tags still work correctly (type line checks use front face)

- [x] 3.2 Verify `synergy-axes.ts` works with combined oracle text (add test cases)
  - Test: transform DFC with graveyard text on back face scores on graveyard axis
  - Test: modal DFC with spellslinger text on back face scores on spellslinger axis

- [x] 3.3 Verify `creature-types.ts` works with combined oracle text (add test cases)
  - Test: DFC with tribal reference on back face is detected

- [x] 3.4 Update `mana-curve.ts` to track MDFC land count
  - Add `mdfcLandCount` to `ManaCurveData` return type
  - Count cards where `layout === "modal_dfc"` and back face type line contains "Land"
  - Function: `computeManaCurve()` already in `src/lib/mana-curve.ts`

- [x] 3.5 Add unit tests for MDFC mana curve annotation in `tests/unit/mana-curve.spec.ts`
  - Test: MDFC with land back face is counted in curve at front-face CMC
  - Test: `mdfcLandCount` correctly counts only MDFC lands

### Phase 4: UI — EnrichedCardRow Multi-Face Display

- [x] 4.1 Create `src/lib/card-layout.ts` utility module
  ```typescript
  export type FaceDisplayMode = "tabs" | "inline" | "single";
  export function getFaceDisplayMode(layout: string): FaceDisplayMode;
  // "tabs" for transform, modal_dfc, battle
  // "inline" for adventure, split, flip
  // "single" for normal and everything else
  ```

- [x] 4.2 Update `src/components/EnrichedCardRow.tsx` expanded detail section
  - Import `getFaceDisplayMode` and `CardFace` type
  - When `mode === "single"`: render as today (no changes)
  - When `mode === "tabs"`: render face name tabs + face content panel (image, oracle text, type line, P/T, loyalty) for the selected face
  - When `mode === "inline"`: render all faces stacked with separator and face name labels
  - Tab state: `const [activeFace, setActiveFace] = useState(0)`
  - Use classes from DD4 for tab styling

- [x] 4.3 Extract face detail rendering into a `CardFaceDetail` sub-component within `EnrichedCardRow.tsx`
  ```typescript
  function CardFaceDetail({ face }: { face: CardFace }) {
    // Renders: type line, oracle text (via OracleText), P/T or loyalty, image
  }
  ```
  This avoids duplicating the rendering logic for tabs vs inline.

- [x] 4.4 Update `ManaCost` display in the table row
  - For `modal_dfc` and `split` layouts, show front-face mana cost in the table column (already the default behavior — no change needed)
  - For `adventure` layout, optionally show adventure cost as a secondary smaller cost — defer to a follow-up if not needed

### Phase 5: E2E Tests — UI Rendering

- [x] 5.1 Add e2e tests in `e2e/multi-face-cards.spec.ts`
  - Test: transform DFC shows face tabs when expanded, clicking second tab shows back-face details
  - Test: modal DFC shows face tabs with both face names as labels
  - Test: adventure/omen card shows inline display with both halves visible
  - Test: normal card does not show tabs or multiple faces
  - Test: face tab content includes oracle text, type line, P/T for each face

- [x] 5.2 Wire `countMdfcLands()` into UI and add annotation to mana curve display
  - `DeckAnalysis.tsx` computes `mdfcLandCount` and passes to `ManaCurveChart`
  - `ManaCurveChart` displays annotation when count > 0 (e.g., "2 cards in this curve are also MDFC lands")
  - `data-testid="mdfc-land-annotation"` for e2e targeting

### Phase 6: Polish & Edge Cases

- [x] 6.1 Handle the `typeLine` column in the table row
  - For multi-face cards, the table cell currently shows the full `"Type A // Type B"` string from Scryfall
  - Keep this as-is for the collapsed row (it's informative and compact)
  - Face-specific type lines appear in the expanded detail via `CardFaceDetail`

- [x] 6.2 Verify `parseTypeLine()` in `src/lib/mana.ts` still works correctly
  - It already splits on `" // "` and parses front face only for `supertypes`/`subtypes`
  - This is correct: top-level type classification should use front face
  - Added test for modal DFC where back face is a different card type

- [x] 6.3 Verify commander validation handles DFC commanders
  - `isLegalCommander()` checks `card.oracleText` (now combined text) for "can be your commander"
  - `card.typeLine` contains full `"Type A // Type B"` so regex matches against either face
  - `card.supertypes` comes from front face — correct for commander legality
  - No code changes needed — combined oracle text approach covers this automatically

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/types.ts` | Modify | Add `CardFace` interface, add `layout` and `cardFaces` to `EnrichedCard` |
| `src/lib/scryfall.ts` | Modify | Expand `ScryfallCardFace`, add `layout` to `ScryfallCard`, update `normalizeToEnrichedCard()` |
| `src/lib/card-layout.ts` | Create | `getFaceDisplayMode()` utility |
| `src/lib/mana-curve.ts` | Modify | Add `mdfcLandCount` tracking |
| `src/components/EnrichedCardRow.tsx` | Modify | Add tabs/inline face rendering in expanded detail |
| `tests/unit/scryfall-normalize.spec.ts` | Create | Normalization tests for all multi-face layouts |
| `tests/unit/card-tags.spec.ts` | Modify | Add DFC tag detection test cases |
| `tests/unit/synergy-axes.spec.ts` | Modify | Add DFC synergy test cases |
| `tests/unit/mana-curve.spec.ts` | Modify | Add MDFC land count tests |
| `e2e/multi-face-cards.spec.ts` | Create | E2E tests for multi-face UI rendering |

No changes to: `src/lib/card-tags.ts`, `src/lib/synergy-axes.ts`, `src/lib/synergy-engine.ts`, `src/lib/creature-types.ts`, `src/lib/supertypes.ts`, `src/lib/land-base-efficiency.ts`, `src/lib/opening-hand.ts`, `src/lib/color-distribution.ts`, `src/components/DeckList.tsx`, `src/components/ManaCost.tsx`, `src/components/OracleText.tsx`, `src/components/CardTags.tsx`

The key insight is that by making top-level `oracleText` the combined text of all faces, the entire analysis layer (tags, synergy, creature types, supertypes, land efficiency, opening hand) works without any code changes. Only the data layer (normalization) and UI layer (display) need modifications.

---

## Verification

1. `npm run test:unit` — all unit tests pass (including new normalization and DFC tag tests)
2. `npm run test:e2e` — all e2e tests pass (including new multi-face UI tests)
3. `npm run build` — production build succeeds
4. Manual smoke test:
   - Import a deck containing: Delver of Secrets (transform), Esika, God of the Tree (modal_dfc), Bonecrusher Giant (adventure), Fire // Ice (split), Stormshriek Feral (adventure/omen)
   - Expand each card and verify: transform/modal_dfc show face tabs; adventure/split show inline display
   - Click between tabs on a modal DFC and verify image, oracle text, type line, and mana cost update per face
   - Check that card tags reflect abilities from both faces
   - Verify mana curve shows MDFC land count annotation if applicable
