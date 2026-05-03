# Enhance Additions UI: Pairing + Compare Handoff

> Implements GitHub issue [#119](https://github.com/MichaelMillsOfficial/deck-evaluator/issues/119).

## Context

The `/reading/add` route today is a one-way evaluator: a user types a card,
the app enriches it, and a `CandidateCardRow` shows synergy and a list of
"replacement candidates" (cards from the deck that could be cut for it).
There is no way to **commit** a swap. There is also no way to ask "what
would my deck look like with these three changes?" — `CandidatesContext`
holds candidates but nothing reads modified-deck state.

Issue #119 turns this into a **what-if staging tool**. The user adds a
card, picks a card to cut (either from suggested replacements or any card
in the deck), the change is staged 1:1, and once at least one swap is
committed they can press **Update Reading** to navigate to
`/reading/compare` (today a stub) and see a side-by-side comparison of
the original deck vs. the modified deck across seven panels: mana curve,
hand keepability, color analysis, bracket, power level, mana base score,
and composition scorecard. Of those seven, **four are not currently
rendered in the comparison utility** even though their computation
libraries already exist (`opening-hand.ts`, `bracket-estimator.ts`,
`power-level.ts`, `deck-composition.ts`).

Per user product decisions: pairings are strict 1:1 (one add ↔ one cut);
the cut may be any non-commander mainboard card (lands ok, sideboard not);
"Update Reading" stays inside the reading shell at `/reading/compare`;
that screen must allow manual decklist edits that flow back into the
shared store, so toggling between `/reading/add` and `/reading/compare`
never loses work; pending changes survive a page refresh via
sessionStorage. Per the issue: an unpaired add is **not** counted in the
modified deck — but the user is also not blocked from queuing one.

**In scope:** the `PendingChanges` data model + sessionStorage codec, the
shared pairing UI, the live `/reading/compare` page, the four missing
comparison panels, edit-from-compare drawer, and full e2e coverage.
**Out of scope:** changes to the deck-import journey, redesign of
`/compare` (standalone), enrichment caching, mobile-specific layouts
beyond what falls out of reusing existing responsive patterns, and any
backend persistence (sessionStorage only).

## Design Decisions

### D1. Single context, not two

`CandidatesContext` and the new pending-changes state are the same
entity (a list of "cards I'm considering, optionally paired with a
cut"). Keeping them split would create a synchronization bug factory
between `/reading/add` and `/reading/compare`. We collapse to one
context.

```ts
// src/contexts/PendingChangesContext.tsx
type PendingAdd = {
  name: string;
  enrichedCard?: EnrichedCard;
  analysis?: CandidateAnalysis;
  error?: string;
  pairedCutName?: string; // undefined = unpaired, ignored in modified deck
};

interface PendingChangesContextValue {
  adds: PendingAdd[];
  addCandidate: (name: string) => Promise<void>;
  removeCandidate: (name: string) => void;
  retryEnrich: (name: string) => Promise<void>;
  pairAdd: (addName: string, cutName: string) => void;
  unpairAdd: (addName: string) => void;
  clearAll: () => void;
  // derived (memoized)
  confirmedAdds: PendingAdd[];                  // pairedCutName !== undefined
  confirmedCutNames: Set<string>;                // for exclusion lists
  unpairedAddNames: Set<string>;
  buildModifiedDeck: (deck: DeckData) => DeckData;
}
```

`CandidatesContext` becomes a thin shim that re-exports
`useCandidates = () => { const { adds, addCandidate, removeCandidate,
retryEnrich } = usePendingChanges(); return ... }` to avoid touching
non-add callers in a single PR. The shim is removed in a follow-up
once all callers migrate.

### D2. SessionStorage codec

Single key, single source of truth. Versioned for forward compat.

```
key:    dev:pending-changes:v1
value:  { version: 1, deckId: string, adds: SerializedPendingAdd[] }
```

`deckId` is read from `DeckSession.deckId`; if it doesn't match the
currently-loaded deck, the store hydrates empty (you don't carry
swaps from a different deck). Enriched card and analysis fields are
NOT serialized — they re-fetch on rehydrate, exactly like
`DeckSessionContext` re-uses `cardMap` only when present.

### D3. Pairing UI: per-row pair zone, shared picker Sheet

The issue's flow is per-card ("user enters a card → we render
synergy/suggestions → user chooses what to cut"), so pairing is anchored
to the candidate row. To avoid spawning N parallel pickers (one per row)
we use a **single shared `<Sheet>`** that knows which add it's pairing
for via context state.

Row states:

| State | Visual | A11y |
|---|---|---|
| Unpaired | Eyebrow tag `NEEDS PAIRING` (mono uppercase, `var(--accent)`); full row visible with "Use a suggestion" inline list + "Pick from your deck" button | `aria-describedby` to a hidden help node explaining unpaired |
| Paired | Collapsed chip-pair button: `Adding {add} → Cutting {cut}` with subtle "Unpair" icon | Single button, `aria-label="Adding X, cutting Y. Activate to unpair."` |
| Enriching / errored | Existing spinner / retry pattern from `CandidateCardRow` | unchanged |

**Tailwind / token usage:**

| Element | Class / token |
|---|---|
| Eyebrow tag `NEEDS PAIRING` | `<Eyebrow tone="accent">NEEDS PAIRING</Eyebrow>` from `src/components/ui/Eyebrow.tsx` |
| Chip-pair button background | `bg-[var(--card-bg)] border border-[var(--border)]` |
| Cut emphasis | `text-[var(--accent)]` for the cut-name span only |
| Pair zone container | `<Card>` from `src/components/ui/Card.tsx` — never raw `rounded-xl bg-slate-800/50` |
| Picker drawer | `<Sheet>` from `src/components/ui/Sheet.tsx`, `side="right"` |
| Live region | reuse the `sr-only role="status" aria-live="polite"` pattern at `src/components/reading/DeckReadingShell.tsx:234` |

**Color conventions:** match `CandidateCardRow.tsx:38–44` — emerald for
positive deltas (better synergy, better mana base), amber for neutral
warnings (color shift), red for regressions.

### D4. Update Reading CTA behavior

Lives in `SectionHeader` stats row on `/reading/add`. Copy:

- 0 confirmed pairings: button **disabled**, label `Update Reading`,
  hint `Pair at least one add with a cut to compare`.
- ≥1 confirmed: button **enabled**, label `Update Reading (N)` where
  N = `confirmedAdds.length`, with a sublabel `K unpaired waiting`
  if there are unpaired adds (so the user isn't surprised).
- Unpaired adds **never block** the CTA — they just don't apply.

Click → `router.push('/reading/compare')`. The shell stays mounted; the
context survives the route change.

### D5. /reading/compare three modes

The page handles three states:

1. **Has pending changes** (issue #119 path): render
   `OriginalVsModifiedComparison` — slot A = `DeckSession.deck`,
   slot B = `buildModifiedDeck(deck, adds)`. Show **all 7 panels**.
   Show `Edit modified deck` button → opens `EditModifiedDeckSheet`.
2. **Has session deck, no pending changes**: render an empty state
   with two CTAs: "Stage some adds at /reading/add" or "Compare two
   imported decks (existing standalone behavior)".
3. **No session deck**: redirect to `/` (already enforced by
   `/reading/layout.tsx`).

Mode 1 is the new primary path. Mode 2/3 preserve existing flows.

### D6. EditModifiedDeckSheet writes to PendingChangesContext

When the user removes a card from the modified deck on `/reading/compare`:
- If that card is an `add` (i.e. came from a pending pair): remove the
  entire pending-changes entry (un-stage the add and its paired cut).
- If that card is from the original mainboard: synthesize a new pending
  add with no `name` to add (it's a pure cut) — except we don't allow
  that under strict 1:1. **Resolution:** the sheet only allows removing
  pending **adds** (i.e. cards introduced by swaps). To "cut more cards",
  the user adds a new card on `/reading/add` and pairs it with the cut
  they want. This honors strict 1:1 and avoids ghost-cut state.

When the user adds a card from the sheet's search:
- The add is created with a **prompt to pair** — the sheet routes them
  to the pair flow (open `PairWithCutSheet` immediately, prefilled
  with the new add). They select a cut, both sheets close, the add
  appears in `confirmedAdds`.

This is a tight constraint but matches the issue's strict 1:1 rule and
keeps `EditModifiedDeckSheet` from becoming a second editor competing
with `/reading/add`.

### D7. Accessibility recipe (load-bearing)

- Each pending row is `<li>` inside `<ul aria-label="Pending additions">`.
- Pair button opens `<Sheet>` (already focus-trapped with Escape +
  focus-restore — verify in tests).
- After `pairAdd`, fire `aria-live="polite"` announcement: e.g.
  `"Sol Ring paired with Mind Stone. 2 of 4 additions paired."`
- After `unpairAdd`: `"Sol Ring unpaired. 1 of 4 additions paired."`
- Chip-pair is **one** button, not two adjacent (no "where am I" tab
  loops). Combined `aria-label` describes both card names + action.
- Reduced motion: chip-pair transitions guarded by
  `motion-reduce:transition-none` per `CLAUDE.md` design-system rules.

## Algorithm Design

### A1. Building the modified deck

```ts
// src/lib/pending-changes.ts
export function buildModifiedDeck(deck: DeckData, adds: PendingAdd[]): DeckData {
  const confirmedCuts = new Set(
    adds.flatMap(a => (a.pairedCutName ? [a.pairedCutName] : []))
  );
  const confirmedAddNames = adds
    .filter(a => a.pairedCutName !== undefined)
    .map(a => a.name);

  const filteredMainboard = deck.mainboard.filter(c => !confirmedCuts.has(c.name));
  const additions: DeckCard[] = confirmedAddNames.map(name => ({ name, quantity: 1 }));

  return {
    ...deck,
    mainboard: [...filteredMainboard, ...additions],
  };
}
```

**Invariant:** `|modifiedMainboard| === |originalMainboard|` (strict 1:1
preserves card count). Unit-tested.

### A2. Exclusion sets for UI

| Set | Members | Used by |
|---|---|---|
| `excludedFromAdd` | every `adds[].name` | `/reading/add` autocomplete + suggestions filter |
| `excludedFromCut` | every `adds[].pairedCutName` (defined only) | `PairWithCutSheet` mainboard list filter; `CandidateCardRow` "use a suggestion" inline list |

### A3. Comparison metric coverage

| Metric | Lib function (existing) | Comparison panel (status) |
|---|---|---|
| Mana curve | `computeManaCurve` (`src/lib/mana-curve.ts`) | ✅ supported (`ManaCurveOverlay`) |
| Hand keepability | `evaluateHandQuality`, `runSimulation` (`src/lib/opening-hand.ts`) | ❌ **create `HandKeepabilityComparison`** |
| Color analysis | `computeColorDistribution`, `computeManaBaseMetrics` (`src/lib/color-distribution.ts`) | ✅ supported (`TagComparisonChart`) |
| Bracket | `computeBracketEstimate` (`src/lib/bracket-estimator.ts`) | ❌ **create `BracketComparison`** |
| Power level | `computePowerLevel` (`src/lib/power-level.ts`) | ❌ **create `PowerLevelComparison`** |
| Mana base score | `computeLandBaseEfficiency` (`src/lib/land-base-efficiency.ts`) | ✅ supported (in `MetricComparisonTable`) |
| Composition scorecard | `computeCompositionScorecard` (`src/lib/deck-composition.ts`) | ❌ **create `CompositionScorecardComparison`** |

Each new comparison panel takes `{ slotA: DeckSlot; slotB: DeckSlot }`,
runs the lib function on both, and renders a side-by-side `<Card>` with
a delta column. Reduced motion respected. Eyebrow + serif title per
Astral system.

## Implementation Tasks

### Phase 1: Tests First (TDD)

- [ ] 1.1 Create `tests/unit/pending-changes.spec.ts`
  - Test: `buildModifiedDeck` with empty adds returns deck unchanged
  - Test: `buildModifiedDeck` with one paired add removes the cut and adds the new card
  - Test: `buildModifiedDeck` with one unpaired add is a no-op
  - Test: `buildModifiedDeck` with mixed paired+unpaired only applies paired
  - Test: `buildModifiedDeck` preserves total mainboard card count (invariant)
  - Test: `buildModifiedDeck` preserves commanders untouched
  - Test: `confirmedCutNames` returns Set of paired cut names only
  - Test: `unpairedAddNames` returns Set of names where `pairedCutName === undefined`
  - Test: codec `serializePendingChanges` / `deserializePendingChanges` roundtrip drops enrichment + analysis fields, preserves `name` and `pairedCutName`
  - Test: codec rejects payload with mismatched `deckId`
- [ ] 1.2 Create `e2e/additions-pairing.spec.ts`
  - Test: import deck → navigate to `/reading/add` → add card → confirm row shows `NEEDS PAIRING` eyebrow → CTA disabled
  - Test: click "Use a suggestion" on the inline list → row collapses to chip-pair → CTA enabled with `(1)` count
  - Test: click chip-pair → unpairs → row re-expands → CTA disabled
  - Test: pair via "Pick from your deck" → `<Sheet>` opens → search filters → select → sheet closes → focus returns to originating button
  - Test: add a second card → open its `Pick from your deck` → verify the cut from first pairing is **excluded** from the list
  - Test: try to add a card with the same name as an already-pending add → it's blocked / autocompletes excludes it
  - Test: click `Update Reading (N)` → routes to `/reading/compare`
  - Test: `/reading/compare` renders all 7 named panels (`mana-curve`, `hand-keepability`, `color-analysis`, `bracket`, `power-level`, `mana-base`, `composition`)
  - Test: open `Edit modified deck` sheet → remove a pending add → verify panel deltas update; verify `/reading/add` reflects the unstage when navigated back
  - Test: navigate `/reading/compare` → `/reading/add` → `/reading/compare`: state preserved both ways
  - Test: full page reload on `/reading/add` → pending changes persist (sessionStorage rehydration)
  - Test: session deck cleared → `/reading/compare` shows empty state with CTAs

### Phase 2: Pure-function core

- [ ] 2.1 Create `src/lib/pending-changes.ts`
  - `export interface PendingAdd { name; enrichedCard?; analysis?; error?; pairedCutName?: string }`
  - `export interface SerializedPendingAdd { name; pairedCutName?: string }`
  - `export interface PendingChangesPayload { version: 1; deckId: string; adds: SerializedPendingAdd[] }`
  - `export function buildModifiedDeck(deck: DeckData, adds: PendingAdd[]): DeckData`
  - `export function confirmedAdds(adds: PendingAdd[]): PendingAdd[]`
  - `export function confirmedCutNames(adds: PendingAdd[]): Set<string>`
  - `export function unpairedAddNames(adds: PendingAdd[]): Set<string>`
  - `export function serializePendingChanges(deckId: string, adds: PendingAdd[]): PendingChangesPayload`
  - `export function deserializePendingChanges(raw: unknown, expectedDeckId: string): SerializedPendingAdd[] | null` (returns null on shape mismatch or deckId mismatch)
  - Follow the pattern in `src/lib/deck-session.ts` for codec shape.
- [ ] 2.2 Extend `src/lib/deck-comparison.ts` to expose hand keepability,
  bracket, power level, and composition scorecard comparisons. Either
  add four new fields to the `DeckComparison` type returned by
  `computeDeckComparison`, or export four new pure helpers each taking
  `{ slotA, slotB }` — match whichever pattern the existing functions
  in this file use. Add unit tests in `tests/unit/deck-comparison.spec.ts`
  if the file exists, otherwise create it with at least one test per
  new metric.

### Phase 3: Context

- [ ] 3.1 Create `src/contexts/PendingChangesContext.tsx`
  - `PendingChangesProvider` reads `DeckSession.deckId`, hydrates from
    `sessionStorage[dev:pending-changes:v1]` on mount (only if deckId
    matches), persists on every state change.
  - Implements `addCandidate`, `removeCandidate`, `retryEnrich`,
    `pairAdd`, `unpairAdd`, `clearAll` exactly as listed in D1.
  - `addCandidate(name)` is a no-op if `name` is already in `adds`
    (D-3 enforcement).
  - `pairAdd(addName, cutName)` is a no-op if `cutName` is already used
    by another pair (strict 1:1 enforcement).
  - Memoizes `confirmedAdds`, `confirmedCutNames`, `unpairedAddNames`,
    `buildModifiedDeck` derivations.
  - Fires the aria-live announcement string on pair/unpair via a
    callback prop or via `LiveAnnouncerContext` if one exists; otherwise
    expose a `lastAnnouncement: string | null` for the consumer to
    render in a `role="status"` element.
- [ ] 3.2 Replace `src/contexts/CandidatesContext.tsx` with a thin shim:
  ```ts
  export const useCandidates = () => {
    const ctx = usePendingChanges();
    return {
      candidates: ctx.adds.map(a => a.name),
      candidateCardMap: Object.fromEntries(ctx.adds.flatMap(a => a.enrichedCard ? [[a.name, a.enrichedCard]] : [])),
      candidateAnalyses: Object.fromEntries(ctx.adds.flatMap(a => a.analysis ? [[a.name, a.analysis]] : [])),
      addCandidate: ctx.addCandidate,
      removeCandidate: ctx.removeCandidate,
      retryEnrich: ctx.retryEnrich,
    };
  };
  ```
  Existing callers see the same surface; new code uses
  `usePendingChanges()` directly.
- [ ] 3.3 Update `src/app/reading/(shell)/layout.tsx` to wrap children
  in `<PendingChangesProvider>`. Remove standalone `<CandidatesProvider>`
  if it's wrapped (the shim re-exports its hook from the new provider,
  so no provider needed).

### Phase 4: /reading/add UI

- [ ] 4.1 Create `src/components/reading/PendingChangeRow.tsx`
  - Props: `{ add: PendingAdd; onPickSuggestion(cut: string); onOpenPicker(): void; onUnpair(): void }`
  - Renders unpaired vs paired states per D3.
  - Uses `<Card>`, `<Eyebrow>`, `<Tag>` from `src/components/ui/`.
- [ ] 4.2 Create `src/components/reading/PairWithCutSheet.tsx`
  - Wraps `<Sheet side="right">`.
  - Props: `{ open: boolean; addName: string | null; mainboard: DeckCard[]; excludedCutNames: Set<string>; onPick(cut: string): void; onClose(): void }`
  - Uses `<CardSearchInput>` (locally-scoped, filters mainboard names) at
    top; renders filtered list of cards as buttons.
  - Excludes commanders + `excludedCutNames`.
  - On select, calls `onPick`, closes, focus returns to opener
    (Sheet handles focus restore).
- [ ] 4.3 Modify `src/components/CandidateCardRow.tsx`
  - Replace per-row `replacements` table with a `PendingChangeRow`
    sub-zone in unpaired state. Keep the existing synergy + CMC + mana
    base impact panels.
  - "Use a suggestion" inline list = filtered `analysis.replacements`
    minus `excludedFromCut`.
- [ ] 4.4 Modify `src/components/AdditionsPanel.tsx`
  - Read from `usePendingChanges()` directly.
  - Render the shared `<PairWithCutSheet>` once at the panel level,
    open-state driven by `pickerForAddName: string | null` local state.
  - Pass `onOpenPicker={() => setPickerForAddName(add.name)}` to each
    row.
- [ ] 4.5 Modify `src/app/reading/(shell)/add/page.tsx`
  - Compute `confirmedAdds.length` + `unpairedAddNames.size`.
  - Pass to `<SectionHeader>` stats: e.g. `[{ label: 'Adds', value },
    { label: 'Paired', value }, { label: 'Unpaired', value }]`.
  - Add primary CTA button per D4. Disable if `confirmedAdds.length === 0`.
  - On click: `router.push('/reading/compare')`.

### Phase 5: /reading/compare page

- [ ] 5.1 Factor common comparison panels out of
  `src/app/compare/ComparePageClient.tsx` into shared components:
  - `src/components/comparison/ManaCurveComparison.tsx` (extract from
    existing `ManaCurveOverlay` usage)
  - `src/components/comparison/ColorAnalysisComparison.tsx` (extract
    from existing `TagComparisonChart` usage)
  - `src/components/comparison/ManaBaseComparison.tsx` (extract from
    existing `MetricComparisonTable` usage)
  - Goal: both `/compare` and `/reading/compare` consume the same
    component set. Existing standalone `/compare` page must continue
    to work after extraction.
- [ ] 5.2 Create `src/components/comparison/HandKeepabilityComparison.tsx`
  - Props: `{ slotA: DeckSlot; slotB: DeckSlot }`
  - Calls `runSimulation()` for each slot.
  - Renders `<Card>` with `<SectionHeader>` style header and side-by-side
    keepability score, mulligan rate, and a delta indicator.
- [ ] 5.3 Create `src/components/comparison/BracketComparison.tsx`
  - Calls `computeBracketEstimate()` for each slot.
  - Renders bracket label (1–5), with delta arrow on change.
- [ ] 5.4 Create `src/components/comparison/PowerLevelComparison.tsx`
  - Calls `computePowerLevel()`.
  - Renders score + delta.
- [ ] 5.5 Create `src/components/comparison/CompositionScorecardComparison.tsx`
  - Calls `computeCompositionScorecard()`.
  - Renders side-by-side category breakdown with per-category deltas
    (creatures, ramp, draw, removal, lands, etc.) using emerald/amber/red.
- [ ] 5.6 Create `src/components/reading/EditModifiedDeckSheet.tsx`
  - Props: `{ open: boolean; modifiedDeck: DeckData; onClose(): void }`
  - Lists modified mainboard cards. Each pending-add row gets `[×]`
    button → `removeCandidate(name)` from the context.
  - Search input: when user picks a name, opens `PairWithCutSheet`
    prefilled with that add. After pairing, close both sheets.
- [ ] 5.7 Replace `src/app/reading/(shell)/compare/page.tsx`
  - Read `DeckSession` and `usePendingChanges()`.
  - Mode 1 (pending changes): render `<SectionHeader>` + 7 panels in a
    two-column grid. Toolbar with "← Edit at /reading/add" link and
    "Edit modified deck" button (opens `EditModifiedDeckSheet`).
  - Mode 2 (no pending changes): empty state with two CTAs.
  - Mode 3: `/reading/layout.tsx` already redirects when no session.
- [ ] 5.8 Verify `src/components/DeckSidebar.tsx` highlights
  `/reading/compare` correctly. If the route was previously a stub it
  may have been excluded — re-add to the route list if so.

### Phase 6: Polish + verification

- [ ] 6.1 Run `npm run lint` — fix all warnings introduced.
- [ ] 6.2 Run `npm run test:unit` — all unit tests green.
- [ ] 6.3 Run `npm run test:e2e` — all e2e tests green, including the
  new `additions-pairing.spec.ts`.
- [ ] 6.4 Run `npm run build` — production build clean.
- [ ] 6.5 Manual smoke: keyboard-only walk through the full pair flow,
  verify aria-live announcements fire (use VoiceOver / NVDA), verify
  `prefers-reduced-motion: reduce` disables chip-pair transitions,
  verify color contrast on chip-pair against `--card-bg`.

## Files to Create/Modify

| File | Action | Description |
|---|---|---|
| `src/lib/pending-changes.ts` | Create | Pure module: types, codec, `buildModifiedDeck`, exclusion-set helpers |
| `src/contexts/PendingChangesContext.tsx` | Create | Provider + hook; merges + replaces CandidatesContext semantics |
| `src/components/reading/PendingChangeRow.tsx` | Create | Per-row pair zone (unpaired) / chip-pair (paired) |
| `src/components/reading/PairWithCutSheet.tsx` | Create | Shared `<Sheet>` picker for "Pick from your deck" |
| `src/components/reading/EditModifiedDeckSheet.tsx` | Create | `/reading/compare` drawer for edits |
| `src/components/comparison/ManaCurveComparison.tsx` | Create | Extracted shared panel |
| `src/components/comparison/ColorAnalysisComparison.tsx` | Create | Extracted shared panel |
| `src/components/comparison/ManaBaseComparison.tsx` | Create | Extracted shared panel |
| `src/components/comparison/HandKeepabilityComparison.tsx` | Create | New comparison panel |
| `src/components/comparison/BracketComparison.tsx` | Create | New comparison panel |
| `src/components/comparison/PowerLevelComparison.tsx` | Create | New comparison panel |
| `src/components/comparison/CompositionScorecardComparison.tsx` | Create | New comparison panel |
| `tests/unit/pending-changes.spec.ts` | Create | Unit tests for `buildModifiedDeck` + codec |
| `e2e/additions-pairing.spec.ts` | Create | Full pair → compare → edit flow e2e |
| `src/contexts/CandidatesContext.tsx` | Modify | Replace with thin shim re-exporting from PendingChangesContext |
| `src/app/reading/(shell)/layout.tsx` | Modify | Wrap with `<PendingChangesProvider>` |
| `src/app/reading/(shell)/add/page.tsx` | Modify | Read pending state, render `Update Reading` CTA, route to `/reading/compare` |
| `src/app/reading/(shell)/compare/page.tsx` | Modify | Replace stub with full comparison page (3 modes per D5) |
| `src/components/AdditionsPanel.tsx` | Modify | Use `usePendingChanges`; host shared picker sheet |
| `src/components/CandidateCardRow.tsx` | Modify | Swap per-row replacement table for pair zone |
| `src/components/DeckSidebar.tsx` | Modify (only if needed) | Ensure `/reading/compare` highlights as active route |
| `src/lib/deck-comparison.ts` | Modify | Add hand keepability / bracket / power level / composition fields or helpers |
| `src/app/compare/ComparePageClient.tsx` | Modify | Consume extracted shared panels (no behavior change for standalone /compare) |
| `tests/unit/deck-comparison.spec.ts` | Modify or Create | Cover the four new metrics |

**No changes to:** `src/lib/opening-hand.ts`, `src/lib/bracket-estimator.ts`,
`src/lib/power-level.ts`, `src/lib/deck-composition.ts`,
`src/lib/mana-curve.ts`, `src/lib/color-distribution.ts`,
`src/lib/land-base-efficiency.ts`, `src/contexts/DeckSessionContext.tsx`,
`src/lib/deck-session.ts`, `src/components/ui/Sheet.tsx`,
`src/components/ui/Card.tsx`, `src/components/ui/Eyebrow.tsx`,
`src/components/ui/Tag.tsx`, `src/components/CardSearchInput.tsx`,
`src/components/reading/SectionHeader.tsx`,
`src/components/reading/DeckReadingShell.tsx`,
the import / ritual / other `/reading/*` sub-routes, all API routes.

## Verification

1. `npm run test:unit` — all unit tests pass, including
   `tests/unit/pending-changes.spec.ts` and any updates to
   `tests/unit/deck-comparison.spec.ts`.
2. `npm run test:e2e` — all e2e tests pass, including
   `e2e/additions-pairing.spec.ts` covering the full flow described
   in Phase 1.2.
3. `npm run build` — production build succeeds with zero TS errors.
4. `npm run lint` — clean.
5. **Manual smoke** (mandatory before merge):
   - Tab through the full pair flow on `/reading/add` with keyboard only.
   - Confirm aria-live announces pair/unpair (screen reader).
   - Toggle `prefers-reduced-motion: reduce` in browser devtools and
     verify chip-pair transitions are disabled.
   - Verify color contrast on chip-pair against `--card-bg` ≥ 4.5:1.
   - Reload `/reading/add` mid-flow and confirm pending changes persist.
   - On `/reading/compare`: open `EditModifiedDeckSheet`, remove a card,
     verify a panel updates immediately; navigate back to `/reading/add`
     and confirm that add is gone.
   - Clear deck session (`sessionStorage.clear()`) on `/reading/compare`
     and confirm redirect to `/`.
