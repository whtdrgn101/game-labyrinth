import { expect } from 'vitest';
import { GameError } from '../core';
import type { Board, Insertion, LabyrinthState, Position } from '../core';
import { createGame } from '../createGame';
import { linePath, tileAt } from '../internal';

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

/**
 * Put a seat's pawn on a square, so a wraparound case can be set up without playing there first. Returns a
 * new state — the fixture builder is as immutable as the engine it exercises.
 */
export function withPawnAt(state: LabyrinthState, playerId: string, position: Position): LabyrinthState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? { ...player, position } : player)),
  };
}

/** The tile ids along an insertion's line, entry end first — the thing a slide is supposed to shift. */
export function lineTileIds(board: Board, insertion: Insertion): string[] {
  return linePath(insertion).map((square) => tileAt(board, square).id);
}

/**
 * Freeze `value` and everything reachable from it. The hub's engines assert purity by structural compare
 * against a `structuredClone` snapshot; this repo does that **and** freezes, because Labyrinth's state is
 * the first with a deeply nested mutable-looking structure (a 7×7 array of arrays) where the obvious bug —
 * shifting a line in place — is a write into a shared row. A compare catches it after the fact; a freeze
 * throws at the offending line, in strict mode, which is where the stack trace is useful.
 */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
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
