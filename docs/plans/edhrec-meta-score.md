# EDHREC Meta Score — "Stock ↔ Spicy"

## Context

The deck-evaluator routes a deck through `import → ritual → reading → sub-routes`, and separately offers a deck-building workbench at `/crucible`. Today the `/reading` verdict hero (`src/components/reading/ReadingHero.tsx`) summarizes a deck with a row of `StatTile`s (Bracket, Power Level, Total Cost, Top Theme), and `/reading/cards` (`src/components/DeckList.tsx`) lists cards grouped by zone with no sort/filter. Nothing today tells a builder how *conventional* their card choices are relative to the wider Commander community.

This feature adds an **EDHREC-sourced "meta" read**: for the deck's commander, EDHREC publishes, per card, an inclusion rate (`num_decks / potential_decks` — "900 of 1,000 decks run this" → 90%). We pull those rates, annotate each card, and roll them up into a deck-level read of how *stock* (netdecked, expected) versus *spicy* (off-meta, experimental) the build is. The killer value is not the aggregate number but **surfacing which specific cards are the builder's spice** — so the framing is always a neutral **Stock ↔ Spicy** spectrum, never a graded score with pass/fail styling.

The scope below was locked in a design review (the interactive options artifact lives at `.lavish/meta-score-options.html`). **In scope:** the Coverage × Spice headline metric with two alternate scoring lenses (Field Percentile, Plain Mean), three display layers (a headline stat, distribution bands, a per-card inclusion heat list with card art on hover), placement woven into `/reading` plus a selectable "Meta" lens in the Crucible, EDHREC fetch + per-commander daily-TTL cache, three required failure states, and multi-commander fallback handling. **Explicitly out:** the synergy scatter (deferred), any write to EDHREC, and a dedicated `/reading/meta` route (we weave into existing surfaces instead).

Two codebase gaps this plan must fill (flagged during exploration): (1) **there is no SVG dial/gauge component** — the existing "power dial" is a `StatTile`, so the "Conformity Dial" ships as a `StatTile` plus a bands visual, not a bespoke gauge; (2) **there is no caching/TTL helper** (`scryfall.ts` has a literal `// TODO: add server-side LRU cache`) — the EDHREC route introduces a small module-scoped TTL cache.

## Design Decisions

### D1 — Metric: Coverage × Spice (default lens)
Two numbers rather than one blurry average (a plain mean of ~99 cards regresses to the middle and fails to separate decks):
- **Staple coverage** — of the commander's **top 30** cards by EDHREC inclusion, how many the deck runs, as a percentage. Answers "do you run the good stuff."
- **Spice count** — number of deck cards with inclusion `< 10%` (including cards EDHREC has never seen, which count as **0%**). Answers "how experimental."

### D2 — Alternate lenses (user-switchable, in-product)
A lens switcher lets the user recompute the headline read without leaving the page:
| Lens | Deck-level readout | Notes |
|---|---|---|
| `coverage` (default) | Coverage % + spice count | D1 |
| `percentile` | "More stock than N%…" | Rank of the deck's mean inclusion vs the field. Needs a field-distribution proxy (see D6). |
| `mean` | Mean inclusion % | The familiar-but-samey baseline; explicitly labelled as such. |

### D3 — Bands (distribution)
Every non-land, non-commander card is bucketed by inclusion into: **Staple** ≥ 90%, **Standard** 50–90%, **Niche** 10–50%, **Spice** < 10%. Rendered as one stacked bar with counts. Reuses `Tag` variants for band colors (`accent`/`cyan`/`warn`), no raw colors.

### D4 — Framing (non-negotiable)
Neutral **Stock ↔ Spicy** language everywhere. No green-check / red-X, no "score out of 100" phrasing. Field rank reads as "More stock than 63%", not "P63". High is not "good."

