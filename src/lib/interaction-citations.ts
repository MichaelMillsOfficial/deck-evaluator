/**
 * Interaction Citations
 *
 * Extracts oracle text snippets from card profiles to support the mechanical
 * description of a given interaction. Three tiers of citation:
 *
 *   1. "ability"   — oracle text sentence containing the relevant keyword
 *   2. "typeline"  — for interactions implicit in the card's type line
 *   3. "rule"      — fundamental game rules (all creatures can attack, etc.)
 *
 * Citations are lazy-computed per interaction so the UI only pays the cost
 * when the user expands a "Show rules text" toggle.
 */

import type {
  Interaction,
  CardProfile,
} from "@/lib/interaction-engine/types";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type CitationTier = "ability" | "typeline" | "rule";

export interface OracleTextCitation {
  cardName: string;
  snippet: string;
  /** Character offset of snippet in rawOracleText (-1 for type-line / rule) */
  startIndex: number;
  endIndex: number;
  tier: CitationTier;
}

export interface InteractionCitation {
  interaction: Interaction;
  citations: OracleTextCitation[];
}

// ═══════════════════════════════════════════════════════════════
// KEYWORD EXTRACTION
// ═══════════════════════════════════════════════════════════════

/**
 * Extract MTG-relevant mechanical keywords from an interaction's mechanical
 * description. Returns lower-cased keyword strings to match against oracle
 * text (case-insensitive).
 */
export function extractMechanicalKeywords(mechanical: string): string[] {
  if (!mechanical) return [];

  const keywords: string[] = [];

  // Multi-word phrases — must be checked before single words to avoid
  // partial matches stealing the sub-word
  const multiWordPatterns = [
    "enters the battlefield",
    "leaves the battlefield",
    "enters play",
    "goes to the graveyard",
    "put into the graveyard",
    "sacrifice a",
    "sacrifice ",
    "draw a card",
    "draw cards",
    "lose life",
    "gain life",
    "deal damage",
    "deals damage",
    "tap target",
    "untap target",
    "cast a spell",
    "cast a creature",
    "create a token",
    "creates a token",
    "put a counter",
    "put a +1/+1 counter",
    "whenever you",
    "at the beginning of",
    "end of turn",
    "return to hand",
    "return from",
    "search your library",
    "tutor",
    "discard a card",
  ];

  const lower = mechanical.toLowerCase();

  for (const phrase of multiWordPatterns) {
    if (lower.includes(phrase)) {
      keywords.push(phrase);
    }
  }

  // Single-word MTG mechanical terms
  const singleWordTerms = [
    "sacrifice",
    "graveyard",
    "trigger",
    "triggered",
    "activate",
    "activated",
    "flash",
    "haste",
    "vigilance",
    "lifelink",
    "deathtouch",
    "trample",
    "flying",
    "menace",
    "hexproof",
    "indestructible",
    "protection",
    "regenerate",
    "exile",
    "token",
    "counter",
    "tap",
    "untap",
    "cast",
    "artifact",
    "enchantment",
    "creature",
    "land",
    "instant",
    "sorcery",
    "mana",
    "dies",
    "combat",
    "attack",
    "block",
    "tutor",
    "recur",
    "recursion",
    "proliferate",
    "scry",
    "surveil",
    "extort",
    "dredge",
    "delve",
    "convoke",
    "emerge",
    "escape",
    "kicker",
    "cascade",
    "storm",
    "copy",
    "cloak",
    "ward",
    "annihilator",
  ];

  for (const term of singleWordTerms) {
    if (lower.includes(term) && !keywords.includes(term)) {
      keywords.push(term);
    }
  }

  return keywords;
}

// ═══════════════════════════════════════════════════════════════
// ORACLE SNIPPET FINDER
// ═══════════════════════════════════════════════════════════════

/**
 * Search an oracle text string for a sentence (or line) that contains any
 * of the given keywords. Returns the first matching sentence as a citation,
 * or null if none match.
 *
 * Oracle text is split on ". " and newlines to get individual sentences/lines.
 * Returns the shortest sentence that contains a keyword, to avoid huge blobs.
 */
