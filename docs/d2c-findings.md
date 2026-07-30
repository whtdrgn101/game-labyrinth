# D2c findings — building a Game Hub game outside the monorepo

Raw log from scaffolding this repo and shipping L0–L1 against the **published** `@game-hub/kernel@1.1.0` and
`@game-hub/ui-kit@1.0.0`. The platform's `docs/game-creation.md` recipe was followed top to bottom; every
place it assumed a workspace, or a published package fell short, is written down here — including the
unflattering parts and the things I could not test from out here.

**Verified in this repo (2026-07-30):** `pnpm install --frozen-lockfile` → `Already up to date`; `@game-hub/*`
resolve to registry tarballs with `sha512` integrity hashes and real directories under this repo's
`node_modules/.pnpm/` (no links, no `file:`, no path anywhere containing the platform repo);
`pnpm typecheck`, `pnpm lint`, `pnpm format:check` clean; `pnpm test` = **60 tests, `src/engine/**` at
100%/100%/100%/100%**. The coverage gate was confirmed to actually _bite_ by adding an untested branch and
watching it fail, then reverting.

**Re-verified at L1 (2026-07-30):** same four gates clean, `pnpm test` = **167 tests, `src/engine/**` still at
100%/100%/100%/100%**. L1 is the first slice with a real mechanic, so it is the first real exercise of the
kernel's `record()` and `makeSeating` from the registry copy rather than from source — **both worked with no
friction at all**, and the seat helper's Labyrinth-bound `GameError` subclass survives the round trip
(asserted in `tests/kernel.test.ts` and again in `tests/applyAction.test.ts`). One new finding, §14.

**Verdict up front:** the four-subpath package shape works out-of-repo essentially as documented. Nothing
was blocked; nothing needed a workaround that changes the game's design. What's missing is all
**scaffolding-and-proof** infrastructure: an external author hand-copies four config files that the hub's
games inherit, and has **no way to test their `./module` or `./client` against a real host** before
publishing. Findings 1, 2 and 6 are the ones worth acting on.

---

## A. Recipe steps that assume the workspace

### 1. `tsconfig.json` extends a file that doesn't exist out here ⚠️ worth fixing hub-side

