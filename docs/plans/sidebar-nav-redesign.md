# Sidebar Navigation Redesign + Interaction Engine P0 Fixes

## Context

The current 6-tab flat horizontal bar is overcrowded, doesn't support submenus, and doesn't scale to mobile. We're replacing it with a collapsible sidebar navigation using three categories: Deck, Insights, Tools. Simultaneously, we're fixing P0 rules accuracy issues in the interaction engine.

## Design Decisions

- **Categories**: Deck (Deck List), Insights (Analysis, Synergy, Interactions[BETA]), Tools (Hands, Additions)
- **Categories are individually collapsible** on desktop
- **Desktop**: 240px sidebar, collapsible to 52px icon rail. `sticky top-0`, independent scroll
- **Mobile breakpoint**: `md` (768px) -- persistent sidebar at md+, drawer below md
- **Mobile**: Hamburger in slim sticky top bar, slide-out drawer with focus trap + overlay
- **Collapsed state**: Persisted in localStorage
- **No horizontal scrolling** anywhere
- **Active nav item**: `bg-purple-600/20 text-purple-300` with `border-l-2 border-purple-500`
- **Disabled items**: `opacity-40 cursor-not-allowed` during enrichment
- **Preserve**: All `ViewTab` types, panel IDs, `data-testid="deck-header"`, `selectDeckViewTab()` test helper

## Implementation Tasks

### Phase A: Foundation (no UI changes)

- [ ] A1. Extract `ViewTab` type + nav definitions to `src/lib/view-tabs.ts`
- [ ] A2. Create `src/hooks/useFocusTrap.ts` hook
- [ ] A3. Create `src/hooks/useSidebarCollapsed.ts` hook (localStorage persistence)

### Phase B: Interaction Engine P0 Fixes

- [ ] B1. Fix Crew speed: change from `"sorcery"` to no restriction in `keyword-database.ts`
- [ ] B2. Fix Adapt speed: change from `"sorcery"` to no restriction in `keyword-database.ts`
- [ ] B3. Fix `cause: "dies"` on undying/persist triggers in `keyword-database.ts` -- remove cause filter
- [ ] B4. Fix `buildCastingCost` for {0} mana cost cards in `capability-extractor.ts`
- [ ] B5. Update/add unit tests for all P0 fixes

### Phase C: Build Sidebar

- [ ] C1. Create `src/components/DeckSidebar.tsx` with full desktop + drawer rendering
- [ ] C2. Create `src/components/DeckMobileTopBar.tsx` for mobile sticky header
- [ ] C3. Write e2e tests for sidebar navigation behavior

### Phase D: Integration

- [ ] D1. Modify `DeckImportSection.tsx` -- add sidebar layout, `sidebarCollapsed`/`drawerOpen` reducer states
- [ ] D2. Move `data-testid="deck-header"` to sidebar, migrate deck identity + share + theme pills
- [ ] D3. Strip `DeckHeader.tsx` to type re-export shim, then delete
- [ ] D4. Update `e2e/deck-header.spec.ts` if any assertions need adjustment
- [ ] D5. Run full test suite, fix any failures

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/view-tabs.ts` | Create |
| `src/hooks/useFocusTrap.ts` | Create |
| `src/hooks/useSidebarCollapsed.ts` | Create |
| `src/components/DeckSidebar.tsx` | Create |
| `src/components/DeckMobileTopBar.tsx` | Create |
| `src/lib/interaction-engine/keyword-database.ts` | Modify (Crew/Adapt speed, undying/persist cause) |
| `src/lib/interaction-engine/capability-extractor.ts` | Modify (buildCastingCost fix) |
| `src/components/DeckImportSection.tsx` | Modify (sidebar layout integration) |
| `src/components/DeckHeader.tsx` | Modify → Delete |
| `src/components/DeckViewTabs.tsx` | Minor import path update |
| `e2e/deck-header.spec.ts` | Modify (if needed) |
| `tests/unit/interaction-*.spec.ts` | Modify (add P0 fix tests) |

## Verification

1. `npm run test:unit` -- all unit tests pass including new P0 fix tests
2. `npm run test:e2e` -- all e2e tests pass including sidebar navigation
3. `npm run build` -- production build succeeds
4. Manual: verify sidebar on desktop (expanded/collapsed), mobile (drawer open/close), and all nav items work
5. Manual: verify Crew/Adapt show instant speed, undying/persist triggers fire for any cause
