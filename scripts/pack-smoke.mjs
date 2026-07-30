#!/usr/bin/env node
/**
 * Pack smoke test for `@game-hub/game-labyrinth` (Track D / D2d).
 *
 * Adapted from `@game-hub/kernel`'s `scripts/pack-smoke.mjs` — the D2a script that exists because the
 * platform learned this lesson the hard way. Every other check in this repo runs against **TypeScript
 * source**: `pnpm typecheck`, `pnpm test`, even the client tests. None of them says anything about the
 * artefact a host actually installs, which is a tarball whose `exports` resolve to `dist/`. Its failure
 * modes are invisible from in here:
 *
 *   1. **Extensionless / directory relative imports.** `tsc` emits `from '../engine'` verbatim; Node ESM
 *      does neither extension nor directory resolution, so the installed package throws
 *      `ERR_MODULE_NOT_FOUND` on first import while every suite in this repo is green. Hence the `.js`
 *      specifiers in the shipped sources (see `CLAUDE.md`) — and hence this script, which is what stops
 *      somebody helpfully "tidying" them away.
 *   2. **A lazily-imported file that never made it into the tarball.** `./client` code-splits its board
 *      with `lazy(() => import('./Board.js'))`. Nothing loads that file until a player opens a game, so a
 *      missing or unresolvable `dist/client/Board.js` would ship silently and only break in production.
 *   3. **A dependency that leaked from `devDependencies`.** Only `@game-hub/kernel`, `@game-hub/ui-kit`
 *      and `react` are declared (as peers). If a shipped file ever imports `vitest`, a testing-library, or
 *      anything else that is dev-only in here, the install below has no way to satisfy it.
 *
 * So: pack it, install the tarball plus its **real peers from the public registry** into a throwaway
 * project outside this repo, and drive it two ways — plain `node` for the runtime surface (a game is
 * created, an action is parsed, applied and redacted), and `tsc --noEmit` under `nodenext` resolution
 * (the strictest mode: it honours the `exports` map exactly as Node does and refuses extensionless
 * relative specifiers inside the shipped `.d.ts`) for the type surface.
 *
 * Run: `pnpm pack:smoke`   (CI runs it after the unit tests.)
 * Set `KEEP_SMOKE_DIR=1` to leave the temp project behind for inspection.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * What plain Node must be able to do with the installed package: reach all four subpaths through the
 * `exports` map and get a *working* game out of them, not merely importable modules.
 */
