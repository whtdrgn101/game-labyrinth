import { describe, expect, it } from 'vitest';
import { START_CORNERS } from '../core';
import type { LabyrinthState, Position } from '../core';
import { applyAction, move } from '../actions';
import {
  deepFreeze,
  expectError,
  mazeBoard,
  newGame,
  readyToMove,
  seats,
  seededGame,
  withBoard,
  withPawnAt,
  withStack,
  withTreasureAt,
} from './helpers';

const at = (row: number, col: number): Position => ({ row, col });

/**
 * One north–south corridor down column 0 — which is red's home corner (0,0) at one end — and nothing else
 * connected to it: every other tile is an east–west straight the corridor cannot enter. So the seat-0 piece
 * can travel exactly the seven squares of column 0, and every square off it is a legal `UNREACHABLE` test.
 */
const CORRIDOR = mazeBoard(['│──────', '│──────', '│──────', '│──────', '│──────', '│──────', '│──────']);

/** A two-seat game standing on `CORRIDOR`, with the mandatory slide already done (pg. 2, step 1). */
function ready(names: string[] = ['Ann', 'Bob']): LabyrinthState {
  return readyToMove(withBoard(newGame(names), CORRIDOR));
}

describe('move — rejections', () => {
  it('refuses to move a piece before the maze has been moved (pg. 2, "Important")', () => {
    const game = withBoard(newGame(), CORRIDOR);
    expect(game.phase).toBe('insert');
    expectError(() => move(game, 'p1', at(1, 0)), 'WRONG_PHASE');
  });

  it('refuses a target that is not a square of the board', () => {
    const game = ready();
    expectError(() => move(game, 'p1', at(-1, 0)), 'INVALID_POSITION');
    expectError(() => move(game, 'p1', at(7, 0)), 'INVALID_POSITION');
    expectError(() => move(game, 'p1', at(0, -1)), 'INVALID_POSITION');
    expectError(() => move(game, 'p1', at(0, 7)), 'INVALID_POSITION');
    expectError(() => move(game, 'p1', at(0.5, 0)), 'INVALID_POSITION');
  });

  it('refuses a real square with no open path to it', () => {
    const game = ready();
    expectError(() => move(game, 'p1', at(3, 3)), 'UNREACHABLE');
    expectError(() => move(game, 'p1', at(0, 1)), 'UNREACHABLE');
  });

  it('refuses everything once the game has ended, via applyAction', () => {
    const won = move(withStack(withPawnAt(ready(), 'p1', at(3, 0)), 'p1', []), 'p1', at(0, 0));
    expect(won.status).toBe('ended');
    expectError(() => applyAction(won, 'p1', { type: 'MOVE', target: at(1, 0) }), 'GAME_OVER');
  });
});

describe('move — the piece (pg. 2, "2. Moving Your Playing Piece")', () => {
  it('puts the piece on any square the corridor reaches, however far', () => {
    for (const row of [1, 2, 3, 4, 5, 6]) {
      const after = move(ready(), 'p1', at(row, 0));
      expect(after.players[0]!.position).toEqual(at(row, 0));
    }
  });

  it('leaves the piece where it is when you move to your own square ("Or, you can leave your playing piece where it is")', () => {
    const game = ready();
    const after = move(game, 'p1', at(0, 0));
    expect(after.players[0]!.position).toEqual(at(0, 0));
    // It is a real move, not a no-op: the turn ends exactly as it would after travelling.
    expect(after.phase).toBe('insert');
    expect(after.activePlayerIndex).toBe(1);
    expect(after.turn).toBe(2);
  });

  it('touches no other seat', () => {
    const game = ready();
    const after = move(game, 'p1', at(4, 0));
    expect(after.players[1]).toEqual(game.players[1]);
  });

  it('lets pieces share a square — the rulebook has no occupancy rule', () => {
    const game = withPawnAt(ready(), 'p2', at(3, 0));
    const after = move(game, 'p1', at(3, 0));
    expect(after.players[0]!.position).toEqual(at(3, 0));
    expect(after.players[1]!.position).toEqual(at(3, 0));
  });

  it('leaves the board and the extra tile completely alone', () => {
    const game = ready();
    const after = move(game, 'p1', at(2, 0));
    expect(after.board).toEqual(game.board);
    expect(after.extraTile).toEqual(game.extraTile);
    // `lastPush` survives the move, so the no-reverse ban still binds the next player (pg. 2).
    expect(after.lastPush).toEqual(game.lastPush);
  });

  it('does not mutate the state it is given', () => {
    const before = deepFreeze(readyToMove(withBoard(seededGame(501, seats(3)), CORRIDOR)));
    const snapshot = structuredClone(before);
    move(before, 'p1', at(5, 0));
    expect(before).toEqual(snapshot);
  });
});

