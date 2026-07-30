import { expect } from 'vitest';
import { GameError } from '../core';
import type { Board, Insertion, LabyrinthState, Position, Rotation, Tile, TileShape, TreasureName } from '../core';
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

/**
 * The box-drawing glyph for every shape/rotation pair — the same notation the fixed board is documented in
 * (`core/tiles.ts`), where the glyph's own strokes *are* the tile's corridors. `mazeBoard` reads a maze
 * written in it, so a reachability fixture looks like the thing it tests.
 */
const GLYPHS: Readonly<Record<string, { shape: TileShape; rotation: Rotation }>> = {
  '│': { shape: 'straight', rotation: 0 }, // N-S
  '─': { shape: 'straight', rotation: 90 }, // E-W
  '└': { shape: 'corner', rotation: 0 }, // N-E
  '┌': { shape: 'corner', rotation: 90 }, // E-S
  '┐': { shape: 'corner', rotation: 180 }, // S-W
  '┘': { shape: 'corner', rotation: 270 }, // W-N
  '┬': { shape: 'tee', rotation: 0 }, // E-S-W
  '┤': { shape: 'tee', rotation: 90 }, // N-S-W
  '┴': { shape: 'tee', rotation: 180 }, // N-E-W
  '├': { shape: 'tee', rotation: 270 }, // N-E-S
};

/**
 * A hand-built 7×7 maze from 7 rows of 7 glyphs — the fixture behind every reachability test, because a
 * flood-fill over a *seeded* board is untestable by inspection (you would be asserting whatever the code
 * happened to produce). Every tile is treasure-free; `withTreasureAt` adds one where a test needs it.
 *
 * Ignores the fixed-tile layout deliberately: reachability is a property of the tiles standing on the
 * squares, not of which of them may be pushed, so a fixture is free to put anything anywhere.
 */
export function mazeBoard(rows: readonly string[]): Board {
  return rows.map((row, r) =>
    [...row].map((glyph, c): Tile => {
      const spec = GLYPHS[glyph];
      if (spec === undefined) throw new Error(`Unknown maze glyph "${glyph}" at row ${r}, col ${c}`);
      return { id: `t-r${r}c${c}`, shape: spec.shape, rotation: spec.rotation, treasure: null };
    }),
  );
}

/** The same board with `treasure` printed on one square's tile. */
export function withTreasureAt(board: Board, position: Position, treasure: TreasureName): Board {
  return board.map((row, r) =>
    row.map((tile, c) => (r === position.row && c === position.col ? { ...tile, treasure } : tile)),
  );
}

/** The same state on a different maze — a hand-built board dropped under a real game. */
export function withBoard(state: LabyrinthState, board: Board): LabyrinthState {
  return { ...state, board };
}

/** Give a seat a known face-down stack, so a test can control which treasure it is hunting. */
export function withStack(state: LabyrinthState, playerId: string, stack: readonly TreasureName[]): LabyrinthState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? { ...player, stack } : player)),
  };
}

/** Skip the mandatory slide: hand the state to the pawn-moving half of the turn (pg. 2, step 2). */
export function readyToMove(state: LabyrinthState): LabyrinthState {
  return { ...state, phase: 'move' };
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
