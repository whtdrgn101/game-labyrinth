import { describe, expect, it } from 'vitest';
import type { MoveRecord } from '../../engine';
import { describeMoveRecord } from '../describe';

/**
 * The move feed's plain English, tested payload shape by payload shape.
 *
 * This is the only half of the log a human reads, and `docs/d2c-findings.md` §14 is the reason it gets its
 * own suite: the platform has no readable field on `MoveRecord`, so **everything a line says has to come out
 * of the payload the engine recorded three slices ago**. A test per payload shape is what catches a field
 * that turned out to be missing — and the leak test at the bottom is what catches a line that says something
 * a public feed may not say.
 */

const players = [
  { id: 'p1', name: 'Ann' },
  { id: 'p2', name: 'Bob' },
  { id: 'p3', name: 'Cara' },
];

const entry = (type: string, payload?: Record<string, unknown>): MoveRecord => ({
  seq: 1,
  type,
  playerId: 'p1',
  ...(payload === undefined ? {} : { payload }),
});

const insert = (payload: Record<string, unknown>) => describeMoveRecord(entry('INSERT', payload), players);
const move = (payload: Record<string, unknown>) => describeMoveRecord(entry('MOVE', payload), players);

describe('describeMoveRecord — INSERT', () => {
  it('names the side and calls a north/south line a COLUMN', () => {
    expect(insert({ side: 'north', line: 3, rotation: 0, tileId: 't1', ejectedTileId: 't2', wrapped: [] })).toBe(
      'pushed the extra tile in from the north along column 4 (facing 0°)',
    );
  });

  it('calls an east/west line a ROW — the arrow names the line perpendicular to its own edge', () => {
    expect(insert({ side: 'west', line: 5, rotation: 90, tileId: 't1', ejectedTileId: 't2', wrapped: [] })).toBe(
      'pushed the extra tile in from the west along row 6 (facing 90°)',
    );
  });

  it('states the facing the tile went in at', () => {
    expect(insert({ side: 'south', line: 1, rotation: 270, wrapped: [] })).toContain('(facing 270°)');
  });

  // pg. 2: "If the path tile you push out has a playing piece on it, put this piece on the opposite side of
  // the board … Moving this piece does not count as your turn!" — the one thing in this game that relocates
  // somebody else's pawn, so it gets its own clause rather than being left for the reader to notice.
  it('names a wrapped pawn by its owner', () => {
    expect(insert({ side: 'east', line: 1, rotation: 0, wrapped: ['p2'] })).toBe(
      "pushed the extra tile in from the east along row 2 (facing 0°) — Bob's pawn wrapped round to the far side",
    );
  });

  it('names several wrapped pawns', () => {
    expect(insert({ side: 'east', line: 1, rotation: 0, wrapped: ['p2', 'p3'] })).toContain(
      "Bob's pawn and Cara's pawn wrapped round to the far side",
    );
  });

  it('falls back to an id for an unknown seat, and skips non-string entries', () => {
    expect(insert({ side: 'north', line: 1, rotation: 0, wrapped: ['p9', 7] })).toContain("p9's pawn wrapped");
  });

  it('degrades to a bare sentence when the payload is missing or malformed', () => {
    expect(describeMoveRecord(entry('INSERT'), players)).toBe('slid the maze');
    expect(insert({ side: 'north' })).toBe('slid the maze');
    expect(insert({ line: 1 })).toBe('slid the maze');
  });

  it('omits the facing when the payload has no rotation', () => {
    expect(insert({ side: 'north', line: 1 })).toBe('pushed the extra tile in from the north along column 2');
  });
});

describe('describeMoveRecord — MOVE', () => {
  it('reads coordinates 1-based, because a table counts rows from one', () => {
    expect(move({ from: { row: 0, col: 0 }, to: { row: 2, col: 5 }, flipped: null, won: false })).toBe(
      'moved from row 1, column 1 to row 3, column 6',
    );
  });

  // ROADMAP ruling 11: staying put is a MOVE to your own square, and the feed has to render it as the
  // deliberate choice it is — not as a turn where nothing was logged.
  it('renders from === to as staying put', () => {
    expect(move({ from: { row: 4, col: 4 }, to: { row: 4, col: 4 }, flipped: null, won: false })).toBe(
      'stayed put on row 5, column 5',
    );
  });

  it('announces a treasure turned face up', () => {
    expect(move({ from: { row: 0, col: 0 }, to: { row: 1, col: 1 }, flipped: 'ruby', won: false })).toBe(
      'moved from row 1, column 1 to row 2, column 2 — found the ruby',
    );
  });

  it('announces the win — carried in the payload so the line reads from the record alone', () => {
    expect(move({ from: { row: 1, col: 0 }, to: { row: 0, col: 0 }, flipped: null, won: true })).toBe(
      'moved from row 2, column 1 to row 1, column 1 — home with every treasure found. Wins the game!',
    );
  });

  it('can say both at once (the flip is checked before the win)', () => {
    const line = move({ from: { row: 1, col: 0 }, to: { row: 0, col: 0 }, flipped: 'crown', won: true });
    expect(line).toContain('found the crown');
    expect(line).toContain('Wins the game!');
  });

  it('degrades to a bare sentence when the payload is missing or malformed', () => {
    expect(describeMoveRecord(entry('MOVE'), players)).toBe('moved their pawn');
    expect(move({ from: { row: 0, col: 0 } })).toBe('moved their pawn');
    expect(move({ from: { row: '0', col: 0 }, to: { row: 1, col: 1 } })).toBe('moved their pawn');
    expect(move({ from: null, to: { row: 1, col: 1 } })).toBe('moved their pawn');
  });
});

describe('describeMoveRecord — the contract with the feed', () => {
  it('hides a move type this client does not know, rather than printing a raw type name', () => {
    expect(describeMoveRecord(entry('SOMETHING_NEW', { a: 1 }), players)).toBeNull();
  });

  // ⚠️ The card revealed *underneath* a flip is deliberately absent from the payload (pg. 2 — a player looks
  // at his next card without showing it). The feed is shown to every seat, so a line that mentioned it would
  // be a leak. This asserts the only channel by which one could arrive: `describe` reads the payload only.
  it('says nothing about a card the payload does not carry', () => {
    const line = move({ from: { row: 0, col: 0 }, to: { row: 1, col: 1 }, flipped: 'ruby', won: false, next: 'skull' });
    expect(line).not.toContain('skull');
  });
});
