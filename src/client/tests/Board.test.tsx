// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { legalInsertions, reachableFrom, START_CORNERS } from '../../engine';
import type { LabyrinthView } from '../../engine';

/**
 * The board's component tests.
 *
 * ⚠️ `../api` is mocked wholesale: every affordance on this board ends in one `act()` call, so the mock is
 * both the assertion surface ("clicking here sends *that* action") and what keeps the suite off the network.
 * The board is imported **after** the mock is registered, which `vi.mock`'s hoisting handles.
 *
 * These tests are deliberately written against the **engine's own answers** — `legalInsertions`,
 * `reachableFrom`, `START_CORNERS` — rather than against hard-coded coordinates. A board test that restated
 * the rules would pass while disagreeing with the game; this way, a board that disagrees with the engine
 * fails even if both are self-consistent.
 */
vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, act: vi.fn(() => Promise.resolve({ state: null } as never)) };
});

import * as api from '../api';
import LabyrinthBoard from '../Board';
import { activeSquare, afterOneTurn, boardProps, endedGame, readyToMove, seededGame, view, withStack } from './helpers';

const act = vi.mocked(api.act);

/** Render the board over a projected view. Returns the props so a test can assert on the spies. */
function renderBoard(game: LabyrinthView, overrides: Parameters<typeof boardProps>[1] = {}) {
  const props = boardProps(game, overrides);
  render(<LabyrinthBoard {...props} />);
  return props;
}

beforeEach(() => {
  act.mockClear();
});
afterEach(() => {
  cleanup();
});

describe('the maze', () => {
  it('draws all 49 squares, at engine coordinates', () => {
    renderBoard(view(seededGame(), ['p1']));
    const tiles = document.querySelectorAll('[data-testid^="tile-"]');
    expect(tiles).toHaveLength(49);
    expect(screen.getByTestId('tile-0-0')).toBeDefined();
    expect(screen.getByTestId('tile-6-6')).toBeDefined();
  });

  it('marks the 16 printed tiles as fixed — exactly the even/even squares (pg. 1)', () => {
    renderBoard(view(seededGame(), ['p1']));
    const fixed = document.querySelectorAll('[data-testid^="tile-"][data-fixed="true"]');
    expect(fixed).toHaveLength(16);
    expect(screen.getByTestId('tile-0-0').getAttribute('data-fixed')).toBe('true');
    expect(screen.getByTestId('tile-1-0').getAttribute('data-fixed')).toBe('false');
  });

  // Ruling 12: the corner is named by the pawn's colour, never by the seat index. Seat 1 defaults to red
  // (top-left) and seat 2 to yellow (top-right), so the pawns must be on those two corners and nowhere else.
  it('puts each pawn on its own colour’s corner, from view.players[].color', () => {
    const game = view(seededGame(), ['p1']);
    renderBoard(game);
    for (const player of game.players) {
      const home = START_CORNERS[player.color];
      const tile = screen.getByTestId(`tile-${String(home.row)}-${String(home.col)}`);
      expect(within(tile).getByTestId(`pawn-${player.id}`).getAttribute('data-color')).toBe(player.color);
    }
  });

  it('draws every treasure printed on the board — the tiles are public', () => {
    renderBoard(view(seededGame(), ['p1']));
    const marked = document.querySelectorAll('[data-testid^="tile-"][data-treasure]');
    // 12 treasures on the 16 fixed tiles + however many of the 12 movable ones this seed put on the board
    // (one of the 34 is always the spare, so 11 or 12 of them are).
    expect(marked.length).toBeGreaterThanOrEqual(23);
    expect(marked.length).toBeLessThanOrEqual(24);
  });
});

