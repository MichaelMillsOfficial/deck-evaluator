/**
 * MTG Game Model — Type Hierarchy, Zones, and Object References
 *
 * Defines the fundamental building blocks of MTG's type system.
 * Card types are atomic; "permanent" and "spell" are computed characteristics.
 * Type filters are predicates, not type members.
 */

// ─── Card Types ───
// The actual types printed on cards. These are the atomic building blocks.
export type CardType =
  | "creature"
  | "artifact"
  | "enchantment"
  | "planeswalker"
  | "land"
  | "instant"
  | "sorcery"
  | "battle"
  | "kindred";

// Supertypes modify card types (orthogonal axis)
// CR 205.4a — The supertypes are Basic, Legendary, Ongoing, Snow, and World.
export type Supertype = "legendary" | "basic" | "snow" | "world" | "ongoing";

// Subtypes are type-specific (Elf is a creature subtype, Equipment is artifact, etc.)
// These are open-ended strings since new subtypes are printed every set.
export type Subtype = string;

// ─── Permanent Types ───
// CR 110.4 — Permanents are objects on the battlefield.
// These card types produce permanents when they resolve.
export const PERMANENT_TYPES: readonly CardType[] = [
  "creature",
  "artifact",
  "enchantment",
  "planeswalker",
  "land",
  "battle",
] as const;

/**
 * Returns true if the card type produces a permanent on the battlefield.
 * "Kindred" is NOT a permanent type — it's a card type that appears alongside
 * other types (e.g., "Kindred Instant — Elf").
 */
export function isPermanentType(t: CardType): boolean {
  return (PERMANENT_TYPES as readonly string[]).includes(t);
}

/**
 * Returns true if the card type can be a spell on the stack.
 * All card types are spells when cast — but lands are played, not cast,
 * so they're never spells. CR 112.1a.
 */
export function isSpellType(t: CardType): boolean {
  return t !== "land";
}

// ─── Controller / Ownership ───
// Who controls or owns the object (CR 108.3)
// "Owner" is distinct from "controller" — many effects reference owner specifically
// ("return to its owner's hand"). "Active player" matters for APNAP ordering (CR 101.4).
export type Controller =
  | "you"
  | "opponent"
  | "any"
  | "each"
  | "owner"
  | "active_player";

// ─── Zones ───
// The fundamental places game objects exist (CR 400)
export type Zone =
  | "battlefield"
  | "graveyard"
  | "hand"
  | "library"
  | "exile"
  | "stack"
  | "command"
  | "outside_the_game";
// "outside_the_game" (CR 400.11) — sideboard in tournament play.
// Used by: Wishes, Companion, Learn/Lesson mechanic.

// Zone characteristics affect what objects can do
export interface ZoneProperties {
  /** Graveyard, battlefield, exile, stack, command = public */
  isPublic: boolean;
  /** Library = ordered */
  isOrdered: boolean;
  /** Battlefield, stack = yes */
  objectsHaveControllers: boolean;
}

export const ZONE_PROPERTIES: Record<Zone, ZoneProperties> = {
  battlefield: {
    isPublic: true,
    isOrdered: false,
    objectsHaveControllers: true,
  },
  graveyard: {
    isPublic: true,
    isOrdered: true,
    objectsHaveControllers: false,
  },
  hand: { isPublic: false, isOrdered: false, objectsHaveControllers: false },
  library: { isPublic: false, isOrdered: true, objectsHaveControllers: false },
  exile: { isPublic: true, isOrdered: false, objectsHaveControllers: false },
  stack: { isPublic: true, isOrdered: true, objectsHaveControllers: true },
  command: { isPublic: true, isOrdered: false, objectsHaveControllers: true },
  outside_the_game: {
    isPublic: false,
    isOrdered: false,
    objectsHaveControllers: false,
  },
};

