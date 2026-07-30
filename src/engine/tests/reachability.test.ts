import { describe, expect, it } from 'vitest';
import { BOARD_SIZE, DIRECTIONS } from '../core';
import type { Board, Position } from '../core';
import { connects, isOnBoard, isReachable, reachableFrom } from '../internal';
import { mazeBoard, seats, seededGame } from './helpers';

const at = (row: number, col: number): Position => ({ row, col });
const key = (position: Position): string => `${position.row},${position.col}`;
const keys = (squares: readonly Position[]): string[] => squares.map(key);

/** Every square of the board, in reading order — the universe a flood-fill draws from. */
const ALL_SQUARES: Position[] = Array.from({ length: BOARD_SIZE }, (_unused, row) =>
  Array.from({ length: BOARD_SIZE }, (_unusedCol, col) => at(row, col)),
).flat();

/**
 * A maze in which every square is reachable from every other: a corridor across the top with a stem
 * hanging off each column. The upper bound the flood-fill must respect (49 squares, no more).
 */
const COMB: Board = mazeBoard(['┌┬┬┬┬┬┐', '│││││││', '│││││││', '│││││││', '│││││││', '│││││││', '│││││││']);

/** A board of east–west corridors: seven disconnected rows, so a flood-fill can only ever see its own. */
const ROWS: Board = mazeBoard(['───────', '───────', '───────', '───────', '───────', '───────', '───────']);

describe('isOnBoard', () => {
  it('accepts every one of the 49 squares', () => {
    for (const square of ALL_SQUARES) expect(isOnBoard(square)).toBe(true);
  });

  it('rejects a square over each of the four edges', () => {
    expect(isOnBoard(at(-1, 3))).toBe(false); // north
    expect(isOnBoard(at(BOARD_SIZE, 3))).toBe(false); // south
    expect(isOnBoard(at(3, -1))).toBe(false); // west
    expect(isOnBoard(at(3, BOARD_SIZE))).toBe(false); // east
  });

  it('rejects coordinates that are not whole numbers — a payload can send anything', () => {
    expect(isOnBoard(at(1.5, 0))).toBe(false);
    expect(isOnBoard(at(0, 1.5))).toBe(false);
    expect(isOnBoard(at(Number.NaN, 0))).toBe(false);
    expect(isOnBoard(at(0, Number.POSITIVE_INFINITY))).toBe(false);
  });
});

describe('connects — both tiles must face each other (pg. 2, "without interruption")', () => {
  it('joins two tiles whose openings meet', () => {
    // ┌ (E,S) beside ┐ (S,W): the first opens east, the second opens west.
    const board = mazeBoard(['┌┐─────', '───────', '───────', '───────', '───────', '───────', '───────']);
    expect(connects(board, at(0, 0), 'east')).toBe(true);
    expect(connects(board, at(0, 1), 'west')).toBe(true);
  });

  it('refuses a corridor that runs into a wall — one open edge is not a path', () => {
    // ─ (E,W) beside │ (N,S): the first opens east, the second has no west edge.
    const board = mazeBoard(['─│─────', '───────', '───────', '───────', '───────', '───────', '───────']);
    expect(connects(board, at(0, 0), 'east')).toBe(false);
    // …and the mirror image: the wall is on the *near* tile instead.
    expect(connects(board, at(0, 1), 'south')).toBe(false);
  });

  it('refuses a step off any edge of the board', () => {
    expect(connects(COMB, at(0, 0), 'north')).toBe(false);
    expect(connects(COMB, at(0, 0), 'west')).toBe(false);
    expect(connects(COMB, at(6, 6), 'south')).toBe(false);
    expect(connects(COMB, at(6, 6), 'east')).toBe(false);
  });

  it('is symmetric: if a leads to b, b leads back to a', () => {
    const board = seededGame(301).board;
    for (const square of ALL_SQUARES) {
      for (const direction of DIRECTIONS) {
        if (!connects(board, square, direction)) continue;
        const step = { north: at(-1, 0), east: at(0, 1), south: at(1, 0), west: at(0, -1) }[direction];
        const back = { north: 'south', east: 'west', south: 'north', west: 'east' } as const;
        expect(connects(board, at(square.row + step.row, square.col + step.col), back[direction])).toBe(true);
      }
    }
  });
});