export function findOracleSnippet(
  oracleText: string,
  keywords: string[]
): Omit<OracleTextCitation, "cardName" | "tier"> | null {
  if (!oracleText || keywords.length === 0) return null;

  // Split into sentences — handle newlines and period-space delimiters
  const sentences: { text: string; start: number }[] = [];
  let pos = 0;
  // Split on newlines first, then on ". "
  const lines = oracleText.split("\n");
  for (const line of lines) {
    // Further split each line on ". "
    const parts = line.split(". ");
    for (let i = 0; i < parts.length; i++) {
      const raw = parts[i].trim();
      if (!raw) {
        pos += parts[i].length + 2; // ". "
        continue;
      }
      // Reconstruct trailing period for non-last parts
      const text = i < parts.length - 1 ? raw + "." : raw;
      sentences.push({ text, start: pos });
      pos += parts[i].length + (i < parts.length - 1 ? 2 : 1); // ". " or "\n"
    }
    pos += 1; // "\n"
  }

  // Find the first sentence containing any keyword
  const lowerKeywords = keywords.map((k) => k.toLowerCase());
  for (const { text, start } of sentences) {
    const lowerText = text.toLowerCase();
    for (const kw of lowerKeywords) {
      if (lowerText.includes(kw)) {
        return {
          snippet: text,
          startIndex: start,
          endIndex: start + text.length,
        };
      }
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// CITATION EXTRACTION
// ═══════════════════════════════════════════════════════════════

/**
 * Extract oracle text citations for a single interaction.
 *
 * For each card in the interaction pair:
 * 1. Extract keywords from the mechanical description
 * 2. Search the card's rawOracleText for a matching sentence
 * 3. Fall back to type-line tier if the interaction type implies a type-based
 *    interaction (e.g., "enables" can be type-implicit)
 * 4. Deduplicate identical snippets
 *
 * Returns an empty array if neither card has matching oracle text.
 */
export function extractCitations(
  interaction: Interaction,
  profiles: Record<string, CardProfile>
): OracleTextCitation[] {
  const keywords = extractMechanicalKeywords(interaction.mechanical);
  const citations: OracleTextCitation[] = [];
  const seenSnippets = new Set<string>();

  for (const cardName of interaction.cards) {
    const profile = profiles[cardName];
    if (!profile) continue;

    // Tier 1: explicit ability in oracle text
    const oracleText = profile.rawOracleText;
    if (oracleText && keywords.length > 0) {
      const match = findOracleSnippet(oracleText, keywords);
      if (match && !seenSnippets.has(match.snippet)) {
        seenSnippets.add(match.snippet);
        citations.push({
          cardName,
          snippet: match.snippet,
          startIndex: match.startIndex,
          endIndex: match.endIndex,
          tier: "ability",
        });
        continue; // Found ability citation — skip type-line for this card
      }
    }

    // Tier 2: type-line implicit interaction
    // Use type-line when oracle text is absent or no keyword matched, and the
    // interaction type is type-based (e.g., being a creature, artifact, etc.)
    const typeLineCitation = tryTypeLineCitation(cardName, profile, interaction);
    if (typeLineCitation && !seenSnippets.has(typeLineCitation.snippet)) {
      seenSnippets.add(typeLineCitation.snippet);
      citations.push(typeLineCitation);
    }
  }

  return citations;
}

// ═══════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Attempt to generate a type-line citation for implicit type-based interactions.
 * Returns null if the interaction doesn't benefit from a type-line citation.
 */
function tryTypeLineCitation(
  cardName: string,
  profile: CardProfile,
  interaction: Interaction
): OracleTextCitation | null {
  const types = profile.cardTypes;
  if (!types || types.length === 0) return null;

  const typeLine = [
    ...(profile.supertypes ?? []),
    ...types,
    ...(profile.subtypes ?? []),
  ].join(" ");

  if (!typeLine) return null;

  // Only emit type-line citations for interaction types that are typically
  // implicit from card type (being a creature/artifact/enchantment)
  const typeImplicitInteractionTypes: (typeof interaction.type)[] = [
    "enables",
    "triggers",
    "recurs",
    "reduces_cost",
  ];

  if (!typeImplicitInteractionTypes.includes(interaction.type)) return null;

  return {
    cardName,
    snippet: typeLine,
    startIndex: -1,
    endIndex: -1,
    tier: "typeline",
  };
}
