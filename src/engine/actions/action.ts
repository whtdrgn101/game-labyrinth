import type { Insertion, Position, Rotation } from '../core';

/**
 * Everything a player can do in a Labyrinth turn. `applyAction` is the turn-aware entry point.
 *
 * A turn is two mandatory-ordered steps (pg. 2) and the union has exactly one arm per step: `INSERT` —
 * "insert the extra path tile into the game board where one of the arrows is" — and then `MOVE`, which is
 * also what ends the turn. A turn is therefore always exactly two actions, neither skippable, and there is
 * **no separate "stay put" action**: leaving your piece where it is (pg. 2) is a `MOVE` to the square it
 * already stands on, which is always reachable (ROADMAP ruling 11).
 *
 * Every field is public: an action is logged verbatim, and nothing here touches a player's face-down
 * stack. Unlike Can't Stop there is no server-only arm — Labyrinth spends all its randomness at setup,
 * so every action is a player's own free choice and safe to accept from a client.
 */
export type Action =
  | {
      readonly type: 'INSERT';
      /** Which of the 12 arrows (pg. 2). */
      readonly insertion: Insertion;
      /** How the extra tile is turned before it goes in — the player's choice, any of the four. */
      readonly rotation: Rotation;
    }
  | {
      readonly type: 'MOVE';
      /** Where the piece ends up: any square reachable along open corridors, or the one it stands on. */
      readonly target: Position;
    };

export type ActionType = Action['type'];
