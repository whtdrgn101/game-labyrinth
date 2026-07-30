# Labyrinth — roadmap

**What this is:** Ravensburger's _The aMAZEing Labyrinth_ (2017 rules) as a **Game Hub game package** —
and the platform's proof that a game can be built entirely **outside** the hub monorepo, against the
published `@game-hub/kernel` and `@game-hub/ui-kit`. See [`README.md`](./README.md) for the pilot story and
[`docs/d2c-findings.md`](./docs/d2c-findings.md) for what that cost.

**Status:** **L1 shipped** (2026-07-30) — the slide: the 12 arrows, insertion at any facing, the no-reverse
rule, pawns carried along the line and wrapped round the edge, and the `applyAction`/`legalActions` seam.
167 tests, `src/engine/**` still at 100%. **Next: L2, movement + treasure + win.**

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
- **L2 — movement + treasure + win**: flood-fill reachability over tile openings, move/stay, the card flip,
  the immediate win check — and the end of a turn. Extends L1's `Action`/`applyAction`/`legalActions`.
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

### What L2 needs

1. **Reachability** — a flood-fill from the pawn's square over `openings()`, where two adjacent tiles connect
   only if *both* face each other (`openings(a)` contains `d` **and** `openings(b)` contains `opposite(d)`).
   `neighbor` + `opposite` are already there for it. "You can occupy any square that you can move your piece
   to directly, without interruption … as far as you like" (pg. 2). The pawn's own square is always in the
   set — staying put is a legal move, not a skipped one.
2. **No blocking.** Pawns share squares (the rulebook has no occupancy rule) — L1's tests already lean on
   this, wrapping four pawns off one tile.
3. **The `MOVE` action** — reject an unreachable target with `UNREACHABLE` (the code is already declared),
   reject it in the `insert` phase with `WRONG_PHASE`. Landing on the treasure named by `stack[0]` flips it
   into `found` and reveals the next (pg. 2). **This is where the turn ends**: `phase` back to `insert`,
   `activePlayerIndex` on one seat, `turn + 1` — see ruling 9.
4. **The win check** — all cards flipped *and* the pawn on its own `START_CORNERS` square, checked the
   instant the move resolves (pg. 2, "Ending the Game"). It produces the kernel's `ended` arm:
   `{ status: 'ended', winnerIds: [id] }`, nothing else.
   ⚠️ A player could satisfy both halves via the **slide's** wraparound rather than a move — a pawn wrapped
   onto its home corner. The corners are fixed tiles at even/even squares, so they can never be pushed and a
   wrap can never land on one; the win check therefore belongs to the move alone. Worth a test that says so.
5. Tests: reachability against hand-built mazes (a straight corridor, a sealed single tile, a loop), stay-put,
   the flip and its ordering, the immediate win, and the same purity/determinism assertions L1 uses.
