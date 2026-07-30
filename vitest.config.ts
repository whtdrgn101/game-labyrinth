import { defineConfig } from 'vitest/config';

/**
 * Coverage gates for the Labyrinth game package, mirroring the hub's per-game configs
 * (`packages/games/<id>/vitest.config.ts`). Two **per-glob thresholds** — `src/engine/**` at 100%
 * (rules: every branch is a rule and deserves a test) and `src/bot/**` at 90% (opinions: heuristic
 * weights get retuned, so a 100% bar on judgement calls buys churn, not correctness). The module and
 * client are host bindings, tested by the hub's backend/UI suites once this game is registered
 * (Track D / D2d); they are deliberately outside this gate.
 *
 * ⚠️ `src/bot/**` currently holds only a typed stub (L5 builds the real bot), so nothing there is
 * covered yet and the 90% threshold would fail on an empty-but-nonzero denominator. The bot glob is
 * therefore not in `coverage.include` until L5 lands — see the note beside it. The engine gate is
 * live from L0 and must never drop.
 */
export default defineConfig({
  test: {
    // `src/module/**` has no coverage *gate* (it is a host binding, and the hub's own backend suite is what
    // finally exercises it), but its tests still run here — L3's redaction and payload parsing are the two
    // places a mistake is invisible from inside the engine. See `docs/d2c-findings.md` §6.
    include: ['src/engine/**/*.test.ts', 'src/module/**/*.test.ts', 'src/bot/**/*.test.ts'],
    // Ported from the hub's per-game configs: the bot's future bench/self-play tests run whole seeded
    // games (CPU-bound), and CI caps vitest to one fork (`VITEST_MAX_FORKS`), so the default 5s timeout
    // starves them under contention. Headroom, not a hang-mask — a genuinely wedged test still dies.
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // L5 adds 'src/bot/**/*.ts' here at the same time it adds the first real bot code + tests.
      include: ['src/engine/**/*.ts'],
      exclude: [
        // Engine excludes (same rationale as every hub game).
        'src/engine/**/tests/**', // test files + shared helpers
        'src/engine/**/index.ts', // public + folder barrels (re-exports only)
        'src/engine/core/types.ts', // compile-time only (domain interfaces)
        'src/engine/actions/action.ts', // compile-time only (the Action union)
        // Bot excludes, pre-declared so L5 only has to flip the `include` line above.
        'src/bot/**/tests/**',
        'src/bot/**/index.ts',
        'src/bot/types.ts',
      ],
      thresholds: {
        // The pure rules core — every rule and every rejection path tested.
        'src/engine/**': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        // The AI opinions — legal + reachable, not exhaustive. Inert until L5 adds the bot glob above.
        'src/bot/**': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
      },
    },
  },
});
