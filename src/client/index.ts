import { lazy } from 'react';
import type { LabyrinthView } from '../engine/index.js';
import type { GameClient } from './types.js';
import { GAME_TYPE } from './api.js';
import { LabyrinthStatus } from './Status.js';

/**
 * `@game-hub/game-labyrinth/client` — the UI seam (L4).
 *
 * Keep this file **tiny**. The board is `lazy` and everything expensive lives behind it: a games room must
 * not ship Labyrinth's board (and with it the engine slice the board imports) to somebody who only opened
 * the home screen. Importing anything heavy *here* would quietly undo that, and the failure is invisible —
 * the app still works, it just got bigger. ⚠️ Code-splitting a dynamic `import()` from inside `node_modules`
 * is the thing Track D §3 called out as needing to survive publication; this is the line that depends on it.
 *
 * ⚠️ **Tailwind, for whoever wires this game into a host (D2d):** this package ships utility classes in its
 * source and **no CSS**. Tailwind v4's automatic content detection does not descend into `node_modules`, so
 * the host must scan the installed package explicitly — the hub's `ui/src/index.css` already carries
 * `@source '../node_modules/@game-hub'`, which covers it. Without that the board's *layout* falls apart; the
 * maze itself still draws, because the tile picture is inline SVG with literal fills (`TileFace.tsx`) rather
 * than utility classes. See `docs/d2c-findings.md` §11.
 *
 * **Status: the functional stage.** The board is complete and playable; the artwork is not. L4b is a
 * comps-first pass that replaces the tile fills, the treasure marks and the pawns with original
 * illustration — see `ROADMAP.md`. Nothing in this seam changes for it.
 */
export const labyrinthClient: GameClient<LabyrinthView> = {
  id: GAME_TYPE,
  name: 'Labyrinth',
  blurb:
    'A race for treasures through a maze that moves: slide a fresh corridor into the board every turn, then walk as far as the paths let you.',
  rules: [
    '2–4 players. You hold a face-down stack of treasure cards and may look at the top one only — that is what you are hunting.',
    'A turn is two steps, in this order: slide the maze, then move your pawn. The slide is compulsory.',
    'Turn the extra tile whichever way you like and push it in at one of the 12 arrows; the tile at the far end pops out and becomes the next spare.',
    'You may not push the tile straight back in where it just came out — that one arrow is crossed out for the turn.',
    'A pawn on the tile pushed off the board wraps round onto the tile you just inserted. That move is free.',
    'Then walk as far as you like along connected corridors, or stay put. Stop on your treasure to turn its card face up.',
    'Flip every card and get your pawn home to your own colour’s corner to win.',
  ],
  // The box-lid mark (kernel 1.3.0's optional `Icon`). Lazy for the same reason as `Board`: the picker
  // shows every hosted game, so an eager icon would ship this game's art to whoever only opened the home
  // screen. See `Icon.tsx` for why it draws its own tile rather than reusing `TileFace`.
  Icon: lazy(() => import('./Icon.js')),
  Board: lazy(() => import('./Board.js')),
  Status: LabyrinthStatus,
};

// The package-contract entry point (Track D / D0): a host's generated registry imports each game's client as
// a default. The named export stays for callers that reference `labyrinthClient` directly.
export default labyrinthClient;

// The settled bindings, re-exported so a host (and this package's own tests) can name what they are holding.
export type { BoardProps, GameClient } from './types.js';
export { act, fetchGame, GAME_TYPE, sendAction } from './api.js';
export type { LabyrinthPayload, LabyrinthView } from './api.js';
export { describeMoveRecord } from './describe.js';
export { LabyrinthStatus } from './Status.js';
