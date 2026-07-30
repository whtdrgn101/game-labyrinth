import { vi } from 'vitest';
import { applyAction, createGame, viewFor } from '../../engine';
import type { Action, LabyrinthState, LabyrinthView, Position, TreasureName, Viewer } from '../../engine';
import type { BoardProps } from '../types';

/**
 * Fixtures for the board's component tests.
 *
 * Two rules the fixtures follow, both of which make these tests worth having rather than tautological:
 *
 * - **A view is always produced by the real `viewFor`.** Hand-writing a `LabyrinthView` literal would let a
 *   test assert against a projection the engine would never emit (a `stack` of three cards, say). Every
 *   fixture here plays a real seeded game and then projects it for a real viewer, so the board is exercised
 *   against exactly what a host would hand it.
 * - **States are advanced by real actions** (`applyAction`) wherever a real action can reach them. Only the
 *   ended state is assembled by hand: reaching it honestly takes a whole 40-turn game, which is the module
 *   suite's job, not the board's.
 */

/**
 * mulberry32 — a deterministic PRNG, so a seeded setup is reproducible tile-for-tile.
 *
 * ⚠️ A **third** copy in this repo (engine tests, module tests, here). The kernel publishes `mulberry32`, but
 * only on `@game-hub/kernel/bot`, and pulling the *bot* subpath into a client test would be the wrong layer.
 * See `docs/d2c-findings.md` §13 — this is the finding, restated by a slice that hit it again.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh seeded game. Seat ids are `p1`…`pN` (`createGame`). */
export function seededGame(seed = 7, names: readonly string[] = ['Ann', 'Bob']): LabyrinthState {
  return createGame({ id: 'g1', players: names.map((name) => ({ name })), rng: mulberry32(seed) });
}

/** Apply an action for whichever seat is on the clock. */
export function play(state: LabyrinthState, action: Action): LabyrinthState {
  const active = state.players[state.activePlayerIndex]!;
  return applyAction(state, active.id, action);
}

/** The active seat's square — the one "stay put" targets (ruling 11). */
export function activeSquare(state: LabyrinthState): Position {
  return state.players[state.activePlayerIndex]!.position;
}

/**
 * A game one whole turn in: seat 1 slid at the north arrow of line 1 and stayed put, so seat 2 is on the
 * clock, the phase is back to `insert`, and `lastPush` bans exactly one arrow — the south arrow of line 1
 * (pg. 2, "The only exception").
 */
export function afterOneTurn(seed = 7): LabyrinthState {
  const start = seededGame(seed);
  const slid = play(start, { type: 'INSERT', insertion: { side: 'north', line: 1 }, rotation: 0 });
  return play(slid, { type: 'MOVE', target: activeSquare(slid) });
}

/** A game mid-turn: the maze has been slid, so the board is showing the flood-fill and "stay put". */
export function readyToMove(seed = 7): LabyrinthState {
  return play(seededGame(seed), { type: 'INSERT', insertion: { side: 'north', line: 1 }, rotation: 0 });
}

/** A finished game — assembled by hand (see the note at the top of this file). */
export function endedGame(seed = 7, winnerId = 'p1'): LabyrinthState {
  return { ...seededGame(seed), status: 'ended', winnerIds: [winnerId] };
}

/** Give a seat a known face-down stack, so a test can name the treasure the board should be showing. */
export function withStack(state: LabyrinthState, playerId: string, stack: readonly TreasureName[]): LabyrinthState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? { ...player, stack } : player)),
  };
}

/** Put a seat's pawn on a square without playing there. */
export function withPawnAt(state: LabyrinthState, playerId: string, position: Position): LabyrinthState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? { ...player, position } : player)),
  };
}

/** Project a state the way a host would, for one viewer (`null` ⇒ spectator, an array ⇒ hotseat). */
export function view(state: LabyrinthState, viewer: Viewer = null): LabyrinthView {
  return viewFor(state, viewer);
}

/** The props the shell hands a board, with the spies a test wants. `guard` runs its work straight through. */
export function boardProps(game: LabyrinthView, overrides: Partial<BoardProps<LabyrinthView>> = {}) {
  const props: BoardProps<LabyrinthView> = {
    gameId: 'g1',
    game,
    bots: [],
    colors: {},
    controlledIds: null,
    viewer: undefined,
    busy: false,
    guard: (work) => work(),
    onPayload: vi.fn(),
    onLeave: vi.fn(),
    lastMessage: null,
    ...overrides,
  };
  return props;
}
