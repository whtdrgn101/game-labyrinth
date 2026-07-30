import type { Direction, PlayerColor, Position, Rotation, SlideLine } from './types';

/** 2 to 4 players (pg. 1 header, "2 to 4 Players"). */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

/** The board is 7×7 = 49 squares (pg. 1 board photo). */
export const BOARD_SIZE = 7;

/** 16 tiles are printed on the board itself and never move (pg. 1, "1 game board with 16 fixed path tiles"). */
export const FIXED_TILE_COUNT = 16;

/**
 * 34 loose path tiles (pg. 1, "34 square path tiles"), of which 33 fill the board's empty squares and
 * **one is left over as the extra tile** (pg. 1 Set Up: "There should be one path tile remaining").
 */
export const MOVABLE_TILE_COUNT = 34;
export const PLACED_TILE_COUNT = MOVABLE_TILE_COUNT - 1;

/** 24 treasure cards (pg. 1, "24 treasure cards") — one per treasure on the board. */
export const TREASURE_COUNT = 24;

/**
 * How many treasure cards each player gets. The rulebook says only "divide them evenly among the
 * players" (pg. 1 Set Up); 24 divides exactly at every supported seat count, so "evenly" is unambiguous
 * and the whole deck is always dealt out.
 */
export const CARDS_PER_PLAYER: Readonly<Record<number, number>> = { 2: 12, 3: 8, 4: 6 };

/** The four orientations a tile can take, clockwise. */
export const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];

/** The four directions in **clockwise** order — `rotateDirection` relies on that ordering. */
export const DIRECTIONS: readonly Direction[] = ['north', 'east', 'south', 'west'];

/**
 * The rows and columns the extra tile can be pushed along: the odd lines only. Every even line contains
 * fixed tiles, which is why exactly these three (× 4 sides) make up the **12 arrows** of pg. 2 ("There
 * are 12 arrows along the edge of the board").
 */
export const SLIDE_LINES: readonly SlideLine[] = [1, 3, 5];

/**
 * Seat order, as pawn colours. Play "continu[es] in a clockwise direction" (pg. 2), so consecutive seats
 * must sit at consecutive corners *clockwise* around the board — red (top-left) → yellow (top-right) →
 * blue (bottom-right) → green (bottom-left), the colours as printed in the pg. 1 board photo. Seat *i*
 * takes `SEAT_COLORS[i]`, so turn order and table geometry agree at every player count.
 */
export const SEAT_COLORS: readonly PlayerColor[] = ['red', 'yellow', 'blue', 'green'];

/**
 * Each colour's home corner — where its pawn starts and where it must return to win (pg. 1 Set Up,
 * pg. 2 Ending the Game). Read off the pg. 1 board photo: the coloured dots sit on the four corner tiles.
 */
export const START_CORNERS: Readonly<Record<PlayerColor, Position>> = {
  red: { row: 0, col: 0 },
  yellow: { row: 0, col: 6 },
  blue: { row: 6, col: 6 },
  green: { row: 6, col: 0 },
};
