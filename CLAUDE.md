# CLAUDE.md — @game-hub/game-labyrinth

Working agreement for this repo. It is the lean, repo-scoped version of the Game Hub platform's own
`CLAUDE.md`; read this, then [`ROADMAP.md`](./ROADMAP.md) (rules digest, rulings, slice plan) and
[`docs/d2c-findings.md`](./docs/d2c-findings.md) (why anything here differs from the platform recipe).

## What this repo is

Labyrinth as a **Game Hub game package**, and the platform's **out-of-repo pilot**: the first game built
outside the hub monorepo, against the *published* `@game-hub/kernel` and `@game-hub/ui-kit`. See
[`README.md`](./README.md).

⚠️ **The platform monorepo is a reference, never a dependency.** This repo must contain **no** path, link,
`file:`/`workspace:` dep or import that reaches into it. Its conventions are worth copying; its filesystem is
not available. Two platform packages, from the registry, are the entire coupling:

| Package             | Version   | Why                                                                    |
| ------------------- | --------- | ---------------------------------------------------------------------- |
| `@game-hub/kernel`  | `^1.2.0`  | contracts + primitives (`GameError`, `record`, `makeSeating`, `Viewer`) |
| `@game-hub/ui-kit`  | `^1.0.0`  | the shared board chrome + the game-facing REST helpers (`./client`)     |

Both are **peer** dependencies (the host provides one copy) and **dev** dependencies (so this repo builds and
tests standalone). The ui-kit and `react` are marked **optional** peers: only `./client` needs them, and a
backend host that installs this game for `./module` alone must not be told it owes React. Never add a
dependency on the hub's backend or UI packages — that's an unpublishable package.

⚠️ **The kernel's major version _is_ the host↔game contract version.** `./module` declares
`kernelContract: KERNEL_CONTRACT_VERSION` imported from the kernel it compiled against — **never a literal**,
so a game that ends up resolving a different kernel copy is caught at registration instead of mid-game.

## Non-negotiables

- **Read the rulebook page before implementing a rule, and cite it in a comment** (`// pg. 2: the only
  exception`). Never from memory, never a guess at something checkable. The PDF is local-only (gitignored,
  copyrighted) — page numbers in comments are how the citation survives.
- **Tests ship with the code.** A feature without tests isn't finished. `src/engine/**` is gated at **100%**
  (every branch of a rule is a rule and deserves a test); `src/bot/**` at **90%** (heuristics get retuned; a
  100% bar on judgement calls buys churn). Never weaken a gate to make a change land — including by widening
  `coverage.exclude`.
- **The engine is pure.** No `Date`, no `Math.random`, no mutation, no I/O. Randomness is **injected**:
  Labyrinth spends all of its in `createGame({ rng })` and has none per action. A module or engine file
  reaching for `Math.random` is a bug.
