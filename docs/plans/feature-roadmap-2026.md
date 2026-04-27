# Feature Roadmap 2026

## Current State Assessment

### What's Already Shipped

The app has matured significantly beyond its original import-and-enrich scope. Here is a complete inventory of shipped features:

**Import & Enrichment**
- 3-tab deck import (Manual paste, Moxfield URL text, Archidekt URL)
- Scryfall card enrichment with batch API calls
- Multi-face card support (MDFCs, transform, adventure, split, meld)
- Commander input with autocomplete
- Share URLs with gzip-compressed deck payloads (`deck-codec.ts`)
- Discord export with selectable sections (`export-report.ts`)

**Analysis Engine**
- Heuristic card tagging (16+ functional tags via `card-tags.ts`)
- Mana curve analysis with bar chart visualization (`mana-curve.ts`)
- Color distribution and mana base metrics (`color-distribution.ts`)
- Land base efficiency scoring (`land-base-efficiency.ts`)
- Mana base recommendations (`mana-recommendations.ts`)
- Deck composition scorecard against community templates (`deck-composition.ts`)
- Synergy axis detection with 12 axes (`synergy-axes.ts`)
- Synergy scoring engine (`synergy-engine.ts`)
- Known combo detection (`known-combos.ts`)
- Commander Spellbook integration (`commander-spellbook.ts`)
- Power level estimator with transparent factor breakdown (`power-level.ts`)
- Bracket estimator with downgrade recommendations (`bracket-estimator.ts`)
- Budget analysis with price data (`budget-analysis.ts`)
- Opening hand simulator with keepability scoring and game-plan awareness (`opening-hand.ts`)
- Hypergeometric probability calculator (`hypergeometric.ts`)
- Candidate card analysis for "Additions" tab (`candidate-analysis.ts`)
- Commander validation (color identity, singleton rule, deck size) (`commander-validation.ts`)
- Creature type and supertype breakdowns (`creature-types.ts`, `supertypes.ts`)
- cEDH staple overlap detection (`cedh-staples.ts`)
- Aggregate analysis pipeline (`deck-analysis-aggregate.ts`)

**Interaction Engine (NEW -- the most technically ambitious module)**
- Oracle text lexer: tokenizes card text into typed tokens (`lexer.ts`)
- Oracle text parser: transforms token streams into AbilityNode ASTs (`parser.ts`)
- Capability extractor: builds CardProfile summaries from ASTs (`capability-extractor.ts`)
- Keyword database: 50+ keywords with structured expansion (`keyword-database.ts`)
- Game model: type system for zones, card types, controllers (`game-model.ts`)
- Rules types: speed, layer, phase, step (`rules/types.ts`)
- Interaction detector: pairwise detection of enables, triggers, amplifies, protects, recurs, tutors_for, reduces_cost, blocks, conflicts, loops_with (`interaction-detector.ts`)
- Chain and loop detection across 3+ cards
- Interaction blocker and enabler analysis
- Interaction rollup for UI compaction (`interaction-rollup.ts`)
- Full Interactions UI tab with filterable type badges, expandable cards, strength bars (`InteractionSection.tsx`)

### What's Planned but Not Yet Built

From existing plan files:
- Moxfield direct URL import (plan exists, `moxfield-direct-import.md`)
- Card swap suggestions (plan exists, `card-swap-suggestions.md`, depends on composition scorecard which is now shipped)
- Deck comparison page (plan exists, `deck-comparison.md`)
- Full export/share with image capture (partial -- Discord export exists, image export and share URL phase 3 not done)

---

## Market Research: Competitive Landscape

### Feature Gap Analysis

