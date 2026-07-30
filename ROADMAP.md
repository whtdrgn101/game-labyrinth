# Labyrinth — roadmap

**What this is:** Ravensburger's _The aMAZEing Labyrinth_ (2017 rules) as a **Game Hub game package** —
and the platform's proof that a game can be built entirely **outside** the hub monorepo, against the
published `@game-hub/kernel` and `@game-hub/ui-kit`. See [`README.md`](./README.md) for the pilot story and
[`docs/d2c-findings.md`](./docs/d2c-findings.md) for what that cost.

**Status:** **L0 shipped** (2026-07-30) — the data spine, the transcribed fixed board and `createGame`, at
100% engine coverage. **Next: L1, the slide.**

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

---

## Slice plan

Vertical slices, each green and demoable. The engine's 100% coverage gate holds from L0 on; the bot's 90%
gate turns on with L5.

- **L0 — data spine** ✅ (2026-07-30): types; the tile, treasure and fixed-board data (pg. 1 photo,
  transcribed and symmetry-checked); `createGame` with injected-rng shuffle/orientations/deal; the
  start-player ruling. 60 tests, `src/engine/**` at 100%. Also: the repo itself — pnpm, strict TS, ESLint 9 +
  Prettier, per-glob coverage gates, GitHub Actions CI installing `@game-hub/*` **from the public registry**,
  and the four subpath exports (`./engine` real; `./module`, `./client`, `./bot` typed placeholders).
- **L1 — the slide**: the 12 arrows, insertion with rotation, the no-reverse rule (`lastPush`), the pawn
  wraparound, turn passing, the move log via the kernel's `record()`.
- **L2 — movement + treasure + win**: flood-fill reachability over tile openings, move/stay, the card flip,
  the immediate win check, `legalActions`/`applyAction`.
- **L3 — module**: `viewFor` (secret stacks — the owner's top card only), `parseAction`, `summarize`,
  `mapError`, the real `GameModule` object.
- **L4 — client**: the board UI, comps-first (classic theme, original art). Findings feed the hub's RR9b
  board revamp.
- **L5 — bot**: slide × rotation × move search over the redacted view, greedy baseline scored against the
  treasure (not the hop), self-play at every seat count, bench calibration; the `src/bot/**` 90% gate.
- **L6 — polish**: the younger-children variant (pg. 2), action tooltips, an a11y pass.

### What L1 needs

1. **`opposite(direction)`** in `internal/geometry.ts` — the no-reverse rule is "same line, opposite side"
   against `lastPush` (the derivation is already written down in the `Insertion` doc comment).
2. **`legalInsertions(state)`** — the 12 arrows minus the one that undoes `lastPush`, so the UI and the bot
   never re-derive it.
3. **`insert(state, playerId, insertion, rotation)`** — shift the line, eject the far tile into `extraTile`,
   place the incoming tile at the arrow end, and **relocate any pawn standing on the ejected tile onto the
   inserted tile** (pg. 2 — the wraparound; it is not a move and does not consume the turn).
4. **`record()` for every mechanic** (`internal/record.ts` is already wired) and the `phase` advance
   `insert → move`. ⚠️ Everything logged is public — never put a player's stack in a payload.
5. Tests: each arrow's effect on the board, all four rotations, the rejected reverse insertion (all 12 legal
   on turn 1), pawn wraparound for each edge, purity (the input state is never mutated).
