# @game-hub/game-labyrinth

Ravensburger's **_The aMAZEing Labyrinth_** as a [Game Hub](https://github.com/whtdrgn101/container) game
package: a 7×7 sliding maze where you push the walls around to reach your treasures, and where your push can
carry another player's pawn off one edge and back on at the other.

**And it is the platform's out-of-repo pilot.** Every other Game Hub game lives inside the platform's
monorepo. This one does not: it is a standalone repository that depends on `@game-hub/kernel` and
`@game-hub/ui-kit` **from the public npm registry**, like any third-party consumer would. If the published
contract has a hole in it, this repo's CI is where it shows up.

## Why the pilot exists

Game Hub's whole design bet is that a game is **additive** — four subpath exports (`./engine`, `./module`,
`./client`, `./bot`) behind game-agnostic hosts, so adding one touches no shared core. That bet had been
proven five times *in-workspace*, where a lot of things quietly work for the wrong reasons: TypeScript source
is consumed directly, Vite aliases stand in for a real build, the Tailwind content globs happen to cover
every game folder, and `workspace:*` resolves everything.

None of that survives `node_modules`. So the platform published its two shareable pieces —
`@game-hub/kernel@1.1.0` (the contracts + primitives; **its major version _is_ the host↔game contract
version**) and `@game-hub/ui-kit@1.0.0` (the shared board chrome + the game-facing REST calls) — and this
repo is the first real consumer of them. Everywhere the documented recipe assumed a workspace and broke out
here is written down, unvarnished, in **[`docs/d2c-findings.md`](./docs/d2c-findings.md)**. That file is the
point of the exercise as much as the game is.

There are **zero references to the platform repository** in this one: no path, no link, no `file:` dep. The
lockfile resolves `@game-hub/*` to registry tarballs with integrity hashes, and CI installs with
`--frozen-lockfile` so it cannot silently start doing anything else.

## Status

**D2d shipped — the Game Hub hosts this package, and the pilot's question is answered.** The hub installs
`@game-hub/game-labyrinth` like any other dependency (its `exports` resolving to the compiled `dist/` below),
registers it with one config entry, and ships it in its production Docker image as the sixth playable game —
with **no** alias, path mapping or build shim reaching back into this repo. `pnpm pack:smoke` is the check
that keeps that true: it packs the tarball, installs it plus its peers from the public registry into a
throwaway project outside this repo, and plays a game through all four subpaths under plain `node`.

**L4 (functional stage) shipped — the game is playable.** L0 laid the data spine (rules types, tile/treasure
data, the fixed board transcribed from the rulebook's board photo, and `createGame` with an injected-rng
shuffle, orientations and deal); L1 added the slide (the 12 arrows, the no-reverse rule, pawns carried along a
pushed line and wrapped round the edge); L2 added the other half of a turn — flood-fill reachability, the pawn
move, the treasure flip, the turn hand-off and the immediate win; L3 added `./module` — the real `GameModule`,
a shape-only `parseAction`, the error→HTTP map, and `viewFor`, the projection that redacts each player's
face-down stack **from its own owner** down to the top card he is allowed to look at (pg. 2); L4 added
`./client` — a board you can actually play: the maze drawn from the engine's own connectivity, the 12 arrows
with the banned one visibly dead and saying why, the extra tile with a rotation control, the flood-fill
highlighted and clickable, "stay put" as a real button, and the move log in plain English.

**L4b shipped — the board is illustrated.** The direction is **Hedgeglow**: the labyrinth as an enchanted hedge
garden at dusk, corridors of lantern-lit sandstone cut through moss-dark clipped foliage, all 24 treasures
redrawn as original gold-leaf medallions hung like lanterns in the hedge, and the "you are hunting" card
showing its medallion **large** so the 24 are tellable apart in play. The pass touched only the three art
files: the board's structure, its testids and `describe.ts` did not move, and the maze is still legible at a
35px phone tile. `./bot` is still an honest typed placeholder (L5). 355 tests, 100% engine coverage. The
slice plan, the rules digest and every ruling live in **[`ROADMAP.md`](./ROADMAP.md)**.

## Layout

```
src/
  engine/     the pure rules core — no I/O, no Date, no Math.random. 100% coverage gate.
    core/       constants, types, errors, and the rulebook-transcribed tile/treasure data
    internal/   shared helpers (geometry, setup randomness, the kernel record()/seating bindings)
    tests/      one file per concern
  module/     the backend seam — the GameModule: createGame wiring, parseAction, the error map, summarize
  client/     the UI seam — the GameClient + the board
    Board.tsx     the 7×7 maze, the 12 arrows, the extra tile, the panels
    palette.ts    the Hedgeglow colours (L4b)                        ← the art lives in these three
    TileFace.tsx  one tile, drawn from the engine's own openings()   ←
    treasures.tsx the 24 original treasure medallions                ←
    describe.ts   the move log in plain English, from the payloads alone
  bot/        the AI (L5). 90% coverage gate, enabled with it.
docs/
  d2c-findings.md   what building out-of-repo actually cost
```

## Running it

Requires **Node 22** (`.nvmrc`) and **pnpm** (the version is pinned in `packageManager`).

```bash
pnpm install         # resolves @game-hub/* from the public registry
pnpm test            # vitest + the coverage gates (engine 100%; bot 90% from L5)
pnpm test:watch
pnpm typecheck       # strict TS across all four subpaths
pnpm lint            # ESLint 9 flat config — real hazards, not a second typecheck
pnpm format:check    # Prettier (hand-wrap Markdown; *.md is Prettier-ignored)
pnpm build           # tsc → dist/ (JS + .d.ts + inline-source maps), what publishConfig points at
pnpm pack:smoke      # pack, install outside this repo, play a game under plain node, typecheck a consumer
```

⚠️ **Relative imports in the shipped sources carry an explicit `.js` extension** (`'../engine/index.js'`) —
`tsc` emits them verbatim and Node ESM resolves neither extensions nor directories, so extensionless ones
would produce a tarball that throws on a host's first import while every command above stayed green.
`pack:smoke` is what catches it.

CI (`.github/workflows/ci.yml`) runs exactly those, in that order, on a runner with no access to the platform
monorepo.

**Using this package in a host, before it is published:** `pnpm pack` here, then depend on the tarball. The
hub does exactly that from a committed `vendor/` directory, with a one-command refresh loop
(`pnpm labyrinth:refresh` over there) — see its `vendor/README.md`.

## Rules, and what's original

The rulebook PDF is **not** in this repository — it is copyrighted, so it stays local (gitignored) and the
code cites page numbers instead. Mechanics and a list of treasure names aren't copyrightable; the
_illustrations_ are, so every asset here is drawn fresh in the house style and nothing is traced. The tiles are
drawn from the engine's own geometry, and each of the 24 treasure medallions (L4b) is an original silhouette
written as SVG path data in `src/client/treasures.tsx` — from the plain English word, not from the card.

## Licence

BSD-3-Clause (see [`LICENSE`](./LICENSE)). Not affiliated with or endorsed by Ravensburger.
