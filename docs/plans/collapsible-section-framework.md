# Collapsible Section Framework for Analysis & Synergy Tabs

## Context

The Analysis and Synergy tabs in the deck evaluator currently render all component sections fully expanded. The Analysis tab contains 7 sections (Commander, Composition Scorecard, Power Level, Mana Curve, Color Distribution, Land Base Efficiency, Hypergeometric Calculator) and the Synergy tab contains 5 sections (Deck Themes, Synergy Stats, Combos/Synergies, Anti-Synergies, Card Synergy Table). This forces users to scroll extensively to reach the section they care about.

Issue #23 requests a collapsible section framework that lets users control which sections are visible, with a modern and simplistic design. The framework must persist visibility choices across tab switches and be easily extensible for future components.

The solution introduces two new components: `CollapsiblePanel` (a reusable accordion wrapper) and `SectionNav` (a compact quick-jump navigation strip). Each section gets a persistent expand/collapse state managed in `DeckViewTabs` so state survives tab switches. All sections default to collapsed, with headers always visible so users can see all available sections at a glance.

**In scope:** Collapsible panels for Analysis and Synergy tabs, section navigation, state persistence across tab switches, keyboard accessibility.
**Out of scope:** Drag-to-reorder sections, localStorage persistence across page reloads, custom section ordering.

## Design Decisions

### Collapsible Panel Pattern

Each section is wrapped in a `CollapsiblePanel` that provides:
- An always-visible header bar with title, optional summary badge, and a chevron toggle
- Content area that collapses/expands with CSS transition
- Full ARIA disclosure pattern (`aria-expanded`, `aria-controls`, Escape key)

| Element | Tailwind Classes |
|---------|-----------------|
| Panel container | `rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden` |
| Header button | `flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-700/30 transition-colors` |
| Title | `text-sm font-semibold uppercase tracking-wide text-slate-300` |
| Summary badge | `ml-auto text-xs text-slate-400` |
| Chevron | `h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 motion-reduce:transition-none` (rotates 90° when open) |
| Content wrapper | `px-4 pb-4` |

### Section Navigation Strip

A horizontal row of compact chips at the top of each tab panel. Clicking a chip:
1. Expands the target section (if collapsed)
2. Scrolls to it smoothly via `scrollIntoView({ behavior: "smooth" })`

| Element | Tailwind Classes |
|---------|-----------------|
| Nav container | `mb-4 flex flex-wrap gap-2` |
| Chip (collapsed) | `rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-xs text-slate-400 hover:border-purple-500 hover:text-slate-200 transition-colors cursor-pointer` |
| Chip (expanded) | `rounded-full border border-purple-500 bg-purple-900/30 px-3 py-1 text-xs text-purple-300 cursor-pointer` |

### State Management

- `DeckViewTabs` owns a `Record<string, Set<string>>` mapping tab key → set of expanded section IDs
- State initializes with all sections collapsed (empty sets)
- Passed to `DeckAnalysis` and `SynergySection` as `expandedSections: Set<string>` and `onToggleSection: (id: string) => void`
- Since `DeckViewTabs` persists across tab switches, section states are preserved

### Section Registry

Each tab defines its sections as a typed array. This makes adding future sections a single-line addition:

```ts
// Analysis sections
const ANALYSIS_SECTIONS = [
  { id: "commander", label: "Commander" },
  { id: "composition", label: "Composition" },
  { id: "power-level", label: "Power Level" },
  { id: "mana-curve", label: "Mana Curve" },
  { id: "color-distribution", label: "Color Dist." },
  { id: "land-efficiency", label: "Land Efficiency" },
  { id: "hypergeometric", label: "Draw Odds" },
] as const;

// Synergy sections
const SYNERGY_SECTIONS = [
  { id: "themes", label: "Themes" },
  { id: "synergy-stats", label: "Stats" },
  { id: "synergy-pairs", label: "Synergies" },
  { id: "anti-synergies", label: "Anti-Synergies" },
  { id: "card-scores", label: "Card Scores" },
] as const;
```

## Implementation Tasks

### Phase 1: Write Tests (TDD)

- [x] 1.1 Create `e2e/collapsible-panels.spec.ts` with tests for the collapsible panel behavior
  - Test: Analysis tab sections are collapsed by default (content not visible, headers visible)
  - Test: Clicking a section header expands it (content becomes visible, aria-expanded=true)
  - Test: Clicking an expanded header collapses it
  - Test: Escape key collapses an expanded panel
  - Test: Section navigation chips are visible on the Analysis tab
  - Test: Clicking a nav chip expands the target section
  - Test: Expanded section state persists when switching to another tab and back
  - Test: Synergy tab sections are also collapsed by default with headers visible
  - Test: Multiple sections can be expanded simultaneously

