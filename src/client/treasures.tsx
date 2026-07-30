import { TREASURES } from '../engine/index.js';
import type { TreasureName } from '../engine/index.js';
import { HEDGE } from './palette.js';

/**
 * The 24 treasures, as **Hedgeglow medallions** (L4b): an original gold-leaf silhouette on a deep-garden
 * ground inside a gilt ring — a lantern hung in the hedge.
 *
 * **Nothing here is traced.** The rulebook's icons are copyrighted illustrations; only the *names* are
 * shared (and even those are this repo's own reading of a low-resolution photo — ROADMAP ruling 3). Every
 * path below was drawn for this package, in a 0–24 box, from the plain English word and nothing else.
 *
 * ## Why the icons are data and not JSX
 *
 * An icon is a list of {@link Mark}s — a path or a disc, filled, stroked or *knocked* back to the medallion
 * ground. Two things fall out of that which JSX would not give:
 *
 * - **Uniqueness is testable.** 24 icons that a player must tell apart is a real guarantee, and the test can
 *   assert it by serialising the marks (`treasures.test.ts`). A duplicated or accidentally-empty icon fails
 *   the suite instead of shipping.
 * - **The renderer is one function.** Scale, colour and the knockout trick live in `IconMarks` alone, so the
 *   same drawing serves a 35 px tile and a 96 px hunted card without a second code path.
 *
 * The **monogram** from L4 survives as the safety net (`treasureLook().monogram`): it is still computed as
 * the shortest prefix no earlier treasure took, it is still unique across all 24, and it is what a treasure
 * with no drawn icon would fall back to. Ruling 3 warns that a name may yet be corrected; a rename that
 * outran its artwork must degrade to a readable mark, not to a blank medallion.
 *
 * ## The one honest trade
 *
 * Hedgeglow is monochrome by design — 24 gold silhouettes on one ground — so, unlike L4's generated hues,
 * **the shape is the whole identity**. That is what the owner approved from the comps, and it is why the
 * hunted card renders the medallion large (`TreasureHero`): a tile says *there is a treasure here*, the
 * panel says *which one you are hunting*. The icons below are drawn to be told apart at both sizes, but the
 * ones that lean on interior detail (ruby vs. emerald, moth vs. bat) are honestly easier to read on the card.
 *
 * Everything here is **presentation only**. No rule reads a colour or a glyph; the engine matches treasures
 * by name and nothing else.
 */

// ── The icon language ───────────────────────────────────────────────────────────────────────────────────

/**
 * One drawn element of an icon, in a 0–24 box.
 *
 * `line` strokes the mark at that width instead of filling it (rings, legs, antennae); `knock` draws it in
 * the medallion's own ground colour, cutting a hole back through the gold — how an eye, a facet or a fold
 * gets drawn without a second colour.
 */
export type Mark =
  | { readonly kind: 'path'; readonly d: string; readonly line?: number; readonly knock?: boolean }
  | {
      readonly kind: 'disc';
      readonly cx: number;
      readonly cy: number;
      readonly r: number;
      readonly line?: number;
      readonly knock?: boolean;
    };

/** A filled (or stroked, or knocked-out) path. */
const p = (d: string, options: { line?: number; knock?: boolean } = {}): Mark => ({ kind: 'path', d, ...options });
/** A filled (or stroked, or knocked-out) circle. */
const disc = (cx: number, cy: number, r: number, options: { line?: number; knock?: boolean } = {}): Mark => ({
  kind: 'disc',
  cx,
  cy,
  r,
  ...options,
});

/**
 * The 24 drawings. Each is deliberately a *silhouette first*: a shape you could cut from paper and still
 * name, with interior detail only where two treasures would otherwise share an outline.
 *
 * Ordered as `TREASURES` is (rulebook pg. 1's card block, read in rows), so this table can be checked
 * against that one by eye.
 */
