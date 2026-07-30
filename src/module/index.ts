import { KERNEL_CONTRACT_VERSION } from '@game-hub/kernel';
import type { GameSummary } from '@game-hub/kernel';
import { applyAction, legalActions, MAX_PLAYERS, MIN_PLAYERS, SEAT_COLORS, viewFor } from '../engine';
import type { Action, LabyrinthState, Viewer } from '../engine';
import type { GameModule } from './context';
import { newLabyrinthGame } from './createGame';
import type { NewGameOptions } from './createGame';
import { mapLabyrinthError } from './errors';
import { parseLabyrinthAction } from './parseAction';

/**
 * The game's static identity — the fields the host's registry validates, split out because both the module
 * object below and a host's catalog want them without restating either.
 *
 * `kernelContract` is taken from the kernel this package compiled against, never a literal: if this game
 * ever resolves a *different* `@game-hub/kernel` copy, the constant carries that copy's number and the host
 * rejects it at registration instead of failing later (kernel `contract.ts`).
 *
 * `colors` is the platform's per-seat palette — and in Labyrinth those ids are **rules data**: the four
 * pawn colours, each of which names the corner its holder starts on and must return to (pg. 1 Set Up,
 * pg. 2 Ending the Game). They are `SEAT_COLORS` verbatim, in clockwise corner order, so the platform's
 * palette-order default (seat *i* → `colors[i]`) reproduces the engine's own default assignment exactly.
 * ⚠️ A pick that *isn't* the default only reaches the rules once the kernel carries colours into
 * `createGame` — `docs/d2c-findings.md` §16, and the reason `./createGame.ts` already accepts them.
 */
export const LABYRINTH_INFO = {
  id: 'labyrinth',
  name: 'Labyrinth',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  colors: SEAT_COLORS,
  kernelContract: KERNEL_CONTRACT_VERSION,
} as const;

/**
 * `@game-hub/game-labyrinth/module` — the backend seam (L3).
 *
 * A delegation layer and nothing else: **no rule is stated here**, every member calls the engine. What the
 * module owns is the *host's* half of the conversation — which JSON counts as an action, which of a state's
 * fields a given client may see, which domain error is which HTTP status.
 *
 * Labyrinth is the plainest possible shape of that contract, and deliberately so:
 *
 * - **No `routes`.** All the randomness is spent in `createGame` (pg. 1 Set Up), so no endpoint of this
 *   game's own ever has to roll anything — unlike Can't Stop's dice, every Labyrinth action is a free
 *   choice by the player and is safe to accept over `/actions`.
 * - **No `pendingStep`.** A turn is exactly two actions, `INSERT` then `MOVE` (pg. 2), both taken by the
 *   seat on the clock — there is no multi-seat flow for the module to own.
 * - **No `onStateChanged`.** Nothing is pushed but the state itself, which the core already broadcasts
 *   per-viewer through `viewFor`.
 * - **No `schemaVersion`/`migrate`** — shape v1, like every other hosted game.
 * - **No `createBotDriver` yet** — the AI is L5, and a driver whose bot returns an arbitrary legal action
 *   would be worse than none, because a host would happily seat it.
 */
export const labyrinthModule: GameModule<LabyrinthState, Action> = {
  // `id`/`name`/seat bounds/`colors`/`kernelContract`, from the one declaration above.
  ...LABYRINTH_INFO,

  // Typed **wider** than the contract's `{ name }[]`: the implementation accepts each seat's chosen pawn
  // (pg. 1 Set Up — the colour is the corner), and a `{ name }` is a `{ name, color? }`, so it is still
  // assignable to `GameModule.createGame`. ⚠️ Callers reading `labyrinthModule.createGame` see the *kernel's*
  // narrower signature, so a host with picks to pass must call the barrel's `newLabyrinthGame` until the
  // contract carries colours itself (`docs/d2c-findings.md` §16). The wiring behind it is already done.
  createGame: (opts: NewGameOptions) => newLabyrinthGame(opts),

  applyAction: (state, playerId, action) => applyAction(state, playerId, action),

  legalActions: (state, playerId) => legalActions(state, playerId),

  // The whole reason this game is interesting to the platform: each seat's face-down stack is redacted to
  // its owner's **top card only** (pg. 2), and to a bare count for everyone else. See `engine/view.ts`.
  viewFor: (state, viewer) => viewFor(state, viewer as Viewer),

  parseAction: (raw) => parseLabyrinthAction(raw),

  /**
   * The secret-free digest behind the "games in progress" list.
   *
   * ⚠️ Only the five fields `GameSummary` declares. Per-seat progress ("3 of 6 treasures found") would be
   * the genuinely useful thing to show for this game and there is nowhere in the contract to put it — noted
   * in `docs/d2c-findings.md` §17 rather than smuggled in as an extra field the host would ignore.
   */
  summarize: (state): GameSummary => ({
    id: state.id,
    turn: state.turn,
    status: state.status,
    activePlayerId: state.players[state.activePlayerIndex]?.id ?? null,
    players: state.players.map((player) => ({ id: player.id, name: player.name })),
  }),

  versionOf: (state) => state.version,

  // Public by construction: the engine records only what is on the table (`internal/record.ts`), and a
  // `MOVE` payload carries the card just turned **face up**, never the one revealed under it.
  movesOf: (state) => state.log,

  mapError: (error) => mapLabyrinthError(error),
};

// The bound host types, re-exported so a consumer of this subpath can name what it is implementing against.
export type { GameModule, ModuleContext } from './context';

// Re-exported for the host's own test suites: a package exposes only its four barrels (no deep imports),
// so anything a backend test needs to unit-test directly has to come out through here — the precedent is
// Saint Petersburg's `mapStPetersburgError`.
export { mapLabyrinthError } from './errors';
export { parseLabyrinthAction } from './parseAction';
export { newLabyrinthGame } from './createGame';
export type { NewGameOptions } from './createGame';

// The package-contract entry point (Track D / D0): a host's generated registry imports each game's module
// as a default. The named export stays for callers that reference `labyrinthModule` directly.
export default labyrinthModule;
