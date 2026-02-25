# Deck Evaluator Feature Research

> Comprehensive survey of MTG deck evaluation tools, community heuristics, and feature gap analysis to inform the roadmap for this project.

## Table of Contents

1. [Current Project State](#current-project-state)
2. [Existing Tools Survey](#existing-tools-survey)
3. [Community Deck-Building Heuristics](#community-deck-building-heuristics)
4. [Common Pain Points & Gaps](#common-pain-points--gaps)
5. [Feature Opportunities](#feature-opportunities)
6. [Recommended Priorities](#recommended-priorities)

---

## Current Project State

### What's Already Built

The app currently handles **deck import and card enrichment**:

- **3-tab import**: Manual text paste, Moxfield URL, Archidekt URL
- **Decklist parser** (`decklist-parser.ts`): Handles `"Nx Card Name"` format with section headers (Commander, Mainboard, Sideboard)
- **Archidekt API integration** (`archidekt.ts`): Fetches deck data from Archidekt URLs, normalizes to `DeckData`
- **Scryfall enrichment** (`scryfall.ts`): Batch card lookup via Scryfall collection API, returns `EnrichedCard` with full oracle data
- **Heuristic card tagging** (`card-tags.ts`): 16 functional tags (Ramp, Removal, Board Wipe, Card Draw, Tutor, Counter, Combo Piece, Recursion, Protection, Evasion, Token Generator, Lifegain, Land Destruction, Stax, Extra Turn, Anthem) using regex-based oracle text analysis
- **Mana cost rendering** (`mana.ts`, `ManaCost.tsx`, `ManaSymbol.tsx`): Full MTG symbol rendering via Scryfall CDN SVGs
- **Oracle text rendering** (`oracle.ts`, `OracleText.tsx`): Inline symbol replacement in card text
- **Expandable card rows** (`EnrichedCardRow.tsx`): Table/list view with disclosure pattern

### What's In Progress (Planned but Not Yet Shipped)

From existing plan files in `docs/plans/`:

- **Mana curve analysis** (`mana-curve-analysis.md`): Bar chart visualization, average CMC, curve stats, section-level breakdowns
- **Color distribution analysis** (`color-distribution-analysis.md`): Color pie chart, mana base efficiency ratio (production vs. demand), devotion analysis
- **Land base efficiency** (`land-base-efficiency.md`): Land count evaluation, color coverage scoring, tap-land ratio, utility land identification
- **Card synergy mapping** (`card-synergy-mapping.md`): Synergy axis detection, known combo registry, synergy scoring engine, synergy matrix visualization
- **Improved card tags** (`improve-card-tags.md`): Enhanced regex patterns, keyword-based detection, multi-tag support

### What's NOT Built Yet

- Power level estimation
- Deck composition validation (slot count recommendations)
- Mana base recommendations
- Card swap suggestions
- Budget analysis
- Win condition identification
- Opening hand simulation
- Combo detection (plan exists but not implemented)
- Metagame context
- Deck comparison

---

## Existing Tools Survey

### EDHREC — The Data-Driven Recommendation Engine

**Core Strengths**: Statistical card recommendations, synergy scoring, community data aggregation.

| Feature | Details |
|---------|---------|
| **Synergy Score** | `(% decks card appears in for this commander) − (% decks card appears in for this color identity)`. Surfaces "signature cards" vs. generically strong staples. A card at +75% synergy is far more common with that specific commander than in other decks of the same colors. |
| **Salt Score** | Annual community survey (0–4 scale) rating how frustrating a card is to play against. Summed per-deck. Top salt 2025: Stasis, Winter Orb, Tergrid, Rhystic Study. Unique to EDHREC. |
| **Popularity Score** | Adjusts for commander age — newer commanders with the same deck count score higher. |
| **Card Inclusion Rate** | What % of decks for a given commander include each card. |
| **Theme/Tribe Filtering** | Dynamically adjusts recommendations by strategy (artifacts, +1/+1 counters, graveyard, infect) and creature type (Elves, Zombies). |
| **Budget Filtering** | "Cheap" vs. "Expensive" modes restrict recommendations by price. |
| **Average Deck** | Generates a statistical "average deck" for each commander. |
| **Combo Integration** | Pulls combo data from Commander Spellbook (same parent company). |
| **Landbase Page** | Lands organized by cycle (fetches, shocks, etc.) or ranked by popularity. |
| **Functional Categories** | Recommends 8–12 Ramp, 8–10 Card Draw, 8–10 Interaction/Removal (including 2 wraths), plus win conditions. |
| **Data Retention** | 2-year rolling window ensures recommendations reflect current play patterns. |

**Key Insight for Our Project**: EDHREC's synergy score formula is elegant but requires a massive dataset of real decklists. We can't replicate this statistically, but we *can* approximate synergy through card text analysis (which our `synergy-axes.ts` already begins to do). Their functional category recommendations (8–12 ramp, 8–12 draw, etc.) are directly actionable as deck composition validation targets.

### Moxfield — The Popular Deck Builder

**Core Strengths**: Clean UX, full-featured playtester, global custom tags, EDHREC integration.

| Feature | Details |
|---------|---------|
| **Mana Curve** | Bar chart splitting spells vs. permanents; also per-color. |
| **Color Distribution** | Compares colors needed vs. colors produced by mana base. |
| **Average CMC** | With/without lands. Also "without Ad Nauseam" for cEDH. |
| **Opening Hand Stats** | Average lands in opening 7; % chance of playing on curve. |
| **Custom Tags (Global)** | User-defined functional categories (Ramp, Removal, Draw) that persist across decks. Users manually tag cards. |
| **Packages** | Save groups of commonly-used-together cards for quick insertion. |
| **Playtester** | Full sandbox with hotkeys, drag-and-drop, `!draw`, `!mulligan`, `!shuffle`, `!combo` commands. |
| **Sample Hands** | Quick 7-card hand generation. |
| **EDHREC Integration** | Full recommendation data in the editor; daily data sync. |
| **Deck Comparison** | Highlights differences between two builds. |

**Key Insight**: Moxfield's custom tagging is *manual* — users must tag each card themselves. Our automated heuristic tagging in `card-tags.ts` fills this gap automatically. Their color distribution chart (need vs. produce) is exactly what our `color-distribution-analysis.md` plan describes.

### Archidekt — Visual Builder with Advanced Stats

**Core Strengths**: Drag-and-drop building, expanded stats panel, advanced playtester with logs.

| Feature | Details |
|---------|---------|
| **Stats Panel (2024)** | Four chart categories: color production vs. cost, mana curve, type distribution, rarity breakdown. Pinnable on desktop. |
| **Salt Sum** | Total EDHREC salt score with comparison graph against other Commander decks on Archidekt. |
| **Commander Spellbook** | Active integration surfaces combos directly on deck pages. |
| **Playtester 2.0** | London mulligan, customizable card sizes, sleeves/playmats, foil overlays, coin flip, dice rolling. |
| **Playtester Logs (2025)** | Tracks all card moves during playtesting. Aggregated charts for mana production, cards drawn/milled, total power, mana value of spells cast. Filterable by type/category. Exportable as JSON. |
| **Deck Comparison** | Side-by-side analysis highlighting overlap/differences. |

**Key Insight**: Archidekt's playtester logs are the most sophisticated simulation feature in the ecosystem — tracking actual game-state metrics over simulated turns. Their color production-vs-cost chart is the gold standard for mana base visualization.

### MTGGoldfish — Metagame & Tournament Tracker

**Core Strengths**: Competitive format metagame data, win rate statistics, price tracking.

| Feature | Details |
|---------|---------|
| **Metagame % Breakdowns** | Deck archetypes as % of meta for every competitive format. |
| **Win Rates** | Wilson confidence intervals for statistical rigor. |
| **Head-to-Head Matchups** | How specific archetypes perform against each other. |
| **Popularity Over Time** | Tracks deck presence across time periods. |
| **Budget Alternatives** | $25 upgrade paths for precons, budget deck series. |
| **Format Staples** | Price history for staple cards across formats. |

**Key Insight**: MTGGoldfish is the only tool with rigorous competitive win-rate data. This data is exclusive to tournament results and Arena tracking — not replicable for casual/Commander play. However, their "format staples" concept could inform a "commonly played cards" reference.

### Scryfall — Card Search Engine & Data Layer

**Core Strengths**: Most powerful card search syntax in the ecosystem, community oracle tags, open API.

| Feature | Details |
|---------|---------|
| **Oracle Tags (otags)** | Community-maintained functional tags: `otag:removal`, `otag:ramp`, `otag:card-advantage`, `otag:tutor`. Searchable inline. |
| **Search Syntax** | Color identity (`id:`), oracle text (`o:`), type (`t:`), mana value (`mv:`), power/toughness, keywords, rarity, price, set type, reprints — with full boolean logic and regex support. |
| **Art Tags** | Visual content tags for card art. |
| **API** | Powers data for Moxfield, Archidekt, EDHREC, DeckLens, and this project. |

**Key Insight**: Scryfall's oracle tags (`otag:`) are the closest thing to a canonical functional card classification system. Our `card-tags.ts` heuristics could be validated against these tags. However, otags are community-maintained and not available via the standard API bulk data — they require Tagger access.

### Commander Spellbook — Combo Database

**Core Strengths**: 78,000+ verified EDH combos, "Find My Combos" feature, bracket estimation.

| Feature | Details |
|---------|---------|
| **Combo Database** | 78,000+ verified combos with prerequisites, steps, and results. |
| **Find My Combos** | Paste a decklist → discover all combos + near-combos (1–2 cards away). |
| **Advanced Search** | Filter by cards, types, results, prerequisites, color identity, tags. |
| **Bracket Estimation API** | Classify combos by Commander bracket level (Casual → Ruthless). |
| **Open Source** | Backend on GitHub. |
| **Integrations** | EDHREC, Archidekt, DeckLens, Combo Finder. |

**Key Insight**: Commander Spellbook is the definitive combo detection source. Our `known-combos.ts` registry is a small manual subset — for serious combo detection, we should consider integrating with Commander Spellbook's API or dataset. Their bracket estimation API could also feed into power level analysis.

### Other Notable Tools

| Tool | Standout Feature |
|------|-----------------|
| **TappedOut** | "Hub" system for deck-level strategy tagging; community power level tier lists |
| **ManaBox** | Mobile-first with card scanner; bracket calculation |
| **DeckStats.net** | Card probability calculator; custom property overrides for stats |
| **DeckLens** | Client-side only (zero backend); "Deck DNA" fingerprint; hypergeometric calculator; Commander Spellbook integration |
| **TopDecked** | AI-driven card recommendations trained on thousands of decks; card synergy sections |
| **AetherHub** | Hypergeometric calculator; mana calculator recommending land counts; MTGA companion app |
| **Untapped.gg** | Arena overlay with draw probabilities, opponent tracking, matchup statistics, personal win rates |
| **EDHPowerLevel.com** | Card demand-based power level calculation |
| **DeckCheck.co** | Strategy-specific suggestions; targeted swap suggestions to raise/lower power |
| **BrackCheck.com** | Official Commander Bracket system analysis |
| **Salubrious Snail** | Specialized mana base analyzer testing how well lands support spells |

---

## Community Deck-Building Heuristics

### The 8×8 Theory

The most widely-referenced Commander deck composition framework. Created by community member "The Commanders Quarters," it structures a 100-card deck as:

- **8 categories × 8 cards each = 64 non-land spells**
- **36 lands**
- Typical categories: Ramp, Card Draw, Removal, Board Wipes, Threats/Win Conditions, Protection, Recursion, Synergy/Theme pieces

**Variants**: Some builders use 7×9, 9×7, or adjust land count to 35–38 depending on curve and ramp density.

**Key Insight**: This is directly implementable as a deck composition validator — count cards in each functional category and compare to the 8×8 template, flagging categories that are over/under-represented.

### The Command Zone Template (Josh Lee Kwai & Jimmy Wong)

From the popular Command Zone podcast, their recommended starting framework:

| Category | Count | Notes |
|----------|-------|-------|
| Lands | 36–38 | Start at 37, adjust based on curve and ramp |
| Ramp | 10–12 | Mix of mana rocks and land-based ramp |
| Card Draw | 10–12 | Both burst and incremental draw |
| Single-Target Removal | 5–8 | Instant-speed preferred |
| Board Wipes | 3–4 | At least 2 creature wipes |
| Win Conditions | 2–4 | How you actually close games |
| Standalone Threats | 5–8 | Cards good on their own |
| Synergy/Theme | 25–30 | Commander-specific strategy cards |

**Key Insight**: This template is more nuanced than 8×8 and provides specific sub-ranges for interaction types (single-target vs. board wipe). These ranges make excellent validation targets.

### Mana Base Guidelines

Converging wisdom from multiple sources (Frank Karsten's mathematical analysis, EDHREC guides, Command Zone):

| Guideline | Detail |
|-----------|--------|
| **Land Count** | 36–38 for average curves; 33–35 for low-curve aggro/cEDH; 38–40 for high-curve/landfall |
| **Ramp Count** | 8–12 pieces; subtract 1 land per 2 ramp sources above 10 |
| **Color Ratio** | Match land color production to spell color pip demand (the "Karsten method") |
| **Tap Land Limit** | No more than 5–8 lands that enter tapped in a focused deck; casual can tolerate more |
| **Utility Lands** | 3–6 non-mana-producing utility lands (e.g., Rogue's Passage, Command Beacon) |
| **Mana Rocks** | Sol Ring + 4–6 2-CMC rocks is the baseline; more for non-green decks |
| **Color Fixing** | 2-color needs ~5 dual lands; 3-color needs ~10; 4–5 color needs maximum fixing |

**Frank Karsten's Research**: Published mathematical analysis showing exact land counts needed to cast spells on curve. For example, casting a 1WW spell on turn 3 requires ~18 white sources in a 60-card deck. This math scales to Commander with adjustments for 99-card singleton.

### Power Level Assessment Heuristics

Community-developed criteria for estimating Commander deck power (1–10 scale):

| Power Level | Characteristics |
|-------------|----------------|
| **1–3 (Casual)** | Precons, bulk rares, no tutors, no fast mana, high curve (avg CMC 4+), no infinite combos |
| **4–5 (Focused)** | Clear strategy, some optimization, 2–3 tutors, moderate interaction, avg CMC 3.0–3.5 |
| **6–7 (Optimized)** | Efficient curve (avg CMC 2.5–3.0), 4+ tutors, consistent game plan, good mana base, some combos |
| **8–9 (High Power)** | Fast mana (Mana Crypt, Chrome Mox), efficient tutors, multiple win lines, avg CMC < 2.5, heavy interaction |
| **10 (cEDH)** | Optimized for speed, turn 3–5 wins, all best-in-slot cards, max tutors, max fast mana, max interaction |

**Key Factors in Power Assessment**:
- Tutor density (most impactful single factor)
- Fast mana count (Sol Ring, Mana Crypt, Mana Vault, Chrome Mox, etc.)
- Average CMC / mana curve efficiency
- Interaction density and quality
- Number of infinite/deterministic combos
- Win condition speed and redundancy
- Mana base quality (fetch/shock/dual vs. tap lands)

### The "Rule of 8" for Card Draw

Community heuristic that a Commander deck needs approximately 8 card draw effects to maintain hand size throughout a typical game. This breaks down as:

- 3–4 **sustained draw engines** (Phyrexian Arena, Rhystic Study, Sylvan Library)
- 2–3 **burst draw** (Harmonize, Painful Truths, Night's Whisper)
- 1–2 **conditional/modal draw** (cards that draw as a secondary effect)

### Interaction Benchmarks

From multiple content creators and the Commander Advisory Group:

- **Minimum**: 8 pieces of interaction (removal + counterspells)
- **Recommended**: 10–12 pieces
- **Breakdown**: 5–7 targeted removal, 2–3 board wipes, 2–4 counterspells (in blue)
- **Quality markers**: Instant-speed, 2 CMC or less, flexible targets

### Common Commander Deck-Building Mistakes

Aggregated from content creators, forums, and community discussions:

1. **Too few lands** — Running 33 or fewer without compensating ramp
2. **Not enough card draw** — Running out of gas by turn 6–7
3. **Insufficient interaction** — Can't answer opponents' threats
4. **Too many high-CMC cards** — Average CMC above 3.5 without ramp to support it
5. **Not enough win conditions** — Can generate value but can't close games
6. **Mana base doesn't match color needs** — Running equal lands for a splash color vs. a dominant color
7. **Too many "pet cards"** — Cards included for emotional reasons that don't serve the strategy
8. **No board wipe recovery** — All-in on board state with no way to rebuild
9. **Ignoring card advantage** — Trading 1-for-1 without generating net positive resources
10. **Curve too high for ramp count** — High-curve deck with only 6–7 ramp pieces

---

## Common Pain Points & Gaps

### What Players Wish Existing Tools Had

Based on community discussions (Reddit, forums, Discord, content creator feedback):

#### 1. Automated Functional Card Categorization
**The Problem**: Moxfield and Archidekt have custom tagging, but it's entirely manual. EDHREC has synergy scores but not functional categories. No tool automatically tells you "this card is Ramp" or "this card is Removal."

**What Players Want**: Automatic detection of what role each card plays in the deck — without having to manually tag every card.

**Our Position**: Our `card-tags.ts` already does this with 16 heuristic tags. This is a genuine differentiator. No mainstream tool offers automated functional tagging from card text analysis.

#### 2. Deck Composition Validation Against Heuristics
**The Problem**: Players know the "8×8 theory" and Command Zone template but have to manually count cards in each category and compare.

**What Players Want**: "Your deck has 5 ramp sources — the recommended minimum is 8. Consider adding 3 more ramp cards."

**Our Position**: Combining our automated card tags with category count validation would be unique. No existing tool provides this.

#### 3. Mana Base Quality Assessment
**The Problem**: Most tools show color distribution but don't evaluate whether the mana base actually supports the deck's requirements.

**What Players Want**: "Your deck requires 45 colored pips of white but your mana base only produces 30 white — you need more white sources." Also: "You have 8 tap lands, which will slow you down in the early game."

**Our Position**: Our `color-distribution-analysis.md` and `land-base-efficiency.md` plans address this. The production-vs-demand ratio is the key metric most tools show superficially.

#### 4. Power Level Estimation
**The Problem**: Commander power level discussions are the #1 source of pre-game friction. Existing calculators (EDHPowerLevel.com, BrackCheck.com) use opaque formulas that players don't trust.

**What Players Want**: Transparent, explainable power level assessment. "Your deck is estimated at power 6 because: 2 tutors (+1), fast mana Sol Ring (+0.5), average CMC 3.1 (neutral), 3 board wipes (+0.5), 1 infinite combo (+1), efficient mana base (+0.5)."

**Our Position**: We could build a transparent, heuristic-based power level estimator that shows its reasoning. This transparency would be a differentiator over black-box calculators.

#### 5. Synergy Detection Beyond Combos
**The Problem**: Commander Spellbook finds infinite combos, but most synergies aren't combos — they're cards that work well together (e.g., a sacrifice outlet + death trigger creature, or a +1/+1 counter lord + proliferate).

**What Players Want**: "These 3 cards in your deck have strong synergy because they all care about +1/+1 counters." Or: "Your deck has a sacrifice sub-theme with 8 cards that interact."

**Our Position**: Our `synergy-axes.ts` plan addresses exactly this. The synergy axis approach (keyword axes, mechanical axes, tribal axes) is relatively unique — most tools either do no synergy detection or rely on statistical co-occurrence (EDHREC).

#### 6. Card Swap Suggestions
**The Problem**: Players often have a card that underperforms but don't know what to replace it with. EDHREC recommendations aren't specific enough ("this card is popular" ≠ "this card would improve your deck").

**What Players Want**: "Consider swapping [Card X] for [Card Y] because your deck is low on removal and Card Y fills that gap while matching your color identity."

**Our Position**: This requires combining card tagging, deck composition analysis, and a recommendation source. Most complex to implement but very high value.

#### 7. Budget-Aware Analysis
**The Problem**: Many tools show total deck price but don't help with budget optimization.

**What Players Want**: "Your most expensive cards are [list]. Budget alternatives that serve the same role: [list]." Also: "Your deck's power level could increase significantly by upgrading these 5 cards within a $20 budget."

**Our Position**: Scryfall provides price data in `EnrichedCard`. Budget analysis could layer on top of functional tagging.

#### 8. Opening Hand Quality Assessment
**The Problem**: Playtester "sample hand" features exist but don't evaluate hand quality.

**What Players Want**: "This hand has 3 lands, 1 ramp spell, and 2 playable cards on curve — this is a keepable hand." Or aggregate statistics: "Your deck produces a keepable opening hand 72% of the time."

**Our Position**: Combining our card tags with opening hand simulation could produce hand quality scoring. Hypergeometric probability calculations are well-understood math.

### Rule 0 / Social Contract Pain Points

The Commander community's biggest non-tool pain point is **power level miscommunication**:

- Players describe decks as "7/10" when they're really "4/10" or "9/10"
- The 2024 Commander Bracket system (Casual/Low/Mid/High) was introduced to address this but adoption is uneven
- Salt score (EDHREC) helps identify cards that cause negative play experiences
- Players want tools that facilitate honest pre-game conversations about deck power

### Format-Specific Gaps

| Format | Gap |
|--------|-----|
| **Commander/EDH** | Most tools focus here; still lacking automated deck composition validation |
| **Standard/Pioneer/Modern** | MTGGoldfish dominates; gap is in personal deck tuning (vs. metagame netdecks) |
| **Limited (Draft/Sealed)** | Separate domain; Untapped.gg Draftsmith and 17Lands are dominant |
| **cEDH** | Needs different heuristics than casual EDH (turn-clock analysis, interaction density, win-attempt speed) |

---

## Feature Opportunities

### Tier 1: High Impact, Builds on Existing Work

These features leverage what's already built and address the biggest pain points.

#### 1.1 Deck Composition Scorecard
**What**: After importing and tagging a deck, show a scorecard comparing functional category counts against recommended ranges.

**Implementation**:
- Use existing card tags to count cards per category
- Compare against configurable templates (8×8 Theory, Command Zone Template, custom)
- Display as a dashboard with green/yellow/red indicators per category
- Show specific cards in each category for transparency

**Example Output**:
```
Category        Count   Target   Status
Ramp            5       8-12     ⚠ Low (need 3+ more)
Card Draw       9       8-12     ✓ Good
Removal         4       5-8      ⚠ Low (need 1+ more)
Board Wipes     1       2-4      ⚠ Low
Win Conditions  2       2-4      ✓ Good
Lands           35      36-38    ⚠ Slightly low
```

**Dependencies**: Existing card tags, enriched card data
**Competitive Advantage**: No tool does this automatically

#### 1.2 Mana Curve Visualization & Analysis
**What**: Interactive mana curve chart with statistical analysis.

**Implementation**: Already planned in `mana-curve-analysis.md`. Key additions:
- Average CMC (with/without lands)
- Curve shape assessment ("top-heavy," "aggressive," "balanced")
- Comparison to format averages
- Per-color curve breakdown

**Dependencies**: Enriched card data (mana costs already available)

#### 1.3 Color Distribution & Mana Base Efficiency
**What**: Compare color pip demand against mana production capacity.

**Implementation**: Already planned in `color-distribution-analysis.md` and `land-base-efficiency.md`. Key metrics:
- Color pips needed (demand) vs. colors produced (supply) as ratio
- Tap land count and percentage
- Utility land identification
- Color fixing sufficiency rating

**Dependencies**: Enriched card data, land type classification

#### 1.4 Enhanced Card Tagging
**What**: Improve accuracy and coverage of heuristic card tags.

**Implementation**: Already planned in `improve-card-tags.md`. Key improvements:
- Keyword-based detection (Scryfall `keywords` field, not just oracle text regex)
- Multi-tag support (a card can be both "Removal" and "Card Draw")
- Confidence scoring per tag
- Tag validation against Scryfall oracle tags where possible

**Dependencies**: Existing `card-tags.ts`, Scryfall keyword data

### Tier 2: Medium Impact, Moderate Effort

#### 2.1 Power Level Estimator
**What**: Transparent, explainable power level score for Commander decks.

**Scoring Factors** (weighted heuristics):
| Factor | Weight | Detection Method |
|--------|--------|------------------|
| Tutor density | High | Card tag "Tutor" count |
| Fast mana count | High | Detect Sol Ring, Mana Crypt, Mana Vault, Chrome Mox, Mox Diamond, Jeweled Lotus, etc. by name |
| Average CMC | Medium | Computed from enriched data |
| Interaction density | Medium | Card tags "Removal" + "Counter" + "Board Wipe" |
| Infinite combo count | Medium | Known combos registry |
| Mana base quality | Medium | Land base efficiency score |
| Card draw density | Low | Card tag "Card Draw" count |
| Win condition speed | Low | CMC of cards tagged as win conditions |

**Output**: Score 1–10 with breakdown showing which factors contributed and how.

**Competitive Advantage**: Transparent reasoning (vs. black-box calculators). Explainability builds trust.

#### 2.2 Synergy Detection Engine
**What**: Identify cards that work together beyond infinite combos.

**Implementation**: Already planned in `card-synergy-mapping.md`. Synergy axes:
- **Keyword synergy**: Cards sharing mechanical keywords (e.g., all "proliferate" cards synergize with +1/+1 counter cards)
- **Tribal synergy**: Cards sharing creature types with tribal payoffs
- **Sacrifice synergy**: Sacrifice outlets + death triggers + recursion
- **Token synergy**: Token generators + anthem effects + sacrifice outlets
- **Graveyard synergy**: Self-mill + reanimation + flashback/escape
- **Counter synergy**: +1/+1 counter placement + proliferate + counter payoffs

**Output**: Synergy clusters displayed as groups of related cards with explanation.

#### 2.3 Known Combo Detection
**What**: Identify known infinite/deterministic combos in the deck.

**Implementation**: Already planned in `card-synergy-mapping.md`. Two approaches:
- **Local registry** (`known-combos.ts`): Curated list of common combos (already exists in plan)
- **Commander Spellbook integration** (future): API integration for 78,000+ combos

**Output**: List of detected combos with explanation of how they work.

#### 2.4 Opening Hand Simulator
**What**: Draw sample opening hands and evaluate their quality.

**Implementation**:
- Random 7-card hand from deck
- Mulligan support (London mulligan: draw 7, put N back on bottom)
- Hand quality score based on: land count (2–4 ideal), ramp availability, curve playability, color requirements met
- Aggregate statistics: "Keepable hand rate: X% over 1000 simulations"

**Dependencies**: Full decklist, card tags, mana costs

### Tier 3: High Impact, High Effort

#### 3.1 Card Swap Suggestions
**What**: Recommend specific card additions/removals to improve the deck.

**Implementation approaches**:
- **Category-based**: "You need more Ramp — here are cards in your color identity tagged as Ramp, sorted by popularity/price"
- **Upgrade-based**: "This card has a strictly better version: [upgrade]"
- **Budget-based**: "This $30 card could be replaced with this $2 card that serves the same role"

**Data requirements**: Needs a card pool to recommend from (could use Scryfall search API filtered by color identity + functional tag).

**Dependencies**: Card tags, deck composition analysis, Scryfall search

#### 3.2 Commander Spellbook Integration
**What**: Full integration with Commander Spellbook's combo database.

**Implementation**:
- Submit decklist to Commander Spellbook's "Find My Combos" API
- Display detected combos with prerequisites and steps
- Show near-combos (1–2 cards away from a combo)
- Factor combo count into power level estimation

**Dependencies**: Commander Spellbook API availability, API rate limits

#### 3.3 Deck Comparison
**What**: Compare two decks side-by-side.

**Implementation**:
- Import two decks → show shared cards, unique-to-each cards
- Compare deck composition scorecards
- Compare mana curves, color distributions, power levels
- Useful for: comparing iterations of the same deck, comparing against an "average" build

#### 3.4 Hypergeometric Probability Calculator
**What**: Calculate probability of drawing specific cards or card types by a given turn.

**Implementation**:
- Input: deck size, copies (or count of cards with a tag), cards drawn by turn N
- Output: probability of drawing at least 1, exactly N, etc.
- Pre-computed for common questions: "Probability of 3+ lands in opening hand," "Probability of drawing ramp by turn 3"
- Visual display as probability curves

---

## Feature Comparison: Us vs. Existing Tools

| Feature | EDHREC | Moxfield | Archidekt | MTGGoldfish | DeckLens | **Us (Current)** | **Us (Planned)** |
|---------|--------|----------|-----------|-------------|----------|-------------------|-------------------|
| Deck Import | ✗ | ✓ | ✓ | ✓ | ✓ (URL) | ✓ (text + URLs) | ✓ |
| Scryfall Enrichment | — | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| **Auto Card Tagging** | ✗ | ✗ (manual) | ✗ | ✗ | ✗ | **✓ (16 tags)** | **✓ (enhanced)** |
| Mana Curve | via tools | ✓ | ✓ | ✓ | ✓ | ✗ | **✓** |
| Color Distribution | via tools | ✓ | ✓ | — | ✓ | ✗ | **✓** |
| Mana Base Efficiency | ✗ | basic | ✓ | ✗ | ✗ | ✗ | **✓** |
| **Composition Scorecard** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓ (unique)** |
| **Power Level (transparent)** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓ (unique)** |
| Synergy Detection | ✓ (statistical) | ✗ | via EDHREC | ✗ | basic | ✗ | **✓ (text-based)** |
| Combo Detection | via Spellbook | ✗ | via Spellbook | ✗ | via Spellbook | ✗ | **✓** |
| Card Recommendations | ✓ (core) | via EDHREC | via EDHREC | budget | ✗ | ✗ | future |
| Opening Hand Sim | ✗ | ✓ (playtest) | ✓ (playtest) | ✗ | ✓ | ✗ | **✓** |
| Deck Comparison | ✗ | ✓ | ✓ | ✗ | ✓ | ✗ | future |

**Our Differentiators**:
1. **Automated functional card tagging** — no other tool does this from card text analysis
2. **Deck composition scorecard** — automatic validation against community heuristics
3. **Transparent power level estimation** — shows reasoning, not just a number
4. **Text-based synergy detection** — doesn't require statistical co-occurrence data

---

## Recommended Priorities

### Phase 1: Core Analysis Dashboard (Builds on Existing Plans)

1. **Mana curve visualization** — already planned, high visibility
2. **Color distribution chart** — already planned, pairs with mana curve
3. **Deck composition scorecard** — unique differentiator, uses existing card tags
4. **Enhanced card tagging** — improves accuracy of all downstream analysis

### Phase 2: Deeper Analysis

5. **Mana base efficiency scoring** — already planned, addresses key pain point
6. **Known combo detection** — already planned, enables power level estimation
7. **Synergy axis detection** — already planned, enables synergy clusters display
8. **Power level estimator** — high demand, combines multiple existing signals

### Phase 3: Interactive Features

9. **Opening hand simulator** — relatively self-contained, high fun factor
10. **Card swap suggestions** — highest user value but needs recommendation data source
11. **Deck comparison** — useful for iteration tracking
12. **Hypergeometric probability calculator** — niche but appreciated by analytical players

### Phase 4: External Integrations

13. **Commander Spellbook API** — comprehensive combo detection
14. **Moxfield direct import** — currently routes through text parser
15. **Budget analysis with price data** — Scryfall already provides prices
16. **Export/share analysis reports** — shareable deck analysis URLs

---

## Sources

### Tools & Platforms
- [EDHREC](https://edhrec.com/) — [FAQ](https://edhrec.com/faq) — [Guides](https://edhrec.com/guides/how-to-use-edhrec)
- [Moxfield](https://moxfield.com/) — [Features Wiki](https://github.com/moxfield/moxfield-public/wiki/Features)
- [Archidekt](https://archidekt.com/) — [Landing](https://archidekt.com/landing)
- [MTGGoldfish](https://www.mtggoldfish.com/)
- [Scryfall](https://scryfall.com/) — [Syntax Docs](https://scryfall.com/docs/syntax) — [Tagger Tags](https://scryfall.com/docs/tagger-tags)
- [Commander Spellbook](https://commanderspellbook.com/) — [Find My Combos](https://commanderspellbook.com/find-my-combos/)
- [DeckLens](https://decklens.app/)
- [TappedOut](https://tappedout.net/)
- [ManaBox](https://manabox.app/)
- [DeckStats.net](https://deckstats.net/)
- [TopDecked](https://www.topdecked.com/)
- [AetherHub](https://aetherhub.com/)
- [Untapped.gg](https://mtga.untapped.gg/)
- [EDHPowerLevel.com](https://edhpowerlevel.com/)
- [DeckCheck.co](https://deckcheck.co/)
- [BrackCheck.com](https://brackcheck.com/)
- [Salubrious Snail Manabase Tool](https://www.salubrioussnail.com/manabase-tool)

### Community Heuristics & Analysis
- [Frank Karsten - How Many Colored Mana Sources](https://strategy.channelfireball.com/all-strategy/mtg/channelmagic-articles/how-many-colored-mana-sources-do-you-need-to-consistently-cast-your-spells-a-guilds-of-ravnica-update/) — Mathematical mana base analysis
- [EDHREC - How to Build a Commander Deck](https://edhrec.com/articles/how-to-build-a-commander-deck)
- [EDHREC - Foundations: How to Build Mana Bases](https://edhrec.com/articles/foundations-how-to-build-mana-bases)
- [Command Zone Deck Template](https://www.youtube.com/@commandzone) — 10 ramp, 10 draw, 5–8 removal framework
- [Draftsim - EDH Power Level Guide](https://draftsim.com/edh-power-level/)
- [Card Kingdom Blog - EDHREC Guide](https://blog.cardkingdom.com/edhrec-finding-the-best-commander-deck/)
- [Commander's Herald - Scryfall Primer](https://commandersherald.com/the-ultimate-scryfall-primer/)
- [Lucky Paper - Searching with Scryfall](https://luckypaper.co/articles/searching-with-scryfall-magic-at-your-fingertips/)
