# Mana Base Recommendations

## Context

The deck evaluator currently scores mana base quality through the Land Base Efficiency module (`src/lib/land-base-efficiency.ts`), which produces a 0–100 score with five factor breakdowns (Untapped Ratio, Color Coverage, Land Drop Consistency, Mana Fixing, Basic Land Ratio). The Color Distribution section (`src/lib/color-distribution.ts`) adds source-to-demand ratios per color, and the Hypergeometric Calculator provides opening hand land probabilities.

However, none of these tell the user **what to do about it**. A player sees "Mana Fixing: 15/100" but doesn't know whether they should add dual lands, cut basics, or restructure their ramp package. Issue #30 requests actionable, generic mana base guidance — directional advice like "add lands that produce black mana" rather than card-specific suggestions like "add Watery Grave."

This feature adds a new `src/lib/mana-recommendations.ts` pure-function module that consumes existing analysis outputs and produces a severity-sorted list of recommendations. A new `ManaBaseRecommendations.tsx` component renders these as a standalone CollapsiblePanel immediately after Land Base Efficiency in the Analysis tab. The recommendations are generic enough to be useful without prescribing specific cards, while being specific enough to give clear direction (e.g., "add 3–5 more lands that produce black mana").

**In scope:** 7 recommendation categories covering land count, color balance, ETB tempo, mana fixing, basic land ratio, ramp compatibility, and opening hand probability.

**Out of scope:** Specific card suggestions (e.g., "add Polluted Delta"), budget-aware recommendations, format-specific advice beyond Commander.

## Design Decisions

### Severity Levels

Recommendations use three severity levels, displayed with existing status patterns from DeckCompositionScorecard:

| Severity | Icon/Color | Meaning |
|----------|-----------|---------|
| `critical` | Red circle-exclamation | Likely to cause frequent game losses; must address |
| `warning` | Yellow triangle | Noticeable gameplay impact; should address |
| `suggestion` | Blue info circle | Minor optimization; nice to have |

### Overall Summary