const ICONS: Readonly<Record<TreasureName, readonly Mark[]>> = {
  // ── Row 1 ──
  // Wings swept out and down, scalloped along the trailing edge, ears above a small round head. The first
  // draft's wings were a jagged star that read as a splat at 96 px — these are two long curves instead.
  bat: [
    p(
      'M12 9.4 C10.6 7 8 5.4 4.6 4.6 C1.8 4 0.8 4.8 1.6 6.6 C2.4 8.4 2.4 10 1.8 11.6 C3.6 10.8 5.2 11.2 6.4 12.6 C7.4 13.8 7.8 15.2 7.8 17 C9 15.4 10.4 14.6 12 14.6 C13.6 14.6 15 15.4 16.2 17 C16.2 15.2 16.6 13.8 17.6 12.6 C18.8 11.2 20.4 10.8 22.2 11.6 C21.6 10 21.6 8.4 22.4 6.6 C23.2 4.8 22.2 4 19.4 4.6 C16 5.4 13.4 7 12 9.4 Z',
    ),
    disc(12, 9.2, 2.8),
    p('M9.6 7.6 L9 3.8 L11.4 6.2 Z M14.4 7.6 L15 3.8 L12.6 6.2 Z'),
    disc(10.9, 8.8, 0.75, { knock: true }),
    disc(13.1, 8.8, 0.75, { knock: true }),
  ],
  // Point up, wide crossguard, round pommel.
  sword: [
    p('M12 1.2 L14.1 5.4 L14.1 14.6 L12 17.4 L9.9 14.6 L9.9 5.4 Z'),
    p('M4.8 14.6 L19.2 14.6 L19.2 17 L4.8 17 Z'),
    p('M10.7 17 L13.3 17 L13.3 20.6 L10.7 20.6 Z'),
    disc(12, 21.6, 1.9),
    p('M12 3.6 L12 14', { line: 0.9, knock: true }),
  ],
  // Serpent body doubling back on itself, horned head, a raised wing and a barbed tail. The wing is what
  // makes it read as a *dragon* rather than as some creature — without it the 96 px version was a bird.
  dragon: [
    p(
      'M3.6 15.8 C3.6 9.6 7.8 5.4 13 5.4 C16.2 5.4 19.2 7 20.4 9.8 L16.6 9.1 C17.8 10.8 17.2 13 15.6 14.1 C16.7 15.2 16.7 16.9 15.6 18 L11.9 15.7 C9.8 17.3 6.6 17.7 3.6 15.8 Z',
    ),
    // The spined back. A detached wing triangle was tried twice and read as a beak or as debris; spines sit
    // *on* the outline, so they can only ever read as part of the animal.
    p('M5.6 11.2 L3.8 8 L8.2 9 Z M8.8 7.8 L8 4.4 L11.8 6.4 Z M12.6 5.6 L13 2.4 L15.6 5.6 Z'),
    p('M14.6 4.2 L16.4 1.4 L17 5 Z'),
    p('M3.6 15.8 L0.8 19.4 L5 19.2 Z'),
    disc(14.4, 8.9, 1, { knock: true }),
  ],
  // A turbaned head over a bearded face and a plume of smoke that flares out where legs should be. Two
  // earlier drafts (a jar with a swirl; a head with folded arms) came out as a curled numeral — the smoke
  // has to *spread*, not coil, or the silhouette closes up into a spiral.
  genie: [
    p('M6.6 7 C6.6 3.4 9 1.2 12 1.2 C15 1.2 17.4 3.4 17.4 7 Z'),
    disc(12, 0.8, 1.2),
    p('M8.4 7.4 L15.6 7.4 C15.6 10.8 14 12.6 12 12.6 C10 12.6 8.4 10.8 8.4 7.4 Z'),
    p(
      'M8.6 12.4 L15.4 12.4 C16.4 15.4 18.4 16.8 20.6 17.6 L20.6 19.8 C16.8 19.8 14 18.6 12 16.8 C10 18.6 7.2 19.8 3.4 19.8 L3.4 17.6 C5.6 16.8 7.6 15.4 8.6 12.4 Z',
    ),
    disc(10.7, 8.4, 0.7, { knock: true }),
    disc(13.3, 8.4, 0.7, { knock: true }),
  ],
  // A clasped book: spine on the left, a star burned into the cover.
  spellbook: [
    p('M4.4 3.8 L18 3.8 Q19.6 3.8 19.6 5.4 L19.6 18.6 Q19.6 20.2 18 20.2 L4.4 20.2 Z'),
    p('M7.2 3.8 L7.2 20.2', { line: 1.3, knock: true }),
    p('M16.8 9.8 L21.4 9.8 L21.4 14.2 L16.8 14.2 Z'),
    p('M13 8.4 L14.6 12 L13 15.6 L11.4 12 Z', { knock: true }),
  ],
  // Round-headed, ear-tufted, two enormous eyes.
  owl: [
    p(
      'M12 5.4 C7.6 5.4 4.8 9.4 4.8 14 C4.8 18.4 8 21.4 12 21.4 C16 21.4 19.2 18.4 19.2 14 C19.2 9.4 16.4 5.4 12 5.4 Z',
    ),
    p('M5.4 9.4 L4.6 4.2 L9.4 6.8 Z M18.6 9.4 L19.4 4.2 L14.6 6.8 Z'),
    disc(9.1, 12.2, 3, { knock: true }),
    disc(14.9, 12.2, 3, { knock: true }),
    disc(9.1, 12.2, 1.3),
    disc(14.9, 12.2, 1.3),
    p('M12 14.4 L10.4 16.8 L13.6 16.8 Z', { knock: true }),
  ],
  // ── Row 2 ──
  // **Four** wing lobes and a heavy body — the bat's soft opposite. Two rounded wings alone read as a pair
  // of leaves at 96 px; the lower lobes are what make it an insect.
  moth: [
    p(
      'M12 6.6 C9 2.4 3.4 3.2 2.4 7.4 C1.6 10.8 4 13.2 7.4 13.8 C4.8 14.8 3.4 17 4.6 19.2 C5.8 21.4 9.4 21 12 17.6 C14.6 21 18.2 21.4 19.4 19.2 C20.6 17 19.2 14.8 16.6 13.8 C20 13.2 22.4 10.8 21.6 7.4 C20.6 3.2 15 2.4 12 6.6 Z',
    ),
    p(
      'M12 6.2 C10.9 6.2 10.2 7.6 10.2 10 C10.2 13.8 11.2 16.8 12 18.6 C12.8 16.8 13.8 13.8 13.8 10 C13.8 7.6 13.1 6.2 12 6.2 Z',
      {
        knock: true,
      },
    ),
    p('M10.8 6.2 C9.4 3.4 7.6 2.4 6 2.2 M13.2 6.2 C14.6 3.4 16.4 2.4 18 2.2', { line: 1.4 }),
    // ⚠️ No eyespots. The first draft knocked two out of the wings and the moth turned into a *face* —
    // one glance from the owl at 35 px. A moth's identity here is wings + antennae and nothing else.
  ],
  // A key on its ring: hollow bow, long shaft, two wards. Nothing else here is a diagonal.
  keys: [
    disc(7.4, 7.2, 4, { line: 2.4 }),
    p('M10.4 10.2 L20 19.8', { line: 2.6 }),
    p('M15.4 16.2 L17.9 13.7 M17.6 18.4 L20.1 15.9', { line: 2.2 }),
    disc(7.4, 7.2, 1.5, { knock: true }),
  ],
  // A domed shell split down the middle, six legs, small head.
  beetle: [
    p('M12 5.6 C8.4 5.6 6 9.4 6 13.8 C6 18.2 8.4 21.2 12 21.2 C15.6 21.2 18 18.2 18 13.8 C18 9.4 15.6 5.6 12 5.6 Z'),
    p('M12 6 L12 21', { line: 1.4, knock: true }),
    disc(12, 4.4, 2.6),
    p(
      'M6.6 9.4 L2.2 6.6 M6 14 L1.4 13.6 M6.6 18.2 L2.4 20.6 M17.4 9.4 L21.8 6.6 M18 14 L22.6 13.6 M17.4 18.2 L21.6 20.6',
      {
        line: 1.5,
      },
    ),
    p('M10.6 3.2 L9.4 1 M13.4 3.2 L14.6 1', { line: 1.2 }),
  ],
  // A brilliant cut: wide crown, deep point, facets knocked out.
  ruby: [
    p('M7.6 3.6 L16.4 3.6 L21 9.4 L12 21.6 L3 9.4 Z'),
    p('M3 9.4 L21 9.4 M7.6 3.6 L9.6 9.4 M16.4 3.6 L14.4 9.4 M9.6 9.4 L12 21.6 M14.4 9.4 L12 21.6', {
      line: 1.1,
      knock: true,
    }),
  ],
  // A crowned figure: hair to the shoulders, a gown that flares, and a tiara clear of the head. The first
  // draft's tiara sat *on* the outline and the whole thing read as a tombstone.
  princess: [
    p('M7 5.6 L8 2.4 L10 4.6 L12 1.6 L14 4.6 L16 2.4 L17 5.6 Z'),
    p(
      'M12 5 C9 5 7.2 7.4 7.2 10.4 C7.2 12.4 7.8 14 8.6 15.2 L15.4 15.2 C16.2 14 16.8 12.4 16.8 10.4 C16.8 7.4 15 5 12 5 Z',
    ),
    p('M8.6 14.8 L15.4 14.8 C17.4 16.6 18.8 19.2 19.4 21.8 L4.6 21.8 C5.2 19.2 6.6 16.6 8.6 14.8 Z'),
    p(
      'M12 6.8 C10.2 6.8 9.2 8.2 9.2 10.2 C9.2 12.2 10.4 13.8 12 13.8 C13.6 13.8 14.8 12.2 14.8 10.2 C14.8 8.2 13.8 6.8 12 6.8 Z',
      {
        knock: true,
      },
    ),
    disc(10.8, 10.2, 0.75),
    disc(13.2, 10.2, 0.75),
  ],
  // A step cut: deeply clipped corners and one bold ledge. The first draft's hairline facets vanished at
  // tile size and left a blank rounded square — so the octagon is exaggerated and the table knocked wide.
  emerald: [
    p('M8.6 2.6 L15.4 2.6 L20 7.4 L20 16.6 L15.4 21.4 L8.6 21.4 L4 16.6 L4 7.4 Z'),
    p('M10.2 6.6 L13.8 6.6 L17.4 10.2 L17.4 13.8 L13.8 17.4 L10.2 17.4 L6.6 13.8 L6.6 10.2 Z', {
      line: 1.2,
      knock: true,
    }),
    p('M8.6 2.6 L10.2 6.6 M15.4 2.6 L13.8 6.6 M8.6 21.4 L10.2 17.4 M15.4 21.4 L13.8 17.4', {
      line: 1.2,
      knock: true,
    }),
  ],
  // ── Row 3 ──
  // All hat and beard — the one figure here whose silhouette is a triangle over a bell. The beard is wide
  // on purpose: narrow, it read as an arrow at 35 px.
  gnome: [
    p('M12 1 C9 3.6 6.6 7 5.2 10.2 L18.8 10.2 C17.4 7 15 3.6 12 1 Z'),
    // The brim: hat and beard are the same gold, and without this knocked line they fused into a rocket.
    p('M4.6 10.9 L19.4 10.9', { line: 1.5, knock: true }),
    p('M6 11.6 L18 11.6 L17 15 C17 20 14.6 22.4 12 22.4 C9.4 22.4 7 20 7 15 Z'),
    disc(10.2, 12.6, 0.9, { knock: true }),
    disc(13.8, 12.6, 0.9, { knock: true }),
    p('M9.6 15.4 L14.4 15.4', { line: 1, knock: true }),
  ],
  // Cranium and square jaw, deep sockets, a tooth line.
  skull: [
    p(
      'M12 2 C6.8 2 3.6 5.8 3.6 10.6 C3.6 13.6 5 15.8 6.6 16.8 L6.6 19.6 C6.6 21 7.6 21.8 9.2 21.8 L14.8 21.8 C16.4 21.8 17.4 21 17.4 19.6 L17.4 16.8 C19 15.8 20.4 13.6 20.4 10.6 C20.4 5.8 17.2 2 12 2 Z',
    ),
    disc(8.8, 10.4, 2.5, { knock: true }),
    disc(15.2, 10.4, 2.5, { knock: true }),
    p('M12 13 L13.4 16.2 L10.6 16.2 Z', { knock: true }),
    p('M8.2 18.6 L15.8 18.6 M10.6 18.6 L10.6 21.6 M13.4 18.6 L13.4 21.6', { line: 1.1, knock: true }),
  ],
  // Eight legs — but the *body* has to survive too: the first draft's small body and thin long legs read
  // as a starburst. Heavier body, shorter and thicker legs.
  spider: [
    disc(12, 14.2, 5.4),
    disc(12, 7.6, 3.2),
    p(
      'M7.6 10.8 L3.6 7.6 M7 13.6 L2.4 12.6 M7.2 16.8 L3 18.8 M9.6 18.6 L7.4 21.8 M16.4 10.8 L20.4 7.6 M17 13.6 L21.6 12.6 M16.8 16.8 L21 18.8 M14.4 18.6 L16.6 21.8',
      {
        line: 2,
      },
    ),
    disc(10.7, 7.2, 0.8, { knock: true }),
    disc(13.3, 7.2, 0.8, { knock: true }),
  ],
  // Five points over a jewelled band.
  crown: [
    p('M3.4 15.4 L3.4 5.6 L8 10.4 L12 3 L16 10.4 L20.6 5.6 L20.6 15.4 Z'),
    p('M3.4 16.6 L20.6 16.6 L20.6 20.2 L3.4 20.2 Z'),
    disc(7.4, 18.4, 1.1, { knock: true }),
    disc(12, 18.4, 1.1, { knock: true }),
    disc(16.6, 18.4, 1.1, { knock: true }),
  ],
  // Three lit candles on a branched stand.
  candelabra: [
    p(
      'M3.2 5.6 L5.8 5.6 L5.8 9.4 L3.2 9.4 Z M10.7 4 L13.3 4 L13.3 9.4 L10.7 9.4 Z M18.2 5.6 L20.8 5.6 L20.8 9.4 L18.2 9.4 Z',
    ),
    p(
      'M4.5 1.8 Q6.4 3.6 4.5 5.4 Q2.6 3.6 4.5 1.8 Z M12 0.2 Q13.9 2 12 3.8 Q10.1 2 12 0.2 Z M19.5 1.8 Q21.4 3.6 19.5 5.4 Q17.6 3.6 19.5 1.8 Z',
    ),
    p(
      'M12 9.4 L12 17.4 M4.5 9.4 L4.5 13.4 M19.5 9.4 L19.5 13.4 M4.5 13.4 C4.5 16.4 8.6 16.6 12 16.6 C15.4 16.6 19.5 16.4 19.5 13.4',
      {
        line: 1.7,
      },
    ),
    p('M8.6 17.4 L15.4 17.4 L17.4 21.6 L6.6 21.6 Z'),
  ],
  // A folded map, creased into panels, with the mark on it.
  map: [
    p('M2.2 5.2 L8.6 3 L15.4 5.6 L21.8 3.4 L21.8 18.8 L15.4 21 L8.6 18.4 L2.2 20.6 Z'),
    p('M8.6 3 L8.6 18.4 M15.4 5.6 L15.4 21', { line: 1.2, knock: true }),
    p('M17.2 9.6 L20 12.4 M20 9.6 L17.2 12.4', { line: 1.5, knock: true }),
    p('M4.4 15.6 C6.4 12.6 9 16 11.6 12.4', { line: 1.3, knock: true }),
  ],
  // ── Row 4 ──
  // A domed, banded chest with a lock plate.
  chest: [
    p('M3.2 11.6 Q3.2 4.8 12 4.8 Q20.8 4.8 20.8 11.6 Z'),
    p('M3.2 12.6 L20.8 12.6 L20.8 19.6 Q20.8 20.8 19.6 20.8 L4.4 20.8 Q3.2 20.8 3.2 19.6 Z'),
    p('M10.2 10.6 L13.8 10.6 L13.8 16.6 L10.2 16.6 Z'),
    disc(12, 13.4, 1.1, { knock: true }),
    p('M6.6 5.6 L6.6 20.8 M17.4 5.6 L17.4 20.8', { line: 1.2, knock: true }),
  ],
  // Four legs and a **curled tail**, seen from above — the dragon minus the wings and the menace. The tail
  // is a filled taper rather than a stroke: stroked, it disappeared at tile size and left a second spider.
  lizard: [
    disc(12, 4.2, 2.6),
    p('M12 6 C9.8 6 9 8.4 9 11.2 C9 14 9.8 16.2 12 16.2 C14.2 16.2 15 14 15 11.2 C15 8.4 14.2 6 12 6 Z'),
    p(
      'M10.4 14.6 C9.8 18.4 12.8 21.6 16.2 20.8 C19 20.2 19.8 17 18 15.8 C18.6 17.4 17.6 18.9 16 19.1 C14 19.3 12.6 17.6 13.2 14.6 Z',
    ),
    p('M9.4 8.4 L5.6 6 L4.2 7.6 M14.6 8.4 L18.4 6 L19.8 7.6 M9.4 13.4 L5.6 15.8 L4.2 14.2 M14.6 13.4 L18.4 15.8', {
      line: 1.6,
    }),
    disc(10.9, 3.7, 0.7, { knock: true }),
    disc(13.1, 3.7, 0.7, { knock: true }),
  ],
  // An oil lamp: long spout, loop handle, and a flame already lit.
  lamp: [
    p(
      'M4.4 13.4 C4.4 10.6 7.4 9.2 11 9.2 C14.2 9.2 16.6 10.4 17.2 12.6 L22 14.8 L17 15.4 C16.2 17.2 13.6 18 11 18 C7.4 18 4.4 16.4 4.4 13.4 Z',
    ),
    p('M6 18 L16.6 18 L18.4 20.8 L4.2 20.8 Z'),
    p('M5.4 11.4 C1.6 11.4 1.6 16.4 5.4 16.6', { line: 1.7 }),
    p('M20.4 9.4 Q22.6 11.8 20.4 14.2 Q18.2 11.8 20.4 9.4 Z'),
    p('M8 7.6 L14 7.6', { line: 1.4 }),
  ],
  // A band, seen edge-on, with the stone above it.
  ring: [
    disc(12, 14.6, 5.6, { line: 2.6 }),
    p('M9.2 5.6 L12 1.6 L14.8 5.6 L12 8.8 Z'),
    p('M9.2 5.6 L14.8 5.6', { line: 0.9, knock: true }),
  ],
  // Two round ears and a tail — read from the front, so the ears do the work.
  mouse: [
    disc(6.4, 7.6, 4.2),
    disc(17.6, 7.6, 4.2),
    disc(6.4, 7.6, 1.9, { knock: true }),
    disc(17.6, 7.6, 1.9, { knock: true }),
    p('M12 5.8 C7.6 5.8 5 9.8 5 14.2 C5 18.4 8 21.2 12 21.2 C16 21.2 19 18.4 19 14.2 C19 9.8 16.4 5.8 12 5.8 Z'),
    disc(9.4, 12.8, 1.2, { knock: true }),
    disc(14.6, 12.8, 1.2, { knock: true }),
    p('M12 16 L10.6 17.8 L13.4 17.8 Z', { knock: true }),
    p('M18.4 18.6 C21.8 19.4 22.6 15.4 20.4 14', { line: 1.4 }),
  ],
  // A hanging apparition with a torn hem — hollow eyes are the whole face.
  ghost: [
    p(
      'M12 2.4 C7 2.4 4.6 6.6 4.6 11 L4.6 20.4 L7.2 17.6 L9.8 20.4 L12 17.6 L14.2 20.4 L16.8 17.6 L19.4 20.4 L19.4 11 C19.4 6.6 17 2.4 12 2.4 Z',
    ),
    disc(9.4, 10, 1.7, { knock: true }),
    disc(14.6, 10, 1.7, { knock: true }),
    p('M12 13.4 C10.9 13.4 10.4 14.2 10.4 15 L13.6 15 C13.6 14.2 13.1 13.4 12 13.4 Z', { knock: true }),
  ],
};

