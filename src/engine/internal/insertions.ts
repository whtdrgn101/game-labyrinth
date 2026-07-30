import { BOARD_SIZE, DIRECTIONS, SLIDE_LINES } from '../core';
import type { Insertion, LabyrinthState, Position } from '../core';
import { neighbor, opposite } from './geometry';

/**
 * The 12 arrows (pg. 2, "There are 12 arrows along the edge of the board. They are marking the rows where
 * you can insert the path tile into the maze"): the 4 sides × the 3 movable lines. Every even line holds
 * fixed tiles, which is exactly why only the odd ones carry an arrow.
 *
 * The order — all of `north`, then `east`, `south`, `west`, each ascending by line — is arbitrary but
 * **stable**, because it is what `legalInsertions` returns and therefore the order the UI lays arrows out
 * in and a bot enumerates candidates in. A seeded bot game replays identically only while it holds.
 */
export const INSERTIONS: readonly Insertion[] = DIRECTIONS.flatMap((side) =>
  SLIDE_LINES.map((line): Insertion => ({ side, line })),
);

/** Whether two arrows are the same arrow. */
export function sameInsertion(a: Insertion, b: Insertion): boolean {
  return a.side === b.side && a.line === b.line;
}

/** Whether `candidate` is one of the 12 arrows at all — the guard against a line/side off the board. */
export function isInsertionPoint(candidate: Insertion): boolean {
  return INSERTIONS.some((arrow) => sameInsertion(arrow, candidate));
}

/**
 * The square the extra tile lands on: just inside the board at the arrow's own edge. `line` is a *column*
 * for the north/south arrows and a *row* for the east/west ones — the arrow points across the board, so
 * the line it marks is the one perpendicular to its edge.
 */
export function entrySquare(insertion: Insertion): Position {
  const last = BOARD_SIZE - 1;
  switch (insertion.side) {
    case 'north':
      return { row: 0, col: insertion.line };
    case 'south':
      return { row: last, col: insertion.line };
    case 'west':
      return { row: insertion.line, col: 0 };
    case 'east':
      return { row: insertion.line, col: last };
  }
}

/**
 * The 7 squares of the line, from the square the tile enters on to the one it falls off — i.e. in the
 * direction the maze actually travels, which is `opposite(side)` (push at the north arrow and the column
 * moves south). Walking the line rather than indexing it keeps rows and columns a single code path.
 */
export function linePath(insertion: Insertion): readonly Position[] {
  const travel = opposite(insertion.side);
  const path: Position[] = [entrySquare(insertion)];
  for (let i = 1; i < BOARD_SIZE; i += 1) path.push(neighbor(path[i - 1]!, travel));
  return path;
}

/** The square whose tile is pushed off the board — the far end of the line (pg. 2). */
export function exitSquare(insertion: Insertion): Position {
  return linePath(insertion)[BOARD_SIZE - 1]!;
}

/**
 * The arrow that would undo `lastPush` — the one insertion the rules forbid: "The path tile cannot be
 * inserted back into the board at the same place where it was pushed out" (pg. 2, "The only exception").
 *
 * A push always ejects at the far end of the line it travelled, so "where it was pushed out" is the arrow
 * on the **same line, opposite side**. `null` before anything has been pushed.
 */
export function reverseOf(lastPush: Insertion | null): Insertion | null {
  return lastPush === null ? null : { side: opposite(lastPush.side), line: lastPush.line };
}

/**
 * The arrows the active player may use right now: all 12 on the first turn (nothing has been pushed out
 * yet), and 11 thereafter — every arrow except the one that would shove the extra tile straight back
 * where it came from (pg. 2). The single source of that rule, so the UI's arrow affordances and the bot's
 * candidate list can never drift from what `insert` will accept.
 */
export function legalInsertions(state: LabyrinthState): readonly Insertion[] {
  const banned = reverseOf(state.lastPush);
  return banned === null ? INSERTIONS : INSERTIONS.filter((arrow) => !sameInsertion(arrow, banned));
}

/** Whether this exact insertion is legal in this state: a real arrow, and not the forbidden reverse. */
export function isLegalInsertion(state: LabyrinthState, candidate: Insertion): boolean {
  if (!isInsertionPoint(candidate)) return false;
  return legalInsertions(state).some((arrow) => sameInsertion(arrow, candidate));
}
