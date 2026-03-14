import { test, expect } from "@playwright/test";
import { createPRNG, randomSeed } from "../../src/lib/prng";

test.describe("createPRNG", () => {
  test("same seed produces identical sequence", () => {
    const rng1 = createPRNG(42);
    const rng2 = createPRNG(42);

    const seq1 = Array.from({ length: 100 }, () => rng1());
    const seq2 = Array.from({ length: 100 }, () => rng2());

    expect(seq1).toEqual(seq2);
  });

  test("different seeds produce different sequences", () => {
    const rng1 = createPRNG(42);
    const rng2 = createPRNG(99);

    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());

    // Very unlikely to be equal
    expect(seq1).not.toEqual(seq2);
  });

  test("output is in [0, 1) range", () => {
    const rng = createPRNG(12345);
    for (let i = 0; i < 10000; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  test("produces reasonable distribution (not stuck at one value)", () => {
    const rng = createPRNG(77);
    const values = Array.from({ length: 1000 }, () => rng());
    const min = Math.min(...values);
    const max = Math.max(...values);
    // Should span a wide range
    expect(max - min).toBeGreaterThan(0.8);
  });
});

test.describe("randomSeed", () => {
  test("produces different values on each call", () => {
    const seeds = new Set<number>();
    for (let i = 0; i < 100; i++) {
      seeds.add(randomSeed());
    }
    // Should have many unique values (allowing some collisions)
    expect(seeds.size).toBeGreaterThan(90);
  });

  test("returns a non-negative integer", () => {
    for (let i = 0; i < 100; i++) {
      const seed = randomSeed();
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(seed)).toBe(true);
    }
  });
});
