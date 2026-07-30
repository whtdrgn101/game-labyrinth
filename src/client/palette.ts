/**
 * **Hedgeglow** — the Labyrinth board's palette (L4b), as approved from the comps.
 *
 * The fiction is an enchanted hedge garden at dusk: the walls are clipped moss-dark foliage, the corridors
 * are lantern-lit sandstone that still holds the last of the light, and every treasure sits in a gilt ring
 * like a lantern hung in the hedge. Every value below is the approved comp's, unchanged, except the two
 * marked as derived (a *fixed*-tile variant of the wall and the path, so the 16 printed tiles read as older
 * hedge without becoming a second colour scheme).
 *
 * ⚠️ **These are literal colours, and they must stay literal.** A game package ships utility classes and no
 * CSS (`client/index.ts`, `docs/d2c-findings.md` §21), so anything the *maze picture* depends on has to be
 * in the SVG itself. A host that never wires Tailwind up loses the side panels; it must not lose the board.
 * That is why this file exports strings and not a Tailwind theme.
 *
 * It is a third art file rather than a constant inside `TileFace.tsx` for one reason: the tiles, the treasure
 * medallions and the 12 arrows all need the same seven colours, and the arrows live in `Board.tsx`. A shared
 * constant is the smallest thing that keeps them from drifting apart.
 */
export const HEDGE = {
  /** Moss — the hedge mass a corridor is cut into. */
  wall: '#2e4633',
  /** Derived: the 16 printed tiles are older, denser hedge — the same green, a shade deeper. */
  wallFixed: '#27402c',
  /** The darker of the two leaf tones in the wall stipple. */
  leaf: '#243a29',
  /** The lighter of the two — a leaf catching what is left of the light. */
  leafLit: '#37503b',
  /** Lantern-lit sandstone: the corridor floor. */
  path: '#e3cf9e',
  /** Derived: the printed tiles' floor, walked on longer. */
  pathFixed: '#dbc694',
  /** The kerb where sandstone meets hedge. */
  pathEdge: '#c9b078',
  /** The ground of a treasure medallion — deep garden shadow. */
  medal: '#1d3023',
  /** Gilt: medallion rings, the arrows, the pawn on the clock. */
  gilt: '#c9a24b',
  /** Icon gold — the treasure itself, in gold leaf. */
  icon: '#e8cf8e',
  /** Lantern light: the reachable-square wash and its dashed edge. */
  glow: '#f7e6b4',
  /** The hairline between two tiles: present enough to count 49 squares by, faint enough to walk across. */
  seam: 'rgba(17,30,20,0.34)',
  /** A dark backing used wherever a light mark has to survive both grounds (sandstone *and* moss). */
  shadow: 'rgba(17,30,20,0.55)',
} as const;
