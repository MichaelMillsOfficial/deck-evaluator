# The Crucible - Deck-Building Workbench

## Context

Every existing route assumes a finished deck: the user imports a complete decklist on `/`, the ritual loader plays while enrichment runs, and `/reading` renders analysis of that fixed 100. The closest thing to candidate management, `/reading/add` backed by `PendingChangesContext`, is hard-wired to strict 1:1 add/cut swaps against a valid base deck. There is no way to start from an arbitrary pile of cards (a collection dump, a box of staples, 200+ candidates from a brainstorm) and work it down into a deck.

The Crucible is a new top-level route (`/crucible`) that accepts any number of cards, organizes them through multiple lenses built on the existing tag, synergy, composition, combo, and legality engines, and guides the user through triage (keep / cut / undecided per card) until they have a legal 100-card EDH deck. On finalize it builds a normal `DeckData` (kept cards as mainboard, cuts as sideboard), calls `setPayload` on the deck session context, and routes to `/ritual` so the existing reading journey takes over unchanged.

Scope decisions, locked during plan review:

- **In:** pile import (paste), chunked enrichment with the CosmicLoader ritual treatment, explicit commander picker, lenses (By Category, By Synergy Axis, By Type Line, By Mana Value, By Color Identity, Flat List, Game Changers), Insight panels (Charts, Combos in Pile, Suggested Cuts, Cut Pile), tracker rail (kept count, category health, combo status, legality checklist), collapsible/sticky category groups with row virtualization, hover/tap card image previews, "Seal the Deck" handoff.
- **Out (fast-follows, not v1):** share-a-pile URL, price/budget lens, Scryfall-backed "fill this gap" suggestions inside the Crucible, non-EDH formats.

## Design Decisions

### Naming and placement
**The Crucible** at top-level `/crucible`. `/reading`'s layout redirects to `/` when no session exists, so a pile cannot start there; a top-level route avoids carving exceptions into the redirect gate and the deck-centric sidebar. Handoff to the existing journey happens only at finalize, via `setPayload`.

### State model: a new context, not a retrofit
`PendingChangesContext` models 1:1 add/cut pairs against a valid base deck and enriches one card at a time; it is not a pool manager. The Crucible gets its own `CrucibleSessionContext` mirroring the `DeckSessionContext` patterns (hydration lifecycle `pending -> hydrated / absent`, sessionStorage persistence with try/catch, background enrichment kicked off on payload set).

Core state:

```ts
export type CrucibleCardStatus = "keep" | "cut" | "undecided";

export interface CrucibleSessionPayload {
  crucibleId: string;
  pool: DeckCard[];                                  // every imported card, quantity-aware
  statuses: Record<string, CrucibleCardStatus>;      // keyed by card name; default "undecided"
  commanders: string[];                              // 0-2, chosen in the workbench
  parseWarnings: string[];
  createdAt: number;
}
```

Runtime-only state in the context (not persisted): `cardMap: Record<string, EnrichedCard> | null`, `notFound: string[]`, `combos` (from `/api/deck-combos`), plus memoized derived data (tag cache via `buildTagCache`, per-lens groupings, kept-subset scorecard, legality result, cut suggestions). Persistence key: `astral.crucible-session.v1`, separate from the reading session so both coexist in one tab.

### Cuts are status flips, never deletions
A cut row stays in place, dimmed, in whatever lens is active, and also collects in the Cut Pile lens where one click restores it. Finalize stores cuts as the sideboard so `/reading` and `/reading/add` still see them as candidates.

### Pile parsing
Reuse `parseDecklist` (`src/lib/decklist-parser.ts`) but flatten its inferred commanders back into the pool: its "trailing 1-2 cards are the commander" heuristic misfires on plain piles. Commander choice is explicit in the workbench via a picker that lists legal commanders detected in the pool (`isLegalCommander`) with a `CardSearchInput` fallback.

### Enrichment
`POST /api/deck-enrich` rejects more than 250 unique names per request. The context chunks the pool into batches of at most 250 names, issues them sequentially, and merges `cards`/`notFound`. While enrichment runs, the Crucible plays the same `CosmicLoader` ritual treatment as a normal reading, with chunk progress feeding the incantation line.

