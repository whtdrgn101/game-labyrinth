import { ROTATIONS } from '../core';
import type { LabyrinthState } from '../core';
import { legalInsertions } from '../internal';
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
 * The `move` phase returns nothing yet — moving the pawn is L2, and until it lands there is no action to
 * offer there (see ROADMAP.md).
 */
export function legalActions(state: LabyrinthState, playerId?: string): readonly Action[] {
  if (state.status === 'ended') return [];
  const active = state.players[state.activePlayerIndex]!;
  if (playerId !== undefined && playerId !== active.id) return [];
  if (state.phase !== 'insert') return [];

  return legalInsertions(state).flatMap((insertion) =>
    ROTATIONS.map((rotation): Action => ({ type: 'INSERT', insertion, rotation })),
  );
}
