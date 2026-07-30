import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZE,
  CARDS_PER_PLAYER,
  FIXED_TILES,
  MOVABLE_TILES,
  PLACED_TILE_COUNT,
  ROTATIONS,
  SEAT_COLORS,
  START_CORNERS,
  TREASURES,
} from '../core';
import type { LabyrinthState, PlayerColor, Tile } from '../core';
import { createGame } from '../createGame';
import { isFixedPosition, openings, tileAt } from '../internal';
import { expectError, mulberry32, newGame, seats, seededGame } from './helpers';

/** Every tile on the board, in reading order. */
function allTiles(game: LabyrinthState): Tile[] {
  return game.board.flatMap((row) => [...row]);
}

describe('createGame — seat bounds', () => {
  it('accepts 2 to 4 players (pg. 1)', () => {
    for (const count of [2, 3, 4]) {
      expect(createGame({ id: 'g', players: seats(count).map((name) => ({ name })) }).players).toHaveLength(count);
    }
  });

  it('rejects any other seat count', () => {
    expectError(() => newGame(['Solo']), 'INVALID_PLAYER_COUNT');
    expectError(() => newGame(seats(5)), 'INVALID_PLAYER_COUNT');
  });
});

describe('createGame — the opening position', () => {
  it('starts on turn 1, seat 0, owing an insertion, with nothing pushed yet', () => {
    const game = newGame();
    expect(game.id).toBe('g1');
    expect(game.turn).toBe(1);
    // The documented deviation: the rulebook's start-player rule is undigitizable, so seat 0 opens.
    expect(game.activePlayerIndex).toBe(0);
    // The maze must be moved before the pawn (pg. 2), and all 12 arrows are open on the first turn.
    expect(game.phase).toBe('insert');
    expect(game.lastPush).toBeNull();
    expect(game.status).toBe('active');
    expect(game.version).toBe(0);
    expect(game.log).toEqual([]);
  });

  it('seats players p1…pn in clockwise colour order, pawns on their own corners (pg. 1)', () => {
    const game = newGame(seats(4));
    expect(game.players.map((player) => player.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(game.players.map((player) => player.color)).toEqual([...SEAT_COLORS]);
    for (const player of game.players) {
      expect(player.position).toEqual(START_CORNERS[player.color]);
      expect(player.found).toEqual([]);
    }
  });

  it('uses only the first colours at smaller counts', () => {
    expect(newGame().players.map((p) => p.color)).toEqual(['red', 'yellow']);
    expect(newGame(seats(3)).players.map((p) => p.color)).toEqual(['red', 'yellow', 'blue']);
  });
});

/**
 * "Each player chooses one of the … playing pieces and places it on its own color in one of the four corners
 * of the game board" (pg. 1 Set Up). The piece is *chosen*, and the colour chosen names the corner — so a
 * colour is an input to setup, not something the engine hands out (ROADMAP ruling 6).
 */
describe('createGame — choosing your pawn (pg. 1 Set Up)', () => {
  const withColors = (players: readonly { name: string; color?: PlayerColor }[]): LabyrinthState =>
    createGame({ id: 'g', players });

  it('starts each pawn on the corner its chosen colour names', () => {
    const game = withColors([
      { name: 'Ann', color: 'blue' },
      { name: 'Bob', color: 'green' },
    ]);
    expect(game.players.map((player) => player.color)).toEqual(['blue', 'green']);
    expect(game.players[0]!.position).toEqual(START_CORNERS.blue);
    expect(game.players[1]!.position).toEqual(START_CORNERS.green);
  });

  it('leaves turn order to the seating, not to the corners', () => {
    // Seat order is the table's (pg. 2, "play continuing in a clockwise direction" — the players, not the
    // corners), and it is the lobby's business. Picking colours out of clockwise order must not reorder it.
    const game = withColors([
      { name: 'Ann', color: 'blue' },
      { name: 'Bob', color: 'red' },
    ]);
    expect(game.activePlayerIndex).toBe(0);
    expect(game.players.map((player) => player.id)).toEqual(['p1', 'p2']);
    expect(game.players[0]!.color).toBe('blue');
  });

  it('fills an unpicked seat from the colours still unclaimed, in seat order', () => {
    const game = withColors([{ name: 'Ann' }, { name: 'Bob', color: 'red' }, { name: 'Cal' }]);
    // Red is taken by seat 1, so the two silent seats take yellow and blue — the palette order, minus what
    // was claimed. Deterministic, so a partly-picked table is as reproducible as a fully-picked one.
    expect(game.players.map((player) => player.color)).toEqual(['yellow', 'red', 'blue']);
  });

  it('is exactly the old seat-ordered assignment when nobody picks', () => {
    expect(newGame(seats(4)).players.map((player) => player.color)).toEqual([...SEAT_COLORS]);
  });

  it('refuses a colour that is not one of the four pawns', () => {
    expectError(
      () => withColors([{ name: 'Ann', color: 'purple' as PlayerColor }, { name: 'Bob' }]),
      'INVALID_PLAYER_COLOR',
    );
    // Off the wire a colour need not even be a string — the module hands it through unvalidated on purpose.
    expectError(
      () => withColors([{ name: 'Ann', color: 7 as unknown as PlayerColor }, { name: 'Bob' }]),
      'INVALID_PLAYER_COLOR',
    );
  });

  it('refuses two seats asking for the same pawn — there is one of each in the box', () => {
    expectError(
      () =>
        withColors([
          { name: 'Ann', color: 'green' },
          { name: 'Bob', color: 'green' },
        ]),
      'INVALID_PLAYER_COLOR',
    );
  });

  it('checks the roster before it shuffles anything — an impossible table never gets a maze', () => {
    // Ordering, not cosmetics: a bad seat count and a bad colour are both refused up front, so a rejection
    // never depends on how far setup happened to get.
    expectError(() => withColors([{ name: 'Solo', color: 'red' }]), 'INVALID_PLAYER_COUNT');
  });
});

describe('createGame — the treasure deal (pg. 1)', () => {
  it('deals 12/8/6 cards each at 2/3/4 players, using the whole deck', () => {
    for (const count of [2, 3, 4]) {
      const game = newGame(seats(count));
      const perPlayer = CARDS_PER_PLAYER[count]!;
      for (const player of game.players) expect(player.stack).toHaveLength(perPlayer);
      const dealt = game.players.flatMap((player) => [...player.stack]);
      // Evenly divided *and* exhaustive: all 24 cards are out, each exactly once.
      expect(dealt).toHaveLength(TREASURES.length);
      expect([...dealt].sort()).toEqual([...TREASURES].sort());
    }
  });

  it('gives each player a distinct set of cards', () => {
    const game = seededGame(11, seats(4));
    const seen = new Set<string>();
    for (const player of game.players) {
      for (const treasure of player.stack) {
        expect(seen.has(treasure)).toBe(false);
        seen.add(treasure);
      }
    }
  });

  it('shuffles the deck with the injected rng', () => {
    const ordered = newGame();
    const shuffled = seededGame(5);
    expect(shuffled.players[0]!.stack).not.toEqual(ordered.players[0]!.stack);
    // A shuffle is a permutation: the same 24 cards are dealt either way.
    const cardsOf = (game: typeof ordered) => game.players.flatMap((p) => [...p.stack]).sort();
    expect(cardsOf(shuffled)).toEqual(cardsOf(ordered));
  });
});

describe('createGame — the maze (pg. 1 Set Up)', () => {
  it('fills all 49 squares', () => {
    const game = seededGame(1);
    expect(game.board).toHaveLength(BOARD_SIZE);
    for (const row of game.board) expect(row).toHaveLength(BOARD_SIZE);
    expect(allTiles(game)).toHaveLength(BOARD_SIZE * BOARD_SIZE);
  });

  it('prints the 16 fixed tiles on their own squares, untouched by the shuffle', () => {
    const game = seededGame(2);
    for (const spec of FIXED_TILES) {
      const tile = tileAt(game.board, spec.position);
      expect(tile.id).toBe(`fixed-r${spec.position.row}c${spec.position.col}`);
      expect(tile.shape).toBe(spec.shape);
      // A seeded setup draws rotations for the *loose* tiles only — the printed board keeps its own.
      expect(tile.rotation).toBe(spec.rotation);
      expect(tile.treasure).toBe(spec.treasure);
    }
  });

  it('places 33 loose tiles and keeps the 34th as the extra tile', () => {
    const game = seededGame(3);
    const loose = allTiles(game).filter((tile) => !tile.id.startsWith('fixed-'));
    expect(loose).toHaveLength(PLACED_TILE_COUNT);
    // The 34 loose tiles are exactly the deck: 33 on the board plus the one beside it (pg. 1, "There
    // should be one path tile remaining").
    const ids = [...loose.map((tile) => tile.id), game.extraTile.id].sort();
    expect(ids).toEqual(MOVABLE_TILES.map((tile) => tile.id).sort());
    expect(loose.map((tile) => tile.id)).not.toContain(game.extraTile.id);
  });

  it('puts loose tiles on exactly the non-fixed squares', () => {
    const game = seededGame(4);
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const fixedSquare = isFixedPosition({ row, col });
        expect(tileAt(game.board, { row, col }).id.startsWith('fixed-')).toBe(fixedSquare);
      }
    }
  });

  it('lays the deck out in reading order when unseeded (the deterministic fixture)', () => {
    const game = newGame();
    const loose = allTiles(game).filter((tile) => !tile.id.startsWith('fixed-'));
    expect(loose.map((tile) => tile.id)).toEqual(MOVABLE_TILES.slice(0, PLACED_TILE_COUNT).map((tile) => tile.id));
    expect(game.extraTile.id).toBe(MOVABLE_TILES[PLACED_TILE_COUNT]!.id);
    // Every loose tile faces north — no rng, no orientation draw.
    for (const tile of loose) expect(tile.rotation).toBe(0);
  });

  it('draws an orientation per loose tile from the rng (tiles are shuffled face down)', () => {
    const game = seededGame(6);
    const loose = [...allTiles(game).filter((tile) => !tile.id.startsWith('fixed-')), game.extraTile];
    for (const tile of loose) {
      expect(ROTATIONS).toContain(tile.rotation);
      // Whatever the draw, the tile's geometry is well-formed.
      expect(openings(tile.shape, tile.rotation).length).toBe(tile.shape === 'tee' ? 3 : 2);
    }
    // The whole point of drawing: not everything faces north.
    expect(loose.some((tile) => tile.rotation !== 0)).toBe(true);
  });

  it('shuffles the tiles into the maze with the rng', () => {
    const ordered = newGame();
    const shuffled = seededGame(8);
    const looseIds = (game: LabyrinthState) =>
      allTiles(game)
        .filter((tile) => !tile.id.startsWith('fixed-'))
        .map((tile) => tile.id);
    expect(looseIds(shuffled)).not.toEqual(looseIds(ordered));
  });
});

describe('createGame — determinism', () => {
  it('is identical for the same seed', () => {
    expect(seededGame(99, seats(4))).toEqual(seededGame(99, seats(4)));
  });

  it('differs between seeds', () => {
    expect(seededGame(1, seats(4))).not.toEqual(seededGame(2, seats(4)));
  });

  it('takes randomness only from the injected rng — a spent generator changes nothing', () => {
    // Purity check: the same seed reproduces the state no matter what else has happened first.
    const rng = mulberry32(77);
    for (let i = 0; i < 500; i += 1) rng();
    const players = seats(3).map((name) => ({ name }));
    expect(createGame({ id: 'g', players, rng: mulberry32(77) })).toEqual(
      createGame({ id: 'g', players, rng: mulberry32(77) }),
    );
  });
});
