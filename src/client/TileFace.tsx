import { openings } from '../engine/index.js';
import type { Direction, PlayerColor, Tile } from '../engine/index.js';
import { HEDGE } from './palette.js';
import { TreasureMark } from './treasures.js';

/**
 * One maze tile in **Hedgeglow** (L4b) — a corridor cut through a clipped hedge at dusk, drawn from its
 * `shape` + `rotation` alone.
 *
 * **Why SVG shapes and not images:** a tile's job is to say *where the corridors go*, and that is exactly
 * what `openings(shape, rotation)` returns — the engine's single definition of connectivity (`geometry.ts`,
 * shared by the slide, the flood-fill and this file). Drawing the corridors from it means the picture and
 * the rule cannot drift: if a tile is drawn as open to the north, `connects()` agrees, because both asked
 * the same function. The art pass replaced the *fill* of these shapes, not their geometry.
 *
 * **Why the colours are literal and not Tailwind classes:** the maze must be legible before the host's
 * Tailwind build has scanned this package (`src/client/index.ts`'s ⚠️ note — a game ships classes and no
 * CSS). Layout and chrome use utility classes; the tile *picture* uses the literal `HEDGE` palette, so a
 * mis-wired host shows an ugly board rather than an unreadable one. ⚠️ Keep it that way.
 *
 * ## How the picture is built, and why it is cheap
 *
 * 1. **The hedge**, one rect, plus a **leaf stipple** — twelve two-tone dots on the tile's rim, where the
 *    corridor never covers them. The stipple is what makes a wall read as foliage instead of paint, and it
 *    is the one thing in this file with a performance question attached: 49 tiles × N nodes. The dots are
 *    therefore **precomputed at module load** (four fixed layouts, picked per tile from its id so the hedge
 *    does not visibly repeat) and kept to twelve — measured at +≈2× the board's element count, well inside
 *    the budget a shared `<pattern>` would have bought back. ⚠️ If this grows, use a `<defs>` pattern
 *    instead: a per-tile `<svg>` can reference one by `url(#id)` because fragment identifiers resolve
 *    document-wide.
 * 2. **The corridor**, as **one path** — the centre square plus an arm per opening, walked as a single
 *    outline. One element gets both the sandstone fill *and* the kerb (its stroke) with no seams where two
 *    rectangles would have met. The arms overshoot the tile box by {@link OVERSHOOT}, so the stroke's end
 *    cap falls outside the SVG viewport and is clipped: a corridor mouth is never drawn shut, and the kerb
 *    runs on into the next tile exactly when the two tiles face each other.
 * 3. Then the corner frame, the treasure medallion, the seam, the highlights and the pawns, in that order.
 */

/** The four pawn colours, as ink. Fills for a pawn, and the tint on that colour's home corner (pg. 1). */
export const PAWN_INK: Readonly<Record<PlayerColor, string>> = {
  red: '#d8402f',
  yellow: '#efb92a',
  // Lifted off L4's #2e9e4f: green ink on a moss-green hedge is the one seat colour this palette fights.
  blue: '#3573e0',
  green: '#42c169',
};

/** Half-width of a corridor, in the 0–100 tile box. 44 wide leaves a 28-unit hedge on each side. */
const HALF = 22;

/** How far an arm runs past the tile box, so its stroked end cap is clipped away by the SVG viewport. */
const OVERSHOOT = 4;

/**
 * The corridor as one closed outline, walked clockwise from the centre square's north-west corner: each
 * side either bulges out into an arm (the tile is open that way) or cuts straight across (it is not).
 */
