import { makeSeating } from '@game-hub/kernel';
import { GameError, SEAT_COLORS } from '../core/index.js';
import type { LabyrinthPlayer, PlayerColor } from '../core/index.js';

/**
 * Is this one of the four pawn colours (pg. 1 Set Up)? The single runtime definition of a legal colour,
 * read straight off `SEAT_COLORS` so the predicate cannot drift from the list.
 *
 * It exists because a colour arrives **off the wire** — the lobby collects a player's pick and the module
 * hands it through unvalidated on purpose, so that "which colours exist" is defined in exactly one place
 * (the same shape-then-rules split `parseAction` keeps with the engine).
 */
export function isPlayerColor(value: unknown): value is PlayerColor {
  return typeof value === 'string' && (SEAT_COLORS as readonly string[]).includes(value);
}

// Seat helpers, shared from the kernel but bound to Labyrinth's own `GameError` subclass so a
// PLAYER_NOT_FOUND stays `instanceof` the class the host's `mapError` branches on (see the kernel's
// `makeSeating` note: a kernel-thrown base error would silently become a 500 instead of a 404).
export const { seatOf, withPlayer, activePlayer } = makeSeating<LabyrinthPlayer>((playerId) => {
  throw new GameError('PLAYER_NOT_FOUND', `No player with id "${playerId}"`);
});