| Capability | EDHREC | Moxfield | Archidekt | ScryCheck | DeckCheck | MTGGoldfish | **This App** |
|---|---|---|---|---|---|---|---|
| Auto card tagging from oracle text | No | Manual only | No | No | No | No | **Yes (16+ tags)** |
| Composition validation vs heuristics | No | No | No | No | No | No | **Yes** |
| Transparent power level reasoning | No | No | No | 5-vector grades | Holistic AI | No | **Yes (factor breakdown)** |
| Oracle text AST compilation | No | No | No | No | No | No | **Yes (full compiler)** |
| Mechanical interaction detection | No | No | No | No | No | No | **Yes (10 interaction types)** |
| Interaction chains and loops | No | No | No | No | No | No | **Yes** |
| Combo detection | Via Spellbook | No | Via Spellbook | Via Spellbook | Yes | No | **Yes (local + Spellbook)** |
| Goldfish/turn simulation | No | Playtester | Playtester + logs | No | Win-turn analysis | No | **No (gap)** |
| Card recommendations | Statistical | Via EDHREC | Via EDHREC | Post-analysis | Yes | Budget alts | **Candidate analysis** |
| Deck comparison | Vs average | Yes | Yes | No | No | No | **No (gap)** |
| Opening hand quality scoring | No | Sample hand | Sample hand | No | No | No | **Yes (with keepability)** |
| Mobile app | No | No | iOS/Android | No | No | No | **No** |
| Collection management | No | Yes | Yes | No | No | No | **No** |

### Unique Differentiators (Existing)

1. **Oracle text compiler pipeline** -- No other tool parses card text into structured ASTs. This enables rule-precise interaction detection rather than statistical co-occurrence or manual tagging.
2. **Automated functional tagging** -- Every other tool requires manual tagging or relies on EDHREC statistical popularity.
3. **Transparent power level** -- Shows the specific factors and weights, unlike ScryCheck's opaque 5-vector system or DeckCheck's AI-driven holistic analysis.
4. **Mechanical interaction detection** -- Goes beyond "these cards are played together" to "card A's ETB trigger feeds card B's death trigger which enables card C's sacrifice cost."

### Gaps vs. Competitors

1. **No goldfish simulation** -- Archidekt has playtester logs tracking mana production, cards drawn, and power over simulated turns. Moxfield has a full sandbox. MTG-Mana-Simulator (open source) runs Monte Carlo simulations tracking on-curve probability. DeckCheck estimates "win turn." This app has opening hand simulation but no turn-by-turn progression.
2. ~~**No deck comparison**~~ ✅ Shipped — `/compare` page with side-by-side analysis.
3. **No playtester** -- Not a strategic gap (Moxfield/Archidekt own this) but worth noting.
4. ~~**Limited card swap suggestions**~~ ✅ Shipped — Gap-driven category fills, weak card identification, deck-context-aware upgrades, and land swap recommendations.

---

## Feature Research

### A. Goldfish Simulator Design

A goldfish simulator models a solitaire game against no opponent. Based on research of MTG-Mana-Simulator and Archidekt's playtester logs, the design would involve:

**Core Simulation Loop (per turn):**
1. Untap all permanents
2. Draw a card (skip turn 1 on the play)
3. AI agent decides: play a land (prioritizing color needs), cast spells (greedy by impact or curve-filling)
4. Track: mana available, mana spent, spells cast, cards in hand, board state summary

**Metrics to Compute (over N simulations):**
- P(on-curve by turn T) -- probability of casting a spell each turn equal to available mana
- Average mana available per turn
- Average mana spent per turn (utilization rate)
- P(castable hand by turn N) -- "can I cast my entire hand by turn N?"
- Turn to first spell, turn to first interaction, turn to commander cast
- Mana development curve (lands in play per turn)

**Implementation Approach:**
- Pure function: `simulateGoldfish(deck, cardMap, config) => GoldfishResult`
- Monte Carlo: run 1,000-10,000 iterations, aggregate statistics
- Card modeling: use existing `EnrichedCard` data (CMC, color identity, type line) plus card tags (Ramp, Card Draw) to inform AI decisions
- The AI agent should be simple: play land, cast cheapest playable spell, prioritize ramp early
- This builds on the existing `opening-hand.ts` pool/draw infrastructure

**What Existing Code Enables:**
- `opening-hand.ts` already has `buildPool()`, `buildCardCache()`, `drawHand()`, and London mulligan
- `card-tags.ts` identifies ramp, card draw, and interaction
- `land-base-efficiency.ts` classifies lands and their color production
- `mana.ts` parses mana costs

**What Needs Building:**
- Game state model (board, hand, graveyard, mana pool per turn)
- AI agent (land play selection, spell casting priority)
- Turn loop with proper sequencing
- Metric aggregation and statistics

