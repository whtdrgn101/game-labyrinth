import { describe, expect, it } from 'vitest';
import { DIRECTIONS, ROTATIONS } from '../core';
import type { Direction, Rotation, TileShape } from '../core';
import { isFixedPosition, openings, rotateDirection } from '../internal';

describe('rotateDirection', () => {
  it('turns a quarter-turn clockwise per 90°', () => {
    expect(rotateDirection('north', 90)).toBe('east');
    expect(rotateDirection('east', 90)).toBe('south');
    expect(rotateDirection('south', 90)).toBe('west');
    expect(rotateDirection('west', 90)).toBe('north');
  });

  it('is the identity at 0° and wraps at 180°/270°', () => {
    for (const direction of DIRECTIONS) {
      expect(rotateDirection(direction, 0)).toBe(direction);
      expect(rotateDirection(rotateDirection(direction, 180), 180)).toBe(direction);
      expect(rotateDirection(rotateDirection(direction, 90), 270)).toBe(direction);
    }
  });
});

describe('openings', () => {
  // The canonical forms of the three shapes and each quarter-turn from them, spelled out rather than
  // derived — this table is the definition the fixed-board transcription is read against.
  const table: ReadonlyArray<[TileShape, Rotation, Direction[]]> = [
    ['straight', 0, ['north', 'south']],
    ['straight', 90, ['east', 'west']],
    ['straight', 180, ['north', 'south']],
    ['straight', 270, ['east', 'west']],
    ['corner', 0, ['north', 'east']],
    ['corner', 90, ['east', 'south']],
    ['corner', 180, ['south', 'west']],
    ['corner', 270, ['north', 'west']],
    ['tee', 0, ['east', 'south', 'west']],
    ['tee', 90, ['north', 'south', 'west']],
    ['tee', 180, ['north', 'east', 'west']],
    ['tee', 270, ['north', 'east', 'south']],
  ];

  for (const [shape, rotation, expected] of table) {
    it(`${shape} at ${rotation}° opens ${expected.join('/')}`, () => {
      expect(openings(shape, rotation)).toEqual(expected);
    });
  }

  it('always returns the openings in N/E/S/W order', () => {
    for (const shape of ['straight', 'corner', 'tee'] as const) {
      for (const rotation of ROTATIONS) {
        const result = openings(shape, rotation);
        const indices = result.map((direction) => DIRECTIONS.indexOf(direction));
        expect(indices).toEqual([...indices].sort((a, b) => a - b));
      }
    }
  });

  it('gives a straight period 180° and the other shapes period 360°', () => {
    // A straight cannot be told "up" from "down" — 0/180 and 90/270 are the same tile.
    expect(openings('straight', 0)).toEqual(openings('straight', 180));
    expect(openings('straight', 90)).toEqual(openings('straight', 270));
    for (const shape of ['corner', 'tee'] as const) {
      const seen = ROTATIONS.map((rotation) => openings(shape, rotation).join(','));
      expect(new Set(seen).size).toBe(4);
    }
  });

  it('opens two edges for a straight/corner and three for a tee', () => {
    for (const rotation of ROTATIONS) {
      expect(openings('straight', rotation)).toHaveLength(2);
      expect(openings('corner', rotation)).toHaveLength(2);
      expect(openings('tee', rotation)).toHaveLength(3);
    }
  });
});

describe('isFixedPosition', () => {
  it('is true only where both coordinates are even', () => {
    expect(isFixedPosition({ row: 0, col: 0 })).toBe(true);
    expect(isFixedPosition({ row: 4, col: 6 })).toBe(true);
    expect(isFixedPosition({ row: 0, col: 1 })).toBe(false);
    expect(isFixedPosition({ row: 1, col: 0 })).toBe(false);
    expect(isFixedPosition({ row: 3, col: 5 })).toBe(false);
  });
});
