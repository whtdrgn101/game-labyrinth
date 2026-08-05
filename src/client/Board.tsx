import { useEffect, useState } from 'react';
import {
  BOARD_SIZE,
  isFixedPosition,
  legalInsertions,
  reachableFrom,
  ROTATIONS,
  SEAT_COLORS,
  SLIDE_LINES,
  START_CORNERS,
  tileAt,
} from '../engine/index.js';
import type {
  Direction,
  Insertion,
  LabyrinthView,
  PlayerColor,
  Position,
  Rotation,
  SlideLine,
} from '../engine/index.js';
import { ActivityFeed, Button, cn, GameOver, seatIdentity, TurnBanner } from '@game-hub/ui-kit';
import type { BoardProps } from './types.js';
import * as labyrinthApi from './api.js';
import { describeMoveRecord } from './describe.js';
import { HEDGE } from './palette.js';
import { PAWN_INK, PawnBadge, TileFace, TileSwatch } from './TileFace.js';
import type { PawnOnTile } from './TileFace.js';
import { TreasureCardBack, TreasureChip, TreasureHero } from './treasures.js';

/**
 * Labyrinth's board — the whole game as one plugin the shell renders (L4, art-passed at L4b).
 *
 * ## What this board is, and what it is not
 *
 * It is the *playable* board: every rule the engine enforces has an affordance here. It is **not** the art:
 * the picture of a tile lives in `TileFace.tsx`, the treasure identity in `treasures.tsx` and the Hedgeglow
 * palette in `palette.ts`. That split is what let L4b repaint the whole board with two structural changes
 * here and no testid change at all — the hunted card's medallion (the owner's decision: it has to be
 * *tellable apart*, so it renders at 80–96 px rather than the 32 px chip) and the arrows' gilt.
 *
 * ## The three things a Labyrinth board has to get right
 *
 * 1. **The maze must read as a maze.** Corridors are drawn from `openings(shape, rotation)` — the engine's
 *    own definition of connectivity — and the 7×7 grid has no gaps, so a corridor continues into the next
 *    square exactly when the two tiles face each other. What you can see is what `reachableFrom` computes.
 * 2. **Nothing here re-derives a rule.** The 12 arrows come from `legalInsertions` (which takes the push
 *    history, so a *view* can ask it) and the highlighted squares from `reachableFrom`. The board never
 *    decides what is legal; it asks. ⚠️ `legalActions` deliberately is **not** used — it takes a
 *    `LabyrinthState`, and a client only ever holds a redacted `LabyrinthView`.
 * 3. **A pawn's colour is its corner** (ROADMAP rulings 6/12). Colours come from `view.players[].color`,
 *    **never** from the shell's `colors` prop or a seat index: the platform's palette is coordination state
 *    that may disagree with the rules until the kernel carries picks into `createGame`
 *    (`docs/d2c-findings.md` §16), and a player who picked yellow must not see a red pawn on the yellow
 *    corner. That is why `colors` is not destructured below.
 *
 * ## State
 *
 * The board holds exactly one piece of local state: **the facing of the extra tile before it is inserted**.
 * That is a genuine pre-action choice with no server round-trip behind it (the rotation only becomes real as
 * part of the `INSERT` payload), so it cannot live anywhere else. Everything else is a pure function of the
 * projected view.
 *
 * ## Coordinates
 *
 * `data-testid`s carry the **engine's 0-based** row/col (`tile-3-5`) because they are the e2e contract;
 * everything a *player* reads is 1-based ("row 4, column 6"), as a board game's rows are counted at a table.
 * The two meet here and in `describe.ts`, nowhere else.
 *
 * ## Responsiveness
 *
 * The maze is one fluid CSS grid — `[arrow, 7 × 1fr, arrow]` — with square tiles, so it scales from a
 * comfortable 34rem down to a 320px phone with no horizontal overflow and no fixed pixel width. Stone Age's
 * `PanZoom` is deliberately **not** used: it exists for a large illustrated map, and wrapping 49 individual
 * tap targets in a pan surface makes every tap a potential drag. If L4b's artwork makes the tiles too
 * detailed to read at 38px, that is the moment to reconsider — not before.
 */
