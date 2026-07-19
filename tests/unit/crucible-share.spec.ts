import { test, expect } from "@playwright/test";
import {
  encodeCruciblePile,
  decodeCruciblePile,
  serializePileToDck,
} from "../../src/lib/crucible-share";
import type { CruciblePayload } from "../../src/lib/crucible-session";

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
