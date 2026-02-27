# Bracket Estimator (Issue #31)

## Context

The Commander format now uses the official WotC Bracket System (1-5) introduced in February 2025 and updated through February 2026. This is fundamentally different from our existing power level score (1-10 weighted factors): brackets are **constraint-based** — certain cards, combos, and strategies are forbidden at lower brackets — while power level measures overall optimization intensity.

Currently the codebase has a mature power level estimator (`src/lib/power-level.ts`, `src/components/PowerLevelEstimator.tsx`) that scores decks 1-10 based on 8 weighted factors (tutor density, fast mana, CMC, interaction, combos, mana base, card draw, win speed). The card tagging system (`src/lib/card-tags.ts`) generates 19 heuristic tags from oracle text and keywords. The known-combos registry (`src/lib/known-combos.ts`) tracks 15 curated 2-3 card combos with types (infinite, wincon, lock, value). None of these systems currently evaluate bracket eligibility.

This plan adds a bracket estimator as a **new parallel analysis module** alongside the existing power level. It introduces three new card tags (Game Changer, Extra Turn, Mass Land Denial), a cEDH staple overlap scorer that fetches daily-updated metagame data, and a constraint-based bracket computation. The existing power level system remains untouched and serves as a soft signal input for B1/B2 and B4/B5 differentiation.

**In scope:** New card tags on `EnrichedCard`, bracket estimation logic, cEDH staple data fetching with cache + static fallback, Commander Spellbook combo integration for 2-card combo detection, bracket UI component with downgrade recommendations, integration into `DeckAnalysis`. **Out of scope:** Modifying the existing power level system, TopDeck.gg API integration.

## Design Decisions

### DD1: Game Changer sourced from Scryfall, not a static list

Scryfall returns `game_changer: boolean` on every card object. We add this field to `ScryfallCard` and flow it through `EnrichedCard.isGameChanger` to `generateTags()`. This auto-updates whenever Scryfall syncs with WotC announcements — no static list maintenance required.

### DD2: Extra Turn and Mass Land Denial detected via oracle text regex

**Extra Turn** — every extra turn card in MTG history uses the phrase "extra turn" in oracle text. Pattern: `/\bextra turn\b/i`. Zero false positives.

**Mass Land Denial** — broad scope per user decision, covering:
- Full MLD: `destroy all [...]lands` (Armageddon, Jokulhaups, Obliterate)
- Sacrifice MLD: `each player sacrifices [...]land` (Cataclysm-style)
- Partial MLD: `destroy all nonbasic lands` (Ruination)
- Resource denial: Blood Moon, Back to Basics (detected by name set since oracle text varies)
- Stax land denial: Winter Orb, Static Orb, Stasis, Rising Waters (detected by name set)

Patterns:
```
FULL_MLD_RE     = /\bdestroy all\b[^.]*\blands\b/i
SACRIFICE_MLD_RE = /\beach player\b[^.]*\bsacrifices?\b[^.]*\bland/i
PARTIAL_MLD_RE  = /\bdestroy all nonbasic lands\b/i

RESOURCE_DENIAL_NAMES = Set([
  "Blood Moon", "Back to Basics", "Magus of the Moon",
  "Winter Orb", "Static Orb", "Stasis", "Rising Waters",
  "Hokori, Dust Drinker", "Tanglewire"
])
```

### DD3: Combo detection from two sources — known-combos + Commander Spellbook

The known-combos registry (`known-combos.ts`) has only 15 curated combos, while Commander Spellbook knows about 4,056+ two-card combos. The app already fetches Spellbook combos via `commander-spellbook.ts` and the data flows through `DeckImportSection` → `DeckViewTabs`. Currently this data reaches `SynergySection` but NOT `DeckAnalysis`.

**Combo sources for bracket estimation:**
1. **Known combos** (synchronous, always available): `findCombosInDeck()` from `known-combos.ts`
2. **Spellbook exact combos** (async, may be loading/null): `spellbookCombos.exactCombos` from API

The bracket estimator accepts both and merges them. The UI shows an initial estimate from known combos, then refines when Spellbook data arrives.