### B. Expanded Interaction Engine Lexicon

The interaction engine currently handles common oracle text patterns well. Based on a review of the lexer aliases, parser, keyword database, and capability extractor, the following mechanics are **not yet handled** or are only partially handled:

**Not Handled:**
| Mechanic | Oracle Text Pattern | Why It Matters |
|---|---|---|
| **Sagas** | Chapter abilities (I, II, III) with sequential triggers | Sagas have unique timing -- abilities trigger on lore counter placement, interact with proliferate, and self-sacrifice. Currently recognized as a subtype but chapter abilities are not parsed into sequential triggered abilities. |
| **Rooms** (Duskmourn) | "You may unlock a door" / room abilities | New card type with unique gameplay pattern. Rooms have two halves with separate abilities. Not modeled in the layout types. |
| **Class enchantments** | "Level 2: {cost}" / level-up progression | Class cards have level-up abilities that unlock progressively. Not parsed as structured abilities. |
| **Prototype** (BRO) | "Prototype {cost} -- P/T" | Alternative casting with different stats. `alternativeCosts` exists in `CastingCost` but prototype-specific parsing is absent. |
| **Craft** (LCI) | "Craft with [material]" | Transform mechanic with exile cost. Not in keyword database. |
| **Daybound/Nightbound** | Transform triggered by spell count | Day/night cycle affects all daybound permanents simultaneously. `GameDesignation` has `day_night` but keyword expansion doesn't model the transform trigger. |
| **Disturb** (MID/VOW) | Cast from graveyard transformed | Zone-casting permission + transform. Not in keyword database. |
| **Connive** | Keyword action (draw, discard, +1/+1 if nonland) | Common in SNC-era cards. Not in keyword database. |
| **Discover/Cascade variant** | "Discover N" | Exile from top until CMC <= N, cast or put in hand. Not in keyword database. |
| **Incubate** (MOM) | Create Incubator token, transform into creature | Token creation + transform. Not modeled. |
| **Bargain** (WOE) | Optional additional cost to sacrifice | `optionalCosts` in `CastingCost` supports this pattern but keyword is not in database. |

**Partially Handled:**
| Mechanic | Current State | Gap |
|---|---|---|
| **Adventures** | Layout recognized, face profiles built | Adventure spell half parsed but interaction between adventure cast and creature ETB not detected |
| **MDFCs** | Layout recognized, both faces profiled | Back-face land interactions (e.g., "counts as a spell slot AND a land") not factored into mana base analysis |
| **Mutate** | Keyword in database with basic expansion | Mutation trigger "whenever this creature mutates" parsed but merged creature interaction not modeled |
| **Foretell** | Keyword in database | Basic cost modeling but foretell-from-exile interaction not detected |
| **Companion** | `companionRestriction` field exists in CardProfile | Restriction text not parsed into structured conditions |

### C. Interaction Presentation Research

Current presentation: flat list of interactions grouped by type, with rollup for repetitive entries, expandable rows showing mechanical descriptions and strength bars. This is functional but can be enhanced:

**Opportunities:**
1. **Relationship Graph Visualization** -- Force-directed graph where cards are nodes, interactions are edges colored by type, edge thickness = strength. Enables visual pattern recognition ("this card is a hub connecting 8 others"). Libraries: d3-force, react-force-graph, or vis.js.
2. **Interaction Strength Heatmap** -- NxN matrix where rows/columns are cards, cell color = aggregate interaction strength. Highlights which card pairs have the strongest relationships. Good for identifying core engine pieces.
3. **Rules Text Citations** -- Each interaction's `mechanical` description already cites the relationship. Enhancement: link to the specific ability text on each card that creates the interaction (e.g., "Triggers: Blood Artist's 'Whenever a creature dies, target player loses 1 life' fires when Viscera Seer's 'Sacrifice a creature' is activated").
4. **Interaction Score per Card** -- Aggregate all interactions a card participates in into a single "interaction centrality" score. Cards with high centrality are engine pieces; cards with zero interactions are potentially cuttable.
5. **"What If" Removal Impact** -- The `RemovalImpact` type already exists in the engine types. Surface it in the UI: "If you remove Blood Artist, you lose 12 interactions, disrupt 3 chains, and break 1 loop."

