import { test, expect } from "@playwright/test";
import {
  lookupKeyword,
  expandKeyword,
  getKeywordsByCategory,
  hasKeyword,
  getAllKeywordNames,
  KEYWORD_DATABASE,
} from "../../src/lib/interaction-engine/keyword-database";
import type { AbilityNode } from "../../src/lib/interaction-engine/types";

// ═══════════════════════════════════════════════════════════════════
// lookupKeyword
// ═══════════════════════════════════════════════════════════════════

test.describe("lookupKeyword", () => {
  test("finds flying (case-insensitive)", () => {
    const entry = lookupKeyword("Flying");
    expect(entry).toBeDefined();
    expect(entry!.keyword).toBe("flying");
  });

  test("finds ward (parameterized keyword)", () => {
    const entry = lookupKeyword("ward");
    expect(entry).toBeDefined();
    expect(entry!.hasParameter).toBe(true);
  });

  test("returns undefined for unknown keyword", () => {
    expect(lookupKeyword("nonexistent_keyword")).toBeUndefined();
  });

  test("finds crew (permanent-type keyword)", () => {
    const entry = lookupKeyword("crew");
    expect(entry).toBeDefined();
    expect(entry!.category).toBe("permanent_type");
  });

  test("finds storm (copy-generation keyword)", () => {
    const entry = lookupKeyword("storm");
    expect(entry).toBeDefined();
    expect(entry!.category).toBe("copy_generation");
  });
});

// ═══════════════════════════════════════════════════════════════════
// expandKeyword — Simple keywords
// ═══════════════════════════════════════════════════════════════════

test.describe("expandKeyword — simple keywords", () => {
  test("flying expands to a static ability", () => {
    const abilities = expandKeyword("flying");
    expect(abilities).toBeDefined();
    expect(abilities).toHaveLength(1);
    expect(abilities![0].abilityType).toBe("static");
  });

  test("haste expands to remove_summoning_sickness", () => {
    const abilities = expandKeyword("haste");
    expect(abilities).toBeDefined();
    expect(abilities![0].abilityType).toBe("static");
    const static_ = abilities![0] as { effects: { type: string }[] };
    expect(static_.effects[0].type).toBe("remove_summoning_sickness");
  });

  test("lifelink expands to damage_also_gains_life", () => {
    const abilities = expandKeyword("lifelink");
    expect(abilities).toBeDefined();
    const static_ = abilities![0] as { effects: { type: string }[] };
    expect(static_.effects[0].type).toBe("damage_also_gains_life");
  });

  test("indestructible explains what it does NOT prevent", () => {
    const abilities = expandKeyword("indestructible");
    expect(abilities).toBeDefined();
    const static_ = abilities![0] as {
      effects: { details: { description: string } }[];
    };
    const desc = static_.effects[0].details.description;
    expect(desc).toContain("sacrifice");
    expect(desc).toContain("exile");
  });

  test("hexproof restricts targeting by opponents only", () => {
    const abilities = expandKeyword("hexproof");
    expect(abilities).toBeDefined();
    const static_ = abilities![0] as {
      effects: { details: { cantBeTargetedBy: string } }[];
    };
    expect(static_.effects[0].details.cantBeTargetedBy).toBe("opponents");
  });

  test("shroud restricts targeting by anyone", () => {
    const abilities = expandKeyword("shroud");
    expect(abilities).toBeDefined();
    const static_ = abilities![0] as {
      effects: { details: { cantBeTargetedBy: string } }[];
    };
    expect(static_.effects[0].details.cantBeTargetedBy).toBe("any");
  });

  test("phasing notes it does NOT cause zone transitions", () => {
    const abilities = expandKeyword("phasing");
    expect(abilities).toBeDefined();
    const static_ = abilities![0] as {
      effects: { details: { description: string } }[];
    };
    expect(static_.effects[0].details.description).toContain(
      "NOT cause zone transitions"
    );
  });

  test("defender creates an attack restriction", () => {
    const abilities = expandKeyword("defender");
    expect(abilities).toBeDefined();
    const static_ = abilities![0] as {
      effects: { gameEffect?: { restricts: string } }[];
    };
    expect(static_.effects[0].gameEffect?.restricts).toBe("attack");
  });
});

// ═══════════════════════════════════════════════════════════════════
// expandKeyword — Parameterized keywords
// ═══════════════════════════════════════════════════════════════════

