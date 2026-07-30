import { describe, expect, it } from 'vitest';
import { START_CORNERS, TREASURES } from '../core';
import type { LabyrinthState, TreasureName } from '../core';
import { move } from '../actions';
import { viewFor } from '../view';
import { mazeBoard, newGame, readyToMove, seats, seededGame, withBoard, withPawnAt, withStack } from './helpers';

/** One north–south corridor down column 0 (red's home is at its top) — the same fixture `move` tests on. */
const CORRIDOR = mazeBoard(['│──────', '│──────', '│──────', '│──────', '│──────', '│──────', '│──────']);

/** A finished game: seat 0 walks home with an empty stack, which is the win (pg. 2, "Ending the Game"). */
function endedGame(): LabyrinthState {
  const staged = withStack(withPawnAt(readyToMove(withBoard(newGame(), CORRIDOR)), 'p1', { row: 4, col: 0 }), 'p1', []);
  const after = move(staged, 'p1', START_CORNERS.red);
  expect(after.status).toBe('ended');
  return after;
}

describe('viewFor — the viewer’s own seat (pg. 2)', () => {
  it('shows the top card and nothing beneath it — a player is redacted from himself', () => {
    const game = seededGame(1);
    const own = game.players[0]!;
    const view = viewFor(game, 'p1');

    // "Each player looks at the first card of his stack of treasure cards without showing it" (pg. 2) — the
    // *first* card. A player may not fan out his own pile, in the UI or in the network tab.
    expect(view.players[0]!.stack).toEqual([own.stack[0]]);
    expect(view.players[0]!.stack).toHaveLength(1);
    expect(own.stack.length).toBe(12);
  });

  it('still publishes how many cards are face down — the pile is countable at the table', () => {
    const view = viewFor(seededGame(1), 'p1');
    expect(view.players[0]!.stackCount).toBe(12);
    expect(view.players[1]!.stackCount).toBe(12);
  });

  it('shows an empty array, not a card, once every card is flipped', () => {
    const game = withStack(seededGame(1), 'p1', []);
    expect(viewFor(game, 'p1').players[0]!.stack).toEqual([]);
    expect(viewFor(game, 'p1').players[0]!.stackCount).toBe(0);
  });

  it('serves a client holding several seats (hotseat) — each of its own seats, and only those', () => {
    const game = seededGame(2, seats(3));
    const view = viewFor(game, ['p1', 'p3']);
    expect(view.players[0]!.stack).toHaveLength(1);
    expect(view.players[1]!.stack).toBeNull();
    expect(view.players[2]!.stack).toHaveLength(1);
  });
});

describe('viewFor — every other seat', () => {
  it('replaces the stack with null, never a truncated or blanked-out array', () => {
    const view = viewFor(seededGame(3, seats(4)), 'p2');
    expect(view.players[0]!.stack).toBeNull();
    expect(view.players[2]!.stack).toBeNull();
    expect(view.players[3]!.stack).toBeNull();
    // `null` is a different type from an array on purpose: "hidden" can never be misread as "empty".
    expect(view.players[1]!.stack).toHaveLength(1);
  });

  it('gives a spectator (null viewer) nobody’s cards at all', () => {
    const view = viewFor(seededGame(4, seats(3)), null);
    expect(view.players.map((player) => player.stack)).toEqual([null, null, null]);
    expect(view.players.map((player) => player.stackCount)).toEqual([8, 8, 8]);
  });

  it('gives a seatless client (empty array) the same', () => {
    const view = viewFor(seededGame(4, seats(3)), []);
    expect(view.players.map((player) => player.stack)).toEqual([null, null, null]);
  });

  it('gives an unknown viewer id nothing — it holds no seat', () => {
    const view = viewFor(seededGame(4), 'p9');
    expect(view.players.map((player) => player.stack)).toEqual([null, null]);
  });

  it('publishes the face-up pile of found treasures (pg. 2)', () => {
    const game = seededGame(5);
    const found: readonly TreasureName[] = ['ruby', 'crown'];
    const withFound: LabyrinthState = {
      ...game,
      players: game.players.map((player, seat) => (seat === 1 ? { ...player, found } : player)),
    };
    expect(viewFor(withFound, 'p1').players[1]!.found).toEqual(found);
  });
});

describe('viewFor — the ended game', () => {
  it('reveals every stack once the game is over', () => {
    const game = endedGame();
    const view = viewFor(game, 'p1');
    // Seat 1 never played, so its whole 12-card pile is still face down — and now visible to everyone.
    expect(view.players[1]!.stack).toEqual(game.players[1]!.stack);
    expect(view.players[1]!.stack).toHaveLength(12);
    expect(view.players[1]!.stackCount).toBe(12);
  });

  it('reveals them to a spectator too', () => {
    const game = endedGame();
    expect(viewFor(game, null).players[1]!.stack).toEqual(game.players[1]!.stack);
  });

  it('carries the winner through, on the ended arm of the union', () => {
    const view = viewFor(endedGame(), 'p1');
    expect(view.status).toBe('ended');
    if (view.status !== 'ended') throw new Error('unreachable');
    expect(view.winnerIds).toEqual(['p1']);
  });
});

