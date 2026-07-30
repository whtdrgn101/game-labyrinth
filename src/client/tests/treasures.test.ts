import { describe, expect, it } from 'vitest';
import { TREASURES } from '../../engine';
import { treasureLook } from '../treasures';

/**
 * The generated treasure identity.
 *
 * The point of these tests is that the identity is **computed**, not tabulated — so the guarantee a player
 * relies on (24 treasures you can tell apart) has to hold for whatever the list says, including after ruling
 * 3's warning that some of the names may yet be corrected.
 */
describe('treasureLook', () => {
  it('covers all 24 treasures', () => {
    expect(TREASURES).toHaveLength(24);
    for (const name of TREASURES) expect(treasureLook(name).name).toBe(name);
  });

  it('gives every treasure a unique monogram of at most 3 characters', () => {
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

  // The golden-angle step exists so that *consecutive* treasures — the ones dealt and found next to each
  // other — never look alike. 15° apart (360/24) would be indistinguishable.
  it('keeps neighbouring treasures far apart in hue', () => {
    for (let i = 1; i < TREASURES.length; i += 1) {
      const a = treasureLook(TREASURES[i - 1]!).hue;
      const b = treasureLook(TREASURES[i]!).hue;
      const gap = Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
      expect(gap).toBeGreaterThan(60);
    }
  });

  it('varies the silhouette too, so hue is never the only difference', () => {
    const shapes = new Set(TREASURES.map((name) => treasureLook(name).shape));
    expect(shapes.size).toBe(4);
  });
});
