import type { Insertion, Rotation } from '../core';

/**
 * Everything a player can do in a Labyrinth turn. `applyAction` is the turn-aware entry point.
 *
 * A turn is two mandatory-ordered steps (pg. 2) and this union grows to match: **L1 ships `INSERT`**, the
 * first step — "insert the extra path tile into the game board where one of the arrows is". L2 adds the
 * second, moving the pawn (or leaving it where it is), which is also what ends the turn; until then the
 * `move` phase has no action and the turn does not pass. See ROADMAP.md "Rulings and deviations".
 *
 * Every field is public: an action is logged verbatim, and nothing here touches a player's face-down
 * stack. Unlike Can't Stop there is no server-only arm — Labyrinth spends all its randomness at setup,
 * so every action is a player's own free choice and safe to accept from a client.
 */
export type Action = {
  readonly type: 'INSERT';
  /** Which of the 12 arrows (pg. 2). */
  readonly insertion: Insertion;
  /** How the extra tile is turned before it goes in — the player's choice, any of the four. */
  readonly rotation: Rotation;
};

export type ActionType = Action['type'];
