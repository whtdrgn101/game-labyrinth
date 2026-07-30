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

**Re-verified at L2 (2026-07-30):** same four gates clean, `pnpm test` = **220 tests, `src/engine/**` still at
100%/100%/100%/100%**. L2 completed the turn, so it is the first slice that could be checked the way the hub
checks a game — by *playing* one — and that turned out to be the one thing this repo has no tooling for.
One new finding, §15.

**Re-verified at L3 (2026-07-30):** same four gates clean, `pnpm test` = **295 tests, `src/engine/**` still at
100%/100%/100%/100%**. L3 is the first slice that writes *host-facing* code, so it is where finding 6 (no way
to test `./module` from out here) stops being theoretical: the substitute built for it is described in §6's
update, and it found two real bugs before any host could have. Three new findings, §16–§18, and finding 12 is
now resolved by an owner ruling.

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

**L3 update — what the substitute cost, and what it was worth.** The module shipped, so this stopped being a
risk and became work. `src/module/tests/` hand-builds what a conformance kit would have handed over:
a seeded playthrough driver that runs whole games through `createGame` → `parseAction` → `applyAction`, a
leak scanner that serializes every viewer's projection after every action, an independent restatement of the
error→status table, and per-member unit tests — **~400 lines, none of it Labyrinth-specific except the
policy**. Every line of it is a guess at what a host will actually do: the parse-then-apply order, the
per-viewer projection on every push, the `versionOf`/`movesOf` agreement, the `instanceof`-the-subclass
requirement — all read out of `app.ts` and `game-creation.md` prose rather than executed.

It earned its keep twice, which is the honest argument for publishing the kit rather than for skipping the
work: the playthrough caught a `SeatedView<LabyrinthPlayer>` binding in `./bot` that would have let L5
compile against cards it will never be handed, and the leak scanner caught that the *spec's own wording* for
the invariant ("no treasure name outside `found` and your top card") was unsatisfiable, because all 24
treasures are printed on the public board. Neither is findable by typechecking a module against the contract.

> **What a published kit would have saved, concretely:** the driver and the scanner (both generic — "play
> this module until `summarize().status === 'ended'`, projecting for every viewer at every step" needs to
> know nothing about a game), the contract-member presence checks, and the guesswork about call *order*. What
> it could not have saved is the game-specific half: the entitlement rule ("what may this viewer see?") is a
> per-game statement, and a kit can at most ask for it as a callback. That split is worth designing for —
> `describeModule(module, { entitled })` — rather than aiming for a fully game-agnostic suite.

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

> **Resolved (owner, 2026-07-30): (b).** ROADMAP ruling 6 — colours stay pickable and the pick *is* the
> corner. The rulebook backs it literally ("Each player **chooses** one of the … playing pieces and places it
> on **its own color**", pg. 1 Set Up), which my recommendation had underweighted. Implemented at L3 (ruling
> 12): `createGame` takes `players: { name, color? }[]`, validates against the four, and fills omissions
> deterministically. **The engine half is done and the platform half cannot be done from here — see §16.**

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

### 15. There is no way to *run* a game out here — no script runner, no bench ⚠️ worth fixing hub-side

