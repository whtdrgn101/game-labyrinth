import { BOARD_SIZE, GameError, ROTATIONS } from '../core';
import type { Insertion, LabyrinthPlayer, LabyrinthState, Rotation, Tile } from '../core';
import { isInsertionPoint, isLegalInsertion, linePath, record, samePosition, tileAt } from '../internal';

/**
 * Move the maze — the first, **mandatory** half of a turn (pg. 2, "1. Moving the Maze"; "Important: You
 * must move the maze before you can move your playing piece. Even if you can get to the treasure you are
 * looking for without moving the maze.").
 *
 * "On your turn, insert the extra path tile into the game board where one of the arrows is, until another
 * path tile is pushed out of the maze on the opposite side." So one push shifts all 7 tiles of a line
 * along by one square: the extra tile lands on the arrow's own square, every tile moves up one place, and
 * the tile at the far end leaves the board and becomes the new extra tile — keeping the orientation it had
 * on the board, because pushing a tile off does not turn it.
 *
 * **Pawns travel with their tiles**, and the one on the ejected tile wraps around: "If the path tile you
 * push out has a playing piece on it, put this piece on the opposite side of the board on the path tile
 * that was just placed. Moving this piece does not count as your turn!" (pg. 2) — free relocation, of
 * *anyone's* pawn, that consumes nothing. The rulebook states only the wrap, but the wrap is what proves
 * the general rule: if a pawn simply stayed on its square while the tiles slid under it, the ejected
 * tile's pawn would need no rule at all — it would just stay put on a square that now holds its
 * neighbour's tile. The rule exists precisely because the pawn goes wherever its tile goes, and its tile
 * is leaving. See ROADMAP.md "Rulings and deviations" for the full argument.
 *
 * Both facts fall out of one walk of the line: a pawn on `path[i]` ends up on `path[i + 1]`, wrapping to
 * `path[0]` from the far end.
 *
 * Validation is shape-before-rules: the facing and the arrow are checked as payload, the no-reverse rule
 * as game state, so a client that sends nonsense hears about the nonsense first.
 */
export function insert(
  state: LabyrinthState,
  playerId: string,
  insertion: Insertion,
  rotation: Rotation,
): LabyrinthState {
  if (state.phase !== 'insert') {
    throw new GameError('WRONG_PHASE', 'The maze has already been moved this turn — move your piece');
  }
  if (!ROTATIONS.includes(rotation)) {
    throw new GameError('INVALID_ROTATION', `${String(rotation)} is not one of the four tile orientations`);
  }
  if (!isInsertionPoint(insertion)) {
    throw new GameError(
      'ILLEGAL_INSERTION',
      `The ${insertion.side} side of line ${insertion.line} is not one of the 12 arrows`,
    );
  }
  if (!isLegalInsertion(state, insertion)) {
    // pg. 2, "The only exception": the tile cannot go back in where it was just pushed out.
    throw new GameError(
      'ILLEGAL_INSERTION',
      `The extra tile cannot be put back where it was just pushed out (${insertion.side} side of line ${insertion.line})`,
    );
  }

  const path = linePath(insertion);
  const entry = path[0]!;
  const ejected = tileAt(state.board, path[BOARD_SIZE - 1]!);
  // The player chooses the facing; everything else about the tile is carried over unchanged.
  const incoming: Tile = { ...state.extraTile, rotation };

  // Shift the line by one, walking from the far end back so nothing is overwritten before it is read.
  const board = state.board.map((row) => [...row]);
  for (let i = BOARD_SIZE - 1; i > 0; i -= 1) {
    const to = path[i]!;
    board[to.row]![to.col] = tileAt(state.board, path[i - 1]!);
  }
  board[entry.row]![entry.col] = incoming;

  // Only odd lines can be pushed, and the 16 printed tiles all sit at even/even squares, so no square this
  // loop touches can hold one — the fixed board is untouched by construction, not by a check.
  const wrapped: string[] = [];
  const players: LabyrinthPlayer[] = state.players.map((player) => {
    const index = path.findIndex((square) => samePosition(square, player.position));
    if (index < 0) return player;
    if (index === BOARD_SIZE - 1) wrapped.push(player.id);
    return { ...player, position: path[(index + 1) % BOARD_SIZE]! };
  });

  return record(
    state,
    'INSERT',
    playerId,
    {
      board,
      // The pushed-out tile is the one you insert next turn (pg. 1 Set Up, pg. 2), facing as it did.
      extraTile: ejected,
      players,
      lastPush: insertion,
      // Step 1 of 2 is done; the pawn moves next (pg. 2). L2 adds that action and ends the turn there.
      phase: 'move',
    },
    // Everything here is public: an arrow, a facing, two tile ids and whose pawn was carried off the edge
    // — all of it visible on the table. A player's face-down stack never goes near a payload.
    {
      side: insertion.side,
      line: insertion.line,
      rotation,
      tileId: incoming.id,
      ejectedTileId: ejected.id,
      wrapped,
    },
  );
}
