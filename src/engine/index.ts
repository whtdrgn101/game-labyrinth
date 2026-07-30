// Public API of @game-hub/game-labyrinth/engine. Consumers (./module, ./client, ./bot) import only from here.
//
// L0 ships the data spine + setup; L1 adds the slide (the maze-moving half of a turn) and the action seam;
// L2 adds the other half — reachability, the pawn move, the treasure flip, the end of a turn and the win.
// A full game is playable through `applyAction` alone from L2 on. See ROADMAP.md.

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
export { isFixedPosition, neighbor, openings, opposite, rotateDirection, samePosition, tileAt } from './internal';

// The slide (L1): the 12 arrows, where each one pushes, and which of them are legal right now. The UI
// draws its arrows from `legalInsertions`; the bot enumerates from the same list. Nothing re-derives the
// no-reverse rule (pg. 2, "The only exception").
export { INSERTIONS, entrySquare, exitSquare, isLegalInsertion, legalInsertions, linePath } from './internal';

// Movement (L2): the flood-fill that says where a piece may go. `reachableFrom` is what L4 highlights on
// the board and L5 searches over; `connects` is the single definition of "two squares are joined" (both
// tiles must face each other), so the UI never re-derives a corridor from a tile's openings.
export { connects, isOnBoard, isReachable, reachableFrom } from './internal';

// Actions — the move seam the host, the UI and the bot all go through.
export { applyAction, insert, legalActions, move } from './actions';
export type { Action, ActionType } from './actions';

// Redaction (L3): the per-viewer projection the module hands to every client, and the types the board and
// the bot decide from. `viewFor` lives in the engine — with the rest of the rules, under the 100% gate —
// because *what a player may see* is as much a rule as what they may do, and because `./client` and `./bot`
// must be able to name the view type without importing `./module` (the seam rule; every hub game does the
// same). See `view.ts` for why a view is built field-by-field rather than spread from the state.
export { viewFor } from './view';
export type { LabyrinthPlayerView, LabyrinthView, Viewer } from './view';
