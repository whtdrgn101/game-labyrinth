import { applyAction, getGame } from '@game-hub/ui-kit';
import type { GamePayload } from '@game-hub/kernel/client';
import type { Action, LabyrinthView } from '../engine/index.js';

/**
 * The board's REST calls, with the view type pinned once so nothing downstream sees an `unknown`.
 *
 * The ui-kit's helpers are generic in the view type and build their URLs from the base the *host* injected
 * at boot (`configureTransport`) — a game package must never hard-code an API prefix, and must never call
 * `configureTransport` itself. That injection is why the same published package works behind the hub's dev
 * proxy and at an origin root.
 *
 * ⚠️ The pinned type is the engine's **view** (L3), never `LabyrinthState`: a board is only ever handed what
 * `viewFor` projected for this client's seats — every other player's face-down stack redacted to a count,
 * and the client's own to its top card (pg. 2). Re-exported from here so the board names one type, and so
 * reaching for the un-redacted state type is a visible mistake rather than a convenient shortcut.
 */
export type { LabyrinthView } from '../engine/index.js';

/** The game type id this client speaks. Matches the backend module's `id` and the row's `game_type`. */
export const GAME_TYPE = 'labyrinth';

/** A Labyrinth game payload, with its state pinned to the redacted view. */
export type LabyrinthPayload = GamePayload<LabyrinthView>;

/** Fetch a game's current state, projected for `viewer`'s seats. */
export function fetchGame(gameId: string, viewer?: string): Promise<GamePayload<LabyrinthView>> {
  return getGame<LabyrinthView>(gameId, viewer);
}

/**
 * Send one action for `playerId`. `expectedVersion` is the platform's optimistic-concurrency guard — pass
 * the version the board acted against so a lost race refetches instead of erroring.
 */
export function sendAction(
  gameId: string,
  playerId: string,
  action: unknown,
  viewer?: string,
  expectedVersion?: number,
): Promise<GamePayload<LabyrinthView>> {
  return applyAction<LabyrinthView>(gameId, playerId, action, viewer, expectedVersion);
}

/**
 * The board's own send: the same call as `sendAction`, but typed to the engine's `Action` union so an
 * `INSERT`/`MOVE` built in the UI is checked against the two shapes `parseAction` will accept (L3) rather
 * than posted as an `unknown`. There is no Labyrinth-specific *route* — every action is a free player choice
 * (all the randomness is spent at setup), so the opaque `/actions` endpoint is the whole surface.
 */
export function act(
  gameId: string,
  playerId: string,
  action: Action,
  viewer?: string,
  expectedVersion?: number,
): Promise<LabyrinthPayload> {
  return sendAction(gameId, playerId, action, viewer, expectedVersion);
}