**Combo type filtering:** The bracket rules restrict "two-card infinite combos/lock-outs" in B1-3. From known-combos, we filter to `infinite | lock | wincon` types — the `value` type (e.g., Sword of the Meek + Thopter Foundry) does NOT trigger bracket restrictions. From Spellbook, all exact 2-card combos count (Spellbook doesn't have a "value" distinction). Only 2-card combos count — 3-card combos are permitted at all brackets.

**Data flow change:** Thread `spellbookCombos` from `DeckViewTabs` into `DeckAnalysis` as a new optional prop.

### DD4: B1/B2 differentiation via power level threshold

Both B1 and B2 share identical hard constraints. Differentiation uses the existing power level score:
- Power level 1-3 → Bracket 1 (Exhibition)
- Power level 4+ → Bracket 2 (Core)

### DD5: B4/B5 differentiation via cEDH staple overlap + power level

Both B4 and B5 share zero restrictions. Differentiation uses a multi-signal heuristic:
- Fetch cEDH staple data from `KonradHoeffner/cedh` gh-pages (daily-updated, 1083 cards with inclusion %)
- Compute "cEDH staple overlap" = % of user's non-land cards that appear in 20%+ of cEDH decks
- **B5** requires ALL of: power level ≥ 9, staple overlap > 40%, AND 2+ infinite/wincon combos
- **B4** = everything else that passes B4 constraints

Cache the staple data with 24h TTL. Fall back to a static snapshot if the fetch fails.

### DD6: Bracket UI placement and visual design

New collapsible section in `DeckAnalysis`, positioned **before** Power Level (index 2 in `ANALYSIS_SECTIONS`). This puts it early since bracket is the primary community communication tool.

Visual pattern follows `PowerLevelEstimator.tsx`:

| Element | Tailwind Classes |
|---------|-----------------|
| Bracket number (large) | `text-5xl font-bold leading-none` + color utility |
| Bracket name badge | `inline-block w-fit rounded border px-2 py-0.5 text-xs font-semibold` + color utility |
| Constraint violation row | `rounded-lg bg-slate-800/40 px-3 py-2` (same as power level factor row) |
| Section heading | `mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300` |
| Section subtitle | `mb-4 text-xs text-slate-400` |

Bracket color scheme:

| Bracket | Number Color | Badge BG/Border/Text |
|---------|-------------|----------------------|
| 1 (Exhibition) | `text-green-400` | `bg-green-900/50 border-green-700 text-green-400` |
| 2 (Core) | `text-blue-400` | `bg-blue-900/50 border-blue-700 text-blue-400` |
| 3 (Upgraded) | `text-yellow-400` | `bg-yellow-900/50 border-yellow-700 text-yellow-400` |
| 4 (Optimized) | `text-orange-400` | `bg-orange-900/50 border-orange-700 text-orange-400` |
| 5 (cEDH) | `text-red-400` | `bg-red-900/50 border-red-700 text-red-400` |

### DD7: New tag colors

| Tag | BG | Text |
|-----|-----|------|
| Game Changer | `bg-red-500/20` | `text-red-300` |
| Extra Turn | `bg-amber-600/20` | `text-amber-200` |
| Mass Land Denial | `bg-orange-600/20` | `text-orange-200` |

Note: "Game Changer" reuses red but at 500/20 opacity — distinguishable from Removal's `bg-red-500/20` since the tag text itself differs. If this is too close visually, we can shift to `bg-rose-600/20 text-rose-200`.

### DD8: Extra turn count granularity

The bracket rules distinguish extra turn handling per bracket:
- B1: No extra turns at all
- B2: No chaining extra turns (1 extra turn card OK)
- B3: No chaining extra turns before turn 6

We use count-based detection:
- 0 extra turn cards → B1-2 eligible (no constraint)
- 1 extra turn card → B2+ minimum (single extra turn, no chaining possible)
- 2+ extra turn cards → B3+ minimum (chaining risk)

Note: We cannot programmatically determine WHEN extra turns will be cast (the "before turn 6" B3 rule), so we treat 2+ extra turn cards as B3 and leave the turn-6 nuance to the user's pre-game conversation.

### DD9: Downgrade recommendations

The bracket UI shows actionable recommendations for lowering the deck's bracket. For each bracket below the estimated one, the UI lists which specific cards would need to be removed. This aligns with the bracket system's purpose as a pre-game negotiation tool.

**Implementation:** Each `BracketConstraint` already contains the `cards` array and `minBracket`. The recommendations section groups constraints by target bracket and lists the cards:
- "To play in Bracket 3: Remove 2-card combos (Thassa's Oracle, Demonic Consultation) and Mass Land Denial (Armageddon)"
- "To play in Bracket 2: Also remove Game Changers (Cyclonic Rift, Rhystic Study, Demonic Tutor)"

Only show recommendations for brackets that are actually reachable (e.g., don't show "To play in Bracket 1" if the deck's power level would still place it at B2).

## Algorithm Design

### Bracket Estimation Algorithm

**Input:** `DeckData`, `Record<string, EnrichedCard>`, `PowerLevelResult`, `cEDHStapleSet`, `SpellbookCombo[] | null`

**Step 1 — Count constraint violations:**

| Signal | Source | Method |
|--------|--------|--------|
| Game Changer count | `EnrichedCard.isGameChanger` | `countTaggedCards(deck, cardMap, ["Game Changer"])` |
| 2-card combo count (local) | `known-combos.ts` | Filter: `combo.cards.length === 2 && (type === "infinite" \|\| "lock" \|\| "wincon")` |
| 2-card combo count (Spellbook) | `SpellbookCombo[]` | Filter: `combo.type === "exact" && combo.cards.length === 2` |
| Merged 2-card combos | Union of above | Deduplicate by sorting card pairs, take the union |
| Extra turn count | Tag: "Extra Turn" | `countTaggedCards(deck, cardMap, ["Extra Turn"])` |
| MLD present | Tag: "Mass Land Denial" | `countTaggedCards(deck, cardMap, ["Mass Land Denial"]) > 0` |

**Step 2 — Determine minimum bracket (hard floor):**

```
if (has2CardCombo || hasMLD)         → minBracket = 4
else if (gameChangerCount > 3)       → minBracket = 4
else if (gameChangerCount >= 1)      → minBracket = 3
else if (extraTurnCount >= 2)        → minBracket = 3   // chaining risk
else if (extraTurnCount === 1)       → minBracket = 2   // single extra turn, no chaining
else                                 → minBracket = 1
```

**Step 3 — Apply soft signals within eligible range:**

```
if (minBracket >= 4):
  if (powerLevel >= 9 AND stapleOverlap > 40% AND infiniteOrWinconCombos >= 2):
    bracket = 5
  else:
    bracket = 4
else if (minBracket <= 2):
  if (powerLevel <= 3):
    bracket = 1
  else:
    bracket = 2
else:
  bracket = minBracket  // 3
```

**Step 4 — Build constraint detail list:**

Each detected constraint becomes a `BracketConstraint` with:
- `type`: "game-changer" | "two-card-combo" | "extra-turn" | "mass-land-denial"
- `cards`: card names that triggered the constraint
- `minBracket`: the minimum bracket this constraint forces
- `explanation`: human-readable string

### cEDH Staple Overlap Algorithm

**Step 1:** Fetch `https://raw.githubusercontent.com/KonradHoeffner/cedh/gh-pages/data/cards.json`

**Step 2:** Build staple set = card names where `percent >= 20` (typically ~127 cards)

**Step 3:** For the user's deck, count non-land cards that appear in the staple set

**Step 4:** `overlapPercent = stapleCount / totalNonLandCards * 100`

**Caching:** Store fetched data in a module-level variable with timestamp. Re-fetch if stale (>24h) or on first call. Fall back to `STATIC_CEDH_STAPLES` (baked-in snapshot) if fetch fails.

## Implementation Tasks

### Phase 1: Extend EnrichedCard with Game Changer field

- [ ] 1.1 Add `game_changer` to `ScryfallCard` interface in `src/lib/scryfall.ts`
  - Add `game_changer?: boolean` field to the interface (after `flavor_name`)
- [ ] 1.2 Add `isGameChanger` to `EnrichedCard` interface in `src/lib/types.ts`
  - Add `isGameChanger: boolean` field
- [ ] 1.3 Flow `game_changer` through `normalizeToEnrichedCard()` in `src/lib/scryfall.ts`
  - Map `card.game_changer ?? false` to `isGameChanger`

### Phase 2: Add new card tags — tests first

- [ ] 2.1 Add tag test cases to `tests/unit/card-tags.spec.ts`
  - Test: Cyclonic Rift (Game Changer + Board Wipe) gets "Game Changer" tag
  - Test: Time Warp gets "Extra Turn" tag
  - Test: Expropriate ("extra turn after this one") gets "Extra Turn" tag
  - Test: Armageddon ("Destroy all lands") gets "Mass Land Denial" tag
  - Test: Jokulhaups ("Destroy all artifacts, creatures, and lands") gets "Mass Land Denial" tag
  - Test: Ruination ("Destroy all nonbasic lands") gets "Mass Land Denial" tag
  - Test: Blood Moon gets "Mass Land Denial" tag (name-based detection)
  - Test: Winter Orb gets "Mass Land Denial" tag (name-based detection)
  - Test: Lightning Bolt does NOT get any of these three tags
  - Test: "destroy all nonland permanents" does NOT get "Mass Land Denial"
  - Test: mockCard with `isGameChanger: true` gets "Game Changer" tag
  - Test: mockCard with `isGameChanger: false` does NOT get "Game Changer" tag

- [ ] 2.2 Add tag colors to `TAG_COLORS` in `src/lib/card-tags.ts`
  - `"Game Changer": { bg: "bg-red-500/20", text: "text-red-300" }`
  - `"Extra Turn": { bg: "bg-amber-600/20", text: "text-amber-200" }`
  - `"Mass Land Denial": { bg: "bg-orange-600/20", text: "text-orange-200" }`

- [ ] 2.3 Add regex patterns and name sets to `src/lib/card-tags.ts`
  - `EXTRA_TURN_RE = /\bextra turn\b/i`
  - `FULL_MLD_RE = /\bdestroy all\b[^.]*\blands\b/i`
  - `SACRIFICE_MLD_RE = /\beach player\b[^.]*\bsacrifices?\b[^.]*\bland/i`
  - `RESOURCE_DENIAL_NAMES: Set<string>` (Blood Moon, Back to Basics, Magus of the Moon, Winter Orb, Static Orb, Stasis, Rising Waters, Hokori Dust Drinker, Tanglewire)

- [ ] 2.4 Add detection logic to `generateTags()` in `src/lib/card-tags.ts`
  - Game Changer: `if (card.isGameChanger) tags.add("Game Changer")`
  - Extra Turn: `if (EXTRA_TURN_RE.test(text)) tags.add("Extra Turn")`
  - Mass Land Denial: test regex patterns + check `RESOURCE_DENIAL_NAMES.has(card.name)`
  - Update `mockCard()` in test helpers to include `isGameChanger: false` default

### Phase 3: cEDH staple data module — tests first

- [ ] 3.1 Create `tests/unit/cedh-staples.spec.ts`
  - Test: `computeStapleOverlap()` returns 0% for deck with no staples
  - Test: `computeStapleOverlap()` returns 100% for deck of all staples
  - Test: `computeStapleOverlap()` excludes lands from calculation
  - Test: `computeStapleOverlap()` handles empty deck gracefully (returns 0)
  - Test: `buildStapleSet()` filters to cards with percent >= 20
  - Test: `buildStapleSet()` returns card names as a Set
  - Test: `STATIC_CEDH_STAPLES` contains expected staples (Sol Ring, Chrome Mox, etc.)

- [ ] 3.2 Create `src/lib/cedh-staples.ts`
  - `STATIC_CEDH_STAPLES: Set<string>` — baked-in snapshot of ~127 card names at 20%+ inclusion
  - `interface CedhStapleData { staples: Set<string>; fetchedAt: number }`
  - `async function fetchCedhStaples(): Promise<Set<string>>` — fetches from gh-pages, builds set of names where percent >= 20, falls back to `STATIC_CEDH_STAPLES`
  - `async function getCedhStaples(): Promise<Set<string>>` — cached getter with 24h TTL, module-level cache variable
  - `function buildStapleSet(cardsJson: Record<string, { name: string; percent: number }>): Set<string>` — pure function for building staple set from JSON data
  - `function computeStapleOverlap(deck: DeckData, cardMap: Record<string, EnrichedCard>, staples: Set<string>): number` — returns 0-100 percentage of non-land cards in deck that are cEDH staples

### Phase 4: Bracket estimator core logic — tests first

- [ ] 4.1 Create `tests/unit/bracket-estimator.spec.ts`
  - **Bracket floor tests:**
    - Test: Empty deck returns bracket 1
    - Test: Precon-like deck (no GC, no combos, no MLD, no extra turns, PL 4) returns bracket 2
    - Test: Theme deck (no GC, no combos, no MLD, no extra turns, PL 2) returns bracket 1
    - Test: Deck with 1 Game Changer and no other violations returns bracket 3
    - Test: Deck with 3 Game Changers returns bracket 3
    - Test: Deck with 4+ Game Changers returns bracket 4
    - Test: Deck with 2-card infinite combo (known) returns bracket 4
    - Test: Deck with 2-card wincon (Thoracle+Consult) returns bracket 4
    - Test: Deck with 2-card lock (Knowledge Pool + Magistrate) returns bracket 4
    - Test: Deck with 3-card combo only does NOT trigger combo restriction
    - Test: Deck with 2-card value combo does NOT trigger combo restriction
    - Test: Deck with Mass Land Denial card returns bracket 4
  - **Extra turn granularity tests:**
    - Test: 0 extra turn cards → no extra turn constraint
    - Test: 1 extra turn card → minBracket 2 (no chaining)
    - Test: 2 extra turn cards → minBracket 3 (chaining risk)
    - Test: 3+ extra turn cards → minBracket 3
  - **Spellbook combo integration tests:**
    - Test: Spellbook 2-card exact combo triggers bracket 4
    - Test: Spellbook 3-card exact combo does NOT trigger combo restriction
    - Test: Spellbook near combo (not all cards in deck) does NOT trigger
    - Test: Null spellbook data gracefully handled (uses known combos only)
    - Test: Duplicate combos from both sources are deduplicated
  - **B4/B5 differentiation tests:**
    - Test: Deck with PL 9+, staple overlap > 40%, and 2+ combos returns bracket 5
    - Test: Deck with PL 9+ but low staple overlap returns bracket 4
    - Test: Deck with high staple overlap but PL 7 returns bracket 4
  - **Constraint and recommendation tests:**
    - Test: Constraint details list includes all triggering cards
    - Test: Each constraint has correct `minBracket` value
    - Test: Bracket names are correct ("Exhibition", "Core", "Upgraded", "Optimized", "cEDH")
    - Test: Bracket descriptions are non-empty strings
    - Test: `computeDowngradeRecommendations()` returns empty for bracket 1
    - Test: Recommendations for B4→B3 list combo cards and MLD cards to remove
    - Test: Recommendations for B3→B2 list Game Changer cards to remove
    - Test: Recommendations skip unreachable brackets (e.g., don't suggest B1 if PL > 3)

- [ ] 4.2 Create `src/lib/bracket-estimator.ts`
  - Types:
    ```typescript
    interface BracketConstraint {
      type: "game-changer" | "two-card-combo" | "extra-turn" | "mass-land-denial";
      cards: string[];
      minBracket: number;
      explanation: string;
    }

    interface DowngradeRecommendation {
      targetBracket: number;
      targetBracketName: string;
      removals: BracketConstraint[];  // constraints that must be resolved
    }

    interface BracketResult {
      bracket: number;           // 1-5
      bracketName: string;       // "Exhibition" | "Core" | "Upgraded" | "Optimized" | "cEDH"
      bracketDescription: string;
      constraints: BracketConstraint[];
      recommendations: DowngradeRecommendation[];
      gameChangerCount: number;
      twoCardComboCount: number;
      extraTurnCount: number;
      hasMassLandDenial: boolean;
      cedhStapleOverlap: number; // 0-100
      comboSource: "local" | "local+spellbook";  // transparency on data completeness
    }
    ```
  - `BRACKET_NAMES: Record<number, string>` — maps 1-5 to names
  - `BRACKET_DESCRIPTIONS: Record<number, string>` — maps 1-5 to descriptions
  - `function findRestrictedKnownCombos(cardNames: string[]): KnownCombo[]` — filters known-combos to 2-card combos of type infinite/lock/wincon
  - `function findRestrictedSpellbookCombos(spellbookCombos: SpellbookCombo[] | null): SpellbookCombo[]` — filters Spellbook exact combos to 2-card entries
  - `function mergeRestrictedCombos(knownCombos, spellbookCombos): { cards: string[]; source: string }[]` — deduplicates by sorted card pair key
  - `function computeDowngradeRecommendations(bracket, constraints, powerLevel): DowngradeRecommendation[]` — for each reachable lower bracket, list which constraints must be resolved
  - `function computeBracketEstimate(deck, cardMap, powerLevel, cedhStaples, spellbookCombos?): BracketResult` — main computation following the algorithm above

### Phase 5: Bracket estimator UI component

- [ ] 5.1 Create `e2e/bracket-estimator.spec.ts`
  - Test: Bracket section appears in analysis view
  - Test: Bracket number (1-5) is displayed
  - Test: Bracket name badge is displayed
  - Test: Bracket description is displayed
  - Test: Constraint violations are listed when present
  - Test: Game Changer cards are named in constraint detail
  - Test: Downgrade recommendations section appears for bracket > 1
  - Test: Recommendations list specific cards to remove
  - Test: Section is collapsible (follows CollapsiblePanel pattern)
  - Test: Combo source indicator shows "local" or "local+spellbook"

- [ ] 5.2 Create `src/components/BracketEstimator.tsx`
  - Props: `{ result: BracketResult }`
  - Layout follows `PowerLevelEstimator.tsx` pattern:
    - Large bracket number (1-5) with bracket color utility
    - Bracket name badge with colored border
    - Bracket description
    - Combo source indicator (small text: "Combo detection: local only" vs "Combo detection: local + Commander Spellbook")
    - Constraint breakdown section (only shown if constraints exist):
      - Each constraint as a row with type label, card names, and explanation
      - Color-coded by severity (B3 = yellow, B4+ = orange/red)
    - Downgrade recommendations section (only shown if bracket > 1):
      - For each reachable lower bracket, show the target bracket badge and list of cards to remove
      - Grouped by constraint type (e.g., "Remove Game Changers: Cyclonic Rift, Rhystic Study")
    - cEDH staple overlap display (only shown for B4+ decks):
      - Percentage with progress bar
  - Color utilities: `getBracketColor(bracket)`, `getBracketBadgeClasses(bracket)`
  - Accessibility: `aria-labelledby`, section heading pattern

### Phase 6: Integration into DeckAnalysis and data threading

- [ ] 6.1 Thread `spellbookCombos` to `DeckAnalysis`
  - Modify `DeckViewTabs.tsx`: pass `spellbookCombos` prop to the Analysis tab's `DeckAnalysis` component (currently only passed to `SynergySection`)
  - Modify `DeckAnalysis` props interface to accept optional `spellbookCombos`:
    ```typescript
    interface DeckAnalysisProps {
      deck: DeckData;
      cardMap: Record<string, EnrichedCard>;
      expandedSections: Set<string>;
      onToggleSection: (id: string) => void;
      spellbookCombos?: { exactCombos: SpellbookCombo[]; nearCombos: SpellbookCombo[] } | null;
    }
    ```

- [ ] 6.2 Add bracket section to `DeckAnalysis.tsx`
  - Add `"bracket"` to `ANALYSIS_SECTIONS` at index 2 (before power-level): `{ id: "bracket", label: "Bracket" }`
  - Add `useMemo` for bracket computation:
    ```typescript
    const cedhStaples = useMemo(() => STATIC_CEDH_STAPLES, []);
    const bracketResult = useMemo(
      () => computeBracketEstimate(deck, cardMap, powerLevel, cedhStaples, spellbookCombos?.exactCombos ?? null),
      [deck, cardMap, powerLevel, cedhStaples, spellbookCombos]
    );
    ```
  - Add `CollapsiblePanel` wrapping `<BracketEstimator result={bracketResult} />`
  - Add summary badge to panel header showing bracket number
  - Bracket re-computes automatically when Spellbook data arrives (React reactivity via `useMemo` deps)

- [ ] 6.3 Add async cEDH staple fetching (enhancement)
  - In the parent page component (`DeckImportSection`), call `getCedhStaples()` on mount via `useEffect`
  - Pass resolved staples through `DeckViewTabs` → `DeckAnalysis` as a prop
  - While loading, use `STATIC_CEDH_STAPLES` as default
  - This avoids blocking the initial render on an external fetch

### Phase 7: Verification and cleanup

- [ ] 7.1 Run `npm run test:unit` — all unit tests pass
- [ ] 7.2 Run `npm run test:e2e` — all e2e tests pass
- [ ] 7.3 Run `npm run build` — production build succeeds
- [ ] 7.4 Run `npm run lint` — no lint errors
- [ ] 7.5 Manual smoke test: import a known cEDH deck and verify bracket 5 classification
- [ ] 7.6 Manual smoke test: import a precon-level deck and verify bracket 1-2 classification
- [ ] 7.7 Manual smoke test: verify Game Changer tag pills appear on enriched cards

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/types.ts` | Modify | Add `isGameChanger: boolean` to `EnrichedCard` |
| `src/lib/scryfall.ts` | Modify | Add `game_changer` to `ScryfallCard`, flow through normalization |
| `src/lib/card-tags.ts` | Modify | Add 3 new tags (Game Changer, Extra Turn, Mass Land Denial) with regex patterns, name sets, and TAG_COLORS entries |
| `src/lib/cedh-staples.ts` | Create | cEDH staple data fetching, caching, overlap computation |
| `src/lib/bracket-estimator.ts` | Create | Bracket estimation logic, types, constraint detection, downgrade recommendations |
| `src/components/BracketEstimator.tsx` | Create | Bracket UI component with constraints and recommendations |
| `src/components/DeckAnalysis.tsx` | Modify | Add bracket section to analysis panels, accept `spellbookCombos` prop |
| `src/components/DeckViewTabs.tsx` | Modify | Thread `spellbookCombos` to `DeckAnalysis` component |
| `tests/unit/card-tags.spec.ts` | Modify | Add tests for 3 new tags |
| `tests/unit/cedh-staples.spec.ts` | Create | Unit tests for staple data and overlap computation |
| `tests/unit/bracket-estimator.spec.ts` | Create | Unit tests for bracket estimation, Spellbook integration, recommendations |
| `e2e/bracket-estimator.spec.ts` | Create | E2E tests for bracket UI, constraints, and recommendations |

No changes to: `src/lib/power-level.ts`, `src/lib/known-combos.ts`, `src/lib/commander-spellbook.ts`, `src/components/PowerLevelEstimator.tsx`, `src/app/api/deck-enrich/route.ts`, existing test files (except `card-tags.spec.ts`).

## Verification

1. `npm run test:unit` — all unit tests pass (including new bracket-estimator, cedh-staples, and card-tags tests)
2. `npm run test:e2e` — all e2e tests pass (including new bracket-estimator e2e tests)
3. `npm run build` — production build succeeds with no type errors
4. `npm run lint` — no lint errors
5. Manual: Import a cEDH deck (e.g., Blue Farm / Tymna+Kraum list) → verify Bracket 5, Game Changer tags on Rhystic Study / Cyclonic Rift / etc.
6. Manual: Import a precon-level deck → verify Bracket 1-2, no Game Changer tags
7. Manual: Import a deck with Armageddon → verify "Mass Land Denial" tag and Bracket 4
8. Manual: Import a deck with only 1 Game Changer → verify Bracket 3 with constraint detail naming the card
