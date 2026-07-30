import type {
  GameModule as KernelGameModule,
  ModuleBotSeats,
  ModuleContext as KernelModuleContext,
  ModuleHub,
} from '@game-hub/kernel';

/**
 * The host types, bound to what Labyrinth needs (the pattern in the hub's `docs/game-creation.md` §3).
 *
 * A game package can't name the backend's concrete `ModuleContext`/`GameHub`/`BotRepository` — that would
 * be a dependency on the host, which is exactly what the four-subpath contract forbids — so it binds the
 * kernel's **structural** host interfaces instead.
 *
 * Labyrinth is the **routeless** variant: it has no per-action randomness (all of it is spent in
 * `createGame`), so no endpoint of its own needs to roll anything and `App` stays at its `unknown` default.
 * It also opens no table of its own, so `Db` stays `unknown`.
 */
export type ModuleContext = KernelModuleContext<unknown, ModuleHub, ModuleBotSeats>;

/** Labyrinth's `GameModule`, over its own state and action types. */
export type GameModule<S, A> = KernelGameModule<S, A, ModuleContext>;