### Synergy on a pile
`analyzeDeckSynergy` takes a `DeckData`; the Crucible feeds it a synthetic one (chosen commanders + pool as mainboard). Before a commander is chosen, per-card axis scores still work (each axis `detect(card)` is commander-independent); anchor boosts and off-identity flagging activate after the pick via `resolveCommanderIdentity` + per-card `colorIdentity`.

### Lens grouping rules
- **By Category:** tag-driven groups from `computeCompositionScorecard` against `TEMPLATE_COMMAND_ZONE` over the kept subset; groups show candidates/kept/target with a health bar. Groups at target auto-collapse; headers stick on scroll; rows virtualize past ~200 cards.
- **By Synergy Axis:** axes sorted by pool-wide strength; only axes with strength >= 0.2 get a group; each card appears once under its strongest axis with a "+N axes" badge for its other homes; an "Unaligned" group gathers cards with no axis >= 0.2 (prime cut candidates).
- **Game Changers:** cards flagged `isGameChanger` (list served by `/api/commander-rules`), with kept count shown against the deck's bracket allowance.
- **Charts:** mana curve and color pip coverage over the kept subset via existing `computeManaCurve` / `computeColorDistribution` / `computeManaBaseMetrics` and the `CurveConstellation` / `ColorPie` components, with a kept-vs-pool toggle.
- **Combos in Pile:** `/api/deck-combos` runs once over the full pool; each combo derives a live state from triage statuses: intact (all pieces kept), possible (pieces undecided/in pool), broken (a piece cut, with restore affordance). Cutting a combo piece warns inline in any lens.
- **Suggested Cuts:** ranked list with reason chips (low synergy score, off-identity, category overfull, curve glut), following the weak-card scoring approach of `card-suggestions.ts` (`WEAK_CARD_THRESHOLD`) and `analyzeCandidateCard`. Suggestions only mark status; nothing is cut without a click.

### Legality gate
`GET /api/commander-rules` supplies the banned list and game-changer names; `validateCommanderDeck` over (commanders + kept) is the enable condition for "Seal the Deck". The tracker rail shows the checklist: commander chosen, exactly 100, singleton, no banned cards, no off-identity kept cards.

## Implementation Tasks

### Phase 1: Core lib (TDD)

- [x] 1.1 Create `tests/unit/crucible-session.spec.ts`
  - Test case: `createCrucibleSession(pool, warnings)` returns payload with all statuses defaulting to "undecided" and a generated id
  - Test case: `setCardStatus(payload, name, status)` returns a new payload (immutability) with the status flipped
  - Test case: `keptCards(payload)` / `cutCards(payload)` / `undecidedCards(payload)` partition the pool correctly, quantity-aware
  - Test case: `keptCount` counts quantities, not unique names
  - Test case: `buildFinalDeck(payload, name)` produces `DeckData` with commanders, kept mainboard (commanders excluded), cuts as sideboard, source "text"
  - Test case: serialize/deserialize round-trip drops nothing and tolerates corrupt JSON (returns null)
  - Test case: `flattenPileParse(parsed)` folds parser-inferred commanders back into the pool
- [x] 1.2 Create `src/lib/crucible-session.ts` implementing the above
  - Follow the codec/guard patterns in `src/lib/deck-session.ts` (SESSION_KEY constant, try/catch storage access)
- [x] 1.3 Create `tests/unit/crucible-grouping.spec.ts`
  - Test case: `groupByCategory` uses tag cache; untagged cards land in an "Uncategorized" group
  - Test case: `groupBySynergyAxis` assigns each card to its strongest axis only; axes below 0.2 pool strength excluded; unaligned bucket collects the rest; `otherAxes` lists secondary homes
  - Test case: `groupByTypeLine` / `groupByManaValue` (buckets 0-1, 2, 3, 4, 5, 6, 7+) / `groupByColorIdentity` bucket correctly, including multicolor and colorless
  - Test case: `gameChangers` filter uses `isGameChanger`
  - Test case: groups are stable-sorted (by kept-relevance desc, then name) so UI order does not jitter on status flips
- [x] 1.4 Create `src/lib/crucible-grouping.ts` implementing the above
  - Reuse `buildTagCache`/`getTagsCached` from `src/lib/card-tags.ts` and `SYNERGY_AXES` from `src/lib/synergy-axes.ts`
