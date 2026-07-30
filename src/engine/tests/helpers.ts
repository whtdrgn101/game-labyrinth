import { expect } from 'vitest';
import { GameError } from '../core';
import type { LabyrinthState } from '../core';
import { createGame } from '../createGame';

/**
 * mulberry32 — a small deterministic PRNG, so a seeded setup is reproducible tile-for-tile and card-for-card
 * (the convention the hub's game packages use in their engine tests).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh game with the given seat names (two by default). Unseeded ⇒ deterministic setup. */
export function newGame(names: string[] = ['Ann', 'Bob']): LabyrinthState {
  return createGame({ id: 'g1', players: names.map((name) => ({ name })) });
}

/** A fresh game whose whole setup (tile order, orientations, deal) comes from `seed`. */
export function seededGame(seed: number, names: string[] = ['Ann', 'Bob']): LabyrinthState {
  return createGame({ id: 'g1', players: names.map((name) => ({ name })), rng: mulberry32(seed) });
}

/** `count` seats named P0…Pn. */
export function seats(count: number): string[] {
  return Array.from({ length: count }, (_unused, i) => `P${i}`);
}

/** Assert that `fn` throws a GameError with the given code. */
export function expectError(fn: () => unknown, code: string): void {
  expect(fn).toThrow(GameError);
  try {
    fn();
  } catch (error) {
    expect((error as GameError).code).toBe(code);
  }
}
