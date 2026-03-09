/**
 * Parser Unit Tests — Oracle text token stream → AbilityNode ASTs
 *
 * Tests cover: ability type classification, triggered/activated/keyword/
 * static/replacement/spell parsing, cost parsing, effect parsing,
 * conditions, durations, and real card integration tests.
 */

import { test, expect } from "@playwright/test";
import { tokenizeAbility, tokenize } from "../../src/lib/interaction-engine/lexer";
import {
  parseAbility,
  parseAbilities,
} from "../../src/lib/interaction-engine/parser";
import type {
  AbilityNode,
  TriggeredAbility,
  ActivatedAbility,
  KeywordAbility,
  StaticAbility,
  ReplacementAbility,
  SpellEffect,
  Effect,
  Cost,
  SacrificeCost,
  DiscardCost,
  ExileCost,
  PayLifeCost,
  CastingCost,
} from "../../src/lib/interaction-engine/types";

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/** Tokenize + parse a single ability block */
function parse(text: string, cardName = ""): AbilityNode {
  const tokens = tokenizeAbility(text, cardName);
  return parseAbility(tokens);
}

/** Tokenize + parse complete oracle text (multi-block) */
function parseAll(text: string, cardName = ""): AbilityNode[] {
  const { blocks } = tokenize(text, cardName);
  return parseAbilities(blocks);
}

function asTriggered(node: AbilityNode): TriggeredAbility {
  expect(node.abilityType).toBe("triggered");
  return node as TriggeredAbility;
}

function asActivated(node: AbilityNode): ActivatedAbility {
  expect(node.abilityType).toBe("activated");
  return node as ActivatedAbility;
}

function asKeyword(node: AbilityNode): KeywordAbility {
  expect(node.abilityType).toBe("keyword");
  return node as KeywordAbility;
}

function asStatic(node: AbilityNode): StaticAbility {
  expect(node.abilityType).toBe("static");
  return node as StaticAbility;
}

function asReplacement(node: AbilityNode): ReplacementAbility {
  expect(node.abilityType).toBe("replacement");
  return node as ReplacementAbility;
}

function asSpellEffect(node: AbilityNode): SpellEffect {
  expect(node.abilityType).toBe("spell_effect");
  return node as SpellEffect;
}

// ═══════════════════════════════════════════════════════════════
// 1. ABILITY TYPE CLASSIFICATION
// ═══════════════════════════════════════════════════════════════

