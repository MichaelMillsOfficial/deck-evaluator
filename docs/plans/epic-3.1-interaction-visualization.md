# Epic 3.1: Interaction Visualization

## Context

The Interactions tab currently shows interactions as a filterable list. With larger decks this becomes
a wall of text. Adding a force-directed graph and a NxN heatmap gives users two complementary spatial
views of the same data without replacing the existing list.

The graph uses d3-force for layout (run inside a Web Worker so the main thread is never blocked),
Canvas 2D for rendering (required for performance — 100 nodes + 4950 potential edges would make
5000+ SVG DOM elements impractical), and a lazy-loaded React component so d3-force is never in
the initial bundle.

The heatmap is also Canvas 2D, sorted by centrality rank, showing aggregate interaction strength
as a colour gradient.

## Implementation Tasks

- [x] Step 1: Install d3-force + @types/d3-force
- [x] Step 2: Write failing unit tests for interaction-graph-data.ts
- [x] Step 3: Implement src/lib/interaction-graph-data.ts (make tests green)
- [x] Step 4: Create src/workers/force-layout.worker.ts (Web Worker for d3 layout)
- [x] Step 5: Create src/components/InteractionGraph.tsx (Canvas 2D graph component)
- [x] Step 6: Create src/components/InteractionHeatmap.tsx (Canvas 2D heatmap component)
- [x] Step 7: Integrate view-mode toggle into InteractionSection.tsx
- [x] Step 8: Run full test suite and verify all tests pass

## Files to Create/Modify

| File | Action |
|------|--------|
| `tests/unit/interaction-graph-data.spec.ts` | Create — unit tests (written first) |
| `src/lib/interaction-graph-data.ts` | Create — data transform layer |
| `src/workers/force-layout.worker.ts` | Create — Web Worker for d3-force |
| `src/components/InteractionGraph.tsx` | Create — Canvas 2D graph |
| `src/components/InteractionHeatmap.tsx` | Create — Canvas 2D heatmap |
| `src/components/InteractionSection.tsx` | Modify — add view-mode toggle |
| `package.json` | Modified — d3-force + @types/d3-force added |

## Verification

1. `npm run test:unit` — all unit tests including new interaction-graph-data.spec.ts pass
2. `npm test` — full suite passes with 0 failures
3. Manual: load a deck, go to Interactions tab, toggle Graph/Heatmap views, confirm canvas renders