describe('the 12 arrows', () => {
  it('renders exactly the 12 arrows of pg. 2, keyed by side and line', () => {
    renderBoard(view(seededGame(), ['p1']));
    expect(document.querySelectorAll('[data-testid^="arrow-"]')).toHaveLength(12);
    for (const insertion of legalInsertions(seededGame())) {
      expect(screen.getByTestId(`arrow-${insertion.side}-${String(insertion.line)}`)).toBeDefined();
    }
  });

  it('offers all 12 on the first turn — nothing has been pushed out yet', () => {
    renderBoard(view(seededGame(), ['p1']));
    const live = document.querySelectorAll('[data-testid^="arrow-"][data-legal="true"]');
    expect(live).toHaveLength(12);
    expect(document.querySelectorAll('[data-testid^="arrow-"]:disabled')).toHaveLength(0);
  });

  // pg. 2, "The only exception": the tile cannot go back in where it was just pushed out. Seat 1 pushed at
  // the north arrow of line 1, so the south arrow of line 1 is the one that must be dead.
  it('disables exactly the banned reverse arrow, and matches legalInsertions', () => {
    const state = afterOneTurn();
    renderBoard(view(state, ['p1', 'p2']));

    const legal = new Set(legalInsertions(state).map((i) => `${i.side}-${String(i.line)}`));
    expect(legal.size).toBe(11);

    for (const element of document.querySelectorAll('[data-testid^="arrow-"]')) {
      const key = element.getAttribute('data-testid')!.replace('arrow-', '');
      expect(element.getAttribute('data-legal')).toBe(legal.has(key) ? 'true' : 'false');
    }

    const banned = screen.getByTestId('arrow-south-1');
    expect(banned.getAttribute('data-legal')).toBe('false');
    expect((banned as HTMLButtonElement).disabled).toBe(true);
    expect(banned.getAttribute('aria-label')).toContain('blocked this turn');
  });

  it('explains the banned arrow on hover rather than hiding it (pg. 2’s own hint)', async () => {
    renderBoard(view(afterOneTurn(), ['p1', 'p2']));
    // The tip hangs off the ActionTip wrapper, not the button — which is exactly why a *disabled* arrow can
    // still explain itself. (The shared tip opens after a 150ms hover delay, hence `findBy`.)
    fireEvent.pointerEnter(screen.getByTestId('arrow-south-1').parentElement!);
    expect((await screen.findByRole('tooltip')).textContent).toContain('cannot go straight back in');
  });

  it('sends INSERT with the chosen facing when an arrow is pressed', () => {
    const state = seededGame();
    renderBoard(view(state, ['p1']));
    fireEvent.click(screen.getByTestId('arrow-east-3'));
    expect(act).toHaveBeenCalledTimes(1);
    // Untouched, the facing offered is the spare tile's own — it comes off the board at the angle it left at.
    expect(act.mock.calls[0]?.slice(0, 3)).toEqual([
      'g1',
      'p1',
      { type: 'INSERT', insertion: { side: 'east', line: 3 }, rotation: state.extraTile.rotation },
    ]);
  });

  it('goes dead in the move phase — the slide is step 1 and happens once (pg. 2)', () => {
    renderBoard(view(readyToMove(), ['p1']));
    expect(document.querySelectorAll('[data-testid^="arrow-"]:disabled')).toHaveLength(12);
    fireEvent.click(screen.getByTestId('arrow-east-3'));
    expect(act).not.toHaveBeenCalled();
  });
});

describe('the extra tile', () => {
  it('shows the spare at its own facing', () => {
    const state = seededGame();
    renderBoard(view(state, ['p1']));
    const extra = screen.getByTestId('extra-tile');
    expect(extra.getAttribute('data-tile-id')).toBe(state.extraTile.id);
    expect(extra.getAttribute('data-rotation')).toBe(String(state.extraTile.rotation));
  });

  it('cycles through the four facings and back, clockwise and anticlockwise', () => {
    const state = seededGame();
    renderBoard(view(state, ['p1']));
    const extra = screen.getByTestId('extra-tile');
    const start = Number(extra.getAttribute('data-rotation'));

    const cw = screen.getByTestId('extra-rotate-cw');
    fireEvent.click(cw);
    expect(Number(extra.getAttribute('data-rotation'))).toBe((start + 90) % 360);
    fireEvent.click(cw);
    fireEvent.click(cw);
    expect(Number(extra.getAttribute('data-rotation'))).toBe((start + 270) % 360);
    fireEvent.click(cw);
    expect(Number(extra.getAttribute('data-rotation'))).toBe(start);

    fireEvent.click(screen.getByTestId('extra-rotate-ccw'));
    expect(Number(extra.getAttribute('data-rotation'))).toBe((start + 270) % 360);
  });

  it('sends the facing the player chose, not the tile’s own', () => {
    const state = seededGame();
    renderBoard(view(state, ['p1']));
    fireEvent.click(screen.getByTestId('extra-rotate-cw'));
    fireEvent.click(screen.getByTestId('arrow-north-1'));
    expect(act.mock.calls[0]?.[2]).toEqual({
      type: 'INSERT',
      insertion: { side: 'north', line: 1 },
      rotation: (state.extraTile.rotation + 90) % 360,
    });
  });
});