### D4b — Rated basis & re-tuned bands (revision, post-live-review)
Live EDHREC data revealed two problems the mock hid: (1) the commander JSON only publishes ~300 *notable* cards, so most deck cards are **unrated**; the original "unknown = 0% spice" rule dumped them all into spice and washed out the signal. (2) Real inclusion rarely clears 90%, so a 90% "staple" band sits near-empty. Revised:
- **Unrated cards are excluded** from bands/coverage/spice/mean, not counted as 0% spice. The result carries `ratedCount`/`unratedCount`, surfaced as a "based on N of M cards EDHREC rates" basis line. The Crucible lens gets a dedicated **Unrated** group.
- **New `insufficient` status** when fewer than `MIN_RATED_CARDS` (10) deck cards are rated — the panel refuses to render a misleading read and explains why.
- **Bands re-tuned to real inclusion:** Staple ≥60%, Standard 30–60%, Niche 10–30%, Spice <10%.

### D4c — Dedicated reading page (revision)
Live use showed the woven-in placement (overview panel + heat list on `/reading/cards`) gave no way to *return* to the meta read while navigating a reading. Added a first-class **`/reading/meta`** sub-route with a sidebar nav entry ("Meta", Deck group) — the full analysis (panel + bands + heat list) now has a home reachable anytime. The heat list moved off `/reading/cards` (removing the duplicate card listing) onto this page; the overview keeps the glance panel.

### D5 — Exclusions & normalization
Exclude basic lands and the commander(s) from all rollups. Card-name matching between EDHREC's list and deck names reuses the case-insensitive + DFC-front-face (`" // "` split) + `flavor_name` normalization already used in `deck-enrich/route.ts`. The commander slug reuses the existing slugifier extracted from `buildEdhrecUrl` in `commander-validation.ts` (`atraxa-praetors-voice` form).

### D6 — Field percentile without a full corpus
EDHREC does not hand us the distribution of *deck* stock-ness. Approximate: treat the commander's own inclusion vector as the field baseline and map the deck's mean inclusion to a percentile against the commander's card-inclusion distribution. Documented in-code as an approximation; the lens copy says "vs the field" not a precise claim. (If this proves misleading in review, `percentile` can be dropped without touching `coverage`/`mean`.)

### D7 — Failure states (each e2e-tested)
| State | Trigger | UI |
|---|---|---|
| `no-data` | EDHREC has no page for the commander (404 / empty list) | Dashed "No meta read yet" empty panel |
| `error` | fetch throw / timeout / non-OK | "Couldn't reach EDHREC" `Card` + Retry `Button`; rest of reading unaffected |
| `thin` | `potential_decks < 100` | Score shown but dimmed with a "Low confidence · N decks" caveat |