### D. Deferred Complexity from Interaction Engine

Based on review of `types.ts` and the codebase:

1. **Condition parsing** -- `Condition.predicate` is preserved as raw text in Phase 1. `structured` field exists for Phase 2+ parsed predicates but is rarely populated. This means conditional interactions ("if you control 5+ creatures") are detected but the condition's satisfiability isn't verified against deck composition.
2. **Layer system** -- `Layer` type exists in rules but static effect layer ordering (CR 613) is not enforced during interaction detection. Two static abilities modifying the same object don't have their interaction resolved by layer priority.
3. **Variable quantities** -- `VariableQuantity` type exists but X-cost spells and "for each" scaling effects are treated as fixed values during interaction strength calculation.
4. **Dungeon/Room modeling** -- Types exist (`Dungeon`, `DungeonRoom`) but no cards use them yet in the capability extractor.
5. **Emblem creation** -- `CreateEmblemEffect` type exists but planeswalker emblem abilities are not parsed from ultimate abilities.
6. **Meld pairs** -- `meldPair`/`meldResult` fields exist on CardProfile but meld interaction (two specific cards creating a third) is not detected.
7. **Copy effect resolution** -- `CopyEffect` type is comprehensive but copied permanent interactions (e.g., Clone copying a creature with ETB) are not modeled.

### E. Commander-Specific Feature Research

**Already Implemented:**
- Color identity validation (`commander-validation.ts`)
- Singleton rule enforcement with exceptions (basic lands, Relentless Rats, etc.)
- Deck size validation (99 + commander(s))
- Commander tax is not tracked (no simulation)
- Partner detection via `hasPartner` on CardProfile
- Background detection via `hasBackground`
- Eminence ability extraction on CardProfile
- Companion restriction field (unparsed)

**Gaps:**
1. **Commander tax in simulation** -- Opening hand simulator draws commander from command zone but doesn't model re-casting with +{2} tax. Goldfish simulator would need this.
2. **Partner/companion rules enforcement** -- Partners detected but not validated (e.g., "Partner with [specific card]" vs generic Partner). Companion restriction text not parsed.
3. **Commander damage tracking** -- Relevant for goldfish simulation only.
4. **Command zone interaction** -- Eminence abilities (Inalla, Edgar Markov) detected on profile but not fed into interaction detector for command-zone triggers.
5. **Color identity for MDFC/split cards** -- Needs verification that both faces contribute to color identity validation.

---

## Feature Roadmap

### ~~Phase 1: Quick Wins and UX Improvements (1-2 sprints)~~ ✅ COMPLETE

#### ~~Epic 1.1: Moxfield Direct Import~~ (DEFERRED)
> *Deferred due to Moxfield API constraints -- direct URL import is not feasible at this time.*

---

#### ~~Epic 1.1: Card Swap Suggestions (Gap-Driven)~~ ✅ SHIPPED
> *Close the loop between "what's wrong" (composition scorecard) and "how to fix it" (actionable card recommendations).*

**Business Value:** Highest engagement feature in deck evaluation tools. No competitor connects composition gap analysis to specific card recommendations automatically. This is the feature that turns a diagnostic tool into an advisory tool.

**Shipped Features:**
- Weak card identification using synergy scores + tag role analysis
- API route querying Scryfall Search filtered by color identity + functional tag for category fills
- Upgrade candidates with deck-context-aware filtering (protects theme-relevant cards)
- "Replace with Lands" section when land count is low/critical
- Dedicated "Suggestions" tab with category fills, weak cards, land swaps, and upgrades sections
- Combo piece and sole-provider protection

**Dependencies:** Deck Composition Scorecard (shipped). Plan at `docs/plans/card-swap-suggestions.md`.

---

#### ~~Epic 1.2: Deck Comparison~~ ✅ SHIPPED
> *Enable side-by-side comparison of two decklists with analysis diff.*

**Business Value:** High demand in Commander community for comparing deck iterations, analyzing a friend's build, or evaluating against an archetype reference. Moxfield and Archidekt both have this; we should too.