function corridorPath(open: readonly Direction[]): string {
  const lo = 50 - HALF;
  const hi = 50 + HALF;
  const out = 100 + OVERSHOOT;
  const back = -OVERSHOOT;
  const at = (direction: Direction) => open.includes(direction);
  const points: string[] = [`M ${String(lo)} ${String(lo)}`];
  // North: out to the top edge and back, or straight across the top of the centre square.
  points.push(at('north') ? `L ${String(lo)} ${String(back)} L ${String(hi)} ${String(back)}` : '');
  points.push(`L ${String(hi)} ${String(lo)}`);
  points.push(at('east') ? `L ${String(out)} ${String(lo)} L ${String(out)} ${String(hi)}` : '');
  points.push(`L ${String(hi)} ${String(hi)}`);
  points.push(at('south') ? `L ${String(hi)} ${String(out)} L ${String(lo)} ${String(out)}` : '');
  points.push(`L ${String(lo)} ${String(hi)}`);
  points.push(at('west') ? `L ${String(back)} ${String(hi)} L ${String(back)} ${String(lo)}` : '');
  return `${points.filter(Boolean).join(' ')} Z`;
}

/** One leaf in the hedge stipple. */
interface Leaf {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  /** True for the lighter of the two leaf tones — what makes the mass read as foliage and not as noise. */
  readonly lit: boolean;
}

/**
 * The four stipple layouts, generated once at module load.
 *
 * Dots sit on the tile's rim only (a 4 × 4 grid with its inner 2 × 2 dropped — those four fall inside the
 * corridor and would be painted over), jittered by a tiny deterministic PRNG so the hedge looks clipped
 * rather than printed, and slightly larger toward the edge, which is what makes a corridor look *cut into*
 * the mass. The generator is seeded, not random: the same tile draws the same hedge on every client, and
 * the engine's own no-`Math.random` rule is honoured in spirit by the picture too.
 */
const STIPPLES: readonly (readonly Leaf[])[] = Array.from({ length: 4 }, (_unused, variant) => {
  let seed = (variant + 1) * 2654435761;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const leaves: Leaf[] = [];
  const grid = [10, 30, 50, 70, 90];
  for (const [row, y] of grid.entries()) {
    for (const [col, x] of grid.entries()) {
      // The inner 3 × 3 falls inside the widest corridor and would only ever be painted over.
      if (row > 0 && row < 4 && col > 0 && col < 4) continue;
      const edge = Math.max(Math.abs(x - 50), Math.abs(y - 50)) / 50;
      leaves.push({
        cx: Math.round((x + (next() - 0.5) * 18) * 10) / 10,
        cy: Math.round((y + (next() - 0.5) * 18) * 10) / 10,
        r: Math.round((2 + edge * 2.2) * 10) / 10,
        lit: next() > 0.45,
      });
    }
  }
  return leaves;
});

/** Which stipple a tile wears — a cheap hash of its id, so neighbours differ but a tile never changes. */
function stippleFor(id: string): readonly Leaf[] {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) % 100003;
  return STIPPLES[hash % STIPPLES.length]!;
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

/** A pawn's silhouette: a turned-wood body with a domed shoulder, at `scale` about (`cx`, `cy`). */
function pawnBody(cx: number, cy: number, scale: number): string {
  const w = 13 * scale;
  const foot = cy + 17 * scale;
  const neck = cy - 6 * scale;
  return [
    `M ${String(cx - w)} ${String(foot)}`,
    `C ${String(cx - w)} ${String(cy + 2 * scale)} ${String(cx - 6 * scale)} ${String(neck)} ${String(cx)} ${String(neck)}`,
    `C ${String(cx + 6 * scale)} ${String(neck)} ${String(cx + w)} ${String(cy + 2 * scale)} ${String(cx + w)} ${String(foot)}`,
    'Z',
  ].join(' ');
}

