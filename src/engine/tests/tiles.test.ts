import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZE,
  FIXED_TILE_COUNT,
  FIXED_TILES,
  MOVABLE_TILE_COUNT,
  MOVABLE_TILES,
  SEAT_COLORS,
  SLIDE_LINES,
  START_CORNERS,
  TREASURE_COUNT,
  TREASURES,
} from '../core';
import type { Direction, Position } from '../core';
import { isFixedPosition, openings, rotateDirection } from '../internal';

/** A square rotated a quarter-turn clockwise about the centre of a 7×7 board. */
function rotateSquare({ row, col }: Position): Position {
  return { row: col, col: BOARD_SIZE - 1 - row };
}

describe('the treasure list (pg. 1)', () => {
  it('has 24 distinct treasures', () => {
    expect(TREASURES).toHaveLength(TREASURE_COUNT);
    expect(new Set(TREASURES).size).toBe(TREASURE_COUNT);
  });

  it('places every treasure on exactly one square — 12 fixed, 12 movable', () => {
    const onFixed = FIXED_TILES.flatMap((tile) => (tile.treasure ? [tile.treasure] : []));
    const onMovable = MOVABLE_TILES.flatMap((tile) => (tile.treasure ? [tile.treasure] : []));
    expect(onFixed).toHaveLength(12);
    expect(onMovable).toHaveLength(12);
    // Every card has a square, and no treasure is printed twice.
    expect([...onFixed, ...onMovable].sort()).toEqual([...TREASURES].sort());
  });
});

describe('the movable tiles (pg. 1: 34 square path tiles)', () => {
  it('is 34 tiles with unique ids', () => {
    expect(MOVABLE_TILES).toHaveLength(MOVABLE_TILE_COUNT);
    expect(new Set(MOVABLE_TILES.map((tile) => tile.id)).size).toBe(MOVABLE_TILE_COUNT);
  });

  it('splits 12 straight / 16 corner / 6 tee', () => {
    const byShape = (shape: string) => MOVABLE_TILES.filter((tile) => tile.shape === shape);
    expect(byShape('straight')).toHaveLength(12);
    expect(byShape('corner')).toHaveLength(16);
    expect(byShape('tee')).toHaveLength(6);
  });

  it('treasures none of the straights, 6 of the corners and all 6 tees', () => {
    const treasured = (shape: string) => MOVABLE_TILES.filter((tile) => tile.shape === shape && tile.treasure !== null);
    expect(treasured('straight')).toHaveLength(0);
    expect(treasured('corner')).toHaveLength(6);
    expect(treasured('tee')).toHaveLength(6);
  });
});

describe('the fixed board (transcribed from the pg. 1 board photo)', () => {
  it('is 16 tiles, all at even/even squares', () => {
    expect(FIXED_TILES).toHaveLength(FIXED_TILE_COUNT);
    for (const tile of FIXED_TILES) expect(isFixedPosition(tile.position)).toBe(true);
    // …and they are 16 *distinct* squares (the 4×4 grid of even coordinates).
    expect(new Set(FIXED_TILES.map((tile) => `${tile.position.row},${tile.position.col}`)).size).toBe(FIXED_TILE_COUNT);
  });

  it('is 4 plain corner starts + 12 treasured T-junctions', () => {
    const corners = FIXED_TILES.filter((tile) => tile.shape === 'corner');
    const tees = FIXED_TILES.filter((tile) => tile.shape === 'tee');
    expect(corners).toHaveLength(4);
    expect(tees).toHaveLength(12);
    for (const corner of corners) expect(corner.treasure).toBeNull();
    for (const tee of tees) expect(tee.treasure).not.toBeNull();
    // No straights are printed on the board.
    expect(FIXED_TILES.some((tile) => tile.shape === 'straight')).toBe(false);
  });

  it('puts one start corner per colour on the four board corners, opening inward', () => {
    const starts = FIXED_TILES.filter((tile) => tile.startFor !== undefined);
    expect(starts).toHaveLength(4);
    expect(starts.map((tile) => tile.startFor).sort()).toEqual([...SEAT_COLORS].sort());

    for (const start of starts) {
      // The colour's home square is the one its tile is printed on (pg. 1 Set Up).
      expect(START_CORNERS[start.startFor!]).toEqual(start.position);
      // A board corner: both coordinates at an extreme.
      const { row, col } = start.position;
      expect(row === 0 || row === BOARD_SIZE - 1).toBe(true);
      expect(col === 0 || col === BOARD_SIZE - 1).toBe(true);
      // Its two openings both point into the board, never off the edge.
      const inward: Direction[] = [row === 0 ? 'south' : 'north', col === 0 ? 'east' : 'west'];
      expect(openings(start.shape, start.rotation).slice().sort()).toEqual(inward.slice().sort());
    }
  });

  /**
   * The transcription's own proof. The printed board is 90°-rotationally symmetric — it has to look the
   * same from each of the four seats — so every fixed tile must map onto the fixed tile a quarter-turn
   * clockwise away, with its openings turned the same quarter-turn. A shape or orientation misread off the
   * photo would almost certainly break this, so this test is what stands behind the data file.
   */
  it('is 90°-rotationally symmetric (the transcription self-check)', () => {
    const bySquare = new Map(FIXED_TILES.map((tile) => [`${tile.position.row},${tile.position.col}`, tile]));

    for (const tile of FIXED_TILES) {
      const target = rotateSquare(tile.position);
      const neighbour = bySquare.get(`${target.row},${target.col}`);
      expect(neighbour, `no fixed tile at the rotated square ${target.row},${target.col}`).toBeDefined();
      expect(neighbour!.shape).toBe(tile.shape);

      const expected = openings(tile.shape, tile.rotation).map((direction) => rotateDirection(direction, 90));
      expect(openings(neighbour!.shape, neighbour!.rotation).slice().sort()).toEqual(expected.slice().sort());
    }
  });
});

describe('the slide lines (pg. 2: 12 arrows)', () => {
  it('is the three odd lines, giving 4 sides × 3 = 12 insertion points', () => {
    expect(SLIDE_LINES).toEqual([1, 3, 5]);
    for (const line of SLIDE_LINES) expect(line % 2).toBe(1);
    expect(SLIDE_LINES.length * 4).toBe(12);
  });

  it('never lines up with a fixed tile', () => {
    // A slide along an odd row/column touches no even/even square, which is why only these lines move.
    for (const line of SLIDE_LINES) {
      for (let other = 0; other < BOARD_SIZE; other += 1) {
        expect(isFixedPosition({ row: line, col: other })).toBe(false);
        expect(isFixedPosition({ row: other, col: line })).toBe(false);
      }
    }
  });
});