describe('viewFor — what is public', () => {
  it('passes the table through verbatim: board, extra tile, last push, pawns, phase, turn, log', () => {
    const game = seededGame(6, seats(3));
    const view = viewFor(game, 'p2');

    // Identity, not equality: the maze is the very object the engine holds — no copy to drift, and nothing
    // in it is secret (the treasures are *printed* on the tiles, face up, pg. 1 Set Up).
    expect(view.board).toBe(game.board);
    expect(view.extraTile).toBe(game.extraTile);
    expect(view.log).toBe(game.log);
    expect(view.lastPush).toBe(game.lastPush);
    expect(view.id).toBe(game.id);
    expect(view.turn).toBe(game.turn);
    expect(view.phase).toBe(game.phase);
    expect(view.activePlayerIndex).toBe(game.activePlayerIndex);
    expect(view.version).toBe(game.version);
    expect(view.status).toBe('active');
    for (const [seat, player] of game.players.entries()) {
      expect(view.players[seat]!.id).toBe(player.id);
      expect(view.players[seat]!.name).toBe(player.name);
      expect(view.players[seat]!.color).toBe(player.color);
      expect(view.players[seat]!.position).toEqual(player.position);
    }
  });

  it('echoes the viewer back, so a client knows which seats it holds', () => {
    expect(viewFor(seededGame(7), 'p1').viewerId).toBe('p1');
    expect(viewFor(seededGame(7), ['p1', 'p2']).viewerId).toEqual(['p1', 'p2']);
    expect(viewFor(seededGame(7), null).viewerId).toBeNull();
  });

  it('never mutates the state it projects', () => {
    const game = seededGame(8, seats(4));
    const before = structuredClone(game);
    viewFor(game, 'p1');
    viewFor(game, null);
    expect(game).toEqual(before);
  });
});

describe('viewFor — the leak invariant', () => {
  /**
   * Every treasure name appearing anywhere in the view **except** on the board and the extra tile, which are
   * face-up printed data (pg. 1 Set Up). This is the honest form of "does the projection leak?": the secret
   * was never *which* treasures exist — all 24 are printed on the maze for anyone to see — it is **who holds
   * which card**. So the scan strips the two public tile-bearing fields and reads everything else, whole,
   * rather than spot-checking `stack`: the failure this is built to catch is a *new* field shipping the pile.
   */
  function treasuresOutsideTheBoard(view: unknown): Set<TreasureName> {
    const { board: _board, extraTile: _extraTile, ...rest } = view as Record<string, unknown>;
    const serialized = JSON.stringify(rest);
    return new Set(TREASURES.filter((treasure) => serialized.includes(`"${treasure}"`)));
  }

  it('names only the viewer’s own top card, at every seat count', () => {
    for (const count of [2, 3, 4]) {
      const game = seededGame(20 + count, seats(count));
      for (const viewer of game.players) {
        const visible = treasuresOutsideTheBoard(viewFor(game, viewer.id));
        expect([...visible]).toEqual([viewer.stack[0]]);
      }
    }
  });

  it('names nothing at all for a spectator', () => {
    const game = seededGame(24, seats(4));
    expect(treasuresOutsideTheBoard(viewFor(game, null)).size).toBe(0);
  });

  it('grows to exactly found + own top card as the game is played', () => {
    // Seat 0 has found two treasures (public, face up beside the pile, pg. 2) and hunts a third.
    const game = seededGame(25, seats(3));
    const own = game.players[0]!;
    const played: LabyrinthState = {
      ...game,
      players: game.players.map((player, seat) =>
        seat === 0 ? { ...player, found: player.stack.slice(0, 2), stack: player.stack.slice(2) } : player,
      ),
    };
    const visible = treasuresOutsideTheBoard(viewFor(played, 'p1'));
    expect([...visible].sort()).toEqual([own.stack[0], own.stack[1], own.stack[2]].sort());
  });

  it('reveals everything only once the game has ended', () => {
    const game = endedGame();
    const visible = treasuresOutsideTheBoard(viewFor(game, 'p2'));
    // Every card either seat still holds is face up now — seat 1 reads seat 0's pile and vice versa.
    const held = game.players.flatMap((player) => [...player.stack, ...player.found]);
    expect([...visible].sort()).toEqual([...held].sort());
    expect(held.length).toBeGreaterThan(0);
  });

  it('survives a JSON round trip — a view is exactly what goes on the wire', () => {
    const game = seededGame(26, seats(4));
    const view = viewFor(game, 'p3');
    const wire = JSON.parse(JSON.stringify(view)) as typeof view;
    expect(wire).toEqual(view);
    expect(treasuresOutsideTheBoard(wire)).toEqual(treasuresOutsideTheBoard(view));
    // Nothing serializes to `undefined` and silently vanishes: a redacted stack is a real `null` on the wire.
    expect(wire.players[0]!.stack).toBeNull();
    expect(wire.players[2]!.stack).toHaveLength(1);
  });
});