L2 finished the turn loop, so the honest check is the hub's own: drive a whole seeded game through
`applyAction` and look at the result. In the monorepo that is `pnpm bench` (`packages/bench`, a dev-only
harness every game's bot is calibrated with). Out here there is **nothing to run a TypeScript file with**:
the recipe's `devDependencies` are eslint/prettier/typescript/vitest/coverage and React types — no `tsx`, no
`ts-node`, and although `vite` is present transitively under vitest, pnpm's strict node_modules means neither
`vite-node` nor a bare `import 'vite'` resolves from a script.

What worked, and what it cost: a scratchpad `.mjs` that imports Vite **by absolute path into
`node_modules/.pnpm/vite@<version>/…`**, spins up `createServer({ middlewareMode: true })` and
`ssrLoadModule('/src/engine/index.ts')`. That does run the real shipped source, but it hard-codes a version
directory that any `pnpm update` invalidates — not something to check in, and not something an external author
would work out unaided. The alternative (a full-game test *inside* `src/engine/tests/`) is worse: a
thousand-turn playthrough is a slow, flaky thing to put behind a coverage gate, and it isn't a unit test.

> **Hub-side suggestions, cheapest first:** (a) add `tsx` to the recipe's `devDependencies` and a
> `"play": "tsx scripts/play.ts"` line to the scripts block — one dependency, and every game gets a way to
> drive itself; (b) publish the bench harness as `@game-hub/bench` so an external game can calibrate a bot at
> L5 the way an in-repo one can — otherwise finding 6's gap ("no way to test `./module` or `./client`")
> extends to `./bot` as well, and a published bot's strength is nobody's measured number.

## E. Found at L3 (the module seam)

### 16. `createGame` has no colour channel, so a lobby pick can't reach the rules ⚠️ needs a kernel minor

Finding 12's resolution (owner ruling 6) makes a pawn colour **rules data** in Labyrinth: the colour you pick
is the corner you start on and must return to. The engine now takes it — `createGame({ players: [{ name,
color? }] })`, validated as one of four with no duplicates. The module is wired to pass it through. And it
still cannot arrive, because kernel contract 1 types the member:

```ts
createGame(opts: { id: string; players: readonly { name: string }[]; rng: () => number }): S;
```

There is no seat-colour parameter, and `ModuleContext` (which *does* expose `colorsFor`) is not handed to
`createGame` — by design, since setup must be pure. So the host knows every seat's chosen colour, stores it
as coordination state, renders it in the shell, and has no way to tell the game about it.

**What this costs today, exactly:** nothing on a default table and a visible contradiction on a picked one.
The platform's no-picks default is palette order (seat *i* → `colors[i]`), Labyrinth's `colors` is
`SEAT_COLORS`, and the engine's own fill is the same list in the same order — so an unpicked game agrees by
construction, which is why this is not a blocker. But a player who picks **yellow** in the lobby gets a
yellow chip in the shell's seat list and a **red** pawn on the red corner in the game, and the two never
reconcile. L4's board is told to colour pawns from `view.players[].color` (never the payload's `colors` map),
which hides the worst of it; the lobby list still lies.

> **Hub-side suggestion (additive minor, contract stays 1):** widen the member to
> `players: readonly { name: string; color?: string }[]` and have the core fill each seat's stored pick from
> the same source `colorsFor` reads. It is strictly additive — every existing game ignores the field, and a
> `{ name }` is already assignable to `{ name, color? }`, so no game needs touching. This package's module
> **already declares the wider parameter type** (`NewGameOptions`) and its `newLabyrinthGame` is exported
> from the `./module` barrel, so a host that wants to pass picks before the kernel moves can call that
> directly. Worth deciding *before* D2d wires this game in, because until then Labyrinth's colour picker is
> a picker that doesn't pick.

### 17. `GameSummary` can't carry a game's own progress, so lobby cards are all the same card

`summarize` returns the contract's `{ id, turn, status, activePlayerId, players: [{ id, name }] }` — nothing
else, and rightly so, since the core renders it game-agnostically. For Labyrinth the one thing a player
resuming a game actually wants is **how many treasures each seat has found out of its deal** (6/8/12 by seat
count), which is entirely public — it is the face-up pile in front of each player (pg. 2). There is nowhere
to put it. Every hosted game has quietly had the same gap (Container shows a turn number, Saint Petersburg
substitutes its round counter for `turn` to squeeze *something* game-specific through), so this is a
platform-wide shortfall rather than a Labyrinth quirk; an out-of-repo game just has no option of patching
the host's list component to compensate.