**Shipped Features:**
- `/compare` page with two independent import slots
- Editable deck names (default "Deck 1" / "Deck 2")
- Card overlap and unique-to-each-deck lists
- Side-by-side mana curve, color distribution, and power level comparison
- Back navigation to main evaluator

**Dependencies:** None. Plan at `docs/plans/deck-comparison.md`.

---

#### ~~Epic 1.3: Interaction Presentation Enhancements~~ ✅ SHIPPED
> *Make the interaction engine's output more actionable with per-card scores and removal impact.*

**Business Value:** The interaction engine produces rich data but the current flat-list presentation doesn't surface high-level insights. Adding interaction centrality scores and removal impact analysis makes the data actionable for deck editing decisions.

**Shipped Features:**
- Per-card interaction centrality scores with ranked display
- Floating removal impact panel (slide-in, non-modal, dismiss on Escape/collapse)
- Interaction type filter pills with flex-wrap layout
- Rules text citations linking interactions to specific oracle text
- Auto-close floating panel on section collapse or tab navigation

**Dependencies:** Interaction engine (shipped).

---

### ~~Phase 2: Core Engine Expansion (2-4 sprints)~~ ✅ COMPLETE

#### ~~Epic 2.1: Goldfish Simulator~~ ✅ SHIPPED
> *Simulate solitaire games to answer "how consistently does this deck develop its mana and cast spells?"*

**Business Value:** Addresses the biggest feature gap vs. Archidekt (playtester logs) and fills a niche no tool serves well for Commander: statistical analysis of mana development and curve-out probability over 1,000+ simulated games. DeckCheck estimates "win turn" but doesn't show the journey. MTG-Mana-Simulator is a standalone Python tool, not integrated into a deck analysis workflow.

**Stories:**
| Story | Points | Description |
|---|---|---|
| As a deckbuilder, I want to simulate 1,000 goldfish games and see mana development statistics | XL | Core simulation loop: untap, draw, AI land/spell decisions, per-turn state tracking |
| As a deckbuilder, I want to see P(on-curve) by turn as a line chart | M | Aggregate metric: probability of casting a spell each turn equal to available mana |
| As a deckbuilder, I want to see average mana utilization per turn | S | Track mana available vs. mana spent per turn |
| As a deckbuilder, I want to see the average turn my commander is first castable | S | Factor commander CMC + ramp + land development |
| As a deckbuilder, I want to configure simulation parameters (turns, iterations, play/draw) | S | Config UI for goldfish simulation settings |

**Dependencies:** `opening-hand.ts` (pool/draw infrastructure), `card-tags.ts` (ramp/draw identification), `land-base-efficiency.ts` (land classification).
**Prework:**
- Design game state model (board representation, mana pool tracking)
- Design AI agent heuristics (land play priority, spell casting order)
- Determine Web Worker strategy for non-blocking simulation

---

#### ~~Epic 2.2: Interaction Engine Lexicon Expansion~~ ✅ SHIPPED
> *Handle nuanced card mechanics that the current lexer/parser miss.*

**Business Value:** The interaction engine is the primary technical differentiator. Expanding the lexicon to handle Sagas, Class enchantments, Rooms, and recent keyword abilities (connive, discover, bargain, craft) increases the percentage of cards that produce accurate interaction analysis. Each new set introduces 2-3 new mechanics; the engine needs to keep pace.

**Stories:**
| Story | Points | Description |
|---|---|---|
| As a user, I want Saga chapter abilities parsed into sequential triggered abilities | L | Detect "I --", "II --", "III --" patterns in oracle text, model as triggered abilities on lore counter placement |
| As a user, I want Class enchantment level-up abilities parsed | M | Detect "Level N: {cost}" patterns, model as activated abilities that unlock effects |
| As a user, I want recent keywords (connive, discover, bargain, incubate, craft) in the keyword database | L | Add keyword entries with proper expansion to AbilityNode[] |
| As a user, I want daybound/nightbound transform triggers modeled | M | Expand keyword database entries, model day/night cycle interaction |
| As a user, I want Room cards' dual-ability structure parsed | M | Recognize Room layout, parse both halves with unlock mechanic |
| As a user, I want meld pairs detected as interactions | S | Match meld pair/result fields, emit "enables" interaction |
| As a user, I want companion restrictions parsed into structured conditions | M | Parse companion restriction text, validate against deck composition |

