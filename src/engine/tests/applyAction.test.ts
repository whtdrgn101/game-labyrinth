import { describe, expect, it } from 'vitest';
import { ROTATIONS } from '../core';
import type { Insertion, LabyrinthState } from '../core';
import { applyAction, insert, legalActions } from '../actions';
import { INSERTIONS, legalInsertions, reverseOf, sameInsertion } from '../internal';
import { deepFreeze, expectError, newGame, seats, seededGame } from './helpers';

const ended = (state: LabyrinthState): LabyrinthState => ({ ...state, status: 'ended', winnerIds: ['p1'] });

describe('applyAction — the turn guards', () => {
  it('routes INSERT to the slide, giving exactly what `insert` gives', () => {
    const before = seededGame(201, seats(3));
    const insertion: Insertion = { side: 'west', line: 5 };
    expect(applyAction(before, 'p1', { type: 'INSERT', insertion, rotation: 90 })).toEqual(
      insert(before, 'p1', insertion, 90),
    );
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
    expect(new Set(actions.map((a) => `${a.insertion.side}/${a.insertion.line}/${a.rotation}`)).size).toBe(48);
  });

  it('drops to 44 once an arrow is banned, and offers no banned arrow at any facing', () => {
    const pushed = { ...seededGame(221), lastPush: { side: 'north', line: 1 } as Insertion, phase: 'insert' as const };
    const actions = legalActions(pushed);
    expect(actions).toHaveLength(44);
    const banned = reverseOf(pushed.lastPush)!;
    expect(actions.some((action) => sameInsertion(action.insertion, banned))).toBe(false);
  });

  it('offers every candidate the engine will actually accept, and only those', () => {
    const game = seededGame(231, seats(3));
    for (const action of legalActions(game)) {
      expect(() => applyAction(game, 'p1', action)).not.toThrow();
    }
    // The converse: the arrows it lists are exactly `legalInsertions`, each at all four facings.
    const listed = new Set(legalActions(game).map((action) => `${action.insertion.side}/${action.insertion.line}`));
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

  it('offers nothing once the maze has been moved — the pawn move is L2', () => {
    const moved = applyAction(newGame(), 'p1', {
      type: 'INSERT',
      insertion: { side: 'east', line: 3 },
      rotation: 0,
    });
    expect(moved.phase).toBe('move');
    expect(legalActions(moved)).toEqual([]);
  });

  it('offers nothing once the game has ended', () => {
    expect(legalActions(ended(newGame()))).toEqual([]);
    expect(legalActions(ended(newGame()), 'p1')).toEqual([]);
  });
});