// ── The generated identity (kept from L4 as the safety net) ─────────────────────────────────────────────

/** How a single treasure is drawn. */
export interface TreasureLook {
  readonly name: TreasureName;
  /** The original Hedgeglow drawing, in a 0–24 box. Empty only if a name outran its artwork. */
  readonly marks: readonly Mark[];
  /** 1–3 characters, unique across all 24 — the fallback mark, and the a11y shorthand. */
  readonly monogram: string;
}

/** Title-case the first character; the rest stay lower case (`sp` → `Sp`). */
function titleCase(prefix: string): string {
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

/**
 * The shortest prefix of `name` (1–3 characters) that `taken` does not already hold. Falls back to the
 * 3-character prefix if even that collides — impossible for the current 24 (asserted in the tests), but a
 * total function beats a `!`.
 */
function monogramFor(name: string, taken: ReadonlySet<string>): string {
  for (let length = 1; length <= 3; length += 1) {
    const candidate = titleCase(name.slice(0, length));
    if (!taken.has(candidate)) return candidate;
  }
  return titleCase(name.slice(0, 3));
}

const LOOKS: Readonly<Record<TreasureName, TreasureLook>> = (() => {
  const taken = new Set<string>();
  const entries = TREASURES.map((name): readonly [TreasureName, TreasureLook] => {
    const monogram = monogramFor(name, taken);
    taken.add(monogram);
    return [name, { name, marks: ICONS[name], monogram }];
  });
  return Object.fromEntries(entries) as Record<TreasureName, TreasureLook>;
})();

/** How to draw `name`. Total over the 24 treasures — a name off the wire is still one of them (engine type). */
export function treasureLook(name: TreasureName): TreasureLook {
  return LOOKS[name];
}

// ── Rendering ───────────────────────────────────────────────────────────────────────────────────────────

/** The medallion's radius on a maze tile, in the tile's 0–100 box — the comp's `0.21 × tile`. */
export const MEDALLION_R = 21;

/** How much of the medallion the drawing fills. The comp's `1.44 × r`, i.e. the icon sits inside the ring. */
const ICON_SPAN = 1.44;

/** The marks of one icon, drawn into a 0–24 box the caller has already positioned and scaled. */
function IconMarks({ marks }: { readonly marks: readonly Mark[] }) {
  return marks.map((mark, index) => {
    const paint = mark.knock ? HEDGE.medal : HEDGE.icon;
    const common = {
      fill: mark.line === undefined ? paint : 'none',
      stroke: mark.line === undefined ? 'none' : paint,
      strokeWidth: mark.line,
      strokeLinejoin: 'round' as const,
      strokeLinecap: 'round' as const,
    };
    return mark.kind === 'path' ? (
      <path key={index} d={mark.d} {...common} />
    ) : (
      <circle key={index} cx={mark.cx} cy={mark.cy} r={mark.r} {...common} />
    );
  });
}

/**
 * One treasure medallion, as SVG — the same drawing on a maze tile, on the hunted card and in a found row,
 * so a player learns it once. Rendered inside the caller's `<svg viewBox="0 0 100 100">`.
 *
 * `radius` is the medallion's radius in that 0–100 box: {@link MEDALLION_R} on a tile (the comp's size, which
 * the owner approved as-is), larger on a chip or the hunted card. Colours are literal, not Tailwind classes:
 * a mark that depends on the host's CSS being wired up is a mark that vanishes when it isn't.
 */
export function TreasureMark({
  name,
  radius = MEDALLION_R,
  labelled = true,
  cx = 50,
  cy = 50,
}: {
  readonly name: TreasureName;
  readonly radius?: number;
  readonly labelled?: boolean;
  readonly cx?: number;
  readonly cy?: number;
}) {
  const look = treasureLook(name);
  const span = radius * ICON_SPAN;
  return (
    <g data-testid={`treasure-${name}`} data-treasure={name} role={labelled ? 'img' : undefined}>
      {labelled && <title>{name}</title>}
      {/* The lantern: a deep ground, a gilt ring, and a faint inner ring for the glass. */}
      <circle cx={cx} cy={cy} r={radius} fill={HEDGE.medal} stroke={HEDGE.gilt} strokeWidth={radius * 0.14} />
      <circle
        cx={cx}
        cy={cy}
        r={radius * 0.82}
        fill="none"
        stroke={HEDGE.gilt}
        strokeWidth={radius * 0.05}
        opacity={0.38}
      />
      {look.marks.length > 0 ? (
        <g transform={`translate(${String(cx - span / 2)} ${String(cy - span / 2)}) scale(${String(span / 24)})`}>
          <IconMarks marks={look.marks} />
        </g>
      ) : (
        // The safety net: a treasure whose name outran its artwork still gets a unique, readable mark.
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={radius * 0.9}
          fontWeight={700}
          fill={HEDGE.icon}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {look.monogram}
        </text>
      )}
    </g>
  );
}

/**
 * A treasure medallion as a standalone chip — the found rows and the extra-tile line use it, where there is
 * no surrounding tile SVG to draw into. `size` is in pixels; the medallion fills it.
 */
export function TreasureChip({
  name,
  size = 24,
  showName = false,
}: {
  readonly name: TreasureName;
  readonly size?: number;
  readonly showName?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1 align-middle" data-testid={`chip-${name}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden={showName} className="shrink-0">
        <TreasureMark name={name} radius={45} labelled={!showName} />
      </svg>
      {showName && <span className="capitalize">{name}</span>}
    </span>
  );
}

/**
 * **The hunted card's medallion, at reading size.** The owner's L4b decision: at tile size a medallion says
 * *a treasure is here*, and that is all it has to say — but the "you are hunting X" panel has to be
 * *tellable apart at a glance*, and the L4 chip (32 px) was not. This renders at 80 px, 96 px from `sm:` up,
 * with the pixel attributes as the floor so the medallion is still large on a host that never scanned this
 * package's classes.
 */
export function TreasureHero({ name }: { readonly name: TreasureName }) {
  return (
    <svg
      data-testid="hunted-medallion"
      data-treasure={name}
      viewBox="0 0 100 100"
      width={80}
      height={80}
      className="h-20 w-20 shrink-0 sm:h-24 sm:w-24"
      role="img"
      aria-label={name}
    >
      <title>{name}</title>
      <TreasureMark name={name} radius={46} labelled={false} />
    </svg>
  );
}

/**
 * The **back** of a treasure card — another seat's hunted card, which this client may never see (pg. 2).
 * Drawn at exactly the same size as {@link TreasureHero} so the panel does not resize when the clock passes
 * to somebody else, and so "face down" reads as a card rather than as a missing one.
 */
export function TreasureCardBack() {
  return (
    <svg
      data-testid="hunted-medallion"
      viewBox="0 0 100 100"
      width={80}
      height={80}
      className="h-20 w-20 shrink-0 sm:h-24 sm:w-24"
      aria-hidden
    >
      <circle cx={50} cy={50} r={46} fill={HEDGE.medal} stroke={HEDGE.gilt} strokeWidth={6} />
      <circle cx={50} cy={50} r={37} fill="none" stroke={HEDGE.gilt} strokeWidth={2} opacity={0.38} />
      {/* A hedge knot, not a question mark: the same garden, with nothing lit in it. */}
      <path
        d="M50 26 Q66 34 66 50 Q66 66 50 74 Q34 66 34 50 Q34 34 50 26 Z"
        fill="none"
        stroke={HEDGE.gilt}
        strokeWidth={2.6}
        opacity={0.55}
      />
      <path d="M34 50 L66 50 M50 26 L50 74" stroke={HEDGE.gilt} strokeWidth={2.6} opacity={0.55} />
    </svg>
  );
}
