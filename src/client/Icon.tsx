import { HEDGE } from './palette.js';

/**
 * Labyrinth's **box-lid mark** — the `GameClient.Icon` the hub's Card Table shell renders in the game
 * picker (kernel 1.3.0's optional field). One Hedgeglow maze tile, seen straight on: a corridor crossing
 * cut into the dusk-lit hedge, with a gilt treasure medallion glinting at the crossroads.
 *
 * ## Why it is its own drawing and not a `TileFace`
 *
 * A real maze tile draws corridors from `openings(shape, rotation)` because the picture must not drift from
 * the *rule* (`TileFace.tsx`). The lid has no rule behind it — it is one fixed, symmetrical crossroads
 * chosen because it reads as "a maze" at 24 px in a picker, where a T- or L-tile just reads as a wall with
 * a smudge. So it borrows Hedgeglow's *palette and grammar* (moss hedge, kerbed sandstone corridor, a
 * lantern-gilt medallion) but draws its own shape, and imports nothing from the engine. That also keeps the
 * lazy chunk tiny: the picker loads this before any board, and it must not drag the engine slice in with it.
 *
 * ## The seam rules it honours
 *
 * - **Literal colours, no Tailwind.** Same reason as the board (`palette.ts`, `TileFace.tsx`): a game ships
 *   utility classes and no CSS, and the picker shows every game's lid before the host's Tailwind build has
 *   scanned this package. The mark has to be legible on a host that never wired the classes up, so every
 *   fill is a literal `HEDGE` string and the only class is the caller's `{ className }` for sizing/tinting.
 * - **`{ className?: string }`, square viewBox.** The contract erases the icon to
 *   `ComponentType<{ className?: string }>`; the shell sizes and tints it through that one prop. A `0 0 100
 *   100` box lets the shell scale it to any picker cell without distortion.
 *
 * `Icon` is the default export so the barrel can `lazy(() => import('./Icon.js'))` exactly as it lazies the
 * board (`index.ts`) — an eager icon would ship every game's mark to the home screen.
 */
export default function LabyrinthIcon({ className }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Labyrinth">
      <title>Labyrinth</title>
      {/* The hedge tile: a rounded card of clipped moss, gilt-framed like the extra tile in your hand. */}
      <rect x={4} y={4} width={92} height={92} rx={10} fill={HEDGE.wall} />
      {/* A few leaf dabs on the rim so the mass reads as foliage, not paint (the board's stipple, distilled). */}
      {LEAVES.map((leaf, index) => (
        <circle key={index} cx={leaf.cx} cy={leaf.cy} r={leaf.r} fill={leaf.lit ? HEDGE.leafLit : HEDGE.leaf} />
      ))}
      {/* The corridor crossing: lantern-lit sandstone, kerbed where it meets the hedge — one plus-shape,
          two kerbed bars, so the mouths run off all four edges and the tile reads as part of a larger maze. */}
      <g stroke={HEDGE.pathEdge} strokeWidth={3} strokeLinejoin="round">
        <rect x={38} y={2} width={24} height={96} fill={HEDGE.path} />
        <rect x={2} y={38} width={96} height={24} fill={HEDGE.path} />
      </g>
      {/* The treasure at the crossroads: a gilt medallion (the board's lantern-in-the-hedge), with an
          off-centre four-point glint that makes it read as *treasure* rather than a plain boss. */}
      <circle cx={50} cy={50} r={18} fill={HEDGE.medal} stroke={HEDGE.gilt} strokeWidth={2.6} />
      <circle cx={50} cy={50} r={14.5} fill="none" stroke={HEDGE.gilt} strokeWidth={1} opacity={0.38} />
      {/* The glint: a long-armed sparkle in icon gold, plus a small companion — the "treasure glint". */}
      <path d="M50 39 L52.4 47.6 L61 50 L52.4 52.4 L50 61 L47.6 52.4 L39 50 L47.6 47.6 Z" fill={HEDGE.icon} />
      <path d="M58 42 L59 45 L62 46 L59 47 L58 50 L57 47 L54 46 L57 45 Z" fill={HEDGE.glow} />
    </svg>
  );
}

/** The rim leaf-dabs, placed by hand (the lid is one fixed drawing, so no seeded generator is needed). */
const LEAVES: readonly { readonly cx: number; readonly cy: number; readonly r: number; readonly lit: boolean }[] = [
  { cx: 16, cy: 15, r: 5.5, lit: false },
  { cx: 84, cy: 16, r: 5, lit: true },
  { cx: 15, cy: 85, r: 5, lit: true },
  { cx: 85, cy: 84, r: 5.5, lit: false },
  { cx: 12, cy: 50, r: 4, lit: true },
  { cx: 88, cy: 50, r: 4, lit: false },
  { cx: 50, cy: 12, r: 4, lit: false },
  { cx: 50, cy: 88, r: 4, lit: true },
];
