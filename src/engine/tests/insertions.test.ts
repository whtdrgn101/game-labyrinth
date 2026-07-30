import { describe, expect, it } from 'vitest';
import { BOARD_SIZE, DIRECTIONS, SLIDE_LINES } from '../core';
import type { Insertion, LabyrinthState, SlideLine } from '../core';
import {
  INSERTIONS,
  entrySquare,
  exitSquare,
  isFixedPosition,
  isInsertionPoint,
  isLegalInsertion,
  legalInsertions,
  linePath,
  opposite,
  reverseOf,
  sameInsertion,
} from '../internal';
import { newGame } from './helpers';

/** The state as it is after `lastPush`, without playing a turn to get there. */
const after = (lastPush: Insertion | null): LabyrinthState => ({ ...newGame(), lastPush });

const label = (insertion: Insertion) => `${insertion.side}/${insertion.line}`;

describe('INSERTIONS — the 12 arrows (pg. 2)', () => {
  it('is the 4 sides × the 3 movable lines, each exactly once', () => {
    expect(INSERTIONS).toHaveLength(DIRECTIONS.length * SLIDE_LINES.length);
    expect(INSERTIONS).toHaveLength(12);
    expect(new Set(INSERTIONS.map(label)).size).toBe(12);
    for (const side of DIRECTIONS) {
      for (const line of SLIDE_LINES) {
        expect(INSERTIONS.some((arrow) => arrow.side === side && arrow.line === line)).toBe(true);
      }
    }
  });

  it('marks only odd lines — every even line holds fixed tiles', () => {
    for (const arrow of INSERTIONS) expect(arrow.line % 2).toBe(1);
  });

  it('keeps a stable order (the UI lays arrows out in it; a seeded bot replays in it)', () => {
    expect(INSERTIONS.map(label)).toEqual([
      'north/1',
      'north/3',
      'north/5',
      'east/1',
      'east/3',
      'east/5',
      'south/1',
      'south/3',
      'south/5',
      'west/1',
      'west/3',
      'west/5',
    ]);
  });
});

describe('sameInsertion / isInsertionPoint', () => {
  it('compares arrows by value', () => {
    expect(sameInsertion({ side: 'north', line: 1 }, { side: 'north', line: 1 })).toBe(true);
    expect(sameInsertion({ side: 'north', line: 1 }, { side: 'south', line: 1 })).toBe(false);
    expect(sameInsertion({ side: 'north', line: 1 }, { side: 'north', line: 3 })).toBe(false);
  });

  it('accepts all 12 arrows and nothing else', () => {
    for (const arrow of INSERTIONS) expect(isInsertionPoint(arrow)).toBe(true);
    // An even line is a fixed row/column — there is no arrow there (nor off the board entirely).
    expect(isInsertionPoint({ side: 'north', line: 2 as SlideLine })).toBe(false);
    expect(isInsertionPoint({ side: 'north', line: 0 as SlideLine })).toBe(false);
    expect(isInsertionPoint({ side: 'north', line: 7 as SlideLine })).toBe(false);
  });
});

describe('entrySquare / exitSquare / linePath', () => {
  // Spelled out rather than derived: this table is what "the arrow points into the board" means, and it
  // is the thing a sign error in the slide would break. `line` is a *column* for north/south, a *row* for
  // east/west (the arrow's line runs perpendicular to its own edge).
  const table: ReadonlyArray<[Insertion, { row: number; col: number }, { row: number; col: number }]> = [
    [
      { side: 'north', line: 1 },
      { row: 0, col: 1 },
      { row: 6, col: 1 },
    ],
    [
      { side: 'north', line: 5 },
      { row: 0, col: 5 },
      { row: 6, col: 5 },
    ],
    [
      { side: 'south', line: 3 },
      { row: 6, col: 3 },
      { row: 0, col: 3 },
    ],
    [
      { side: 'west', line: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 6 },
    ],
    [
      { side: 'east', line: 5 },
      { row: 5, col: 6 },
      { row: 5, col: 0 },
    ],
  ];

  for (const [insertion, entry, exit] of table) {
    it(`${label(insertion)} enters at (${entry.row},${entry.col}) and ejects (${exit.row},${exit.col})`, () => {
      expect(entrySquare(insertion)).toEqual(entry);
      expect(exitSquare(insertion)).toEqual(exit);
    });
  }

  it('walks 7 squares from entry to exit, in the direction the maze travels', () => {
    for (const insertion of INSERTIONS) {
      const path = linePath(insertion);
      expect(path).toHaveLength(BOARD_SIZE);
      expect(path[0]).toEqual(entrySquare(insertion));
      expect(path[BOARD_SIZE - 1]).toEqual(exitSquare(insertion));
      // Insert at the north arrow and the column moves *south*.
      const travel = opposite(insertion.side);
      const varying = travel === 'north' || travel === 'south' ? 'row' : 'col';
      const delta = travel === 'south' || travel === 'east' ? 1 : -1;
      for (let i = 1; i < BOARD_SIZE; i += 1) {
        expect(path[i]![varying] - path[i - 1]![varying]).toBe(delta);
      }
    }
  });

  it('stays on the board and never crosses a fixed square', () => {
    for (const insertion of INSERTIONS) {
      for (const square of linePath(insertion)) {
        expect(square.row).toBeGreaterThanOrEqual(0);
        expect(square.row).toBeLessThan(BOARD_SIZE);
        expect(square.col).toBeGreaterThanOrEqual(0);
        expect(square.col).toBeLessThan(BOARD_SIZE);
        // The 16 printed tiles sit at even/even; an odd line can never touch one (pg. 1/pg. 2).
        expect(isFixedPosition(square)).toBe(false);
      }
    }
  });

  it('makes an arrow and its reverse the same line walked backwards', () => {
    for (const insertion of INSERTIONS) {
      const back = reverseOf(insertion)!;
      expect(linePath(back)).toEqual([...linePath(insertion)].reverse());
      expect(entrySquare(back)).toEqual(exitSquare(insertion));
    }
  });
});

