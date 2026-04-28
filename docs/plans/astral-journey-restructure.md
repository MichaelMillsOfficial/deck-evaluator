# Astral Journey Restructure

## Context

The Astral design system migration is complete at the surface level — every slate
Tailwind module has been swapped for semantic tokens, fonts, and primitives. But
we adopted only the *tone* of the design system, not its *journey*. The handoff
in `design-system/CLAUDE.md` and `design-system/README.md` describes a deliberate
narrative arc — **Import → Loading ritual → Reading (verdict-first) → Drill-down
sub-routes** — that the current app does not deliver. Today the user pastes a
deck and is dropped into a single long scrolling page with 12 collapsible
analysis panels and no synthesis moment.

This plan reworks the app to match the design system's journey:

- A dedicated import screen at `/`
- A cosmic `/loading` ritual with a minimum visible floor
- A verdict-first `/reading` landing — eyebrow, serif deck name, italic
  tagline, power dial, headline stat tiles — using the already-built but
  unused `<DeckHero>` primitive
- Real sub-routes for every drill-down: `/reading/cards`, `/reading/goldfish`,
  `/reading/suggestions`, `/reading/add`, `/reading/compare`, `/reading/share`
- Editorial header pattern (eyebrow + serif title + italic tagline) on every
  sub-route, matching the design-system rhythm

The vision is the full look-and-feel refresh promised by the design system, not
just the surface tokens. All sub-routes are in scope — compare, add, and share
are first-class deliverables, not stubs.

### User decisions captured up-front

- **Deck state across routes**: persist parsed + enriched deck to
  `sessionStorage`, keyed by a deck id. A refresh on `/reading/cards` rehydrates
  rather than kicking back to `/`. Cleared on explicit "new reading."
- **Loading screen**: real ritual with a **minimum floor of ~2s** — if analysis
  finishes faster, the loader keeps animating until the floor elapses; if it
  takes longer, the loader stays visible until done. The 12s figure in the
  design system is the *prototype* upper bound, not a target.
- **Scope**: full rework. `/reading/compare`, `/reading/add`,
  `/reading/share` are all in scope, not deferred.

## Phased delivery

Each phase ships as one PR (or a small parallelizable cluster), is merged
independently, and leaves the app in a working state. Per established pattern:
branch off `master` per phase, open PR, merge, pull, continue.

### Phase 1 — Routing skeleton & shared deck store

Move the existing results UI under `/reading` without changing visuals. Set
up the shared deck store and route shell.

- [ ] Create `src/lib/deck-session.ts` — typed sessionStorage helpers
  (`saveDeckSession`, `loadDeckSession`, `clearDeckSession`) keyed by a
  generated deck id. Stores `{ deck, cardMap, analysisResults, spellbookCombos,
  createdAt }`.
- [ ] Create `src/contexts/DeckSessionContext.tsx` — React context that
  hydrates from sessionStorage on mount, exposes deck + cardMap + analysis
  results to descendants, and re-renders consumers on session change.
- [ ] Create `src/app/reading/layout.tsx` — wraps children in
  `DeckSessionProvider`; redirects to `/` if no session present.
