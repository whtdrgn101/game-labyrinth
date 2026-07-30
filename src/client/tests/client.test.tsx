// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { labyrinthClient } from '../index';
import { LABYRINTH_INFO } from '../../module';
import { readyToMove, view } from './helpers';

/**
 * The `GameClient` object itself — the landing-screen half of the seam, which no other test touches.
 *
 * The one non-obvious assertion is the **lazy** board: `Board` must be a `React.lazy` exotic component, not
 * an eagerly-imported one. A games room should not ship Labyrinth's board (and the engine slice behind it) to
 * somebody who opened the home screen, and the failure mode of getting this wrong is invisible at runtime —
 * the app still works, it is just bigger. Track D §3 flagged that a dynamic `import()` has to keep splitting
 * once the package lives in `node_modules`; this is the assertion that says we still asked for it.
 */
afterEach(() => {
  cleanup();
});

describe('labyrinthClient', () => {
  it('declares the same id the backend module registers', () => {
    expect(labyrinthClient.id).toBe(LABYRINTH_INFO.id);
    expect(labyrinthClient.name).toBe(LABYRINTH_INFO.name);
  });

  it('carries landing copy: a one-line blurb and a few how-to bullets', () => {
    expect(labyrinthClient.blurb.length).toBeGreaterThan(40);
    expect(labyrinthClient.rules?.length).toBeGreaterThanOrEqual(4);
    // The two rules a new player gets wrong first (pg. 2) must both be in the bullets.
    const rules = (labyrinthClient.rules ?? []).join(' ');
    expect(rules).toContain('slide the maze');
    expect(rules).toMatch(/may not push the tile straight back/);
  });

  it('keeps the board lazy', () => {
    const board = labyrinthClient.Board as unknown as { $$typeof: symbol; _payload: unknown };
    expect(board.$$typeof).toBe(Symbol.for('react.lazy'));
    expect(board._payload).toBeDefined();
  });

  it('renders a cheap, non-lazy status line for the shell header', () => {
    const Status = labyrinthClient.Status!;
    render(<Status game={view(readyToMove(), ['p1'])} />);
    const info = screen.getByTestId('turn-info');
    expect(info.textContent).toContain('Turn 1');
    expect(info.textContent).toContain('Ann');
    expect(info.textContent).toContain('move your pawn');
  });
});
