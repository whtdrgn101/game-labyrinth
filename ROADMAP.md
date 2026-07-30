# Labyrinth — roadmap

**What this is:** Ravensburger's _The aMAZEing Labyrinth_ (2017 rules) as a **Game Hub game package** —
and the platform's proof that a game can be built entirely **outside** the hub monorepo, against the
published `@game-hub/kernel` and `@game-hub/ui-kit`. See [`README.md`](./README.md) for the pilot story and
[`docs/d2c-findings.md`](./docs/d2c-findings.md) for what that cost.

**Status:** **L2 shipped** (2026-07-30) — the second half of a turn: flood-fill reachability over the maze's
open corridors, the `MOVE` action (travel any distance or stay put), the treasure flip, the end of a turn,
and the immediate win. **The engine now plays a complete game through `applyAction` alone** — driven to a
real win at 2, 3 and 4 seats (evidence below). 220 tests, `src/engine/**` still at 100%.
**Next: L3, the module (`viewFor` + `parseAction` + the `GameModule` object).**

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
box. Consequence for the seams: `createGame` must accept each player's chosen colour (validated as one of
the four corner colours, no duplicates) instead of assigning by seat; the seat-ordered `SEAT_COLORS`
default stands until the module slice wires the lobby's picks through (scheduled with L3/D2d — logged in
`docs/d2c-findings.md`).

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
- **L3 — module**: `viewFor` (secret stacks — the owner's top card only), `parseAction`, `summarize`,
  `mapError`, the real `GameModule` object.
- **L4 — client**: the board UI, comps-first (classic theme, original art). Findings feed the hub's RR9b
  board revamp.
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

### What L3 needs (the module — the backend seam)

L3 is a delegation layer: no new rules, and **nothing in `src/module/` may re-derive a rule** — it calls the
engine. The hub's recipe is `docs/game-creation.md` §3; what is Labyrinth-specific:

1. **`viewFor(state, viewer)` — the interesting one, and the reason this game was worth building.** Labyrinth
   is the first hosted game with a *structured* per-player secret: each seat's `stack` is face-down and even
   its owner sees only `stack[0]` (pg. 2, "Each player looks at the first card of his stack ... without
   showing it"). So the projection is **top-card-only redaction**, three cases:
   - the viewing player: `stack` → `[stack[0]]` (or `[]`), i.e. their own next target and nothing further —
     redacting a player *from themselves* is new for the platform, and it is right: a player must not be able
     to read their own future card order out of the network tab either.
   - every other player: `stack` → **its length only** (a count, not names). The count is public — the pile
     is on the table — so the view needs a `stackCount: number` field rather than a truncated array; sending
     `['?','?']` would be inventing data of the wrong type.
   - `found`, positions, the board, `extraTile`, `lastPush`, `turn`, `phase`: **all public**, verbatim.
   ⚠️ A spectator (`viewer` with no seat) gets the everyone-else projection for every seat. Write the test
   that says a projected state contains **no** treasure name that isn't in someone's `found` or the viewer's
   own top card — a whole-object assertion, not a field spot-check, because the failure mode is a field added
   later that quietly ships the stack.
2. **`parseAction(body)`** — two arms. `INSERT` needs `side` ∈ the four directions, `line` ∈ `SLIDE_LINES`,
   `rotation` ∈ `ROTATIONS`; `MOVE` needs `target.row`/`target.col` as integers. Reject shape here (a
   `ParseResult` failure), and let the engine reject *legality* — the two error codes above are already split
   along exactly that line, so don't duplicate the reachability check in the parser.
3. **`summarize(state)`** — the lobby card. Whose turn, `phase`, and each seat's `found.length` out of its
   dealt total. Nothing secret; `stack` contents must not appear.
4. **`mapError`** — `PLAYER_NOT_FOUND` → 404; `NOT_YOUR_TURN`/`GAME_OVER`/`WRONG_PHASE` → 409;
   `ILLEGAL_INSERTION`/`UNREACHABLE` → 422 (a legal-shaped move the rules refuse);
   `INVALID_ROTATION`/`INVALID_POSITION`/`INVALID_PLAYER_COUNT` → 400 (malformed payload). ⚠️ It must
   `instanceof` **this package's** `GameError` subclass — see `internal/players.ts`'s note on why
   `makeSeating` is injected with it.
5. **`kernelContract: KERNEL_CONTRACT_VERSION`**, imported from the kernel this package compiled against —
   never a literal (`LABYRINTH_INFO` already does this; the module object spreads it).
6. **The colour question comes due here** (ruling 6 + `docs/d2c-findings.md` §12): a pawn's colour *is* its
   home corner, so the platform's per-seat colour picker and `createGame` have to agree. The engine currently
   assigns `SEAT_COLORS[seat]`; the owner's ruling is that the picked colour should drive it, which means
   `createGame` takes each seat's colour (validated: one of four, no duplicates) and the module passes the
   lobby's picks through. **That is a `createGame` signature change — do it in L3, before L4 draws a board
   around the old assumption.**

What L3 should know that L2 learned:

- **The engine's public surface is already sufficient.** `applyAction`, `legalActions`, `reachableFrom`,
  `createGame` and the constants are everything a module needs; if L3 finds itself importing from
  `src/engine/internal/`, that is the seam being violated, not a missing export.
- **`legalActions` in the `move` phase is never empty**, so the module never needs a "no legal move" branch.
- **A `MOVE` payload is the whole log line.** L4's `describe` gets `{ from, to, flipped, won }` and nothing
  else — if a sentence needs more (e.g. the treasure a player is *now* hunting), it must come from the
  projected state, never from a payload, or the secret leaks into the public log.
