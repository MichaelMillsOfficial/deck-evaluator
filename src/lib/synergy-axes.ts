import type { EnrichedCard } from "./types";
import { CREATURE_TYPE_PATTERN } from "./creature-types";

export interface SynergyAxisDefinition {
  id: string;
  name: string;
  description: string;
  color: { bg: string; text: string };
  detect: (card: EnrichedCard) => number;
  conflictsWith?: string[];
}

// --- Counters ---
const COUNTER_PLACE_RE = /\+1\/\+1 counter/i;
const COUNTER_DOUBLER_RE = /twice that many.+?counter/i;
const COUNTER_PROLIFERATE_RE = /\bproliferate\b/i;
const COUNTER_CHARGE_RE = /charge counter/i;
const COUNTER_MODULAR_RE = /\bmodular\b/i;

// --- Tokens ---
const TOKEN_CREATE_RE = /\bcreate\b.+?\btoken/i;
const TOKEN_DOUBLER_RE = /twice that many.+?token/i;
const TOKEN_POPULATE_RE = /\bpopulate\b/i;

// --- Graveyard ---
const GY_REANIMATE_RE =
  /(?:return|put).+?(?:from.+?graveyard|graveyard.+?(?:to|onto)).+?battlefield/i;
const GY_FROM_GY_RE = /from.+?(?:your |a )?graveyard/i;
const GY_MILL_RE = /\bmill\b/i;
const GY_INTO_GY_RE = /(?:put|into).+?(?:your )?graveyard/i;
const GY_KEYWORDS = new Set([
  "Flashback",
  "Delve",
  "Unearth",
  "Dredge",
  "Escape",
  "Embalm",
  "Eternalize",
  "Aftermath",
]);

