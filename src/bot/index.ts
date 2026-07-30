import type { SeatedView } from '@game-hub/kernel/bot';
import type { LabyrinthPlayerView } from '../engine';

/**
 * `@game-hub/game-labyrinth/bot` — the AI.
 *
 * **Status: a typed placeholder.** The bot lands in **L5**, once L1/L2 have given it something to search.
 * There is no honest partial version: a bot that returns an arbitrary legal action is worse than no bot,
 * because a host would happily seat it.
 *
 * What L5 adds here (over the `@game-hub/kernel/bot` helpers): `decide(view, botId)` searching
 * insertion × rotation × reachable-square — ≤ 12 arrows × 4 rotations, minus the one illegal reverse, times
 * the flood-filled reachable set, which is bounded but a genuine search, unlike any hosted game's bot;
 * a greedy baseline scored **against the treasure**, not the hop (the standing hazard: a greedy bot that
 * scores each step can't see a multi-step payoff and never starts one); `playSelfPlay` at every seat count;
 * and a `benchmark` export for win-rate calibration. The `src/bot/**` 90% coverage gate turns on with it —
 * see the note in `vitest.config.ts`.
 *
 * ⚠️ **The bot decides from the redacted view, never from `LabyrinthState`** — it may not see an opponent's
 * face-down stack, and may not see past the top card of its *own* (pg. 2). `assertBotTurn` (kernel) is the
 * ended/not-your-turn preamble every `decide` opens with, and it reads exactly the structural slice aliased
 * below — L3's `viewFor` return type satisfies it.
 *
 * ⚠️ Bound to `LabyrinthPlayerView` (L3's projection), **not** `LabyrinthPlayer`: a seat in a view carries a
 * `stackCount` and a `stack` that is `null` for every seat but the viewer's, so binding the *state's* player
 * type here would have let a bot compile against cards it is never handed. Corrected at L3 — the placeholder
 * had it wrong, which is the sort of thing only writing the real projection finds.
 */
export type LabyrinthBotView = SeatedView<LabyrinthPlayerView>;
