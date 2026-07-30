/**
 * The 24 treasures (rulebook pg. 1, "Contents": *24 treasure cards*).
 *
 * The rulebook never *names* them — they are only ever drawn. This list is transcribed from the pg. 1
 * card illustration, read left-to-right, top-to-bottom across its four rows of six, and each icon given
 * a **plain classic English word**. Names are the game's only treasure identity: the board and the cards
 * are matched by name, and L4 draws original artwork per name (the classic fiction and a treasure list
 * aren't copyrightable; Ravensburger's illustrations are, so nothing is traced).
 *
 * ⚠️ **Read from a low-resolution photo.** The card block is ~45 px per card in the source PDF (the page
 * is a single 854×1197 raster — there is no higher-resolution copy to zoom into), so a handful of icons
 * are a judgement call rather than a certainty: `genie` (a spirit rising from a small jar) vs. `ghost`
 * (a pale floating apparition) vs. `lamp` (a vessel standing on a cloth) are three distinct icons whose
 * three names could be permuted, and `spellbook` (a red-and-gold clasped book) could as fairly be called
 * `grimoire`. Each is *some* distinct treasure either way, so no rule depends on which word won —
 * renaming one later is a data edit with no engine change. See `docs/d2c-findings.md`.
 */
export const TREASURES = [
  // Row 1
  'bat',
  'sword',
  'dragon',
  'genie',
  'spellbook',
  'owl',
  // Row 2
  'moth',
  'keys',
  'beetle',
  'ruby',
  'princess',
  'emerald',
  // Row 3
  'gnome',
  'skull',
  'spider',
  'crown',
  'candelabra',
  'map',
  // Row 4
  'chest',
  'lizard',
  'lamp',
  'ring',
  'mouse',
  'ghost',
] as const;

/**
 * One treasure, by name. The card deck is exactly these 24 (pg. 1) and every one of them also sits on
 * exactly one board square — 12 on fixed tiles, 12 on movable tiles (see `tiles.ts`).
 */
export type TreasureName = (typeof TREASURES)[number];
