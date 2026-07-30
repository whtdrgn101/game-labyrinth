import {
  CARDS_PER_PLAYER,
  GameError,
  MAX_PLAYERS,
  MIN_PLAYERS,
  MOVABLE_TILES,
  PLACED_TILE_COUNT,
  SEAT_COLORS,
  START_CORNERS,
  TREASURES,
} from './core';
import type { LabyrinthPlayer, LabyrinthState, Tile } from './core';
import { buildBoard, randomRotation, shuffle } from './internal';

/** Input for a single seat when creating a game. */
export interface NewPlayer {
  readonly name: string;
}

export interface CreateGameOptions {
  readonly id: string;
  readonly players: readonly NewPlayer[];
  /**
   * Randomness for the whole of setup — the tile shuffle, each tile's orientation, and the treasure-card
   * deal (pg. 1 Set Up) — injected so the engine stays pure. Labyrinth has **no per-action randomness at
   * all** after this: every later turn is a deterministic function of the players' choices. Omit for a
   * deterministic setup (tests); the host passes `ctx.rng`.
   */
  readonly rng?: () => number;
}

/**
 * Build the initial state for a new Labyrinth game (rulebook pg. 1, "Set Up").
 *
 * "Shuffle the path tiles, face down, and place them face up on the empty spaces of the game board to form
 * a random maze of paths. There should be one path tile remaining. … Shuffle the 24 treasure cards and
 * divide them evenly among the players. … Each player … places [a playing piece] on its own color in one of
 * the four corners." Face-down shuffling randomises each tile's **orientation** as well as its square, so
 * every placed tile draws a rotation too.
 *
 * **Start player — a deliberate deviation.** The rulebook's rule is "The last player to go on a treasure
 * hunt goes first" (pg. 2): a joke about the players' lives, with nothing in the game state to evaluate. It
 * is replaced by **seat 0**, the platform's usual convention (see ROADMAP.md "Rulings and deviations" for
 * the full rationale) — seat order itself comes from the lobby, which is where any randomising belongs.
 */
export function createGame(options: CreateGameOptions): LabyrinthState {
  const { id, players, rng } = options;
  const count = players.length;
  if (count < MIN_PLAYERS || count > MAX_PLAYERS) {
    throw new GameError(
      'INVALID_PLAYER_COUNT',
      `Labyrinth supports ${MIN_PLAYERS}–${MAX_PLAYERS} players, got ${count}`,
    );
  }

  // Shuffle the 34 loose tiles face down, then turn each one up at a drawn orientation. The first 33 fill
  // the board's empty squares in reading order; the 34th is the extra tile that stays beside the board.
  const deck: Tile[] = shuffle(MOVABLE_TILES, rng).map((spec) => ({
    id: spec.id,
    shape: spec.shape,
    rotation: randomRotation(rng),
    treasure: spec.treasure,
  }));
  const board = buildBoard(deck.slice(0, PLACED_TILE_COUNT));
  const extraTile = deck[PLACED_TILE_COUNT]!;

  // Shuffle the 24 treasure cards and divide them evenly (pg. 1). 24 splits exactly at 2/3/4 players
  // (12/8/6 each), so the deck is always fully dealt and no card is left over.
  const cards = shuffle(TREASURES, rng);
  const perPlayer = CARDS_PER_PLAYER[count]!;

  const playerStates: LabyrinthPlayer[] = players.map((player, seat) => {
    // Seat order is clockwise round the board (pg. 2), which is what `SEAT_COLORS` encodes.
    const color = SEAT_COLORS[seat]!;
    return {
      id: `p${seat + 1}`,
      name: player.name,
      color,
      // "places it on its own color in one of the four corners" (pg. 1).
      position: START_CORNERS[color],
      stack: cards.slice(seat * perPlayer, (seat + 1) * perPlayer),
      found: [],
    };
  });

  return {
    id,
    players: playerStates,
    // The deviation documented above: the physical start-player rule is undigitizable, so seat 0 opens.
    activePlayerIndex: 0,
    turn: 1,
    board,
    extraTile,
    // Nothing has been pushed out yet, so all 12 arrows are legal on the first turn (pg. 2).
    lastPush: null,
    // The maze must be moved before the pawn (pg. 2, "A turn is always made up of two steps").
    phase: 'insert',
    // Active arm of the kernel end-state union: no `winnerIds` exists until someone wins (pg. 2).
    status: 'active',
    version: 0,
    log: [],
  };
}
