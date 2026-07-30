import type { Viewer, WinnersEndState } from '@game-hub/kernel';
import type {
  Board,
  Insertion,
  LabyrinthPlayer,
  LabyrinthState,
  MoveRecord,
  Phase,
  PlayerColor,
  Position,
  Tile,
  TreasureName,
} from './core/index.js';

// `Viewer` is a kernel primitive; re-export it so consumers take it from this surface rather than
// reaching for the kernel themselves (the convention every hub game's `view.ts` follows).
export type { Viewer } from '@game-hub/kernel';

/**
 * A seat projected for a viewer.
 *
 * Labyrinth's one secret is the face-down treasure stack, and it is a **structured** secret: even its owner
 * may look at only the top card ("Each player lays his treasure cards down in front of him on the table in a
 * pile without looking at them. … Each player looks at the first card of his stack of treasure cards without
 * showing it to the other players", pg. 1 Set Up / pg. 2). So three things are true at once and the shape
 * has to say all three:
 *
 * - **How many cards are still face down is public** — the pile is on the table and everyone can count it.
 *   That is `stackCount`, present for every seat including the viewer's own.
 * - **What they are is nobody's** — not even the owner's, beyond the top one. Hence `stack` is *not* the
 *   pile: it is at most one card long.
 * - **`found` is public**, face up beside the pile (pg. 2).
 *
 * ⚠️ `stack` is deliberately **not** "this seat's stack, when you're allowed to see it". Read `stackCount`
 * for the size of the pile and `stack[0]` for the treasure being hunted; `stack.length` is 0 or 1 while the
 * game runs and answers no question worth asking. The `null` arm is what an opponent's pile looks like — a
 * different type from an array, so a consumer cannot accidentally treat "hidden" as "empty".
 */
export interface LabyrinthPlayerView {
  readonly id: string;
  readonly name: string;
  /** The pawn's colour, and so its home corner (pg. 1) — public; the pawn is on the board. */
  readonly color: PlayerColor;
  readonly position: Position;
  /** Treasures already turned face up (pg. 2) — public. */
  readonly found: readonly TreasureName[];
  /** How many cards remain face down. Public: the pile is countable at the table. */
  readonly stackCount: number;
  /**
   * The viewer's own next target as a one-card array (`[]` once the pile is empty), `null` for every other
   * seat — and the **whole** pile for every seat once the game has ended and the cards go face up.
   */
  readonly stack: readonly TreasureName[] | null;
}

/**
 * A Labyrinth game projected for one viewer — the same shape as the state, with every face-down stack
 * redacted to what its holder is entitled to see.
 *
 * Everything else is public *verbatim*, and most of it unavoidably so: the maze, the extra tile, the last
 * push and every pawn are all sitting on the table. In particular **the 24 treasures printed on the tiles
 * are public** — they are printed on the board — so "no treasure name appears in a view" was never the
 * invariant. The invariant is that a view never says **who holds which card**, which is exactly what the
 * `stack` field above is the only channel for.
 */
// Intersection (not `interface extends`) so it distributes over the end-state union and keeps `status` as
// the discriminant — an interface can't extend a union (the same reason `LabyrinthState` is written this way).
export type LabyrinthView = {
  readonly id: string;
  readonly players: readonly LabyrinthPlayerView[];
  readonly activePlayerIndex: number;
  readonly turn: number;
  readonly board: Board;
  readonly extraTile: Tile;
  readonly lastPush: Insertion | null;
  readonly phase: Phase;
  /** Who this projection was built for, echoed back so a client knows which seat(s) it is holding. */
  readonly viewerId: Viewer;
  readonly version: number;
  /** The public move log. Everything the engine records is public by construction (`internal/record.ts`). */
  readonly log: readonly MoveRecord[];
} & WinnersEndState;

/**
 * Does `viewer` hold the seat `playerId`? A client can hold several seats (hotseat) or none at all — a
 * spectator (`null` / `[]`) holds nothing and therefore sees no top card anywhere.
 */
function owns(viewer: Viewer, playerId: string): boolean {
  if (viewer === null) return false;
  return typeof viewer === 'string' ? viewer === playerId : viewer.includes(playerId);
}

/** One seat, with its stack cut down to whatever this viewer is entitled to (see `LabyrinthPlayerView`). */
function projectPlayer(player: LabyrinthPlayer, stack: readonly TreasureName[] | null): LabyrinthPlayerView {
  return {
    id: player.id,
    name: player.name,
    color: player.color,
    position: player.position,
    found: player.found,
    stackCount: player.stack.length,
    stack,
  };
}

/**
 * Redact a game for one viewer — the only thing standing between a client and another player's cards, and
 * the reason this game was worth building for the platform (it is the first hosted game whose secret is
 * hidden from its **owner** too).
 *
 * Three cases, and they are the whole function:
 *
 * 1. **The game has ended** — everything is revealed, full stacks included. There is nothing left to protect
 *    and a final screen that can't show what the loser still held would be hiding data for no reason.
 * 2. **A seat this viewer holds** — the top card and no further (pg. 2). Redacting a player *from himself*
 *    is new for the platform and is the point: a player must not be able to read his own future card order
 *    out of the network tab, any more than he may fan out the physical pile.
 * 3. **Every other seat** (which is *all* of them for a spectator) — `stack: null`, with `stackCount` for
 *    the only thing the table can honestly see.
 *
 * ⚠️ The view is built **field by field**, never by spreading the state. That is deliberate: a secret added
 * to `LabyrinthState` later cannot ride along into a view by default — it has to be written in here, where
 * the decision to publish it is visible in the diff. The cost is that a *public* field added later must be
 * added here too, which a client notices immediately; the alternative fails the other way round, silently.
 */
export function viewFor(state: LabyrinthState, viewer: Viewer): LabyrinthView {
  const revealAll = state.status === 'ended';
  const players = state.players.map((player) =>
    projectPlayer(
      player,
      // pg. 2: the first card of your stack, and only that. `slice(0, 1)` is `[]` on an empty pile, which is
      // exactly the "every card flipped, only the walk home left" case.
      revealAll ? player.stack : owns(viewer, player.id) ? player.stack.slice(0, 1) : null,
    ),
  );

  const table = {
    id: state.id,
    players,
    activePlayerIndex: state.activePlayerIndex,
    turn: state.turn,
    board: state.board,
    extraTile: state.extraTile,
    lastPush: state.lastPush,
    phase: state.phase,
    viewerId: viewer,
    version: state.version,
    log: state.log,
  };

  // Narrow on `status` rather than copying both arms blindly: the `active` arm has no `winnerIds` to copy,
  // and the union keeps it that way in the view too.
  return state.status === 'ended'
    ? { ...table, status: 'ended', winnerIds: state.winnerIds }
    : { ...table, status: 'active' };
}
