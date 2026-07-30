import { describe, expect, it } from 'vitest';
import { GameError, SEAT_COLORS, START_CORNERS } from '../../engine';
import type { LabyrinthState } from '../../engine';
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

  it('flows through the module member itself once a host has picks to give it', () => {
    // ⚠️ The cast is the finding, not a shortcut. `labyrinthModule` is declared as `GameModule<…>`, so its
    // `createGame` is typed by **kernel contract 1** — `players: { name }[]`, with nowhere to put a colour.
    // The implementation behind it already accepts one (`NewGameOptions`), so the wiring is proven ready
    // here and the day the kernel carries picks through, nothing in this package changes. Until then a host
    // that has picks must call the barrel's `newLabyrinthGame` instead. See `docs/d2c-findings.md` §16.
    const create = labyrinthModule.createGame as (opts: NewGameOptions) => LabyrinthState;
    const game = create({ id: 'g', players: [{ name: 'Ann', color: 'blue' }, { name: 'Bob' }], rng: rng() });
    expect(game.players.map((player) => player.color)).toEqual(['blue', 'red']);
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