**Dependencies:** Interaction engine (shipped).
**Prework:**
- Catalog all Saga cards (Scryfall: `t:saga`) and identify oracle text patterns
- Catalog all Class cards and Room cards for pattern analysis
- Review recent set mechanics (MOM, LCI, WOE, MKM, OTJ, BLB, DSK, FDN) for new keywords

---

#### ~~Epic 2.3: Condition Satisfiability Analysis~~ ✅ SHIPPED
> *Move from "these cards interact" to "these cards interact AND the conditions are met by this deck."*

**Business Value:** Current interaction detection identifies that Card A triggers Card B but doesn't verify whether the deck meets the conditions (e.g., "if you control 5+ creatures"). This produces false-positive interactions for decks that can't realistically satisfy the conditions. Addressing this improves interaction quality from "theoretically possible" to "likely in practice."

**Stories:**
| Story | Points | Description |
|---|---|---|
| As a user, I want interaction strength to account for whether my deck can satisfy conditions | L | Parse `Condition.predicate` into structured predicates, evaluate against deck composition |
| As a user, I want conditional interactions flagged when conditions are unlikely | M | Add condition satisfaction scoring to interaction strength calculation |

**Dependencies:** Interaction engine types (shipped -- `Condition.structured` field exists but is rarely populated).
**Prework:** Catalog common condition patterns in oracle text to determine parsing scope.

---

### Phase 3: Advanced Features (4-8 sprints)

#### Epic 3.1: Interaction Visualization
> *Graph and heatmap views of card interactions for visual pattern recognition.*

**Business Value:** Visual relationship graphs reveal deck structure that text lists cannot. Force-directed graphs show "engine" cards (high-degree nodes), isolated cards (disconnected nodes), and interaction clusters. Heatmaps show pairwise strength at a glance. This is a unique visualization no competitor offers.

**Stories:**
| Story | Points | Description |
|---|---|---|
| As a deckbuilder, I want a force-directed graph showing card interactions as a network | XL | d3-force or react-force-graph integration, cards as nodes, interactions as colored edges |
| As a deckbuilder, I want to filter the graph by interaction type | M | Toggle interaction types on/off, update graph edges |
| As a deckbuilder, I want an NxN heatmap of card interaction strength | L | Matrix visualization, cell color = aggregate strength, sortable by cluster |
| As a deckbuilder, I want to click a card in the graph to see all its interactions | M | Node selection highlights connected edges, shows detail panel |

**Dependencies:** Interaction engine (shipped), interaction centrality scores (Epic 1.4).
**Prework:** Evaluate visualization library options (d3-force vs. react-force-graph vs. vis.js) for performance with 100-card decks (up to ~4,950 potential edges).

---

#### Epic 3.2: Advanced Goldfish Analytics
> *Build on the goldfish simulator with game-plan-aware simulation and win condition tracking.*

**Business Value:** The basic goldfish simulator (Epic 2.1) tracks mana development. Advanced analytics add game-plan awareness: "When does this deck typically assemble its combo?", "What percentage of games produce a board state that threatens a win by turn 8?", "How often does this deck stall out?"

**Stories:**
| Story | Points | Description |
|---|---|---|
| As a deckbuilder, I want to see how often my deck assembles its primary combo by turn N | L | Track combo piece assembly across simulations |
| As a deckbuilder, I want commander tax modeled in simulation (re-cast tracking) | M | Track commander deaths and re-casts with +{2} tax |
| As a deckbuilder, I want to see board state snapshots at key turns (T3, T5, T8) | M | Capture and display average board composition at milestone turns |
| As a deckbuilder, I want to compare goldfish results between two deck versions | L | Side-by-side goldfish metric comparison |

**Dependencies:** Goldfish Simulator (Epic 2.1), Known Combos (shipped).
**Prework:** Define "win condition assembled" heuristics for different archetypes.

---

#### Epic 3.3: Full Export & Share Suite
> *Complete the export story with image capture and enhanced share URLs.*

**Business Value:** Discord sharing is the primary social loop for Commander players. The Discord export exists but image export (shareable summary cards for social media) and enhanced share URLs (recipients see full analysis without re-enriching) are not yet built.

