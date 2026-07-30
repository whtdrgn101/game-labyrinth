import { describe, expect, it } from 'vitest';
import { ROTATIONS } from '../core';
import { randomRotation, shuffle } from '../internal';
import { mulberry32 } from './helpers';

describe('shuffle', () => {
  it('keeps the order when no rng is injected (a deterministic fixture)', () => {
    expect(shuffle([1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5]);
  });

  it('permutes with an rng, keeping the same multiset', () => {
    const input = Array.from({ length: 34 }, (_unused, i) => i);
    const out = shuffle(input, mulberry32(7));
    expect(out).not.toEqual(input);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it('never mutates its input (the engine is pure)', () => {
    const input = [1, 2, 3, 4, 5];
    shuffle(input, mulberry32(1));
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it('is reproducible for a given seed', () => {
    const input = Array.from({ length: 20 }, (_unused, i) => i);
    expect(shuffle(input, mulberry32(42))).toEqual(shuffle(input, mulberry32(42)));
  });
});

describe('randomRotation', () => {
  it('is 0 without an rng', () => {
    expect(randomRotation()).toBe(0);
  });

  it('draws one of the four orientations', () => {
    const rng = mulberry32(3);
    const drawn = new Set(Array.from({ length: 200 }, () => randomRotation(rng)));
    for (const rotation of drawn) expect(ROTATIONS).toContain(rotation);
    // 200 draws over four outcomes: all four must show up.
    expect(drawn.size).toBe(4);
  });

  it('maps the rng range onto the four quarters', () => {
    expect(randomRotation(() => 0)).toBe(0);
    expect(randomRotation(() => 0.3)).toBe(90);
    expect(randomRotation(() => 0.6)).toBe(180);
    expect(randomRotation(() => 0.99)).toBe(270);
  });
});
