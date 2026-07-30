import { createGame } from '../engine/index.js';
import type { Action, LabyrinthState, NewPlayer, PlayerColor } from '../engine/index.js';
import type { GameModule } from './context.js';

/**
 * What the host hands a module to open a game — **the kernel's own `createGame` parameter**, derived from
 * the contract rather than restated, so it cannot drift from it.
 *
 * History (worth keeping, because it is the D2c pilot's one contract change): kernel contract 1 typed the
 * member `players: { name: string }[]` with no colour channel at all, and Labyrinth needs one — a pawn
 * colour *is* the corner you start on and must return to (pg. 1 Set Up, pg. 2 Ending the Game), i.e. rules
 * data, not a tint. L3 worked around it by declaring a **wider** parameter here (still assignable, since a
 * `{ name }` is a `{ name, color? }`) and re-exporting `newLabyrinthGame` from the `./module` barrel so a
 * host with picks to pass could bypass `labyrinthModule.createGame`, whose visible signature was the
 * kernel's narrower one. That escape hatch is **retired**: `@game-hub/kernel` 1.2.0 carries each seat's
 * resolved colour into `createGame` (`docs/d2c-findings.md` §16 — the finding this repo raised and the
 * platform acted on), so the module now reads the pick straight off the contract type.
 *
 * `color` is `string`, not `PlayerColor`: it comes off the wire, and validating it here would be a second
 * definition of "the four colours" sitting next to the engine's.
 */
export type NewGameOptions = Parameters<GameModule<LabyrinthState, Action>['createGame']>[0];

/**
 * Open a fresh Labyrinth game. All of the game's randomness is spent here — the tile shuffle, every tile's
 * orientation and the treasure deal (pg. 1 Set Up) — from the host's injected `rng`; there is none per
 * action, so this is the only place the module touches it.
 *
 * ⚠️ The `as PlayerColor` is the one cast in this package, and it is deliberate: an unvalidated wire string
 * is handed straight to the engine so that `createGame` is the **single** judge of a legal colour, throwing
 * `INVALID_PLAYER_COLOR` (→ 400) for one that isn't or one that two seats asked for. A pre-check here would
 * either duplicate that rule or — worse — silently drop a bad pick and hand the player a corner they didn't
 * choose.
 */
export function newLabyrinthGame(opts: NewGameOptions): LabyrinthState {
  return createGame({
    id: opts.id,
    players: opts.players.map((player): NewPlayer => {
      // Spread-free so `color` is *absent* rather than explicitly `undefined` — `assignColors` reads the
      // difference between "picked nothing" and "picked something" off that.
      return player.color === undefined
        ? { name: player.name }
        : { name: player.name, color: player.color as PlayerColor };
    }),
    rng: opts.rng,
  });
}
