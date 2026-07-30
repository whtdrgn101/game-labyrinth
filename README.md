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

**L0 shipped** — the data spine: the rules types, the tile/treasure data, the fixed board transcribed from
the rulebook's board photo, and `createGame` (injected-rng shuffle, orientations and deal) at 100% engine
coverage. `./module`, `./client` and `./bot` are honest typed placeholders: the bindings that are settled,
and no fabricated behaviour. The slice plan, the rules digest and every ruling live in
**[`ROADMAP.md`](./ROADMAP.md)**.

## Layout

```
src/
  engine/     the pure rules core — no I/O, no Date, no Math.random. 100% coverage gate.
    core/       constants, types, errors, and the rulebook-transcribed tile/treasure data
    internal/   shared helpers (geometry, setup randomness, the kernel record()/seating bindings)
    tests/      one file per concern
  module/     the backend seam — the bound host types + the game's static identity (GameModule at L3)
  client/     the UI seam — the contract/DTO bindings + the typed REST calls (the board at L4)
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
```

CI (`.github/workflows/ci.yml`) runs exactly those, in that order, on a runner with no access to the platform
monorepo.

## Rules, and what's original

The rulebook PDF is **not** in this repository — it is copyrighted, so it stays local (gitignored) and the
code cites page numbers instead. Mechanics and a list of treasure names aren't copyrightable; the
_illustrations_ are, so every asset here is drawn fresh in the house style (L4) and nothing is traced.

## Licence

BSD-3-Clause (see [`LICENSE`](./LICENSE)). Not affiliated with or endorsed by Ravensburger.
