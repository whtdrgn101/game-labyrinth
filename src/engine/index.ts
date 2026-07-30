// Public API of @game-hub/game-labyrinth/engine. Consumers (./module, ./client, ./bot) import only from here.
//
// L0 ships the data spine + setup. The mechanics arrive in later slices: the slide (L1), movement, treasure
// and the win condition (L2) — see ROADMAP.md.

// Domain types
export type {
  Board,
  Direction,
  Insertion,
  LabyrinthPlayer,
  LabyrinthState,
  MoveRecord,
  Phase,
  PlayerColor,
  Position,
  Rotation,
  SlideLine,
  Tile,
  TileShape,
  TreasureName,
} from './core';

// Errors
export { GameError } from './core';
export type { LabyrinthErrorCode } from './core';

// Rulebook-sourced data + constants (the UI's board, the host's seat bounds, the bot's geometry)
export {
  BOARD_SIZE,
  CARDS_PER_PLAYER,
  DIRECTIONS,
  FIXED_TILE_COUNT,
  FIXED_TILES,
  MAX_PLAYERS,
  MIN_PLAYERS,
  MOVABLE_TILE_COUNT,
  MOVABLE_TILES,
  PLACED_TILE_COUNT,
  ROTATIONS,
  SEAT_COLORS,
  SLIDE_LINES,
  START_CORNERS,
  TREASURE_COUNT,
  TREASURES,
} from './core';
export type { FixedTileSpec, MovableTileSpec } from './core';

// Setup
export { createGame } from './createGame';
export type { CreateGameOptions, NewPlayer } from './createGame';

// Board geometry — a tile's openings are the single definition of connectivity, shared by the UI (drawing
// a tile), L1 (the slide) and L2 (reachability), so nothing re-derives it.
export { isFixedPosition, openings, rotateDirection, tileAt } from './internal';