### D8 — Multi-commander fallback (with a source-provenance badge)
Resolution order, badged so provenance is visible: **pair page** (slug `commander-a-commander-b`) → **combine** two single-commander lists (a card's inclusion = max of its per-commander rates) → **primary only** with a "based on {name}" caveat → **suppress** (`no-data`) when there is no commander (early Crucible pile).

### D9 — Data source & cache
Server-side route `POST /api/deck-meta` fetches `https://json.edhrec.com/pages/commanders/<slug>.json`, mirroring the fetch-and-degrade shape of `deck-combos/route.ts` (200 with an `error` field on failure, never throws to the client for `no-data`). A module-scoped `Map<slug, { data, expires }>` cache with a **24h TTL** avoids re-fetching per navigation. Scryfall-style request headers (User-Agent) and a 10s `AbortSignal.timeout`.

## Algorithm Design

Types (in `src/lib/edhrec-meta.ts`):
```ts
type MetaBand = "staple" | "standard" | "niche" | "spice";
type MetaSource = "pair" | "combined" | "primary";
type MetaStatus = "ok" | "thin" | "no-data" | "error";

interface CardInclusion { name: string; inclusion: number; band: MetaBand } // inclusion 0..1
interface DeckMetaResult {
  status: MetaStatus;
  source: MetaSource | null;
  commanderLabel: string;      // e.g. "Atraxa, Praetors' Voice" or "Thrasios + Tymna"
  potentialDecks: number;      // sample size for the confidence gate
  cards: CardInclusion[];      // one per scored (non-land, non-commander) deck card
  coverage: { pct: number; have: number; of: number };   // D1 staple coverage
  spiceCount: number;                                     // D1
  meanInclusion: number;                                  // mean lens
  fieldPercentile: number;                                // D6, 0..100
  bandCounts: Record<MetaBand, number>;                   // D3
}
```

Rollup steps (pure, given an EDHREC inclusion map + the deck):
1. Build `inclusionByName` from the EDHREC payload (normalize names per D5).
2. `scored` = deck mainboard cards minus basic lands minus commander(s).
3. For each `scored` card: `inclusion = inclusionByName[normalize(name)] ?? 0`; assign `band` per D3.
4. `coverage`: take EDHREC's top-30 by inclusion → `have` = how many are in `scored` → `pct = have/of`.
5. `spiceCount` = count of `inclusion < 0.10`.
6. `meanInclusion` = mean of `scored` inclusions.
7. `fieldPercentile` per D6.
8. `bandCounts` = tally by band.
9. `status`: `no-data` if the map is empty; else `thin` if `potentialDecks < 100`; else `ok`. (`error` is set by the fetch layer, not the rollup.)

Label copy (pure, for the headline): `coverage` → "{pct}% coverage · {spiceCount} spice"; `percentile` → "More stock than {fieldPercentile}%"; `mean` → "{mean}% mean inclusion". A `stockSpicyLabel(pct)` returns the italic descriptor ("Tuned, with spice", etc.).

## Implementation Tasks

### Phase 1: Write Tests (TDD)

- [x] 1.1 Create `tests/unit/edhrec-meta.spec.ts` covering the pure rollup + label helpers (use `makeCard`/`makeDeck` from `tests/helpers.ts`; follow `crucible-grouping.spec.ts` style).
  - `computeDeckMeta` excludes basic lands and commander(s) from `scored`.
  - Unknown card (not in EDHREC map) → `inclusion: 0`, `band: "spice"`, counts toward `spiceCount`.
  - Band boundaries: 0.90→staple, 0.899→standard, 0.50→standard, 0.10→niche, 0.099→spice.
  - `coverage` uses top-30: deck running 22 of the top-30 → `{ have: 22, of: 30, pct: 0.73 }` (rounding rule asserted).
  - `meanInclusion` correct over scored set; empty map → `status: "no-data"`.
  - `potentialDecks: 42` → `status: "thin"`; `12000` → `status: "ok"`.
  - `metaHeadline(result, lens)` returns the right string per lens; `stockSpicyLabel` thresholds.
- [x] 1.2 Create `tests/unit/edhrec-slug.spec.ts` for the extracted slugifier + multi-commander resolution planning.
  - `commanderSlug("Atraxa, Praetors' Voice") === "atraxa-praetors-voice"`.
  - `pairSlug(["Thrasios, Triton Hero","Tymna the Weaver"])` sorted/joined form.
  - `mergeInclusionMaps` uses max of per-commander rates (D8 combine).
- [x] 1.3 Create `tests/unit/crucible-grouping-meta.spec.ts` (or extend `crucible-grouping.spec.ts`) for `groupByMeta(pool, cardMap, inclusionMap)` → Staples / Flex / Spice `CrucibleGroup[]`, following the existing `AxisGroup` shape and `withUnresolved` pattern.
- [x] 1.4 Add e2e specs `e2e/reading-meta.spec.ts` and `e2e/crucible-meta.spec.ts` (import from `./fixtures`; add a default `/api/deck-meta` mock to `e2e/fixtures.ts`, plus `useLiveMeta()` opt-in mirroring `useLiveCombos`).
  - Reading hero shows the Stock↔Spicy stat; lens switch updates the readout.
  - `/reading/cards` shows per-card inclusion + sort (spicy→stock) + filter (spice-only).
  - Card art appears on row hover/focus (reuse `crucible-card-preview` testid pattern).
  - **Failure states:** mock 404 → `no-data` panel; mock 500 → `error` card + Retry; mock `potential_decks: 42` → `thin` dimmed readout.
  - Crucible: Meta lens is present in the switcher, **off by default**, and selecting it regroups into Staples/Flex/Spice.

### Phase 2: Data layer

- [x] 2.1 Extract the slugifier from `buildEdhrecUrl` (`src/lib/commander-validation.ts`) into an exported `commanderSlug(name)` / `pairSlug(names)`; keep `buildEdhrecUrl` using it (no behavior change).
- [x] 2.2 Create `src/lib/edhrec-meta.ts` — pure module: types above, `computeDeckMeta(deck, inclusionMap, potentialDecks, source)`, `mergeInclusionMaps`, `metaHeadline`, `stockSpicyLabel`, band helpers. No fetch here (keep it unit-testable).
- [x] 2.3 Create `src/app/api/deck-meta/route.ts` via the `add-api-route` skill. `POST { commanders: string[] }` → resolves per D8 (pair → combine → primary), fetches `json.edhrec.com`, parses the cardlist into `{ inclusionMap, potentialDecks, source, commanderLabel }`, returns 200 with `{ status, error? }` on failure (never throws). Module-scoped `Map` cache, 24h TTL (D9). Scryfall-style headers + 10s timeout.

### Phase 3: Session wiring

- [x] 3.1 Add a nullable `deckMeta: DeckMetaResult | null` to `DeckSessionPayload` (`src/lib/deck-session.ts`), mirroring `spellbookCombos`; bump/verify the sessionStorage codec tolerates the new optional field.
- [x] 3.2 In `src/contexts/DeckSessionContext.tsx`, add an effect + reducer action that calls `/api/deck-meta` after enrichment resolves (parallel to combos), storing the result and a `metaLoading`/`metaError` flag; expose them from `useDeckSession()`.

### Phase 4: Reading UI (layers A + C + B)

- [x] 4.1 Create `src/components/reading/MetaLensSwitcher.tsx` (`coverage`/`percentile`/`mean`) reusing the `Button`/`aria-pressed` pattern from `crucible/LensSwitcher.tsx`; local selected state only.
- [x] 4.2 Layer A — add a **Stock ↔ Spicy** `StatTile` to `ReadingHero.tsx` (fed by `deckMeta` + selected lens via 4.1). Handle `no-data`/`error`/`thin` inline (dim + caveat for `thin`). No new gauge component (reuse `StatTile` per design-system rules).
- [x] 4.3 Layer C — create `src/components/reading/MetaBands.tsx` (+ `.module.css`, semantic tokens only): the stacked distribution bar with band counts, reusing `Tag`/`Eyebrow`. Render it in `ReadingOverview.tsx` (as a tile or hero-adjacent panel) and add a `SECTION_TILES`-style entry if surfaced as a tile.
- [x] 4.4 Layer B — extend `src/components/DeckList.tsx` / `EnrichedCardRow.tsx`: an inclusion cell (bar + %) per row, a sort control (spicy→stock / stock→spicy / name) and a band filter on `cards/page.tsx`, and card art on hover/focus reusing the `CrucibleCardRow` preview pattern (`imageUris.normal`, `role="tooltip"`, testid). Guard everything behind `deckMeta?.status === "ok" | "thin"`.
- [x] 4.5 Failure-state components: `src/components/reading/MetaEmptyState.tsx` (`no-data`) and `MetaErrorState.tsx` (`error` + Retry that re-dispatches the context fetch). Reuse `Card`/`Button`.

### Phase 5: Crucible lens

- [x] 5.1 Add `groupByMeta(pool, cardMap, inclusionMap)` to `src/lib/crucible-grouping.ts` → Staples/Flex/Spice groups (+ unresolved bucket for cards with no enrichment), following `groupBySynergyAxis` conventions.
- [x] 5.2 Add a `meta` key to `CrucibleLens` and an entry to the `LENSES` array in `crucible/LensSwitcher.tsx` (off by default — default stays `category`).
- [x] 5.3 In `CrucibleWorkbench.tsx`, dispatch `groupByMeta` when `active === "meta"`, fetching/reusing the commander's inclusion map from `/api/deck-meta` (Crucible has its own session; fetch on lens-select, cache in Crucible context). Show the source-provenance badge and the `no-data` state when the pile has no commander yet.

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `tests/unit/edhrec-meta.spec.ts` | Create | Rollup + label unit tests |
| `tests/unit/edhrec-slug.spec.ts` | Create | Slug + merge unit tests |
| `tests/unit/crucible-grouping-meta.spec.ts` | Create | `groupByMeta` tests |
| `e2e/reading-meta.spec.ts` | Create | Reading hero/cards + failure-state e2e |
| `e2e/crucible-meta.spec.ts` | Create | Crucible Meta lens e2e |
| `e2e/fixtures.ts` | Modify | Default `/api/deck-meta` mock + `useLiveMeta()` |
| `src/lib/edhrec-meta.ts` | Create | Pure metric/rollup module |
| `src/lib/commander-validation.ts` | Modify | Extract `commanderSlug`/`pairSlug` |
| `src/app/api/deck-meta/route.ts` | Create | EDHREC fetch + TTL cache + fallback |
| `src/lib/deck-session.ts` | Modify | Add `deckMeta` to payload + codec |
| `src/contexts/DeckSessionContext.tsx` | Modify | Fetch + expose `deckMeta`/`metaLoading` |
| `src/components/reading/ReadingHero.tsx` | Modify | Stock↔Spicy StatTile |
| `src/components/reading/ReadingOverview.tsx` | Modify | Render MetaBands / tile |
| `src/components/reading/MetaLensSwitcher.tsx` | Create | coverage/percentile/mean toggle |
| `src/components/reading/MetaBands.tsx` (+ `.module.css`) | Create | Distribution bands |
| `src/components/reading/MetaEmptyState.tsx` | Create | `no-data` panel |
| `src/components/reading/MetaErrorState.tsx` | Create | `error` + Retry |
| `src/app/reading/(shell)/cards/page.tsx` | Modify | Sort/filter controls |
| `src/components/DeckList.tsx` | Modify | Inclusion column + sort/filter wiring |
| `src/components/EnrichedCardRow.tsx` | Modify | Inclusion bar + hover art |
| `src/lib/crucible-grouping.ts` | Modify | `groupByMeta` |
| `src/components/crucible/LensSwitcher.tsx` | Modify | Add `meta` lens key |
| `src/components/crucible/CrucibleWorkbench.tsx` | Modify | Dispatch `groupByMeta`, fetch inclusion |

No changes to: `src/lib/scryfall.ts`, `src/lib/types.ts` (EnrichedCard is sufficient), `src/lib/view-tabs.ts` / `DeckSidebar.tsx` (no new route — woven in), `src/app/api/deck-enrich/route.ts`, `src/app/api/deck-combos/route.ts`, the ritual/share/goldfish/synergy routes, and `docs/plans/crucible-deck-builder.md`.

## Verification

1. `npm run test:unit` — all unit tests pass (rollup, slug/merge, grouping).
2. `npm run test:e2e` — all e2e tests pass, including the three failure states and the Crucible lens.
3. `npm run lint` — clean; grep the diff for `rgba(`, hex colors, and raw `<button class=` to confirm no design-system bypass.
4. `npm run build` — production build succeeds.
5. Manual smoke (per repo E2E-first rule): import the Atraxa sample deck → `/reading` shows a Stock↔Spicy stat; switch lenses and confirm the readout recomputes; open `/reading/cards`, sort spicy-first and confirm the pet card floats up, hover a row for art; force the failure states (temporarily point the route at a bad slug / offline) and confirm the empty, error, and thin panels; in `/crucible` with a commander chosen, select the Meta lens and confirm Staples/Flex/Spice grouping with a source badge, and that it is not selected by default.