export interface TileFaceProps {
  readonly tile: Tile;
  /** True for the 16 tiles printed on the board itself — older, denser hedge (pg. 1). */
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
  const scale = pawns.length > 1 ? 0.66 : 1;
  return (
    <>
      {/* The hedge, and the leaves in it. */}
      <rect x={0} y={0} width={100} height={100} fill={fixed ? HEDGE.wallFixed : HEDGE.wall} />
      {stippleFor(tile.id).map((leaf, index) => (
        <circle
          key={index}
          cx={leaf.cx}
          cy={leaf.cy}
          r={leaf.r}
          fill={leaf.lit ? HEDGE.leafLit : HEDGE.leaf}
          opacity={0.85}
        />
      ))}
      {/* The corridor: lantern-lit sandstone, kerbed where it meets the hedge. */}
      <path
        d={corridorPath(open)}
        fill={fixed ? HEDGE.pathFixed : HEDGE.path}
        stroke={HEDGE.pathEdge}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {/* The home corner's colour (pg. 1 Set Up: "places it on its own color"). Drawn as a frame around the
          whole square rather than a dot in the middle, because the middle is exactly where a pawn stands —
          and the corner has to stay identifiable while its owner is sitting on it. The dark backing line is
          what keeps a green or yellow frame legible against the moss. */}
      {home && (
        <>
          <rect x={3} y={3} width={94} height={94} fill="none" stroke={HEDGE.shadow} strokeWidth={8} rx={3} />
          <rect x={3} y={3} width={94} height={94} fill="none" stroke={PAWN_INK[home]} strokeWidth={5} rx={3} />
        </>
      )}
      {tile.treasure && <TreasureMark name={tile.treasure} />}
      {/* The seam between tiles — faint, so corridors read as continuous but the 49 squares stay countable. */}
      <rect x={0} y={0} width={100} height={100} fill="none" stroke={HEDGE.seam} strokeWidth={1.5} />
      {/* Where your pawn already is (drawn in the insert phase, when nothing is highlighted yet). */}
      {origin && <rect x={2.5} y={2.5} width={95} height={95} fill="none" stroke={HEDGE.gilt} strokeWidth={4} rx={4} />}
      {/* A square you may walk to: lantern light on the flagstones. Two strokes, because one colour cannot
          hold its edge against both the pale corridor and the dark hedge. */}
      {reachable && (
        <>
          <rect
            x={3}
            y={3}
            width={94}
            height={94}
            fill={HEDGE.glow}
            fillOpacity={0.3}
            stroke={HEDGE.shadow}
            strokeWidth={7}
            rx={4}
          />
          <rect
            x={3}
            y={3}
            width={94}
            height={94}
            fill="none"
            stroke={HEDGE.glow}
            strokeWidth={4}
            strokeDasharray="10 6"
            rx={4}
          />
        </>
      )}
      {pawns.map((pawn, index) => {
        const [cx, cy] = spots[index % spots.length]!;
        return (
          <g key={pawn.id} data-testid={`pawn-${pawn.id}`} data-color={pawn.color}>
            <title>{`${pawn.name} (${pawn.color})`}</title>
            <ellipse cx={cx} cy={cy + 17 * scale} rx={13 * scale} ry={3.4 * scale} fill={HEDGE.shadow} />
            <path
              d={pawnBody(cx, cy, scale)}
              fill={PAWN_INK[pawn.color]}
              stroke={HEDGE.medal}
              strokeWidth={2.6 * scale}
              strokeLinejoin="round"
            />
            <circle
              cx={cx}
              cy={cy - 11 * scale}
              r={8.5 * scale}
              fill={PAWN_INK[pawn.color]}
              stroke={HEDGE.medal}
              strokeWidth={2.6 * scale}
            />
            {pawn.active && (
              <circle
                cx={cx}
                cy={cy + 1 * scale}
                r={19 * scale}
                fill="none"
                stroke={HEDGE.gilt}
                strokeWidth={2.8 * scale}
                opacity={0.95}
              />
            )}
          </g>
        );
      })}
    </>
  );
}

/**
 * A tile on its own — the extra tile beside the board, and anywhere else a single tile is shown outside
 * the maze grid. `size` is in pixels. It carries a gilt frame the maze tiles do not: off the board, a tile
 * is a *card in your hand*, and the frame is what says so.
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
      <rect x={2} y={2} width={96} height={96} fill="none" stroke={HEDGE.gilt} strokeWidth={3} opacity={0.85} rx={2} />
    </svg>
  );
}