> **Hub-side suggestion (additive minor):** an optional `detail?: readonly { label: string; value: string }[]`
> or a single `subtitle?: string` on `GameSummary`, rendered by the games list if present. Deliberately
> stringly-typed and secret-free by construction — the module is already the thing that knows what is public.

### 18. A redacted view can't be fed back into the engine — the first game whose bot needs to search

Every entry point that *changes* or *enumerates* a game takes the full state: `applyAction(state, …)`,
`legalActions(state, …)`, `legalInsertions(state)`. `viewFor` returns something deliberately different (a
seat's `stack` is `null` or one card). So a bot, which by the platform's own rule (`game-creation.md` §5,
"decide from the redacted view") only ever holds a view, **cannot simulate a candidate move**.

The hub's five bots don't notice, because none of them searches: `decide(view, playerId)` scores heuristics
and returns an action, and self-play holds the real state to advance it. Labyrinth's L5 is the first that
genuinely wants lookahead — ≤ 12 arrows × 4 facings × a flood-filled reachable set is a real branching
factor, and the whole reason this game was picked. This is a *game-design* problem to solve at L5, not a
platform bug, but it is worth recording as a contract observation: **the seam publishes a view type it then
refuses to accept back.** The pure geometry helpers that take a `board` (`reachableFrom`, `connects`,
`linePath`, `INSERTIONS`) are the escape hatch and are why L5 is still tractable.

> **Hub-side note, not a suggestion:** worth a line in `game-creation.md` §5 saying that a searching bot
> needs its game's engine to expose board-level mechanics (not just state-level ones), since the view it is
> handed is not a state. The alternative — letting bots hold real state — would quietly delete the guarantee
> that a bot can't cheat, and should not be the answer.

---

## F. Found at L4 (the client — the board)

### 19. The view can't be handed to the rules that decide affordances — §18, one layer up

§18 recorded that a **bot** can't feed `viewFor`'s output back into the engine. L4 hit the same wall from the
other side: a **board** holds a `LabyrinthView` and needs to know which of the 12 arrows are live, and the
function that knows — `legalInsertions` — took a whole `LabyrinthState`. So the board's only options were to
re-implement pg. 2's "only exception" in the UI (a rule with two implementations, the thing a client may
never hold) or to change the engine.

**Fixed in this repo, in the engine, in the smallest possible way:** `legalInsertions`/`isLegalInsertion` now
take `PushHistory = Pick<LabyrinthState, 'lastPush'>` — the fields they were already the only readers of. A
state satisfies it, a view satisfies it, no caller changed, coverage did not move. The rule stayed in one
place, which was the point.

> **The general lesson, and it is a platform one:** a game's public surface has *three* audiences with three
> different objects — the module (a state), the bot (a view), the client (a view) — and the hub's five games
> never noticed because none of their boards asks the engine anything; they all read a flat field off the view
> and decide in the UI. Labyrinth's board asks four questions (`reachableFrom`, `legalInsertions`, `openings`,
> `START_CORNERS`) and three of the four were already view-safe by accident, because they take a `board`.
> **A rules function that a UI will need should be typed against the narrowest slice it reads, not against the
> state**, and `game-creation.md` §4 is where that belongs. It costs nothing and it is the difference between
> the UI asking and the UI guessing.

### 20. There is no way to test a `./client` out of the monorepo either — and the stack is not small ⚠️

