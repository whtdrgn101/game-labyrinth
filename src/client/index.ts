/**
 * `@game-hub/game-labyrinth/client` — the UI seam.
 *
 * **Status: a typed placeholder.** The `GameClient` object (with its **lazy** `Board`) lands in **L4**, which
 * is a comps-first art slice: the classic enchanted-labyrinth theme with original illustrations, drawn fresh
 * in the house style. There is nothing honest to render before L1/L2 give the engine a slide and a move, so
 * this subpath ships only the settled bindings — the contract aliases and the typed REST calls.
 *
 * What L4 adds here: `Board.tsx` (lazy — non-negotiable; the landing must not ship the board chunk),
 * an optional non-lazy `Status`, the `blurb`/`rules` copy for the landing, and the board's own art.
 *
 * ⚠️ **Tailwind, for whoever wires this game into a host (D2d):** this package ships utility classes in its
 * source and **no CSS**. Tailwind v4's automatic content detection does not descend into `node_modules`, so
 * the host must scan the installed package explicitly — the hub's `ui/src/index.css` already carries
 * `@source '../node_modules/@game-hub'`, which covers it. Without that the board renders unstyled. See
 * `docs/d2c-findings.md`.
 */
export type { BoardProps, GameClient } from './types';
export { fetchGame, sendAction } from './api';
export type { LabyrinthView } from './api';
