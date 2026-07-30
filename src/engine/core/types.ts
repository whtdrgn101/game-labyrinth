import type { MoveRecord, WinnersEndState } from '@game-hub/kernel';
import type { TreasureName } from './treasures';

// The append-only move-log entry is a kernel primitive shared by every Game Hub game; re-exported here
// so Labyrinth's own modules import it from `../core` alongside the rest of the domain types.
export type { MoveRecord } from '@game-hub/kernel';
export type { TreasureName } from './treasures';

/**
 * The three path-tile shapes (rulebook pg. 1 illustration; the pg. 2 board photos show them in play).
 *
 * - `straight` — a corridor through the tile (two opposite openings).
 * - `corner` — an elbow (two adjacent openings).
 * - `tee` — a three-way junction (three openings; one wall).
 */
export type TileShape = 'straight' | 'corner' | 'tee';

/** A tile's orientation, in degrees clockwise from its canonical form (see `internal/geometry.ts`). */
export type Rotation = 0 | 90 | 180 | 270;

/** A board edge / a tile opening, named absolutely. Listed clockwise wherever order matters. */
export type Direction = 'north' | 'east' | 'south' | 'west';

/** A square on the 7×7 board, zero-indexed from the top-left (`{ row: 0, col: 0 }` is the red corner). */
export interface Position {
  readonly row: number;
  readonly col: number;
}

/**
 * One path tile on the board (or the single spare beside it).
 *
 * `id` is stable for the life of a game — a tile keeps its identity as it is pushed around the maze and
 * off the edge, which is what lets the UI animate a slide and lets a test follow one tile. Whether a tile
 * can move is **positional, not a property**: only the odd rows and columns slide, so a tile is fixed
 * exactly while it sits at an even row *and* an even column (see `isFixedPosition`).
 */
export interface Tile {
  readonly id: string;
  readonly shape: TileShape;
  readonly rotation: Rotation;
  /** The treasure printed on this tile, or `null` for the 12 straights and 10 plain corners (pg. 1). */
  readonly treasure: TreasureName | null;
}

/** The 7×7 maze, as rows of 7 tiles each. `board[row]![col]!` is the tile on that square. */
export type Board = readonly (readonly Tile[])[];

/** A row or column the extra tile can be pushed along: the odd lines only (pg. 2, the 12 arrows). */
export type SlideLine = 1 | 3 | 5;

/**
 * An insertion of the extra tile: which edge it went in at, and which movable line it travelled along.
 * The 12 arrows of pg. 2 are exactly the 4 sides × 3 lines.
 *
 * `side: 'north', line: 1` means *inserted at the top of column 1*, pushing that column downward, so the
 * tile at `{ row: 6, col: 1 }` is ejected. The one illegal insertion is putting the tile straight back
 * where the last one came out (pg. 2, "The only exception"), i.e. the candidate whose `line` equals
 * `lastPush.line` and whose `side` is the *opposite* of `lastPush.side`. L1 implements that check.
 */
export interface Insertion {
  readonly side: Direction;
  readonly line: SlideLine;
}

/** Whose four corners are whose (pg. 1 board photo: red, yellow, blue, green, clockwise from top-left). */
export type PlayerColor = 'red' | 'yellow' | 'blue' | 'green';

/**
 * The two mandatory-ordered halves of a turn (pg. 2, "A turn is always made up of two steps").
 *
 * `insert` — the maze *must* be moved, even by a player who could already reach their treasure
 * (pg. 2 "Important"). `move` — the pawn may then travel any distance along connected paths, or stay.
 */
export type Phase = 'insert' | 'move';

/**
 * One seat.
 *
 * `stack` is the player's face-down treasure pile: **only its top card (`stack[0]`) is ever visible, and
 * only to its owner** (pg. 2, "Each player looks at the first card of his stack ... without showing it").
 * `found` is the face-up pile of already-collected treasures — public to everyone (pg. 2).
 */
export interface LabyrinthPlayer {
  readonly id: string;
  readonly name: string;
  /** The pawn's colour, and therefore which corner is home. Rules data, not a cosmetic tint. */
  readonly color: PlayerColor;
  /** Where the pawn stands. Pawns do not block each other — the rulebook has no occupancy rule. */
  readonly position: Position;
  /** The face-down stack, top card first. Hidden except for `stack[0]`, and then only from its owner. */
  readonly stack: readonly TreasureName[];
  /** Treasures already found, turned face up (public, pg. 2). */
  readonly found: readonly TreasureName[];
}

/**
 * The complete, serializable state of a Labyrinth game. Plain data — safe to JSON round-trip.
 *
 * Intersected with the kernel `WinnersEndState`: the game ends the instant one player has flipped every
 * card *and* returned to their own corner (pg. 2, "Ending the Game"), which produces a winner and nothing
 * to tabulate — so, as in Can't Stop, the `ended` arm carries only `winnerIds` and no per-player results
 * record (an always-empty one would be invented data). While `status` is `'active'` there is no
 * `winnerIds` at all; narrow on `status` before reading.
 */
export type LabyrinthState = {
  readonly id: string;
  readonly players: readonly LabyrinthPlayer[];
  /** Index into `players` of whose turn it is. Play proceeds clockwise (pg. 2) — see `SEAT_COLORS`. */
  readonly activePlayerIndex: number;
  /** Turn counter, incremented each time the active seat changes. */
  readonly turn: number;
  readonly board: Board;
  /** The one spare tile, inserted on the next turn (pg. 1 Set Up: "There should be one path tile remaining"). */
  readonly extraTile: Tile;
  /** The insertion just made, or `null` on the first turn when all 12 arrows are legal (pg. 2). */
  readonly lastPush: Insertion | null;
  readonly phase: Phase;
  /** Monotonic version, incremented once per applied action. Used for optimistic concurrency. */
  readonly version: number;
  readonly log: readonly MoveRecord[];
} & WinnersEndState;
