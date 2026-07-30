import { ROTATIONS } from '../core';
import type { Rotation } from '../core';

/**
 * Fisher–Yates on the injected `rng`, returning a new array (never mutating the input, so the engine stays
 * pure). Without an `rng` the order is kept — deterministic, for tests. Same helper every Game Hub game's
 * setup uses.
 */
export function shuffle<T>(items: readonly T[], rng?: () => number): T[] {
  const out = [...items];
  if (!rng) return out;
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = out[i]!;
    out[i] = out[j]!;
    out[j] = swap;
  }
  return out;
}

/**
 * Draw one of the four orientations. Setup shuffles the tiles **face down** and lays them out (pg. 1 Set
 * Up), so a tile's orientation is as random as its position — the engine models that explicitly rather
 * than leaving every tile facing north. Without an `rng` every tile lands at rotation 0, which is what
 * makes an unseeded setup a readable fixture.
 */
export function randomRotation(rng?: () => number): Rotation {
  if (!rng) return 0;
  return ROTATIONS[Math.floor(rng() * ROTATIONS.length)]!;
}
