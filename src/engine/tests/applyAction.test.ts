import { describe, expect, it } from 'vitest';
import { BOARD_SIZE, ROTATIONS, START_CORNERS } from '../core';
import type { Insertion, LabyrinthState, Position } from '../core';
import type { Action } from '../actions';
import { applyAction, insert, legalActions, move } from '../actions';
import { INSERTIONS, legalInsertions, linePath, reachableFrom, reverseOf, sameInsertion } from '../internal';
import { deepFreeze, expectError, newGame, readyToMove, seats, seededGame, withPawnAt, withStack } from './helpers';

const ended = (state: LabyrinthState): LabyrinthState => ({ ...state, status: 'ended', winnerIds: ['p1'] });

/** The INSERT arms of a candidate list, narrowed — since L2 the union also carries MOVE arms. */
const insertsOf = (actions: readonly Action[]): Extract<Action, { type: 'INSERT' }>[] =>
  actions.filter((action): action is Extract<Action, { type: 'INSERT' }> => action.type === 'INSERT');

describe('applyAction — the turn guards', () => {
  it('routes INSERT to the slide, giving exactly what `insert` gives', () => {
    const before = seededGame(201, seats(3));
    const insertion: Insertion = { side: 'west', line: 5 };
    expect(applyAction(before, 'p1', { type: 'INSERT', insertion, rotation: 90 })).toEqual(
      insert(before, 'p1', insertion, 90),
    );
  });

  it('routes MOVE to the piece move, giving exactly what `move` gives', () => {
    const before = readyToMove(seededGame(202, seats(3)));
    const target = reachableFrom(before.board, before.players[0]!.position)[1] ?? before.players[0]!.position;
    expect(applyAction(before, 'p1', { type: 'MOVE', target })).toEqual(move(before, 'p1', target));
  });

  it('refuses a seat that is not on the clock', () => {
    const game = newGame(seats(4));
    const action = { type: 'INSERT', insertion: { side: 'north', line: 1 }, rotation: 0 } as const;
    expectError(() => applyAction(game, 'p2', action), 'NOT_YOUR_TURN');
    expectError(() => applyAction(game, 'p4', action), 'NOT_YOUR_TURN');
    expect(() => applyAction(game, 'p1', action)).not.toThrow();
  });

  it('refuses a player who is not in the game at all', () => {
    const action = { type: 'INSERT', insertion: { side: 'north', line: 1 }, rotation: 0 } as const;
    expectError(() => applyAction(newGame(), 'nobody', action), 'PLAYER_NOT_FOUND');
  });

  it('refuses everything once the game has ended', () => {
    const action = { type: 'INSERT', insertion: { side: 'north', line: 1 }, rotation: 0 } as const;
    expectError(() => applyAction(ended(newGame()), 'p1', action), 'GAME_OVER');
  });

  it('does not mutate the state it is given', () => {
    const before = deepFreeze(seededGame(211, seats(2)));
    const snapshot = structuredClone(before);
    applyAction(before, 'p1', { type: 'INSERT', insertion: { side: 'south', line: 3 }, rotation: 180 });
    expect(before).toEqual(snapshot);
  });
});

