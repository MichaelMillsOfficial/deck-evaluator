import { test, expect } from "@playwright/test";
import {
  tokenize,
  tokenizeAbility,
  splitAbilityBlocks,
  splitModalModes,
  normalizeSelfReferences,
} from "../../src/lib/interaction-engine/lexer";
import type { Token } from "../../src/lib/interaction-engine/types";

// Helper: extract token types from a token array
function types(tokens: Token[]): string[] {
  return tokens.map((t) => t.type);
}

// Helper: extract normalized values (or raw values) from tokens
function norms(tokens: Token[]): string[] {
  return tokens.map((t) => t.normalized ?? t.value);
}

// ═══════════════════════════════════════════════════════════════════
// splitAbilityBlocks
// ═══════════════════════════════════════════════════════════════════

test.describe("splitAbilityBlocks", () => {
  test("splits on newlines", () => {
    const blocks = splitAbilityBlocks("Flying\nLifelink");
    expect(blocks).toEqual(["Flying", "Lifelink"]);
  });

  test("filters empty lines", () => {
    const blocks = splitAbilityBlocks("Flying\n\nLifelink\n");
    expect(blocks).toEqual(["Flying", "Lifelink"]);
  });

  test("single ability returns one block", () => {
    const blocks = splitAbilityBlocks("Sacrifice a creature: Add {C}{C}.");
    expect(blocks).toEqual(["Sacrifice a creature: Add {C}{C}."]);
  });

  test("trims whitespace", () => {
    const blocks = splitAbilityBlocks("  Flying  \n  Haste  ");
    expect(blocks).toEqual(["Flying", "Haste"]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// splitModalModes
// ═══════════════════════════════════════════════════════════════════

test.describe("splitModalModes", () => {
  test("detects 'Choose one —' header", () => {
    const result = splitModalModes(
      "Choose one — • Destroy target artifact. • Draw a card."
    );
    expect(result.header).toBe("Choose one —");
    expect(result.modes).toHaveLength(2);
    expect(result.modes[0]).toContain("Destroy");
    expect(result.modes[1]).toContain("Draw");
  });

  test("detects 'Choose two —' header", () => {
    const result = splitModalModes(
      "Choose two — • Create a 1/1 token. • Gain 3 life. • Draw a card."
    );
    expect(result.header).toBe("Choose two —");
    expect(result.modes).toHaveLength(3);
  });

  test("non-modal text returns null header", () => {
    const result = splitModalModes("Flying, lifelink");
    expect(result.header).toBeNull();
    expect(result.modes).toEqual(["Flying, lifelink"]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// normalizeSelfReferences
// ═══════════════════════════════════════════════════════════════════

test.describe("normalizeSelfReferences", () => {
  test("replaces card name with ~", () => {
    const result = normalizeSelfReferences(
      "Whenever Blood Artist or another creature dies",
      "Blood Artist"
    );
    expect(result).toBe("Whenever ~ or another creature dies");
  });

  test("replaces 'this creature' with ~", () => {
    const result = normalizeSelfReferences(
      "When this creature enters the battlefield",
      "Test Card"
    );
    expect(result).toBe("When ~ enters the battlefield");
  });

  test("replaces 'this permanent' with ~", () => {
    const result = normalizeSelfReferences(
      "When this permanent leaves the battlefield",
      "Test Card"
    );
    expect(result).toBe("When ~ leaves the battlefield");
  });

  test("case-insensitive card name replacement", () => {
    const result = normalizeSelfReferences(
      "Return SOL RING from your graveyard",
      "Sol Ring"
    );
    expect(result).toBe("Return ~ from your graveyard");
  });

  test("handles special regex characters in card name", () => {
    const result = normalizeSelfReferences(
      "Sacrifice Ashnod's Altar",
      "Ashnod's Altar"
    );
    expect(result).toBe("Sacrifice ~");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Mana symbols
// ═══════════════════════════════════════════════════════════════════

test.describe("tokenize — mana symbols", () => {
  test("{T}: Add {G}.", () => {
    const tokens = tokenizeAbility("{T}: Add {G}.");
    expect(types(tokens)).toEqual([
      "MANA_SYMBOL", "COST_SEPARATOR", "EFFECT_VERB", "MANA_SYMBOL", "PUNCTUATION",
    ]);
    expect(tokens[0].value).toBe("{T}");
    expect(tokens[3].value).toBe("{G}");
  });

  test("{C}{C} produces two mana symbols", () => {
    const tokens = tokenizeAbility("Add {C}{C}");
    const manaTokens = tokens.filter((t) => t.type === "MANA_SYMBOL");
    expect(manaTokens).toHaveLength(2);
  });

  test("hybrid mana {W/U}", () => {
    const tokens = tokenizeAbility("{W/U}");
    expect(tokens[0].type).toBe("MANA_SYMBOL");
    expect(tokens[0].value).toBe("{W/U}");
  });

  test("Phyrexian mana {W/P}", () => {
    const tokens = tokenizeAbility("{W/P}");
    expect(tokens[0].type).toBe("MANA_SYMBOL");
    expect(tokens[0].value).toBe("{W/P}");
  });

  test("generic mana {2}", () => {
    const tokens = tokenizeAbility("{2}");
    expect(tokens[0].type).toBe("MANA_SYMBOL");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Stat modifications
// ═══════════════════════════════════════════════════════════════════

test.describe("tokenize — stat modifications", () => {
  test("+1/+1 is STAT_MOD", () => {
    const tokens = tokenizeAbility("gets +1/+1");
    const statMod = tokens.find((t) => t.type === "STAT_MOD");
    expect(statMod).toBeDefined();
    expect(statMod!.value).toBe("+1/+1");
  });

  test("-2/-2 is STAT_MOD", () => {
    const tokens = tokenizeAbility("gets -2/-2");
    const statMod = tokens.find((t) => t.type === "STAT_MOD");
    expect(statMod).toBeDefined();
    expect(statMod!.value).toBe("-2/-2");
  });

  test("+X/+X is STAT_MOD", () => {
    const tokens = tokenizeAbility("gets +X/+X");
    const statMod = tokens.find((t) => t.type === "STAT_MOD");
    expect(statMod).toBeDefined();
    expect(statMod!.value).toBe("+X/+X");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Multi-word zone transitions
// ═══════════════════════════════════════════════════════════════════

test.describe("tokenize — zone transitions", () => {
  test("'enters the battlefield' → ZONE_TRANSITION (etb)", () => {
    const tokens = tokenizeAbility("enters the battlefield");
    expect(tokens[0].type).toBe("ZONE_TRANSITION");
    expect(tokens[0].normalized).toBe("etb");
  });

  test("'dies' → ZONE_TRANSITION (dies)", () => {
    const tokens = tokenizeAbility("creature dies");
    const dies = tokens.find((t) => t.type === "ZONE_TRANSITION");
    expect(dies).toBeDefined();
    expect(dies!.normalized).toBe("dies");
  });

  test("'leaves the battlefield' → ZONE_TRANSITION (ltb)", () => {
    const tokens = tokenizeAbility("leaves the battlefield");
    expect(tokens[0].type).toBe("ZONE_TRANSITION");
    expect(tokens[0].normalized).toBe("ltb");
  });

  test("'is put into a graveyard from the battlefield' → dies", () => {
    const tokens = tokenizeAbility(
      "is put into a graveyard from the battlefield"
    );
    expect(tokens[0].type).toBe("ZONE_TRANSITION");
    expect(tokens[0].normalized).toBe("dies");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Multi-word triggers
// ═══════════════════════════════════════════════════════════════════

test.describe("tokenize — phase triggers", () => {
  test("'At the beginning of your upkeep' → TRIGGER_WORD", () => {
    const tokens = tokenizeAbility("At the beginning of your upkeep, draw a card.");
    expect(tokens[0].type).toBe("TRIGGER_WORD");
    expect(tokens[0].normalized).toBe("upkeep_trigger_you");
  });

  test("'At the beginning of each end step' → TRIGGER_WORD", () => {
    const tokens = tokenizeAbility("At the beginning of each end step");
    expect(tokens[0].type).toBe("TRIGGER_WORD");
    expect(tokens[0].normalized).toBe("end_step_trigger_each");
  });

  test("'At the beginning of combat on your turn' → TRIGGER_WORD", () => {
    const tokens = tokenizeAbility("At the beginning of combat on your turn");
    expect(tokens[0].type).toBe("TRIGGER_WORD");
    expect(tokens[0].normalized).toBe("combat_trigger_you");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Controller references
// ═══════════════════════════════════════════════════════════════════

test.describe("tokenize — controller references", () => {
  test("'you control' → CONTROLLER", () => {
    const tokens = tokenizeAbility("creature you control");
    const ctrl = tokens.find((t) => t.type === "CONTROLLER");
    expect(ctrl).toBeDefined();
    expect(ctrl!.normalized).toBe("you_control");
  });

  test("'each opponent' → CONTROLLER", () => {
    const tokens = tokenizeAbility("each opponent loses 1 life");
    const ctrl = tokens.find((t) => t.type === "CONTROLLER");
    expect(ctrl).toBeDefined();
    expect(ctrl!.normalized).toBe("each_opponent");
  });

  test("'target opponent' → CONTROLLER", () => {
    const tokens = tokenizeAbility("target opponent discards a card");
    const ctrl = tokens.find((t) => t.type === "CONTROLLER");
    expect(ctrl).toBeDefined();
    expect(ctrl!.normalized).toBe("target_opponent");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Reminder text stripping
// ═══════════════════════════════════════════════════════════════════

test.describe("tokenize — reminder text", () => {
  test("strips parenthesized reminder text", () => {
    const tokens = tokenizeAbility(
      "Flying (This creature can't be blocked except by creatures with flying or reach.)"
    );
    // Should only have the keyword, not the reminder text
    expect(tokens[0].type).toBe("KEYWORD");
    expect(tokens[0].normalized).toBe("flying");
    // Parenthesized text should be skipped
    const textTokens = tokens.filter((t) => t.type === "TEXT");
    expect(textTokens).toHaveLength(0);
  });

  test("handles reminder text mid-ability", () => {
    const tokens = tokenizeAbility(
      "Deathtouch (Any amount of damage this deals to a creature is enough to destroy it.)"
    );
    expect(tokens[0].type).toBe("KEYWORD");
    expect(tokens[0].normalized).toBe("deathtouch");
    expect(tokens.filter((t) => t.type === "TEXT")).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Keywords
// ═══════════════════════════════════════════════════════════════════

test.describe("tokenize — keywords", () => {
  test("single keyword: flying", () => {
    const tokens = tokenizeAbility("Flying");
    expect(tokens[0].type).toBe("KEYWORD");
    expect(tokens[0].normalized).toBe("flying");
  });

  test("multiple keywords on one line", () => {
    const tokens = tokenizeAbility("Flying, first strike, lifelink");
    const keywords = tokens.filter((t) => t.type === "KEYWORD");
    expect(keywords.map((k) => k.normalized)).toEqual([
      "flying", "first_strike", "lifelink",
    ]);
  });

  test("'first strike' as compound keyword", () => {
    const tokens = tokenizeAbility("First strike");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe("KEYWORD");
    expect(tokens[0].normalized).toBe("first_strike");
  });

  test("'double strike' as compound keyword", () => {
    const tokens = tokenizeAbility("Double strike");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe("KEYWORD");
    expect(tokens[0].normalized).toBe("double_strike");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Conditional / replacement markers
// ═══════════════════════════════════════════════════════════════════

test.describe("tokenize — conditionals", () => {
  test("'would' and 'instead' are CONDITIONAL tokens", () => {
    const tokens = tokenizeAbility(
      "If this would be put into a graveyard, exile it instead."
    );
    const conditionals = tokens.filter((t) => t.type === "CONDITIONAL");
    const norms = conditionals.map((t) => t.normalized);
    expect(norms).toContain("if");
    expect(norms).toContain("would");
    expect(norms).toContain("instead");
  });

  test("'until end of turn' → CONDITIONAL (until_eot)", () => {
    const tokens = tokenizeAbility("gains flying until end of turn");
    const eot = tokens.find((t) => t.normalized === "until_eot");
    expect(eot).toBeDefined();
    expect(eot!.type).toBe("CONDITIONAL");
  });

  test("'as long as' → CONDITIONAL", () => {
    const tokens = tokenizeAbility("as long as you control an artifact");
    const cond = tokens.find((t) => t.normalized === "as_long_as");
    expect(cond).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Card types and zones
// ═══════════════════════════════════════════════════════════════════

test.describe("tokenize — card types and zones", () => {
  test("recognizes card types", () => {
    const tokens = tokenizeAbility("creature artifact enchantment");
    expect(types(tokens)).toEqual(["CARD_TYPE", "CARD_TYPE", "CARD_TYPE"]);
  });

  test("recognizes zones", () => {
    const tokens = tokenizeAbility("from your graveyard to the battlefield");
    const zoneTokens = tokens.filter((t) => t.type === "ZONE");
    expect(zoneTokens.map((z) => z.normalized)).toEqual([
      "graveyard", "battlefield",
    ]);
  });

  test("recognizes supertypes", () => {
    const tokens = tokenizeAbility("legendary creature");
    expect(tokens[0].type).toBe("SUPERTYPE");
    expect(tokens[0].normalized).toBe("legendary");
  });

  test("recognizes subtypes", () => {
    const tokens = tokenizeAbility("target Elf creature");
    const subtypeToken = tokens.find((t) => t.type === "SUBTYPE");
    expect(subtypeToken).toBeDefined();
    expect(subtypeToken!.normalized).toBe("elf");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Real card tests — 20+ diverse cards
// ═══════════════════════════════════════════════════════════════════

test.describe("tokenize — real cards", () => {
  test("Ashnod's Altar: activated mana ability", () => {
    const result = tokenize(
      "Sacrifice a creature: Add {C}{C}.",
      "Ashnod's Altar"
    );
    expect(result.blocks).toHaveLength(1);
    const t = result.blocks[0];
    expect(t[0].type).toBe("EFFECT_VERB"); // sacrifice
    expect(t[0].normalized).toBe("sacrifice");
    expect(t[3].type).toBe("COST_SEPARATOR");
    expect(t.filter((tok) => tok.type === "MANA_SYMBOL")).toHaveLength(2);
  });

  test("Blood Artist: death trigger", () => {
    const result = tokenize(
      "Whenever Blood Artist or another creature dies, target opponent loses 1 life and you gain 1 life.",
      "Blood Artist"
    );
    const t = result.blocks[0];
    expect(t[0].type).toBe("TRIGGER_WORD");
    expect(t[0].normalized).toBe("whenever");
    expect(t[1].normalized).toBe("self"); // Blood Artist → ~
    const dies = t.find((tok) => tok.normalized === "dies");
    expect(dies).toBeDefined();
  });

  test("Smothering Tithe: triggered ability with conditional", () => {
    const result = tokenize(
      "Whenever an opponent draws a card, that player may pay {2}. If that player doesn't, you create a Treasure token.",
      "Smothering Tithe"
    );
    const t = result.blocks[0];
    expect(t[0].type).toBe("TRIGGER_WORD");
    expect(t[0].normalized).toBe("whenever");
  });

  test("Rhystic Study: triggered ability", () => {
    const result = tokenize(
      "Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.",
      "Rhystic Study"
    );
    const t = result.blocks[0];
    expect(t[0].normalized).toBe("whenever");
    const castSpell = t.find((tok) => tok.normalized === "cast_spell");
    // "casts a spell" should be matched as multi-word
    expect(castSpell).toBeDefined();
  });

  test("Sol Ring: simple mana ability", () => {
    const result = tokenize("{T}: Add {C}{C}.", "Sol Ring");
    const t = result.blocks[0];
    expect(t[0].type).toBe("MANA_SYMBOL");
    expect(t[0].value).toBe("{T}");
    expect(t[1].type).toBe("COST_SEPARATOR");
    expect(t[2].normalized).toBe("add");
  });

  test("Craterhoof Behemoth: ETB with stat mod", () => {
    const result = tokenize(
      "When Craterhoof Behemoth enters the battlefield, creatures you control gain trample and get +X/+X until end of turn, where X is the number of creatures you control.",
      "Craterhoof Behemoth"
    );
    const t = result.blocks[0];
    expect(t[0].type).toBe("TRIGGER_WORD");
    const etb = t.find((tok) => tok.normalized === "etb");
    expect(etb).toBeDefined();
    const statMod = t.find((tok) => tok.type === "STAT_MOD");
    expect(statMod).toBeDefined();
    expect(statMod!.value).toBe("+X/+X");
  });

  test("Wrath of God: destroy all", () => {
    const result = tokenize(
      "Destroy all creatures. They can't be regenerated.",
      "Wrath of God"
    );
    const t = result.blocks[0];
    const destroyAll = t.find((tok) => tok.normalized === "destroy_all");
    expect(destroyAll).toBeDefined();
  });

  test("Grave Pact: death trigger with sacrifice", () => {
    const result = tokenize(
      "Whenever a creature you control dies, each other player sacrifices a creature.",
      "Grave Pact"
    );
    const t = result.blocks[0];
    expect(t[0].normalized).toBe("whenever");
    const dies = t.find((tok) => tok.normalized === "dies");
    expect(dies).toBeDefined();
    const youControl = t.find((tok) => tok.normalized === "you_control");
    expect(youControl).toBeDefined();
  });

  test("Doubling Season: replacement effect", () => {
    const result = tokenize(
      "If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead.",
      "Doubling Season"
    );
    const t = result.blocks[0];
    const conditionals = t.filter((tok) => tok.type === "CONDITIONAL");
    const norms = conditionals.map((tok) => tok.normalized);
    expect(norms).toContain("if");
    expect(norms).toContain("would");
    expect(norms).toContain("instead");
  });

  test("Swords to Plowshares: exile + life gain", () => {
    const result = tokenize(
      "Exile target creature. Its controller gains life equal to its power.",
      "Swords to Plowshares"
    );
    const t = result.blocks[0];
    const exileTarget = t.find((tok) => tok.normalized === "exile_target");
    expect(exileTarget).toBeDefined();
  });

  test("Cultivate: search library", () => {
    const result = tokenize(
      "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.",
      "Cultivate"
    );
    const t = result.blocks[0];
    const search = t.find((tok) => tok.normalized === "search_library");
    expect(search).toBeDefined();
    expect(t.find((tok) => tok.type === "SUPERTYPE" && tok.normalized === "basic")).toBeDefined();
  });

  test("Force of Will: multi-ability with alternative cost text", () => {
    const result = tokenize(
      "You may pay 1 life and exile a blue card from your hand rather than pay this spell's mana cost.\nCounter target spell.",
      "Force of Will"
    );
    expect(result.blocks).toHaveLength(2);
    // First block: alternative cost
    const alt = result.blocks[0];
    const ratherThanPay = alt.find((tok) => tok.normalized === "rather_than_pay");
    expect(ratherThanPay).toBeDefined();
    // Second block: the effect
    const counter = result.blocks[1].find((tok) => tok.normalized === "counter");
    expect(counter).toBeDefined();
  });

  test("Lightning Bolt: simple damage spell", () => {
    const result = tokenize(
      "Lightning Bolt deals 3 damage to any target.",
      "Lightning Bolt"
    );
    const t = result.blocks[0];
    expect(t[0].normalized).toBe("self"); // card name replaced
    const deal = t.find((tok) => tok.normalized === "deals");
    expect(deal).toBeDefined();
  });

  test("Llanowar Elves: mana dork with keyword", () => {
    const result = tokenize(
      "{T}: Add {G}.",
      "Llanowar Elves"
    );
    const t = result.blocks[0];
    expect(t[0].type).toBe("MANA_SYMBOL"); // {T}
    expect(t[1].type).toBe("COST_SEPARATOR");
    expect(t[3].type).toBe("MANA_SYMBOL"); // {G}
  });

  test("Niv-Mizzet, Parun: damage trigger + draw trigger", () => {
    const result = tokenize(
      "Whenever you draw a card, Niv-Mizzet, Parun deals 1 damage to any target.\nWhenever a player casts an instant or sorcery spell, you draw a card.",
      "Niv-Mizzet, Parun"
    );
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0][0].normalized).toBe("whenever");
    expect(result.blocks[1][0].normalized).toBe("whenever");
    const drawCard = result.blocks[0].find((tok) => tok.normalized === "draw_card");
    expect(drawCard).toBeDefined();
  });

  test("Rest in Peace: replacement effect (graveyard → exile)", () => {
    const result = tokenize(
      "If a card or token would be put into a graveyard from anywhere, exile it instead.",
      "Rest in Peace"
    );
    const t = result.blocks[0];
    expect(t.find((tok) => tok.normalized === "if")).toBeDefined();
    expect(t.find((tok) => tok.normalized === "would")).toBeDefined();
    expect(
      t.find((tok) => tok.normalized === "put_into_graveyard_from_anywhere")
    ).toBeDefined();
    expect(t.find((tok) => tok.normalized === "instead")).toBeDefined();
  });

  test("Aetherflux Reservoir: activated ability with life cost", () => {
    const result = tokenize(
      "Whenever you cast a spell, you gain 1 life for each spell you've cast this turn.\nPay 50 life: Aetherflux Reservoir deals 50 damage to any target.",
      "Aetherflux Reservoir"
    );
    expect(result.blocks).toHaveLength(2);
    // Block 1: trigger
    expect(result.blocks[0][0].normalized).toBe("whenever");
    // Block 2: activated ability with cost separator
    const costSep = result.blocks[1].find((tok) => tok.type === "COST_SEPARATOR");
    expect(costSep).toBeDefined();
  });

  test("Korvold: sacrifice trigger", () => {
    const result = tokenize(
      "Whenever you sacrifice a permanent, put a +1/+1 counter on Korvold and draw a card.",
      "Korvold, Fae-Cursed King"
    );
    const t = result.blocks[0];
    expect(t[0].normalized).toBe("whenever");
    const sacrifice = t.find(
      (tok) => tok.type === "EFFECT_VERB" && tok.normalized === "sacrifice"
    );
    expect(sacrifice).toBeDefined();
    const putCounter = t.find((tok) => tok.normalized === "put_p1p1_counter");
    expect(putCounter).toBeDefined();
  });

  test("Elesh Norn: static -2/-2 anthem", () => {
    const result = tokenize(
      "Other creatures you control get +2/+2.\nCreatures your opponents control get -2/-2.",
      "Elesh Norn, Grand Cenobite"
    );
    expect(result.blocks).toHaveLength(2);
    // Both blocks have stat mods
    const statMod1 = result.blocks[0].find((tok) => tok.type === "STAT_MOD");
    expect(statMod1).toBeDefined();
    expect(statMod1!.value).toBe("+2/+2");
    const statMod2 = result.blocks[1].find((tok) => tok.type === "STAT_MOD");
    expect(statMod2).toBeDefined();
    expect(statMod2!.value).toBe("-2/-2");
  });

  test("Demonic Tutor: search library", () => {
    const result = tokenize(
      "Search your library for a card, put that card into your hand, then shuffle.",
      "Demonic Tutor"
    );
    const t = result.blocks[0];
    const search = t.find((tok) => tok.normalized === "search_library");
    expect(search).toBeDefined();
  });

  test("Phyrexian Arena: upkeep trigger", () => {
    const result = tokenize(
      "At the beginning of your upkeep, you draw a card and you lose 1 life.",
      "Phyrexian Arena"
    );
    const t = result.blocks[0];
    expect(t[0].type).toBe("TRIGGER_WORD");
    expect(t[0].normalized).toBe("upkeep_trigger_you");
  });

  test("Teferi's Protection: phasing text", () => {
    const result = tokenize(
      "Until your next turn, your life total can't change and you gain protection from everything. All permanents you control phase out.",
      "Teferi's Protection"
    );
    const t = result.blocks[0];
    const phaseToken = t.find(
      (tok) => tok.type === "KEYWORD" && tok.normalized === "protection"
    );
    expect(phaseToken).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Multi-ability block splitting
// ═══════════════════════════════════════════════════════════════════

test.describe("tokenize — multi-ability cards", () => {
  test("two abilities separated by newline", () => {
    const result = tokenize(
      "Flying, vigilance\n{W}{B}: Target creature gains lifelink until end of turn.",
      "Test Angel"
    );
    expect(result.blocks).toHaveLength(2);
    // Block 1: keywords
    const keywords = result.blocks[0].filter((t) => t.type === "KEYWORD");
    expect(keywords).toHaveLength(2);
    // Block 2: activated ability
    expect(result.blocks[1].find((t) => t.type === "COST_SEPARATOR")).toBeDefined();
  });

  test("three ability blocks", () => {
    const result = tokenize(
      "Flying\nVigilance\n{T}: Add {W}.",
      "Test Card"
    );
    expect(result.blocks).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Self-reference handling
// ═══════════════════════════════════════════════════════════════════

test.describe("tokenize — self-references", () => {
  test("card name is replaced with MODIFIER (self)", () => {
    const result = tokenize(
      "When Sol Ring enters the battlefield, add {C}{C}.",
      "Sol Ring"
    );
    const t = result.blocks[0];
    const selfToken = t.find(
      (tok) => tok.type === "MODIFIER" && tok.normalized === "self"
    );
    expect(selfToken).toBeDefined();
  });

  test("'this creature' is replaced with self", () => {
    const result = tokenize(
      "When this creature enters the battlefield, draw a card.",
      "Test Card"
    );
    const t = result.blocks[0];
    const selfToken = t.find(
      (tok) => tok.type === "MODIFIER" && tok.normalized === "self"
    );
    expect(selfToken).toBeDefined();
  });
});
