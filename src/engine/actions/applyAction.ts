import { GameError } from '../core';
import type { LabyrinthState } from '../core';
import { seatOf } from '../internal';
import type { Action } from './action';
import { insert } from './insert';

/**
 * Apply an action for `playerId`, enforcing turn order — the single entry point for a move, and the one
 * the host, the UI and the bot all go through. Throws a `GameError` on anything illegal and never mutates
 * the input state.
 *
 * The two turn-wide guards live here rather than in each mechanic, exactly as in the hub's other games:
 * a finished game accepts nothing, and only the seat on the clock may act. Whether the action fits the
 * *half* of the turn in progress is the mechanic's own business (`insert` rejects a second slide).
 */
export function applyAction(state: LabyrinthState, playerId: string, action: Action): LabyrinthState {
  if (state.status === 'ended') {
    throw new GameError('GAME_OVER', 'The game has ended');
  }
  if (seatOf(state, playerId) !== state.activePlayerIndex) {
    throw new GameError('NOT_YOUR_TURN', `It is not player "${playerId}"'s turn`);
  }
  switch (action.type) {
    case 'INSERT':
      return insert(state, playerId, action.insertion, action.rotation);
  }
}