describe('the move phase', () => {
  // Seed 1 opens 21 squares to the pawn on the clock — an ordinary, roomy position.
  it('highlights exactly reachableFrom, and nothing else', () => {
    const state = readyToMove(1);
    renderBoard(view(state, ['p1']));

    const active = state.players[state.activePlayerIndex]!;
    const expected = new Set(
      reachableFrom(state.board, active.position).map((p) => `tile-${String(p.row)}-${String(p.col)}`),
    );
    expect(expected.size).toBe(21); // the origin is always in the set; a real maze offers more

    for (const element of document.querySelectorAll('[data-testid^="tile-"]')) {
      const id = element.getAttribute('data-testid')!;
      expect(element.getAttribute('data-reachable')).toBe(expected.has(id) ? 'true' : 'false');
    }
  });

  it('sends MOVE for a reachable square, and refuses an unreachable one', () => {
    const state = readyToMove(1);
    renderBoard(view(state, ['p1']));
    const active = state.players[state.activePlayerIndex]!;
    const reach = reachableFrom(state.board, active.position);
    const target = reach.find((p) => p.row !== active.position.row || p.col !== active.position.col)!;

    fireEvent.click(screen.getByTestId(`tile-${String(target.row)}-${String(target.col)}`));
    expect(act.mock.calls[0]?.[2]).toEqual({ type: 'MOVE', target: { row: target.row, col: target.col } });

    const unreachable = document.querySelector('[data-testid^="tile-"][data-reachable="false"]')!;
    expect((unreachable as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(unreachable);
    expect(act).toHaveBeenCalledTimes(1);
  });

  // Ruling 11 / pg. 2 "Or, you can leave your playing piece where it is" — a button, never a missing option.
  it('“Stay put” sends a MOVE to the pawn’s own square', () => {
    const state = readyToMove(1);
    renderBoard(view(state, ['p1']));
    const here = activeSquare(state);

    const stay = screen.getByTestId('stay-put') as HTMLButtonElement;
    expect(stay.disabled).toBe(false);
    fireEvent.click(stay);
    expect(act.mock.calls[0]?.[2]).toEqual({ type: 'MOVE', target: { row: here.row, col: here.col } });
  });

  /**
   * Seed 7 walls the pawn into its own corner after the opening slide — the flood-fill is *just* the square
   * it stands on. That is a real position, not a broken one (`legalActions` in the move phase is never
   * empty), and it is the case that would look like a hung board if "stay put" were an implicit option
   * instead of a button. The turn must still be completable.
   */
  it('leaves a sealed-in pawn a way to finish its turn', () => {
    const state = readyToMove(7);
    const active = state.players[state.activePlayerIndex]!;
    expect(reachableFrom(state.board, active.position)).toHaveLength(1);

    renderBoard(view(state, ['p1']));
    expect(document.querySelectorAll('[data-testid^="tile-"][data-reachable="true"]')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('stay-put'));
    expect(act.mock.calls[0]?.[2]).toEqual({ type: 'MOVE', target: active.position });
  });

  it('offers no move affordances during the insert phase', () => {
    renderBoard(view(seededGame(), ['p1']));
    expect((screen.getByTestId('stay-put') as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelectorAll('[data-testid^="tile-"][data-reachable="true"]')).toHaveLength(0);
  });
});

describe('the hunted card', () => {
  it('shows the viewing seat’s own top card — and only the top one (pg. 2)', () => {
    const state = withStack(seededGame(), 'p1', ['ruby', 'skull', 'crown']);
    renderBoard(view(state, ['p1']));
    const card = screen.getByTestId('hunted-card');
    expect(card.getAttribute('data-treasure')).toBe('ruby');
    expect(card.getAttribute('data-facedown')).toBe('false');
    expect(card.textContent).toContain('ruby');
    expect(card.textContent).not.toContain('skull');
  });

  it('draws a card back for a spectator — a null stack is hidden, never empty', () => {
    renderBoard(view(seededGame(), null));
    const card = screen.getByTestId('hunted-card');
    expect(card.getAttribute('data-facedown')).toBe('true');
    expect(card.getAttribute('data-treasure')).toBeNull();
    expect(card.textContent).toContain('only its owner may look');
  });

  it('falls back to this client’s own seat while another seat is on the clock', () => {
    const state = withStack(afterOneTurn(), 'p1', ['crown']);
    expect(state.players[state.activePlayerIndex]!.id).toBe('p2'); // Bob is up …
    renderBoard(view(state, ['p1'])); // … but this client holds Ann
    expect(screen.getByTestId('hunted-card').getAttribute('data-treasure')).toBe('crown');
  });

  it('says “get home” once every card is flipped', () => {
    const state = withStack(seededGame(), 'p1', []);
    renderBoard(view(state, ['p1']));
    const card = screen.getByTestId('hunted-card');
    expect(card.getAttribute('data-facedown')).toBe('false');
    expect(card.textContent).toContain('Every treasure found');
  });
});

describe('the seats', () => {
  it('shows each seat’s face-down count and face-up row', () => {
    const state = seededGame();
    const withFound = {
      ...state,
      players: state.players.map((p) =>
        p.id === 'p2' ? { ...p, found: ['ruby' as const], stack: p.stack.slice(1) } : p,
      ),
    };
    renderBoard(view(withFound, ['p1']));

    expect(screen.getByTestId('seat-stack-p1').textContent).toContain('12 face down');
    expect(screen.getByTestId('seat-stack-p2').textContent).toContain('11 face down');
    expect(within(screen.getByTestId('seat-found-p2')).getByTestId('chip-ruby')).toBeDefined();
    expect(screen.getByTestId('seat-found-p1').textContent).toContain('nothing found yet');
  });

  it('reads a seat’s colour from the view, not from the shell’s palette', () => {
    // The shell says everyone is "emerald"; the rules say seat 1 is red on the red corner (ruling 12).
    renderBoard(view(seededGame(), ['p1']), { colors: { p1: 'emerald', p2: 'emerald' } });
    expect(screen.getByTestId('seat-p1').getAttribute('data-color')).toBe('red');
    expect(screen.getByTestId('seat-p2').getAttribute('data-color')).toBe('yellow');
  });
});

describe('seat binding', () => {
  it('drives every seat in hotseat (controlledIds null)', () => {
    renderBoard(view(afterOneTurn(), null), { controlledIds: null });
    expect((screen.getByTestId('arrow-north-3') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId('labyrinth-banner').textContent).toContain('Hotseat');
  });

  it('refuses to act for a seat this client does not hold', () => {
    renderBoard(view(afterOneTurn(), ['p1']), { controlledIds: ['p1'] }); // seat p2 is on the clock
    expect((screen.getByTestId('arrow-north-3') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('arrow-north-3'));
    expect(act).not.toHaveBeenCalled();
    expect(screen.getByTestId('labyrinth-banner').textContent).toContain('You are Ann');
  });

  it('refuses to act for a bot seat, and while the shell is busy', () => {
    renderBoard(view(seededGame(), ['p1']), { bots: ['p1'] });
    expect((screen.getByTestId('arrow-north-3') as HTMLButtonElement).disabled).toBe(true);
    cleanup();

    renderBoard(view(seededGame(), ['p1']), { busy: true });
    expect((screen.getByTestId('arrow-north-3') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('the end of the game', () => {
  it('renders the shared GameOver screen with the winner', () => {
    renderBoard(view(endedGame(), ['p1']));
    expect(screen.getByTestId('results')).toBeDefined();
    expect(screen.getByTestId('winner').textContent).toContain('Ann');
    expect(screen.getByTestId('standing-p2')).toBeDefined();
  });

  it('kills every affordance once the game is over', () => {
    renderBoard(view(endedGame(), ['p1']));
    expect(document.querySelectorAll('[data-testid^="arrow-"]:disabled')).toHaveLength(12);
    expect((screen.getByTestId('stay-put') as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelectorAll('[data-testid^="tile-"][data-reachable="true"]')).toHaveLength(0);
  });

  it('leaves for the hub from the end screen', () => {
    const props = renderBoard(view(endedGame(), ['p1']));
    fireEvent.click(screen.getByTestId('new-game-end'));
    expect(props.onLeave).toHaveBeenCalledTimes(1);
  });
});

describe('the activity feed', () => {
  it('renders the log through the shared feed, in Labyrinth’s own words', () => {
    renderBoard(view(afterOneTurn(), ['p1']));
    const feed = screen.getByTestId('labyrinth-log');
    expect(feed.textContent).toContain('pushed the extra tile in from the north along column 2');
    expect(feed.textContent).toContain('stayed put');
    expect(feed.textContent).toContain('Ann');
  });

  it('shows an empty label before anyone has moved', () => {
    renderBoard(view(seededGame(), ['p1']));
    expect(screen.getByTestId('labyrinth-log-empty').textContent).toContain('slide the maze to begin');
  });
});
