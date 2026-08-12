/** Returns a float in [0, 1). Injected so simulation systems stay testable. */
export type RandomSource = () => number;

/**
 * Small deterministic PRNG (mulberry32). Used by tests and available for
 * reproducible recoil patterns.
 */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