- [x] 1.5 Create `tests/unit/cut-suggestions.spec.ts`
  - Test case: off-identity cards rank as cut suggestions once commanders are set
  - Test case: cards below the weak-synergy threshold rank with reason "low synergy"
  - Test case: overfull categories (kept > target max) suggest their lowest-scoring members with reason "category overfull"
  - Test case: kept commanders and cards already cut are never suggested
  - Test case: dismissed suggestions are excluded
- [x] 1.6 Create `src/lib/cut-suggestions.ts` implementing `suggestCuts(payload, cardMap, synergy, scorecard, dismissed): CutSuggestion[]`
  - Follow the scoring approach in `src/lib/card-suggestions.ts` (`WEAK_CARD_THRESHOLD`) and reuse `analyzeCandidateCard` from `src/lib/candidate-analysis.ts` where applicable

### Phase 2: Context

- [x] 2.1 Create `src/contexts/CrucibleSessionContext.tsx`
  - Hydration lifecycle `pending -> hydrated / absent` mirroring `DeckSessionContext`
  - `setPile(pool, warnings)` persists and kicks off chunked enrichment (batches of <= 250 unique names against `POST /api/deck-enrich`, merged results, progress state for the loader) and a single `POST /api/deck-combos` over the full pool
  - `setStatus(name, status)`, `setCommanders(names)`, `restore(name)`, `finalize()` helpers
  - Memoized derived state: tag cache, per-lens groupings, kept-subset scorecard (`computeCompositionScorecard` with `TEMPLATE_COMMAND_ZONE`), legality (`validateCommanderDeck` fed by `/api/commander-rules`), cut suggestions

### Phase 3: Route and import

- [ ] 3.1 Create `e2e/crucible-import.spec.ts` (failing first)
  - Test case: `/crucible` renders the pile import form with the sacred eyebrow pattern
  - Test case: pasting a pile and submitting shows the CosmicLoader treatment, then the workbench with the full pool as undecided
  - Test case: a pile whose trailing card would be commander-inferred still lands fully in the pool
  - Test case: reloading mid-triage restores statuses from sessionStorage
- [ ] 3.2 Create `src/app/crucible/page.tsx` + `src/components/crucible/CrucibleImport.tsx`
  - Reuse `Textarea`, `Button`, `Card`, `SectionHeader` patterns; parse via `POST /api/deck-parse` then `flattenPileParse`
  - Reuse `CosmicLoader` during enrichment with chunk progress in the incantation line
- [ ] 3.3 Add a Crucible entry to the top nav in `src/components/shell/`

### Phase 4: Workbench

- [ ] 4.1 Create `e2e/crucible-triage.spec.ts` (failing first)
  - Test case: keep/cut/undecided toggles update the row state and the kept counter
  - Test case: cut rows stay visible dimmed; Cut Pile lens lists them; restore flips them back
  - Test case: lens switching regroups without losing statuses
  - Test case: category groups collapse/expand; at-target groups start collapsed; "Undecided only" filter hides decided rows
  - Test case: commander picker lists legal commanders from the pool; picking one flags off-identity cards
  - Test case: hovering a card name reveals its image preview (aria-safe)
- [ ] 4.2 Create `src/components/crucible/CrucibleWorkbench.tsx`, `LensSwitcher.tsx`, `CrucibleCardRow.tsx`, `CommanderPicker.tsx`, `CutPile.tsx`
  - `CrucibleCardRow` wraps the disclosure/a11y patterns of `EnrichedCardRow` and adds the triage buttons and image preview (from `EnrichedCard.imageUris`; `Sheet` on touch)
  - Collapsible groups with sticky headers; virtualize rows past ~200 cards
  - All styling via semantic tokens; reduced-motion gates on any transition

### Phase 5: Insight panels

- [ ] 5.1 Create `e2e/crucible-insight.spec.ts` (failing first)
  - Test case: Charts lens renders curve and pip coverage for the kept subset and toggles to pool
  - Test case: Combos lens shows intact/possible/broken states that react to triage flips
  - Test case: cutting a combo piece surfaces the broken warning; restore clears it
  - Test case: Suggested Cuts lists ranked reasons; accepting marks the card cut; dismissing hides the suggestion
  - Test case: Game Changers lens lists flagged cards with kept count vs bracket allowance
- [ ] 5.2 Create `src/components/crucible/CrucibleCharts.tsx`, `CrucibleCombos.tsx`, `SuggestedCuts.tsx`
  - Charts reuse `CurveConstellation` / `ColorPie` / `computeManaCurve` / `computeColorDistribution` / `computeManaBaseMetrics`

