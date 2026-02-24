# Write an implementation plan

Create an implementation plan document for the feature: $ARGUMENTS

## Plan file location

Place at `docs/plans/<kebab-case-feature-name>.md`

## Required sections

### 1. Title
```md
# Feature Name
```

### 2. Context
2-4 paragraphs explaining:
- Current state of the codebase relevant to this feature
- The problem being solved
- Intended outcome
- Scope decisions (what's in, what's explicitly out)

### 3. Design Decisions (if applicable)
Named sub-decisions with reasoning. Include Tailwind class tables if UI is involved.

### 4. Algorithm Design (for complex features)
- Tables of entities/axes
- Numbered steps
- Code blocks with formulas

### 5. Implementation Tasks
Numbered phases with checkbox subtasks:

```md
### Phase 1: Write Tests (TDD)

- [ ] 1.1 Create `tests/unit/<name>.spec.ts` with tests for...
  - Test case: description
  - Test case: description

### Phase 2: Implement Core Logic

- [ ] 2.1 Create `src/lib/<name>.ts` with...
  - Function signature: `export function name(args): ReturnType`

### Phase 3: Add UI

- [ ] 3.1 Create/modify `src/components/<Name>.tsx`
```

Each subtask must include:
- The exact file path
- Function signatures where applicable
- Specific test cases to cover

### 6. Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/feature.ts` | Create | Core logic module |
| `src/components/Feature.tsx` | Modify | Add feature panel |

End with: "No changes to: [list of files explicitly not touched]"

### 7. Verification

```md
## Verification

1. `npm run test:unit` — all unit tests pass
2. `npm run test:e2e` — all e2e tests pass
3. `npm run build` — production build succeeds
4. Manual: [specific smoke test steps]
```

## Important

- Follow TDD: tests come before implementation in task ordering
- Reference existing patterns: "Follow the pattern in `src/lib/card-tags.ts`"
- Commit the plan file BEFORE beginning implementation
