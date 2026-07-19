import { test, expect } from "@playwright/test";
import { commanderSlug, pairSlug, buildEdhrecUrl } from "../../src/lib/commander-validation";
import { mergeInclusionMaps, normalizeCardName } from "../../src/lib/edhrec-meta";

test.describe("commanderSlug", () => {
  test("produces the EDHREC commander-slug form", () => {
    expect(commanderSlug("Atraxa, Praetors' Voice")).toBe("atraxa-praetors-voice");
    expect(commanderSlug("Thrasios, Triton Hero")).toBe("thrasios-triton-hero");
  });
});

test.describe("pairSlug", () => {
  test("joins two commanders in a stable (sorted) order", () => {
    const a = pairSlug(["Tymna the Weaver", "Thrasios, Triton Hero"]);
    const b = pairSlug(["Thrasios, Triton Hero", "Tymna the Weaver"]);
    expect(a).toBe(b); // order-independent
    expect(a).toBe("thrasios-triton-hero-tymna-the-weaver");
  });
});

test.describe("buildEdhrecUrl still works via the extracted slugifier", () => {
  test("single and paired commanders", () => {
    expect(buildEdhrecUrl(["Atraxa, Praetors' Voice"])).toBe(
      "https://edhrec.com/commanders/atraxa-praetors-voice"
    );
  });
});

test.describe("mergeInclusionMaps", () => {
  test("unions keys and takes the max rate across maps", () => {
    const a = { [normalizeCardName("Sol Ring")]: 0.9, [normalizeCardName("Rhystic Study")]: 0.4 };
    const b = { [normalizeCardName("Sol Ring")]: 0.8, [normalizeCardName("Mystic Remora")]: 0.6 };
    const merged = mergeInclusionMaps([a, b]);
    expect(merged[normalizeCardName("Sol Ring")]).toBe(0.9); // max(0.9, 0.8)
    expect(merged[normalizeCardName("Rhystic Study")]).toBe(0.4);
    expect(merged[normalizeCardName("Mystic Remora")]).toBe(0.6);
  });
});