export default function LabyrinthBoard({
  gameId,
  game,
  bots,
  controlledIds,
  viewer,
  busy,
  guard,
  onPayload,
  onLeave,
}: BoardProps<LabyrinthView>) {
  const active = game.players[game.activePlayerIndex];
  const { canDrive } = seatIdentity({
    players: game.players,
    activePlayerId: active?.id ?? null,
    bots,
    controlledIds,
  });
  // The banner's identity, with its colour: the seats this client holds, in seating order. The same filter
  // `seatIdentity` applies for `myNames`, repeated here because the banner now wears each seat's pawn
  // *colour* too (player feedback, 2026-08-05 — ROADMAP L4c) and the shared helper returns names alone.
  const mySeats = controlledIds ? game.players.filter((player) => controlledIds.includes(player.id)) : null;

  // The facing the extra tile will go in at — the player's own choice, and the only local state on the
  // board. It resets to the tile's real orientation whenever a *different* tile becomes the spare (i.e.
  // after every insertion), so a facing chosen for last turn's tile can never ride onto this turn's.
  const extraId = game.extraTile.id;
  const extraFacing = game.extraTile.rotation;
  const [facing, setFacing] = useState<Rotation>(extraFacing);
  useEffect(() => {
    setFacing(extraFacing);
  }, [extraId, extraFacing]);

  const ended = game.status === 'ended';
  const canInsert = canDrive && !busy && !ended && game.phase === 'insert';
  const canMove = canDrive && !busy && !ended && game.phase === 'move';

  const run = (work: () => Promise<labyrinthApi.LabyrinthPayload>) => guard(async () => onPayload(await work()));
  const doInsert = (insertion: Insertion) => {
    if (!canInsert || !active) return;
    void run(() =>
      labyrinthApi.act(gameId, active.id, { type: 'INSERT', insertion, rotation: facing }, viewer, game.version),
    );
  };
  const doMove = (target: Position) => {
    if (!canMove || !active) return;
    void run(() => labyrinthApi.act(gameId, active.id, { type: 'MOVE', target }, viewer, game.version));
  };

  // ── Affordances, all asked of the engine ──────────────────────────────────────────────────────────────
  // pg. 2, "The only exception": the arrow that would put the extra tile straight back where it came out.
  // `legalInsertions` takes only the push history, so this view can be handed to it directly.
  const legalArrows = new Set(legalInsertions(game).map(arrowKey));
  // pg. 2: "You can occupy any square that you can move your piece to directly, without interruption." The
  // flood-fill is public information (it is readable off the board), so it is shown even to a client that
  // cannot act — only the *click* is gated.
  const reachable = new Set(
    active && game.phase === 'move' && !ended ? reachableFrom(game.board, active.position).map(squareKey) : [],
  );

  // "Hide the other pieces" (player feedback, 2026-08-05 — ROADMAP L4c): a pawn is drawn on top of the tile
  // art, so a pawn parked on your treasure hides it. The toggle hides every pawn this client does not hold
  // (hotseat: all but the seat on the clock) so the ground can be read. It resets on every recorded action —
  // it is a peek at the board as it stands, and a player who left it on across other people's moves would be
  // playing blind without knowing it.
  const [othersHidden, setOthersHidden] = useState(false);
  const version = game.version;
  useEffect(() => {
    setOthersHidden(false);
  }, [version]);
  const shownIds = othersHidden ? new Set(controlledIds ?? (active ? [active.id] : [])) : null;

  const pawnsBySquare = new Map<string, PawnOnTile[]>();
  for (const player of game.players) {
    const key = squareKey(player.position);
    const here = pawnsBySquare.get(key) ?? [];
    here.push({ id: player.id, name: player.name, color: player.color, active: player.id === active?.id });
    pawnsBySquare.set(key, here);
  }

  // All four corners are printed on the physical board whether or not a seat is using them (pg. 1 photo).
  const homes = new Map<string, PlayerColor>(SEAT_COLORS.map((color) => [squareKey(START_CORNERS[color]), color]));

  // The seat whose hunted card this client is entitled to see. `viewFor` gives a `stack` array only for the
  // viewer's own seats (L3), so "seats I can see" is exactly `stack !== null` — no need to re-read `viewer`.
  // Preference order: the seat on the clock if it is mine (the normal and hotseat cases), else my first seat
  // (I am waiting, but I still want to know what I am hunting), else the active seat — whose stack is `null`,
  // which is what draws a card back for a spectator.
  const mine = game.players.filter((player) => player.stack !== null);
  const focus = mine.find((player) => player.id === active?.id) ?? mine[0] ?? active ?? game.players[0];
  const hunted = focus?.stack?.[0] ?? null;
  const focusHidden = !focus || focus.stack === null;

  const winnerNames = ended ? game.winnerIds.map((id) => game.players.find((p) => p.id === id)?.name ?? id) : [];
  const stepLine = ended
    ? 'Game over'
    : game.phase === 'insert'
      ? 'Step 1 — slide the maze'
      : 'Step 2 — move your pawn (or stay)';
  const turnLine = ended
    ? `${winnerNames.join(' & ')} wins!`
    : canDrive
      ? 'Your move'
      : `Waiting for ${active?.name ?? '—'}`;

  return (
    <div data-testid="board" className="space-y-4">
      {ended && (
        <GameOver winnerNames={winnerNames} onNewGame={onLeave}>
          {/* Every stack is face up once the game ends (`viewFor` case 1), so the final screen can show
              exactly how far behind everyone else was. */}
          <ul className="space-y-1 text-sm">
            {game.players.map((player) => (
              <li
                key={player.id}
                data-testid={`standing-${player.id}`}
                className={cn(
                  'flex items-center justify-between gap-2 border-b py-1',
                  game.winnerIds.includes(player.id) && 'font-semibold',
                )}
              >
                <span className="flex items-center gap-1.5">
                  <ColorDot color={player.color} />
                  {player.name}
                  {game.winnerIds.includes(player.id) ? ' 👑' : ''}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {player.found.length} found · {player.stackCount} left
                </span>
              </li>
            ))}
          </ul>
        </GameOver>
      )}

      <TurnBanner testId="labyrinth-banner" canDrive={canDrive} className="mb-0">
        <span>
          {mySeats ? (
            <>
              {/* Each name wears its seat's pawn (L4c): "You are Ann" only helps if you also know which
                  colour Ann is pushing round the maze. */}
              You are{' '}
              {mySeats.map((seat, index) => (
                <span key={seat.id} className="font-medium">
                  {index > 0 && ', '}
                  <PawnBadge
                    color={seat.color}
                    testId={`banner-pawn-${seat.id}`}
                    className="mr-1 inline-block align-[-0.2em]"
                  />
                  {seat.name}
                </span>
              ))}
            </>
          ) : (
            <span className="text-muted-foreground">Hotseat — pass the device</span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground">{stepLine}</span>
          <span className={cn('font-medium', ended && 'text-primary')}>{turnLine}</span>
        </span>
      </TurnBanner>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* ── The maze ──────────────────────────────────────────────────────────────────────────────────
            A 9 × 9 grid: the 7 × 7 board with a one-cell frame holding the 12 arrows, so every arrow sits
            physically at the end of the line it pushes (pg. 2, "12 arrows along the edge of the board").
            Fluid columns and square tiles — no fixed width anywhere, so it fits a 320px screen. */}
        <div
          data-testid="maze"
          role="group"
          aria-label="The labyrinth — 7 by 7 maze with 12 insertion arrows"
          className={cn(
            'mx-auto grid w-full max-w-[34rem] shrink-0 select-none',
            'grid-cols-[1.5rem_repeat(7,minmax(0,1fr))_1.5rem] sm:grid-cols-[1.75rem_repeat(7,minmax(0,1fr))_1.75rem]',
          )}
        >
          {frameCells().map((cell) => {
            if (cell.kind === 'spacer') return <div key={cell.key} aria-hidden />;
            if (cell.kind === 'arrow') {
              const key = arrowKey(cell.insertion);
              const banned = !legalArrows.has(key);
              return (
                <ArrowButton
                  key={cell.key}
                  insertion={cell.insertion}
                  banned={banned}
                  disabled={!canInsert || banned}
                  onInsert={doInsert}
                />
              );
            }
            const position = cell.position;
            const key = squareKey(position);
            const tile = tileAt(game.board, position);
            const isReachable = reachable.has(key);
            const clickable = canMove && isReachable;
            const pawns = pawnsBySquare.get(key) ?? [];
            // The toggle blinds the eye, not the screen reader: `squareLabel` below still names everyone
            // standing here — a reader user is never occluded by a drawing, so there is nothing to peek past.
            const shownPawns = shownIds ? pawns.filter((pawn) => shownIds.has(pawn.id)) : pawns;
            const home = homes.get(key) ?? null;
            const origin = active !== undefined && squareKey(active.position) === key;
            return (
              <button
                key={cell.key}
                type="button"
                data-testid={`tile-${String(position.row)}-${String(position.col)}`}
                data-reachable={isReachable ? 'true' : 'false'}
                data-fixed={isFixedPosition(position) ? 'true' : 'false'}
                data-treasure={tile.treasure ?? undefined}
                disabled={!clickable}
                aria-label={squareLabel(position, tile.treasure, pawns, home, isReachable)}
                onClick={() => doMove(position)}
                /* L4b: an opaque hedge backdrop behind the tile's SVG. A 7-column fluid grid puts tile
                   edges on fractional device pixels (35.43px at 320px), so the SVG's own boundary
                   antialiases against whatever is behind it — which used to be the page, and drew a white
                   hairline grid across the dark hedge. Inline, not a class: the maze must not depend on the
                   host's CSS (`TileFace.tsx`). */
                style={{ backgroundColor: HEDGE.wall }}
                className={cn(
                  'relative block aspect-square w-full p-0',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary',
                  clickable && 'cursor-pointer hover:brightness-110',
                )}
              >
                <svg viewBox="0 0 100 100" className="block h-full w-full">
                  <TileFace
                    tile={tile}
                    fixed={isFixedPosition(position)}
                    home={home}
                    pawns={shownPawns}
                    reachable={isReachable}
                    origin={origin && !isReachable}
                  />
                </svg>
              </button>
            );
          })}
        </div>

        {/* ── The side panel: what to do now, what you are hunting, and where everyone stands ─────────── */}
        <div className="w-full space-y-3 lg:max-w-[20rem]">
          <section className="rounded-lg border bg-card p-3" aria-label="Your turn">
            <h2 className="mb-2 text-sm font-medium">{stepLine}</h2>

            {/* The spare tile and its facing. Rotating is free and local; it only becomes real as the
                `rotation` field of an INSERT (pg. 2 — the tile goes in at whatever angle you like). */}
            <div className="flex items-center gap-3">
              <div
                data-testid="extra-tile"
                data-rotation={String(facing)}
                data-tile-id={game.extraTile.id}
                className="shrink-0 rounded-md border p-1"
                title={`The extra tile, facing ${String(facing)}°`}
              >
                <TileSwatch tile={{ ...game.extraTile, rotation: facing }} size={64} className="rounded-sm" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  The extra tile{game.extraTile.treasure ? ' — ' : ''}
                  {game.extraTile.treasure && <TreasureChip name={game.extraTile.treasure} size={14} showName />}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="extra-rotate-ccw"
                    disabled={!canInsert}
                    onClick={() => setFacing(turn(facing, -1))}
                    aria-label="Turn the extra tile anticlockwise"
                  >
                    ↺
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="extra-rotate-cw"
                    disabled={!canInsert}
                    onClick={() => setFacing(turn(facing, 1))}
                    aria-label="Turn the extra tile clockwise"
                  >
                    ↻
                  </Button>
                  <span data-testid="extra-facing" className="self-center text-xs tabular-nums text-muted-foreground">
                    {facing}°
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              {game.phase === 'insert'
                ? 'Turn the tile, then press an arrow at the edge of the maze. You must slide before you move (pg. 2).'
                : 'Walk as far as you like along open corridors — or stay where you are.'}
            </p>

            {/* "Or, you can leave your playing piece where it is" (pg. 2). A real button, because it is a
                real choice — and because it is a MOVE to your own square (ruling 11), never a missing one. */}
            <Button
              className="mt-2 w-full"
              data-testid="stay-put"
              variant="secondary"
              disabled={!canMove || !active}
              onClick={() => active && doMove(active.position)}
            >
              Stay put
            </Button>
          </section>

          {/* The card you are hunting — your own top card and nothing else (pg. 2, "Each player looks at the
              first card of his stack … without showing it to the other players"). A seat this client does
              not hold has `stack: null`, which is a card **back**, never a blank. */}
          <section
            data-testid="hunted-card"
            data-treasure={hunted ?? undefined}
            data-facedown={focusHidden ? 'true' : 'false'}
            className="rounded-lg border bg-card p-3"
            aria-label="The treasure you are hunting"
          >
            <h2 className="mb-2 text-sm font-medium">
              {focus && !focusHidden ? `${focus.name} is hunting` : 'Face down'}
            </h2>
            {focusHidden ? (
              <div className="flex items-center gap-3">
                <TreasureCardBack />
                <span className="text-xs text-muted-foreground">
                  Another player&apos;s card — only its owner may look (pg. 2).
                </span>
              </div>
            ) : hunted ? (
              /* L4b, the owner's decision: the medallion **large**. At tile size a treasure says "something
                 is here"; the card is where you have to be able to tell 24 of them apart, and L4's 32px chip
                 could not. `TreasureHero` is 80px, 96px from `sm:` up. */
              <div className="flex items-center gap-3">
                <TreasureHero name={hunted} />
                <span className="min-w-0 text-lg font-medium capitalize">{hunted}</span>
              </div>
            ) : (
              <p className="text-sm">
                Every treasure found — get your pawn home to
                {focus ? <span className="font-medium"> the {focus.color} corner</span> : ' your corner'} to win.
              </p>
            )}
          </section>

          <section className="rounded-lg border bg-card p-3" aria-label="Players">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Players</h2>
              <Button
                size="sm"
                variant="outline"
                data-testid="toggle-pawns"
                aria-pressed={othersHidden}
                onClick={() => setOthersHidden((value) => !value)}
              >
                {othersHidden ? 'Show all pawns' : 'Hide other pawns'}
              </Button>
            </div>
            <ul className="space-y-2">
              {game.players.map((player) => (
                <li key={player.id} data-testid={`seat-${player.id}`} data-color={player.color} className="text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('flex items-center gap-1.5', player.id === active?.id && 'font-semibold')}>
                      <ColorDot color={player.color} />
                      {player.name}
                      {bots.includes(player.id) ? ' 🤖' : ''}
                    </span>
                    <span data-testid={`seat-stack-${player.id}`} className="tabular-nums text-muted-foreground">
                      {player.stackCount} face down
                    </span>
                  </div>
                  <div
                    data-testid={`seat-found-${player.id}`}
                    className="mt-1 flex flex-wrap items-center gap-1"
                    aria-label={`${player.name} has found ${String(player.found.length)} treasures`}
                  >
                    {player.found.length === 0 ? (
                      <span className="text-muted-foreground">nothing found yet</span>
                    ) : (
                      player.found.map((treasure) => <TreasureChip key={treasure} name={treasure} size={18} />)
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* Everything Labyrinth logs is public by construction (`internal/record.ts`), so the whole feed is
          shown to every seat. The per-game part is one function — see `describe.ts` for what it may not say. */}
      <ActivityFeed
        log={game.log}
        players={game.players}
        botIds={bots}
        describe={(entry) => describeMoveRecord(entry, game.players)}
        testId="labyrinth-log"
        emptyLabel="No moves yet — slide the maze to begin."
      />
    </div>
  );
}

// ── Small pieces ────────────────────────────────────────────────────────────────────────────────────────

/** A seat's pawn colour as a dot — the legend that ties a name to a pawn and a corner. */
function ColorDot({ color }: { readonly color: PlayerColor }) {
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/20"
      style={{ backgroundColor: PAWN_INK[color] }}
    />
  );
}

/**
 * One of the 12 arrows. The triangle points the way the maze will travel (`opposite(side)`): press the
 * arrow at the top of a column and that column moves down.
 *
 * The banned arrow is **rendered, disabled and crossed out** rather than hidden — the rulebook's own hint is
 * that you should be able to see where you may not push ("To better remember where you are not allowed to
 * slide the path tile, leave the tile where it is until it is used again", pg. 2). A vanishing arrow would
 * teach a player nothing. The hover tooltips the arrows carried at L4 were removed on player feedback
 * (2026-08-05 — ROADMAP L4c, "hints off"): the ban's explanation now lives only in the `aria-label`.
 */
function ArrowButton({
  insertion,
  banned,
  disabled,
  onInsert,
}: {
  readonly insertion: Insertion;
  readonly banned: boolean;
  readonly disabled: boolean;
  readonly onInsert: (insertion: Insertion) => void;
}) {
  const { side, line } = insertion;
  const label = `${side} arrow, ${side === 'north' || side === 'south' ? 'column' : 'row'} ${String(line + 1)}`;
  return (
    <button
      type="button"
      data-testid={`arrow-${side}-${String(line)}`}
      data-legal={banned ? 'false' : 'true'}
      disabled={disabled}
      aria-label={banned ? `${label} — blocked this turn` : `Insert the extra tile at the ${label}`}
      onClick={() => onInsert(insertion)}
      className={cn(
        'flex h-full w-full items-center justify-center p-0.5',
        !disabled && 'cursor-pointer hover:brightness-110',
        disabled && !banned && 'opacity-40',
      )}
    >
      {/* A fixed square glyph rather than `h-full w-full`: the frame's arrow row would otherwise size
          itself from an SVG with no intrinsic height, and the north/south arrows would come out taller
          than the east/west ones are wide. */}
      {/* Hedgeglow (L4b): a gilt spearhead on the garden's own shadow-green, so the frame belongs to the
          same board as the maze. A banned arrow keeps the shape and loses the gold. */}
      <svg viewBox="0 0 100 100" className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden>
        <path
          d="M 18 22 L 82 22 L 50 82 Z"
          transform={`rotate(${String(ARROW_SPIN[side])} 50 50)`}
          fill={banned ? '#6f7a6c' : HEDGE.gilt}
          stroke={banned ? '#4a534a' : HEDGE.medal}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        {banned && <path d="M 20 20 L 80 80" stroke="#b91c1c" strokeWidth={12} strokeLinecap="round" />}
      </svg>
    </button>
  );
}

/**
 * How far to spin the base triangle (which points **down**) so it points the way the maze travels. A tile
 * inserted at the north arrow pushes its column south, so the north arrow points down: no spin at all.
 */
const ARROW_SPIN: Readonly<Record<Direction, number>> = { north: 0, east: 90, south: 180, west: 270 };

// ── Layout helpers ──────────────────────────────────────────────────────────────────────────────────────

const squareKey = (position: Position): string => `${String(position.row)},${String(position.col)}`;
const arrowKey = (insertion: Insertion): string => `${insertion.side}-${String(insertion.line)}`;

/** Turn the extra tile a quarter turn: `+1` clockwise, `-1` anticlockwise, wrapping through the four. */
function turn(rotation: Rotation, steps: number): Rotation {
  const at = ROTATIONS.indexOf(rotation);
  return ROTATIONS[(at + steps + ROTATIONS.length) % ROTATIONS.length]!;
}

type FrameCell =
  | { readonly kind: 'spacer'; readonly key: string }
  | { readonly kind: 'arrow'; readonly key: string; readonly insertion: Insertion }
  | { readonly kind: 'tile'; readonly key: string; readonly position: Position };

/**
 * The 9 × 9 frame, in reading order: a one-cell border of arrows and spacers around the 7 × 7 board.
 *
 * Built here rather than inline so the board's JSX stays about *what a cell is*, and so the arrow-to-line
 * mapping is stated once: the frame cell before board column `c` is the north arrow of line `c`, and so on
 * round the edge. Only the odd lines carry an arrow (`SLIDE_LINES`) — the even ones hold the 16 fixed tiles
 * and cannot be pushed (pg. 2).
 */
function frameCells(): readonly FrameCell[] {
  const cells: FrameCell[] = [];
  const last = BOARD_SIZE + 1;
  const slideLine = (index: number): SlideLine | null => SLIDE_LINES.find((line) => line === index) ?? null;

  for (let gr = 0; gr <= last; gr += 1) {
    for (let gc = 0; gc <= last; gc += 1) {
      const key = `cell-${String(gr)}-${String(gc)}`;
      const onVerticalEdge = gr === 0 || gr === last;
      const onHorizontalEdge = gc === 0 || gc === last;

      if (onVerticalEdge && onHorizontalEdge) {
        cells.push({ kind: 'spacer', key });
        continue;
      }
      if (onVerticalEdge) {
        const line = slideLine(gc - 1);
        cells.push(
          line === null
            ? { kind: 'spacer', key }
            : { kind: 'arrow', key, insertion: { side: gr === 0 ? 'north' : 'south', line } },
        );
        continue;
      }
      if (onHorizontalEdge) {
        const line = slideLine(gr - 1);
        cells.push(
          line === null
            ? { kind: 'spacer', key }
            : { kind: 'arrow', key, insertion: { side: gc === 0 ? 'west' : 'east', line } },
        );
        continue;
      }
      cells.push({ kind: 'tile', key, position: { row: gr - 1, col: gc - 1 } });
    }
  }
  return cells;
}

/** What a screen reader hears for one square. 1-based, like everything else a player reads. */
function squareLabel(
  position: Position,
  treasure: string | null,
  pawns: readonly PawnOnTile[],
  home: PlayerColor | null,
  reachable: boolean,
): string {
  const parts = [`Row ${String(position.row + 1)}, column ${String(position.col + 1)}`];
  if (treasure) parts.push(treasure);
  if (home) parts.push(`${home} starting corner`);
  if (pawns.length > 0) parts.push(`${pawns.map((pawn) => pawn.name).join(', ')} here`);
  if (reachable) parts.push('you can move here');
  return parts.join('. ');
}