### Phase 6: Tracker and gate

- [ ] 6.1 Create `e2e/crucible-legality.spec.ts` (failing first)
  - Test case: rail shows kept count, category health bars, combo status, legality checklist
  - Test case: "Seal the Deck" stays disabled until `validateCommanderDeck` passes over commanders + kept
  - Test case: below 768px the rail renders inside the `Sheet` drawer
- [ ] 6.2 Create `src/components/crucible/TrackerRail.tsx`
  - Reuse `StatTile`, `Tag`, `Sheet`; legality via `validateCommanderDeck` + `/api/commander-rules`

### Phase 7: Handoff

- [ ] 7.1 Create `e2e/crucible-handoff.spec.ts` (failing first)
  - Test case: sealing builds the DeckData (kept mainboard, cuts sideboard), sets the reading payload, and lands on `/reading` via `/ritual` (use `window.__SKIP_RITUAL_FLOOR__`)
  - Test case: the reading session reflects the sealed deck; `/reading/add` sees cuts as sideboard
- [ ] 7.2 Wire `finalize()` in `CrucibleWorkbench` to `buildFinalDeck` + `setPayload` + router push; no reading-side changes

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `docs/plans/crucible-deck-builder.md` | Create | This plan |
| `src/lib/crucible-session.ts` | Create | Pile session model, statuses, codec, final-deck builder |
| `src/lib/crucible-grouping.ts` | Create | Lens grouping functions |
| `src/lib/cut-suggestions.ts` | Create | Ranked cut recommender |
| `src/contexts/CrucibleSessionContext.tsx` | Create | Hydration, chunked enrichment, combos fetch, derived state |
| `src/app/crucible/page.tsx` | Create | Route: import form -> loader -> workbench |
| `src/components/crucible/CrucibleImport.tsx` | Create | Pile paste form |
| `src/components/crucible/CrucibleWorkbench.tsx` | Create | Three-pane workbench shell |
| `src/components/crucible/LensSwitcher.tsx` | Create | Lens/filter sidebar |
| `src/components/crucible/CrucibleCardRow.tsx` | Create | Triage row with preview + disclosure |
| `src/components/crucible/CommanderPicker.tsx` | Create | Legal-commander picker + search fallback |
| `src/components/crucible/CutPile.tsx` | Create | Cut list with restore |
| `src/components/crucible/CrucibleCharts.tsx` | Create | Curve + pip coverage panel |
| `src/components/crucible/CrucibleCombos.tsx` | Create | Combo states panel |
| `src/components/crucible/SuggestedCuts.tsx` | Create | Ranked cut suggestions panel |
| `src/components/crucible/TrackerRail.tsx` | Create | Count, health, legality, seal button |
| `src/components/shell/` (top nav) | Modify | Add Crucible nav entry |
| `tests/unit/crucible-session.spec.ts` | Create | Phase 1 unit tests |
| `tests/unit/crucible-grouping.spec.ts` | Create | Phase 1 unit tests |
| `tests/unit/cut-suggestions.spec.ts` | Create | Phase 1 unit tests |
| `e2e/crucible-import.spec.ts` | Create | Phase 3 e2e |
| `e2e/crucible-triage.spec.ts` | Create | Phase 4 e2e |
| `e2e/crucible-insight.spec.ts` | Create | Phase 5 e2e |
| `e2e/crucible-legality.spec.ts` | Create | Phase 6 e2e |
| `e2e/crucible-handoff.spec.ts` | Create | Phase 7 e2e |

No changes to: `src/app/reading/**`, `src/contexts/DeckSessionContext.tsx`, `src/contexts/PendingChangesContext.tsx`, `src/lib/deck-session.ts`, `src/lib/view-tabs.ts`, existing API routes, `design-system/tokens.css`.

## Verification

1. `npm run test:unit` - all unit tests pass
2. `npm run test:e2e` - all e2e tests pass
3. `npm run build` - production build succeeds
4. `npm run lint` - clean
5. Manual: paste a 150+ card pile on `/crucible`, watch the ritual loader, pick a commander, triage across every lens (including Charts, Combos, Suggested Cuts, Cut Pile, Game Changers), confirm the rail's legality checklist gates "Seal the Deck", seal, and verify the full reading journey renders the sealed deck with cuts as sideboard
