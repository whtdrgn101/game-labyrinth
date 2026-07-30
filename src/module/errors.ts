import { GameError } from '../engine';
import type { LabyrinthErrorCode } from '../engine';
import type { ErrorResponse } from '@game-hub/kernel';

/**
 * Every Labyrinth error code's HTTP status, as a **total** record — so a code added to
 * `LabyrinthErrorCode` later fails to compile until someone decides what it means on the wire, rather than
 * quietly falling into a catch-all `: 409`.
 *
 * The three-way split is the hub's house shape (Container's `errors.ts` states it; all five hosted games
 * follow it):
 *
 * - **404** — the thing you named doesn't exist (an unknown player).
 * - **400** — the request could never be valid, in any game, at any moment: a seat count the game doesn't
 *   support, a pawn colour that isn't one of the four, a rotation that isn't one of the four facings, a
 *   target that isn't a square. These are the *payload* half of the engine's shape-before-rules split, and
 *   `parseAction` normally catches them first — they reach here only via a caller that skipped it.
 * - **409** — a well-formed move this state refuses: acting out of turn, moving your piece before the maze
 *   (pg. 2 "Important"), putting the tile back where it just came out (pg. 2 "The only exception"), or
 *   walking somewhere no corridor leads. The move is conceivable; this position won't have it.
 *
 * ⚠️ 409 rather than 422 for that last group, which is a deliberate call and not the obvious one: 422
 * ("well-formed but semantically wrong") reads like a better fit for `UNREACHABLE`. The platform has never
 * emitted a 422 for any of its five games — a rules refusal is a 409 everywhere — and an out-of-repo game
 * is the last place that should invent a new status class for the shared client to learn. Recorded as
 * ROADMAP ruling 13.
 */
const STATUS: Readonly<Record<LabyrinthErrorCode, number>> = {
  PLAYER_NOT_FOUND: 404,

  INVALID_PLAYER_COUNT: 400,
  INVALID_PLAYER_COLOR: 400,
  INVALID_ROTATION: 400,
  INVALID_POSITION: 400,

  NOT_YOUR_TURN: 409,
  GAME_OVER: 409,
  WRONG_PHASE: 409,
  ILLEGAL_INSERTION: 409,
  UNREACHABLE: 409,
};

/**
 * Map a Labyrinth domain error onto HTTP. `null` ⇒ not ours, so the host lets it bubble to a 500 rather
 * than dressing an unrelated failure up as a client mistake.
 *
 * ⚠️ The `instanceof` is against **this package's** `GameError` subclass, never the kernel base. A base
 * `GameError` thrown by something else would otherwise be labelled with whatever status its `code` string
 * happened to collide with — and, the other way round, the kernel's `makeSeating` is injected with this
 * subclass (`internal/players.ts`) precisely so a `PLAYER_NOT_FOUND` raised inside the *kernel* still lands
 * here as a 404 instead of a 500.
 */
export function mapLabyrinthError(error: unknown): ErrorResponse | null {
  if (!(error instanceof GameError)) return null;
  return { status: STATUS[error.code], code: error.code, message: error.message };
}
