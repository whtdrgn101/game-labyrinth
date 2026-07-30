import type { MoveRecord } from '../engine';

/**
 * Labyrinth's move log in plain English — the game-specific half of the ui-kit's shared `ActivityFeed`.
 *
 * The platform deliberately has no human-readable field on `MoveRecord` (`docs/d2c-findings.md` §14): the
 * feed renders the actor's name and bot badge itself and asks each game for the rest of the sentence. So
 * **everything a line says has to be in the payload**, and Labyrinth's two payloads were designed against
 * these sentences:
 *
 * - `INSERT` → `{ side, line, rotation, tileId, ejectedTileId, wrapped }`
 * - `MOVE`   → `{ from, to, flipped, won }`
 *
 * Two things this function must never do, both of which would leak a secret into a public feed:
 *
 * - ⚠️ **Never say what a player is hunting.** The card revealed *under* a flip is deliberately absent from
 *   the payload (pg. 2 — a player looks at his next card without showing it), and it must not be fetched
 *   from the projected state and rendered here either: the feed is shown to every seat.
 * - ⚠️ **Never read anything but the payload and the public seat names.** A line is a function of the log
 *   entry, which is the same for every viewer; anything else would render differently per seat.
 *
 * ## Coordinates
 *
 * Prose is **1-based** ("row 3, column 6") because a board game's rows are counted from one at a table.
 * The engine — and therefore every `data-testid` on the board, which is the e2e contract — is **0-based**.
 * The conversion happens here and in the board's `aria-label`s, and nowhere else.
 */

/** The public seat data a line may name: an id and a display name, nothing more. */
export interface SeatName {
  readonly id: string;
  readonly name: string;
}

const nameOf = (players: readonly SeatName[], id: string): string => players.find((p) => p.id === id)?.name ?? id;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** A `{ row, col }` off the wire, or `null` — the payload is typed `unknown` by the kernel's `MoveRecord`. */
function readPosition(value: unknown): { row: number; col: number } | null {
  if (!isRecord(value)) return null;
  const { row, col } = value;
  if (typeof row !== 'number' || typeof col !== 'number') return null;
  return { row, col };
}

/** "row 3, column 6" — 1-based, see the note above. */
function square(position: { row: number; col: number }): string {
  return `row ${String(position.row + 1)}, column ${String(position.col + 1)}`;
}

/**
 * Which line an arrow pushes along. `line` is a **column** for the north/south arrows and a **row** for the
 * east/west ones (`internal/insertions.ts`) — the arrow points across the board, so it names the line
 * perpendicular to its own edge. Saying "column 4" where the engine means column 3 would be the one way
 * this sentence could mislead, so the naming comes from the same fact the geometry does.
 */
function lineLabel(side: string, line: number): string {
  const oneBased = String(line + 1);
  return side === 'north' || side === 'south' ? `column ${oneBased}` : `row ${oneBased}`;
}

function describeInsert(payload: Record<string, unknown> | undefined, players: readonly SeatName[]): string {
  const side = payload?.['side'];
  const line = payload?.['line'];
  if (typeof side !== 'string' || typeof line !== 'number') return 'slid the maze';

  const rotation = payload?.['rotation'];
  const facing = typeof rotation === 'number' ? ` (facing ${String(rotation)}°)` : '';

  // pg. 2: "If the path tile you push out has a playing piece on it, put this piece on the opposite side of
  // the board … Moving this piece does not count as your turn!" — worth a clause of its own, because it is
  // the one thing in this game that moves someone else's pawn.
  const wrapped = payload?.['wrapped'];
  const carried =
    Array.isArray(wrapped) && wrapped.length > 0
      ? ` — ${wrapped
          .filter((id): id is string => typeof id === 'string')
          .map((id) => `${nameOf(players, id)}'s pawn`)
          .join(' and ')} wrapped round to the far side`
      : '';

  return `pushed the extra tile in from the ${side} along ${lineLabel(side, line)}${facing}${carried}`;
}

function describeMove(payload: Record<string, unknown> | undefined): string {
  const from = readPosition(payload?.['from']);
  const to = readPosition(payload?.['to']);
  if (from === null || to === null) return 'moved their pawn';

  // ROADMAP ruling 11: "leave your playing piece where it is" (pg. 2) is a MOVE whose target is the square
  // the piece already stands on. `from === to` is the only thing that distinguishes it, and the sentence
  // has to make it read as the deliberate choice it is rather than as a missing move.
  const stayed = from.row === to.row && from.col === to.col;
  const motion = stayed ? `stayed put on ${square(to)}` : `moved from ${square(from)} to ${square(to)}`;

  const flipped = payload?.['flipped'];
  const found = typeof flipped === 'string' ? ` — found the ${flipped}` : '';

  // pg. 2 "Ending the Game": all cards face up *and* the piece back on its starting square. `won` is carried
  // in the payload rather than derived so this line can be written from the record alone.
  const won = payload?.['won'] === true ? ' — home with every treasure found. Wins the game!' : '';

  return `${motion}${found}${won}`;
}

/**
 * One line of plain English for a logged move, or `null` to hide it from the feed.
 *
 * Total over the log: an entry whose `type` this client does not know (a newer engine talking to an older
 * board) is hidden rather than rendered as a raw type name.
 */
export function describeMoveRecord(entry: MoveRecord, players: readonly SeatName[]): string | null {
  switch (entry.type) {
    case 'INSERT':
      return describeInsert(entry.payload, players);
    case 'MOVE':
      return describeMove(entry.payload);
    default:
      return null;
  }
}