test.describe("expandKeyword — parameterized keywords", () => {
  test("ward 3 expands to a triggered ability on targeting", () => {
    const abilities = expandKeyword("ward", "3");
    expect(abilities).toBeDefined();
    expect(abilities![0].abilityType).toBe("triggered");
    const triggered = abilities![0] as { trigger: { kind: string } };
    expect(triggered.trigger.kind).toBe("target");
  });

  test("protection from red includes DEBT components", () => {
    const abilities = expandKeyword("protection", "red");
    expect(abilities).toBeDefined();
    const static_ = abilities![0] as {
      effects: { details: Record<string, string> }[];
    };
    const details = static_.effects[0].details;
    expect(details.damagePreventedFrom).toBe("red");
    expect(details.cantBeBlockedBy).toBe("red");
    expect(details.cantBeTargetedBy).toBe("red");
    expect(details.cantBeEnchantedOrEquippedBy).toBe("red");
  });

  test("crew 3 expands to activated ability with CrewCost", () => {
    const abilities = expandKeyword("crew", "3");
    expect(abilities).toBeDefined();
    expect(abilities![0].abilityType).toBe("activated");
    const activated = abilities![0] as { costs: { costType: string; powerThreshold?: number }[] };
    expect(activated.costs[0].costType).toBe("crew");
    expect(activated.costs[0].powerThreshold).toBe(3);
  });

  test("saddle 2 expands to activated ability with SaddleCost", () => {
    const abilities = expandKeyword("saddle", "2");
    expect(abilities).toBeDefined();
    const activated = abilities![0] as { costs: { costType: string; powerThreshold?: number }[] };
    expect(activated.costs[0].costType).toBe("saddle");
    expect(activated.costs[0].powerThreshold).toBe(2);
  });

  test("equip {2} is sorcery speed", () => {
    const abilities = expandKeyword("equip", "{2}");
    expect(abilities).toBeDefined();
    expect(abilities![0].abilityType).toBe("activated");
    const activated = abilities![0] as { speed: string };
    expect(activated.speed).toBe("sorcery");
  });

  test("crew 3 is instant speed (CR 702.122 — no timing restriction)", () => {
    const abilities = expandKeyword("crew", "3");
    expect(abilities).toBeDefined();
    expect(abilities![0].abilityType).toBe("activated");
    const activated = abilities![0] as { speed: string };
    expect(activated.speed).toBe("instant");
  });

  test("saddle 2 is sorcery speed (CR 702.171a — activate only as a sorcery)", () => {
    const abilities = expandKeyword("saddle", "2");
    expect(abilities).toBeDefined();
    expect(abilities![0].abilityType).toBe("activated");
    const activated = abilities![0] as { speed: string };
    expect(activated.speed).toBe("sorcery");
  });

  test("adapt 3 is instant speed (CR 702.139 — no timing restriction)", () => {
    const abilities = expandKeyword("adapt", "3");
    expect(abilities).toBeDefined();
    expect(abilities![0].abilityType).toBe("activated");
    const activated = abilities![0] as { speed: string };
    expect(activated.speed).toBe("instant");
  });
});

// ═══════════════════════════════════════════════════════════════════
// expandKeyword — Complex keywords
// ═══════════════════════════════════════════════════════════════════

