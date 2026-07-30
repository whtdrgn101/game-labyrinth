import type { PlayerColor, Position, Rotation, TileShape, TreasureName } from './types.js';

/**
 * One of the 16 tiles printed on the board itself (pg. 1, "1 game board with 16 fixed path tiles").
 * `startFor` is set on exactly the four corner tiles — the coloured starting squares.
 */
export interface FixedTileSpec {
  readonly position: Position;
  readonly shape: TileShape;
  readonly rotation: Rotation;
  readonly treasure: TreasureName | null;
  readonly startFor?: PlayerColor;
}

/**
 * The fixed board, **transcribed from the pg. 1 board photo** (the blue board in the "Contents"
 * illustration, which shows all 16 fixed tiles unobscured — the pg. 2 photos are oblique and partly
 * covered by pawns).
 *
 * The 16 sit at the even/even squares: 4 coloured corner starts + 12 treasure-bearing T-junctions. The
 * rulebook tabulates none of this in text, so shapes, orientations *and* which treasure sits where are
 * all read off that photo. Orientations are given as `shape` + `rotation`, which `openings()` turns back
 * into a set of directions (canonical forms are documented in `internal/geometry.ts`).
 *
 * Reading the openings as box-drawing glyphs — the glyph's own strokes *are* the tile's corridors:
 *
 * ```
 *  col:     0             2              4            6
 *  row 0:   ┌ (red)       ┬ spellbook    ┬ crown      ┐ (yellow)
 *  row 2:   ├ map         ├ ruby         ┬ keys       ┤ spider
 *  row 4:   ├ ring        ┴ moth         ┤ emerald    ┤ sword
 *  row 6:   └ (green)     ┴ candelabra   ┴ lamp       ┘ (blue)
 * ```
 *
 * ✅ **Self-check on the transcription:** that layout is exactly **90°-rotationally symmetric** — every
 * tile maps onto the tile at `(row, col) → (col, 6 - row)` with its openings rotated a quarter turn
 * clockwise. A misread shape or orientation almost certainly breaks the symmetry, so `tests/tiles.test.ts`
 * asserts it over all 16 tiles. (The real board is symmetric by design: it looks the same from every
 * player's seat.)
 *
 * ⚠️ **Which treasure sits on which fixed tile is the least certain part.** The board diagram renders each
 * treasure at roughly 12 px in the source PDF (a single 854×1197 page raster — no higher-resolution copy
 * exists to zoom into), so the icons were matched to the much larger card illustrations by silhouette and
 * colour. Shapes and orientations are solid (and symmetry-checked); a treasure name could be off. No rule
 * depends on *which* treasure is where — only that each of the 24 appears exactly once — so a correction
 * is a data edit. Logged in `docs/d2c-findings.md`.
 */
export const FIXED_TILES: readonly FixedTileSpec[] = [
  // Row 0 — the two top corners and the two T-junctions facing into the board.
  { position: { row: 0, col: 0 }, shape: 'corner', rotation: 90, treasure: null, startFor: 'red' },
  { position: { row: 0, col: 2 }, shape: 'tee', rotation: 0, treasure: 'spellbook' },
  { position: { row: 0, col: 4 }, shape: 'tee', rotation: 0, treasure: 'crown' },
  { position: { row: 0, col: 6 }, shape: 'corner', rotation: 180, treasure: null, startFor: 'yellow' },
  // Row 2.
  { position: { row: 2, col: 0 }, shape: 'tee', rotation: 270, treasure: 'map' },
  { position: { row: 2, col: 2 }, shape: 'tee', rotation: 270, treasure: 'ruby' },
  { position: { row: 2, col: 4 }, shape: 'tee', rotation: 0, treasure: 'keys' },
  { position: { row: 2, col: 6 }, shape: 'tee', rotation: 90, treasure: 'spider' },
  // Row 4.
  { position: { row: 4, col: 0 }, shape: 'tee', rotation: 270, treasure: 'ring' },
  { position: { row: 4, col: 2 }, shape: 'tee', rotation: 180, treasure: 'moth' },
  { position: { row: 4, col: 4 }, shape: 'tee', rotation: 90, treasure: 'emerald' },
  { position: { row: 4, col: 6 }, shape: 'tee', rotation: 90, treasure: 'sword' },
  // Row 6 — the two bottom corners.
  { position: { row: 6, col: 0 }, shape: 'corner', rotation: 0, treasure: null, startFor: 'green' },
  { position: { row: 6, col: 2 }, shape: 'tee', rotation: 180, treasure: 'candelabra' },
  { position: { row: 6, col: 4 }, shape: 'tee', rotation: 180, treasure: 'lamp' },
  { position: { row: 6, col: 6 }, shape: 'corner', rotation: 270, treasure: null, startFor: 'blue' },
];

