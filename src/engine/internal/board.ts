import { BOARD_SIZE, FIXED_TILES } from '../core/index.js';
import type { Board, FixedTileSpec, Position, Tile } from '../core/index.js';

const squareKey = (row: number, col: number): string => `${row},${col}`;

/** The 16 printed tiles, keyed by square so board assembly is a lookup rather than a scan. */
const FIXED_BY_SQUARE: ReadonlyMap<string, FixedTileSpec> = new Map(
  FIXED_TILES.map((spec) => [squareKey(spec.position.row, spec.position.col), spec]),
);

/** The tile standing on `position`. Callers stay inside the board — there is no wrapping. */
export function tileAt(board: Board, position: Position): Tile {
  return board[position.row]![position.col]!;
}

/**
 * Assemble the 7×7 maze: the 16 printed tiles on their own squares, and `placed` — the 33 shuffled loose
 * tiles, already carrying their drawn rotation — filling the empty squares in reading order (pg. 1 Set Up,
 * "place them face up on the empty spaces of the game board").
 *
 * `placed` must hold exactly the 33 tiles the empty squares need; `createGame` is the only caller and slices
 * them off the shuffled deck, so this helper does no counting of its own.
 */
export function buildBoard(placed: readonly Tile[]): Board {
  const queue = [...placed];
  return Array.from({ length: BOARD_SIZE }, (_unusedRow, row) =>
    Array.from({ length: BOARD_SIZE }, (_unusedCol, col): Tile => {
      const fixed = FIXED_BY_SQUARE.get(squareKey(row, col));
      return fixed ? fixedTile(fixed) : queue.shift()!;
    }),
  );
}

/**
 * One printed tile as a board `Tile`. Its id is derived from the square it is printed on — a fixed tile
 * never moves, so its position *is* its identity, and deriving the id keeps `FIXED_TILES` free of a column
 * that could only ever restate the coordinates.
 */
function fixedTile(spec: FixedTileSpec): Tile {
  return {
    id: `fixed-r${spec.position.row}c${spec.position.col}`,
    shape: spec.shape,
    rotation: spec.rotation,
    treasure: spec.treasure,
  };
}