describe('move — the treasure flip (pg. 2, "Once you find the treasure you are looking for")', () => {
  /** `CORRIDOR` with `treasure` printed on the tile at `square`. */
  const withPrize = (square: Position, treasure: 'ruby' | 'crown') => withTreasureAt(CORRIDOR, square, treasure);

  it('turns the top card face up and reveals the next one', () => {
    const game = withStack(withBoard(ready(), withPrize(at(3, 0), 'ruby')), 'p1', ['ruby', 'crown']);
    const after = move(game, 'p1', at(3, 0));
    expect(after.players[0]!.found).toEqual(['ruby']);
    expect(after.players[0]!.stack).toEqual(['crown']);
  });

  it('appends to the face-up pile in the order the treasures were found', () => {
    const first = withStack(withBoard(ready(), withPrize(at(3, 0), 'ruby')), 'p1', ['ruby', 'crown']);
    const afterRuby = move(first, 'p1', at(3, 0));
    // Same seat again, hunting the revealed card, which is now on a different square.
    const second = readyToMove(withBoard({ ...afterRuby, activePlayerIndex: 0 }, withPrize(at(5, 0), 'crown')));
    const afterCrown = move(second, 'p1', at(5, 0));
    expect(afterCrown.players[0]!.found).toEqual(['ruby', 'crown']);
    expect(afterCrown.players[0]!.stack).toEqual([]);
  });

  it("does nothing on a tile bearing somebody else's treasure", () => {
    const game = withStack(withBoard(ready(), withPrize(at(3, 0), 'crown')), 'p1', ['ruby']);
    const after = move(game, 'p1', at(3, 0));
    expect(after.players[0]!.found).toEqual([]);
    expect(after.players[0]!.stack).toEqual(['ruby']);
  });

  it('does nothing on a tile with no treasure at all', () => {
    const game = withStack(ready(), 'p1', ['ruby']);
    const after = move(game, 'p1', at(3, 0));
    expect(after.players[0]!.found).toEqual([]);
    expect(after.players[0]!.stack).toEqual(['ruby']);
  });

  it('does nothing when every card is already flipped — there is nothing left to hunt', () => {
    const game = withStack(withBoard(ready(), withPrize(at(3, 0), 'ruby')), 'p1', []);
    const after = move(game, 'p1', at(3, 0));
    expect(after.players[0]!.stack).toEqual([]);
    expect(after.players[0]!.found).toEqual([]);
    expect(after.status).toBe('active');
  });

  it('checks only the square the piece STOPS on, never one it crosses (ROADMAP ruling 10)', () => {
    // (3,0) bears the ruby and lies between the piece at (0,0) and its destination (6,0). The engine is
    // handed a destination, not a route — with several routes possible there is no "the square you passed".
    const game = withStack(withBoard(ready(), withPrize(at(3, 0), 'ruby')), 'p1', ['ruby']);
    const after = move(game, 'p1', at(6, 0));
    expect(after.players[0]!.found).toEqual([]);
    expect(after.players[0]!.stack).toEqual(['ruby']);
  });
});

describe('move — the end of a turn (pg. 2, "Now it\'s the next player\'s turn")', () => {
  it('hands the turn on clockwise and back to the mandatory slide', () => {
    const after = move(ready(), 'p1', at(2, 0));
    expect(after.activePlayerIndex).toBe(1);
    expect(after.turn).toBe(2);
    expect(after.phase).toBe('insert');
  });

  it('wraps round the table from the last seat to the first', () => {
    const game = { ...ready(seats(4)), activePlayerIndex: 3 };
    const after = move(withPawnAt(game, 'p4', at(6, 0)), 'p4', at(5, 0));
    expect(after.activePlayerIndex).toBe(0);
    expect(after.turn).toBe(2);
  });

  it('records one public entry — where the piece went, and any card turned face up', () => {
    const game = withStack(withBoard(ready(), withTreasureAt(CORRIDOR, at(3, 0), 'ruby')), 'p1', ['ruby', 'crown']);
    const after = move(game, 'p1', at(3, 0));
    expect(after.version).toBe(game.version + 1);
    expect(after.log).toHaveLength(game.log.length + 1);
    expect(after.log.at(-1)).toEqual({
      seq: 1,
      type: 'MOVE',
      playerId: 'p1',
      payload: { from: at(0, 0), to: at(3, 0), flipped: 'ruby', won: false },
    });
  });

  it("never records the card revealed underneath — that is the mover's secret (pg. 2)", () => {
    const game = withStack(withBoard(ready(), withTreasureAt(CORRIDOR, at(3, 0), 'ruby')), 'p1', ['ruby', 'crown']);
    const after = move(game, 'p1', at(3, 0));
    expect(JSON.stringify(after.log.at(-1))).not.toContain('crown');
  });

  it('records a `flipped: null` move when nothing was found', () => {
    const after = move(ready(), 'p1', at(0, 0));
    expect(after.log.at(-1)?.payload).toEqual({ from: at(0, 0), to: at(0, 0), flipped: null, won: false });
  });
});