Finding 6 said there is no way to test `./module` or `./client` from out here. L3 built a substitute for the
module (§6's update). L4 needed one for the client, and this is the shape of it:

- **The whole React DOM test stack is the game's problem.** The hub's games are tested by `ui/`'s Playwright
  suite and inherit its browser; a package outside the workspace has none, so this repo added `react-dom`,
  `jsdom`, `@testing-library/react` and `@testing-library/dom` as devDependencies (~53 packages) to render its
  own board at all. That is a reasonable cost, but it is **not in `game-creation.md`**, which describes a
  game's `./client` without mentioning that testing one requires a DOM the recipe never installs.
- **`react-dom` is a devDependency and deliberately not a peer.** The package itself never imports it (JSX
  needs only `react/jsx-runtime`); only the tests do. A host brings its own.
- **One line per test file, not a config change.** Vitest 3 deprecated `environmentMatchGlobs`, and a second
  test *project* would have duplicated this repo's per-glob coverage gates — the one thing not worth risking.
  A `// @vitest-environment jsdom` docblock in each client test file does the whole job and leaves
  `vitest.config.ts`'s thresholds untouched.

> **Hub-side suggestion:** `game-creation.md` §4 should name the four devDependencies and the docblock. It is
> five lines, and without them an external author's first board is untested — which is exactly the failure the
> platform's non-negotiables exist to prevent.

### 21. `@game-hub/ui-kit` depends on ~16 CSS variables it neither ships nor documents ⚠️ worth fixing hub-side

§11 asked whether the host's `@source` glob really reaches an installed game package. Building a throwaway
Vite + Tailwind v4 harness to render this board answered that **and** turned up something bigger.

**Verified:** an **absolute** `@source '/abs/path/to/game/src/client'` works in Tailwind v4, and the utilities
in an out-of-tree package are generated correctly from it. So the mechanism §11 doubted is sound.

**But `@source` is only half of what a host owes.** Every ui-kit component — and therefore every game's chrome
— is written in *semantic* utilities: `bg-card`, `text-muted-foreground`, `border`, `bg-primary/10`,
`text-destructive`, `bg-muted`, `variant="secondary"`. Those resolve through `--color-card`,
`--color-muted-foreground`, `--color-border`, `--color-primary`, … — **sixteen custom properties that the
published tarball does not contain and its README does not list**, plus the `.reveal-in` keyframes
`GameOver` animates with. They live in the hub's `ui/src/index.css`, which an external host cannot read.

Measured, by rendering this board twice in the harness — once with the hub's token block copied in, once
without ([`board-desktop.png` vs `board-no-tokens.png`], scratchpad):

| | with tokens | without |
| --- | --- | --- |
| Layout, grid, spacing | correct | **correct** — `@source` did its job |
| The maze itself | correct | **correct** — the tile picture is inline SVG with literal fills |
| Panels, cards, borders | card surfaces, grey secondary text | flat white, black text, invisible borders |
| The "your turn" banner highlight | tinted + primary border | **gone** |
| `Button variant="secondary"` ("Stay put") | filled | **no fill — reads as disabled text** |

Nothing *breaks*; it degrades to something that looks like a bug in the game. That the maze survives at all is
a design decision made in this repo, not a property of the platform: `TileFace.tsx` draws with literal fills
precisely so a mis-wired host loses the chrome and not the board.

> **Hub-side suggestion, cheapest first:** (a) ship a `tokens.css` in `@game-hub/ui-kit` with the default
> `:root`/`.dark` blocks and the `reveal-in` keyframes, and tell hosts to `@import` it — one file, and the
> ui-kit becomes self-sufficient; (b) failing that, **document the list** in the ui-kit README, because right
> now the only way to discover it is to render a board against an empty stylesheet and see what vanishes.

### 22. Two things that worked, unprompted, and are worth not breaking

- **`ActionTip` handles a disabled child.** It listens on its own wrapper, not on the child, so Labyrinth's
  banned arrow — which must be visibly present, dead, and able to say why (pg. 2's own hint) — can explain
  itself on hover even though a disabled `<button>` fires no pointer events. That is not stated anywhere; it
  is a real property of the implementation and this board depends on it.
- **`ActivityFeed`'s split is the right one.** Rendering the actor's name and the 🤖 badge itself, and asking
  the game only for the rest of the sentence, meant Labyrinth's `describe` is a pure function of a
  `MoveRecord` — which is what makes it unit-testable without a DOM (16 of this slice's tests) and what keeps
  a per-viewer secret from being reachable from inside it.
