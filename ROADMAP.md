# Labyrinth — roadmap

**What this is:** Ravensburger's _The aMAZEing Labyrinth_ (2017 rules) as a **Game Hub game package** —
and the platform's proof that a game can be built entirely **outside** the hub monorepo, against the
published `@game-hub/kernel` and `@game-hub/ui-kit`. See [`README.md`](./README.md) for the pilot story and
[`docs/d2c-findings.md`](./docs/d2c-findings.md) for what that cost.

**Status:** **L4b shipped** (2026-07-30) — the board is **illustrated**. The owner picked **Hedgeglow** from
the three comps: the labyrinth as an enchanted hedge garden at dusk — corridors of lantern-lit sandstone cut
through moss-dark clipped foliage, treasures as gilt-ringed medallions hung like lanterns in it. All 24
treasures are original drawings, the hunted card shows its medallion **large** (the owner's second decision),
and the whole pass fitted inside the art files L4 isolated for it: the board's structure, its testids and
`describe.ts` did not move. 355 tests, `src/engine/**` still at 100%. **Next: L5, the bot.** Detail in
[What L4b built](#what-l4b-built-the-hedgeglow-art-pass).

Earlier: **D2d shipped** (2026-07-30) — this package is now **installed and playable in the Game Hub**.
The pilot's question is answered: a game built out here, against published `@game-hub/*`, hosts in the hub as
an ordinary dependency resolving to compiled `dist/` — no Vite alias, no tsconfig include, nothing reaching
back into the monorepo — and `docker compose up --build` over there produces an image where Labyrinth is the
playable sixth game. This repo gained a real build (`tsconfig.build.json` → `dist/`, `publishConfig`,
`prepack`, version `0.1.0`) and `pnpm pack:smoke`, which installs the tarball outside this repo and plays a
game under plain `node`. (Publishing to npm is the one thing not done — the hub vendors the packed tarball
meanwhile.)

Earlier: **L4 (functional stage)** (2026-07-30) — the game became **playable**: a 7×7 maze drawn from
the engine's own `openings()`, the 12 arrows with the banned one visibly dead and explaining itself, the extra
tile with a rotation control, the flood-fill highlighted and clickable, "stay put" as a real button, per-seat
found rows and face-down counts, the hunted card (yours only, a card back otherwise), and the move log in
plain English. Verified in a real browser, not inferred: a throwaway Vite harness mounted the shipped
`Board.tsx` over a real `viewFor` projection and drove a whole turn through the real `parseAction` +
`applyAction` (evidence below). 352 tests, `src/engine/**` still at 100%.

Earlier: **L3** (2026-07-30) — the backend seam: the real `GameModule`, `viewFor`'s three-case redaction (your
own stack cut to its top card, everyone else's to a count), a shape-only `parseAction`, the error→HTTP map,
and the `createGame` signature change that makes **your chosen pawn colour your starting corner** (ruling 6).

The authoritative rules are the rulebook PDF (`reference_materials/TheAMAZEingLabyrinth.pdf` — gitignored,
copyrighted; page numbers are cited in comments instead). ⚠️ **Read the page before implementing a rule.**

---

## Rules digest (rulebook read 2026-07-29/30 — 2 pp.; page refs are to that PDF)

- **Board**: 7×7 = 49 squares. **16 fixed tiles** at the even/even coordinates: 4 corner starting squares
  (one per player colour) + 12 treasure-bearing T-junctions. Shapes/orientations/treasures are _not_
  tabulated in the rulebook text — **transcribed from the pg. 1 board photo** in `src/engine/core/tiles.ts`
  (done at L0; see "Rulings and deviations" for what was certain and what wasn't).
- **34 movable tiles**: 12 straights (no treasure), 16 corners (6 with treasure), 6 T's (all with treasure).
  ⚠️ The rulebook omits this distribution entirely; it is pinned by the treasure arithmetic the rulebook
  _does_ give (24 cards − 12 on fixed tiles = 12 on movable = 6 + 6) and matches independent
  implementations. 33 are shuffled and placed at setup (injected rng: order _and_ per-tile orientation);
  1 remains as the extra tile (pg. 1 Set Up).
- **24 treasure cards**, shuffled and dealt evenly — 12/8/6 each at 2/3/4 players (pg. 1); 24 divides
  exactly at every seat count, so the deck is always fully dealt. Kept as face-down stacks; **hidden
  info**: a player sees only _their own top card_ (pg. 2). Public: everyone's flipped-card piles and stack
  counts.
- **Turn = two mandatory-ordered steps** (pg. 2): **1) move the maze, 2) optionally move your piece.**
  - **Slide**: 12 arrows mark the insertion points (both ends of the 3 movable rows and 3 movable columns —
    the odd lines). Insert the extra tile (any of its 4 rotations) at an arrow; the opposite-end tile is
    pushed out and becomes the new extra tile. **The one illegal slide: re-inserting where the last tile
    was pushed out** (pg. 2, "The only exception") — state carries `lastPush`; all 12 are legal on turn 1.
  - A pawn standing on the pushed-out tile **wraps around** to the newly inserted tile (pg. 2) — and
    explicitly "does not count as your turn". First hosted game where one player's action relocates
    another player's piece.
  - The slide is **mandatory even if you could reach your treasure without it** (pg. 2 "Important").
  - **Move**: to any square reachable along connected paths, any distance, or stay put (pg. 2). No
    blocking — the rulebook has no occupancy restriction; pawns share squares.
- Landing on your current card's treasure **flips the card face-up** (public) and reveals your next target
  (pg. 2).
- **Win**: all your cards flipped **and** your pawn back on its own starting corner — immediate (pg. 2,
  "Ending the Game").
- **Variant (L6)**: "For younger children" (pg. 2) — all cards face-up, chase any of your treasures in any
  order. Removes the hidden info; a clean rules toggle.

## Why this game flexes the engine

- **Connectivity over mutating topology**: movement legality is a flood-fill over tile edge-matching,
  recomputed after every slide; a full decision is slide (≤ 12 arrows × 4 rotations, minus the reverse) ×
  reachable-set — bounded but real search, and the bot (L5) will search it.
- **Redaction with structure**: per-player secret _stacks_ where only the owner's top card shows — Saint
  Petersburg-style `viewFor` with a new shape (SP redacts whole hands; this redacts all-but-top of your own).
- **Setup-only randomness** (shuffle, orientations, deal) — Russian Railroads-style; no per-action rng at
  all, so every turn after setup is a deterministic function of the players' choices.

---

## Rulings and deviations

Decisions where the rulebook could not be followed literally, or could not be read at all. Each is a
deliberate, recorded choice — not an accident of implementation.

### 1. Start player: **seat 0** (L0)

The rulebook says "The last player to go on a treasure hunt goes first" (pg. 2) — a joke about the players'
lives, with nothing in the game state to evaluate. The two honest replacements were an **rng draw** or
**seat 0**; seat 0 wins:

- **Seat order is already the randomisable thing, and it belongs to the lobby, not the engine.** Whoever
  sits where is decided before `createGame` is ever called. Drawing a start player inside the engine would
  randomise the same decision twice, in the layer that has less information about it.
- **Three of the five hosted games open at seat 0** (Container, Stone Age, Can't Stop). The two that don't
  (Saint Petersburg, Russian Railroads) derive their opener from a *rulebook-specified* random setup step —
  a marker deal, a bonus queue. Labyrinth has no such step, so there is nothing to derive it from.
- **It keeps a seeded replay legible**: seat 0 always opens, so a log reads the same way every time, and a
  test fixture doesn't have to know the seed to know whose turn it is.
- The rule it replaces isn't random either — it's a table-fiction tiebreak. Substituting a coin flip would
  be inventing randomness the game doesn't have.

Implemented in `createGame` (`activePlayerIndex: 0`, cited there).

### 2. The fixed board is transcribed from a photograph (L0)

The 16 printed tiles are given nowhere in the rulebook text — only in the pg. 1 board illustration. They are
transcribed into `src/engine/core/tiles.ts` as `shape` + `rotation`, with an ASCII map in the doc comment.

- **Shapes and orientations: confident.** The layout came out exactly **90°-rotationally symmetric** — which
  the real board must be, since it has to look the same from all four seats — and
  `src/engine/tests/tiles.test.ts` asserts that symmetry over all 16 tiles. A misread shape or orientation
  would almost certainly break it, so the data has a real check behind it, not just a careful eye.
- **Which treasure sits on which fixed tile: best effort.** The board diagram renders each treasure at
  roughly 12 px in the source PDF (the page is a single 854×1197 raster — verified with `pdfimages`; there is
  no higher-resolution copy to zoom into), so icons were matched to the much larger card illustrations by
  silhouette and colour. A name could be wrong. **No rule depends on which treasure is where**, only that
  each of the 24 appears exactly once, so a correction is a one-line data edit.

### 3. Treasure names are invented labels for read icons (L0)

The rulebook never names a treasure. The 24 names in `src/engine/core/treasures.ts` are plain classic English
words read off the pg. 1 card illustration. Three icons are genuinely ambiguous at that resolution —
`genie` (a spirit rising from a jar), `ghost` (a pale apparition) and `lamp` (a vessel on a cloth) are three
distinct pictures whose three names could be permuted — and `spellbook` could as fairly be `grimoire`. Each
is _some_ distinct treasure either way. Names are data; L4 draws original artwork per name (mechanics and a
treasure list aren't copyrightable; Ravensburger's illustrations are, so nothing is traced).

### 4. Which movable tile carries which treasure: by fiat (L0)

The loose tiles appear only as three face-up stacks in the pg. 1 illustration, four tiles visible. One is
legible — a **corner tile bearing the dragon** — so `dragon` sits on a corner on evidence; the other eleven
movable treasures are distributed corners-first in card order. No rule reads a tile's shape together with its
treasure, so this affects flavour only.

### 5. Tile orientation is drawn from the rng at setup (L0)

Setup shuffles the tiles **face down** and lays them out (pg. 1), so a tile's orientation is as arbitrary as
its square. The engine models that explicitly: every placed tile (and the extra tile) draws a rotation.
⚠️ A `straight` has period 180°, so half its draws are visually indistinguishable — same as the physical
game, and nothing downstream may assume a rotation is unique to an opening set.

### 6. Pawn colour is rules data: your pick decides your corner (decided by the owner, 2026-07-30)

The platform treats a module's `colors` as a per-seat palette the *players* pick from (coordination state
outside the engine). In Labyrinth the colour **names the corner you start on and must return to** (pg. 1,
pg. 2). **Owner ruling: colours stay pickable in the lobby, and the colour you pick IS your starting
corner — the colour→corner binding is fixed rules data**, exactly like taking a pawn from the physical
box. The rulebook agrees literally: "Each player **chooses** one of the … playing pieces and places it on
**its own color** in one of the four corners of the game board" (pg. 1 Set Up) — the piece is picked, and
the pick names the corner.

**Implemented at L3**; see ruling 12 for the signature, the defaulting rule and the one surprise it turned
up. ⚠️ What is *not* done, and cannot be from in here: the lobby's picks still can't reach `createGame`.
Kernel contract 1 types it `players: { name }[]`, with no colour channel at all — the engine and the module
both accept one already, and the platform has to open it. `docs/d2c-findings.md` §16.

### 7. The contents/setup piece-count contradiction: moot

Pg. 1 lists "4 playing pieces" but Set Up says "one of the 6 playing pieces" (a print-run artefact of an
edition with 6 pawns). At 4 seats maximum, 4 pieces is all the game can use — no decision needed.

### 8. A pawn travels with the tile it stands on (L1) — derived, not stated

The rulebook says exactly one thing about pawns during a slide: "If the path tile you push out has a playing
piece on it, put this piece on the opposite side of the board on the path tile that was just placed. Moving
this piece does not count as your turn!" (pg. 2). It never says what happens to a pawn standing on one of the
other six tiles of the pushed line. The engine **carries it along with its tile**, one square in the push
direction. The reasons, strongest first:

- **The wraparound rule proves it.** If a pawn simply stayed on its square while the tiles slid underneath,
  the pawn on the ejected tile would need no rule at all — it would stay put on a square that now holds its
  neighbour's tile, and nothing special would have happened. The rule exists *because* the pawn goes wherever
  its tile goes, and in that one case its tile is leaving the board. A rule written for the exception
  presupposes the general case.
- **It is what happens at a physical table.** The tiles are pushed bodily along the groove; a plastic pawn
  standing on one goes with it. The rulebook is describing the only case where the physics needs help.
- **Every independent implementation does the same.** Being pushed around is a real part of the game's
  tactics — parking on a line an opponent wants to push has a cost.

Implemented in `actions/insert.ts` as one walk of the line: a pawn on `path[i]` ends on `path[i + 1]`, and
the far end wraps to `path[0]`. Both facts are the same expression, so the wrap cannot drift from the carry.
⚠️ If this is ever judged wrong, it is a one-line change (drop the carry, keep the wrap) — but the ROADMAP
entry, not the code, is where the argument lives.

### 9. L1 ends mid-turn: passing the turn belongs to L2's move (L1)

The L0 slice plan listed "turn passing" under L1. It moved to L2, deliberately. A turn is **two** mandatory
steps (pg. 2), and what ends it is the *second* one — moving the pawn or deciding to leave it ("Or, you can
leave your playing piece where it is"). So after `INSERT` the state sits in `phase: 'move'` with the same
seat on the clock, and nothing advances `turn`/`activePlayerIndex` yet.

The alternative was a placeholder `PASS_MOVE` action to keep the engine playable through L1. It was rejected:
it would be a second, throwaway way to say "I stay put" that L2's `MOVE` already has to express properly, and
a temporary action type leaks into the module, the client and every fixture that uses it. An engine that
honestly stops half way through a turn is a better intermediate state than one that invents a rule to avoid
stopping. **Consequence:** until L2 lands, `legalActions` returns `[]` in the `move` phase, and any test or
script that wants a second slide hands the turn on itself (`readyToInsert` in the engine tests does exactly
that, and says so).

### 10. A treasure is found where the piece **stops**, never where it passes (L2)

The rulebook says "you try to get to the square showing the same treasure as on your card" and "Once you
find the treasure you are looking for, turn over your treasure card" (pg. 2). It never addresses a piece
that crosses its own treasure on the way somewhere else — at a physical table nobody asks, because the
question only exists once a computer is doing the walking. The engine flips **only** when the move ends on
the treasure's square. Strongest reason first:

- **The engine is handed a destination, not a route.** Movement is legal iff the target is in the flood-fill
  (pg. 2, "any square that you can move your piece to directly, without interruption") — a *set*, not a path.
  A maze square is typically reachable by several routes, so "the squares you passed through" is not a
  well-defined quantity unless the action starts carrying a declared path. Flipping on pass-through would
  mean inventing that payload, and with it the question of which route a player *meant*.
- **It matches the physical game exactly.** A hand slides a pawn along the groove and the table looks at
  where it came to rest. Nobody audits the intermediate squares.
- **It keeps a real decision in the game.** "Stop on the treasure or carry on to a better square" is a choice
  a player makes; auto-collecting anything under the pawn's route would delete it.

⚠️ The consequence is that a player *must* end a turn on their treasure to claim it — which is exactly the
tension the rulebook's own hint describes ("If you are unable to get to the treasure you are searching for,
you can move your playing piece into a position that gives you a good starting point for your next turn").
Tested in `move.test.ts` ("checks only the square the piece STOPS on").

### 11. "Stay where you are" is a `MOVE` to your own square, not a second action (L2)

"Or, you can leave your playing piece where it is" (pg. 2). The two ways to model it were a distinct
`PASS_MOVE`/`STAY` arm, or a `MOVE` whose target is the square the piece already occupies. The second wins,
and it is the same argument that rejected a placeholder `PASS_MOVE` at L1 (ruling 9):

- **The flood-fill already contains the origin square**, unavoidably — a set of reachable squares always
  includes where you started. So "stay" is *already* a legal target; adding an action for it would be a
  second spelling of a move the engine must accept anyway, and two spellings of one move is two code paths
  through the flip, the win check and the turn hand-off.
- **It keeps a turn exactly two actions.** `INSERT` then `MOVE`, always, at every seat — the module, the
  client and the bot each get one shape to handle rather than a special case.
- The client can still *render* it as a "stay put" button; that is presentation over a `MOVE` payload whose
  `from` equals its `to`, which is precisely what the log entry says.

### 12. Your pawn is an input, and turn order is still the table's (L3)

Ruling 6 made a colour rules data; L3 had to decide *how* it arrives. `CreateGameOptions.players` is now
`{ name, color? }[]`:

- **The pick decides the corner**, not the seat. `START_CORNERS[color]` was always the placement rule; only
  the source of `color` changed.
- **A colour is validated in the engine**, against `SEAT_COLORS` — one of the four, and no two seats holding
  the same pawn (there is one of each in the box). Both refusals are the new `INVALID_PLAYER_COLOR` (→ 400).
  The module hands the pick through **unvalidated on purpose**, so "which colours exist" is defined once.
- **`color` is optional, and an omitted one is filled deterministically** from the pawns still unclaimed, in
  `SEAT_COLORS` order, seat by seat. With no picks at all, seat *i* gets `SEAT_COLORS[i]` — byte-identical
  to the old behaviour, which is what kept every L0–L2 fixture and test valid, and what makes the platform's
  own palette-order colour default agree with the rules for free.

⚠️ **The surprise: turn order and corner order are no longer the same thing.** Until L3 they coincided,
because colours *were* seat order. They coincide no longer: seats picking `blue, red` play blue first, and
blue's corner is not clockwise-next after red's. That is correct — pg. 2's "play continuing in a clockwise
direction" describes the players around the *table*, which the lobby's seating already encodes (ruling 1),
and at a physical table nobody checks you sat next to your own pawn. Nothing in the engine reads seat order
as board geometry, so this needed no code; it is written down because a future reader of `SEAT_COLORS` would
otherwise reasonably assume the old invariant still holds. **L4 must draw a player's corner from
`player.color`, never from their seat index.**

### 13. A rules refusal is a 409, not a 422 (L3)

The L2 spec for `mapError` proposed **422** for `ILLEGAL_INSERTION`/`UNREACHABLE` — "well-formed but
semantically wrong" — and 409 only for turn/phase errors. L3 ships **409** for all five rules refusals, and
400 for the four payload codes. The 422 reading is defensible in the abstract; two things beat it:

- **The platform has never emitted a 422.** All five hosted games map 404 / 400 / 409 and nothing else
  (`errors.ts` in each). An out-of-repo game is the worst possible place to introduce a fourth status class
  for the shared UI to learn — the game would be teaching the host a new vocabulary from outside.
- **409 is not a stretch for any of them.** "Conflict with the current state of the resource" is exactly what
  "that arrow would undo the last push" (pg. 2) and "no corridor leads there" are: the move is conceivable
  and would be legal in another position. Nothing about it is unprocessable.

The split that *does* matter — payload mistakes vs. rules refusals — is kept, as 400 vs. 409, which is the
same line the engine's error codes are already drawn along.

### 14. The board asks the engine — so a rule's signature widened rather than gaining a second copy (L4)

`legalInsertions(state)` took a `LabyrinthState`. A board holds a `LabyrinthView`. So the UI could either
re-derive pg. 2's "only exception" from `lastPush` itself — a rule with two implementations, which is the one
thing a client may never hold — or the engine could change.

It changed, minimally: `legalInsertions`/`isLegalInsertion` now take
**`PushHistory = Pick<LabyrinthState, 'lastPush'>`**, the field they were already the only readers of. A state
satisfies it; so does a view. No caller changed, no behaviour changed, coverage did not move.

- **The alternative was worse in a way that compounds.** Two copies of the no-reverse rule means the arrow you
  can *press* and the insertion the engine will *accept* are separate facts that agree only by luck. The class
  of bug is "the UI offered a move the server rejected", which reads to a player as the game being broken.
- **It generalises.** A game's public surface serves three callers with three different objects — the module
  (a state), the bot (a view), the client (a view). Typing a rules function against *the fields it reads*
  rather than against the whole state is what makes it answerable to all three. `reachableFrom`, `connects`,
  `linePath` and `openings` were already fine, because they take a `board`; `legalInsertions` was the only one
  that wasn't. `docs/d2c-findings.md` §19.
- ⚠️ **`legalActions` is deliberately left alone.** It builds `MOVE` arms from the active seat's position and
  genuinely needs a state. The board does not call it and does not need to: `reachableFrom` gives it the same
  set from a board.

### 15. Coordinates: 0-based in testids, 1-based in everything a player reads (L4)

The engine is 0-based (`{ row: 0, col: 0 }` is the red corner) and the board's `data-testid`s carry engine
coordinates verbatim (`tile-3-5`), because they are the e2e contract at D2d and a testid that disagreed with
the state would be a trap. But "row 0, column 0" is not how a board game is spoken at a table, and the move
feed and the screen-reader labels are prose.

So prose is **1-based**, and the conversion happens in exactly two places — `describe.ts` and the board's
`aria-label`s — both of which say so. The alternative (0-based prose) was rejected as user-hostile; the other
alternative (1-based testids) as a silent mismatch with every other tool that reads the state.

---

## Slice plan

Vertical slices, each green and demoable. The engine's 100% coverage gate holds from L0 on; the bot's 90%
gate turns on with L5.

- **L0 — data spine** ✅ (2026-07-30): types; the tile, treasure and fixed-board data (pg. 1 photo,
  transcribed and symmetry-checked); `createGame` with injected-rng shuffle/orientations/deal; the
  start-player ruling. 60 tests, `src/engine/**` at 100%. Also: the repo itself — pnpm, strict TS, ESLint 9 +
  Prettier, per-glob coverage gates, GitHub Actions CI installing `@game-hub/*` **from the public registry**,
  and the four subpath exports (`./engine` real; `./module`, `./client`, `./bot` typed placeholders).
- **L1 — the slide** ✅ (2026-07-30): `opposite`/`neighbor`/`samePosition` geometry; `INSERTIONS` and the
  line walk (`entrySquare`/`exitSquare`/`linePath`); `legalInsertions` + the no-reverse rule (`reverseOf`);
  the `INSERT` action — shift the line, eject the far tile into `extraTile` at its own facing, carry pawns
  along and wrap the ejected one round (ruling 8), `lastPush`, `phase: insert → move`; the
  `Action`/`applyAction`/`legalActions` seam (48 candidates opening, 44 after); four typed rejections
  (`WRONG_PHASE`, `INVALID_ROTATION`, and `ILLEGAL_INSERTION` for both "not an arrow" and the reverse).
  Turn passing moved to L2 (ruling 9). 167 tests, `src/engine/**` at 100%.
- **L2 — movement + treasure + win** ✅ (2026-07-30): `internal/reachability.ts` (`isOnBoard`, `connects`,
  `reachableFrom`, `isReachable`); the `MOVE` action — travel any distance or stay put, flip the top card on
  the square you stop on (rulings 10, 11), pass the turn clockwise, and end the game the instant the last
  card is flipped and the piece is home; `legalActions` in the `move` phase (1–49 reachable squares); two
  more typed rejections (`INVALID_POSITION`, `UNREACHABLE`) and the L1-promised "a slide can never win"
  invariant. A full game is now playable through `applyAction` alone. 220 tests, `src/engine/**` at 100%.
- **L3 — module** ✅ (2026-07-30): the `createGame` colour→corner change (rulings 6, 12) with its new
  `INVALID_PLAYER_COLOR`; `engine/view.ts` — `viewFor`'s three cases (your own stack → its top card, every
  other seat → a `stackCount`, everything revealed at `ended`) and the `LabyrinthView`/`LabyrinthPlayerView`
  types the client and the bot now bind; the real `GameModule` — `parseAction` (shape only, unknown fields
  refused), `summarize`, `versionOf`, `movesOf`, `mapError` (409 for rules, 400 for payloads — ruling 13),
  `kernelContract`, and the four-corner `colors`; no `routes`/`pendingStep`/`onStateChanged`/bot driver.
  Module tests stand in for the hub's module-seam suite the pilot can't run. 295 tests, `src/engine/**` at
  100%.
- **L4 — client (functional stage)** ✅ (2026-07-30): the playable board. `TileFace.tsx` (a tile drawn from
  `openings(shape, rotation)` — the engine's own connectivity, so picture and rule cannot drift);
  `treasures.tsx` (a *generated* identity for the 24 — golden-angle hue × 4 silhouettes × a computed unique
  monogram); `Board.tsx` (the 9×9 frame: 7×7 maze + the 12 arrows, the extra tile with a rotation control,
  the flood-fill highlighted and clickable, "stay put" as a button, the hunted card, per-seat found rows and
  face-down counts, all affordances gated on `canDrive`/phase/`busy`/`ended`); `describe.ts` (the feed's plain
  English from the payloads alone); `Status.tsx`; the `GameClient` with a **lazy** board. One engine change,
  ruling 14. 57 client tests (352 total), `src/engine/**` still at 100%.
- **D2d — the hub consumes this package** ✅ (2026-07-30): the slice that made all of the above *real*.
  This repo became **installable** — a `tsc` build to `dist/` (`tsconfig.build.json`) behind
  `publishConfig` rewriting all four subpaths, version `0.1.0`, `files: ["dist"]`, `prepack`, and
  explicit `.js` extensions on every relative specifier in the shipped sources (the platform's D2a lesson,
  hit here exactly as predicted: `tsc` emits them verbatim and Node ESM resolves neither extensions nor
  directories). `scripts/pack-smoke.mjs` (adapted from the kernel's, wired into CI) packs the tarball,
  installs it **plus its peers from the public registry** into a throwaway project outside this repo, and
  plays a game through all four subpaths under plain `node` — then typechecks a consumer against the
  shipped `.d.ts` under `nodenext`. Peers moved to `@game-hub/kernel@^1.2.0`, with the ui-kit and React
  marked **optional** (only `./client` needs them). **Finding §16 is retired:** kernel 1.2.0 carries each
  seat's resolved colour into `createGame`, so `NewGameOptions` is now literally
  `Parameters<GameModule['createGame']>[0]` and the module member is called with no cast and no barrel
  bypass. Hub-side, the game hosts as an ordinary dependency — no Vite alias, no tsconfig include — and
  `docker compose up --build` produces an image where Labyrinth is the playable sixth game (catalog entry,
  a full game over REST against the container, the lazy board chunk fetched from the built assets). Three
  host-side findings came out of it, all logged in the hub's `docs/track-d-externalize-games.md`
  "Delivered in D2d": Vite's dev-server pre-bundler forking `@game-hub/ui-kit` into two copies (which
  silently broke the injected REST base URL), pnpm fetching *registry* copies of the hub's own packages to
  satisfy this package's peers, and the `@source` glob question — **answered: it works unchanged**, the
  hub's `@source '../node_modules/@game-hub'` reaches this package's compiled `dist/` (§11, §21 closed).
- **L4b — the art pass (comps-first)** ✅ **shipped**: **Hedgeglow**, original illustration for the tiles, the
  24 treasures and the pawns. Nothing about the seam or the board's structure changed — L4 isolated the things
  art replaces for exactly this. See [What L4b built](#what-l4b-built-the-hedgeglow-art-pass); findings feed
  the hub's RR9b board revamp.
- **L5 — bot**: slide × rotation × move search over the redacted view, greedy baseline scored against the
  treasure (not the hop), self-play at every seat count, bench calibration; the `src/bot/**` 90% gate.
- **L6 — polish**: the younger-children variant (pg. 2), action tooltips, an a11y pass.

### What L1 built (for reference when extending it)

- `internal/geometry.ts` — `opposite`, `neighbor` (deliberately unclamped, so L2 can *see* an off-board
  neighbour and reject it), `samePosition`.
- `internal/insertions.ts` — `INSERTIONS` (the 12 arrows, in a **stable order** the UI and the bot both
  depend on), `entrySquare`/`exitSquare`/`linePath`, `reverseOf`, `legalInsertions`, `isLegalInsertion`.
  `line` is a *column* for the north/south arrows and a *row* for east/west; the line is always walked in
  `opposite(side)`, which is the direction the maze travels.
- `actions/` — `Action` (one arm so far), `insert`, `applyAction` (the `GAME_OVER`/`NOT_YOUR_TURN` guards),
  `legalActions`.
- The `INSERT` payload is `{ side, line, rotation, tileId, ejectedTileId, wrapped }` — all public. **The
  plain-English log line is not in the payload**: the hub renders move logs from a `describe(move)` in the
  game's *client* (Container's `GameLog.tsx` is the pattern), and `MoveRecord` has no text field. L4 writes
  Labyrinth's, and the payload already carries everything it needs.

### What L2 built (for reference when extending it)

- `internal/reachability.ts` — the whole of movement legality, in four functions:
  - `isOnBoard(position)` — bounded **and** integer-checked, because a target square comes off the wire.
  - `connects(board, from, direction)` — the atom: two squares join only when **both** tiles face each other
    (`from` open on `direction`, the neighbour open on `opposite(direction)`). Takes no players — pawns
    cannot block, and the signature is what guarantees it rather than a comment.
  - `reachableFrom(board, origin)` — BFS, returned in **reading order** (stable and origin-independent, the
    same contract `INSERTIONS` has). Always contains `origin`; never more than 49 squares.
  - `isReachable(board, origin, target)` — membership. An off-board target is simply never in the set, so it
    needs no bounds check of its own.
- `actions/move.ts` — validate (phase → square → reachability), flip if the tile you *stopped* on bears your
  top card, then either end the game or hand the turn on. The win is checked **after** the flip, so the last
  card and the homecoming could in principle land together (asserted, though the real board can't produce it
  — corners bear no treasure).
- The `MOVE` payload is `{ from, to, flipped, won }` — all public. `flipped` is the card that just went face
  up; **the card revealed underneath it is deliberately absent** (it is the mover's secret, pg. 2) and there
  is a test that greps the log entry for it. `won` is carried rather than derived so L4's `describe` can
  render the winning line from the record alone. `from === to` is how "stayed put" reads (ruling 11).
- Two error codes joined the union: **`UNREACHABLE`** (a real square with no open path — a rules mistake) and
  **`INVALID_POSITION`** (not a square at all — a payload mistake). The split mirrors
  `INVALID_ROTATION`/`ILLEGAL_INSERTION` and exists for the same reason: L3's `parseAction` and the host's
  error mapping want to say *which half* of the payload was wrong.
- `legalActions` in the `move` phase returns 1–49 `MOVE` arms in `reachableFrom` order. **It is never
  empty**, so a turn can always be completed however sealed-in a piece is — which is what lets a bot loop
  (L5) and the host's "is this game stuck?" reasoning stay simple.
- ⚠️ **`turn`/`activePlayerIndex` do not advance on a win** (Can't Stop's pattern): the game stops on the
  winner's seat, `phase` resets to `insert`, `legalActions` goes empty and `applyAction` answers `GAME_OVER`.

**Verified end-to-end, not just green:** a scratchpad driver (Vite SSR-loading `src/engine/index.ts`, so it
runs the shipped source) played whole seeded games through `applyAction` **only**, alternating INSERT/MOVE
across seats with a greedy chase-your-treasure policy. Seed 909 at 4 seats ended in **66 turns / 132 logged
actions** with `winnerIds: ["p2"]`, the winner independently re-checked as home with an empty stack; 13 of
15 games across 2/3/4 seats finished the same way (median ≈ 50 turns), and the two that didn't were the
policy sitting in a local minimum — a repeated *position* fingerprint proved the cycle, and re-running the
same seeds with a 10% ε-greedy escape finished all 15. Nothing about it was an engine stall.

### What L3 built (for reference when extending it)

L3 is a delegation layer, and it stayed one: **nothing in `src/module/` re-derives a rule.** The one piece of
real thinking is `viewFor`, and it lives in the *engine*.

- **`src/engine/view.ts` — `viewFor`, and the two view types.** It is engine code, not module code, on
  purpose and following all five hub games: *what a player may see* is as much a rule as what they may do, it
  belongs under the 100% gate, and `./client` and `./bot` must be able to name the projection type without
  importing `./module` (which would be a seam violation). The three cases:
  - **the viewer's own seats** — `stack` → `[stack[0]]`, or `[]` on an empty pile. A player is redacted from
    *himself*: he may not read his own future card order out of the network tab (pg. 2).
  - **every other seat** (all of them, for a spectator or a `null`/`[]` viewer) — `stack: null`, plus a
    `stackCount` that is public for *every* seat, own included, because the pile is countable at the table.
    `null` rather than a blanked array so "hidden" can never be misread as "empty".
  - **`ended`** — everything revealed, full stacks, for everyone.
  ⚠️ The view is assembled **field by field, never spread from the state**, so a secret added to
  `LabyrinthState` later cannot ride into a view by default. The cost is the mirror risk (a new *public*
  field must be added here too) and that failure is loud; the other one is silent.
  ⚠️ `LabyrinthPlayerView.stack` is *not* "the stack, when you may see it" — it is at most one card. Read
  `stackCount` for the pile size. `src/bot/index.ts`'s placeholder had `SeatedView<LabyrinthPlayer>`; that was
  wrong for exactly this reason and is now `SeatedView<LabyrinthPlayerView>`.
- **The leak test is a whole-object scan, and the spec's wording for it was wrong.** "A view contains no
  treasure name outside `found` and your own top card" cannot hold: **all 24 treasures are printed on the
  board tiles** and the board is public. The honest invariant, and what the tests assert, is that a view never
  says *who holds which card* — so the scan strips `board`/`extraTile` (asserting first that they are the
  engine's own objects, unmodified) and reads **everything else serialized**, including the log, against what
  that viewer is entitled to. It runs for every seat and a spectator after **every action of a whole game**.
- **`parseAction` is shape-only** — the type, the fields, and the closed sets (4 sides × 3 lines = the 12
  arrows; the 4 facings; two whole numbers). Reachability, the no-reverse rule and turn order stay in the
  engine. ⚠️ It **refuses unknown fields**, unlike the hub's five games which drop them: the action a client
  sends is exactly what `legalActions` handed it, so an unexpected key is a client bug worth naming
  (`{ type: 'MOVE', to: … }` gets "MOVE has no field \"to\"", not "target missing"). Nothing is forwarded
  either way — the returned action is rebuilt from validated values.
- **`summarize` is the contract's five fields and no more.** Per-seat progress ("3 of 6 found") is what would
  actually be useful on a lobby card and `GameSummary` has nowhere to put it — `docs/d2c-findings.md` §17
  rather than an extra field a host would ignore.
- **`mapError` is a total `Record<LabyrinthErrorCode, number>`**, so a new code fails to compile until someone
  decides its status (a ternary chain would have swallowed it into a catch-all). Ruling 13 for 409-not-422.
- **No `routes`, `pendingStep`, `onStateChanged`, `schemaVersion`, `botDifficulties` or bot driver** — each
  omitted for a stated reason in `module/index.ts`, not by oversight.

**Verified by playing, not by inference.** `src/module/tests/module.test.ts` plays whole seeded games
**through the module** (`createGame` → `parseAction` → `applyAction`), leak-checking every seat's projection
*and* a spectator's after every single action. Results (greedy chase-your-treasure with a 15% ε escape, the
goal read from the seat's own **redacted view** — if a projection didn't carry enough to play from, the
driver would stall rather than quietly pass):

| seats | seed | turns | actions | leak checks |
| ----- | ---- | ----- | ------- | ----------- |
| 2     | 102  | 60    | 120     | 363         |
| 3     | 103  | 42    | 84      | 340         |
| 4     | 104  | 38    | 76      | 385         |
| 4     | 909  | 39    | 78      | 395         |
| 3     | 404  | 57    | 114     | 460         |

Every game ended in a real win — winner independently re-checked as home on its own colour's corner with an
empty stack and a full `found` pile — with `actions === 2 × turns`, `version === actions`, and **zero leaks**
across ~1,940 projections. ⚠️ One thing the driver learned the hard way, which L5 will hit too: scoring a
greedy policy by *distance to your treasure alone* makes it **avoid** its own treasure, because flipping the
card retargets it somewhere further away. The card count has to dominate the score.

### What L4 needs (the client — the board)

The board is comps-first (classic enchanted-labyrinth theme, original art). What the seam already guarantees:

1. **Bind `LabyrinthView`, never `LabyrinthState`.** `src/client/api.ts` already re-exports it from the
   engine, so the board names one type. Per seat it gets `stackCount` (draw the face-down pile at its real
   height), `found` (the face-up row), `stack?.[0]` — **the card this client is hunting, present only for its
   own seats** — and `color`/`position`. A `stack` of `null` is an opponent: draw a back, never a blank.
2. **Draw a corner from `player.color`, never from a seat index** (ruling 12). The four corners are
   `START_CORNERS`, exported.
3. **The board is public and verbatim** — `view.board` is the engine's own 7×7, `view.extraTile` the spare,
   `view.lastPush` the arrow that must stay disabled this turn (pg. 2, "The only exception"). Affordances come
   from `legalInsertions`/`reachableFrom`, both exported, so the UI never re-derives a rule. ⚠️ `legalActions`
   takes a `LabyrinthState`; a board holding a *view* must call the geometry helpers, which take a board.
4. **The move log's plain English is L4's, from the payloads alone**: `INSERT` gives
   `{ side, line, rotation, tileId, ejectedTileId, wrapped }` and `MOVE` gives `{ from, to, flipped, won }`.
   The card revealed *under* a flip is deliberately absent — if a sentence wants "now hunting X", it must come
   from the projected state, or the secret lands in the public log (finding §14).
5. **Two phases, two affordances.** `view.phase === 'insert'` ⇒ 12 arrows (minus the reverse) × 4 facings;
   `'move'` ⇒ the flood-fill, which is **never empty** — "stay put" is a `MOVE` to your own square (ruling 11)
   and should render as a button, not as a missing option.
6. ⚠️ **The host's seat tints and the pawn colours can disagree** until the kernel carries colour picks into
   `createGame` (finding §16). The board must colour pawns from `view.players[].color`, not from the payload's
   `colors` map, or a player who picked yellow will see a red pawn on the yellow corner.

What L4 should know that L3 learned:

- **The engine's public surface was sufficient for the module, and it is *not quite* sufficient for a bot.**
  `viewFor`'s output cannot be fed back into `applyAction`/`legalActions`/`legalInsertions`, which all take a
  `LabyrinthState`. `reachableFrom`/`connects`/`linePath`/`INSERTIONS` take boards and are fine. So L5 either
  gets a board-level "apply this slide" helper or reconstructs one — decide it at L5, don't bolt it on now.
- **`legalActions` in the `move` phase is never empty**, so neither the module nor the board needs a
  "no legal move" branch.


### What L4 built (for reference when extending it, and for L4b)

The client is five files and one engine change. Every decision below exists because of something the board
would otherwise have got wrong.

- **`TileFace.tsx` — one tile, drawn from `openings(shape, rotation)`.** The corridor is a centre square plus
  one arm per opening, each arm running to the very edge of the tile's box; the grid has **no gaps**
  (measured: 0.00px between adjacent tiles). So a corridor visually continues into the next square *exactly*
  when the two tiles face each other — which is the same fact `connects()` computes, from the same function.
  A player reading the maze and the engine computing reachability cannot disagree.
  - Colours are **literal inline fills**, not Tailwind classes. A game package ships classes and no CSS, so
    the chrome depends on the host wiring Tailwind *and* defining the ui-kit's semantic tokens
    (`docs/d2c-findings.md` §21, measured). Keeping the tile picture out of that dependency means a mis-wired
    host loses the panels, not the board. ⚠️ **L4b must keep that property.**
  - The 16 printed tiles are drawn in darker stone; the four corners get a **coloured frame**, not a centre
    dot — the centre is where a pawn stands, and the corner has to stay identifiable while its owner sits on
    it. (The first draft used a dot; the browser screenshot showed the pawn covering it completely.)
  - Co-occupancy is drawn, not prevented: the rulebook has no occupancy rule (pg. 2), so 2–4 pawns on one
    square spread onto a 2×2.
- **`treasures.tsx` — a generated visual identity for the 24.** Hue stepped by the **golden angle** (not
  360/24 = 15°, which makes deck-order neighbours indistinguishable), one of four silhouettes, and a monogram
  computed as the shortest prefix no earlier treasure took (`skull` → `Sk`, `spider` → `Spi`). Uniqueness is
  *computed*, so ruling 3's warning that a name may yet be corrected can't silently produce two identical
  marks. Presentation only — no rule reads a colour or a glyph.
- **`Board.tsx` — the 9×9 frame.** A one-cell border of arrows around the 7×7 maze, so every arrow sits at the
  end of the line it pushes. Fluid columns, square tiles, **no fixed width**: measured 544px at desktop and
  296px at a 320px viewport with `scrollWidth === clientWidth` (no horizontal overflow). Stone Age's `PanZoom`
  is deliberately **not** used — it is for a large illustrated map, and wrapping 49 tap targets in a pan
  surface turns every tap into a potential drag. ⚠️ If L4b's artwork stops being legible at 35px, *that* is
  when to reconsider, not before.
- **`describe.ts` — the feed's plain English, from the payloads alone.** It reads the `MoveRecord` and the
  public seat names and **nothing else**: the feed is shown to every seat, so a line assembled from the
  projected state would render differently per viewer and could leak. The card revealed *under* a flip is
  absent from the payload on purpose (pg. 2) and there is a test asserting a line never mentions one.
  Finding §14's worry — that a payload designed at L1/L2 might turn out to be insufficient three slices later
  — did not materialise: `INSERT` and `MOVE` carried everything the sentences needed.
- **The `GameClient`** — blurb, seven rules bullets, `Status`, and a **lazy** `Board` (asserted in the tests to
  still be a `React.lazy`, because the failure mode of losing that is invisible).

**Verified by driving it, not by inference.** A throwaway Vite + Tailwind harness (scratchpad, not checked in)
mounted the shipped `Board.tsx` over a real `viewFor` projection, with a stub `fetch` that ran every action
through the **real** `parseLabyrinthAction` → `applyAction`. Headless Chromium then played a turn:

| step | what the DOM said |
| ---- | ----------------- |
| opening | 49 tiles, 12 arrows all live, 4 pawns on their four coloured corners, 24 treasures on the board, hunted card = `mouse` |
| rotate + slide at north-3 | tile went in at 0° (spare was at 270°, rotated once) — the feed read *"pushed the extra tile in from the north along column 4 (facing 0°)"* |
| after the slide | phase → move, **5** squares highlighted (= `reachableFrom`), all 12 arrows dead, "Stay put" live, the spare became the ejected `gnome` tile |
| move to (3,1) | pawn relocated, turn passed to Bob, the banner and hunted card followed him, and **`arrow-south-3` alone** stayed disabled with its red cross (pg. 2's exception) |

Zero console errors throughout. Screenshots at 1280px and 320px are in the scratchpad; the 320px one has no
horizontal overflow and the monograms are still readable at a 35px tile.

**What L4b (art) needed, and did:** original tile fills/frames, the 24 treasure illustrations and pawn shapes,
with `Board.tsx`'s structure, the testids and `describe.ts` as the contract, and the "board survives without
the host's CSS tokens" property intact. All held — see the next section.

**What D2d checked, and the answers** (the three things this repo could not test alone — all now measured
against the hub's production container):

- **The lazy board really code-splits from inside `node_modules`** (Track D §3's open worry). The built hub
  serves six `Board-*.js` chunks; a browser opening Labyrinth fetches exactly one — 18.4 kB.
- **The host's `@source` glob reaches the installed game.** The hub's existing
  `@source '../node_modules/@game-hub'` follows pnpm's symlink and scans the compiled `.js` in `dist/`:
  `max-w-[34rem]`, `lg:max-w-[20rem]` and `outline-offset-[-3px]` — utilities that exist nowhere in the hub's
  own sources — are in the stylesheet the container serves. **No glob change was needed** (§11 closed).
- **The host defines the ui-kit's semantic tokens** (§21). The hub does, so the chrome renders; the finding
  stands for hosts that don't, and `TileFace.tsx`'s literal fills remain the reason a mis-wired host would
  lose the panels and not the maze.

The board's testids — `board`, `maze`, `tile-<row>-<col>`, `arrow-<side>-<line>`, `extra-tile`,
`extra-rotate-cw`/`-ccw`, `stay-put`, `hunted-card`, `seat-<id>`, `seat-found-<id>`, `seat-stack-<id>`,
`pawn-<id>`, `labyrinth-banner`, `labyrinth-log` — are the e2e contract from here on, and the hub's
`ui/e2e/labyrinth.spec.ts` now depends on them. **L4b added one** (`hunted-medallion`, inside `hunted-card`)
and removed none.

### What L4b built — the Hedgeglow art pass

**The owner's two decisions**, from the approved comps (2026-07-30), are the whole brief:

1. **Direction: Hedgeglow** — the enchanted hedge garden at dusk. Moss-dark clipped foliage for the walls,
   lantern-lit sandstone for the corridors, treasures in gilt rings like lanterns hung in the hedge. Of the
   three comps it kept the strongest wall/corridor contrast at 35px, which is the size that decides whether
   the board is playable on a phone.
2. **Tile-size treasure icons are the right size as comped — do not shrink or grow them** — but **the hunted
   card must show the art LARGE**. In play the owner could not tell 24 medallions apart at tile size. That is
   now a deliberate division of labour: a tile says _there is a treasure here_, the panel says _which one_.

**Three art files, and only three.** `palette.ts` (new) holds the eleven Hedgeglow colours; `TileFace.tsx`
draws a tile; `treasures.tsx` draws the 24. `Board.tsx` took exactly three additive changes — the enlarged
hunted card, the arrows' gilt, and a tile backdrop (below) — with no structural or testid change.
`describe.ts`, `Status.tsx`, `api.ts`, `types.ts` and every engine file were untouched.

- **The corridor is now one `<path>`, not five rects.** Walking the centre square plus an arm per opening as a
  single closed outline means one element carries both the sandstone fill _and_ its kerb (the stroke), with no
  seam where two rectangles used to meet. ⚠️ The arms overshoot the tile box by 4 units so the stroke's **end
  cap lands outside the SVG viewport and is clipped** — without that, the kerb draws a line across every
  corridor mouth and the maze looks walled off at every tile boundary.
- **The hedge is a 16-dot two-tone stipple per tile**, precomputed at module load in four fixed layouts and
  picked per tile by hashing `tile.id`, so neighbouring tiles differ and a tile never changes. Dots sit on the
  rim only — the inner 3×3 of the 5×5 grid falls inside the widest corridor and would only be painted over.
- **Measured, not assumed (the performance question):** the board went from **614 to 1,459 elements — 2.4×**,
  inside the 3–4× budget that would have forced a shared `<defs>`/`<pattern>`. Per tile: 6 → 20 nodes. The
  pattern route stays available if the texture ever grows (a per-tile `<svg>` _can_ reference one by
  `url(#id)`, because fragment identifiers resolve document-wide) — it is noted in `TileFace.tsx`.
- **⚠️ A dark board exposed a sub-pixel bug L4 could not see.** Seven fluid columns put tile edges on
  fractional device pixels (35.43px at a 320px viewport), so each tile's SVG boundary antialiases against
  whatever is behind it. Against the page that was **white**, and the finished maze had a white hairline grid
  ruled across it every few tiles. The fix is one inline `backgroundColor: HEDGE.wall` on the tile button —
  inline, not a class, because the maze must not depend on the host's CSS. Any dark game board on a fluid
  grid will hit this; it is worth carrying to the hub's RR9b revamp.
- **The 24 icons are data, not JSX.** Each is a list of marks (a path or a disc; filled, stroked, or _knocked_
  back to the medallion ground to cut an eye or a facet), so uniqueness is **testable** — the suite asserts 24
  distinct serialised drawings, no empties, and every mark inside the 0–24 box. L4's computed monogram
  survives as the fallback for a treasure whose name ever outruns its artwork (ruling 3).
- **Hedgeglow is monochrome, so the shape is the whole identity** — L4's generated hues are gone. That is the
  approved comp, and it is exactly why decision 2 exists. Icons were revised against screenshots, not
  intuition: the moth's eyespots turned it into a second owl and were deleted; the gnome's hat and beard fused
  into a rocket until a knocked brim line separated them; emerald's hairline step facets vanished at tile size
  and became a bold octagon; spider was a starburst until the body grew and the legs shortened; lizard's
  stroked tail disappeared and became a filled taper. **`dragon` is the one to revisit if anything** — three
  drafts in, a spine-backed serpent reads as a beast rather than a bird, but it is the least self-evident of
  the 24. Nothing else is close to confusable.
- **Pawns** are turned-wood silhouettes (body + head + cast shadow) rather than discs, ringed in gilt for the
  seat on the clock. `green` was lifted from `#2e9e4f` to `#42c169`: green ink on a moss-green hedge is the
  one seat colour this palette fights, and the home-corner frame is drawn on the wall, not the corridor.
- **The highlights were re-cut for the new ground.** L4's emerald wash is invisible on moss; a reachable
  square is now lantern light — a pale-gold fill with a dashed gold edge over a dark backing stroke, because
  no single colour holds its edge against both the pale corridor and the dark hedge.

**Verified by driving it, not by inference** (same harness as L4: a throwaway Vite playground mounting the
shipped `Board.tsx` over a real `viewFor`, headless Chromium, scratchpad):

| check | result |
| ----- | ------ |
| desktop 1280px | 49 tiles, 12 arrows, 4 pawns, 24 treasures, maze 544px, tile 69.7px, gap 0.00px |
| move phase | 5 squares highlighted (= `reachableFrom`), all 12 arrows dead, `arrow-south-3` alone crossed out — highlights read clearly over the hedge _and_ over the sandstone |
| 320px phone | tile **35.4px**, `scrollWidth === clientWidth` (no overflow), stipple reads as texture with no shimmer, medallions still say "treasure here" |
| hunted card | medallion 80px (96px from `sm:`), name beside it; the card back is the same size, so the panel does not resize when the clock passes |
| console | **zero errors** in every run |

Gates at the end of the slice: typecheck ✅, lint ✅, `format:check` ✅, **355 tests** (20 files) ✅,
`src/engine/**` **100%** statements/branches/functions/lines ✅.

### What L4c built — the first player-feedback pass (2026-08-05)

Four changes from playtest feedback, all in `src/client/` — no engine, module or bot file touched, all
testids additive. The owner's readings of the feedback (confirmed 2026-08-05):

1. **"Make it obvious what colour the current player is" → the banner wears your pawn.** "You are Ann" now
   carries a pawn-silhouette badge in each held seat's colour (`PawnBadge` in `TileFace.tsx` — it is
   artwork, so it lives in an art file and reuses the board pawn's own silhouette and inks). One badge per
   held seat, colour from `view.players[].color` as always (ruling 12), `aria-hidden` because the adjacent
   name carries the information. Testid: `banner-pawn-<seatId>`. The banner needed the seat's *colour*, so
   the board filters `players` by `controlledIds` itself — the same rule `seatIdentity` applies for
   `myNames`, which returns names alone.
2. **"Turn off hints" = the arrows' hover tooltips, not the move highlights.** The `ActionTip` wrappers on
   the 12 arrows are gone (and with them `ArrowButton`'s `facing` prop, which only the tip text used). The
   reachable-square flood-fill **stays** — it is public information read off the board, not a hint. The
   banned arrow is still rendered, disabled and crossed out (pg. 2's own advice), but now explains itself
   only through its `aria-label`.
3. **The spider was redrawn** (same pass, second round of feedback): the eight straight spokes gained a
   **knee** each — two segments meeting at a raised joint, drawn by the renderer's round joins — and the
   head a pair of chelicerae. The fangs' first draft pointed up-and-out and read as *ears*; they now bow
   out and converge, tips pointing at each other. Filled tapers, not strokes (the lizard-tail lesson).
   Reviewed against 4× screenshots at hero (96 px) and on-tile (15 px) size, beside the beetle — the two
   no longer share the radiating-legs silhouette.
4. **"Pawns sit on top of treasures" → a hide-other-pawns toggle.** Pawns are drawn over the tile art, so a
   pawn parked on your treasure hides it. `toggle-pawns` (in the Players panel header) hides every pawn this
   client does not hold — hotseat: all but the seat on the clock — and **resets on every `game.version`
   change**: it is a peek at the ground, not a mode, and a player who left it on across other people's moves
   would be playing blind without knowing it. The toggle blinds the eye only — `squareLabel` still names
   everyone standing on a square, since a screen reader is never occluded by a drawing.

**Verified by driving it** (same harness as L4/L4b: a throwaway Vite playground in the scratchpad mounting
the real `Board.tsx` over a real `viewFor`, headless Chromium via playwright-core, 4 seats, seed 7):

| check | result |
| ----- | ------ |
| banner | red pawn badge beside "You are Ann", 15px, aligned with the text at 1280px and 320px |
| arrow hover | 0 `role="tooltip"` elements after hover (was 1 at L4b); no `aria-describedby` on any arrow |
| hide toggle | 4 pawns → 1 (Ann's stays), `aria-pressed` true, label flips to "Show all pawns", → 4 on second press; home-corner frames stay visible throughout |
| move phase | highlights unchanged (= `reachableFrom`), banned arrow still crossed out and labelled "blocked this turn" |
| 320px phone | `scrollWidth === clientWidth`, badge visible |
| console | zero errors from the board (the one 404 is the playground's own missing favicon) |

Gates at the end of the slice: typecheck ✅, lint ✅, `format:check` ✅, **361 tests** (20 files) ✅,
`src/engine/**` **100%** statements/branches/functions/lines ✅.
Published as **0.1.3** — 0.1.2 was this same code published with `npm publish`, which silently ships the
dev (`src/`) exports in a dist-only tarball, and is deprecated on the registry (`docs/d2c-findings.md` §23; a
`prepublishOnly` guard now refuses anything but `pnpm publish`).
