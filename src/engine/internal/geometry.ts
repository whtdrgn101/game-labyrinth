import { DIRECTIONS } from '../core';
import type { Direction, Position, Rotation, TileShape } from '../core';

/**
 * Each shape's openings in its **canonical (rotation 0) form**, chosen to match the shape's own name so
 * the data is readable:
 *
 * - `straight` → `north`/`south`: a vertical corridor, `│`.
 * - `corner` → `north`/`east`: an elbow from the top edge to the right edge, `└`.
 * - `tee` → `east`/`south`/`west`: the letter **T** — a corridor across the top and a stem going down,
 *   `┬`. (Its wall is therefore the north edge.)
 *
 * ⚠️ A `straight` has period 180°, not 360°: rotations 0 and 180 are the same tile, as are 90 and 270. The
 * physical game has the same property (you cannot tell a straight's "up" from its "down"), so setup draws a
 * rotation for every tile uniformly and simply produces a duplicate-looking result half the time for
 * straights. Nothing downstream may assume a tile's rotation is unique to its opening set.
 */
const BASE_OPENINGS: Readonly<Record<TileShape, readonly Direction[]>> = {
  straight: ['north', 'south'],
  corner: ['north', 'east'],
  tee: ['east', 'south', 'west'],
};

/** Turn `direction` a quarter-turn clockwise `rotation / 90` times. `DIRECTIONS` is in clockwise order. */
export function rotateDirection(direction: Direction, rotation: Rotation): Direction {
  const steps = rotation / 90;
  const from = DIRECTIONS.indexOf(direction);
  return DIRECTIONS[(from + steps) % DIRECTIONS.length]!;
}

/**
 * Which edges of a tile are open, for a shape at a rotation — the one place a tile's *geometry* is
 * defined, so movement (L2) and the fixed-board transcription agree by construction.
 *
 * Always returned in `DIRECTIONS` order (N, E, S, W) regardless of how the base form is written, so two
 * tiles' opening sets can be compared directly.
 */
export function openings(shape: TileShape, rotation: Rotation): readonly Direction[] {
  const rotated = new Set(BASE_OPENINGS[shape].map((direction) => rotateDirection(direction, rotation)));
  return DIRECTIONS.filter((direction) => rotated.has(direction));
}

/**
 * Whether the tile on this square can never be pushed: true exactly at the even/even squares, where the
 * board's own 16 printed tiles sit (pg. 1). Only the odd rows and columns slide — which is why the arrows
 * mark only those (pg. 2) — so "is fixed" is a property of the *square*, not of the tile standing on it.
 */
export function isFixedPosition(position: Position): boolean {
  return position.row % 2 === 0 && position.col % 2 === 0;
}