test.describe("expandKeyword — complex keywords", () => {
  test("suspend 4 produces two triggered abilities", () => {
    const abilities = expandKeyword("suspend", "4");
    expect(abilities).toBeDefined();
    expect(abilities!.length).toBe(2);
    expect(abilities![0].abilityType).toBe("triggered");
    expect(abilities![1].abilityType).toBe("triggered");
  });

  test("cascade is a triggered ability on cast", () => {
    const abilities = expandKeyword("cascade");
    expect(abilities).toBeDefined();
    expect(abilities![0].abilityType).toBe("triggered");
    const triggered = abilities![0] as { trigger: { kind: string; action?: string } };
    expect(triggered.trigger.kind).toBe("player_action");
    expect(triggered.trigger.action).toBe("cast_spell");
  });

  test("cascade notes that cascaded card IS cast and CAN chain", () => {
    const abilities = expandKeyword("cascade");
    const triggered = abilities![0] as {
      effects: { details: { isCast: boolean; canChain: boolean } }[];
    };
    expect(triggered.effects[0].details.isCast).toBe(true);
    expect(triggered.effects[0].details.canChain).toBe(true);
  });

  test("discover notes hand option breaks the chain", () => {
    const abilities = expandKeyword("discover", "5");
    const triggered = abilities![0] as {
      effects: { details: { handOptionBreaksChain: boolean } }[];
    };
    expect(triggered.effects[0].details.handOptionBreaksChain).toBe(true);
  });

  test("storm copies are NOT cast", () => {
    const abilities = expandKeyword("storm");
    const triggered = abilities![0] as {
      effects: { gameEffect?: { castCopy: boolean } }[];
    };
    expect(triggered.effects[0].gameEffect?.castCopy).toBe(false);
  });

  test("cipher copies ARE cast", () => {
    const abilities = expandKeyword("cipher");
    const static_ = abilities![0] as {
      effects: { details: { castCopy: boolean } }[];
    };
    expect(static_.effects[0].details.castCopy).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// expandKeyword — Undying/Persist trigger cause
// ═══════════════════════════════════════════════════════════════════

test.describe("expandKeyword — undying/persist triggers", () => {
  test("undying trigger has no cause (triggers on any battlefield→graveyard)", () => {
    const abilities = expandKeyword("undying");
    expect(abilities).toBeDefined();
    expect(abilities![0].abilityType).toBe("triggered");
    const triggered = abilities![0] as {
      trigger: { kind: string; from: string; to: string; cause?: string };
    };
    expect(triggered.trigger.kind).toBe("zone_transition");
    expect(triggered.trigger.from).toBe("battlefield");
    expect(triggered.trigger.to).toBe("graveyard");
    expect(triggered.trigger.cause).toBeUndefined();
  });

  test("persist trigger has no cause (triggers on any battlefield→graveyard)", () => {
    const abilities = expandKeyword("persist");
    expect(abilities).toBeDefined();
    expect(abilities![0].abilityType).toBe("triggered");
    const triggered = abilities![0] as {
      trigger: { kind: string; from: string; to: string; cause?: string };
    };
    expect(triggered.trigger.kind).toBe("zone_transition");
    expect(triggered.trigger.from).toBe("battlefield");
    expect(triggered.trigger.to).toBe("graveyard");
    expect(triggered.trigger.cause).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// expandKeyword — Zone-casting keywords
// ═══════════════════════════════════════════════════════════════════

test.describe("expandKeyword — zone-casting keywords", () => {
  test("flashback grants graveyard casting", () => {
    const abilities = expandKeyword("flashback", "{3}{R}");
    expect(abilities).toBeDefined();
    const static_ = abilities![0] as {
      effects: { gameEffect?: { fromZone: string } }[];
    };
    expect(static_.effects[0].gameEffect?.fromZone).toBe("graveyard");
  });

  test("escape grants graveyard casting with zone-of-origin conditional", () => {
    const abilities = expandKeyword("escape", "{3}{B}{B}, Exile five other cards");
    expect(abilities).toBeDefined();
    const static_ = abilities![0] as {
      effects: { details: { zoneOfOriginConditional: boolean } }[];
    };
    expect(static_.effects[0].details.zoneOfOriginConditional).toBe(true);
  });

  test("unearth is an activated ability from graveyard", () => {
    const abilities = expandKeyword("unearth", "{2}{B}");
    expect(abilities).toBeDefined();
    expect(abilities![0].abilityType).toBe("activated");
  });

  test("rebound is a replacement ability", () => {
    const abilities = expandKeyword("rebound");
    expect(abilities).toBeDefined();
    expect(abilities![0].abilityType).toBe("replacement");
    const replacement = abilities![0] as { mode: string };
    expect(replacement.mode).toBe("replace");
  });
});

// ═══════════════════════════════════════════════════════════════════
// expandKeyword — Damage-routing keywords
// ═══════════════════════════════════════════════════════════════════

test.describe("expandKeyword — damage-routing keywords", () => {
  test("infect routes damage as -1/-1 counters to creatures and poison to players", () => {
    const abilities = expandKeyword("infect");
    expect(abilities).toBeDefined();
    const static_ = abilities![0] as {
      effects: { details: { toCreatures: string; toPlayers: string } }[];
    };
    expect(static_.effects[0].details.toCreatures).toContain("-1/-1 counters");
    expect(static_.effects[0].details.toPlayers).toContain("poison counters");
  });

  test("wither routes damage as -1/-1 counters to creatures but normal to players", () => {
    const abilities = expandKeyword("wither");
    const static_ = abilities![0] as {
      effects: { details: { toCreatures: string; toPlayers: string } }[];
    };
    expect(static_.effects[0].details.toCreatures).toContain("-1/-1 counters");
    expect(static_.effects[0].details.toPlayers).toContain("normal");
  });
});

// ═══════════════════════════════════════════════════════════════════
// expandKeyword — Alternative casting keywords
// ═══════════════════════════════════════════════════════════════════

test.describe("expandKeyword — alternative casting keywords", () => {
  test("evoke notes mandatory sacrifice and ETB still triggers", () => {
    const abilities = expandKeyword("evoke", "{W}");
    const static_ = abilities![0] as {
      effects: {
        details: { mandatorySacrifice: boolean; etbStillTriggers: boolean };
      }[];
    };
    expect(static_.effects[0].details.mandatorySacrifice).toBe(true);
    expect(static_.effects[0].details.etbStillTriggers).toBe(true);
  });

  test("bestow notes falloff becomes creature", () => {
    const abilities = expandKeyword("bestow", "{3}{W}");
    const static_ = abilities![0] as {
      effects: { details: { falloffBecomesCreature: boolean } }[];
    };
    expect(static_.effects[0].details.falloffBecomesCreature).toBe(true);
  });

  test("overload replaces target with each", () => {
    const abilities = expandKeyword("overload", "{4}{U}{U}");
    const static_ = abilities![0] as {
      effects: { details: { replacesTargetWithEach: boolean } }[];
    };
    expect(static_.effects[0].details.replacesTargetWithEach).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// expandKeyword — Resource token keywords
// ═══════════════════════════════════════════════════════════════════

test.describe("expandKeyword — resource token keywords", () => {
  test("treasure token definition has correct ability", () => {
    const abilities = expandKeyword("treasure");
    const static_ = abilities![0] as {
      effects: { details: { tokenType: string; ability: string } }[];
    };
    expect(static_.effects[0].details.tokenType).toBe("Treasure");
    expect(static_.effects[0].details.ability).toContain("Add one mana");
  });

  test("food token definition has correct ability", () => {
    const abilities = expandKeyword("food");
    const static_ = abilities![0] as {
      effects: { details: { tokenType: string; ability: string } }[];
    };
    expect(static_.effects[0].details.tokenType).toBe("Food");
    expect(static_.effects[0].details.ability).toContain("gain 3 life");
  });

  test("clue token definition has draw ability", () => {
    const abilities = expandKeyword("clue");
    const static_ = abilities![0] as {
      effects: { details: { ability: string } }[];
    };
    expect(static_.effects[0].details.ability).toContain("Draw a card");
  });

  test("powerstone restricts non-artifact spending", () => {
    const abilities = expandKeyword("powerstone");
    const static_ = abilities![0] as {
      effects: { details: { ability: string } }[];
    };
    expect(static_.effects[0].details.ability).toContain("nonartifact");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Utility functions
// ═══════════════════════════════════════════════════════════════════

test.describe("hasKeyword", () => {
  test("returns true for known keywords", () => {
    expect(hasKeyword("flying")).toBe(true);
    expect(hasKeyword("trample")).toBe(true);
    expect(hasKeyword("cascade")).toBe(true);
    expect(hasKeyword("storm")).toBe(true);
  });

  test("returns false for unknown keywords", () => {
    expect(hasKeyword("nonexistent")).toBe(false);
  });

  test("is case-insensitive", () => {
    expect(hasKeyword("FLYING")).toBe(true);
    expect(hasKeyword("Flying")).toBe(true);
  });
});

test.describe("getKeywordsByCategory", () => {
  test("simple category has multiple keywords", () => {
    const simple = getKeywordsByCategory("simple");
    expect(simple.length).toBeGreaterThan(5);
    const names = simple.map((k) => k.keyword);
    expect(names).toContain("flying");
    expect(names).toContain("haste");
    expect(names).toContain("lifelink");
  });

  test("cost_modifying category has convoke and delve", () => {
    const costMod = getKeywordsByCategory("cost_modifying");
    const names = costMod.map((k) => k.keyword);
    expect(names).toContain("convoke");
    expect(names).toContain("delve");
  });

  test("zone_casting category has flashback and escape", () => {
    const zoneCast = getKeywordsByCategory("zone_casting");
    const names = zoneCast.map((k) => k.keyword);
    expect(names).toContain("flashback");
    expect(names).toContain("escape");
  });

  test("damage_routing category has infect and wither", () => {
    const dmgRouting = getKeywordsByCategory("damage_routing");
    const names = dmgRouting.map((k) => k.keyword);
    expect(names).toContain("infect");
    expect(names).toContain("wither");
  });

  test("copy_generation category has storm", () => {
    const copyGen = getKeywordsByCategory("copy_generation");
    const names = copyGen.map((k) => k.keyword);
    expect(names).toContain("storm");
  });
});

test.describe("getAllKeywordNames", () => {
  test("returns all keyword names", () => {
    const names = getAllKeywordNames();
    expect(names.length).toBe(KEYWORD_DATABASE.length);
    expect(names).toContain("flying");
    expect(names).toContain("cascade");
    expect(names).toContain("storm");
  });
});

// ═══════════════════════════════════════════════════════════════════
// All keywords expand without errors
// ═══════════════════════════════════════════════════════════════════

test.describe("all keywords expand without errors", () => {
  for (const entry of KEYWORD_DATABASE) {
    test(`${entry.keyword} expands successfully`, () => {
      const param = entry.hasParameter ? "3" : undefined;
      const abilities = entry.expand(param, "Test Card");
      expect(abilities).toBeDefined();
      expect(abilities.length).toBeGreaterThanOrEqual(1);
      for (const ability of abilities) {
        expect(ability.abilityType).toBeDefined();
      }
    });
  }
});