const RUNTIME_SMOKE = `import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

import { applyAction, BOARD_SIZE, createGame, legalActions, SEAT_COLORS, START_CORNERS, viewFor } from '@game-hub/game-labyrinth/engine';
import labyrinthModule, { newLabyrinthGame, parseLabyrinthAction } from '@game-hub/game-labyrinth/module';
import labyrinthClient from '@game-hub/game-labyrinth/client';
import * as bot from '@game-hub/game-labyrinth/bot';

const require = createRequire(import.meta.url);

// --- ./engine — the pure rules core, driven for real. ---
assert.equal(BOARD_SIZE, 7);
assert.deepEqual([...SEAT_COLORS].sort(), ['blue', 'green', 'red', 'yellow']);
const engineGame = createGame({ id: 'e', players: [{ name: 'Ann' }, { name: 'Bob' }], rng: () => 0.5 });
assert.equal(engineGame.board.length, BOARD_SIZE);
assert.deepEqual(engineGame.players[0].position, START_CORNERS[engineGame.players[0].color]);

// --- ./module — the backend seam: identity, then a real turn through parse -> apply -> redact. ---
assert.equal(labyrinthModule.id, 'labyrinth');
assert.equal(labyrinthModule.minPlayers, 2);
assert.equal(labyrinthModule.maxPlayers, 4);
assert.equal(labyrinthModule.kernelContract, 1);
assert.deepEqual([...labyrinthModule.colors], [...SEAT_COLORS]);

// kernel 1.2.0's colour channel, straight off the contract member (no cast — d2c-findings §16, retired).
let state = labyrinthModule.createGame({
  id: 'g',
  players: [{ name: 'Ann', color: 'blue' }, { name: 'Bob' }],
  rng: () => 0.5,
});
assert.equal(state.players[0].color, 'blue');
assert.deepEqual(state.players[0].position, START_CORNERS.blue);
assert.equal(labyrinthModule.versionOf(state), 0);
assert.deepEqual(newLabyrinthGame({ id: 'g', players: [{ name: 'Ann', color: 'blue' }, { name: 'Bob' }], rng: () => 0.5 }), state);

// A turn: the compulsory slide, taken through the module exactly as the backend takes it.
const insert = legalActions(state, state.players[0].id).find((action) => action.type === 'INSERT');
assert.ok(insert, 'the active seat must have a legal INSERT');
const parsed = labyrinthModule.parseAction(JSON.parse(JSON.stringify(insert)));
assert.equal(parsed.ok, true);
state = labyrinthModule.applyAction(state, state.players[0].id, parsed.action);
assert.equal(labyrinthModule.versionOf(state), 1);
assert.equal(labyrinthModule.movesOf(state).length, 1);
assert.equal(labyrinthModule.movesOf(state)[0].type, 'INSERT');
assert.equal(parseLabyrinthAction({ type: 'NOPE' }).ok, false);

// The redaction that makes this game interesting to the platform (pg. 2): you see your own top card,
// everybody else is a bare count.
const mine = labyrinthModule.viewFor(state, state.players[0].id);
assert.equal(mine.players[0].stack.length, 1, 'my own stack is redacted to its top card');
assert.equal(mine.players[1].stack, null, "an opponent's stack is not visible at all");
assert.ok(mine.players[1].stackCount > 0);
assert.deepEqual(viewFor(state, state.players[0].id), mine, './engine and ./module agree');

// mapError turns a domain error into a status, and declines anything it does not own.
const notMyTurn = (() => {
  try {
    applyAction(state, state.players[1].id, insert);
  } catch (error) {
    return error;
  }
})();
assert.equal(labyrinthModule.mapError(notMyTurn).status, 409);
assert.equal(labyrinthModule.mapError(new Error('not mine')), null);
assert.equal(labyrinthModule.summarize(state).id, 'g');

// --- ./client — the UI seam. React must be resolvable from here; the board must stay code-split. ---
assert.equal(labyrinthClient.id, 'labyrinth');
assert.equal(labyrinthClient.name, 'Labyrinth');
assert.ok(labyrinthClient.rules.length >= 5);
assert.equal(typeof labyrinthClient.Status, 'function');
assert.equal(
  labyrinthClient.Board.$$typeof,
  Symbol.for('react.lazy'),
  'the board must still be a React.lazy — losing the split is an invisible regression',
);
// …and the file that lazy import points at must actually be in the tarball and loadable by plain Node.
// Imported by path rather than through the exports map on purpose: this is the deep file nothing else
// touches until a player opens a game, which is exactly why it is worth proving here.
const clientDir = dirname(require.resolve('@game-hub/game-labyrinth/client'));
const board = await import(pathToFileURL(join(clientDir, 'Board.js')).href);
assert.equal(typeof board.default, 'function', 'dist/client/Board.js must load and default-export the board');

// --- ./bot — L5's placeholder: types only, so it is empty at runtime but must still resolve. ---
assert.deepEqual(Object.keys(bot), []);

// The package declares no runtime dependencies — everything it needs is a peer the host already has.
assert.deepEqual(require('@game-hub/game-labyrinth/package.json').dependencies ?? {}, {});

console.log('runtime smoke ok — ./engine ./module ./client ./bot all resolve, and a game plays');
`;

/** What a consumer's compiler must see: the exported type surface, through the published `exports`. */
const TYPE_CONSUMER = `import { createGame, type LabyrinthState, type LabyrinthView, type PlayerColor } from '@game-hub/game-labyrinth/engine';
import labyrinthModule, { type GameModule, type ModuleContext, type NewGameOptions } from '@game-hub/game-labyrinth/module';
import labyrinthClient, { type BoardProps, type LabyrinthPayload } from '@game-hub/game-labyrinth/client';
import type { LabyrinthBotView } from '@game-hub/game-labyrinth/bot';
import type { GameModule as KernelGameModule } from '@game-hub/kernel';

// The one assignment that matters: what this package exports really is a kernel GameModule, checked
// through the *published* .d.ts of both packages rather than through the workspace's source.
const asContract: KernelGameModule<LabyrinthState, Parameters<typeof labyrinthModule.applyAction>[2], ModuleContext> =
  labyrinthModule;

// The colour channel (kernel 1.2.0) survives publication — no cast, exactly as a host calls it.
const opts: NewGameOptions = { id: 'g', players: [{ name: 'Ann', color: 'blue' }], rng: () => 0.5 };

export const surface = {
  id: asContract.id,
  seat: labyrinthModule.createGame(opts).players[0]?.color satisfies PlayerColor | undefined,
  engine: createGame({ id: 'g', players: [{ name: 'Ann' }, { name: 'Bob' }], rng: () => 0.5 }).turn,
  client: labyrinthClient.name,
  // The board's props and the payload it is handed, bound the way the host's registry binds them.
  board: null as BoardProps<LabyrinthView> | null,
  payload: null as LabyrinthPayload | null,
  view: null as GameModule<LabyrinthState, never>['viewFor'] | null,
  botView: null as LabyrinthBotView | null,
};
`;

