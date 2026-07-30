import { describe, expect, it } from 'vitest';
import { GameError } from '../core';
import type { LabyrinthState } from '../core';
import { activePlayer, record, seatOf, tileAt, withPlayer } from '../internal';
import { expectError, newGame, seats } from './helpers';

/**
 * The kernel seams, bound to Labyrinth's own types.
 *
 * These are the published `@game-hub/kernel` primitives this game builds on (`record`, `makeSeating`,
 * `GameError`) exercised against Labyrinth's state shape. Worth their own file in this repo specifically:
 * this game is the Track D / D2c pilot, the first built **outside** the platform monorepo against the
 * registry copy of the kernel, so "the kernel actually works from node_modules" is a result, not an
 * assumption. L1 onward leans on all three.
 */
describe('record()', () => {
  it('bumps the version and appends one log entry', () => {
    const before = newGame();
    const after = record<LabyrinthState>(before, 'insert', 'p1', { turn: 2 }, { side: 'north', line: 1 });

    expect(after.version).toBe(before.version + 1);
    expect(after.turn).toBe(2);
    expect(after.log).toHaveLength(1);
    expect(after.log[0]).toEqual({
      seq: 1,
      type: 'insert',
      playerId: 'p1',
      payload: { side: 'north', line: 1 },
    });
    // Immutability: the input state is untouched.
    expect(before.version).toBe(0);
    expect(before.log).toEqual([]);
  });

  it('keeps the log in sequence across several records', () => {
    let game = newGame();
    for (let i = 0; i < 3; i += 1) game = record<LabyrinthState>(game, 'move', 'p1');
    expect(game.version).toBe(3);
    expect(game.log.map((entry) => entry.seq)).toEqual([1, 2, 3]);
  });
});

describe('seating (kernel makeSeating, bound to this game)', () => {
  it('locates a seat and reads the active one', () => {
    const game = newGame(seats(3));
    expect(seatOf(game, 'p2')).toBe(1);
    expect(activePlayer(game).id).toBe('p1');
  });

  it('replaces one seat immutably', () => {
    const game = newGame();
    const moved = { ...game.players[1]!, position: { row: 3, col: 3 } };
    const roster = withPlayer(game, 1, moved);
    expect(roster[1]!.position).toEqual({ row: 3, col: 3 });
    expect(game.players[1]!.position).toEqual({ row: 0, col: 6 });
  });

  /**
   * ⚠️ This is the assertion that keeps a 404 from becoming a 500: the kernel's seat helper must throw
   * *Labyrinth's* `GameError` subclass, because the host's `mapError` branches on `instanceof` it.
   */
  it('throws this game’s GameError subclass for an unknown player', () => {
    const game = newGame();
    expectError(() => seatOf(game, 'nobody'), 'PLAYER_NOT_FOUND');
    expect(() => seatOf(game, 'nobody')).toThrow(GameError);
  });
});

describe('tileAt', () => {
  it('reads the tile on a square', () => {
    const game = newGame();
    expect(tileAt(game.board, { row: 0, col: 0 }).id).toBe('fixed-r0c0');
    expect(tileAt(game.board, { row: 0, col: 1 })).toBe(game.board[0]![1]);
  });
});
