import { applyAction, getGame } from '@game-hub/ui-kit';
import type { GamePayload } from '@game-hub/kernel/client';
import type { LabyrinthState } from '../engine';

/**
 * The board's REST calls, with the view type pinned once so nothing downstream sees an `unknown`.
 *
 * The ui-kit's helpers are generic in the view type and build their URLs from the base the *host* injected
 * at boot (`configureTransport`) — a game package must never hard-code an API prefix, and must never call
 * `configureTransport` itself. That injection is why the same published package works behind the hub's dev
 * proxy and at an origin root.
 *
 * ⚠️ `LabyrinthState` stands in for the redacted view type until L3 defines `viewFor` (which will hide every
 * player's face-down stack except the viewer's own top card, pg. 2). At that point the projection type
 * replaces it here and the board keeps compiling against one name.
 */
export type LabyrinthView = LabyrinthState;

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