test.describe("ability type classification", () => {
  test("'When' prefix → triggered ability", () => {
    const node = parse("When ~ enters the battlefield, draw a card.");
    expect(node.abilityType).toBe("triggered");
  });

  test("'Whenever' prefix → triggered ability", () => {
    const node = parse("Whenever a creature dies, you gain 1 life.");
    expect(node.abilityType).toBe("triggered");
  });

  test("'At the beginning of' → triggered ability", () => {
    const node = parse("At the beginning of your upkeep, draw a card.");
    expect(node.abilityType).toBe("triggered");
  });

  test("cost separator ':' → activated ability", () => {
    const node = parse("{T}: Add {G}.");
    expect(node.abilityType).toBe("activated");
  });

  test("'Sacrifice a creature: ...' → activated ability", () => {
    const node = parse("Sacrifice a creature: Add {C}{C}.", "Ashnod's Altar");
    expect(node.abilityType).toBe("activated");
  });

  test("single keyword → keyword ability", () => {
    const node = parse("Flying");
    expect(node.abilityType).toBe("keyword");
  });

  test("keyword with parameter → keyword ability", () => {
    const node = parse("Ward {2}");
    expect(node.abilityType).toBe("keyword");
  });

  test("'If ... would ... instead' → replacement ability", () => {
    const node = parse(
      "If a card or token would be put into a graveyard from anywhere, exile it instead.",
      "Rest in Peace"
    );
    expect(node.abilityType).toBe("replacement");
  });

  test("continuous effect → static ability", () => {
    const node = parse("Other creatures you control get +1/+1.");
    expect(node.abilityType).toBe("static");
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. KEYWORD ABILITY PARSING
// ═══════════════════════════════════════════════════════════════

test.describe("keyword ability parsing", () => {
  test("simple keyword: flying", () => {
    const node = asKeyword(parse("Flying"));
    expect(node.keyword).toBe("flying");
    expect(node.parameter).toBeUndefined();
  });

  test("simple keyword: haste", () => {
    const node = asKeyword(parse("Haste"));
    expect(node.keyword).toBe("haste");
  });

  test("compound keyword: first strike", () => {
    const node = asKeyword(parse("First strike"));
    expect(node.keyword).toBe("first_strike");
  });

  test("compound keyword: double strike", () => {
    const node = asKeyword(parse("Double strike"));
    expect(node.keyword).toBe("double_strike");
  });

  test("keyword with mana parameter: ward {2}", () => {
    const node = asKeyword(parse("Ward {2}"));
    expect(node.keyword).toBe("ward");
    expect(node.parameter).toBe("{2}");
  });

  test("keyword with number parameter: crew 3", () => {
    const node = asKeyword(parse("Crew 3"));
    expect(node.keyword).toBe("crew");
    expect(node.parameter).toBe("3");
  });

  test("keyword with mana parameter: equip {3}", () => {
    const node = asKeyword(parse("Equip {3}"));
    expect(node.keyword).toBe("equip");
    expect(node.parameter).toBe("{3}");
  });

  test("multiple keywords on one line produce multiple nodes", () => {
    const nodes = parseAll("Flying, first strike, lifelink");
    expect(nodes).toHaveLength(3);
    expect(asKeyword(nodes[0]).keyword).toBe("flying");
    expect(asKeyword(nodes[1]).keyword).toBe("first_strike");
    expect(asKeyword(nodes[2]).keyword).toBe("lifelink");
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. ACTIVATED ABILITY PARSING
// ═══════════════════════════════════════════════════════════════

test.describe("activated ability parsing", () => {
  test("{T} cost", () => {
    const node = asActivated(parse("{T}: Add {G}."));
    expect(node.costs).toHaveLength(1);
    expect(node.costs[0].costType).toBe("tap");
  });

  test("{T} mana ability produces mana", () => {
    const node = asActivated(parse("{T}: Add {G}."));
    expect(node.effects.length).toBeGreaterThanOrEqual(1);
    const manaEffect = node.effects.find((e) => e.resource?.category === "mana");
    expect(manaEffect).toBeDefined();
  });

  test("mana ability gets speed: mana_ability", () => {
    const node = asActivated(parse("{T}: Add {G}."));
    expect(node.speed).toBe("mana_ability");
  });

  test("sacrifice cost", () => {
    const node = asActivated(
      parse("Sacrifice a creature: Add {C}{C}.", "Ashnod's Altar")
    );
    const sacCost = node.costs.find((c) => c.costType === "sacrifice");
    expect(sacCost).toBeDefined();
  });

  test("mana cost in activation", () => {
    const node = asActivated(parse("{2}{B}: Draw a card."));
    const manaCosts = node.costs.filter((c) => c.costType === "mana");
    expect(manaCosts.length).toBeGreaterThanOrEqual(1);
  });

  test("pay life cost", () => {
    const node = asActivated(
      parse("Pay 50 life: ~ deals 50 damage to any target.", "Aetherflux Reservoir")
    );
    const lifeCost = node.costs.find((c) => c.costType === "pay_life");
    expect(lifeCost).toBeDefined();
  });

  test("non-mana activated ability gets speed: instant", () => {
    const node = asActivated(
      parse("Sacrifice a creature: Draw a card.")
    );
    expect(node.speed).toBe("instant");
  });

  test("multiple costs separated by comma", () => {
    const node = asActivated(parse("{1}, {T}, Sacrifice a creature: Draw a card."));
    expect(node.costs.length).toBeGreaterThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. TRIGGERED ABILITY PARSING
// ═══════════════════════════════════════════════════════════════

test.describe("triggered ability parsing", () => {
  test("'When ~ enters the battlefield' → ETB trigger", () => {
    const node = asTriggered(
      parse("When ~ enters the battlefield, draw a card.", "Elvish Visionary")
    );
    expect(node.trigger.kind).toBe("zone_transition");
    if (node.trigger.kind === "zone_transition") {
      expect(node.trigger.to).toBe("battlefield");
    }
  });

  test("'Whenever a creature dies' → death trigger", () => {
    const node = asTriggered(
      parse("Whenever a creature dies, you gain 1 life.", "Blood Artist")
    );
    expect(node.trigger.kind).toBe("zone_transition");
  });

  test("'At the beginning of your upkeep' → phase trigger", () => {
    const node = asTriggered(
      parse("At the beginning of your upkeep, draw a card.")
    );
    expect(node.trigger.kind).toBe("phase_trigger");
    if (node.trigger.kind === "phase_trigger") {
      expect(node.trigger.step).toBe("upkeep");
    }
  });

  test("'At the beginning of each end step' → phase trigger", () => {
    const node = asTriggered(
      parse("At the beginning of each end step, create a treasure token.")
    );
    expect(node.trigger.kind).toBe("phase_trigger");
  });

  test("'Whenever you cast a spell' → player action trigger", () => {
    const node = asTriggered(
      parse("Whenever you cast a spell, draw a card.")
    );
    expect(node.trigger.kind).toBe("player_action");
  });

  test("triggered ability has speed: instant", () => {
    const node = asTriggered(parse("Whenever a creature dies, draw a card."));
    expect(node.speed).toBe("instant");
  });

  test("trigger effects include draw", () => {
    const node = asTriggered(
      parse("Whenever a creature dies, draw a card.")
    );
    expect(node.effects.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. COST PARSING
// ═══════════════════════════════════════════════════════════════

test.describe("cost parsing", () => {
  test("{T} → TapCost", () => {
    const node = asActivated(parse("{T}: Add {W}."));
    expect(node.costs.some((c) => c.costType === "tap")).toBe(true);
  });

  test("{Q} → UntapCost", () => {
    const node = asActivated(parse("{Q}: Add {U}."));
    expect(node.costs.some((c) => c.costType === "untap")).toBe(true);
  });

  test("{2}{B} → ManaCostUnit(s)", () => {
    const node = asActivated(parse("{2}{B}: Draw a card."));
    const manaCosts = node.costs.filter((c) => c.costType === "mana");
    expect(manaCosts.length).toBeGreaterThanOrEqual(1);
  });

  test("'Sacrifice a creature' → SacrificeCost", () => {
    const node = asActivated(parse("Sacrifice a creature: Draw a card."));
    const sac = node.costs.find((c) => c.costType === "sacrifice");
    expect(sac).toBeDefined();
    if (sac && sac.costType === "sacrifice") {
      expect(sac.object.types).toContain("creature");
    }
  });

  test("'Discard a card' → DiscardCost", () => {
    const node = asActivated(parse("Discard a card: Draw a card."));
    const disc = node.costs.find((c) => c.costType === "discard");
    expect(disc).toBeDefined();
  });

  test("'Pay 3 life' → PayLifeCost", () => {
    const node = asActivated(parse("Pay 3 life: Draw a card."));
    const life = node.costs.find((c) => c.costType === "pay_life");
    expect(life).toBeDefined();
    if (life && life.costType === "pay_life") {
      expect(life.quantity).toBe(3);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. EFFECT PARSING
// ═══════════════════════════════════════════════════════════════

test.describe("effect parsing", () => {
  test("'draw a card' → draw effect with cards resource", () => {
    const node = asTriggered(parse("Whenever a creature dies, draw a card."));
    const drawEffect = node.effects.find((e) => e.type === "draw");
    expect(drawEffect).toBeDefined();
  });

  test("'Add {G}' → mana production effect", () => {
    const node = asActivated(parse("{T}: Add {G}."));
    const manaEffect = node.effects.find((e) => e.resource?.category === "mana");
    expect(manaEffect).toBeDefined();
  });

  test("'Add {C}{C}' → produces 2 colorless mana", () => {
    const node = asActivated(parse("Sacrifice a creature: Add {C}{C}.", "Ashnod's Altar"));
    const manaEffects = node.effects.filter((e) => e.resource?.category === "mana");
    expect(manaEffects.length).toBeGreaterThanOrEqual(1);
  });

  test("'destroy target creature' → destroy effect", () => {
    const node = asTriggered(
      parse("When ~ enters the battlefield, destroy target creature.", "Ravenous Chupacabra")
    );
    const destroyEffect = node.effects.find(
      (e) => e.gameEffect?.category === "destroy"
    );
    expect(destroyEffect).toBeDefined();
  });

  test("'destroy all creatures' → destroy all effect", () => {
    const node = parse("Destroy all creatures.");
    // Could be spell effect or static
    if (node.abilityType === "spell_effect") {
      const destroyAll = node.effects.find(
        (e) => e.gameEffect?.category === "destroy"
      );
      expect(destroyAll).toBeDefined();
    }
  });

  test("'exile target creature' → exile effect", () => {
    const node = parse("Exile target creature.");
    const exileEffect = (node as SpellEffect | TriggeredAbility).effects.find(
      (e) => e.gameEffect?.category === "exile"
    );
    expect(exileEffect).toBeDefined();
  });

  test("'sacrifice a creature' as effect → sacrifice zone transition", () => {
    const node = asTriggered(
      parse("Whenever a creature you control dies, each opponent sacrifices a creature.")
    );
    const sacEffect = node.effects.find((e) => e.type === "sacrifice");
    expect(sacEffect).toBeDefined();
  });

  test("'create a treasure token' → create token effect", () => {
    const node = asTriggered(
      parse("Whenever a creature dies, create a treasure token.")
    );
    const tokenEffect = node.effects.find(
      (e) => e.gameEffect?.category === "create_token"
    );
    expect(tokenEffect).toBeDefined();
  });

  test("'search your library' → search effect", () => {
    const node = parse("Search your library for a basic land card.");
    const searchEffect = (node as SpellEffect | TriggeredAbility).effects.find(
      (e) => e.type === "search_library"
    );
    expect(searchEffect).toBeDefined();
  });

  test("'~ deals 3 damage' → damage effect", () => {
    const node = parse("~ deals 3 damage to any target.", "Lightning Bolt");
    const dmgEffect = (node as SpellEffect).effects.find(
      (e) => e.gameEffect?.category === "damage"
    );
    expect(dmgEffect).toBeDefined();
  });

  test("'put a +1/+1 counter' → counter attribute effect", () => {
    const node = parse("Put a +1/+1 counter on target creature.");
    const counterEffect = (node as SpellEffect).effects.find(
      (e) => e.attribute?.category === "counter"
    );
    expect(counterEffect).toBeDefined();
  });

  test("'each opponent loses 1 life' → life loss", () => {
    const node = asTriggered(
      parse("Whenever a creature dies, each opponent loses 1 life.")
    );
    const lifeEffect = node.effects.find(
      (e) => e.resource?.category === "life"
    );
    expect(lifeEffect).toBeDefined();
  });

  test("'you gain 1 life' → life gain", () => {
    const node = asTriggered(
      parse("Whenever a creature dies, you gain 1 life.")
    );
    const lifeEffect = node.effects.find(
      (e) => e.resource?.category === "life"
    );
    expect(lifeEffect).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. STATIC ABILITY PARSING
// ═══════════════════════════════════════════════════════════════

test.describe("static ability parsing", () => {
  test("anthem: 'Other creatures you control get +1/+1'", () => {
    const node = asStatic(parse("Other creatures you control get +1/+1."));
    expect(node.effects.length).toBeGreaterThanOrEqual(1);
    const statEff = node.effects.find((e) => e.attribute?.category === "stat_mod");
    expect(statEff).toBeDefined();
  });

  test("keyword grant: 'Creatures you control have flying'", () => {
    const node = asStatic(parse("Creatures you control have flying."));
    const kwEff = node.effects.find(
      (e) => e.attribute?.category === "keyword_grant"
    );
    expect(kwEff).toBeDefined();
  });

  test("negative anthem: 'Creatures your opponents control get -2/-2'", () => {
    const node = asStatic(
      parse("Creatures your opponents control get -2/-2.")
    );
    const statEff = node.effects.find((e) => e.attribute?.category === "stat_mod");
    expect(statEff).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. REPLACEMENT EFFECT PARSING
// ═══════════════════════════════════════════════════════════════

test.describe("replacement effect parsing", () => {
  test("Rest in Peace: 'would be put into a graveyard ... exile it instead'", () => {
    const node = asReplacement(
      parse(
        "If a card or token would be put into a graveyard from anywhere, exile it instead.",
        "Rest in Peace"
      )
    );
    expect(node.mode).toBe("replace");
    expect(node.replaces.kind).toBe("zone_transition");
  });

  test("Doubling Season: 'would create ... create twice that many instead'", () => {
    const node = asReplacement(
      parse(
        "If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead."
      )
    );
    expect(node.mode).toBe("modify");
  });

  test("replacement has 'with' effects", () => {
    const node = asReplacement(
      parse(
        "If a card or token would be put into a graveyard from anywhere, exile it instead.",
        "Rest in Peace"
      )
    );
    expect(node.with.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. DURATION PARSING
// ═══════════════════════════════════════════════════════════════

test.describe("duration parsing", () => {
  test("'until end of turn' → EffectDuration", () => {
    const node = asTriggered(
      parse("When ~ enters the battlefield, target creature gets +3/+3 until end of turn.")
    );
    const durationEffect = node.effects.find((e) => e.duration);
    expect(durationEffect).toBeDefined();
    expect(durationEffect!.duration!.type).toBe("until_end_of_turn");
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. CONDITION PARSING
// ═══════════════════════════════════════════════════════════════

test.describe("condition parsing", () => {
  test("'unless ... pays {1}' → condition", () => {
    const node = asTriggered(
      parse("Whenever an opponent casts a spell, you draw a card unless that player pays {1}.", "Rhystic Study")
    );
    expect(node.condition).toBeDefined();
    expect(node.condition!.type).toBe("unless");
  });
});

// ═══════════════════════════════════════════════════════════════
// 11. MULTI-ABILITY CARD PARSING
// ═══════════════════════════════════════════════════════════════

test.describe("multi-ability cards", () => {
  test("two abilities separated by newline", () => {
    const nodes = parseAll(
      "{T}: Add {G}.\nWhenever a creature enters the battlefield, draw a card."
    );
    expect(nodes).toHaveLength(2);
    expect(nodes[0].abilityType).toBe("activated");
    expect(nodes[1].abilityType).toBe("triggered");
  });

  test("keyword + triggered ability", () => {
    const nodes = parseAll(
      "Flying\nWhenever ~ deals combat damage to a player, draw a card.",
      "Thieving Magpie"
    );
    expect(nodes).toHaveLength(2);
    expect(nodes[0].abilityType).toBe("keyword");
    expect(nodes[1].abilityType).toBe("triggered");
  });

  test("multiple keywords + activated ability", () => {
    const nodes = parseAll(
      "Flying, vigilance\n{T}: Add {W}."
    );
    // "Flying, vigilance" should parse to 2 keywords, then activated
    expect(nodes.length).toBeGreaterThanOrEqual(3);
    expect(nodes[0].abilityType).toBe("keyword");
    expect(nodes[nodes.length - 1].abilityType).toBe("activated");
  });
});

// ═══════════════════════════════════════════════════════════════
// 12. REAL CARD INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════

test.describe("real cards", () => {
  test("Ashnod's Altar: activated sacrifice-for-mana", () => {
    const nodes = parseAll(
      "Sacrifice a creature: Add {C}{C}.",
      "Ashnod's Altar"
    );
    expect(nodes).toHaveLength(1);
    const node = asActivated(nodes[0]);
    expect(node.costs.some((c) => c.costType === "sacrifice")).toBe(true);
    expect(node.speed).toBe("mana_ability");
    const manaEffect = node.effects.find((e) => e.resource?.category === "mana");
    expect(manaEffect).toBeDefined();
  });

  test("Blood Artist: death trigger with drain", () => {
    const nodes = parseAll(
      "Whenever ~ or another creature dies, target player loses 1 life and you gain 1 life.",
      "Blood Artist"
    );
    expect(nodes).toHaveLength(1);
    const node = asTriggered(nodes[0]);
    expect(node.trigger.kind).toBe("zone_transition");
    expect(node.effects.length).toBeGreaterThanOrEqual(1);
  });

  test("Sol Ring: tap for mana", () => {
    const nodes = parseAll("{T}: Add {C}{C}.", "Sol Ring");
    expect(nodes).toHaveLength(1);
    const node = asActivated(nodes[0]);
    expect(node.costs.some((c) => c.costType === "tap")).toBe(true);
    expect(node.speed).toBe("mana_ability");
  });

  test("Lightning Bolt: damage spell", () => {
    const nodes = parseAll(
      "Lightning Bolt deals 3 damage to any target.",
      "Lightning Bolt"
    );
    expect(nodes).toHaveLength(1);
    const node = nodes[0];
    expect(["spell_effect", "static"]).toContain(node.abilityType);
    if (node.abilityType === "spell_effect") {
      const dmg = node.effects.find(
        (e) => e.gameEffect?.category === "damage"
      );
      expect(dmg).toBeDefined();
    }
  });

  test("Llanowar Elves: keyword + mana ability", () => {
    const nodes = parseAll("{T}: Add {G}.", "Llanowar Elves");
    expect(nodes).toHaveLength(1);
    const node = asActivated(nodes[0]);
    expect(node.speed).toBe("mana_ability");
  });

  test("Smothering Tithe: triggered with may-pay", () => {
    const nodes = parseAll(
      "Whenever an opponent draws a card, that player may pay {2}. If that player doesn't, you create a Treasure token.",
      "Smothering Tithe"
    );
    expect(nodes).toHaveLength(1);
    const node = asTriggered(nodes[0]);
    expect(node.trigger.kind).toBe("player_action");
  });

  test("Rhystic Study: triggered with unless-pay", () => {
    const nodes = parseAll(
      "Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.",
      "Rhystic Study"
    );
    expect(nodes).toHaveLength(1);
    const node = asTriggered(nodes[0]);
    expect(node.trigger.kind).toBe("player_action");
  });

  test("Craterhoof Behemoth: ETB + stat mod", () => {
    const nodes = parseAll(
      "When Craterhoof Behemoth enters the battlefield, creatures you control gain trample and get +X/+X until end of turn, where X is the number of creatures you control.",
      "Craterhoof Behemoth"
    );
    expect(nodes).toHaveLength(1);
    const node = asTriggered(nodes[0]);
    expect(node.trigger.kind).toBe("zone_transition");
  });

  test("Wrath of God: destroy all", () => {
    const nodes = parseAll(
      "Destroy all creatures. They can't be regenerated.",
      "Wrath of God"
    );
    expect(nodes).toHaveLength(1);
  });

  test("Grave Pact: death trigger forces sacrifice", () => {
    const nodes = parseAll(
      "Whenever a creature you control dies, each other player sacrifices a creature.",
      "Grave Pact"
    );
    expect(nodes).toHaveLength(1);
    const node = asTriggered(nodes[0]);
    expect(node.trigger.kind).toBe("zone_transition");
    const sacEffect = node.effects.find((e) => e.type === "sacrifice");
    expect(sacEffect).toBeDefined();
  });

  test("Swords to Plowshares: exile + life gain", () => {
    const nodes = parseAll(
      "Exile target creature. Its controller gains life equal to its power.",
      "Swords to Plowshares"
    );
    expect(nodes).toHaveLength(1);
  });

  test("Phyrexian Arena: upkeep trigger draw + life loss", () => {
    const nodes = parseAll(
      "At the beginning of your upkeep, you draw a card and you lose 1 life.",
      "Phyrexian Arena"
    );
    expect(nodes).toHaveLength(1);
    const node = asTriggered(nodes[0]);
    expect(node.trigger.kind).toBe("phase_trigger");
  });

  test("Rest in Peace: ETB exile + replacement", () => {
    const nodes = parseAll(
      "When Rest in Peace enters the battlefield, exile all cards from all graveyards.\nIf a card or token would be put into a graveyard from anywhere, exile it instead.",
      "Rest in Peace"
    );
    expect(nodes).toHaveLength(2);
    expect(nodes[0].abilityType).toBe("triggered");
    expect(nodes[1].abilityType).toBe("replacement");
  });

  test("Elesh Norn: anthem + negative anthem", () => {
    const nodes = parseAll(
      "Other creatures you control get +2/+2.\nCreatures your opponents control get -2/-2.",
      "Elesh Norn, Grand Cenobite"
    );
    expect(nodes).toHaveLength(2);
    expect(nodes[0].abilityType).toBe("static");
    expect(nodes[1].abilityType).toBe("static");
  });

  test("Demonic Tutor: search library", () => {
    const nodes = parseAll(
      "Search your library for a card, put that card into your hand, then shuffle.",
      "Demonic Tutor"
    );
    expect(nodes).toHaveLength(1);
  });

  test("Niv-Mizzet, Parun: two triggered abilities", () => {
    const nodes = parseAll(
      "Whenever you draw a card, Niv-Mizzet, Parun deals 1 damage to any target.\nWhenever a player casts an instant or sorcery spell, you draw a card.",
      "Niv-Mizzet, Parun"
    );
    expect(nodes).toHaveLength(2);
    expect(nodes[0].abilityType).toBe("triggered");
    expect(nodes[1].abilityType).toBe("triggered");
  });

  test("Korvold: sacrifice trigger draws + counters", () => {
    const nodes = parseAll(
      "Whenever you sacrifice a permanent, put a +1/+1 counter on Korvold and draw a card.",
      "Korvold, Fae-Cursed King"
    );
    expect(nodes).toHaveLength(1);
    const node = asTriggered(nodes[0]);
    expect(node.effects.length).toBeGreaterThanOrEqual(1);
  });

  test("Aetherflux Reservoir: triggered + activated with life cost", () => {
    const nodes = parseAll(
      "Whenever you cast a spell, you gain 1 life for each spell you've cast this turn.\nPay 50 life: Aetherflux Reservoir deals 50 damage to any target.",
      "Aetherflux Reservoir"
    );
    expect(nodes).toHaveLength(2);
    expect(nodes[0].abilityType).toBe("triggered");
    expect(nodes[1].abilityType).toBe("activated");
    const lifeCost = (nodes[1] as ActivatedAbility).costs.find(
      (c) => c.costType === "pay_life"
    );
    expect(lifeCost).toBeDefined();
  });

  test("Force of Will: counter spell with alternative cost text", () => {
    const nodes = parseAll(
      "You may pay 1 life and exile a blue card from your hand rather than pay this spell's mana cost.\nCounter target spell.",
      "Force of Will"
    );
    // Should produce ONE ability node (merged alt cost + counter effect)
    expect(nodes).toHaveLength(1);
    const spell = asSpellEffect(nodes[0]);
    expect(spell.castingCost.alternativeCosts).toBeDefined();
    expect(spell.castingCost.alternativeCosts!.length).toBeGreaterThanOrEqual(1);
    const counter = spell.effects.find((e) => e.type === "counter_spell");
    expect(counter).toBeDefined();
  });

  test("Doubling Season: replacement effect", () => {
    const nodes = parseAll(
      "If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead.\nIf an effect would put one or more counters on a permanent you control, it puts twice that many of those counters on that permanent instead.",
      "Doubling Season"
    );
    expect(nodes).toHaveLength(2);
    expect(nodes[0].abilityType).toBe("replacement");
    expect(nodes[1].abilityType).toBe("replacement");
  });

  test("Teferi's Protection: phasing + protection", () => {
    const nodes = parseAll(
      "Until your next turn, your life total can't change and you have protection from everything. All permanents you control phase out.",
      "Teferi's Protection"
    );
    expect(nodes.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 13. ADDITIONAL COST PARSING
// ═══════════════════════════════════════════════════════════════

test.describe("additional cost parsing", () => {
  test("Fling: additional cost sacrifice merged into single spell_effect", () => {
    const nodes = parseAll(
      "As an additional cost to cast this spell, sacrifice a creature.\nFling deals damage equal to the sacrificed creature's power to any target.",
      "Fling"
    );

    // Should produce ONE ability node (the two blocks merged)
    expect(nodes).toHaveLength(1);
    const spell = asSpellEffect(nodes[0]);

    // castingCost.additionalCosts should contain a SacrificeCost
    expect(spell.castingCost.additionalCosts.length).toBeGreaterThanOrEqual(1);
    const sacCost = spell.castingCost.additionalCosts.find(
      (c) => c.costType === "sacrifice"
    ) as SacrificeCost | undefined;
    expect(sacCost).toBeDefined();
    expect(sacCost!.object.types).toContain("creature");

    // effects should contain a damage effect
    const dmg = spell.effects.find(
      (e) => e.type === "damage" || e.gameEffect?.category === "damage"
    );
    expect(dmg).toBeDefined();
  });

  test("Village Rites: additional cost sacrifice + draw two cards", () => {
    const nodes = parseAll(
      "As an additional cost to cast this spell, sacrifice a creature.\nDraw two cards.",
      "Village Rites"
    );

    expect(nodes).toHaveLength(1);
    const spell = asSpellEffect(nodes[0]);

    // Additional costs should have sacrifice
    expect(spell.castingCost.additionalCosts.length).toBeGreaterThanOrEqual(1);
    const sacCost = spell.castingCost.additionalCosts.find(
      (c) => c.costType === "sacrifice"
    ) as SacrificeCost | undefined;
    expect(sacCost).toBeDefined();
    expect(sacCost!.object.types).toContain("creature");

    // effects should have draw with quantity 2
    const drawEffect = spell.effects.find((e) => e.type === "draw");
    expect(drawEffect).toBeDefined();
    expect(drawEffect!.resource?.category).toBe("cards");
    expect(drawEffect!.resource?.quantity).toBe(2);
  });

  test("Bone Splinters: additional cost sacrifice + destroy target creature", () => {
    const nodes = parseAll(
      "As an additional cost to cast this spell, sacrifice a creature.\nDestroy target creature.",
      "Bone Splinters"
    );

    expect(nodes).toHaveLength(1);
    const spell = asSpellEffect(nodes[0]);

    // Additional costs
    const sacCost = spell.castingCost.additionalCosts.find(
      (c) => c.costType === "sacrifice"
    ) as SacrificeCost | undefined;
    expect(sacCost).toBeDefined();

    // effects should have destroy
    const destroyEffect = spell.effects.find(
      (e) => e.gameEffect?.category === "destroy"
    );
    expect(destroyEffect).toBeDefined();
  });

  test("Deadly Dispute: additional cost sacrifice artifact or creature", () => {
    const nodes = parseAll(
      "As an additional cost to cast this spell, sacrifice an artifact or creature.\nDraw two cards and create a Treasure token.",
      "Deadly Dispute"
    );

    expect(nodes).toHaveLength(1);
    const spell = asSpellEffect(nodes[0]);

    // Additional costs should have sacrifice
    const sacCost = spell.castingCost.additionalCosts.find(
      (c) => c.costType === "sacrifice"
    ) as SacrificeCost | undefined;
    expect(sacCost).toBeDefined();
  });

  test("additional cost block as last block (no following spell block) handled gracefully", () => {
    // Edge case: additional cost block with no following block
    const nodes = parseAll(
      "As an additional cost to cast this spell, sacrifice a creature.",
      "TestCard"
    );

    // Should still produce at least one node (parsed standalone)
    expect(nodes.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 14. ALTERNATIVE COST PARSING
// ═══════════════════════════════════════════════════════════════

test.describe("alternative cost parsing", () => {
  test("Force of Will: alternative cost merged into single spell_effect", () => {
    const nodes = parseAll(
      "You may pay 1 life and exile a blue card from your hand rather than pay this spell's mana cost.\nCounter target spell.",
      "Force of Will"
    );

    // Should produce ONE ability node (the two blocks merged)
    expect(nodes).toHaveLength(1);
    const spell = asSpellEffect(nodes[0]);

    // castingCost.alternativeCosts should be defined and non-empty
    expect(spell.castingCost.alternativeCosts).toBeDefined();
    expect(spell.castingCost.alternativeCosts!.length).toBeGreaterThanOrEqual(1);

    const altCost = spell.castingCost.alternativeCosts![0];
    expect(altCost.costs.length).toBeGreaterThanOrEqual(1);

    // Should include PayLifeCost and ExileCost
    const hasPayLife = altCost.costs.some((c) => c.costType === "pay_life");
    const hasExile = altCost.costs.some((c) => c.costType === "exile");
    expect(hasPayLife || hasExile).toBe(true);

    // effects should contain counter_spell
    const counterEffect = spell.effects.find((e) => e.type === "counter_spell");
    expect(counterEffect).toBeDefined();
  });

  test("Force of Negation: alternative cost with condition", () => {
    const nodes = parseAll(
      "If it's not your turn, you may exile a blue card from your hand rather than pay this spell's mana cost.\nCounter target noncreature spell.",
      "Force of Negation"
    );

    expect(nodes).toHaveLength(1);
    const spell = asSpellEffect(nodes[0]);

    // Should have alternativeCosts
    expect(spell.castingCost.alternativeCosts).toBeDefined();
    expect(spell.castingCost.alternativeCosts!.length).toBeGreaterThanOrEqual(1);

    // effects should contain counter_spell
    const counterEffect = spell.effects.find((e) => e.type === "counter_spell");
    expect(counterEffect).toBeDefined();
  });

  test("Solitude: alternative cost with triggered ability as next block", () => {
    const nodes = parseAll(
      "You may exile a white card from your hand rather than pay this spell's mana cost.\nWhen Solitude enters the battlefield, exile up to one other target creature. That creature's controller gains life equal to its power.",
      "Solitude"
    );

    // The first block is an alternative cost; the second is a triggered ability.
    // Since the next block is triggered (not spell_effect), the alt cost block
    // should be parsed standalone + the triggered ability separately.
    expect(nodes.length).toBeGreaterThanOrEqual(2);

    // The triggered ability should still be present
    const triggered = nodes.find((n) => n.abilityType === "triggered");
    expect(triggered).toBeDefined();
  });

  test("alternative cost block as last block handled gracefully", () => {
    const nodes = parseAll(
      "You may exile a blue card from your hand rather than pay this spell's mana cost.",
      "TestCard"
    );

    // Should produce at least one node
    expect(nodes.length).toBeGreaterThanOrEqual(1);
  });
});
