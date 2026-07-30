import { mulberry32 } from '@game-hub/kernel/bot';
import { BOARD_SIZE, START_CORNERS, TREASURES, legalActions, reachableFrom, tileAt } from '../../engine';
import type { Action, LabyrinthState, LabyrinthView, Position, TreasureName } from '../../engine';
import { labyrinthModule } from '../index';

// The seeded PRNG comes from `@game-hub/kernel/bot` rather than a third hand-rolled copy: these are *seam*
// tests, so leaning on the published package is honest here in a way it wouldn't be inside `src/engine`
// (`docs/d2c-findings.md` §13 — the ask is that `mulberry32` move onto the kernel's main barrel).
export { mulberry32 };

/**
 * Every treasure name a projected view mentions **outside the board and the extra tile**.
 *
 * The two stripped fields are face-up printed data: all 24 treasures are printed on the maze (pg. 1 board
 * photo), so "a view contains no treasure name" was never the invariant and a test asserting it would be
 * asserting something false. The real secret is **who holds which card**, and the only channel for it is a
 * player's `stack`. So this serializes everything else *whole* — players, log, and any field added later —
 * rather than spot-checking `stack`: the failure mode worth catching is a new field quietly shipping a pile.
 */
export function namedTreasures(view: LabyrinthView): readonly TreasureName[] {
  const { board: _board, extraTile: _extraTile, ...rest } = view;
  const serialized = JSON.stringify(rest);
  return TREASURES.filter((treasure) => serialized.includes(`"${treasure}"`));
}

/**
 * What a given viewer is *entitled* to read off a state: every seat's face-up `found` pile (public, pg. 2)
 * plus the top card of each seat this viewer holds (pg. 2) — and, once the game has ended, everything.
 */
export function entitledTreasures(state: LabyrinthState, viewer: string | null): readonly TreasureName[] {
  const held = state.players.flatMap((player) => {
    if (state.status === 'ended') return [...player.stack, ...player.found];
    const top = player.id === viewer ? player.stack.slice(0, 1) : [];
    return [...top, ...player.found];
  });
  return [...new Set(held)].sort();
}

/**
 * Assert the leak invariant for every seat *and* a spectator: what the module's `viewFor` names is exactly
 * what that viewer is entitled to, no more. Throws with the offending viewer named, so a failure inside a
 * 130-action playthrough says which projection broke.
 */
export function expectNoLeak(state: LabyrinthState): void {
  const viewers: readonly (string | null)[] = [...state.players.map((player) => player.id), null];
  for (const viewer of viewers) {
    const named = [...namedTreasures(labyrinthModule.viewFor(state, viewer) as LabyrinthView)].sort();
    const entitled = entitledTreasures(state, viewer);
    if (JSON.stringify(named) !== JSON.stringify(entitled)) {
      throw new Error(
        `viewFor leaked for viewer ${String(viewer)} at version ${String(state.version)}: ` +
          `named ${JSON.stringify(named)}, entitled to ${JSON.stringify(entitled)}`,
      );
    }
  }
}

/** The square whose tile bears `treasure`, or `null` if it is on the extra tile rather than the board. */
function squareOf(state: LabyrinthState, treasure: TreasureName): Position | null {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (tileAt(state.board, { row, col }).treasure === treasure) return { row, col };
    }
  }
  return null;
}

const distance = (a: Position, b: Position): number => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);

/**
 * How good a state is for `playerId`, lower being better: cards still to find first, then how far the pawn
 * is from whatever it is chasing — the treasure on its top card, or its home corner once the pile is empty
 * (pg. 2, "Ending the Game").
 *
 * ⚠️ The cards term dominates deliberately. Scoring distance alone makes a greedy policy *avoid* its own
 * treasure: landing on it flips the card and the next target is usually further away, so the winning move
 * looks like the worst one. That is a policy bug, not an engine one, and it is exactly the trap the L5 bot
 * has to be written around too — noted here because this driver walked straight into it.
 *
 * ⚠️ Everything it reads comes from the seat's own **redacted view**, never the state. That is the point of
 * driving the game this way: if a projection didn't carry enough to play from, this stalls instead of
 * quietly passing.
 */
