import { TREASURES } from '../engine';
import type { TreasureName } from '../engine';

/**
 * A **generated** visual identity for the 24 treasures — the functional stage of L4.
 *
 * The rulebook's own icons are copyrighted illustrations (a bat, a sword, a dragon, …) and are not traced
 * here; the *names* are this repo's own reading of them (ROADMAP ruling 3). Until L4b draws original
 * artwork, each treasure needs to be **told apart at ~10 px inside a maze tile**, which is a harder job
 * than it looks: 24 things, on a board where the same icon must be recognisable on a tile, on a card, and
 * in a row of already-found treasures.
 *
 * So each treasure gets three independent, deterministic marks, derived from its index in `TREASURES`:
 *
 * - **Hue**, stepped by the golden angle (137.5°) rather than by `360 / 24 = 15°`. Consecutive treasures
 *   are the ones most likely to be seen side by side (they are dealt and found in deck order), and a 15°
 *   step makes neighbours nearly identical; the golden angle guarantees the opposite.
 * - **Silhouette**, cycling four shapes — so the mark survives being desaturated, printed, or looked at by
 *   someone who cannot separate two hues.
 * - **A monogram**, the shortest prefix of the name that no earlier treasure already took (`skull` → `Sk`,
 *   `spider` → `Spi`). Uniqueness is computed, not hand-tabulated, so renaming a treasure — which ruling 3
 *   says may yet happen — cannot silently produce two identical marks.
 *
 * Everything here is **presentation only**. No rule reads a colour or a glyph; the engine matches treasures
 * by name and nothing else.
 */

/** The four silhouettes, cycled by index. Drawn in a 0–100 box, centred on (50, 50). */
export type TreasureShape = 'disc' | 'diamond' | 'shield' | 'hexagon';

const SHAPES: readonly TreasureShape[] = ['disc', 'diamond', 'shield', 'hexagon'];

/** How a single treasure is drawn. */
export interface TreasureLook {
  readonly name: TreasureName;
  /** 0–359. */
  readonly hue: number;
  readonly shape: TreasureShape;
  /** 1–3 characters. Unique across all 24. */
  readonly monogram: string;
}

/** The golden angle, in degrees — the classic maximally-spread hue step. */
const GOLDEN_ANGLE = 137.5;

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
  const entries = TREASURES.map((name, index): readonly [TreasureName, TreasureLook] => {
    const monogram = monogramFor(name, taken);
    taken.add(monogram);
    return [
      name,
      {
        name,
        hue: Math.round((index * GOLDEN_ANGLE) % 360),
        shape: SHAPES[index % SHAPES.length]!,
        monogram,
      },
    ];
  });
  return Object.fromEntries(entries) as Record<TreasureName, TreasureLook>;
})();

/** How to draw `name`. Total over the 24 treasures — a name off the wire is still one of them (engine type). */
export function treasureLook(name: TreasureName): TreasureLook {
  return LOOKS[name];
}

/** The SVG path/element for a silhouette, centred on (50, 50) at radius `r`. */
function silhouette(shape: TreasureShape, r: number): string {
  const c = 50;
  switch (shape) {
    case 'diamond':
      return `M ${c} ${c - r} L ${c + r} ${c} L ${c} ${c + r} L ${c - r} ${c} Z`;
    case 'shield':
      // A rounded-top crest with a point at the bottom — reads as a heraldic shield even at 10 px.
      return `M ${c - r} ${c - r * 0.8} L ${c + r} ${c - r * 0.8} L ${c + r} ${c} Q ${c + r} ${c + r} ${c} ${c + r} Q ${c - r} ${c + r} ${c - r} ${c} Z`;
    case 'hexagon': {
      const points: string[] = [];
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        points.push(`${(c + r * Math.cos(angle)).toFixed(2)} ${(c + r * Math.sin(angle)).toFixed(2)}`);
      }
      return `M ${points.join(' L ')} Z`;
    }
    case 'disc': {
      // A circle as a path, so every silhouette is one `<path d>` and the caller needs no branching.
      return `M ${c - r} ${c} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`;
    }
  }
}

/**
 * One treasure mark, as SVG — the same glyph on a maze tile, on the hunted card and in a found row, so a
 * player learns it once. Rendered inside the caller's `<svg viewBox="0 0 100 100">`.
 *
 * `scale` shrinks the whole mark about the tile centre (1 = fills the tile's middle square). Colours are
 * inline `hsl()` rather than Tailwind classes on purpose: 24 generated hues cannot be utility classes, and
 * a mark that depends on the *host's* CSS being wired up is a mark that vanishes when it isn't.
 */
export function TreasureMark({
  name,
  scale = 1,
  labelled = true,
}: {
  readonly name: TreasureName;
  readonly scale?: number;
  readonly labelled?: boolean;
}) {
  const look = treasureLook(name);
  const r = 30 * scale;
  return (
    <g data-testid={`treasure-${name}`} data-treasure={name} role={labelled ? 'img' : undefined}>
      {labelled && <title>{name}</title>}
      <path
        d={silhouette(look.shape, r)}
        fill={`hsl(${String(look.hue)} 62% 55%)`}
        stroke={`hsl(${String(look.hue)} 55% 25%)`}
        strokeWidth={3 * scale}
      />
      <text
        x={50}
        y={50}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={30 * scale}
        fontWeight={700}
        fill="#ffffff"
        stroke={`hsl(${String(look.hue)} 55% 25%)`}
        strokeWidth={0.6 * scale}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {look.monogram}
      </text>
    </g>
  );
}

/**
 * A treasure mark as a standalone chip — the found rows and the hunted card use it, where there is no
 * surrounding tile SVG to draw into. `size` is in pixels.
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
        <TreasureMark name={name} labelled={!showName} />
      </svg>
      {showName && <span className="capitalize">{name}</span>}
    </span>
  );
}
