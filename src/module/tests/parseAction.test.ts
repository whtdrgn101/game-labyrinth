import { describe, expect, it } from 'vitest';
import { DIRECTIONS, ROTATIONS, SLIDE_LINES, legalActions } from '../../engine';
import type { Action } from '../../engine';
import { parseLabyrinthAction } from '../parseAction';
import { mulberry32 } from './helpers';
import { labyrinthModule } from '../index';

/** The parsed action, or a failed expectation naming the message — so a test reads as one line. */
function parsed(raw: unknown): Action {
  const result = parseLabyrinthAction(raw);
  if (!result.ok) throw new Error(`expected a legal action, got: ${result.message}`);
  return result.action;
}

/** The rejection message, or a failed expectation. */
function rejected(raw: unknown): string {
  const result = parseLabyrinthAction(raw);
  if (result.ok) throw new Error(`expected a rejection, got ${JSON.stringify(result.action)}`);
  return result.message;
}

describe('parseAction — what it accepts', () => {
  it('accepts every one of the 48 opening INSERTs (12 arrows × 4 facings, pg. 2)', () => {
    const game = labyrinthModule.createGame({
      id: 'g',
      players: [{ name: 'Ann' }, { name: 'Bob' }],
      rng: mulberry32(1),
    });
    const opening = labyrinthModule.legalActions(game);
    expect(opening).toHaveLength(48);
    for (const action of opening) {
      // Through JSON, because that is how it arrives: a wire round trip, then the parser.
      expect(parsed(JSON.parse(JSON.stringify(action)))).toEqual(action);
    }
  });

  it('accepts every MOVE the engine offers, including staying put (pg. 2)', () => {
    const game = labyrinthModule.createGame({
      id: 'g',
      players: [{ name: 'Ann' }, { name: 'Bob' }],
      rng: mulberry32(2),
    });
    const afterSlide = labyrinthModule.applyAction(
      game,
      'p1',
      parsed({ type: 'INSERT', insertion: { side: 'north', line: 1 }, rotation: 0 }),
    );
    const moves = legalActions(afterSlide, 'p1');
    expect(moves.length).toBeGreaterThan(0);
    for (const action of moves) {
      expect(parsed(JSON.parse(JSON.stringify(action)))).toEqual(action);
    }
    // The pawn's own square is always among them — "stay put" is a MOVE, not a second action (ruling 11).
    expect(moves).toContainEqual({ type: 'MOVE', target: afterSlide.players[0]!.position });
  });

  it('accepts each side, line and facing on its own', () => {
    for (const side of DIRECTIONS) {
      for (const line of SLIDE_LINES) {
        for (const rotation of ROTATIONS) {
          expect(parsed({ type: 'INSERT', insertion: { side, line }, rotation })).toEqual({
            type: 'INSERT',
            insertion: { side, line },
            rotation,
          });
        }
      }
    }
  });

  it('accepts a target the engine will refuse — legality is not this layer’s business', () => {
    // Off the board entirely: a well-formed payload, and the engine's INVALID_POSITION to answer.
    expect(parsed({ type: 'MOVE', target: { row: 99, col: -4 } })).toEqual({
      type: 'MOVE',
      target: { row: 99, col: -4 },
    });
    // The reverse insertion (pg. 2, "The only exception") likewise parses — `ILLEGAL_INSERTION` is a rule.
    expect(parsed({ type: 'INSERT', insertion: { side: 'south', line: 3 }, rotation: 90 })).toBeTruthy();
  });

  it('rebuilds the action rather than forwarding the caller’s object', () => {
    const raw = { type: 'INSERT', insertion: { side: 'east', line: 5 }, rotation: 180 };
    const action = parsed(raw);
    expect(action).not.toBe(raw);
    if (action.type !== 'INSERT') throw new Error('unreachable');
    expect(action.insertion).not.toBe(raw.insertion);
  });
});