- [ ] Create `src/app/reading/page.tsx` — temporary stub that renders the
  *current* full results view (everything from today's `page.tsx` post-import).
  Visual parity with today.
- [ ] Update `src/app/page.tsx` — strip the post-import results view; on
  successful import, save to sessionStorage and `router.push("/reading")`.
- [ ] Convert sidebar section nav from in-page anchors to `<Link>` routes
  (placeholder routes for now — they all resolve to `/reading` until Phase 4).
- [ ] Add Playwright e2e: import a deck, assert URL transitions to `/reading`,
  refresh page, assert deck still rendered (sessionStorage hydration).

**Files**

| File | Action |
|---|---|
| `src/lib/deck-session.ts` | Create |
| `src/contexts/DeckSessionContext.tsx` | Create |
| `src/app/reading/layout.tsx` | Create |
| `src/app/reading/page.tsx` | Create |
| `src/app/page.tsx` | Modify — remove results, push on submit |
| `src/components/DeckSidebar.tsx` | Modify — links instead of anchors |
| `e2e/reading-routing.spec.ts` | Create |

**Verification**: import a deck, observe URL becomes `/reading`, refresh,
deck persists; click sidebar items, URL updates; clear session via "new
reading" button, get redirected to `/`.

### Phase 2 — Loading ritual at `/loading`

Add the cosmic loader between import and reading, with a 2s minimum floor.

- [ ] Create `src/app/loading-ritual/page.tsx` (avoid Next's reserved
  `loading.tsx` filename — use a distinct route segment, e.g.
  `/reading/loading` or `/ritual`).
- [ ] Create `src/components/ritual/CosmicLoader.tsx` — full-bleed cosmos
  background, centered gradient orb pulsing on `--accent-gradient`, three
  staggered eyebrow phrases cycling: `DRAWING THE STARS`, `READING THE LANDS`,
  `COUNTING THE SIGNS`. Honors `prefers-reduced-motion` (static text + orb,
  no pulse).
- [ ] Update import submit flow: parse + enrich + analyze → save to
  sessionStorage with a `status: "ready"` flag → loader polls / subscribes,
  waits until both `status === "ready"` and `Date.now() - startedAt >= 2000`,
  then routes to `/reading`.
- [ ] If parse/enrich errors, save `status: "error"` with message; loader
  shows the existing alert pattern and a "back to import" button.
- [ ] Playwright e2e: import → URL is loading route briefly → eventually
  `/reading`. Use a polling assertion not a fixed sleep.

**Files**

| File | Action |
|---|---|
| `src/app/ritual/page.tsx` | Create |
| `src/app/ritual/ritual.module.css` | Create |
| `src/components/ritual/CosmicLoader.tsx` | Create |
| `src/components/ritual/CosmicLoader.module.css` | Create |
| `src/lib/deck-session.ts` | Extend with `status` field |
| `src/app/page.tsx` | Modify — push to `/ritual` not `/reading` |
| `e2e/loading-ritual.spec.ts` | Create |

**Verification**: import a deck, observe loader visible for at least 2s with
animated phrases; reduced-motion users see static loader; error states show
recover-friendly message.

### Phase 3 — Verdict-first `/reading` landing

Replace the temporary stub with the real DeckHero verdict screen — the
synthesis moment the design system was built around.

- [ ] Create `src/lib/deck-tagline.ts` — heuristic that synthesizes a one-line
  italic tagline from existing analysis: archetype/classification + power
  level + dominant synergy axis + win-condition count. Examples:
  "A landfall engine that wins decisively." / "A patient control shell with
  a single combo finish." / "Aggressive go-wide tokens, fragile to sweepers."
  Pure function, unit-tested.
- [ ] Create `src/components/reading/ReadingHero.tsx` — wraps `<DeckHero>`
  with deck name, tagline, READING eyebrow with date, power dial, and a
  StatTile row: bracket, power level, total cost, win-condition count.
- [ ] Create `src/components/reading/ReadingOverview.tsx` — the new `/reading`
  index. Above the fold: ReadingHero. Below: a short "what's inside" grid
  linking to each sub-route (cards, goldfish, suggestions, etc.) with a
  one-line summary per section.
- [ ] Replace `src/app/reading/page.tsx` stub with ReadingOverview.
- [ ] Move all existing collapsible analysis panels (commander, composition,
  mana curve, color distribution, etc.) into `/reading/cards` (Phase 4 will
  reorganize further; for this phase they're consolidated under `/cards`).
- [ ] Unit tests for `deck-tagline.ts` covering each archetype branch.
- [ ] Playwright e2e: `/reading` shows hero + stat tiles + section grid; each
  section link navigates to its sub-route; tagline matches expected pattern
  for sample fixtures.

**Files**

| File | Action |
|---|---|
| `src/lib/deck-tagline.ts` | Create |
| `src/components/reading/ReadingHero.tsx` | Create |
| `src/components/reading/ReadingHero.module.css` | Create |
| `src/components/reading/ReadingOverview.tsx` | Create |
| `src/components/reading/ReadingOverview.module.css` | Create |
| `src/components/DeckHero.tsx` | Modify — wire to ReadingHero if needed |
| `src/app/reading/page.tsx` | Replace stub with ReadingOverview |
| `src/app/reading/cards/page.tsx` | Create — host current panels |
| `tests/unit/deck-tagline.spec.ts` | Create |
| `e2e/reading-overview.spec.ts` | Create |

**Verification**: import a deck, land on `/reading`, see deck name in serif
display type, italic tagline, four stat tiles, section grid below; click any
section card, URL updates and detail loads.

### Phase 4 — Sub-route fan-out (parallelizable)

Each sub-route gets its own page with the editorial header pattern (eyebrow
+ serif title + italic tagline) and existing functionality migrated in. These
are independent enough to delegate to subagents in parallel via worktrees.

- [ ] **`/reading/cards`** — full card list. Today's `DeckList` +
  `EnrichedCardRow` move here. Header: `CARDS` eyebrow, "The Sixty-Three"
  (or count-aware) serif title, italic descriptive tagline.
- [ ] **`/reading/goldfish`** — host `GoldfishSimulator`. Header:
  `SIMULATION` eyebrow, "Goldfish Reading" title, italic tagline noting
  iteration count.
- [ ] **`/reading/suggestions`** — host `SuggestionsPanel` +
  `AdditionsPanel` summary. Header: `RECOMMENDATIONS` eyebrow, "What to
  Cut, What to Add" title.
- [ ] **`/reading/synergy`** — host `SynergySection` + `InteractionSection`
  (centrality, chains, loops). Header: `SYNERGIES` eyebrow, "How the Cards
  Read Together" title.
- [ ] **`/reading/composition`** — host the analysis panels currently in
  DeckAnalysis (mana curve, color dist, land efficiency, hypergeometric,
  budget). Header: `COMPOSITION` eyebrow, "The Shape of the Deck" title.
- [ ] **`/reading/compare`** — A vs B compare flow. Wire to existing
  `deck-comparison` infrastructure. Header: `COMPARE` eyebrow.
- [ ] **`/reading/add`** — candidate finder. Wire to existing
  `card-swap-suggestions` infrastructure. Header: `CANDIDATES` eyebrow.
- [ ] **`/reading/share`** — share card export (image + URL + copy). New
  build using existing analysis data. Header: `SHARE` eyebrow.
- [ ] Sidebar updates to highlight active route via `usePathname()`.
- [ ] Playwright e2e per route: header pattern present, key content renders,
  sidebar marks the active route.

**Files** (per sub-route, repeated)

| File pattern | Action |
|---|---|
| `src/app/reading/<slug>/page.tsx` | Create |
| `src/app/reading/<slug>/<slug>.module.css` | Create (if needed) |
| `src/components/reading/<Slug>Header.tsx` | Create — eyebrow+title+tagline |
| `e2e/reading-<slug>.spec.ts` | Create |

**Verification**: every sidebar entry resolves to its own URL; refresh on any
sub-route rehydrates from sessionStorage; every route renders the editorial
header; reduced-motion still honored.

### Phase 5 — Polish & retire legacy surfaces

- [x] Remove the old single-page results layout entirely. *(done in Phase 4 —
  `DeckReadingView` was renamed/refactored into `DeckReadingShell`.)*
- [x] Remove `DeckViewTabs` if it's been superseded by routing.
- [x] Update `design-system/CLAUDE.md` and `README.md` to reflect what was
  actually built — mark the journey items "done," update the route table.
- [ ] Lighthouse audit: each route ≥ 90 mobile Performance + Accessibility +
  Best Practices. *(deferred — needs a manual local run; not blocking.)*
- [x] Reduced-motion sweep across new components — ReadingOverview,
  DeckReadingShell, share page, sidebar/drawer, CosmicLoader, and
  CosmosBackground all gate on `prefers-reduced-motion: reduce`.
- [x] Update top-level CLAUDE.md with the new route map and data-flow notes.

**Verification**: no dead code paths, all e2e tests pass, reduced-motion
users get static experiences end-to-end.

## Files to create (summary)

| File | Phase |
|---|---|
| `src/lib/deck-session.ts` | 1 |
| `src/lib/deck-tagline.ts` | 3 |
| `src/contexts/DeckSessionContext.tsx` | 1 |
| `src/app/reading/layout.tsx` | 1 |
| `src/app/reading/page.tsx` | 1, 3 |
| `src/app/reading/cards/page.tsx` | 3, 4 |
| `src/app/reading/goldfish/page.tsx` | 4 |
| `src/app/reading/suggestions/page.tsx` | 4 |
| `src/app/reading/synergy/page.tsx` | 4 |
| `src/app/reading/composition/page.tsx` | 4 |
| `src/app/reading/compare/page.tsx` | 4 |
| `src/app/reading/add/page.tsx` | 4 |
| `src/app/reading/share/page.tsx` | 4 |
| `src/app/ritual/page.tsx` | 2 |
| `src/components/ritual/CosmicLoader.tsx` | 2 |
| `src/components/reading/ReadingHero.tsx` | 3 |
| `src/components/reading/ReadingOverview.tsx` | 3 |
| `src/components/reading/<Slug>Header.tsx` | 4 |
| `tests/unit/deck-tagline.spec.ts` | 3 |
| `e2e/reading-routing.spec.ts` | 1 |
| `e2e/loading-ritual.spec.ts` | 2 |
| `e2e/reading-overview.spec.ts` | 3 |
| `e2e/reading-<slug>.spec.ts` | 4 (per route) |

## Files to modify (summary)

| File | Phase | Reason |
|---|---|---|
| `src/app/page.tsx` | 1, 2 | Strip results, push to `/ritual` on submit |
| `src/components/DeckSidebar.tsx` | 1, 4 | Links + active route highlighting |
| `src/components/DeckHero.tsx` | 3 | Wire into ReadingHero |
| `design-system/CLAUDE.md` | 5 | Update journey items as done |
| `design-system/README.md` | 5 | Update route map |
| `CLAUDE.md` (project root) | 5 | New route map + data-flow notes |

## Risks & open questions

- **Reading hero tagline quality**: heuristic taglines can feel canned. If
  results aren't compelling, consider a small templated bank with archetype-
  + power-aware variants rather than generation. Re-evaluate after Phase 3
  user testing.
- **Compare flow**: existing comparison infrastructure (`deck-comparison.spec.ts`)
  expects current single-page layout. Phase 4 compare needs a dedicated audit
  to confirm the diff engine is reusable as-is.
- **Share card image export**: Phase 4 share is the only genuinely new
  capability — needs a sub-plan (canvas vs SVG vs server-side render).
  Consider promoting to its own plan doc before Phase 4 begins.
- **Sidebar collapse on sub-routes**: the current sidebar is built around
  in-page section nav. With routes, do we keep persistent sidebar across
  `/reading/*` (recommended) or collapse to top-tabs on narrow viewports?
  Confirm at Phase 1 start.