// ─── Type Filters ───
// "Nonland permanent", "noncreature spell", "nontoken creature" — these are
// filters/queries, not types. They appear in oracle text to constrain targets/triggers.
export interface TypeFilter {
  includes?: CardType[];
  excludes?: CardType[];
  supertypes?: Supertype[];
  subtypes?: Subtype[];
  isToken?: boolean; // true = token only, false = nontoken only
  controller?: Controller;
}

// ─── Ref Modifiers ───
// Modifiers that appear in oracle text to qualify game object references
export type RefModifier =
  | "nontoken"
  | "other"
  | "target"
  | "token"
  | "tapped"
  | "untapped"
  | "attacking"
  | "blocking"
  | "enchanted"
  | "equipped";

// ─── Game Object References ───
// How oracle text refers to game objects
// "target creature you control", "each nontoken artifact", "a land card from your graveyard"
export interface GameObjectRef {
  types: CardType[];
  supertypes?: Supertype[];
  subtypes?: Subtype[];
  compositeTypes?: string[];
  controller?: Controller;
  quantity: "one" | "all" | "each" | "another" | number | "X";
  modifiers: RefModifier[];
  zone?: Zone;
  /** Refers to the card itself ("this creature", "CARDNAME") */
  self?: boolean;
  /** Mana value filter: "with mana value 3 or less" */
  manaValue?: {
    comparison: "equal" | "less_equal" | "greater_equal" | "less" | "greater";
    value: number | "X";
  };
  /** Colors the object must have */
  colors?: string[];
  /** Colors the object must NOT have */
  colorExcludes?: string[];
  /**
   * "choose" vs "target" — hexproof/ward don't apply to "choose"
   * CR 115.7: Only "target" uses targeting rules.
   */
  isChosenNotTargeted?: boolean;
}

// ─── Composite Types ───
// Rules-defined groupings that combine multiple card characteristics.
// "Historic" = legendary OR artifact OR Saga (subtype)
// These are defined by the comprehensive rules, not printed on cards.
export interface CompositeType {
  id: string;
  name: string;
  matches: (card: {
    types: CardType[];
    supertypes: Supertype[];
    subtypes: Subtype[];
  }) => boolean;
}

export const COMPOSITE_TYPES: CompositeType[] = [
  {
    id: "historic",
    name: "Historic",
    matches: (card) =>
      card.supertypes.includes("legendary") ||
      card.types.includes("artifact") ||
      card.subtypes.includes("Saga"),
  },
  {
    id: "outlaw",
    name: "Outlaw",
    // CR 700.12 — Assassins, Mercenaries, Pirates, Rogues, and Warlocks
    matches: (card) =>
      card.subtypes.includes("Assassin") ||
      card.subtypes.includes("Mercenary") ||
      card.subtypes.includes("Pirate") ||
      card.subtypes.includes("Rogue") ||
      card.subtypes.includes("Warlock"),
  },
  {
    id: "party",
    name: "Party",
    // CR 700.11 — Clerics, Rogues, Warriors, and Wizards
    matches: (card) =>
      card.subtypes.includes("Cleric") ||
      card.subtypes.includes("Rogue") ||
      card.subtypes.includes("Warrior") ||
      card.subtypes.includes("Wizard"),
  },
];

/**
 * Check if a card matches a composite type by ID.
 */
export function matchesCompositeType(
  compositeId: string,
  card: { types: CardType[]; supertypes: Supertype[]; subtypes: Subtype[] }
): boolean {
  const composite = COMPOSITE_TYPES.find((c) => c.id === compositeId);
  if (!composite) return false;
  return composite.matches(card);
}

// ─── Attachment Types ───
// CR 303.4 (Auras), CR 301.5 (Equipment), CR 301.6 (Fortifications)
export type AttachmentType = "aura" | "equipment" | "fortification";

// ─── Attachment Relationships ───
export interface AttachmentRelationship {
  attachedObject: GameObjectRef;
  attachedTo: GameObjectRef;
  attachmentType: AttachmentType;
  /** "enchant creature", "equip artifact" — what it CAN attach to */
  constraint?: GameObjectRef;
}