describe('legalActions', () => {
  it('offers all 12 arrows × 4 facings on the first turn — 48 candidates', () => {
    const game = newGame();
    const actions = legalActions(game);
    expect(actions).toHaveLength(INSERTIONS.length * ROTATIONS.length);
    expect(actions).toHaveLength(48);
    expect(actions.every((action) => action.type === 'INSERT')).toBe(true);
    expect(new Set(insertsOf(actions).map((a) => `${a.insertion.side}/${a.insertion.line}/${a.rotation}`)).size).toBe(
      48,
    );
  });

  it('drops to 44 once an arrow is banned, and offers no banned arrow at any facing', () => {
    const pushed = { ...seededGame(221), lastPush: { side: 'north', line: 1 } as Insertion, phase: 'insert' as const };
    const actions = legalActions(pushed);
    expect(actions).toHaveLength(44);
    const banned = reverseOf(pushed.lastPush)!;
    expect(insertsOf(actions).some((action) => sameInsertion(action.insertion, banned))).toBe(false);
  });

  it('offers every candidate the engine will actually accept, and only those', () => {
    const game = seededGame(231, seats(3));
    for (const action of legalActions(game)) {
      expect(() => applyAction(game, 'p1', action)).not.toThrow();
    }
    // The converse: the arrows it lists are exactly `legalInsertions`, each at all four facings.
    const listed = new Set(insertsOf(legalActions(game)).map((a) => `${a.insertion.side}/${a.insertion.line}`));
    expect([...listed].sort()).toEqual(
      legalInsertions(game)
        .map((a) => `${a.side}/${a.line}`)
        .sort(),
    );
  });

  it('offers nothing to an off-turn seat, and everything to the active one by default', () => {
    const game = newGame(seats(3));
    expect(legalActions(game, 'p1')).toEqual(legalActions(game));
    expect(legalActions(game, 'p2')).toEqual([]);
    expect(legalActions(game, 'p3')).toEqual([]);
  });

  it('offers the reachable squares once the maze has been moved, and nothing else', () => {
    const moved = applyAction(newGame(), 'p1', {
      type: 'INSERT',
      insertion: { side: 'east', line: 3 },
      rotation: 0,
    });
    expect(moved.phase).toBe('move');
    const actions = legalActions(moved);
    expect(actions.every((action) => action.type === 'MOVE')).toBe(true);
    expect(actions.map((action) => (action.type === 'MOVE' ? action.target : null))).toEqual(
      reachableFrom(moved.board, moved.players[0]!.position),
    );
  });

  it('always offers at least staying put, and never more than the 49 squares', () => {
    for (const seed of [241, 242, 243]) {
      const game = seededGame(seed, seats(4));
      const moved = applyAction(game, 'p1', { type: 'INSERT', insertion: { side: 'north', line: 5 }, rotation: 90 });
      const actions = legalActions(moved);
      expect(actions.length).toBeGreaterThanOrEqual(1);
      expect(actions.length).toBeLessThanOrEqual(BOARD_SIZE * BOARD_SIZE);
      const here = moved.players[0]!.position;
      expect(actions.some((a) => a.type === 'MOVE' && a.target.row === here.row && a.target.col === here.col)).toBe(
        true,
      );
      // And every one of them is a move the engine will actually accept.
      for (const action of actions) expect(() => applyAction(moved, 'p1', action)).not.toThrow();
    }
  });

  it('offers nothing to an off-turn seat in the move phase either', () => {
    const moved = readyToMove(seededGame(251, seats(3)));
    expect(legalActions(moved, 'p1')).toEqual(legalActions(moved));
    expect(legalActions(moved, 'p2')).toEqual([]);
  });

  it('offers nothing once the game has ended', () => {
    expect(legalActions(ended(newGame()))).toEqual([]);
    expect(legalActions(ended(newGame()), 'p1')).toEqual([]);
    expect(legalActions(ended(readyToMove(newGame())))).toEqual([]);
  });
});

/**
 * The invariant L1 promised: a slide can never end the game. The rulebook only ever ends the game on a
 * player's own move (pg. 2, "Ending the Game"), and the board's geometry backs that up — the four home
 * corners are fixed tiles at even/even squares, so no push ever touches one and the wraparound rule can
 * never carry a piece home for free.
 */
describe('the slide can never win the game', () => {
  it('never pushes a line through any home corner, so no wrap can land on one', () => {
    const corners = new Set(Object.values(START_CORNERS).map((c: Position) => `${c.row},${c.col}`));
    for (const insertion of INSERTIONS) {
      for (const square of linePath(insertion)) {
        expect(corners.has(`${square.row},${square.col}`)).toBe(false);
      }
    }
  });

  it('leaves the game active even when every seat is one push from home with an empty stack', () => {
    // The strongest possible setup for a spurious win: all four pieces stand on the squares next to their
    // own corners, with nothing left to find. Every arrow, at every facing, must still leave `status` active.
    let game = seededGame(261, seats(4));
    for (const player of game.players) {
      const home = START_CORNERS[player.color];
      const beside: Position = home.row === 0 ? { row: 1, col: home.col } : { row: 5, col: home.col };
      game = withStack(withPawnAt(game, player.id, beside), player.id, []);
    }
    for (const insertion of INSERTIONS) {
      for (const rotation of ROTATIONS) {
        const after = insert(game, 'p1', insertion, rotation);
        expect(after.status).toBe('active');
        expect(after.phase).toBe('move');
        // …and the turn has not passed either: a slide is only half a turn (ruling 9).
        expect(after.activePlayerIndex).toBe(game.activePlayerIndex);
        expect(after.turn).toBe(game.turn);
      }
    }
  });
});

describe('a whole turn through applyAction', () => {
  it('is exactly two actions: slide, then move, then the next seat', () => {
    const game = seededGame(271, seats(3));
    const slid = applyAction(game, 'p1', { type: 'INSERT', insertion: { side: 'west', line: 1 }, rotation: 180 });
    expect(slid.phase).toBe('move');
    expect(slid.activePlayerIndex).toBe(0);

    const target = legalActions(slid)[0]!;
    const done = applyAction(slid, 'p1', target);
    expect(done.phase).toBe('insert');
    expect(done.activePlayerIndex).toBe(1);
    expect(done.turn).toBe(2);
    expect(done.log.map((entry) => entry.type)).toEqual(['INSERT', 'MOVE']);
    expect(done.version).toBe(2);
  });

  it('refuses the two halves in the wrong order', () => {
    const game = seededGame(281, seats(2));
    expectError(() => applyAction(game, 'p1', { type: 'MOVE', target: game.players[0]!.position }), 'WRONG_PHASE');
    const slid = applyAction(game, 'p1', { type: 'INSERT', insertion: { side: 'south', line: 3 }, rotation: 0 });
    expectError(
      () => applyAction(slid, 'p1', { type: 'INSERT', insertion: { side: 'north', line: 5 }, rotation: 0 }),
      'WRONG_PHASE',
    );
  });
});
