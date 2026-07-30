import type { LabyrinthView } from '../engine';

/**
 * Labyrinth's header status line — the shell's `Status` slot: whose turn it is and which of the turn's two
 * mandatory steps they owe (pg. 2, "A turn is always made up of two steps").
 *
 * Cheap and **non-lazy** on purpose: it renders the instant you enter a game, before the board chunk lands,
 * so it must not import anything heavy. The only engine import here is a *type*, which erases at build.
 */
export function LabyrinthStatus({ game }: { readonly game: LabyrinthView }) {
  const active = game.players[game.activePlayerIndex];
  const step = game.status === 'ended' ? 'game over' : game.phase === 'insert' ? 'slide the maze' : 'move your pawn';
  return (
    <span data-testid="turn-info" className="text-sm text-muted-foreground">
      Turn {game.turn} · <span className="font-medium text-foreground">{active?.name}</span> · {step}
    </span>
  );
}
