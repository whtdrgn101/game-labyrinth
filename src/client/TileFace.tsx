import { openings } from '../engine/index.js';
import type { Direction, PlayerColor, Tile } from '../engine/index.js';
import { TreasureMark } from './treasures.js';

/**
 * One maze tile, drawn from its `shape` + `rotation` alone — the functional stage of the Labyrinth board.
 *
 * **Why SVG shapes and not images:** a tile's job is to say *where the corridors go*, and that is exactly
 * what `openings(shape, rotation)` returns — the engine's single definition of connectivity (`geometry.ts`,
 * shared by the slide, the flood-fill and this file). Drawing the corridors from it means the picture and
 * the rule cannot drift: if a tile is drawn as open to the north, `connects()` agrees, because both asked
 * the same function. An illustrated tileset (L4b) replaces the *fill* of these shapes, not their geometry.
 *
 * **Why the colours are inline and not Tailwind classes:** the maze must be legible before the host's
 * Tailwind build has scanned this package (`src/client/index.ts`'s ⚠️ note — a game ships classes and no
 * CSS). Layout and chrome use utility classes; the tile *picture* uses literal fills, so a mis-wired host
 * shows an ugly board rather than an unreadable one.
 *
 * The corridor is one filled region: a square at the centre plus an arm to each open edge. Arms run to the
 * very edge of the 0–100 box and the grid has no gaps, so a corridor visually continues into the next tile
 * exactly when the two tiles face each other — which is the rule a player is reading the board for.
 */

/** Stone (the walls) and parchment (the floor). Movable tiles are lighter than the 16 printed ones. */
const WALL_MOVABLE = '#8a7660';
const WALL_FIXED = '#5c4d3c';
const FLOOR = '#f6ecd8';
const FLOOR_FIXED = '#efe3c9';
const SEAM = 'rgba(0,0,0,0.16)';

/** The four pawn colours, as ink. Fills for a pawn, and the tint on that colour's home corner (pg. 1). */
export const PAWN_INK: Readonly<Record<PlayerColor, string>> = {
  red: '#d32f2f',
  yellow: '#e8b21c',
  blue: '#2563c9',
  green: '#2e9e4f',
};

/** Half-width of a corridor, in the 0–100 tile box. 44 wide leaves a 28-unit wall on each side. */
const HALF = 22;

/** The rectangle of the arm running from the tile centre out to `direction`'s edge. */
function arm(direction: Direction): { x: number; y: number; width: number; height: number } {
  switch (direction) {
    case 'north':
      return { x: 50 - HALF, y: 0, width: HALF * 2, height: 50 + HALF };
    case 'south':
      return { x: 50 - HALF, y: 50 - HALF, width: HALF * 2, height: 50 + HALF };
    case 'west':
      return { x: 0, y: 50 - HALF, width: 50 + HALF, height: HALF * 2 };
    case 'east':
      return { x: 50 - HALF, y: 50 - HALF, width: 50 + HALF, height: HALF * 2 };
  }
}

export interface PawnOnTile {
  readonly id: string;
  readonly name: string;
  readonly color: PlayerColor;
  /** Draw a ring around this pawn — used for the seat on the clock. */
  readonly active: boolean;
}

/**
 * Where several pawns stand on one square. The rulebook has **no occupancy rule** — "you can occupy any
 * square that you can move your piece to" (pg. 2), and pawns share squares freely — so co-occupancy is
 * normal play and has to be drawn, not prevented. One pawn takes the centre; two or more spread onto a
 * 2×2 so all four are visible at once.
 */
function pawnSpots(count: number): readonly (readonly [number, number])[] {
  if (count <= 1) return [[50, 50]];
  return [
    [34, 34],
    [66, 34],
    [34, 66],
    [66, 66],
  ];
}

export interface TileFaceProps {
  readonly tile: Tile;
  /** True for the 16 tiles printed on the board itself — drawn in darker stone (pg. 1). */
  readonly fixed?: boolean;
  /** The colour whose home corner this square is, if any (pg. 1 Set Up: "places it on its own color"). */
  readonly home?: PlayerColor | null;
  readonly pawns?: readonly PawnOnTile[];
  /** Highlight this square as a legal destination for the pawn on the clock. */
  readonly reachable?: boolean;
  /** Overlay for the square the active pawn already stands on. */
  readonly origin?: boolean;
}

/** The tile picture, as the *contents* of an `<svg viewBox="0 0 100 100">` the caller owns. */
export function TileFace({ tile, fixed = false, home = null, pawns = [], reachable, origin }: TileFaceProps) {
  const open = openings(tile.shape, tile.rotation);
  const spots = pawnSpots(pawns.length);
  return (
    <>
      {/* Wall. */}
      <rect x={0} y={0} width={100} height={100} fill={fixed ? WALL_FIXED : WALL_MOVABLE} />
      {/* Corridor: the centre square plus one arm per opening. */}
      <rect x={50 - HALF} y={50 - HALF} width={HALF * 2} height={HALF * 2} fill={fixed ? FLOOR_FIXED : FLOOR} />
      {open.map((direction) => {
        const rect = arm(direction);
        return <rect key={direction} {...rect} fill={fixed ? FLOOR_FIXED : FLOOR} />;
      })}
      {/* The home corner's colour (pg. 1 Set Up: "places it on its own color"). Drawn as a frame around the
          whole square rather than a dot in the middle, because the middle is exactly where a pawn stands —
          and the corner has to stay identifiable while its owner is sitting on it. */}
      {home && <rect x={3} y={3} width={94} height={94} fill="none" stroke={PAWN_INK[home]} strokeWidth={6} rx={3} />}
      {tile.treasure && <TreasureMark name={tile.treasure} scale={0.62} />}
      {/* The seam between tiles — faint, so corridors read as continuous but the 49 squares stay countable. */}
      <rect x={0} y={0} width={100} height={100} fill="none" stroke={SEAM} strokeWidth={1.5} />
      {origin && <rect x={2} y={2} width={96} height={96} fill="none" stroke="#0f766e" strokeWidth={4} rx={4} />}
      {reachable && (
        <rect
          x={3}
          y={3}
          width={94}
          height={94}
          fill="rgba(16,185,129,0.26)"
          stroke="#059669"
          strokeWidth={4}
          strokeDasharray="10 6"
          rx={4}
        />
      )}
      {pawns.map((pawn, index) => {
        const [cx, cy] = spots[index % spots.length]!;
        const r = pawns.length > 1 ? 15 : 20;
        return (
          <g key={pawn.id} data-testid={`pawn-${pawn.id}`} data-color={pawn.color}>
            <title>{`${pawn.name} (${pawn.color})`}</title>
            <circle cx={cx} cy={cy} r={r} fill={PAWN_INK[pawn.color]} stroke="#ffffff" strokeWidth={3.5} />
            {pawn.active && (
              <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="#111827" strokeWidth={2.5} opacity={0.9} />
            )}
          </g>
        );
      })}
    </>
  );
}

/**
 * A tile on its own — the extra tile beside the board, and anywhere else a single tile is shown outside
 * the maze grid. `size` is in pixels.
 */
export function TileSwatch({
  tile,
  size = 64,
  className,
}: {
  readonly tile: Tile;
  readonly size?: number;
  readonly className?: string;
}) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img">
      <title>{`${tile.shape} tile${tile.treasure ? `, ${tile.treasure}` : ''}, facing ${String(tile.rotation)}°`}</title>
      <TileFace tile={tile} />
    </svg>
  );
}
