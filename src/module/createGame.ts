import { createGame } from '../engine';
import type { LabyrinthState, NewPlayer, PlayerColor } from '../engine';

/**
 * What the host hands a module to open a game, **plus** each seat's chosen pawn colour.
 *
 * The kernel's `GameModule.createGame` (contract 1) is typed `players: { name: string }[]` — there is no
 * colour channel in the contract at all. A wider parameter type is still assignable to it (a `{ name }` is
 * a `{ name, color? }`), so this is forward-compatible rather than a fork: the day the kernel carries a
 * seat's pick through, this module already reads it. Until then every host in existence calls this with
 * names only, and `createGame` fills the pawns in palette order — which is exactly what the platform's own
 * colour default does, so the two agree by construction. See `docs/d2c-findings.md` §16.
 *
 * `color` is `string`, not `PlayerColor`: it comes off the wire, and validating it here would be a second
 * definition of "the four colours" sitting next to the engine's.
 */
export interface NewGameOptions {
  readonly id: string;
  readonly players: readonly { readonly name: string; readonly color?: string }[];
  readonly rng: () => number;
}

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
