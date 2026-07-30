import { describe, expect, it } from 'vitest';
import { GameError, SEAT_COLORS, START_CORNERS } from '../../engine';
import { newLabyrinthGame } from '../createGame';
import type { NewGameOptions } from '../createGame';
import { labyrinthModule } from '../index';
import { mulberry32 } from './helpers';

const rng = () => mulberry32(42);

describe('module createGame — the colour picks', () => {
  it('gives a seat the corner its picked colour names (pg. 1 Set Up)', () => {
    const game = newLabyrinthGame({
      id: 'g',
      players: [
        { name: 'Ann', color: 'green' },
        { name: 'Bob', color: 'yellow' },
      ],
      rng: rng(),
    });
    expect(game.players.map((player) => player.color)).toEqual(['green', 'yellow']);
    expect(game.players[0]!.position).toEqual(START_CORNERS.green);
    expect(game.players[1]!.position).toEqual(START_CORNERS.yellow);
  });

  it('fills the seats that picked nothing, in palette order', () => {
    const game = newLabyrinthGame({
      id: 'g',
      players: [{ name: 'Ann' }, { name: 'Bob', color: 'red' }, { name: 'Cal' }],
      rng: rng(),
    });
    expect(game.players.map((player) => player.color)).toEqual(['yellow', 'red', 'blue']);
  });

  it('matches the platform’s palette-order default when no seat picks', () => {
    // The platform assigns seat *i* → `colors[i]` when nobody chooses (kernel `GameModule.colors`), and
    // `colors` is `SEAT_COLORS`. So an unpicked game's corners and the shell's seat tints agree by
    // construction — the property that keeps ruling 6 from being a visible bug on a default table.
    const game = newLabyrinthGame({
      id: 'g',
      players: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }],
      rng: rng(),
    });
    expect(game.players.map((player) => player.color)).toEqual([...labyrinthModule.colors]);
    expect(labyrinthModule.colors).toEqual([...SEAT_COLORS]);
  });

  it('hands an unvalidated pick straight to the engine, which refuses it', () => {
    // The deliberate one cast (`createGame.ts`): the module does not pre-check a colour, so there is
    // exactly one definition of a legal one and a bad pick can never be silently swapped for a default.
    expect(() =>
      newLabyrinthGame({ id: 'g', players: [{ name: 'Ann', color: 'purple' }, { name: 'Bob' }], rng: rng() }),
    ).toThrow(GameError);
    try {
      newLabyrinthGame({ id: 'g', players: [{ name: 'Ann', color: 'purple' }, { name: 'Bob' }], rng: rng() });
    } catch (error) {
      expect((error as GameError).code).toBe('INVALID_PLAYER_COLOR');
      expect(labyrinthModule.mapError(error)?.status).toBe(400);
    }
  });

  it('refuses two seats claiming the same pawn', () => {
    try {
      newLabyrinthGame({
        id: 'g',
        players: [
          { name: 'Ann', color: 'blue' },
          { name: 'Bob', color: 'blue' },
        ],
        rng: rng(),
      });
      throw new Error('expected a rejection');
    } catch (error) {
      expect((error as GameError).code).toBe('INVALID_PLAYER_COLOR');
    }
  });

  it('flows through the module member itself — no cast, the contract carries the pick (kernel 1.2.0)', () => {
    // The L3 escape hatch, retired. This call used to need `labyrinthModule.createGame as (opts:
    // NewGameOptions) => LabyrinthState`, because contract 1 typed the member `players: { name }[]` and a
    // host with picks had to bypass it via the barrel's `newLabyrinthGame`. Kernel 1.2.0 widened the
    // member (`docs/d2c-findings.md` §16 — this repo's finding, acted on platform-side), so the seat's
    // resolved colour is part of the call the host already makes. ⚠️ If a future kernel ever drops the
    // field, this line stops compiling — which is the point of writing it with no cast.
    const game = labyrinthModule.createGame({
      id: 'g',
      players: [{ name: 'Ann', color: 'blue' }, { name: 'Bob' }],
      rng: rng(),
    });
    expect(game.players.map((player) => player.color)).toEqual(['blue', 'red']);

    // …and `NewGameOptions` is now literally the contract's parameter, not a wider local restatement:
    // the module's own implementation type accepts exactly what the host hands the member.
    const sameShape: NewGameOptions = {
      id: 'g',
      players: [{ name: 'Ann', color: 'blue' }, { name: 'Bob' }],
      rng: rng(),
    };
    expect(newLabyrinthGame(sameShape).players.map((player) => player.color)).toEqual(['blue', 'red']);
  });

  it('spends the host’s injected rng and nothing else — same seed, same game', () => {
    const players = [{ name: 'Ann' }, { name: 'Bob' }];
    expect(newLabyrinthGame({ id: 'g', players, rng: mulberry32(7) })).toEqual(
      newLabyrinthGame({ id: 'g', players, rng: mulberry32(7) }),
    );
    expect(newLabyrinthGame({ id: 'g', players, rng: mulberry32(7) })).not.toEqual(
      newLabyrinthGame({ id: 'g', players, rng: mulberry32(8) }),
    );
  });
});
