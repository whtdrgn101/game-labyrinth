import { describe, expect, it } from 'vitest';
import { BOARD_SIZE, FIXED_TILES, ROTATIONS } from '../core';
import type { Insertion, LabyrinthState, Position, Rotation, SlideLine } from '../core';
import { insert } from '../actions';
import { INSERTIONS, entrySquare, exitSquare, linePath, tileAt } from '../internal';
import { deepFreeze, expectError, lineTileIds, newGame, seats, seededGame, withPawnAt } from './helpers';

/** Hand the turn back to the same seat for another slide. L2's pawn move is what really does this. */
const readyToInsert = (state: LabyrinthState): LabyrinthState => ({ ...state, phase: 'insert' });

const label = (insertion: Insertion) => `${insertion.side}/${insertion.line}`;

/** Every square *not* on the pushed line — the part of the board a slide must leave completely alone. */
function offLine(insertion: Insertion): Position[] {
  const onLine = new Set(linePath(insertion).map((square) => `${square.row},${square.col}`));
  const squares: Position[] = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (!onLine.has(`${row},${col}`)) squares.push({ row, col });
    }
  }
  return squares;
}

describe('insert — the shift (pg. 2, "1. Moving the Maze")', () => {
  // The exhaustive sweep: all 12 arrows × all 4 facings of the extra tile. A sign error in any one of
  // rows-vs-columns, entry-vs-exit or the walk direction shows up here and nowhere else.
  for (const insertion of INSERTIONS) {
    for (const rotation of ROTATIONS) {
      it(`${label(insertion)} at ${rotation}° shifts the line by one and ejects the far tile`, () => {
        const before = seededGame(insertion.line * 7 + ROTATIONS.indexOf(rotation), seats(4));
        const incomingId = before.extraTile.id;
        const wasOnLine = lineTileIds(before.board, insertion);

        const after = insert(before, 'p1', insertion, rotation);

        // "insert the extra path tile ... until another path tile is pushed out of the maze on the
        // opposite side": the line's contents move up one place, in order, and the last one falls off.
        expect(lineTileIds(after.board, insertion)).toEqual([incomingId, ...wasOnLine.slice(0, BOARD_SIZE - 1)]);

        // The tile that fell off is the new extra tile, still facing exactly as it did on the board.
        const ejectedBefore = tileAt(before.board, exitSquare(insertion));
        expect(ejectedBefore.id).toBe(wasOnLine[BOARD_SIZE - 1]);
        expect(after.extraTile).toEqual(ejectedBefore);
        expect(after.extraTile.rotation).toBe(ejectedBefore.rotation);

        // The tile that went in is the old extra tile, turned the way the player chose — and nothing else
        // about it changed (same identity, same shape, same treasure).
        const placed = tileAt(after.board, entrySquare(insertion));
        expect(placed).toEqual({ ...before.extraTile, rotation });

        // Every tile that was on the line is still on the board exactly once, except the ejected one.
        const survivors = wasOnLine.slice(0, BOARD_SIZE - 1);
        expect(lineTileIds(after.board, insertion).slice(1)).toEqual(survivors);
      });
    }
  }

  it('leaves every square off the pushed line untouched', () => {
    for (const insertion of INSERTIONS) {
      const before = seededGame(21, seats(3));
      const after = insert(before, 'p1', insertion, 90);
      for (const square of offLine(insertion)) {
        expect(tileAt(after.board, square)).toEqual(tileAt(before.board, square));
      }
    }
  });

  it('never moves a fixed tile — the 16 printed tiles stay on their own squares', () => {
    let game = seededGame(31, seats(4));
    for (const insertion of INSERTIONS) {
      game = readyToInsert(insert(readyToInsert(game), 'p1', insertion, 180));
      for (const spec of FIXED_TILES) {
        const tile = tileAt(game.board, spec.position);
        expect(tile.id).toBe(`fixed-r${spec.position.row}c${spec.position.col}`);
        expect(tile.shape).toBe(spec.shape);
        expect(tile.rotation).toBe(spec.rotation);
        expect(tile.treasure).toBe(spec.treasure);
      }
      // No fixed tile ever ends up in hand, either.
      expect(game.extraTile.id.startsWith('fixed-')).toBe(false);
    }
  });

  it('conserves the 34 loose tiles — 33 on the board, 1 in hand, no duplicates', () => {
    let game = seededGame(41);
    const census = (state: LabyrinthState) =>
      [...state.board.flatMap((row) => row.map((tile) => tile.id)), state.extraTile.id].sort();
    const opening = census(game);
    for (const insertion of INSERTIONS) {
      game = readyToInsert(insert(readyToInsert(game), 'p1', insertion, 0));
      expect(census(game)).toEqual(opening);
    }
  });

  it('is reversed exactly by pushing the same line back from the other side', () => {
    // The rules forbid doing this on the very next turn, but the geometry must still be an inverse — it
    // is the cleanest proof the walk is symmetric.
    const before = seededGame(51, seats(2));
    const there: Insertion = { side: 'west', line: 3 };
    const back: Insertion = { side: 'east', line: 3 };
    // Each tile goes in facing exactly as it came out, so the round trip is total, not just positional.
    // `lastPush` is cleared by hand because the rules would forbid the reverse on the very next turn —
    // this is a geometry fixture, and the rule itself has its own tests.
    const middle = readyToInsert(insert(before, 'p1', there, before.extraTile.rotation));
    const after = insert({ ...middle, lastPush: null }, 'p1', back, middle.extraTile.rotation);

    expect(lineTileIds(after.board, there)).toEqual(lineTileIds(before.board, there));
    expect(after.extraTile).toEqual(before.extraTile);
  });
});

