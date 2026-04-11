export const DEFAULT_FACTORY_SEED = 0;

export function normalizeFactorySeed(seed: number | undefined) {
  if (seed === undefined) {
    return DEFAULT_FACTORY_SEED;
  }

  if (!Number.isInteger(seed) || !Number.isFinite(seed)) {
    throw new Error(`Expected "seed" to be a finite integer, received ${String(seed)}.`);
  }

  return seed;
}