/**
 * One of the 34 loose tiles, before setup gives it a position and an orientation (both drawn from the
 * injected rng in `createGame`).
 */
export interface MovableTileSpec {
  readonly id: string;
  readonly shape: TileShape;
  readonly treasure: TreasureName | null;
}

/**
 * The 34 movable tiles: **12 straights (no treasure), 16 corners (6 with a treasure), 6 T-junctions (all
 * with a treasure)**.
 *
 * ⚠️ **The rulebook omits this distribution entirely** — it says only "34 square path tiles" (pg. 1). The
 * split above is the one every independent implementation of this game uses, and it is pinned down by the
 * treasure arithmetic the rulebook *does* give: 24 treasure cards (pg. 1) minus the 12 on fixed tiles
 * leaves 12 on movable tiles, and 6 + 6 is the only way to distribute them over the two non-straight
 * shapes consistently with the tile counts. `tests/tiles.test.ts` asserts all of it.
 *
 * ⚠️ **Which movable shape carries which treasure is not derivable** from a 2-page rulebook: the loose
 * tiles appear only as three face-up stacks in the pg. 1 illustration, four tiles visible in total. One of
 * those is legible — a **corner tile bearing the dragon** — so `dragon` is placed on a corner on evidence;
 * the other eleven names are distributed here by fiat (corners first, in card order). This affects flavour
 * only: no rule reads a tile's shape together with its treasure. Logged in `docs/d2c-findings.md`.
 */
export const MOVABLE_TILES: readonly MovableTileSpec[] = [
  // 12 straights — never treasured.
  { id: 'straight-01', shape: 'straight', treasure: null },
  { id: 'straight-02', shape: 'straight', treasure: null },
  { id: 'straight-03', shape: 'straight', treasure: null },
  { id: 'straight-04', shape: 'straight', treasure: null },
  { id: 'straight-05', shape: 'straight', treasure: null },
  { id: 'straight-06', shape: 'straight', treasure: null },
  { id: 'straight-07', shape: 'straight', treasure: null },
  { id: 'straight-08', shape: 'straight', treasure: null },
  { id: 'straight-09', shape: 'straight', treasure: null },
  { id: 'straight-10', shape: 'straight', treasure: null },
  { id: 'straight-11', shape: 'straight', treasure: null },
  { id: 'straight-12', shape: 'straight', treasure: null },
  // 16 corners — 6 treasured (the dragon on evidence, see above), 10 plain.
  { id: 'corner-01', shape: 'corner', treasure: 'dragon' },
  { id: 'corner-02', shape: 'corner', treasure: 'bat' },
  { id: 'corner-03', shape: 'corner', treasure: 'owl' },
  { id: 'corner-04', shape: 'corner', treasure: 'princess' },
  { id: 'corner-05', shape: 'corner', treasure: 'gnome' },
  { id: 'corner-06', shape: 'corner', treasure: 'ghost' },
  { id: 'corner-07', shape: 'corner', treasure: null },
  { id: 'corner-08', shape: 'corner', treasure: null },
  { id: 'corner-09', shape: 'corner', treasure: null },
  { id: 'corner-10', shape: 'corner', treasure: null },
  { id: 'corner-11', shape: 'corner', treasure: null },
  { id: 'corner-12', shape: 'corner', treasure: null },
  { id: 'corner-13', shape: 'corner', treasure: null },
  { id: 'corner-14', shape: 'corner', treasure: null },
  { id: 'corner-15', shape: 'corner', treasure: null },
  { id: 'corner-16', shape: 'corner', treasure: null },
  // 6 T-junctions — all treasured.
  { id: 'tee-01', shape: 'tee', treasure: 'genie' },
  { id: 'tee-02', shape: 'tee', treasure: 'beetle' },
  { id: 'tee-03', shape: 'tee', treasure: 'skull' },
  { id: 'tee-04', shape: 'tee', treasure: 'chest' },
  { id: 'tee-05', shape: 'tee', treasure: 'lizard' },
  { id: 'tee-06', shape: 'tee', treasure: 'mouse' },
];
