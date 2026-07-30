import { KERNEL_CONTRACT_VERSION } from '@game-hub/kernel';
import { MAX_PLAYERS, MIN_PLAYERS, SEAT_COLORS } from '../engine';

/**
 * `@game-hub/game-labyrinth/module` — the backend seam.
 *
 * **Status: a typed placeholder.** The `GameModule` implementation lands in **L3**, because a module is
 * nothing but a delegation layer over engine mechanics that L1/L2 have yet to add (`applyAction`,
 * `legalActions`, `parseAction`, `viewFor`). Rather than ship a module object whose members throw — which
 * would register successfully with a host and then fail mid-game — this subpath exports only what is
 * genuinely settled now: the game's static identity, and the bound host types L3 will implement against.
 *
 * What L3 adds here (per the hub's `docs/game-creation.md` §3): `index.ts`'s module object, `createGame.ts`,
 * `parseAction.ts`, `errors.ts` (the `GameError` → HTTP map), and `viewFor` — the interesting one, since
 * Labyrinth hides a *structured* secret: each player's face-down stack, of which even its owner sees only
 * the top card (pg. 2).
 */
export type { GameModule, ModuleContext } from './context';

/**
 * The game's static identity — the fields the host's registry validates, split out so L3's module object
 * spreads them rather than restating them.
 *
 * `kernelContract` is taken from the kernel this package compiled against, never a literal: if this game
 * ever resolves a *different* `@game-hub/kernel` copy, the constant carries that copy's number and the host
 * rejects it at boot instead of failing later (kernel `contract.ts`).
 *
 * `colors` are the platform's per-seat player tints. ⚠️ In Labyrinth a pawn's colour is **rules data** — it
 * names the corner you start on and must return to (pg. 1/pg. 2) — so unlike every other hosted game these
 * ids are not free to be re-picked per seat. They mirror the engine's `SEAT_COLORS` exactly, and L3 must not
 * let the platform's colour-picking coordination state drift from them. Logged in `docs/d2c-findings.md`.
 */
export const LABYRINTH_INFO = {
  id: 'labyrinth',
  name: 'Labyrinth',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  colors: SEAT_COLORS,
  kernelContract: KERNEL_CONTRACT_VERSION,
} as const;
