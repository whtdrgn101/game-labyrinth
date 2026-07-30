import { makeSeating } from '@game-hub/kernel';
import { GameError } from '../core';
import type { LabyrinthPlayer } from '../core';

// Seat helpers, shared from the kernel but bound to Labyrinth's own `GameError` subclass so a
// PLAYER_NOT_FOUND stays `instanceof` the class the host's `mapError` branches on (see the kernel's
// `makeSeating` note: a kernel-thrown base error would silently become a 500 instead of a 404).
export const { seatOf, withPlayer, activePlayer } = makeSeating<LabyrinthPlayer>((playerId) => {
  throw new GameError('PLAYER_NOT_FOUND', `No player with id "${playerId}"`);
});