describe('reverseOf — pg. 2, "The only exception"', () => {
  it('is the same line from the opposite side', () => {
    expect(reverseOf({ side: 'north', line: 1 })).toEqual({ side: 'south', line: 1 });
    expect(reverseOf({ side: 'west', line: 5 })).toEqual({ side: 'east', line: 5 });
  });

  it('is nothing at all before the first push', () => {
    expect(reverseOf(null)).toBeNull();
  });

  it('is its own inverse, and is always itself one of the 12 arrows', () => {
    for (const insertion of INSERTIONS) {
      const back = reverseOf(insertion)!;
      expect(isInsertionPoint(back)).toBe(true);
      expect(reverseOf(back)).toEqual(insertion);
      expect(sameInsertion(back, insertion)).toBe(false);
    }
  });
});

describe('legalInsertions', () => {
  it('offers all 12 arrows on the first turn, when nothing has been pushed out', () => {
    const game = newGame();
    expect(game.lastPush).toBeNull();
    expect(legalInsertions(game)).toEqual(INSERTIONS);
    for (const arrow of INSERTIONS) expect(isLegalInsertion(game, arrow)).toBe(true);
  });

  it('drops exactly the one arrow that would undo the last push, whichever it was', () => {
    for (const lastPush of INSERTIONS) {
      const state = after(lastPush);
      const legal = legalInsertions(state);
      expect(legal).toHaveLength(11);

      const banned = reverseOf(lastPush)!;
      expect(legal.some((arrow) => sameInsertion(arrow, banned))).toBe(false);
      expect(isLegalInsertion(state, banned)).toBe(false);
      // Pushing the *same* arrow again is fine — only the reverse is forbidden.
      expect(isLegalInsertion(state, lastPush)).toBe(true);
      // …and so is every other arrow, including the two other arrows on the same line's own sides.
      for (const arrow of INSERTIONS) {
        expect(isLegalInsertion(state, arrow)).toBe(!sameInsertion(arrow, banned));
      }
      // Order is preserved, so the UI's arrow list only ever loses an entry.
      expect(legal).toEqual(INSERTIONS.filter((arrow) => !sameInsertion(arrow, banned)));
    }
  });

  it('frees the banned arrow again as soon as a different push happens', () => {
    const banned: Insertion = { side: 'south', line: 1 };
    expect(isLegalInsertion(after({ side: 'north', line: 1 }), banned)).toBe(false);
    // A push on another line lifts the ban…
    expect(isLegalInsertion(after({ side: 'north', line: 3 }), banned)).toBe(true);
    // …and so does the *same* line pushed from the other side, which bans its own reverse instead.
    expect(isLegalInsertion(after({ side: 'south', line: 1 }), banned)).toBe(true);
    expect(isLegalInsertion(after({ side: 'south', line: 1 }), { side: 'north', line: 1 })).toBe(false);
  });

  it('rejects something that is not an arrow at all, pushed or not', () => {
    const bogus: Insertion = { side: 'north', line: 2 as SlideLine };
    expect(isLegalInsertion(newGame(), bogus)).toBe(false);
    expect(isLegalInsertion(after({ side: 'east', line: 3 }), bogus)).toBe(false);
  });
});
