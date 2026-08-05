/**
 * Refuse `npm publish` before it ships a broken tarball.
 *
 * The dev/publish exports split (D2d) relies on `publishConfig.exports`, which **pnpm** applies at pack
 * time and `npm publish` silently ignores — npm uploads the dev exports (`./src/*.ts`) inside a
 * `files: ["dist"]` tarball, a package that installs and then can't resolve any subpath. 0.1.2 shipped
 * exactly that way and had to be unpublished (docs/d2c-findings.md §23). `pack:smoke` cannot catch it:
 * it packs with `pnpm pack`, which applies the override.
 */
const agent = process.env.npm_config_user_agent ?? '';
if (!agent.includes('pnpm')) {
  console.error('✖ publish with `pnpm publish` — `npm publish` ignores publishConfig.exports and ships');
  console.error('  src-pointing exports in a dist-only tarball. See docs/d2c-findings.md §23.');
  process.exit(1);
}