function score(state: LabyrinthState, playerId: string): number {
  const view = labyrinthModule.viewFor(state, playerId) as LabyrinthView;
  const me = view.players.find((player) => player.id === playerId)!;
  const target = me.stack?.[0];
  const goal = target === undefined ? START_CORNERS[me.color] : squareOf(state, target);
  // A treasure can be sitting on the extra tile rather than the board — nothing to walk towards this turn,
  // so distance drops out and only the card count is left to compare.
  if (goal === null) return me.stackCount * 100;

  // Which distance matters depends on which half of the turn just happened (pg. 2). Having *inserted*, the
  // pawn hasn't moved yet, so a maze is good if it opens a path towards the goal — measure the best square
  // the flood-fill now offers. Having *moved*, the pawn is where it will sit until next turn, so measure
  // from where it actually stands. (Scoring a move by its reachable set would score every move in one
  // corridor identically, which is how the first draft of this driver managed to wander for 400 turns.)
  const walk =
    view.phase === 'move'
      ? Math.min(...reachableFrom(view.board, me.position).map((square) => distance(square, goal)))
      : distance(me.position, goal);
  return me.stackCount * 100 + walk;
}

/** Apply `action` the way a host does: parse the wire JSON first, then hand the *parsed* action over. */
function applyOverTheWire(state: LabyrinthState, playerId: string, action: Action): LabyrinthState {
  const parsed = labyrinthModule.parseAction(JSON.parse(JSON.stringify(action)) as unknown);
  if (!parsed.ok) throw new Error(`parseAction rejected a legal action: ${parsed.message}`);
  return labyrinthModule.applyAction(state, playerId, parsed.action);
}

export interface Playthrough {
  readonly state: LabyrinthState;
  readonly winnerId: string;
  readonly turns: number;
  readonly actions: number;
  /** How many per-viewer leak checks ran — one per seat plus a spectator, after every applied action. */
  readonly leakChecks: number;
}

export interface PlayOptions {
  readonly seed: number;
  readonly names: readonly string[];
  /** Chance of taking a random legal action instead of the greedy one, to escape a local minimum. */
  readonly epsilon?: number;
  readonly maxActions?: number;
}

/**
 * Play a whole game through the **module seam** — `createGame` → `parseAction` → `applyAction` — with a
 * greedy chase-your-treasure policy, checking every viewer's projection after every action.
 *
 * This stands in for the hub's backend module-seam suite, which an out-of-repo game cannot run
 * (`docs/d2c-findings.md` §6): it is the only thing here that proves the four members work *together* on a
 * real game rather than one at a time on a fixture.
 *
 * The policy is deliberately dumb — it is a driver, not L5's bot: greedily minimise the distance from the
 * pawn to whatever it is chasing, with an ε-greedy escape because pure greed can sit in a local minimum
 * (two seats pushing the same line back and forth), which the L2 playthroughs already measured.
 */
export function playToAWin(options: PlayOptions): Playthrough {
  const { seed, names, epsilon = 0.15, maxActions = 2000 } = options;
  const rng = mulberry32(seed);

  const perStepChecks = names.length + 1; // every seat, plus a spectator
  let state = labyrinthModule.createGame({ id: `seed-${String(seed)}`, players: names.map((name) => ({ name })), rng });
  expectNoLeak(state);

  let actions = 0;
  let leakChecks = perStepChecks;
  while (state.status === 'active') {
    if (actions >= maxActions) throw new Error(`no winner after ${String(actions)} actions (seed ${String(seed)})`);
    const active = state.players[state.activePlayerIndex]!;
    const candidates = labyrinthModule.legalActions(state);
    if (candidates.length === 0) throw new Error('legalActions came back empty on an active game');

    let chosen = candidates[Math.floor(rng() * candidates.length)]!;
    if (rng() >= epsilon) {
      let bestScore = Number.POSITIVE_INFINITY;
      for (const candidate of candidates) {
        // Candidates are *simulated* straight through `applyAction` — only the action actually taken goes
        // over the wire, since parsing is what the real move has to survive, not the search.
        const outcome = score(labyrinthModule.applyAction(state, active.id, candidate), active.id);
        if (outcome < bestScore) {
          bestScore = outcome;
          chosen = candidate;
        }
      }
    }

    state = applyOverTheWire(state, active.id, chosen);
    actions += 1;
    expectNoLeak(state);
    leakChecks += perStepChecks;
  }

  if (state.status !== 'ended') throw new Error('unreachable');
  return { state, winnerId: state.winnerIds[0]!, turns: state.turn, actions, leakChecks };
}

/** Convenience: `count` seats named P1…Pn. */
export const seats = (count: number): string[] => Array.from({ length: count }, (_unused, i) => `P${i + 1}`);

// Re-exported so a test can enumerate candidates without importing the engine barrel a second time.
export { legalActions };
