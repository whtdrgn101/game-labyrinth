import { applyAction, getGame } from '@game-hub/ui-kit';
import type { GamePayload } from '@game-hub/kernel/client';
import type { LabyrinthView } from '../engine';

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
export type { LabyrinthView } from '../engine';

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