**Stories:**
| Story | Points | Description |
|---|---|---|
| As a user, I want to save my deck analysis as a PNG summary card | L | html2canvas or similar DOM-to-canvas rendering of a compact analysis summary |
| As a user, I want share URL recipients to see analysis without re-enriching | M | Enhanced share URL encoding that includes analysis results |
| As a user, I want to export analysis as JSON for programmatic use | S | JSON export of `DeckAnalysisResults` |

**Dependencies:** Export framework (Discord export shipped). Plan exists at `docs/plans/export-share-reports.md`.
**Prework:** Evaluate html2canvas vs. Satori for image generation.

---

#### Epic 3.4: Eminence and Command Zone Interactions
> *Feed command zone abilities into the interaction engine for more complete analysis.*

**Business Value:** Eminence commanders (Inalla, Edgar Markov, The Ur-Dragon, Arahbo) have abilities that function from the command zone before the commander is even cast. These create interactions with every relevant creature in the deck but are currently not detected because the interaction engine only evaluates battlefield-state interactions.

**Stories:**
| Story | Points | Description |
|---|---|---|
| As a user with an eminence commander, I want interactions detected between my commander's command zone ability and my creatures | M | Feed eminence abilities from CardProfile into interaction detector |
| As a user, I want companion restriction validation against my deck composition | M | Parse companion restriction text, validate deck meets constraint |
| As a user, I want "Partner with [name]" validated (not just generic Partner) | S | Parse partner-with text, verify both partners present |

**Dependencies:** Interaction engine (shipped), commander validation (shipped).
**Prework:** None -- eminence abilities already extracted to CardProfile.

---

### Phase 4: Ecosystem and Community (Ongoing)

#### Epic 4.1: User Accounts and Saved Decks
> *Enable persistent deck storage, history tracking, and personalized recommendations.*

**Business Value:** Currently every analysis is ephemeral. Users must re-import and re-enrich each visit. Saved decks enable: analysis history, iteration tracking, and personalized recommendations. This is the foundation for community features.

**Stories:**
| Story | Points | Description |
|---|---|---|
| As a user, I want to save my deck analysis to my account for later access | XL | Auth system (passwordless), database for deck storage, dashboard page |
| As a user, I want to see my deck edit history and how analysis metrics changed over time | L | Version tracking with metric snapshots |
| As a user, I want to load a previously saved deck without re-importing | M | Deck retrieval from database, skip enrichment if cached |

**Dependencies:** None architecturally, but large infrastructure scope.
**Prework:** Database selection (Supabase, PlanetScale, or Turso), auth provider selection, plan exists at `docs/plans/passwordless-auth.md`.

---

#### Epic 4.2: Community Deck Database
> *Enable deck sharing, browsing, and discovery within the app.*

**Business Value:** Transforms the app from a single-user tool into a platform. Shared decks with analysis data create a unique dataset: decks with interaction maps, composition scores, and power levels. This data is unavailable on any other platform.

**Stories:**
| Story | Points | Description |
|---|---|---|
| As a user, I want to publish my deck analysis for others to view | L | Public deck pages with full analysis results |
| As a user, I want to browse decks by commander, power level, or bracket | L | Search and filter interface, indexed by analysis metadata |
| As a user, I want to see aggregate statistics across all analyzed decks | XL | Analytics pipeline: average composition by commander, popular synergy axes, etc. |

**Dependencies:** User Accounts (Epic 4.1).
**Prework:** Data modeling for community features, moderation policy.

---

#### Epic 4.3: Continuous Lexicon Maintenance
> *Keep the interaction engine's keyword database and lexer current with new set releases.*

**Business Value:** Every MTG set introduces 1-3 new keyword mechanics. Without ongoing maintenance, the interaction engine's coverage degrades over time. This is an ongoing operational concern, not a one-time feature.

**Stories:**
| Story | Points | Description |
|---|---|---|
| As a maintainer, I want a process to add new keywords when a set releases | S (per set) | Keyword database entry + unit tests per new mechanic |
| As a maintainer, I want automated coverage reports showing what % of cards produce valid profiles | M | Script that runs capability extractor on Scryfall bulk data and reports parse failures |
| As a maintainer, I want the lexer alias map to stay current with oracle text wording changes | S (per set) | Monitor Scryfall oracle text updates for alias drift |

