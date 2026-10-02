# Crucible card hover preview — fix + reusable primitive

## Context

The hover card preview in the Crucible triage workbench (`CrucibleCardRow`) has three
defects, all rooted in a hand-rolled, per-row absolutely-positioned tooltip:

1. **Sits below other rows.** The preview is `position: absolute` nested inside a
   window-virtualized `.vItem` that carries `transform: translateY(...)`. That transform
   opens a new stacking context, so the preview's `z-index: 10` can only win *within its
   own row* — later rows paint over it. No z-index value escapes a transform stacking
   context.
2. **Hit area too small.** `onMouseEnter` / `onMouseLeave` live on the `.rowName` text
   button only, so hovering anywhere else on the row shows nothing.
3. **Fires immediately.** State flips synchronously in the handler; there is no hover
   intent, so sweeping the cursor flickers previews open and shut.

The identical tooltip is copy-pasted into `reading/MetaHeatList` (`MetaHeatRow`), and the
"individual card rows" surface `EnrichedCardRow` (used by `DeckList`) has no art preview at
all — it is a click-to-expand accordion.

**Outcome:** one reusable, portaled, hover-intent preview primitive, used by Crucible,
MetaHeatList, and EnrichedCardRow.

## Decisions (locked via Lavish review)

- **Anchor:** side-anchored — prefer the row's right, flip left when tight, clamp
  vertically into the viewport.
- **Hover-open delay:** 350ms (close delay 120ms; keyboard focus opens instantly).
- **Scope:** all four surfaces in one PR (worktree re-based onto `feature/edhrec-meta-score`
  so `MetaHeatList` is in scope).

## Proposed approach

### New: `src/hooks/useHoverIntent.ts`
Hover-intent gate. `active` opens after `openDelay` (default 350ms), closes after 120ms so
the cursor can cross a gap. `onFocus` opens instantly (a11y); `onBlur` / `onMouseLeave`
close. Exposes `toggle` (click/tap) and `close`. Cancels pending timers on every transition
and on unmount — no flicker.

### New: `src/components/ui/CardHoverPreview.tsx` (+ `.module.css`)
Render-prop wrapper. Owns the hover-intent state and portals the preview panel to
`document.body` via `createPortal`, escaping every transform / overflow clip. Positions the
panel from the anchor element's `getBoundingClientRect()` (side-flip + clamp), recomputing
on `scroll` (capture) and `resize` while open. Panel is `position: fixed`, `pointer-events:
none` (so it never steals hover), `role="tooltip"`, and keeps the caller's `data-testid`.
Renders the Scryfall image when `enriched.imageUris` exists, else a name/type/oracle
fallback (preserving the existing `crucible-card-preview` "Artifact" text contract).

Render-prop API:
```
children({ active, anchorProps: { ref, onMouseEnter, onMouseLeave },
           focusProps: { onFocus, onBlur }, toggle, close })
```
- `anchorProps` → the hover hit-area + positioning anchor (whole row, or the name cell).
- `focusProps` → the focusable trigger (name button) for keyboard users.
- `toggle` → wire to the name button's `onClick` where tap-to-preview is wanted.

### Integrations
- **CrucibleCardRow:** `anchorProps` on the row `<div>` (full hit area), `focusProps` +
  `onClick={toggle}` on the name button. Delete the local preview markup and the dead
  `.preview*` CSS.
- **MetaHeatList (MetaHeatRow):** `anchorProps` on the row, `focusProps` + `onClick={toggle}`
  on the name button. Delete the local preview markup + dead CSS.
- **EnrichedCardRow:** `anchorProps` on the name `<td>` (anchors the art beside the name),
  `focusProps` on the existing expand button. Preview is hover/focus only; the existing
  click-to-expand accordion is untouched.

## Fix mapping
| Defect | Root cause | Fix |
|---|---|---|
| Below rows | Preview trapped in a `transform`ed `.vItem` stacking context | `createPortal` to `document.body` + fixed positioning |
| Small hit area | Hover handlers on the name button only | `anchorProps` on the whole row / name cell |
| Instant fire | Synchronous state flip, no timer | `useHoverIntent` 350/120ms; focus instant |
| Missing elsewhere | No preview on `EnrichedCardRow`; logic duplicated | Reuse `CardHoverPreview` |

## Files to create / modify
| File | Action |
|---|---|
| `src/hooks/useHoverIntent.ts` | Create |
| `src/components/ui/CardHoverPreview.tsx` | Create |
| `src/components/ui/CardHoverPreview.module.css` | Create |
| `src/components/ui/index.ts` | Export `CardHoverPreview` |
| `src/components/crucible/CrucibleCardRow.tsx` | Refactor to primitive |
| `src/components/crucible/crucible.module.css` | Remove dead `.preview*` |
| `src/components/reading/MetaHeatList.tsx` | Refactor `MetaHeatRow` |
| `src/components/reading/MetaHeatList.module.css` | Remove dead `.preview*` |
| `src/components/EnrichedCardRow.tsx` | Add hover art preview |
| `e2e/crucible-triage.spec.ts` | Bigger-hit-area + portal test |
| `e2e/deck-enrichment.spec.ts` | Enriched hover-art test |
| `e2e/reading-meta.spec.ts` | Meta hover-art test |

## Risks
- **Test scoping:** the preview now portals to `document.body`; any `within(row)` query
  would break. Existing crucible test uses page-level `getByTestId` — safe. Audited.
- **Scroll during hover:** reposition on capture-phase `scroll` + `resize`; the panel is
  `pointer-events: none` so it can't trap the cursor.
- **Touch:** `toggle` gives tap-to-preview on Crucible/Meta; Enriched keeps tap-to-expand.
- **Reduced motion:** entry animation gated behind `prefers-reduced-motion`.

## Verification
- `npm run test:e2e` — Crucible/Meta/Enriched hover reveals the portaled preview from a
  wide hit area after the intent delay.
- Manual: hover a row near the bottom of a long virtualized Crucible list; the preview
  paints above later rows and flips/clamps into the viewport.