- **Only `record()` touches `version`/`log`** (`internal/record.ts`, the kernel's). Never bump or append by
  hand.
- **Everything logged is public.** A `record()` payload is on the wire. A player's face-down stack is redacted
  in `viewFor` or simply never logged — never hidden in the UI.
- **No new patterns where an established one fits.** Typed error codes on a `GameError` subclass, immutable
  state, one mechanic per file with one matching test file, kernel helpers over re-implementations.

## Conventions

- **Unit tests live in `src/<subpath>/tests/`**, not beside the source. `src/engine/**` is gated;
  `src/module/**` and `src/client/**` are not, and are tested anyway — they are the only proof this game works
  with a host at all (`docs/d2c-findings.md` §6, §20). ⚠️ A **client** test file opts into a DOM with a
  `// @vitest-environment jsdom` docblock on line 1 — not a config change, so the per-glob coverage gates in
  `vitest.config.ts` stay untouched.
- **The artwork lives in three files and nowhere else** — `client/palette.ts` (the Hedgeglow colours),
  `client/TileFace.tsx` (a tile) and `client/treasures.tsx` (the 24 medallions). `Board.tsx` is structure,
  affordances and testids; if a change is about how something *looks*, it belongs in one of the three.
  ⚠️ Those three use **literal colours, never Tailwind classes**: a game package ships classes and no CSS, so
  a host that has not wired Tailwind up must lose the side panels and still keep a readable maze
  (`docs/d2c-findings.md` §21). The board's testids are the hub's e2e contract — additive only.
- **The board asks the engine; it never re-derives a rule.** Affordances come from `legalInsertions` and
  `reachableFrom`; a tile's corridors from `openings()`. If a rules function a UI needs takes a
  `LabyrinthState`, narrow its parameter to the fields it actually reads (ruling 14) rather than copying the
  rule into the client. And **never** `legalActions` in a board — it takes a state, and a client holds a view.
- **`viewFor` and the view types live in the *engine* (`src/engine/view.ts`), not the module** — as in all five
  hub games. What a player may see is as much a rule as what they may do, it belongs under the 100% gate, and
  `./client`/`./bot` must be able to name the projection type without importing `./module`. The module just
  delegates. ⚠️ Build a view **field by field**; never spread the state into one.
- Import siblings by direct path (`./geometry.js`), cross-folder via the barrel (`../core/index.js`), the
  kernel by package specifier (`@game-hub/kernel`). Under `tests/`, reach the engine as `../`.
- ⚠️ **Relative imports in shipped sources carry an explicit `.js` extension** — `'./geometry.js'`,
  `'../core/index.js'`, and `import('./Board.js')` — including the folder barrels, which need the
  `/index.js` spelled out. This is the platform's D2a lesson, re-learned here at D2d: `tsc` emits relative
  specifiers **verbatim**, and Node ESM does neither extension nor directory resolution, so an
  extensionless `from '../engine'` produces a tarball that throws `ERR_MODULE_NOT_FOUND` on a host's first
  import while every check in this repo is green. A `.js` specifier resolves to the `.ts`/`.tsx` source
  in-workspace (TS, Vite and Vitest all do the mapping) *and* to the emitted `.js` in `dist/`, so one
  spelling serves both. Files under `tests/` are excluded from the build and keep the extensionless style.
  `pnpm pack:smoke` is what catches a regression — do not "tidy" the extensions away.
- One mechanic = one file in the relevant folder + one matching test file. Reuse `internal/` helpers.
- The end state is the kernel's union — this game takes `WinnersEndState` (a winner, nothing to tabulate).
  Narrow on `status` before reading `winnerIds`.
- Prettier owns formatting (single quotes, semicolons, trailing commas, width 120). **`*.md` is
  Prettier-ignored — hand-wrap docs to ~110–120 columns.** ESLint catches hazards, not style, and is *not* a
  second typechecker.
- Comments explain **why**, and cite the rulebook page or the decision. If a decision isn't obvious from the
  code, it goes in `ROADMAP.md` — a decision that isn't written down didn't happen.

## Before you call a slice done

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test
pnpm pack:smoke   # slower; run it whenever you touch imports, exports, package.json or the build
```

`pack:smoke` is the only check that runs against **`dist/`** rather than TS source: it packs the tarball,
installs it plus its declared peers **from the public registry** into a throwaway project outside this
repo, plays a game through all four subpaths under plain `node`, and typechecks a consumer against the
shipped `.d.ts` under `nodenext` resolution. Everything else here would stay green while the published
package was unusable.

- **Verify, don't infer.** Green tests are not evidence a feature works — drive the real thing where one
  exists. If you didn't verify it, say so plainly.
- **Surface problems instead of routing around them** — a wrong rule, a bad assumption, a platform-side gap.
  Out-of-repo friction is a **first-class finding**: it goes in `docs/d2c-findings.md`, not into a quiet
  workaround. That file is a deliverable.
- **Keep `ROADMAP.md` and this file current as decisions land**, not in a later cleanup pass.
- Commit at working checkpoints (green gates, coherent slice). **Don't commit or push unless asked.**