describe('insert — pawns travel with their tiles, and wrap round the edge (pg. 2)', () => {
  // "If the path tile you push out has a playing piece on it, put this piece on the opposite side of the
  // board on the path tile that was just placed." Both ends of both axes, so no case is a special case.
  const wraps: ReadonlyArray<[Insertion, Position, Position]> = [
    // A column pushed south ejects at the bottom; the pawn reappears at the top.
    [
      { side: 'north', line: 1 },
      { row: 6, col: 1 },
      { row: 0, col: 1 },
    ],
    // …and pushed north, ejects at the top and reappears at the bottom.
    [
      { side: 'south', line: 5 },
      { row: 0, col: 5 },
      { row: 6, col: 5 },
    ],
    // A row pushed east ejects at the right edge; the pawn reappears at the left.
    [
      { side: 'west', line: 3 },
      { row: 3, col: 6 },
      { row: 3, col: 0 },
    ],
    // …and pushed west, ejects at the left and reappears at the right.
    [
      { side: 'east', line: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 6 },
    ],
  ];

  for (const [insertion, ejectedSquare, wrapsTo] of wraps) {
    it(`${label(insertion)} carries a pawn from (${ejectedSquare.row},${ejectedSquare.col}) round to (${wrapsTo.row},${wrapsTo.col})`, () => {
      const before = withPawnAt(seededGame(61, seats(2)), 'p2', ejectedSquare);
      const after = insert(before, 'p1', insertion, 0);

      expect(after.players[1]!.position).toEqual(wrapsTo);
      // It lands on the tile that was *just placed*, not merely on that square.
      expect(tileAt(after.board, wrapsTo).id).toBe(before.extraTile.id);
      // The wrap is free: it is not a move, so nothing about the turn changes because of it.
      expect(after.phase).toBe('move');
      expect(after.turn).toBe(before.turn);
      expect(after.activePlayerIndex).toBe(before.activePlayerIndex);
      expect(after.log).toHaveLength(1);
      expect(after.log[0]!.payload!.wrapped).toEqual(['p2']);
    });
  }

  it('wraps every pawn sharing the ejected tile — pawns do not block each other', () => {
    const ejectedSquare = { row: 6, col: 3 };
    let before = seededGame(71, seats(4));
    for (const id of ['p1', 'p2', 'p3', 'p4']) before = withPawnAt(before, id, ejectedSquare);

    const after = insert(before, 'p1', { side: 'north', line: 3 }, 270);

    for (const player of after.players) expect(player.position).toEqual({ row: 0, col: 3 });
    expect(after.log[0]!.payload!.wrapped).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('shoves a pawn one square along when its tile merely slides', () => {
    // Not the wrap case: this pawn's tile stays on the board, so the pawn goes with it.
    const before = withPawnAt(seededGame(81, seats(2)), 'p2', { row: 2, col: 5 });
    const after = insert(before, 'p1', { side: 'north', line: 5 }, 0);

    expect(after.players[1]!.position).toEqual({ row: 3, col: 5 });
    expect(tileAt(after.board, { row: 3, col: 5 }).id).toBe(tileAt(before.board, { row: 2, col: 5 }).id);
    // Nobody was pushed off the board, so nobody wrapped.
    expect(after.log[0]!.payload!.wrapped).toEqual([]);
  });

  it('leaves every pawn off the pushed line exactly where it was', () => {
    const before = seededGame(91, seats(4));
    // The four pawns open on the four corners — all at even/even, so no arrow's line touches them.
    const after = insert(before, 'p1', { side: 'west', line: 3 }, 90);
    expect(after.players.map((player) => player.position)).toEqual(before.players.map((player) => player.position));
    expect(after.log[0]!.payload!.wrapped).toEqual([]);
  });

  it('carries a pawn round the board with repeated pushes on its own line', () => {
    // Seven pushes on one line return every pawn on it to where it started — the walk is a rotation.
    const home = { row: 1, col: 4 };
    const before = withPawnAt(seededGame(101, seats(2)), 'p2', home);
    let game: LabyrinthState = before;
    for (let i = 0; i < BOARD_SIZE; i += 1) {
      game = readyToInsert(insert({ ...game, lastPush: null }, 'p1', { side: 'west', line: 1 }, 0));
    }
    expect(game.players[1]!.position).toEqual(home);
  });
});

describe('insert — turn bookkeeping and the log', () => {
  it('records the push, hands the turn on to the pawn, and remembers where the tile came out', () => {
    const before = seededGame(111, seats(3));
    const insertion: Insertion = { side: 'east', line: 5 };
    const ejected = tileAt(before.board, exitSquare(insertion));
    const incomingId = before.extraTile.id;

    const after = insert(before, 'p1', insertion, 180);

    expect(after.phase).toBe('move');
    expect(after.lastPush).toEqual(insertion);
    expect(after.version).toBe(before.version + 1);
    expect(after.log).toEqual([
      {
        seq: 1,
        type: 'INSERT',
        playerId: 'p1',
        payload: {
          side: 'east',
          line: 5,
          rotation: 180,
          tileId: incomingId,
          ejectedTileId: ejected.id,
          wrapped: [],
        },
      },
    ]);
  });

  it('logs nothing secret — no payload key carries a treasure or a stack', () => {
    const game = insert(seededGame(121, seats(4)), 'p1', { side: 'north', line: 3 }, 0);
    const wire = JSON.stringify(game.log);
    for (const player of game.players) {
      for (const treasure of player.stack) expect(wire).not.toContain(treasure);
    }
  });

  it('appends one entry per push and keeps the log in sequence', () => {
    let game: LabyrinthState = seededGame(131);
    for (const insertion of [
      { side: 'north', line: 1 },
      { side: 'east', line: 3 },
      { side: 'south', line: 5 },
    ] as const) {
      game = readyToInsert(insert(game, 'p1', insertion, 0));
    }
    expect(game.version).toBe(3);
    expect(game.log.map((entry) => entry.seq)).toEqual([1, 2, 3]);
    expect(game.log.every((entry) => entry.type === 'INSERT')).toBe(true);
  });
});

describe('insert — rejections', () => {
  it('refuses a second slide in the same turn (pg. 2: two steps, in order)', () => {
    const once = insert(newGame(), 'p1', { side: 'north', line: 1 }, 0);
    expect(once.phase).toBe('move');
    expectError(() => insert(once, 'p1', { side: 'east', line: 3 }, 0), 'WRONG_PHASE');
  });

  it('refuses a facing that is not one of the tile’s four orientations', () => {
    expectError(() => insert(newGame(), 'p1', { side: 'north', line: 1 }, 45 as Rotation), 'INVALID_ROTATION');
    expectError(() => insert(newGame(), 'p1', { side: 'north', line: 1 }, -90 as Rotation), 'INVALID_ROTATION');
  });

  it('refuses a point that is not one of the 12 arrows', () => {
    // Even lines are the fixed rows/columns; 7 is off the board altogether.
    expectError(() => insert(newGame(), 'p1', { side: 'north', line: 2 as SlideLine }, 0), 'ILLEGAL_INSERTION');
    expectError(() => insert(newGame(), 'p1', { side: 'west', line: 7 as SlideLine }, 0), 'ILLEGAL_INSERTION');
  });

  it('refuses putting the tile back where it was just pushed out (pg. 2, "The only exception")', () => {
    const pushed = readyToInsert(insert(newGame(), 'p1', { side: 'north', line: 1 }, 0));
    expectError(() => insert(pushed, 'p1', { side: 'south', line: 1 }, 0), 'ILLEGAL_INSERTION');
    // Everything else on that line and every other line is still fair game — including the same arrow.
    expect(() => insert(pushed, 'p1', { side: 'north', line: 1 }, 0)).not.toThrow();
    expect(() => insert(pushed, 'p1', { side: 'south', line: 3 }, 0)).not.toThrow();
  });

  it('frees the banned arrow again once a different push has happened', () => {
    const banned: Insertion = { side: 'south', line: 1 };
    let game = readyToInsert(insert(newGame(), 'p1', { side: 'north', line: 1 }, 0));
    expectError(() => insert(game, 'p1', banned, 0), 'ILLEGAL_INSERTION');

    game = readyToInsert(insert(game, 'p1', { side: 'east', line: 5 }, 0));
    expect(() => insert(game, 'p1', banned, 0)).not.toThrow();
  });
});

describe('insert — purity', () => {
  it('does not mutate the state it is given, even deep in the board', () => {
    const before = deepFreeze(withPawnAt(seededGame(141, seats(4)), 'p3', { row: 6, col: 1 }));
    const snapshot = structuredClone(before);

    const after = insert(before, 'p1', { side: 'north', line: 1 }, 90);

    expect(before).toEqual(snapshot);
    // The rows the slide did not touch may be shared, but the board object itself must be new.
    expect(after.board).not.toBe(before.board);
    expect(after.players).not.toBe(before.players);
  });

  it('is deterministic — the same push on the same state gives the same state', () => {
    const before = seededGame(151, seats(3));
    const insertion: Insertion = { side: 'east', line: 3 };
    expect(insert(before, 'p1', insertion, 270)).toEqual(insert(before, 'p1', insertion, 270));
  });

  it('depends only on its arguments — a different facing gives a different board', () => {
    const before = seededGame(161);
    const insertion: Insertion = { side: 'south', line: 5 };
    const at0 = insert(before, 'p1', insertion, 0);
    const at90 = insert(before, 'p1', insertion, 90);
    expect(tileAt(at0.board, entrySquare(insertion)).rotation).toBe(0);
    expect(tileAt(at90.board, entrySquare(insertion)).rotation).toBe(90);
    // …and nothing else about the two outcomes differs.
    expect(at0.extraTile).toEqual(at90.extraTile);
  });
});