// --- Graveyard Hate ---
// Only match global graveyard exile — "all graveyards" or "each opponent's graveyard"
// NOT "target card from a graveyard" or "target player's graveyard"
const GY_HATE_EXILE_RE =
  /exile.+?(?:all cards from all graveyards|each opponent'?s graveyard)/i;
const GY_HATE_INSTEAD_RE = /graveyard.+?exile it instead/i;
const GY_HATE_CANT_RE = /cards? in.+?graveyard.+?can't/i;

// --- Sacrifice ---
const SAC_OUTLET_RE = /\bsacrifice\b.+?(?:a |another )/i;
const SAC_DEATH_TRIGGER_RE = /whenever.+?(?:creature.+?dies|dies)/i;
const SAC_ARISTOCRAT_RE = /whenever you sacrifice/i;
const SAC_KEYWORDS = new Set(["Exploit"]);

// --- Tribal ---
const TRIBAL_CHOSEN_TYPE_LORD_RE =
  /other.+?creatures? you control of the chosen type get \+/i;
const TRIBAL_KINDRED_RE = /^Kindred\b/i;
const TRIBAL_CHOOSE_TYPE_RE = /\bchoose a creature type\b/i;
const TRIBAL_TYPE_MATTERS_RE =
  /(?:creatures? (?:you control )?(?:of the chosen|that share a creature) type)/i;
// Dynamic type-specific patterns built from CREATURE_TYPE_PATTERN
const TRIBAL_TYPE_SPECIFIC_LORD_RE = new RegExp(
  `(?:other )?(?:${CREATURE_TYPE_PATTERN})(?:s| creatures?) you control get \\+`,
  "i"
);
const TRIBAL_TYPE_TRIGGER_RE = new RegExp(
  `\\bwhenever (?:a |an )(?:${CREATURE_TYPE_PATTERN})\\b`,
  "i"
);
const TRIBAL_FOR_EACH_TYPE_RE = new RegExp(
  `\\b(?:for each|number of) (?:${CREATURE_TYPE_PATTERN})s?\\b`,
  "i"
);
const TRIBAL_CREATURE_SPELL_OF_TYPE_RE =
  /creature (?:spell|card)s? (?:of the chosen type|you cast of the chosen type)/i;
const TRIBAL_SHARE_TYPE_RE =
  /shares? (?:at least one |a )?creature type/i;
const TRIBAL_EVERY_TYPE_RE =
  /\bevery creature type\b/i;

// --- Landfall ---
const LANDFALL_TRIGGER_RE =
  /whenever a land enters the battlefield under your control/i;
const LANDFALL_EXTRA_RE = /\badditional land\b/i;
const LANDFALL_FETCH_RE =
  /sacrifice.+?search your library for.+?(?:land|plains|island|swamp|mountain|forest)/i;
const LANDFALL_PLAY_LAND_GY_RE = /play.+?land.+?(?:from your graveyard)/i;

// --- Spellslinger ---
const SPELL_CAST_TRIGGER_RE =
  /whenever you cast.+?(?:instant|sorcery|noncreature)/i;
const SPELL_COST_REDUCE_RE =
  /(?:instant|sorcery).+?(?:spells? you cast )?cost.+?less/i;
const SPELL_COPY_RE = /\bcopy.+?(?:instant|sorcery|spell)\b/i;
const SPELL_MAGECRAFT_RE = /\bmagecraft\b/i;

// --- Artifacts ---
const ARTIFACT_TRIGGER_RE = /whenever.+?artifact.+?enters the battlefield/i;
const ARTIFACT_MATTERS_RE =
  /for each artifact|artifacts? you control|artifact creature/i;
const ARTIFACT_KEYWORDS = new Set(["Affinity", "Metalcraft", "Improvise"]);

// --- Enchantments ---
const ENCHANTMENT_TRIGGER_RE =
  /whenever.+?enchantment.+?enters the battlefield|whenever you cast an enchantment/i;
const ENCHANTMENT_MATTERS_RE =
  /for each enchantment|enchantments? you control/i;
const ENCHANTMENT_KEYWORDS = new Set(["Constellation"]);

// --- Lifegain ---
const LIFEGAIN_TRIGGER_RE = /whenever you gain life/i;
const LIFEGAIN_PAYOFF_RE = /\byou gain.+?\blife\b/i;
const LIFEGAIN_KEYWORDS = new Set(["Lifelink"]);

// --- Supertype Matters ---
const SUPERTYPE_LEGENDARY_CAST_RE =
  /whenever you (?:cast|play) a (?:legendary|historic)/i;
const SUPERTYPE_LEGENDARY_ETB_RE =
  /whenever (?:a|another) legendary.*(?:enters|dies)/i;
const SUPERTYPE_LEGENDARY_STATIC_RE =
  /legendary (?:creature|permanent)s? you control (?:get \+|have)/i;
const SUPERTYPE_LEGENDARY_OTHER_RE =
  /other legendary (?:creature|permanent)s? you control/i;
const SUPERTYPE_LEGENDARY_FOR_EACH_RE =
  /\b(?:for each|each|number of) legendary\b/i;
const SUPERTYPE_LEGENDARY_COST_RE =
  /legendary.*(?:spell|permanent|card)s?.*cost.*less/i;
const SUPERTYPE_LEGENDARY_GRAVEYARD_RE =
  /legendary cards? (?:from|in) your graveyard/i;
const SUPERTYPE_LEGEND_RULE_RE = /\blegend rule\b/i;
const SUPERTYPE_HISTORIC_RE = /\bhistoric\b/i;
const SUPERTYPE_SNOW_BROAD_RE =
  /\bsnow\b[^.]*?\b(?:permanent|creature|land)s?\b/i;
const SUPERTYPE_SNOW_OTHER_RE = /\bother snow\b/i;
const SUPERTYPE_SNOW_TRIGGER_RE = /whenever a snow.*enters|for each snow/i;
const SUPERTYPE_SNOW_MANA_RE = /\{S\}/;

export const SYNERGY_AXES: SynergyAxisDefinition[] = [
  {
    id: "counters",
    name: "Counters",
    description: "+1/+1 counters, proliferate, counter doublers",
    color: { bg: "bg-lime-500/20", text: "text-lime-300" },
    detect(card) {
      const text = card.oracleText;
      let score = 0;
      if (COUNTER_PLACE_RE.test(text)) score += 0.6;
      if (COUNTER_DOUBLER_RE.test(text)) score += 0.4;
      if (COUNTER_PROLIFERATE_RE.test(text) || card.keywords.includes("Proliferate"))
        score += 0.5;
      if (COUNTER_CHARGE_RE.test(text)) score += 0.3;
      if (COUNTER_MODULAR_RE.test(text) || card.keywords.includes("Modular"))
        score += 0.4;
      return Math.min(score, 1);
    },
    conflictsWith: [],
  },
  {
    id: "tokens",
    name: "Tokens",
    description: "Token creation, token doublers, go-wide strategies",
    color: { bg: "bg-amber-500/20", text: "text-amber-300" },
    detect(card) {
      const text = card.oracleText;
      let score = 0;
      if (TOKEN_CREATE_RE.test(text)) score += 0.6;
      if (TOKEN_DOUBLER_RE.test(text)) score += 0.5;
      if (TOKEN_POPULATE_RE.test(text) || card.keywords.includes("Populate"))
        score += 0.4;
      return Math.min(score, 1);
    },
    conflictsWith: [],
  },
  {
    id: "graveyard",
    name: "Graveyard",
    description: "Reanimate, flashback, delve, self-mill",
    color: { bg: "bg-purple-500/20", text: "text-purple-300" },
    detect(card) {
      const text = card.oracleText;
      let score = 0;
      if (card.keywords.some((kw) => GY_KEYWORDS.has(kw))) score += 0.7;
      if (GY_REANIMATE_RE.test(text)) score += 0.6;
      if (GY_FROM_GY_RE.test(text)) score += 0.3;
      if (GY_MILL_RE.test(text)) score += 0.4;
      if (GY_INTO_GY_RE.test(text)) score += 0.2;
      return Math.min(score, 1);
    },
    conflictsWith: ["graveyardHate"],
  },
  {
    id: "graveyardHate",
    name: "Graveyard Hate",
    description: "Exile graveyards, prevent graveyard use",
    color: { bg: "bg-gray-500/20", text: "text-gray-300" },
    detect(card) {
      const text = card.oracleText;
      let score = 0;
      if (GY_HATE_EXILE_RE.test(text)) score += 0.8;
      if (GY_HATE_INSTEAD_RE.test(text)) score += 0.9;
      if (GY_HATE_CANT_RE.test(text)) score += 0.7;
      return Math.min(score, 1);
    },
    conflictsWith: ["graveyard"],
  },
  {
    id: "sacrifice",
    name: "Sacrifice",
    description: "Sacrifice outlets, death triggers, aristocrats",
    color: { bg: "bg-rose-500/20", text: "text-rose-300" },
    detect(card) {
      const text = card.oracleText;
      let score = 0;
      if (SAC_OUTLET_RE.test(text)) score += 0.6;
      if (SAC_DEATH_TRIGGER_RE.test(text)) score += 0.6;
      if (SAC_ARISTOCRAT_RE.test(text)) score += 0.5;
      if (card.keywords.some((kw) => SAC_KEYWORDS.has(kw))) score += 0.4;
      return Math.min(score, 1);
    },
    conflictsWith: [],
  },
  {
    id: "tribal",
    name: "Tribal",
    description: "Creature type lords, tribal payoffs, kindred synergies",
    color: { bg: "bg-teal-500/20", text: "text-teal-300" },
    detect(card) {
      const text = card.oracleText;
      let score = 0;
      // "of the chosen type" lord (e.g. Adaptive Automaton)
      if (TRIBAL_CHOSEN_TYPE_LORD_RE.test(text)) score += 0.7;
      // Kindred type line (e.g. "Kindred Sorcery")
      if (TRIBAL_KINDRED_RE.test(card.typeLine)) score += 0.7;
      // "Choose a creature type"
      if (TRIBAL_CHOOSE_TYPE_RE.test(text)) score += 0.5;
      // "creatures of the chosen/that share a creature type"
      if (TRIBAL_TYPE_MATTERS_RE.test(text)) score += 0.6;
      // Type-specific lord ("Other Elf creatures you control get +1/+1")
      if (TRIBAL_TYPE_SPECIFIC_LORD_RE.test(text)) score += 0.7;
      // Type-specific trigger ("Whenever a Warrior attacks")
      if (TRIBAL_TYPE_TRIGGER_RE.test(text)) score += 0.6;
      // "for each Elf" / "number of Goblins"
      if (TRIBAL_FOR_EACH_TYPE_RE.test(text)) score += 0.5;
      // "creature spells of the chosen type"
      if (TRIBAL_CREATURE_SPELL_OF_TYPE_RE.test(text)) score += 0.5;
      // "shares a creature type" (e.g. Coat of Arms)
      if (TRIBAL_SHARE_TYPE_RE.test(text)) score += 0.6;
      // "every creature type" (e.g. Maskwood Nexus)
      if (TRIBAL_EVERY_TYPE_RE.test(text)) score += 0.6;
      // Changeling keyword — all creature types
      if (card.keywords.includes("Changeling")) score += 0.3;
      return Math.min(score, 1);
    },
    conflictsWith: [],
  },
  {
    id: "landfall",
    name: "Landfall",
    description: "Landfall triggers, extra land plays, fetchlands",
    color: { bg: "bg-green-500/20", text: "text-green-300" },
    detect(card) {
      const text = card.oracleText;
      let score = 0;
      if (card.keywords.includes("Landfall")) score += 0.8;
      if (LANDFALL_TRIGGER_RE.test(text)) score += 0.7;
      if (LANDFALL_EXTRA_RE.test(text)) score += 0.6;
      if (LANDFALL_FETCH_RE.test(text)) score += 0.5;
      if (LANDFALL_PLAY_LAND_GY_RE.test(text)) score += 0.5;
      return Math.min(score, 1);
    },
    conflictsWith: [],
  },
  {
    id: "spellslinger",
    name: "Spellslinger",
    description: "Spell-cast triggers, instants/sorceries matter",
    color: { bg: "bg-blue-500/20", text: "text-blue-300" },
    detect(card) {
      const text = card.oracleText;
      let score = 0;
      if (SPELL_CAST_TRIGGER_RE.test(text)) score += 0.7;
      if (SPELL_COST_REDUCE_RE.test(text)) score += 0.5;
      if (SPELL_COPY_RE.test(text)) score += 0.5;
      if (SPELL_MAGECRAFT_RE.test(text) || card.keywords.includes("Magecraft"))
        score += 0.6;
      return Math.min(score, 1);
    },
    conflictsWith: [],
  },
  {
    id: "artifacts",
    name: "Artifacts",
    description: "Artifact synergies, affinity, metalcraft",
    color: { bg: "bg-slate-400/20", text: "text-slate-200" },
    detect(card) {
      const text = card.oracleText;
      let score = 0;
      if (ARTIFACT_TRIGGER_RE.test(text)) score += 0.7;
      if (ARTIFACT_MATTERS_RE.test(text)) score += 0.5;
      if (card.keywords.some((kw) => ARTIFACT_KEYWORDS.has(kw))) score += 0.6;
      return Math.min(score, 1);
    },
    conflictsWith: [],
  },
  {
    id: "enchantments",
    name: "Enchantments",
    description: "Constellation, enchantress effects",
    color: { bg: "bg-indigo-500/20", text: "text-indigo-300" },
    detect(card) {
      const text = card.oracleText;
      let score = 0;
      if (card.keywords.some((kw) => ENCHANTMENT_KEYWORDS.has(kw))) score += 0.7;
      if (ENCHANTMENT_TRIGGER_RE.test(text)) score += 0.7;
      if (ENCHANTMENT_MATTERS_RE.test(text)) score += 0.5;
      return Math.min(score, 1);
    },
    conflictsWith: [],
  },
  {
    id: "lifegain",
    name: "Lifegain",
    description: "Life gain triggers, soul sisters",
    color: { bg: "bg-yellow-500/20", text: "text-yellow-300" },
    detect(card) {
      const text = card.oracleText;
      let score = 0;
      if (LIFEGAIN_TRIGGER_RE.test(text)) score += 0.8;
      if (card.keywords.some((kw) => LIFEGAIN_KEYWORDS.has(kw))) score += 0.4;
      if (LIFEGAIN_PAYOFF_RE.test(text)) score += 0.3;
      return Math.min(score, 1);
    },
    conflictsWith: [],
  },
  {
    id: "supertypeMatter",
    name: "Supertype Matters",
    description: "Legendary, historic, and snow permanent synergies",
    color: { bg: "bg-amber-500/20", text: "text-amber-300" },
    detect(card) {
      const text = card.oracleText;
      let score = 0;
      // Legendary-matters
      if (SUPERTYPE_LEGENDARY_CAST_RE.test(text)) score += 0.7;
      if (SUPERTYPE_LEGENDARY_ETB_RE.test(text)) score += 0.6;
      if (SUPERTYPE_LEGENDARY_STATIC_RE.test(text)) score += 0.5;
      if (SUPERTYPE_LEGENDARY_OTHER_RE.test(text)) score += 0.5;
      if (SUPERTYPE_LEGENDARY_FOR_EACH_RE.test(text)) score += 0.5;
      if (SUPERTYPE_LEGENDARY_COST_RE.test(text)) score += 0.6;
      if (SUPERTYPE_LEGENDARY_GRAVEYARD_RE.test(text)) score += 0.5;
      if (SUPERTYPE_LEGEND_RULE_RE.test(text)) score += 0.4;
      // Historic
      if (SUPERTYPE_HISTORIC_RE.test(text)) score += 0.5;
      // Snow-matters
      if (SUPERTYPE_SNOW_OTHER_RE.test(text)) score += 0.6;
      if (SUPERTYPE_SNOW_BROAD_RE.test(text)) score += 0.5;
      if (SUPERTYPE_SNOW_TRIGGER_RE.test(text)) score += 0.5;
      if (SUPERTYPE_SNOW_MANA_RE.test(text)) score += 0.4;
      // {S} in mana cost (not just oracle text)
      if (SUPERTYPE_SNOW_MANA_RE.test(card.manaCost)) score += 0.3;
      return Math.min(score, 1);
    },
    conflictsWith: [],
  },
];

/** Look up an axis definition by ID */
export function getAxisById(id: string): SynergyAxisDefinition | undefined {
  return SYNERGY_AXES.find((a) => a.id === id);
}