The panel header `summary` prop shows a quick count: "N issues found" or "No issues — mana base looks good." The body opens with a health banner (following `DeckCompositionScorecard`'s `getHealthBannerClasses` pattern) using three tiers:

| Tier | Condition | Banner |
|------|-----------|--------|
| `healthy` | 0 critical, 0 warning | Green — "No issues detected" |
| `needs-attention` | 0 critical, 1+ warning | Yellow — "N areas could be improved" |
| `critical-issues` | 1+ critical | Red — "N critical issues need attention" |

### Recommendation Categories

Each recommendation has an `id`, `severity`, `category`, `title`, and `explanation`. Categories map 1:1 to the analysis logic sections described below.

### UI Layout

Follow the `DeckCompositionScorecard` component pattern:
- Health summary banner at top
- Individual recommendation rows: severity icon + title + explanation text
- Sorted by severity (critical first, then warning, then suggestion)
- No expandable card lists needed (recommendations are text-based guidance)

| Element | Tailwind Classes |
|---------|-----------------|
| Panel wrapper | `CollapsiblePanel` with `id="mana-recommendations"` |
| Health banner | Same pattern as composition scorecard health banner |
| Recommendation row | `rounded-lg bg-slate-800/40 px-3 py-2` |
| Row icon | Severity-colored SVG, same icons as composition scorecard |
| Row title | `text-sm font-medium text-slate-200` |
| Row explanation | `text-xs text-slate-400 mt-1` |

## Algorithm Design

### Input Data

The `computeManaBaseRecommendations` function accepts:

```typescript
function computeManaBaseRecommendations(
  deck: DeckData,
  cardMap: Record<string, EnrichedCard>
): ManaBaseRecommendationsResult
```

Internally it calls existing functions: `computeManaBaseMetrics`, `computeColorDistribution`, `computeLandBaseEfficiency`, `computeUntappedRatio`, `resolveCommanderIdentity`, `generateTags`, `hypergeometricCdf`, `getDeckSize`.

### Category 1: Land Count

**Goal:** Flag when land count is too high or too low for the deck's average CMC and ramp count.

**Target table (avg CMC of non-land cards → land target midpoint):**

| Avg CMC Range | Target Low | Target High |
|---------------|-----------|------------|
| ≤ 1.5 | 28 | 30 |
| 1.5–2.0 | 30 | 32 |
| 2.0–2.5 | 33 | 35 |
| 2.5–3.0 | 35 | 37 |
| 3.0–3.5 | 36 | 38 |
| 3.5–4.0 | 38 | 39 |
| > 4.0 | 39 | 41 |

**Ramp adjustment:** Reduce both target bounds by `floor(rampCount / 4)`, capped at 3.

**Tolerance:** ±2 beyond the adjusted range before triggering.

**Logic:**
1. Compute `adjustedLow = targetLow - min(floor(rampCount/4), 3)` and `adjustedHigh = targetHigh - min(floor(rampCount/4), 3)`
2. If `landCount < adjustedLow - 2`: **critical** — "Running N lands with avg CMC X.X. Consider adding M+ more lands for reliable land drops."
3. If `landCount < adjustedLow`: **warning** — "Land count is slightly below target for your mana curve. Consider adding a few more lands."
4. If `landCount > adjustedHigh + 2`: **warning** — "Running more lands than typical for your mana curve. Consider cutting a few lands for more spells."
5. Otherwise: no recommendation.

### Category 2: Color Balance

**Goal:** Identify colors where mana sources are insufficient relative to pip demand.

**Rules:**
- Only evaluate colors with ≥ 5 total pips demand
- Only evaluate colors in the commander's color identity (when commanders are present)
- Use `sourceToDemandRatio` from `computeManaBaseMetrics`

**Color name map:** `{ W: "white", U: "blue", B: "black", R: "red", G: "green" }`

| Ratio | Severity | Message Template |
|-------|----------|-----------------|
| ≥ 1.0 | none | — |
| 0.7–1.0 | `suggestion` | "Your {color} sources are slightly below demand — consider adding a few more lands that produce {color} mana." |
| 0.5–0.7 | `warning` | "Add additional lands that produce {color} mana — you have N sources for M pips of demand." |
| < 0.5 | `critical` | "Severely lacking {color} sources — you have N sources for M pips of demand. This will cause frequent color screw." |

One recommendation per deficient color.

### Category 3: ETB Tempo

**Goal:** Flag when too many lands enter tapped.

Use `computeUntappedRatio` from `land-base-efficiency.ts` — returns 0–100 where 100 = all untapped. Convert to 0–1 ratio by dividing by 100.

| Untapped Ratio | Severity | Message |
|----------------|----------|---------|
| ≥ 0.75 | none | — |
| 0.60–0.75 | `suggestion` | "A moderate number of your lands enter tapped. Look into trading out some tap lands for untapped alternatives." |
| 0.45–0.60 | `warning` | "A significant portion of your lands enter tapped, which will consistently slow your early turns." |
| < 0.45 | `critical` | "Over half your lands enter tapped. This will put you behind on tempo nearly every game." |

### Category 4: Mana Fixing Quality

**Goal:** Flag when multi-color decks lack enough dual/multi-color lands.

Use `computeManaFixingQuality` from `land-base-efficiency.ts` (returns 0–100, representing % of lands producing 2+ colors). Determine color count from `resolveCommanderIdentity`.

| Colors | No Rec. Above | Warning Below | Critical Below |
|--------|--------------|---------------|----------------|
| 1 | — | — | — (never flag) |
| 2 | 15% | 10% | 5% |
| 3 | 30% | 20% | 10% |
| 4 | 45% | 30% | 15% |
| 5 | 55% | 40% | 20% |

**Messages:**
- `suggestion`: "With N colors, consider replacing some basic lands with lands that produce multiple colors for more consistent color access."
- `warning`: "Your N-color deck has few multi-color lands. You will frequently struggle to cast spells on curve."
- `critical`: "Your N-color deck has very few multi-color lands. Color screw will be a major issue."

### Category 5: Basic Land Ratio

**Goal:** Flag when basics are too many or too few relative to color count.

Compute `basicRatio = basicLandCount / totalLandCount` and compare to ideal ratios per color count:

| Colors | Ideal Basic Ratio |
|--------|------------------|
| 1 | 0.90 |
| 2 | 0.60 |
| 3 | 0.40 |
| 4 | 0.25 |
| 5 | 0.15 |

Use the same formula as `computeBasicLandRatio` in `land-base-efficiency.ts`: `colorCount === 1 ? 0.90 : Math.max(0.15, 0.70 - colorCount * 0.13)`.

**Rules:**
- **Too many basics** (ratio exceeds ideal by ≥ 0.20, and colorCount ≥ 2): `suggestion` — "Consider replacing some basic lands with lands that produce multiple colors to improve fixing."
- **Too few basics** (ratio below ideal by ≥ 0.20): `suggestion` — "Consider keeping enough basic lands to protect against nonbasic hate and support land-search effects." Escalates to `warning` if the deck has ≥ 3 basic-only-fetching ramp cards (see Category 6 data).

### Category 6: Ramp Compatibility

**Goal:** Analyze whether the ramp package's fetch targets align with the land base.

**Step 1 — Categorize ramp cards.** For each card tagged `Ramp` whose oracle text contains "search":

| Category | Detection | Examples |
|----------|-----------|---------|
| Basic-only fetcher | Oracle contains "basic land" (the literal phrase) | Cultivate, Rampant Growth, Sakura-Tribe Elder |
| Type fetcher | Oracle contains a basic land type name (Plains/Island/Swamp/Mountain/Forest) after "search" but does NOT contain "basic land" | Nature's Lore, Farseek, Three Visits |
| Any-land fetcher | Oracle contains "search" + "land" without "basic" qualifier | Primeval Titan, Crop Rotation |

**Step 2 — Count basic lands and typed lands.**
- `basicLandCount`: cards with `supertypes.includes("Basic")` and `typeLine.includes("Land")`
- `typedLandCounts`: for each basic land type, count lands (basic and non-basic) with that subtype

**Rule 6a — Basic-only ramp vs basic count:**
- If `basicOnlyFetcherCount ≥ 3` AND `basicLandCount < basicOnlyFetcherCount * 2 + 3`:
  - `warning`: "Your ramp package includes N cards that only fetch basic lands, but you run M basics. You may run out of targets mid-game. Add more basics or look into ramp that can find any land type."

**Rule 6b — Type fetchers with no typed targets:**
- For each basic land type that a type-fetcher searches for, if the deck has 0 lands with that subtype:
  - `warning`: "You have ramp that searches for {Type} cards, but no lands with the {Type} subtype in your deck."
- If 1–2 lands with that subtype:
  - `suggestion`: "Your ramp searching for {Type} cards has very few targets (N lands)."

**Rule 6c — Fetch lands with few typed targets:**
- Count cards tagged `Fetch Land`. If ≥ 3 fetch lands but fewer than 5 lands with any basic land subtype (excluding basics themselves):
  - `suggestion`: "Your fetch lands search for basic land types, but few of your non-basic lands carry basic types. Consider lands that count as Plains, Islands, Swamps, Mountains, or Forests."

### Category 7: Opening Hand Probability

**Goal:** Flag when opening hand land probability is concerning.

Use `hypergeometricCdf(deckSize, landCount, 7, 3)` — probability of ≥ 3 lands in opening 7.

| Probability | Severity | Message |
|-------------|----------|---------|
| ≥ 0.45 | none | — |
| 0.40–0.45 | `suggestion` | "With N lands, you have a X% chance of 3+ lands in your opening hand. A few more lands would improve consistency." |
| 0.30–0.40 | `warning` | "With N lands, you only have a X% chance of drawing 3+ lands in your opening hand — expect frequent mulligans." |
| < 0.30 | `critical` | "With N lands, you have only a X% chance of 3+ opening lands. You will mulligan very frequently." |

Note: Thresholds are calibrated to Commander reality — 37 lands in 99 gives ~52% P(≥3 in 7), which is the standard healthy baseline.

### Output Types

```typescript
export type RecommendationSeverity = "critical" | "warning" | "suggestion";

export type RecommendationCategory =
  | "land-count"
  | "color-balance"
  | "etb-tempo"
  | "mana-fixing"
  | "basic-ratio"
  | "ramp-compat"
  | "opening-hand";

export interface ManaRecommendation {
  id: string;                      // unique, e.g. "land-count-low"
  severity: RecommendationSeverity;
  category: RecommendationCategory;
  title: string;
  explanation: string;
}

export type OverallHealth = "healthy" | "needs-attention" | "critical-issues";

export interface ManaBaseRecommendationsResult {
  recommendations: ManaRecommendation[];
  overallHealth: OverallHealth;
  summaryText: string;
}
```

## Implementation Tasks

### Phase 1: Write Tests (TDD)

- [ ] 1.1 Create `tests/unit/mana-recommendations.spec.ts` with `makeDeck` and `makeCard` helpers (follow pattern from `tests/unit/land-base-efficiency.spec.ts`)
- [ ] 1.2 Write land count tests:
  - Test: low-curve deck (avg CMC ~2.0) with 37 lands → no land-count recommendation
  - Test: high-curve deck (avg CMC ~3.5) with 30 lands → critical land-count-low
  - Test: low-curve deck with 42 lands → warning land-count-high
  - Test: ramp adjustment — 12 ramp cards reduce target by 3
- [ ] 1.3 Write color balance tests:
  - Test: balanced 2-color deck → no color-balance recommendation
  - Test: deck with 3 black sources but 15 black pips → critical for black
  - Test: color with < 5 pips demand is skipped
  - Test: commander identity scoping — only flag colors in identity
- [ ] 1.4 Write ETB tempo tests:
  - Test: all untapped lands → no etb-tempo recommendation
  - Test: 60% tapped lands → critical etb-tempo
  - Test: 30% tapped lands → suggestion
- [ ] 1.5 Write mana fixing quality tests:
  - Test: mono-color deck → no mana-fixing recommendation
  - Test: 3-color deck with 5% fixing → critical
  - Test: 3-color deck with 25% fixing → suggestion
  - Test: 3-color deck with 35% fixing → no recommendation
- [ ] 1.6 Write basic land ratio tests:
  - Test: 3-color deck with 80% basics → suggestion (too many)
  - Test: 3-color deck with 5% basics → suggestion (too few)
  - Test: mono-color all basics → no recommendation
- [ ] 1.7 Write ramp compatibility tests:
  - Test: 5 basic-only fetchers with 4 basics → warning
  - Test: type fetcher for Forest but no forests in deck → warning
  - Test: 4 fetch lands but 0 non-basic typed lands → suggestion
  - Test: compatible ramp setup → no ramp-compat recommendation
- [ ] 1.8 Write opening hand probability tests:
  - Test: 37 lands in 99-card deck → no opening-hand recommendation
  - Test: 25 lands in 99-card deck → critical
  - Test: 32 lands → suggestion or warning (verify threshold)
- [ ] 1.9 Write overall result tests:
  - Test: healthy deck produces `overallHealth: "healthy"` and empty recommendations
  - Test: deck with critical issues → `overallHealth: "critical-issues"`
  - Test: recommendations are sorted by severity (critical → warning → suggestion)
  - Test: summaryText reflects issue count

### Phase 2: Implement Core Logic

- [ ] 2.1 Create `src/lib/mana-recommendations.ts` with types:
  - `RecommendationSeverity`, `RecommendationCategory`, `ManaRecommendation`, `OverallHealth`, `ManaBaseRecommendationsResult`
- [ ] 2.2 Implement `getLandCountTarget(avgCmc: number): { low: number; high: number }` — lookup table from algorithm section
- [ ] 2.3 Implement `checkLandCount(metrics, deck, cardMap): ManaRecommendation[]` — land count logic with ramp adjustment
- [ ] 2.4 Implement `checkColorBalance(metrics, distribution, commanderIdentity): ManaRecommendation[]` — per-color source-to-demand check
- [ ] 2.5 Implement `checkEtbTempo(deck, cardMap): ManaRecommendation[]` — untapped ratio check
- [ ] 2.6 Implement `checkManaFixing(deck, cardMap, commanderIdentity): ManaRecommendation[]` — fixing quality by color count
- [ ] 2.7 Implement `checkBasicLandRatio(deck, cardMap, commanderIdentity, basicOnlyFetcherCount): ManaRecommendation[]` — basic ratio check
- [ ] 2.8 Implement `categorizeRampCards(deck, cardMap)` — returns `{ basicOnly, typeFetchers, anyLand }` with counts and type details
- [ ] 2.9 Implement `checkRampCompatibility(deck, cardMap): ManaRecommendation[]` — rules 6a, 6b, 6c
- [ ] 2.10 Implement `checkOpeningHand(deck, cardMap): ManaRecommendation[]` — hypergeometric check
- [ ] 2.11 Implement `computeManaBaseRecommendations(deck, cardMap): ManaBaseRecommendationsResult` — orchestrate all checks, sort by severity, compute health + summary

### Phase 3: UI Component

- [ ] 3.1 Create `src/components/ManaBaseRecommendations.tsx`:
  - Props: `result: ManaBaseRecommendationsResult`
  - Health summary banner (green/yellow/red, same pattern as `DeckCompositionScorecard`)
  - Recommendation list: severity icon + title + explanation, sorted by severity
  - Empty state: "No issues detected — your mana base looks solid." with green checkmark
  - Use `data-testid="mana-recommendations"` on the outer section
  - Use `data-testid="recommendation-row"` on each recommendation
  - Use `data-testid="recommendations-health-summary"` on the health banner

### Phase 4: Integration

- [ ] 4.1 Modify `src/components/DeckAnalysis.tsx`:
  - Import `computeManaBaseRecommendations` from `@/lib/mana-recommendations`
  - Import `ManaBaseRecommendations` component
  - Add `useMemo` call for `manaRecommendations`
  - Add `{ id: "mana-recommendations", label: "Mana Recs" }` to `ANALYSIS_SECTIONS` after `land-efficiency`
  - Add `CollapsiblePanel` with `id="mana-recommendations"` after the Land Base Efficiency panel
  - Use `summary` prop to show issue count in collapsed state

### Phase 5: E2E Tests

- [ ] 5.1 Add e2e test: "Mana Base Recommendations section appears in Analysis tab" — verify CollapsiblePanel renders with correct title
- [ ] 5.2 Add e2e test: "displays health summary banner" — import a deck and verify the banner element exists
- [ ] 5.3 Add e2e test: "displays recommendation rows when issues exist" — import a deliberately weak mana base and verify recommendation rows appear

### Phase 6: Verify

- [ ] 6.1 `npm run test:unit` — all unit tests pass
- [ ] 6.2 `npm run test:e2e` — all e2e tests pass
- [ ] 6.3 `npm run build` — production build succeeds

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `tests/unit/mana-recommendations.spec.ts` | Create | Unit tests for recommendation engine (TDD first) |
| `src/lib/mana-recommendations.ts` | Create | Pure-function recommendation engine |
| `src/components/ManaBaseRecommendations.tsx` | Create | Recommendation display component |
| `src/components/DeckAnalysis.tsx` | Modify | Add section + nav entry after Land Efficiency |
| `e2e/mana-recommendations.spec.ts` | Create | E2E tests for section visibility |

No changes to: `src/lib/land-base-efficiency.ts`, `src/lib/color-distribution.ts`, `src/lib/card-tags.ts`, `src/lib/hypergeometric.ts`, `src/lib/types.ts`, `e2e/fixtures.ts`.

## Verification

1. `npm run test:unit` — all unit tests pass including new `mana-recommendations.spec.ts`
2. `npm run test:e2e` — all e2e tests pass including new `mana-recommendations.spec.ts`
3. `npm run build` — production build succeeds
4. Manual: Import a Commander deck → Analysis tab → verify "Mana Base Recommendations" panel appears after "Land Base Efficiency"
5. Manual: Import a 5-color deck with all basic lands → verify critical recommendations for mana fixing and color balance
6. Manual: Import a well-built 2-color deck → verify "No issues" or minor suggestions only
7. Manual: Import a deck with heavy basic-land ramp but few basics → verify ramp compatibility warning