### Phase 2: Implement Core Components

- [x] 2.1 Create `src/components/CollapsiblePanel.tsx`
  - Props: `id: string`, `title: string`, `summary?: React.ReactNode`, `expanded: boolean`, `onToggle: () => void`, `children: React.ReactNode`, `testId?: string`
  - ARIA: `aria-expanded`, `aria-controls`, `role="region"`, Escape key handler
  - Follow the chevron pattern from `CommanderSection.tsx`

- [x] 2.2 Create `src/components/SectionNav.tsx`
  - Props: `sections: { id: string; label: string }[]`, `expandedSections: Set<string>`, `onSelectSection: (id: string) => void`
  - Renders horizontal chip strip
  - Clicking a chip calls `onSelectSection` which will expand + scroll

### Phase 3: Integrate into Analysis Tab

- [x] 3.1 Modify `src/components/DeckViewTabs.tsx`
  - Add state: `const [expandedSections, setExpandedSections] = useState<Record<string, Set<string>>>({ analysis: new Set(), synergy: new Set() })`
  - Add toggle handler
  - Pass `expandedSections[tab]` and toggle handler to child components

- [x] 3.2 Modify `src/components/DeckAnalysis.tsx`
  - Accept new props: `expandedSections: Set<string>`, `onToggleSection: (id: string) => void`
  - Wrap each section in `CollapsiblePanel`
  - Add `SectionNav` at the top with `ANALYSIS_SECTIONS`
  - Add `ref` + `id` attributes to each panel for scroll-to behavior

- [x] 3.3 Modify `src/components/SynergySection.tsx`
  - Accept new props: `expandedSections: Set<string>`, `onToggleSection: (id: string) => void`
  - Wrap each section in `CollapsiblePanel`
  - Add `SectionNav` at the top with `SYNERGY_SECTIONS`

### Phase 4: Fix Existing Tests

- [x] 4.1 Update `e2e/deck-analysis.spec.ts` — tests that assert content visibility will need to expand the relevant section first
- [x] 4.2 Update `e2e/synergy-ui.spec.ts` — same: expand synergy sections before asserting content
- [x] 4.3 Update `e2e/land-base-efficiency-ui.spec.ts` — expand land efficiency section
- [x] 4.4 Update `e2e/hypergeometric-ui.spec.ts` — expand hypergeometric section
- [x] 4.5 Update `e2e/fixtures.ts` — add helper methods:
  - `expandAnalysisSection(id: string)` — click the panel header to expand
  - `expandSynergySection(id: string)` — same for synergy tab

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/CollapsiblePanel.tsx` | Create | Reusable collapsible accordion panel |
| `src/components/SectionNav.tsx` | Create | Quick-jump navigation chip strip |
| `src/components/DeckViewTabs.tsx` | Modify | Add expanded section state management |
| `src/components/DeckAnalysis.tsx` | Modify | Wrap sections in CollapsiblePanel, add SectionNav |
| `src/components/SynergySection.tsx` | Modify | Wrap sections in CollapsiblePanel, add SectionNav |
| `e2e/collapsible-panels.spec.ts` | Create | E2E tests for collapsible panel behavior |
| `e2e/fixtures.ts` | Modify | Add section expand helper methods |
| `e2e/deck-analysis.spec.ts` | Modify | Expand sections before asserting content |
| `e2e/synergy-ui.spec.ts` | Modify | Expand sections before asserting content |
| `e2e/land-base-efficiency-ui.spec.ts` | Modify | Expand land efficiency section |
| `e2e/hypergeometric-ui.spec.ts` | Modify | Expand hypergeometric section |

No changes to: `src/lib/`, API routes, `DeckList.tsx`, `DeckInput.tsx`, `DeckImportSection.tsx`, individual analysis components (CommanderSection, ManaCurveChart, etc. — they remain unchanged, only their parent wrappers change).

## Verification

1. `npm run test:unit` — all unit tests pass (no unit tests affected)
2. `npm run test:e2e` — all e2e tests pass including new collapsible panel tests
3. `npm run build` — production build succeeds
4. Manual:
   - Import a deck, switch to Analysis tab — all sections collapsed, headers visible
   - Click a section header — content expands with chevron rotation
   - Click nav chip — section expands and scrolls into view
   - Switch to Synergy tab and back to Analysis — expanded sections persist
   - Keyboard: Tab to a header, Enter to toggle, Escape to collapse
