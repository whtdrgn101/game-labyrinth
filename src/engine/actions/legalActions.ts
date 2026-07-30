import { ROTATIONS } from '../core';
import type { LabyrinthState } from '../core';
import { legalInsertions, reachableFrom } from '../internal';
import type { Action } from './action';

/**
 * Every action the given seat may legally take right now — the UI's affordances and the bot's candidate
 * list, from one place. `playerId` defaults to the active player; any other seat has nothing to do,
 * because Labyrinth never asks an off-turn player for input.
 *
 * In the `insert` phase this is the whole first half of a turn enumerated: the legal arrows (12 on the
 * first turn, 11 after — pg. 2) × the extra tile's 4 facings, so **48 or 44 candidates**. That product is
 * the branching factor L5's search will work over, which is why it is built here rather than left to the
 * bot to re-derive.
 *
 * ⚠️ A `straight` has period 180°, so for a straight extra tile half of those 4 facings are duplicates of
 * the other half. They are still listed: a facing is a legal choice whether or not it is a *distinct*
 * one, and pruning symmetric duplicates is a search optimisation that belongs to the bot, not to the
 * statement of what is legal.
 *
 * In the `move` phase it is the flood-fill from the active piece's square, in `reachableFrom`'s stable
 * reading order — **at least one candidate and at most 49**, because the piece's own square is always
 * reachable (staying put is a move, pg. 2). So the `move` phase is never empty and a turn can always be
 * completed, however sealed off a piece is.
 */
export function legalActions(state: LabyrinthState, playerId?: string): readonly Action[] {
  if (state.status === 'ended') return [];
  const active = state.players[state.activePlayerIndex]!;
  if (playerId !== undefined && playerId !== active.id) return [];

  if (state.phase === 'move') {
    return reachableFrom(state.board, active.position).map((target): Action => ({ type: 'MOVE', target }));
  }

  return legalInsertions(state).flatMap((insertion) =>
    ROTATIONS.map((rotation): Action => ({ type: 'INSERT', insertion, rotation })),
  );
}