**Dependencies:** Interaction engine (shipped).
**Prework:** Set up Scryfall bulk data pipeline for automated testing.

---

## Dependency Graph

```
Phase 0 (Prework, before Phase 1):
  UX Nav Redesign ─────────────────── (independent, unblocks all future tabs)
  Interaction Engine Rules Fixes ──── (independent, P0 accuracy fixes)

Phase 1 (Quick Wins, 1-2 sprints):
  Epic 1.1: Card Swap Suggestions ───── (independent, composition scorecard shipped)
  Epic 1.2: Deck Comparison ─────────── (independent)
  Epic 1.3: Interaction Presentation ── (independent)

Phase 2 (Core Engine, 2-4 sprints):
  Epic 2.1: Goldfish Simulator ──────── ✅ SHIPPED
  Epic 2.2: Lexicon Expansion ──────── ✅ SHIPPED
  Epic 2.3: Condition Satisfiability ── ✅ SHIPPED

Phase 3 (Advanced, 4-8 sprints):
  Epic 3.1: Interaction Visualization ── depends on Epic 1.3 (centrality scores)
  Epic 3.2: Advanced Goldfish ────────── depends on Epic 2.1 (goldfish simulator)
  Epic 3.3: Export & Share Suite ──────── depends on existing Discord export (shipped)
  Epic 3.4: Eminence & Command Zone ──── depends on interaction engine (shipped)

Phase 4 (Ecosystem, ongoing):
  Epic 4.1: User Accounts ───────────── (independent, infrastructure)
  Epic 4.2: Community Database ──────── depends on Epic 4.1
  Epic 4.3: Lexicon Maintenance ─────── (ongoing, per-set)
```

## Priority Ranking Rationale

0. ~~**UX Nav Redesign + Interaction Engine Rules Fixes**~~ ✅ Complete.
1. ~~**Card Swap Suggestions** (Epic 1.1)~~ ✅ Shipped with deck-context-aware filtering and land swap recommendations.
2. ~~**Interaction Presentation** (Epic 1.3)~~ ✅ Shipped with centrality scores, floating removal impact panel, and citation links.
3. ~~**Deck Comparison** (Epic 1.2)~~ ✅ Shipped with editable deck names and back navigation.
4. ~~**Goldfish Simulator** (Epic 2.1)~~ ✅ Shipped with Monte Carlo simulation, mana development stats, opening hand evaluation, and turn-by-turn timeline.
5. ~~**Lexicon Expansion** (Epic 2.2)~~ ✅ Shipped with Saga, Class, Room parsing, and connive/discover/bargain/incubate/craft/daybound keywords.
6. ~~**Condition Satisfiability** (Epic 2.3)~~ ✅ Shipped with condition AST parser and deck-aware satisfaction scoring.
7. **Interaction Visualization** (Epic 3.1) -- Next priority. Graph and heatmap views of card interactions.
8. **Remaining epics** follow dependency ordering.

*Note: Moxfield Direct Import deferred due to API constraints.*

---

## Sources

- [MTG-Mana-Simulator (GitHub)](https://github.com/TiesWestendorp/MTG-Mana-Simulator) -- Monte Carlo mana simulation methodology
- [ScryCheck](https://scrycheck.com/) -- 5-vector Commander power level analysis
- [DeckCheck Power Level Methodology](https://deckcheck.co/blog/on-power) -- Holistic power level analysis approach
- [EDHREC](https://edhrec.com/) -- Statistical card recommendations and synergy scoring
- [Archidekt](https://archidekt.com/) -- Playtester 2.0 with game logs
- [Moxfield](https://moxfield.com/) -- Deck building with manual tagging and playtester
- [Commander Spellbook](https://commanderspellbook.com/) -- 78,000+ verified combos
- [Salubrious Snail Manabase Tool](https://www.salubrioussnail.com/manabase-tool) -- Mana base spell support analysis
- [AetherHub Hypergeometric Calculator](https://aetherhub.com/Apps/HyperGeometric) -- Draw probability math
- [EDH Combo Finder](https://combo-finder.com/) -- Decklist combo detection tool