describe('move — the win (pg. 2, "Ending the Game")', () => {
  /** Seat 0 is red, so its home corner is (0,0) — one end of `CORRIDOR`. */
  const homeOfSeat0 = START_CORNERS.red;

  it('ends the game the instant the last-carded piece gets home, and names the winner', () => {
    const game = withStack(withPawnAt(ready(), 'p1', at(4, 0)), 'p1', []);
    const after = move(game, 'p1', homeOfSeat0);
    expect(after.status).toBe('ended');
    if (after.status !== 'ended') throw new Error('unreachable');
    expect(after.winnerIds).toEqual(['p1']);
  });

  it('does not pass the turn on a win — the game stops where it is', () => {
    const game = withStack(withPawnAt(ready(), 'p1', at(4, 0)), 'p1', []);
    const after = move(game, 'p1', homeOfSeat0);
    expect(after.activePlayerIndex).toBe(0);
    expect(after.turn).toBe(game.turn);
    expect(after.log.at(-1)?.payload).toEqual({ from: at(4, 0), to: homeOfSeat0, flipped: null, won: true });
  });

  it('is checked AFTER the flip, so the last card and the homecoming can land together', () => {
    // A treasure on a corner cannot happen on the real board (the four corners are fixed, treasure-free
    // tiles), so this fixture is hypothetical — what it pins down is the *ordering*: the win test reads the
    // stack the flip left behind, not the one the move started with.
    const game = withStack(
      withBoard(withPawnAt(ready(), 'p1', at(4, 0)), withTreasureAt(CORRIDOR, homeOfSeat0, 'ruby')),
      'p1',
      ['ruby'],
    );
    const after = move(game, 'p1', homeOfSeat0);
    expect(after.players[0]!.found).toEqual(['ruby']);
    expect(after.status).toBe('ended');
  });

  it('is not a win with cards still to find, even standing on home', () => {
    const game = withStack(withPawnAt(ready(), 'p1', at(4, 0)), 'p1', ['ruby']);
    const after = move(game, 'p1', homeOfSeat0);
    expect(after.status).toBe('active');
    expect(after.activePlayerIndex).toBe(1);
  });

  it('is not a win with every card found but the piece somewhere else', () => {
    const game = withStack(ready(), 'p1', []);
    const after = move(game, 'p1', at(6, 0));
    expect(after.status).toBe('active');
  });

  it("counts only your OWN corner — standing on somebody else's is nothing", () => {
    // Seat 1 is yellow, home (0,6). Sending it to red's corner with an empty stack must not end the game.
    const game = withStack(withPawnAt({ ...ready(), activePlayerIndex: 1 }, 'p2', at(4, 0)), 'p2', []);
    expect(game.players[1]!.color).toBe('yellow');
    const after = move(game, 'p2', homeOfSeat0);
    expect(after.status).toBe('active');
    expect(after.players[1]!.position).toEqual(homeOfSeat0);
  });

  it('lets the fourth seat win as readily as the first', () => {
    // Seat 3 is green, home (6,0) — the other end of the corridor.
    const game = { ...ready(seats(4)), activePlayerIndex: 3 };
    const staged = withStack(withPawnAt(game, 'p4', at(2, 0)), 'p4', []);
    const after = move(staged, 'p4', START_CORNERS.green);
    expect(after.status).toBe('ended');
    if (after.status !== 'ended') throw new Error('unreachable');
    expect(after.winnerIds).toEqual(['p4']);
  });
});
