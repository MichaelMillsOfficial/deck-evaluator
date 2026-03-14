// ---------------------------------------------------------------------------
// Seeded PRNG — xorshift128
// ---------------------------------------------------------------------------

/**
 * Create a seeded pseudo-random number generator using xorshift128.
 * Returns a function that produces values in [0, 1) deterministically.
 */
export function createPRNG(seed: number): () => number {
  // Initialize state from seed using splitmix32
  let s0 = seed >>> 0;
  let s1 = (seed + 0x9e3779b9) >>> 0;
  let s2 = (seed + 0x9e3779b9 * 2) >>> 0;
  let s3 = (seed + 0x9e3779b9 * 3) >>> 0;

  // Warm up the state
  for (let i = 0; i < 20; i++) {
    const t = s1 << 11;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = (s3 << 19) | (s3 >>> 13);
  }

  return () => {
    const t = s1 << 11;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = (s3 << 19) | (s3 >>> 13);
    return (s0 >>> 0) / 4294967296;
  };
}

/**
 * Generate a random seed from Math.random().
 */
export function randomSeed(): number {
  return (Math.random() * 4294967296) >>> 0;
}