const CONSUMER_TSCONFIG = {
  compilerOptions: {
    target: 'ES2022',
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    jsx: 'react-jsx',
    // The strictest resolution mode on purpose: `nodenext` honours the `exports` map exactly as Node
    // does and rejects extensionless relative specifiers inside the shipped `.d.ts` files. If this
    // passes, a consumer on `bundler` resolution (which is what the hub uses) is safe by construction.
    module: 'nodenext',
    moduleResolution: 'nodenext',
    strict: true,
    noEmit: true,
    // Third-party declarations (lucide-react, csstype, …) arrive transitively through `@game-hub/ui-kit`
    // and their health is not this script's business — what we are checking is that *our* .d.ts files
    // resolve and typecheck, which they must do before skipLibCheck ever applies.
    skipLibCheck: true,
    types: [],
  },
  include: ['consumer.ts'],
};

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(packageDir, 'package.json'));
const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));

/** Run a command, streaming its output; a non-zero exit throws and fails the script. */
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });
const step = (message) => console.log(`\n▶ ${message}`);

// A temp dir under the OS temp root, deliberately **outside** this repo: inside it, pnpm/npm would
// resolve the package back to its own source and prove nothing.
const projectDir = mkdtempSync(join(tmpdir(), 'game-labyrinth-pack-smoke-'));
let ok = false;
try {
  step(`packing @game-hub/game-labyrinth → ${projectDir}`);
  // `prepack` runs the tsc build, so this also proves the build is wired to the publish path.
  run('pnpm', ['pack', '--pack-destination', projectDir], packageDir);
  const tarball = readdirSync(projectDir).find((name) => name.endsWith('.tgz'));
  if (!tarball) throw new Error('pnpm pack produced no .tgz');

  step(`installing ${tarball} + its declared peers into a throwaway project`);
  writeFileSync(
    join(projectDir, 'package.json'),
    `${JSON.stringify({ name: 'labyrinth-pack-smoke', version: '0.0.0', private: true, type: 'module' }, null, 2)}\n`,
  );
  // npm rather than pnpm: no workspace inference, and — crucially — the peers come from the **public
  // registry**, which is the honest version of "a host installs this game". The ranges are read from
  // this package's own `peerDependencies` so the smoke can never test a version it doesn't declare.
  // `--ignore-scripts` because nothing here should need to run a lifecycle script.
  const peers = Object.entries(manifest.peerDependencies).map(([name, range]) => `${name}@${range}`);
  run(
    'npm',
    ['install', `./${tarball}`, ...peers, '--no-audit', '--no-fund', '--no-package-lock', '--ignore-scripts'],
    projectDir,
  );

  step('runtime: driving a game through all four subpaths with plain node');
  writeFileSync(join(projectDir, 'smoke.mjs'), RUNTIME_SMOKE);
  run(process.execPath, ['smoke.mjs'], projectDir);

  step('types: tsc --noEmit against the installed package (nodenext resolution)');
  // `./client`'s `.d.ts` names React types, so the type check needs `@types/react` present. Copy it (and
  // its one dependency) out of this repo's store rather than hitting the network again — pnpm's strict
  // store only exposes `csstype` *from* `@types/react`, so resolve it through a require rooted there.
  const typesReactDir = dirname(require.resolve('@types/react/package.json'));
  const fromTypesReact = createRequire(join(typesReactDir, 'package.json'));
  for (const [pkg, sourceDir] of [
    ['@types/react', typesReactDir],
    ['csstype', dirname(fromTypesReact.resolve('csstype/package.json'))],
  ]) {
    cpSync(sourceDir, join(projectDir, 'node_modules', pkg), { recursive: true });
  }
  writeFileSync(join(projectDir, 'consumer.ts'), TYPE_CONSUMER);
  writeFileSync(join(projectDir, 'tsconfig.json'), `${JSON.stringify(CONSUMER_TSCONFIG, null, 2)}\n`);
  run(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json'], projectDir);

  ok = true;
  console.log('\n✅ pack smoke passed — the published tarball plays a game and typechecks outside this repo.');
} finally {
  if (process.env['KEEP_SMOKE_DIR'] === '1') {
    console.log(`\n(kept ${projectDir}${ok ? '' : ' — the failure is reproducible there'})`);
  } else {
    rmSync(projectDir, { recursive: true, force: true });
  }
}
