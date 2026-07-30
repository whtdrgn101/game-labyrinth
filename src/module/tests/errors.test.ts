import { describe, expect, it } from 'vitest';
import { GameError as KernelGameError } from '@game-hub/kernel';
import { GameError } from '../../engine';
import type { LabyrinthErrorCode } from '../../engine';
import { mapLabyrinthError } from '../errors';
import { labyrinthModule } from '../index';

/**
 * Every code the engine can throw, with the status it must map to. Written out here rather than derived
 * from the module's own table, so the test is an independent statement of the contract instead of a
 * restatement of the implementation — and so adding a code without deciding its status fails *here* too.
 */
const EXPECTED: Readonly<Record<LabyrinthErrorCode, number>> = {
  PLAYER_NOT_FOUND: 404,
  INVALID_PLAYER_COUNT: 400,
  INVALID_PLAYER_COLOR: 400,
  INVALID_ROTATION: 400,
  INVALID_POSITION: 400,
  NOT_YOUR_TURN: 409,
  GAME_OVER: 409,
  WRONG_PHASE: 409,
  ILLEGAL_INSERTION: 409,
  UNREACHABLE: 409,
};

describe('mapError', () => {
  it('maps every declared error code', () => {
    for (const [code, status] of Object.entries(EXPECTED)) {
      const mapped = mapLabyrinthError(new GameError(code as LabyrinthErrorCode, `${code} happened`));
      expect(mapped).toEqual({ status, code, message: `${code} happened` });
    }
  });

  it('splits payload mistakes (400) from moves this position refuses (409)', () => {
    // The engine's own shape-before-rules split, carried onto the wire: a rotation that isn't one of four
    // could never be right; an insertion that would undo the last push is fine anywhere but here (pg. 2).
    expect(mapLabyrinthError(new GameError('INVALID_ROTATION', 'x'))?.status).toBe(400);
    expect(mapLabyrinthError(new GameError('ILLEGAL_INSERTION', 'x'))?.status).toBe(409);
    expect(mapLabyrinthError(new GameError('INVALID_POSITION', 'x'))?.status).toBe(400);
    expect(mapLabyrinthError(new GameError('UNREACHABLE', 'x'))?.status).toBe(409);
  });

  it('returns null for anything that is not ours, so the host 500s instead of guessing', () => {
    expect(mapLabyrinthError(new Error('boom'))).toBeNull();
    expect(mapLabyrinthError('NOT_YOUR_TURN')).toBeNull();
    expect(mapLabyrinthError(null)).toBeNull();
    expect(mapLabyrinthError({ code: 'NOT_YOUR_TURN', message: 'spoofed' })).toBeNull();
  });

  it('refuses a *kernel* GameError carrying one of our codes', () => {
    // ⚠️ The exact hazard the kernel's `makeSeating` note describes: a base-class error is not this game's,
    // even when its code string matches, and mislabelling it would turn somebody else's bug into a 4xx.
    expect(mapLabyrinthError(new KernelGameError('PLAYER_NOT_FOUND', 'from the kernel'))).toBeNull();
  });

  it('does map a PLAYER_NOT_FOUND raised inside the kernel’s seat helper', () => {
    // The other half of that note: `makeSeating` is injected with *this* package's subclass, so a seat
    // lookup failing deep in kernel code still arrives here as a 404 rather than a 500.
    let thrown: unknown;
    try {
      // A game whose roster has no such seat — the only way to reach `onMissing`.
      labyrinthModule.applyAction(
        labyrinthModule.createGame({ id: 'g', players: [{ name: 'Ann' }, { name: 'Bob' }], rng: () => 0.5 }),
        'nobody',
        { type: 'MOVE', target: { row: 0, col: 0 } },
      );
    } catch (error) {
      thrown = error;
    }
    expect(mapLabyrinthError(thrown)).toEqual({
      status: 404,
      code: 'PLAYER_NOT_FOUND',
      message: 'No player with id "nobody"',
    });
  });
});