describe('reachableFrom — the flood-fill (pg. 2, "as far as you like")', () => {
  it('always contains the square the piece is on — staying put is a move, not a skip', () => {
    for (const square of ALL_SQUARES) {
      expect(keys(reachableFrom(ROWS, square))).toContain(key(square));
    }
  });

  it('walks a straight corridor from end to end and stops at the wall', () => {
    // One north–south corridor in column 3; every other square is an east–west straight it cannot enter.
    const board = mazeBoard(['───│───', '───│───', '───│───', '───│───', '───│───', '───│───', '───│───']);
    expect(keys(reachableFrom(board, at(0, 3)))).toEqual(['0,3', '1,3', '2,3', '3,3', '4,3', '5,3', '6,3']);
    // From the middle of the corridor, the same set — connectivity is a property of the maze, not a walk.
    expect(reachableFrom(board, at(4, 3))).toEqual(reachableFrom(board, at(0, 3)));
  });

  it('returns exactly the one square when a tile is sealed off on every side', () => {
    // A lone N-S straight in a board of E-W straights: north is off the board, south faces a wall.
    const board = mazeBoard(['│──────', '───────', '───────', '───────', '───────', '───────', '───────']);
    expect(reachableFrom(board, at(0, 0))).toEqual([at(0, 0)]);
  });

  it('terminates on a loop, and lists each square of it exactly once', () => {
    // A 2×2 ring of corners at rows 0–1, cols 0–1 — a cycle, so a fill without a seen-set never returns.
    const board = mazeBoard(['┌┐─────', '└┘─────', '───────', '───────', '───────', '───────', '───────']);
    const found = reachableFrom(board, at(0, 0));
    expect(keys(found)).toEqual(['0,0', '0,1', '1,0', '1,1']);
    expect(new Set(keys(found)).size).toBe(found.length);
  });

  it('reaches all 49 squares of a fully connected maze, and never more', () => {
    expect(reachableFrom(COMB, at(3, 3))).toHaveLength(BOARD_SIZE * BOARD_SIZE);
    expect(keys(reachableFrom(COMB, at(3, 3)))).toEqual(keys(ALL_SQUARES));
  });

  it('is symmetric and bounded on real seeded boards', () => {
    for (const seed of [401, 402, 403]) {
      const board = seededGame(seed, seats(4)).board;
      for (const square of ALL_SQUARES) {
        const found = reachableFrom(board, square);
        expect(found.length).toBeGreaterThanOrEqual(1);
        expect(found.length).toBeLessThanOrEqual(BOARD_SIZE * BOARD_SIZE);
        // Every square you can get to is a square you can get back from, to the same set.
        for (const other of found) expect(keys(reachableFrom(board, other))).toEqual(keys(found));
      }
    }
  });

  it('lists squares in reading order, whichever square it started from', () => {
    for (const origin of [at(0, 0), at(3, 3), at(6, 6), at(0, 6)]) {
      const found = reachableFrom(COMB, origin);
      const sorted = [...found].sort((a, b) => a.row - b.row || a.col - b.col);
      expect(found).toEqual(sorted);
    }
  });

  it('ignores pieces entirely — it is a function of the board alone', () => {
    // Not an assertion about a fixture: `reachableFrom` takes no players, so occupancy cannot affect it
    // (the rulebook has no occupancy rule — ROADMAP digest). `move.test.ts` proves it end to end.
    const game = seededGame(411, seats(4));
    expect(reachableFrom(game.board, at(0, 0))).toEqual(reachableFrom(game.board, at(0, 0)));
  });
});

describe('isReachable', () => {
  it('answers for a square in the set and against one outside it', () => {
    const board = mazeBoard(['───│───', '───│───', '───│───', '───│───', '───│───', '───│───', '───│───']);
    expect(isReachable(board, at(0, 3), at(6, 3))).toBe(true);
    expect(isReachable(board, at(0, 3), at(0, 3))).toBe(true);
    expect(isReachable(board, at(0, 3), at(0, 0))).toBe(false);
  });

  it('says no to a square that is not on the board at all', () => {
    expect(isReachable(COMB, at(0, 0), at(-1, 0))).toBe(false);
    expect(isReachable(COMB, at(0, 0), at(7, 7))).toBe(false);
  });

  it('agrees with `reachableFrom` on every square of a seeded board', () => {
    const board = seededGame(421, seats(3)).board;
    const origin = at(2, 5);
    const found = new Set(keys(reachableFrom(board, origin)));
    for (const square of ALL_SQUARES) {
      expect(isReachable(board, origin, square)).toBe(found.has(key(square)));
    }
  });
});
