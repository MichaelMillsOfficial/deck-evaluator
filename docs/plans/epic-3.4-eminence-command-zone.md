# Epic 3.4: Eminence & Command Zone Interactions

## Context

The capability extractor defines CardProfile.commander fields (eminence, hasPartner, hasBackground, companionRestriction) but never populates them. The interaction detector is already zone-agnostic — once eminence abilities are properly extracted, they participate in interaction detection automatically. This is the smallest-scope Phase 3 epic and should be implemented first.

**Dependencies**: Interaction engine (shipped). Commander validation (shipped). No Phase 3 dependencies — this epic UNBLOCKS Epic 3.1.

## Implementation Tasks

### Eminence Extraction
- [ ] Create `src/lib/interaction-engine/eminence-extractor.ts`
- [ ] `extractEminenceAbilities(card, parsedAbilities)`: detect "eminence" in oracle text/keywords, find corresponding AbilityNode[], return structured eminence data
- [ ] Handle triggered eminence (Edgar Markov: "Whenever you cast a Vampire spell, create a token") and static eminence (Ur-Dragon: "Dragon spells cost {1} less")
- [ ] Add eminence abilities to profile.zoneAbilities with functionsFrom: "command"
- [ ] Write `tests/unit/eminence-extractor.spec.ts` with all 4 eminence commanders: Edgar Markov (HIGH), The Ur-Dragon (MEDIUM), Inalla (MEDIUM), Arahbo (LOW)

### Partner & Companion Parsing
- [ ] `parsePartnerInfo(card)`: detect generic Partner, "Partner with [Name]", Friends Forever, Choose a Background, Doctor's Companion
- [ ] Add `partnerType` enum: "generic" | "named" | "friends_forever" | "choose_background" | "doctors_companion"
- [ ] `parseCompanionRestriction(card)`: extract "Companion -- [restriction text]" as string
- [ ] Write `tests/unit/partner-parsing.spec.ts` — generic partner, named partner (Pir/Toothy), friends forever, choose a background, companion (Lurrus)

### Type System Updates
- [ ] Add `partnerWith?: string` to CommanderProfile in `src/lib/interaction-engine/types.ts`
- [ ] Add `partnerType?: PartnerType` to CommanderProfile
- [ ] Export PartnerType union type

### Capability Extractor Integration
- [ ] Modify `src/lib/interaction-engine/capability-extractor.ts` to call eminence/partner/companion extraction
- [ ] Populate CardProfile.commander fields from extraction results
- [ ] Enhance eminence keyword in `keyword-database.ts` with structured metadata

### Interaction Detection Verification
- [ ] Write `tests/unit/command-zone-interactions.spec.ts`
- [ ] P0: Eminence abilities from CardProfile participate in interaction detection (Inalla + Wizard creatures)
- [ ] P0: Non-eminence commander produces no command zone interactions (Atraxa)
- [ ] P0: Command zone vs battlefield interactions are separate
- [ ] P1: Multiple Wizard ETBs produce multiple eminence interactions
- [ ] P1: Partner-with name matching (Pir finds Toothy)
- [ ] P1: Companion restriction parsing (Lurrus CMC check)

### UI: Command Zone Badge
- [ ] Add "Command Zone" badge to InteractionSection.tsx for eminence interactions
- [ ] Badge styling: bg-amber-900/40 border-amber-700/50 text-amber-300
- [ ] Eminence star ★ in text-amber-400 on centrality ranking
- [ ] Companion display: restriction validation with ✓/✗
- [ ] Partner display: ↔ connector between commander names in CommanderSection
- [ ] Do NOT model Lieutenant/battlefield-check abilities as command zone

### E2E Tests
- [ ] P0: Eminence commander (Inalla) shows command zone interactions with Wizards
- [ ] P0: Command zone interactions distinguished from battlefield ones (zone badge)
- [ ] P1: Companion restriction validation appears (Lurrus)
- [ ] P1: Partner-with validation appears (Pir + Toothy)
- [ ] Add page object methods: commandZoneInteractions, eminenceBadge, companionValidation

## L3 Judge Notes

- **Eminence doesn't stack**: Same ability from command zone OR battlefield, not both (CR 702.131b)
- **Companion is NOT command zone**: Starts outside game (sideboard), {3} special action to move to hand (not reducible)
- **Lieutenant is NOT eminence**: ~20 cards check "control your commander" — battlefield only, must NOT feed into command zone interactions
- **Partner types are NOT interchangeable**: Generic pairs with generic, Friends Forever with Friends Forever, etc.
- **Only 4 eminence commanders exist**: Edgar Markov, The Ur-Dragon, Inalla, Arahbo

## Files to Create/Modify

| Action | File | Description |
|--------|------|-------------|
| Create | `src/lib/interaction-engine/eminence-extractor.ts` | Eminence/partner/companion extraction |
| Create | `tests/unit/eminence-extractor.spec.ts` | Eminence unit tests |
| Create | `tests/unit/partner-parsing.spec.ts` | Partner/companion tests |
| Create | `tests/unit/command-zone-interactions.spec.ts` | Integration tests |
| Modify | `src/lib/interaction-engine/capability-extractor.ts` | Call extraction functions |
| Modify | `src/lib/interaction-engine/types.ts` | Add partnerWith, partnerType |
| Modify | `src/lib/interaction-engine/keyword-database.ts` | Enhance eminence keyword |
| Modify | `src/components/InteractionSection.tsx` | Command zone badge |

## Verification

1. `npm run test:unit` — eminence, partner, command zone tests all pass
2. `npm run test:e2e` — interactions tab tests pass (no regressions + new eminence tests)
3. Manual: Import Inalla + Wizard deck → Interactions tab → see amber "Command Zone" badges on eminence interactions → centrality ranking shows ★ on Inalla
