import { GameError as KernelGameError } from '@game-hub/kernel';

/** Machine-readable reasons a Labyrinth action can be rejected. The backend maps these to HTTP 4xx. */
export type LabyrinthErrorCode =
  | 'INVALID_PLAYER_COUNT'
  | 'PLAYER_NOT_FOUND'
  | 'NOT_YOUR_TURN'
  | 'GAME_OVER'
  // The action doesn't fit the current half of the turn: the maze must be moved before the pawn (pg. 2).
  | 'WRONG_PHASE'
  // Not one of the 12 arrows (pg. 2), or the one insertion that undoes the last push ("The only exception").
  | 'ILLEGAL_INSERTION'
  // The extra tile was turned to something that isn't one of its four orientations. Separate from
  // ILLEGAL_INSERTION because it is a different mistake: the arrow was fine, the tile's facing was not —
  // and the host's `parseAction` (L3) wants to tell a client which half of its payload was wrong.
  | 'INVALID_ROTATION'
  // The move target isn't a square of the 7×7 board at all (off the edge, or not a whole number). The
  // same shape-before-rules split as INVALID_ROTATION vs ILLEGAL_INSERTION: a payload that doesn't name a
  // square is a different mistake from one that names a square you can't get to.
  | 'INVALID_POSITION'
  // The target square isn't reachable along connected paths from where the pawn stands (pg. 2).
  | 'UNREACHABLE';

/**
 * Thrown when a Labyrinth action is illegal. The shared kernel `GameError` carries the `code`/`message`
 * machinery; this subclass pins `code` to Labyrinth's own union so a thrown code is always one the game
 * declares (the pattern every Game Hub game uses).
 *
 * ⚠️ It matters that this is the *subclass*: the host's `mapError` does `instanceof` against it to turn a
 * PLAYER_NOT_FOUND into a 404 rather than a 500, which is why `internal/players.ts` injects this class
 * into the kernel's `makeSeating` instead of letting the kernel throw its base error.
 */
export class GameError extends KernelGameError<LabyrinthErrorCode> {}
