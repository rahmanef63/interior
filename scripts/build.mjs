// Build entry point. One command that ships both halves of the app.
//
// Before this, `npm run build` only built the frontend, and pushing the backend
// was a thing you had to remember:
//
//     env -u CONVEX_URL -u CONVEX_SITE_URL -u CONVEX_DEPLOY_KEY npx convex deploy -y
//     git add convex/_generated && git commit
//
// Forget it and the site deploys a frontend calling functions that were never
// pushed — the failure shows up in production, not in the build.
//
// Now `convex deploy --cmd` owns the whole thing: it typechecks and pushes the
// Convex functions, regenerates convex/_generated/, and runs the Next build with
// NEXT_PUBLIC_CONVEX_URL injected from the deploy key's own deployment. The URL
// comes from the key rather than from .env.production, so the frontend can no
// longer be built against a different deployment than the one just pushed to.
//
// Behaviour by environment:
//   CONVEX_DEPLOY_KEY set      → deploy backend + build frontend
//   not set, CONVEX_REQUIRE_DEPLOY=1 → hard fail (this is the Docker/CI path;
//                                failing loudly beats silently shipping a
//                                frontend against a stale backend)
//   not set, CONVEX_SKIP_DEPLOY=1    → frontend only, ON PURPOSE. The escape
//                                hatch for "the backend is already deployed and
//                                I need the frontend out today". Named, logged,
//                                and never the default: the danger it guards
//                                against is real, but a guard that leaves you
//                                with no way through is a guard people work
//                                around by deleting it.
//   not set, otherwise         → warn, build frontend only (local `npm run build`)
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import { existsSync } from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);

/**
 * Quote an argument for cmd.exe.
 *
 * Only needed on the `shell: true` path — see runShim. Doubling `"` is the cmd
 * convention; none of our arguments contain quotes today, but a helper that is
 * only correct for the arguments it happens to see today is a trap for whoever
 * adds the next one.
 */
const q = (a) => (/[\s"&|<>^()]/.test(a) ? `"${String(a).replace(/"/g, '""')}"` : a);

const finish = (r) => {
  if (r.error) {
    console.error('\n✗ could not start the build step:', r.error.message, '\n');
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
};

/** Spawn a real executable. argv is handed over verbatim — no shell, no quoting. */
const runExe = (exe, args) => finish(spawnSync(exe, args, { stdio: 'inherit' }));

/**
 * Spawn an npm-family shim (`npm`, `npx`).
 *
 * On Windows these are `.cmd` files, and Node >= 18.20 refuses to execute those
 * without a shell (the CVE-2024-27980 fix), so `shell: true` is forced there —
 * and with `shell: true` Node joins argv with plain spaces and does NO quoting.
 * That is exactly what broke this script: `['--cmd', 'npm run build:next']`
 * reached the Convex CLI as three separate tokens, and it refused with
 *
 *     error: too many arguments for 'deploy'. Expected 0 arguments but got 2.
 *
 * Linux and the Docker build never saw it (no shell there, argv is exact), so the
 * bug was invisible in CI and reproduced on every Windows machine. Hence `q()`.
 */
const runShim = (cmd, args) => {
  const win = process.platform === 'win32';
  return finish(spawnSync(cmd, win ? args.map(q) : args, { stdio: 'inherit', shell: win }));
};

/**
 * The Convex CLI's own entry point, so it can be launched with the current `node`
 * instead of through `npx`. That takes the shell out of the one command whose
 * arguments contain spaces: the same code path now runs on Windows, macOS, Linux
 * and in Docker, so what CI proves, a laptop gets too.
 *
 * `convex/bin/main.js` is not listed in the package's `exports` map, so it cannot
 * be resolved directly; resolve the manifest (which is exported) and walk to it.
 */
const convexBin = (() => {
  try {
    const bin = path.join(path.dirname(require.resolve('convex/package.json')), 'bin', 'main.js');
    return existsSync(bin) ? bin : null;
  } catch {
    return null;
  }
})();

const DEPLOY_ARGS = [
  'deploy',
  '--cmd', 'npm run build:next',
  '--cmd-url-env-var-name', 'NEXT_PUBLIC_CONVEX_URL',
];

const hasKey = !!(process.env.CONVEX_DEPLOY_KEY || '').trim();
const required = process.env.CONVEX_REQUIRE_DEPLOY === '1';
const skip = process.env.CONVEX_SKIP_DEPLOY === '1';

// The contract self-check is fast and assert-based; it existed but nothing ever
// ran it, so a regression could only be caught by someone remembering to type
// `npm run check`. Gate the build on it.
console.log('\n▸ contract self-check');
runExe(process.execPath, ['scripts/check.mjs']);

if (hasKey) {
  console.log('\n▸ convex deploy + next build');
  if (convexBin) runExe(process.execPath, [convexBin, ...DEPLOY_ARGS]);
  else runShim('npx', ['convex', ...DEPLOY_ARGS]); // convex not installed locally
} else if (skip) {
  console.warn(
    '\n! CONVEX_SKIP_DEPLOY=1 — building the FRONTEND ONLY, deliberately.\n'
    + '  The Convex backend is NOT being pushed by this build. That is only safe\n'
    + '  if the deployed backend already has every function and table this\n'
    + '  frontend calls. NEXT_PUBLIC_CONVEX_URL comes from .env.production.\n'
  );
  runShim('npm', ['run', 'build:next']);
} else if (required) {
  console.error(
    '\n✗ CONVEX_DEPLOY_KEY is not set, but CONVEX_REQUIRE_DEPLOY=1.\n'
    + '  This build would ship a frontend without pushing the Convex backend.\n'
    + '\n'
    + '  In Dokploy: the application → Environment (or Build Args) → add\n'
    + '      CONVEX_DEPLOY_KEY=prod:<your-deployment>|<secret>\n'
    + '  from the Convex dashboard → Settings → Deploy keys → Production.\n'
    + '  The name must match EXACTLY; the Dockerfile prints which sources it\n'
    + '  checked, just above this message.\n'
    + '\n'
    + '  If the backend is already deployed and you only need the frontend out,\n'
    + '  set CONVEX_SKIP_DEPLOY=1 instead — that is an explicit decision rather\n'
    + '  than a silent one. See docs/GUIDE.md §6.\n'
  );
  process.exit(1);
} else {
  console.warn(
    '\n! CONVEX_DEPLOY_KEY not set — building the frontend only.\n'
    + '  The Convex backend is NOT being pushed. Fine for a local build;\n'
    + '  NEXT_PUBLIC_CONVEX_URL falls back to .env.production.\n'
  );
  runShim('npm', ['run', 'build:next']);
}