describe('parseAction — what it refuses', () => {
  it('refuses anything that is not an object', () => {
    for (const raw of [null, undefined, 7, 'INSERT', true, [{ type: 'INSERT' }]]) {
      expect(rejected(raw)).toBe('An action must be an object');
    }
  });

  it('refuses an unknown action type, quoting what it was sent', () => {
    expect(rejected({ type: 'PASS' })).toBe('Unknown action type "PASS"');
    expect(rejected({})).toBe('Unknown action type "undefined"');
    expect(rejected({ type: 7 })).toBe('Unknown action type "7"');
    // Lower case is a different string; there is no forgiving normalisation here on purpose.
    expect(rejected({ type: 'insert', insertion: { side: 'north', line: 1 }, rotation: 0 })).toContain(
      'Unknown action',
    );
  });

  describe('INSERT', () => {
    const base = { type: 'INSERT', insertion: { side: 'north', line: 1 }, rotation: 0 };

    it('requires an insertion object', () => {
      expect(rejected({ type: 'INSERT', rotation: 0 })).toBe('INSERT requires an `insertion` object');
      expect(rejected({ ...base, insertion: 'north-1' })).toBe('INSERT requires an `insertion` object');
      expect(rejected({ ...base, insertion: ['north', 1] })).toBe('INSERT requires an `insertion` object');
      expect(rejected({ ...base, insertion: null })).toBe('INSERT requires an `insertion` object');
    });

    it('requires a side from the four directions', () => {
      expect(rejected({ ...base, insertion: { side: 'up', line: 1 } })).toContain('`insertion.side`');
      expect(rejected({ ...base, insertion: { side: 0, line: 1 } })).toContain('`insertion.side`');
      expect(rejected({ ...base, insertion: { line: 1 } })).toContain('`insertion.side`');
    });

    it('requires one of the three movable lines — the even lines hold fixed tiles (pg. 2)', () => {
      for (const line of [0, 2, 4, 6, 7, -1, '1', 1.5]) {
        expect(rejected({ ...base, insertion: { side: 'north', line } })).toContain('`insertion.line`');
      }
      expect(rejected({ ...base, insertion: { side: 'north' } })).toContain('`insertion.line`');
    });

    it('requires one of the four facings', () => {
      for (const rotation of [45, 360, -90, '90', null]) {
        expect(rejected({ ...base, rotation })).toContain('`rotation`');
      }
      expect(rejected({ type: 'INSERT', insertion: { side: 'north', line: 1 } })).toContain('`rotation`');
    });

    it('refuses fields nobody asked for, inside and out', () => {
      expect(rejected({ ...base, tileId: 'm-01' })).toBe('INSERT has no field "tileId"');
      // The engine picks which tile is ejected; a client naming one would be inventing an outcome.
      expect(rejected({ ...base, insertion: { side: 'north', line: 1, tileId: 'm-01' } })).toBe(
        'An insertion has no field "tileId"',
      );
    });
  });

  describe('MOVE', () => {
    const base = { type: 'MOVE', target: { row: 1, col: 2 } };

    it('requires a target object', () => {
      expect(rejected({ type: 'MOVE' })).toBe('MOVE requires a `target` object');
      expect(rejected({ type: 'MOVE', target: [1, 2] })).toBe('MOVE requires a `target` object');
      expect(rejected({ type: 'MOVE', target: '1,2' })).toBe('MOVE requires a `target` object');
    });

    it('requires whole numbers for both coordinates', () => {
      const message = '`target.row` and `target.col` must be whole numbers';
      expect(rejected({ type: 'MOVE', target: { row: 1.5, col: 2 } })).toBe(message);
      expect(rejected({ type: 'MOVE', target: { row: 1, col: '2' } })).toBe(message);
      expect(rejected({ type: 'MOVE', target: { row: 1 } })).toBe(message);
      expect(rejected({ type: 'MOVE', target: { row: Number.NaN, col: 0 } })).toBe(message);
      expect(rejected({ type: 'MOVE', target: { row: null, col: 0 } })).toBe(message);
    });

    it('refuses fields nobody asked for, inside and out', () => {
      expect(rejected({ ...base, flipped: 'ruby' })).toBe('MOVE has no field "flipped"');
      // A client claiming its own flip would be writing the log; the engine decides what was found (pg. 2).
      expect(rejected({ type: 'MOVE', target: { row: 1, col: 2, z: 0 } })).toBe('A target has no field "z"');
    });

    it('names the field it did not expect, rather than the one it wanted', () => {
      // `{ to: … }` is the natural mistake (the *log* payload calls it `to`); the message says so plainly
      // instead of complaining that `target` is missing.
      expect(rejected({ type: 'MOVE', to: { row: 1, col: 2 } })).toBe('MOVE has no field "to"');
    });
  });
});
