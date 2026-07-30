import { describe, expect, it } from 'vitest';
import { KERNEL_CONTRACT_VERSION } from '@game-hub/kernel';
import { MAX_PLAYERS, MIN_PLAYERS, SEAT_COLORS, START_CORNERS } from '../../engine';
import labyrinthDefault, { LABYRINTH_INFO, labyrinthModule } from '../index';
import { mulberry32, playToAWin, seats } from './helpers';

describe('the module object — what a host registers', () => {
  it('declares its identity and seat bounds (pg. 1, "2 to 4 Players")', () => {
    expect(labyrinthModule.id).toBe('labyrinth');
    expect(labyrinthModule.name).toBe('Labyrinth');
    expect(labyrinthModule.minPlayers).toBe(MIN_PLAYERS);
    expect(labyrinthModule.maxPlayers).toBe(MAX_PLAYERS);
    expect([MIN_PLAYERS, MAX_PLAYERS]).toEqual([2, 4]);
  });

  it('offers exactly the four pawn colours, in clockwise corner order', () => {
    // ⚠️ Not a cosmetic palette: each id names the corner its holder starts on and must return to (pg. 1
    // Set Up, pg. 2 Ending the Game), so the list must be the four corners and nothing else.
    expect(labyrinthModule.colors).toEqual([...SEAT_COLORS]);
    expect(labyrinthModule.colors).toHaveLength(MAX_PLAYERS);
    expect(new Set(labyrinthModule.colors).size).toBe(MAX_PLAYERS);
    // Every offered id is a corner on the board — the palette *is* the four home corners, not a tint list.
    for (const color of SEAT_COLORS) {
      expect(labyrinthModule.colors).toContain(color);
      expect(START_CORNERS[color]).toBeDefined();
    }
  });

  it('declares the kernel contract it compiled against, never a literal', () => {
    expect(labyrinthModule.kernelContract).toBe(KERNEL_CONTRACT_VERSION);
    expect(LABYRINTH_INFO.kernelContract).toBe(KERNEL_CONTRACT_VERSION);
  });

  it('is the default export a generated registry imports', () => {
    expect(labyrinthDefault).toBe(labyrinthModule);
  });

  it('implements every required member and no optional hook it does not need', () => {
    for (const member of [
      'createGame',
      'applyAction',
      'legalActions',
      'viewFor',
      'parseAction',
      'summarize',
      'versionOf',
      'movesOf',
      'mapError',
    ] as const) {
      expect(typeof labyrinthModule[member]).toBe('function');
    }
    // No per-action randomness, no multi-seat flow, no side-channel, no shape migration, no bot until L5.
    for (const hook of ['routes', 'pendingStep', 'onStateChanged', 'createBotDriver', 'migrate'] as const) {
      expect(labyrinthModule[hook]).toBeUndefined();
    }
    expect(labyrinthModule.schemaVersion).toBeUndefined();
    expect(labyrinthModule.botDifficulties).toBeUndefined();
  });
});

describe('summarize / versionOf / movesOf', () => {
  const opened = () =>
    labyrinthModule.createGame({ id: 'g1', players: seats(3).map((name) => ({ name })), rng: mulberry32(3) });

  it('summarises a game without naming a single card', () => {
    const state = opened();
    const summary = labyrinthModule.summarize(state);
    expect(summary).toEqual({
      id: 'g1',
      turn: 1,
      status: 'active',
      activePlayerId: 'p1',
      players: [
        { id: 'p1', name: 'P1' },
        { id: 'p2', name: 'P2' },
        { id: 'p3', name: 'P3' },
      ],
    });
    // The lobby card is secret-free by construction: no stack, no treasure, anywhere in it.
    const serialized = JSON.stringify(summary);
    for (const player of state.players) for (const card of player.stack) expect(serialized).not.toContain(card);
  });

  it('reports the version the host version-guards its pushes with, and moves it once per action', () => {
    const state = opened();
    expect(labyrinthModule.versionOf(state)).toBe(0);
    const after = labyrinthModule.applyAction(state, 'p1', {
      type: 'INSERT',
      insertion: { side: 'north', line: 1 },
      rotation: 0,
    });
    expect(labyrinthModule.versionOf(after)).toBe(1);
    expect(labyrinthModule.movesOf(after)).toHaveLength(1);
    expect(labyrinthModule.movesOf(state)).toEqual([]);
  });

  it('hands over the public move log verbatim', () => {
    const state = opened();
    const after = labyrinthModule.applyAction(state, 'p1', {
      type: 'INSERT',
      insertion: { side: 'west', line: 3 },
      rotation: 90,
    });
    expect(labyrinthModule.movesOf(after)).toBe(after.log);
    expect(labyrinthModule.movesOf(after)[0]).toMatchObject({ seq: 1, type: 'INSERT', playerId: 'p1' });
  });
});

/**
 * The stand-in for the hub's own module-seam conformance suite, which an out-of-repo game cannot run
 * (`docs/d2c-findings.md` §6): whole seeded games played **through the module** — `createGame` →
 * `parseAction` → `applyAction` — with every viewer's projection checked after every single action.
 *
 * It is the only test here that proves the members work *together*: a `parseAction` that quietly refused a
 * legal action, a `viewFor` that leaked once the log grew, or an `applyAction` that stopped ending games
 * would all pass their own unit tests and die here.
 */
describe('a whole game through the module seam', () => {
  for (const count of [2, 3, 4]) {
    it(`plays ${String(count)} seats to a real win, leak-checked at every step`, () => {
      const result = playToAWin({ seed: 100 + count, names: seats(count) });

      // A genuine win, independently re-checked against the rulebook's ending condition (pg. 2): every card
      // flipped *and* the pawn back on the corner its colour names.
      const winner = result.state.players.find((player) => player.id === result.winnerId)!;
      expect(winner.stack).toEqual([]);
      expect(winner.found).toHaveLength(24 / count);
      expect(winner.position).toEqual(START_CORNERS[winner.color]);

      // The game stops on the winner's seat and refuses everything after (Can't Stop's pattern).
      expect(labyrinthModule.legalActions(result.state)).toEqual([]);
      expect(labyrinthModule.summarize(result.state).status).toBe('ended');
      expect(() =>
        labyrinthModule.applyAction(result.state, result.winnerId, { type: 'MOVE', target: winner.position }),
      ).toThrow();

      // Two actions per turn, always — `INSERT` then `MOVE`, neither skippable (pg. 2). The turn counter
      // does not advance on the winning move, which is why the log is one action longer than 2 × turns − 1.
      expect(result.actions).toBe(2 * result.turns);
      expect(labyrinthModule.movesOf(result.state)).toHaveLength(result.actions);
      expect(labyrinthModule.versionOf(result.state)).toBe(result.actions);
      expect(result.leakChecks).toBeGreaterThan(result.actions);
    });
  }

  it('is deterministic — the same seed plays the same game', () => {
    const first = playToAWin({ seed: 909, names: seats(4) });
    const second = playToAWin({ seed: 909, names: seats(4) });
    expect(second.state).toEqual(first.state);
    expect(second.actions).toBe(first.actions);
  });

  it('never records a treasure that was still face down', () => {
    // "Everything logged is public": a `MOVE` payload carries the card just turned face **up**, never the
    // one revealed underneath it (pg. 2). Checked against the finished game's own history.
    const { state } = playToAWin({ seed: 404, names: seats(3) });
    const flipped = new Set(state.players.flatMap((player) => player.found));
    for (const move of state.log) {
      const card = move.payload?.['flipped'];
      if (typeof card === 'string') expect(flipped.has(card as never)).toBe(true);
    }
  });
});
