import { GameError, START_CORNERS } from '../core/index.js';
import type { LabyrinthPlayer, LabyrinthState, Position, TreasureName } from '../core/index.js';
import { activePlayer, isOnBoard, isReachable, record, samePosition, tileAt, withPlayer } from '../internal/index.js';

/**
 * Move your playing piece — the second half of a turn, and the half that **ends** it (pg. 2, "2. Moving
 * Your Playing Piece").
 *
 * "Once you have moved the maze, you can move your playing piece. You can occupy any square that you can
 * move your piece to directly, without interruption. You can move your playing piece as far as you like.
 * Or, you can leave your playing piece where it is." So the legal targets are exactly the flood-fill from
 * the pawn's square (`reachableFrom`), which always contains that square — **staying put is a `MOVE` to
 * your own square**, not a separate action (ROADMAP ruling 11).
 *
 * Landing on the square whose tile bears the treasure on your top card turns that card face up: "Once you
 * find the treasure you are looking for, turn over your treasure card and lay it face up next to your card
 * pile. Look at your next treasure card." (pg. 2) — so the card leaves the face-down `stack` for the public
 * `found` pile and the next card becomes the target. Only the square the piece **stops** on is checked; a
 * square merely crossed on the way does nothing (ROADMAP ruling 10).
 *
 * "The game is over as soon as a player has turned over all their treasure cards and returned their playing
 * piece to its starting position. The first player to do this is the winner." (pg. 2, "Ending the Game") —
 * checked the instant the move resolves, flip included, and it ends the game there rather than passing the
 * turn.
 *
 * Validation is shape-before-rules, as in `insert`: a square that isn't on the board is a payload mistake
 * (`INVALID_POSITION`), a real square you can't get to is a rules one (`UNREACHABLE`).
 */
export function move(state: LabyrinthState, playerId: string, target: Position): LabyrinthState {
  if (state.phase !== 'move') {
    // pg. 2, "Important: You must move the maze before you can move your playing piece."
    throw new GameError('WRONG_PHASE', 'You must move the maze before you can move your playing piece');
  }
  if (!isOnBoard(target)) {
    throw new GameError(
      'INVALID_POSITION',
      `(${String(target.row)}, ${String(target.col)}) is not a square on the board`,
    );
  }

  const seat = state.activePlayerIndex;
  const player = activePlayer(state);
  if (!isReachable(state.board, player.position, target)) {
    throw new GameError(
      'UNREACHABLE',
      `No open path leads from (${String(player.position.row)}, ${String(player.position.col)}) to (${String(target.row)}, ${String(target.col)})`,
    );
  }

  // The treasure you are hunting is the top of your face-down stack (pg. 2); an empty stack means every
  // card is already flipped and the only thing left to do is go home.
  const seeking = player.stack[0];
  const flipped: TreasureName | null =
    seeking !== undefined && tileAt(state.board, target).treasure === seeking ? seeking : null;

  const moved: LabyrinthPlayer = {
    ...player,
    position: target,
    stack: flipped === null ? player.stack : player.stack.slice(1),
    found: flipped === null ? player.found : [...player.found, flipped],
  };
  const players = withPlayer(state, seat, moved);

  // Everything in the payload is public: where the piece went, and a card that has just been turned face
  // up. The card *revealed* underneath it is not here — it is the mover's secret (pg. 2).
  const payload = { from: player.position, to: target, flipped, won: false };

  // "returned their playing piece to its starting position" — the corner its colour names (pg. 1 Set Up).
  const home = START_CORNERS[moved.color];
  if (moved.stack.length === 0 && samePosition(target, home)) {
    return record(
      state,
      'MOVE',
      playerId,
      { players, phase: 'insert', status: 'ended', winnerIds: [moved.id] },
      { ...payload, won: true },
    );
  }

  // "Now it's the next player's turn." (pg. 2) — clockwise, which is what seat order encodes, and back to
  // the mandatory first step of a turn.
  return record(
    state,
    'MOVE',
    playerId,
    {
      players,
      phase: 'insert',
      activePlayerIndex: (seat + 1) % players.length,
      turn: state.turn + 1,
    },
    payload,
  );
}
