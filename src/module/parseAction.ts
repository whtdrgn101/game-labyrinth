import { DIRECTIONS, ROTATIONS, SLIDE_LINES } from '../engine';
import type { Action, Direction, Rotation, SlideLine } from '../engine';
import type { ParseResult } from '@game-hub/kernel';

/**
 * Validate opaque JSON into a typed Labyrinth `Action`.
 *
 * **The route does no validation of its own.** The hub's `POST /games/:id/actions` schema checks only that
 * `action` is *an object* — deliberately, since the core can't enumerate every game's action types — and
 * hands the rest here. So everything below is load-bearing: whatever this function returns is what
 * `applyAction` is called with.
 *
 * ## Shape here, rules in the engine
 *
 * This checks that the payload *is* an action: the right type, the right fields, of the right types, drawn
 * from the closed sets the rules define (4 sides × 3 lines = the 12 arrows of pg. 2; the 4 facings a tile
 * can take; a square named by two whole numbers). It does **not** check whether the move is legal — whether
 * that arrow is the one that would undo the last push (pg. 2 "The only exception"), whether that square can
 * be reached, whether it is even your turn. Those are the engine's, and its error codes are already split
 * along the same line (`ILLEGAL_INSERTION`/`UNREACHABLE` are rules; `INVALID_ROTATION`/`INVALID_POSITION`
 * are payloads). Re-deriving reachability here would be a second copy of a rule — the one thing a module
 * may never hold.
 *
 * ⚠️ **Unknown fields are rejected, not ignored** — a deviation from the hub's five games, which quietly
 * drop them. Two reasons: the action a client sends is exactly the shape `legalActions` hands it, so an
 * unexpected key is a client bug and saying so beats swallowing it (`{ type: 'MOVE', to: … }` silently
 * becoming "target missing" is a worse error message than "unknown field `to`"); and Labyrinth's actions are
 * logged verbatim by shape, so refusing to accept fields nobody asked for keeps a future field from riding
 * into the public log. Nothing is *forwarded* either way — the returned action is rebuilt field by field
 * from validated values, never the caller's object.
 */
export function parseLabyrinthAction(raw: unknown): ParseResult<Action> {
  if (!isRecord(raw)) return bad('An action must be an object');

  switch (raw['type']) {
    case 'INSERT': {
      const extra = unknownKeys(raw, ['type', 'insertion', 'rotation']);
      if (extra) return bad(`INSERT has no field "${extra}"`);

      const insertion = raw['insertion'];
      if (!isRecord(insertion)) return bad('INSERT requires an `insertion` object');
      const extraInner = unknownKeys(insertion, ['side', 'line']);
      if (extraInner) return bad(`An insertion has no field "${extraInner}"`);

      // The 12 arrows are exactly the 4 sides × the 3 movable lines (pg. 2); anything else never named one.
      const side = insertion['side'];
      if (!isDirection(side)) return bad(`\`insertion.side\` must be one of ${quoteList(DIRECTIONS)}`);
      const line = insertion['line'];
      if (!isSlideLine(line)) return bad(`\`insertion.line\` must be one of ${SLIDE_LINES.join(', ')}`);

      const rotation = raw['rotation'];
      if (!isRotation(rotation)) return bad(`\`rotation\` must be one of ${ROTATIONS.join(', ')}`);

      return ok({ type: 'INSERT', insertion: { side, line }, rotation });
    }

    case 'MOVE': {
      const extra = unknownKeys(raw, ['type', 'target']);
      if (extra) return bad(`MOVE has no field "${extra}"`);

      const target = raw['target'];
      if (!isRecord(target)) return bad('MOVE requires a `target` object');
      const extraInner = unknownKeys(target, ['row', 'col']);
      if (extraInner) return bad(`A target has no field "${extraInner}"`);

      // Whole numbers only. *Which* square (or whether it is on the board at all) is the engine's call —
      // `INVALID_POSITION` exists for exactly that, and a bounds check here would be a second copy of it.
      const row = target['row'];
      const col = target['col'];
      if (!isInteger(row) || !isInteger(col)) {
        return bad('`target.row` and `target.col` must be whole numbers');
      }

      return ok({ type: 'MOVE', target: { row, col } });
    }

    default:
      return bad(`Unknown action type "${String(raw['type'])}"`);
  }
}

const ok = (action: Action): ParseResult<Action> => ({ ok: true, action });
const bad = (message: string): ParseResult<Action> => ({ ok: false, message });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The first field of `value` that isn't in `allowed`, or `undefined` when they all are. */
const unknownKeys = (value: Record<string, unknown>, allowed: readonly string[]): string | undefined =>
  Object.keys(value).find((key) => !allowed.includes(key));

// The three closed sets, tested against the engine's own constants so a parser can't drift from the rules.
const isDirection = (value: unknown): value is Direction => (DIRECTIONS as readonly unknown[]).includes(value);
const isSlideLine = (value: unknown): value is SlideLine => (SLIDE_LINES as readonly unknown[]).includes(value);
const isRotation = (value: unknown): value is Rotation => (ROTATIONS as readonly unknown[]).includes(value);
const isInteger = (value: unknown): value is number => Number.isInteger(value);

const quoteList = (values: readonly string[]): string => values.map((value) => `"${value}"`).join(', ');
