import { test, expect } from "@playwright/test";
import {
  deserializePayload,
  buildCompactPayloadV3,
  serializePayloadV3,
} from "../../src/lib/deck-codec";
import { makeDeck, makeCard } from "../helpers";
import type { EnrichedCard } from "../../src/lib/types";
import type { ShareAnalysisSummary } from "../../src/lib/share-analysis-summary";

const testSummary: ShareAnalysisSummary = {
  pl: 6.5,
  br: 3,
  avg: 3.2,
  kr: 72,
  themes: ["Ramp", "Card Draw", "Combo"],
  combos: 2,
  budget: 4250,
};

test.describe("buildCompactPayloadV3", () => {
  test("produces v3 payload with analysis summary", () => {
    const deck = makeDeck({
      name: "Test Deck",
      commanders: [{ name: "Sol Ring", quantity: 1 }],
      mainboard: [{ name: "Command Tower", quantity: 1 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Sol Ring": makeCard({ name: "Sol Ring", setCode: "cmm", collectorNumber: "123" }),
      "Command Tower": makeCard({ name: "Command Tower", setCode: "cmm", collectorNumber: "789" }),
    };

    const payload = buildCompactPayloadV3(deck, cardMap, testSummary);

    expect(payload.v).toBe(3);
    expect(payload.n).toBe("Test Deck");
    expect(payload.a).toEqual(testSummary);
    expect(payload.c).toEqual([["cmm", "123", 1]]);
    expect(payload.m).toEqual([["cmm", "789", 1]]);
  });

  test("omits a field when summary is not provided", () => {
    const deck = makeDeck({
      name: "No Summary Deck",
      mainboard: [{ name: "Sol Ring", quantity: 1 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Sol Ring": makeCard({ name: "Sol Ring", setCode: "cmm", collectorNumber: "123" }),
    };

    const payload = buildCompactPayloadV3(deck, cardMap);

    expect(payload.v).toBe(3);
    expect(payload.a).toBeUndefined();
  });

  test("v3 payload without summary is structurally compatible with v2 (same card fields)", () => {
    const deck = makeDeck({
      name: "Compat Test",
      commanders: [{ name: "Sol Ring", quantity: 1 }],
      mainboard: [{ name: "Command Tower", quantity: 1 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Sol Ring": makeCard({ name: "Sol Ring", setCode: "cmm", collectorNumber: "123" }),
      "Command Tower": makeCard({ name: "Command Tower", setCode: "cmm", collectorNumber: "789" }),
    };

    const payload = buildCompactPayloadV3(deck, cardMap);
    expect(payload.v).toBe(3);
    expect(payload.c).toEqual([["cmm", "123", 1]]);
    expect(payload.m).toEqual([["cmm", "789", 1]]);
  });
});

test.describe("serializePayloadV3", () => {
  test("produces valid JSON string", () => {
    const deck = makeDeck({
      name: "Test Deck",
      mainboard: [{ name: "Sol Ring", quantity: 1 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Sol Ring": makeCard({ name: "Sol Ring", setCode: "cmm", collectorNumber: "123" }),
    };

    const payload = buildCompactPayloadV3(deck, cardMap, testSummary);
    const json = serializePayloadV3(payload);
    const parsed = JSON.parse(json);

    expect(parsed.v).toBe(3);
    expect(parsed.a).toEqual(testSummary);
  });
});

test.describe("deserializePayload v3 detection", () => {
  test("v3 payload returns version 3 shape with analysis summary", () => {
    const input = JSON.stringify({
      v: 3,
      n: "Test Deck",
      c: [["cmm", "456", 1]],
      m: [["cmm", "123", 1]],
      a: testSummary,
    });
    const result = deserializePayload(input);

    expect(result.version).toBe(3);
    if (result.version === 3) {
      expect(result.name).toBe("Test Deck");
      expect(result.commanders).toEqual([["cmm", "456", 1]]);
      expect(result.mainboard).toEqual([["cmm", "123", 1]]);
      expect(result.summary).toEqual(testSummary);
    }
  });

  test("v3 payload without summary returns version 3 with undefined summary", () => {
    const input = JSON.stringify({
      v: 3,
      n: "Test Deck",
      c: [],
      m: [["cmm", "123", 1]],
    });
    const result = deserializePayload(input);

    expect(result.version).toBe(3);
    if (result.version === 3) {
      expect(result.summary).toBeUndefined();
    }
  });

  test("v3 payload with sideboard includes it", () => {
    const input = JSON.stringify({
      v: 3,
      n: "Test Deck",
      c: [],
      m: [["cmm", "123", 1]],
      s: [["akh", "26", 1]],
      a: testSummary,
    });
    const result = deserializePayload(input);

    expect(result.version).toBe(3);
    if (result.version === 3) {
      expect(result.sideboard).toEqual([["akh", "26", 1]]);
    }
  });

  test("v1 payload still returns version 1 (backward compat)", () => {
    const input = JSON.stringify({ t: "1 Sol Ring", c: ["Atraxa"] });
    const result = deserializePayload(input);
    expect(result.version).toBe(1);
  });

  test("v2 payload still returns version 2 (backward compat)", () => {
    const input = JSON.stringify({
      v: 2,
      n: "Test Deck",
      c: [["cmm", "456", 1]],
      m: [["cmm", "123", 1]],
    });
    const result = deserializePayload(input);
    expect(result.version).toBe(2);
  });
});

test.describe("v3 payload compactness", () => {
  test("v3 JSON with summary is under 500 bytes for a minimal deck", () => {
    const deck = makeDeck({
      name: "Small Deck",
      commanders: [{ name: "Sol Ring", quantity: 1 }],
      mainboard: [{ name: "Command Tower", quantity: 1 }],
    });
    const cardMap: Record<string, EnrichedCard> = {
      "Sol Ring": makeCard({ name: "Sol Ring", setCode: "cmm", collectorNumber: "123" }),
      "Command Tower": makeCard({ name: "Command Tower", setCode: "cmm", collectorNumber: "789" }),
    };

    const payload = buildCompactPayloadV3(deck, cardMap, testSummary);
    const json = serializePayloadV3(payload);

    expect(json.length).toBeLessThan(500);
  });

  test("summary object alone is under 200 bytes JSON", () => {
    const json = JSON.stringify(testSummary);
    expect(json.length).toBeLessThan(200);
  });
});
