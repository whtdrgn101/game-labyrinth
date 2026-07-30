import { describe, expect, it } from 'vitest';
import { TREASURES } from '../../engine';
import { treasureLook } from '../treasures';

/**
 * The 24 treasure identities (Hedgeglow, L4b).
 *
 * The guarantee a player relies on is simple and worth a test: **24 treasures you can tell apart**. Under
 * L4 that was carried by a generated hue + silhouette + monogram; under L4b the drawing carries it, and the
 * monogram survives as the safety net for a treasure whose name outran its artwork (ruling 3 warns that a
 * name may yet be corrected). So the assertions below are: every treasure is drawn, no two are drawn the
 * same, and the fallback identity is still unique and still *computed* rather than tabulated.
 *
 * ⚠️ What no test can check is whether two icons are *visually* distinct at 35 px — that is a screenshot and
 * a pair of eyes (see ROADMAP L4b). What it can check is that they are not literally the same drawing.
 */
describe('treasureLook', () => {
  it('covers all 24 treasures', () => {
    expect(TREASURES).toHaveLength(24);
    for (const name of TREASURES) expect(treasureLook(name).name).toBe(name);
  });

  it('draws every one of the 24 — no blanks, nothing left to the fallback', () => {
    for (const name of TREASURES) {
      const marks = treasureLook(name).marks;
      expect(marks.length, `${name} has no artwork`).toBeGreaterThan(0);
      for (const mark of marks) {
        if (mark.kind === 'path') expect(mark.d.length, `${name} has an empty path`).toBeGreaterThan(0);
        else expect(mark.r, `${name} has a zero-radius disc`).toBeGreaterThan(0);
      }
    }
  });

  it('gives every treasure its own drawing — 24 distinct identities', () => {
    const drawings = TREASURES.map((name) => JSON.stringify(treasureLook(name).marks));
    expect(new Set(drawings).size).toBe(24);
  });

  it('keeps every drawing inside the 0–24 icon box, so nothing is clipped by the medallion', () => {
    // A path's numbers are extracted rather than parsed: this is a bounds smoke test, not an SVG parser.
    for (const name of TREASURES) {
      for (const mark of treasureLook(name).marks) {
        const numbers =
          mark.kind === 'path'
            ? (mark.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
            : [mark.cx - mark.r, mark.cx + mark.r, mark.cy - mark.r, mark.cy + mark.r];
        for (const value of numbers) {
          expect(value, `${name} strays outside the icon box`).toBeGreaterThanOrEqual(-1);
          expect(value, `${name} strays outside the icon box`).toBeLessThanOrEqual(25);
        }
      }
    }
  });

  it('gives every treasure a unique monogram of at most 3 characters (the fallback identity)', () => {
    const monograms = TREASURES.map((name) => treasureLook(name).monogram);
    expect(new Set(monograms).size).toBe(24);
    for (const monogram of monograms) {
      expect(monogram.length).toBeGreaterThan(0);
      expect(monogram.length).toBeLessThanOrEqual(3);
    }
  });

  it('builds a monogram from the name itself, extending only on a collision', () => {
    expect(treasureLook('skull').monogram).toBe('Sk'); // `sword` already took S
    expect(treasureLook('spider').monogram).toBe('Spi'); // … and `spellbook` took Sp
    expect(treasureLook('bat').monogram).toBe('B');
  });
});