The recipe's game `tsconfig.json` opens with `"extends": "../../../tsconfig.base.json"`. There is no such
file outside the monorepo and nothing publishes it, so this repo's `tsconfig.json` **inlines the hub's base
compiler options verbatim** (checked field-by-field against `tsconfig.base.json`: `target`/`module`/
`moduleResolution`, `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
`noFallthroughCasesInSwitch`, `noImplicitReturns`, `forceConsistentCasingInFileNames`,
`verbatimModuleSyntax`, `esModuleInterop`, `skipLibCheck`, `resolveJsonModule`, `isolatedModules`,
`declaration`, `sourceMap`) plus the three a game adds for `./client` (`jsx`, DOM libs, `types: ["react"]`).

**This is a silent-drift hazard, not a one-time annoyance.** If the hub tightens a compiler flag, every
out-of-repo game keeps compiling under the old one and nobody finds out until a host build fails.

> **Hub-side suggestion:** publish the base config — either as a tiny `@game-hub/tsconfig` package, or
> (cheaper) ship `tsconfig.base.json` inside the kernel tarball's `files` and export it as
> `@game-hub/kernel/tsconfig.json`, so a game can write
> `"extends": "@game-hub/kernel/tsconfig.json"` and cannot drift. The kernel already exports
> `./package.json`, so the precedent exists.

### 2. The dependency block is workspace-shaped, and the two docs disagree ⚠️ worth fixing hub-side

`game-creation.md` §1 lists `"@game-hub/kernel": "workspace:*"` and `"@game-hub/ui-kit": "workspace:*"` under
**`dependencies`**. `track-d-externalize-games.md` §3 says a game package **"peer-depends on
`@game-hub/kernel`"**. Both cannot be right for an external game, and the recipe — the document written to be
"executable as-is" — is the one that's unusable out here.

Resolved as **peer + dev** for both, plus React: peer says "the host provides exactly one copy", dev lets
this repo build and test standalone. Two concrete reasons peer is right for the **ui-kit** specifically, not
just the kernel:

- **React would double-load.** A game resolving its own ui-kit copy pulls a second React through it — two
  reconciler instances, hooks failing in the shared chrome.
- **Tailwind would silently lose the chrome's styles.** The host scans installed packages with
  `@source '../node_modules/@game-hub'`. A *nested* duplicate at
  `node_modules/@game-hub/game-labyrinth/node_modules/@game-hub/ui-kit` sits outside that glob, so a
  `Button` from the duplicate renders unstyled — the same class of failure as D2b's original contract gap #1,
  and just as invisible in-workspace.

> **Hub-side suggestion:** make §1's dependency block show the out-of-repo form (`peerDependencies` +
> `devDependencies`, with `workspace:*` noted as the in-workspace equivalent), and state the
> peer-not-dependency rule once, in both docs, with the two reasons above.

### 3. The recipe's `vitest.config.ts` carries an in-workspace-only line

The recipe includes `server: { deps: { inline: [/@game-hub\/kernel/] } }` — required in-workspace because the
kernel is consumed as **TypeScript source** and vitest has to transform it. Out here the kernel is built ESM
JS with `.d.ts`, loaded as an ordinary external dependency; the line is unnecessary and was omitted. Tests
pass without it, so **the published kernel loads under vitest with no special handling** — a positive result
for D2a's build work (and the `.js`-extension fix it describes is doing its job: nothing threw
`ERR_MODULE_NOT_FOUND`).

> **Hub-side suggestion:** annotate that line in the recipe as in-workspace-only.

### 4. Everything else in the config quartet is hand-copied

Beyond the tsconfig, this repo hand-ports the hub's root `eslint.config.js` (scoped from a monorepo to one
package), `.prettierrc.json`, `.prettierignore`, and `vitest.config.ts` **including its coverage `exclude`
list** — which the recipe itself flags as dangerous ("port your game's _actual_ type-only/barrel excludes
verbatim — the gate must not silently weaken"). An external author is copying a correctness-relevant list by
hand, from a file they can only read if the platform repo is public to them.

> **Hub-side suggestion (lower priority):** a `@game-hub/vitest-preset` exporting the base coverage config
> and the two per-glob thresholds would make the gates inheritable instead of transcribed. Same argument as
> finding 1.

### 5. `pnpm generate` / the host-wiring checklist doesn't apply yet — by design

Recipe §6 (games.config.ts entry, `pnpm generate`, the per-host dep/alias/include lines) is entirely
hub-side, so it is D2d's work, not this repo's. Noted only so the omission isn't mistaken for a gap. ⚠️ The
recipe's §6 steps 6–7 (**per-subpath Vite aliases** and the `ui/tsconfig.json` include) exist purely because
in-workspace games ship TS source. **A published game must not grow a sixth copy of those** — consuming
`dist` is the whole point — which means D2d is the first time the hub consumes a game the intended way, and
the first time that path is exercised at all.

---

## B. Gaps in what the published packages provide

### 6. There is no way to test `./module` or `./client` from out here ⚠️ the biggest gap

The engine's correctness travels perfectly: the rules are pure, the 100% gate is portable, and it caught real
mistakes today. But **the two host-facing subpaths are untestable outside the monorepo.** In the hub, a game's
module is proven by the backend's REST coexistence suite and its client by Playwright e2e — both live in the
hosts, and neither is published. From out here I can typecheck a `GameModule` implementation and nothing more:
no `create → applyAction → viewFor → summarize → mapError` round trip, no proof that a redaction actually
redacts, no proof that a `parseAction` rejects what it should.

That's tolerable for L0 (`./module` is a placeholder). It is a real risk at L3, where the module is written
blind against a contract and the first genuine execution happens in someone else's repo at D2d.

> **Hub-side suggestion — highest value of anything in this file:** publish a **module-conformance test
> kit** (`@game-hub/module-conformance`, or a `@game-hub/kernel/testing` subpath): a stub `ModuleContext`
> (deterministic `rng`, in-memory `games`/`hub`/`botSeats`) plus a `describeModule(module)` suite asserting
> the contract's invariants — required members present, `versionOf`/`movesOf` agree with `record()`,
> `viewFor` is stable and total over viewers, `parseAction` rejects non-actions, `mapError` maps every
> declared code, `kernelContract` matches. The hub already knows all of this; today it only knows it *about
> its own five games*. Note this closes a gap §2 of the design doc predicted in the abstract ("coverage gates
> are per-repo … the compat contract is what replaces them") — the compat contract turns out to need an
> executable half.

### 7. `SeatedView` is generic over the player type, not the state

My first `./bot` stub wrote `SeatedView<LabyrinthState>` — the natural reading of "the view the bot decides
from". It's `SeatedView<P extends { id: string }>`, generic over the **player**, and `tsc` caught it. Small,
but it is exactly the class of thing only a real out-of-repo typecheck finds, and `game-creation.md` §5 tells
you to "decide from the redacted view" without naming the guard's shape.

> **Hub-side suggestion:** one line in §5 showing `assertBotTurn<YourPlayer>(view, botId)`.

### 8. Published metadata points at a repository an external author may not be able to read

Both tarballs' `repository` field is `git+https://github.com/whtdrgn101/container.git`. If that repo isn't
public, the npm page's "Repository" link is a dead end for anyone who isn't the owner — and the recipe and
design docs it links to are the only documentation these packages have. Both tarballs *do* ship `README.md`
and `LICENSE` (checked), so the essentials are there.

> **Hub-side suggestion:** either make the platform repo public, or fold the "how to build a game" essentials
> into the kernel's README.

---

## C. Tooling friction (not the platform's fault, but real)

### 9. pnpm 11 refuses packages younger than `minimumReleaseAge` — every first consumer hits this

`pnpm install` blocked both `@game-hub/*` packages: pnpm 11 ships a supply-chain guard that won't install a
release younger than a default age, and these were published the same day. pnpm resolves it by **writing
`minimumReleaseAgeExclude` entries into `pnpm-workspace.yaml` itself**, which is where this repo's two
entries came from.

**Re-verified independently today** rather than taken on trust from the earlier scaffolding run: a throwaway
project outside this repo running `pnpm add @game-hub/kernel@1.1.0` printed
`Added 1 entry to minimumReleaseAgeExclude in pnpm-workspace.yaml`. So it is real, reproducible, and hits
**any** first consumer of a freshly published `@game-hub` release. Once the versions age past the threshold
the two entries can be deleted (harmless to leave).

> **Worth a line in the platform's publish checklist**, so the next person doesn't debug it from scratch.

### 10. An empty per-glob coverage threshold is safe (checked)

`vitest.config.ts` pre-declares the `src/bot/**` 90% threshold although L5 hasn't written a bot yet, with the
bot glob deliberately left out of `coverage.include`. Vitest 3.2 does **not** error on a threshold glob that
matches no files, so pre-declaring is safe and L5 only has to flip the `include` line. (Confirmed by running
the suite: gate passes, no warning.)

---

## D. Deferred to later slices — open questions I could not answer from here

### 11. Tailwind: the recipe's answer is unverifiable without a host (L4 / D2d)

D2b's measured answer — ship utility classes in source, **no CSS**, and let the host add
`@source '../node_modules/@game-hub'` — is what this package will follow, and `src/client/index.ts` carries a
⚠️ note saying so. Two things I cannot check from out here, both for D2d:

- **Does the host's glob actually reach the installed _game_ package**, not just the ui-kit? It should — the
  glob names the whole `@game-hub` scope directory — but that depends on the game landing at
  `ui/node_modules/@game-hub/game-labyrinth` under pnpm's hoisting, which nobody has observed yet.
- **The nested-duplicate hole in finding 2**, which peer deps avoid but don't structurally prevent.

### 12. Pawn colour is rules data here, and the platform treats colour as cosmetic ⚠️ needs a host decision

Design-patterns §2 makes a module's `colors` a per-seat palette that **players pick from**, held as
coordination state outside the engine. In Labyrinth the colour **is a rule**: it names the corner you start on
and must return to to win (pg. 1, pg. 2). The engine therefore assigns colours by seat in clockwise board
order and the module's `colors` mirrors them exactly — but if the platform lets a player re-pick a colour,
the board's home corners and the shell's seat tints disagree, and the disagreement looks like a bug in the
game.

Not a blocker for L0–L2, and the first hosted game where the two notions collide. **Two candidate fixes for
the owner to pick at D2d:** (a) an opt-out flag on the module (`colorsAreFixed: true`) so the platform stops
offering the picker for this game, or (b) the engine takes each seat's colour as a `createGame` input, letting
the platform's choice drive the rules. (a) is smaller; (b) is more honest to the physical game, where you
*do* choose your pawn. I'd take (a) — the platform shouldn't have to know the difference, and Labyrinth's
corners are printed on the board.

### 13. Two setup primitives every game needs aren't on the kernel's framework-free barrel

- **`shuffle(items, rng?)`** — `internal/random.ts` is a Fisher–Yates copy of the same helper each hub game
  has (I ported Saint Petersburg's, comment and all). Every game with a deck or a tile bag needs it at setup,
  which by the platform's own extract-on-the-third-example rule is well past the threshold; the kernel's `.`
  barrel doesn't export it, so an external game copies it too.
- **A seeded PRNG for engine tests** — `mulberry32` _is_ published, but only on `@game-hub/kernel/bot`. An
  engine test that wants a reproducible setup either pulls the **bot** subpath into a rules test (wrong
  layer) or reimplements it in `tests/helpers.ts`, which is what this repo and every hub game do. Moving
  `mulberry32` to the `.` barrel (or re-exporting it there) would end the copies.

Low stakes individually; together they're the difference between a game's setup code being written and being
assembled.

### 14. A move log has no readable half until the client exists (L1 → L4)

`MoveRecord` is `{ seq, type, playerId, payload? }` — there is no human-readable field, by design: the hub
renders a feed from a game-specific `describe(move)` living in the game's **client** (Container's
`GameLog.tsx`), passed to the ui-kit's shared `ActivityFeed`. That is the right seam — plain English is
presentation, and it keeps the engine from inventing a wording the UI then has to work around.

The out-of-repo consequence is the same shape as finding 6, one layer along. L1's `INSERT` payload was written
to carry everything a reader needs (`side`, `line`, `rotation`, `tileId`, `ejectedTileId`, `wrapped`), but
**nothing can check that it is sufficient until L4 writes the `describe` and D2d renders it in a real host.**
A payload that turns out to be missing a field is discovered three slices after it was designed. There is a
cheap mitigation an external author would not think of unaided: assert in the *engine* tests that every field
`describe` will want is present and stable — which is what `insert.test.ts`'s exact-log-entry assertion does,
deliberately spelling the whole payload out rather than spot-checking keys.

> **Hub-side suggestion (small):** one line in `game-creation.md` §4 saying that a game's `record()` payload is
> the *input to its client's `describe`*, so payloads should be designed against the sentence they will
> eventually render. The rule "everything logged is public" is stated loudly; the rule "everything the feed
> will say must be in the payload" is not stated at all.
