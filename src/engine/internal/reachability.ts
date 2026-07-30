import { BOARD_SIZE, DIRECTIONS } from '../core/index.js';
import type { Board, Direction, Position } from '../core/index.js';
import { tileAt } from './board.js';
import { neighbor, openings, opposite, samePosition } from './geometry.js';

/**
 * Whether `position` names a real square of the 7×7 board. Integer-checked as well as bounded, because
 * a target square arrives from a client payload: `{ row: 1.5, col: 0 }` is not a square, and letting it
 * through would index the board with a fractional index and read `undefined`.
 *
 * `neighbor` is deliberately unclamped (see `geometry.ts`), so this is the guard that stops the flood-fill
 * walking off the edge — and it is what separates the two ways a `MOVE` target can be wrong: a square that
 * doesn't exist (`INVALID_POSITION`, a payload mistake) from a real square you can't get to
 * (`UNREACHABLE`, a rules mistake).
 */
export function isOnBoard(position: Position): boolean {
  return (
    Number.isInteger(position.row) &&
    Number.isInteger(position.col) &&
    position.row >= 0 &&
    position.row < BOARD_SIZE &&
    position.col >= 0 &&
    position.col < BOARD_SIZE
  );
}

/**
 * Whether a piece can step from `from` one square in `direction` — the atom of movement, and the whole
 * of "connected" in this game.
 *
 * Two adjacent squares connect only when **both** tiles face each other: `from`'s tile must be open on
 * `direction` and the neighbour's tile open on `opposite(direction)`. A corridor that runs into a wall is
 * not a path, however open the first tile is. (pg. 2, "You can occupy any square that you can move your
 * piece to directly, without interruption" — the maze's walls are the interruption.)
 *
 * Pawns are not consulted: the rulebook has no occupancy rule, and pieces share squares (ROADMAP digest).
 */
export function connects(board: Board, from: Position, direction: Direction): boolean {
  const to = neighbor(from, direction);
  if (!isOnBoard(to)) return false;
  const here = tileAt(board, from);
  const there = tileAt(board, to);
  return (
    openings(here.shape, here.rotation).includes(direction) &&
    openings(there.shape, there.rotation).includes(opposite(direction))
  );
}

const squareKey = (position: Position): string => `${position.row},${position.col}`;

/**
 * Every square a piece standing on `origin` may occupy this turn: a breadth-first flood-fill over
 * `connects`, i.e. along the maze's open corridors, for as far as they run (pg. 2, "You can move your
 * playing piece as far as you like").
 *
 * **`origin` is always in the result.** "Or, you can leave your playing piece where it is" (pg. 2) — staying
 * put is a legal move rather than a skipped one, so it is expressed as a move to the square you are already
 * on and needs no separate action (ROADMAP ruling 11).
 *
 * Returned in **reading order** (row, then column) — the same order `buildBoard` fills the board in. The
 * order is arbitrary but **stable and origin-independent**, which matters because it is the order
 * `legalActions` offers moves in, and therefore the order the UI lays out highlights and a seeded bot
 * enumerates candidates in. Bounded by the board: never more than 49 squares.
 *
 * `origin` must be a square on the board — every caller passes a pawn's position, which always is one.
 */
export function reachableFrom(board: Board, origin: Position): readonly Position[] {
  const seen = new Set<string>([squareKey(origin)]);
  const queue: Position[] = [origin];
  for (let i = 0; i < queue.length; i += 1) {
    const square = queue[i]!;
    for (const direction of DIRECTIONS) {
      if (!connects(board, square, direction)) continue;
      const next = neighbor(square, direction);
      if (seen.has(squareKey(next))) continue;
      seen.add(squareKey(next));
      queue.push(next);
    }
  }
  return queue.sort((a, b) => a.row - b.row || a.col - b.col);
}

/**
 * Whether a piece on `origin` may move to `target` this turn. An off-board `target` is simply never in the
 * flood-fill's output, so this needs no bounds check of its own — but a caller that wants to *tell the two
 * apart* (the `MOVE` action does) tests `isOnBoard` first.
 */
export function isReachable(board: Board, origin: Position, target: Position): boolean {
  return reachableFrom(board, origin).some((square) => samePosition(square, target));
}
