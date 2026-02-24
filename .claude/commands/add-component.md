# Add a new React component

Create a new component in `src/components/` following the established codebase patterns. The component: $ARGUMENTS

## Required patterns

### File structure
1. Place at `src/components/<PascalCase>.tsx`
2. Start with `"use client";` directive
3. Import order: React hooks first, then `import type` from `@/lib/types`, then component imports from `@/components/`
4. Define a local `interface ComponentNameProps { ... }` before the function
5. Use `export default function ComponentName(props: ComponentNameProps)` — always default export

### Dark theme design system
Follow these Tailwind classes exactly:
- **Backgrounds**: `bg-slate-800/50`, `bg-slate-900/50`, `bg-slate-700/30`
- **Borders**: `border-slate-700`, `border-slate-700/50`
- **Text**: `text-white` (headings), `text-slate-200` (card names), `text-slate-300` (body/section heads), `text-slate-400` (secondary/labels)
- **Hover**: `hover:bg-slate-700/30`, `hover:text-purple-300`
- **Purple accent**: `text-purple-300`, `focus-visible:ring-purple-400`, `bg-purple-600`
- **Section headers**: `text-sm font-semibold uppercase tracking-wide text-slate-300`
- **Subtitle text**: `text-xs text-slate-400`
- **Panels**: `space-y-6` between sections
- **Table rows**: `border-b border-slate-700/50`

### Accessibility requirements
- Expandable elements: `aria-expanded`, `aria-controls`, Escape key handler, `focus-visible:ring-2 focus-visible:ring-purple-400`
- Sections: `<section aria-labelledby="feature-heading">` with matching `<h3 id="feature-heading">`
- Interactive elements: minimum `min-h-[44px]` touch target
- Mana symbols: always `aria-hidden="true"` on `<img>`, parent carries `aria-label`
- Tag groups: parent `<span>` carries `aria-label={`Tags: ${tags.join(", ")}`}`
- Screen reader text: `<span className="sr-only">` for quantities
- Motion: `motion-reduce:transition-none` on all transitions

### Mana symbol rendering
Always use the `ManaSymbol` component:
```tsx
<ManaSymbol symbol="W" size="sm" />  // 16px
<ManaSymbol symbol="U" />            // 20px default
```
Or `ManaCost` for full cost strings:
```tsx
<ManaCost cost="{2}{W}{U}" size="sm" />
```

### Data patterns
- Use `useMemo` for expensive computations with proper dependency arrays
- Use `data-testid` attributes on key elements for test targeting
- Follow prefix patterns: `data-testid="stat-*"`, `data-testid="card-*"`, `data-testid="pair-*"`
- Tab panels: `id="tabpanel-deck-{feature}"`

## Corresponding e2e test

After creating the component, create or update `e2e/<feature>.spec.ts`:

```ts
import { test, expect, SAMPLE_DECKLIST } from "./fixtures";

test.describe("Feature Name — Context", () => {
  test.beforeEach(async ({ deckPage }) => {
    await deckPage.goto();
  });

  test("description of expected behavior", async ({ deckPage }) => {
    await deckPage.fillDecklist(SAMPLE_DECKLIST);
    await deckPage.submitImport();
    await deckPage.waitForDeckDisplay();
    // Assert against deckPage.deckDisplay, not the full page
  });
});
```

Always import `test` and `expect` from `./fixtures`, never from `@playwright/test` directly.
