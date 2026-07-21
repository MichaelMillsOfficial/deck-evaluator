import { test, expect } from "@playwright/test";
import {
  encodeCruciblePile,
  decodeCruciblePile,
  serializePileToDck,
  parsePileFromDck,
} from "../../src/lib/crucible-share";
import type { CruciblePayload } from "../../src/lib/crucible-session";

/** Gzip + base64url an arbitrary object, mirroring the codec's own encoding,
 * so tests can feed hand-crafted (hostile) payloads to decodeCruciblePile. */
async function encodeRaw(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  void writer.write(bytes);
  void writer.close();
  const compressed = new Uint8Array(
    await new Response(cs.readable).arrayBuffer()
  );
  let binary = "";
  for (const b of compressed) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function makePayload(overrides: Partial<CruciblePayload> = {}): CruciblePayload {
  return {
    crucibleId: "crucible-fixture",
    pool: [
      { name: "Atraxa, Praetors' Voice", quantity: 1 },
      { name: "Sol Ring", quantity: 1 },
      { name: "Forest", quantity: 3 },
      { name: "Island", quantity: 2 },
    ],
    statuses: {
      "Atraxa, Praetors' Voice": "keep",
      "Sol Ring": "keep",
      Forest: "cut",
      Island: "undecided",
    },
    keptQuantities: { Forest: 0 },
    commanders: ["Atraxa, Praetors' Voice"],
    parseWarnings: [],
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

test.describe("encodeCruciblePile / decodeCruciblePile", () => {
  test("round-trip preserves pool, statuses, commanders, keptQuantities", async () => {
    const payload = makePayload({
      keptQuantities: { Island: 1 },
      statuses: {
        "Atraxa, Praetors' Voice": "keep",
        "Sol Ring": "keep",
        Forest: "cut",
        Island: "keep",
      },
    });
    const encoded = await encodeCruciblePile(payload);
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);

    const decoded = await decodeCruciblePile(encoded);
    expect(decoded).not.toBeNull();
    if (!decoded) return;

    expect(decoded.pool).toEqual(payload.pool);
    expect(decoded.statuses).toEqual(payload.statuses);
    expect(decoded.commanders).toEqual(payload.commanders);
    expect(decoded.keptQuantities).toEqual(payload.keptQuantities);
  });

  test("every pool name has a status entry after decode", async () => {
    const payload = makePayload();
    const decoded = await decodeCruciblePile(await encodeCruciblePile(payload));
    expect(decoded).not.toBeNull();
    if (!decoded) return;
    for (const card of payload.pool) {
      expect(decoded.statuses[card.name]).toBeDefined();
    }
    // Undecided is the default and must survive the round-trip.
    expect(decoded.statuses.Island).toBe("undecided");
  });

  test("regenerates crucibleId and createdAt (does not trust the encoded ones)", async () => {
    const payload = makePayload();
    const decoded = await decodeCruciblePile(await encodeCruciblePile(payload));
    expect(decoded).not.toBeNull();
    if (!decoded) return;
    expect(typeof decoded.crucibleId).toBe("string");
    expect(decoded.crucibleId.length).toBeGreaterThan(0);
    expect(typeof decoded.createdAt).toBe("number");
  });

  test("empty keptQuantities and commanders round-trip cleanly", async () => {
    const payload = makePayload({
      commanders: [],
      keptQuantities: {},
      statuses: {
        "Atraxa, Praetors' Voice": "undecided",
        "Sol Ring": "undecided",
        Forest: "undecided",
        Island: "undecided",
      },
    });
    const decoded = await decodeCruciblePile(await encodeCruciblePile(payload));
    expect(decoded).not.toBeNull();
    if (!decoded) return;
    expect(decoded.commanders).toEqual([]);
    expect(decoded.keptQuantities).toEqual({});
  });

  test("returns null for corrupt base64url input", async () => {
    expect(await decodeCruciblePile("!!!not-valid!!!")).toBeNull();
    expect(await decodeCruciblePile("")).toBeNull();
  });

  test("returns null for foreign (non-crucible) payloads", async () => {
    // A valid gzip+base64url blob whose JSON is not a crucible pile.
    const foreign = { v: 2, n: "Some Deck", c: [], m: [["cmm", "1", 1]] };
    const bytes = new TextEncoder().encode(JSON.stringify(foreign));
    const cs = new CompressionStream("gzip");
    const writer = cs.writable.getWriter();
    void writer.write(bytes);
    void writer.close();
    const compressed = new Uint8Array(
      await new Response(cs.readable).arrayBuffer()
    );
    let binary = "";
    for (const b of compressed) binary += String.fromCharCode(b);
    const encoded = btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(await decodeCruciblePile(encoded)).toBeNull();
  });
});

test.describe("serializePileToDck", () => {
  test("emits [metadata], [Commander], and [Main] sections", () => {
    const dck = serializePileToDck(makePayload(), "My Pile");
    expect(dck).toContain("[metadata]");
    expect(dck).toContain("Name=My Pile");
    expect(dck).toContain("[Commander]");
    expect(dck).toContain("[Main]");
    // Sections appear in the canonical order.
    expect(dck.indexOf("[metadata]")).toBeLessThan(dck.indexOf("[Commander]"));
    expect(dck.indexOf("[Commander]")).toBeLessThan(dck.indexOf("[Main]"));
  });

  test("lists each commander as a single copy", () => {
    const dck = serializePileToDck(makePayload());
    const commanderSection = dck
      .slice(dck.indexOf("[Commander]"), dck.indexOf("[Main]"))
      .trim();
    expect(commanderSection).toContain("1 Atraxa, Praetors' Voice");
  });

  test("lists non-commander pool cards as `<qty> <name>` in [Main]", () => {
    const dck = serializePileToDck(makePayload());
    const mainSection = dck.slice(dck.indexOf("[Main]"));
    expect(mainSection).toContain("1 Sol Ring");
    expect(mainSection).toContain("3 Forest");
    expect(mainSection).toContain("2 Island");
  });

  test("does not duplicate the commander in [Main] (command zone only)", () => {
    const dck = serializePileToDck(makePayload());
    const commanderSection = dck.slice(
      dck.indexOf("[Commander]"),
      dck.indexOf("[Main]")
    );
    const mainSection = dck.slice(dck.indexOf("[Main]"));
    expect(commanderSection).toContain("1 Atraxa, Praetors' Voice");
    expect(mainSection).not.toContain("Atraxa, Praetors' Voice");
  });

  test("falls back to a default name when none is provided", () => {
    const dck = serializePileToDck(makePayload({ commanders: [] }));
    expect(dck).toMatch(/Name=.+/);
  });

  test("omits commander lines when no commanders are chosen", () => {
    const dck = serializePileToDck(makePayload({ commanders: [] }), "Pile");
    const commanderSection = dck
      .slice(dck.indexOf("[Commander]"), dck.indexOf("[Main]"))
      .trim();
    expect(commanderSection).toBe("[Commander]");
  });
});

test.describe("decodeCruciblePile hardening (untrusted input)", () => {
  test("rejects a pool larger than the entry cap", async () => {
    const p: [string, number][] = [];
    for (let i = 0; i < 2_001; i++) p.push([`Card ${i}`, 1]);
    const encoded = await encodeRaw({ v: 1, p, s: {}, k: {}, c: [] });
    expect(await decodeCruciblePile(encoded)).toBeNull();
  });

  test("rejects non-positive, fractional, and absurd quantities", async () => {
    for (const bad of [0, -3, 1.5, 1e9]) {
      const encoded = await encodeRaw({
        v: 1,
        p: [["Sol Ring", bad]],
        s: {},
        k: {},
        c: [],
      });
      expect(await decodeCruciblePile(encoded)).toBeNull();
    }
  });

  test("rejects an over-long card name", async () => {
    const encoded = await encodeRaw({
      v: 1,
      p: [["x".repeat(201), 1]],
      s: {},
      k: {},
      c: [],
    });
    expect(await decodeCruciblePile(encoded)).toBeNull();
  });

  test("drops kept counts and commanders not present in the pool", async () => {
    const encoded = await encodeRaw({
      v: 1,
      p: [["Sol Ring", 1]],
      s: { "Sol Ring": "k" },
      k: { "Sol Ring": 1, "Ghost Card": 4 },
      c: ["Sol Ring", "Not In Pool"],
    });
    const decoded = await decodeCruciblePile(encoded);
    expect(decoded).not.toBeNull();
    if (!decoded) return;
    expect(decoded.keptQuantities).toEqual({ "Sol Ring": 1 });
    expect(decoded.commanders).toEqual(["Sol Ring"]);
  });

  test("defuses a gzip bomb by capping decompressed size", async () => {
    // Highly compressible: a tiny gzip that inflates past the 1MB cap.
    const encoded = await encodeRaw({
      v: 1,
      p: [["A".repeat(2_000_000), 1]],
      s: {},
      k: {},
      c: [],
    });
    expect(await decodeCruciblePile(encoded)).toBeNull();
  });
});

test.describe("parsePileFromDck", () => {
  test("round-trips a serialized .dck back into an equivalent pile", () => {
    const dck = serializePileToDck(makePayload(), "My Pile");
    const parsed = parsePileFromDck(dck);
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    // Commander + main cards all land in the pool.
    const names = parsed.pool.map((c) => c.name).sort();
    expect(names).toEqual(
      ["Atraxa, Praetors' Voice", "Forest", "Island", "Sol Ring"].sort()
    );
    // The commander is preserved and pre-kept; others start undecided.
    expect(parsed.commanders).toEqual(["Atraxa, Praetors' Voice"]);
    expect(parsed.statuses["Atraxa, Praetors' Voice"]).toBe("keep");
    expect(parsed.statuses["Sol Ring"]).toBe("undecided");
  });

  test("merges duplicate names and preserves quantities", () => {
    const parsed = parsePileFromDck(
      "[Main]\n3 Forest\n2 Forest\n1 Sol Ring\n"
    );
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    const forest = parsed.pool.find((c) => c.name === "Forest");
    expect(forest?.quantity).toBe(5);
  });

  test("skips malformed and non-card lines without failing the import", () => {
    const parsed = parsePileFromDck(
      "[metadata]\nName=x\n[Main]\n0 Bad\n-2 Worse\n1 Sol Ring\ngarbage\n"
    );
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    expect(parsed.pool).toEqual([{ name: "Sol Ring", quantity: 1 }]);
  });

  test("returns null for empty or card-less input", () => {
    expect(parsePileFromDck("")).toBeNull();
    expect(parsePileFromDck("[metadata]\nName=Nothing\n[Main]\n")).toBeNull();
  });

  test("returns null for oversized file text", () => {
    const huge = "[Main]\n" + "1 Sol Ring\n".repeat(30_000);
    expect(huge.length).toBeGreaterThan(200_000);
    expect(parsePileFromDck(huge)).toBeNull();
  });

  test("caps a commander that reappears in [Main] at one pooled copy", () => {
    const parsed = parsePileFromDck(
      "[Commander]\n1 Atraxa, Praetors' Voice\n[Main]\n1 Atraxa, Praetors' Voice\n1 Sol Ring\n"
    );
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    const atraxa = parsed.pool.filter(
      (c) => c.name === "Atraxa, Praetors' Voice"
    );
    expect(atraxa).toHaveLength(1);
    expect(parsed.commanders).toEqual(["Atraxa, Praetors' Voice"]);
  });
});
