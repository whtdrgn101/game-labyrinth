import { describe, expect, it } from 'vitest';
import type { LabyrinthState, LabyrinthView } from '../../engine';
import { labyrinthModule } from '../index';
import { entitledTreasures, mulberry32, namedTreasures, seats } from './helpers';

/** A game at `count` seats, opened through the module the way a host does. */
function game(count: number, seed = 5): LabyrinthState {
  return labyrinthModule.createGame({
    id: `g${String(count)}`,
    players: seats(count).map((name) => ({ name })),
    rng: mulberry32(seed),
  });
}

/** The module's projection, typed — the contract returns `unknown`, and this is the one place that lands. */
const view = (state: LabyrinthState, viewer: string | readonly string[] | null): LabyrinthView =>
  labyrinthModule.viewFor(state, viewer) as LabyrinthView;

describe('module viewFor — the whole-object leak test', () => {
  it('names no treasure a viewer isn’t entitled to, at 2, 3 and 4 seats', () => {
    for (const count of [2, 3, 4]) {
      const state = game(count);
      for (const seat of state.players) {
        // The scan reads the *entire* serialized projection (minus the face-up board and extra tile, which
        // are printed data) — not a `stack` spot-check — because the failure worth catching is a field
        // added later that quietly ships someone's pile.
        expect([...namedTreasures(view(state, seat.id))].sort()).toEqual(entitledTreasures(state, seat.id));
        // At the opening that is exactly one card: your own next target, and nothing else in the game.
        expect(namedTreasures(view(state, seat.id))).toEqual([seat.stack[0]]);
      }
    }
  });

  it('names nothing at all for a spectator or a client holding no seat', () => {
    const state = game(4);
    expect(namedTreasures(view(state, null))).toEqual([]);
    expect(namedTreasures(view(state, []))).toEqual([]);
    expect(namedTreasures(view(state, 'not-a-seat'))).toEqual([]);
  });

  it('names both top cards for a hotseat client holding two seats', () => {
    const state = game(4);
    const expected = [state.players[0]!.stack[0], state.players[2]!.stack[0]].sort();
    expect([...namedTreasures(view(state, ['p1', 'p3']))].sort()).toEqual(expected);
  });

  it('publishes the count of every pile, including the viewer’s own', () => {
    const state = game(3);
    const projected = view(state, 'p2');
    expect(projected.players.map((player) => player.stackCount)).toEqual([8, 8, 8]);
    // …while `stack` carries at most the one card its holder may look at (pg. 2).
    expect(projected.players.map((player) => player.stack?.length ?? null)).toEqual([null, 1, null]);
  });
});

describe('module viewFor — the ended game', () => {
  it('reveals every pile once someone has won', () => {
    // Hand-built rather than played: an empty stack on its own home corner is the win (pg. 2), and this
    // test is about the projection, not about getting there.
    const state = game(2);
    const staged: LabyrinthState = {
      ...state,
      players: state.players.map((player, seat) =>
        seat === 0 ? { ...player, stack: [], found: [...player.stack] } : player,
      ),
      status: 'ended',
      winnerIds: ['p1'],
    };
    const spectator = view(staged, null);
    expect(spectator.players[1]!.stack).toEqual(staged.players[1]!.stack);
    expect([...namedTreasures(spectator)].sort()).toEqual(entitledTreasures(staged, null));
    expect(spectator.status).toBe('ended');
    if (spectator.status !== 'ended') throw new Error('unreachable');
    expect(spectator.winnerIds).toEqual(['p1']);
  });
});

describe('module viewFor — the wire shape', () => {
  it('is JSON, exactly — what the projection says is what the client receives', () => {
    const state = game(4);
    const projected = view(state, 'p2');
    const wire = JSON.parse(JSON.stringify(projected)) as LabyrinthView;

    expect(wire).toEqual(projected);
    // Nothing vanished into `undefined` on the way: a hidden pile is a real `null` on the wire, and the
    // full 7×7 maze is there for the board to draw.
    expect(wire.players[0]!.stack).toBeNull();
    expect(wire.players[1]!.stack).toHaveLength(1);
    expect(wire.board).toHaveLength(7);
    expect(wire.board.every((row) => row.length === 7)).toBe(true);
    expect(wire.extraTile.id).toBe(state.extraTile.id);
    expect(wire.viewerId).toBe('p2');
    // And the invariant survives the round trip — the scan is of the wire, not of the in-process object.
    expect([...namedTreasures(wire)].sort()).toEqual(entitledTreasures(state, 'p2'));
  });

  it('carries no field the state has that a client shouldn’t see', () => {
    // The projection is built field by field (`engine/view.ts`), so its key set is a decision, not a
    // side-effect. Pinning it here means adding a state field can never widen a view by accident.
    expect(Object.keys(view(game(2), 'p1')).sort()).toEqual(
      [
        'activePlayerIndex',
        'board',
        'extraTile',
        'id',
        'lastPush',
        'log',
        'phase',
        'players',
        'status',
        'turn',
        'version',
        'viewerId',
      ].sort(),
    );
    expect(Object.keys(view(game(2), 'p1').players[0]!).sort()).toEqual(
      ['color', 'found', 'id', 'name', 'position', 'stack', 'stackCount'].sort(),
    );
  });
});
