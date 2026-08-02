// npm run check — runs the repo's assert-based self-checks (no framework).
import { demo } from '../src/lib/three/contract.js';
import { resolve, CATALOGUE, LEGACY, FOLDERS } from '../src/lib/three/furniture/index.js';
import { UNITS } from '../src/config/units.js';

demo(); // throws (non-zero exit) on any contract regression

// ── every piece a unit places must resolve to a variant ────────────────────
//
// resolve() returns null for an unknown kind and buildApartment skips it, which
// is the right runtime behaviour — one typo should cost a chair, not a flat —
// but it means a renamed variant goes missing in silence. This is the check
// that makes the silence loud.
let placed = 0;
for (const u of UNITS) {
  for (const f of u.plan.furniture || []) {
    const fn = resolve(f.kind, f.variant);
    if (!fn) {
      throw new Error(
        `${u.key}: no furniture for { kind: '${f.kind}'${f.variant ? `, variant: '${f.variant}'` : ''} } at (${f.x}, ${f.z})`,
      );
    }
    placed++;
  }
}

// ── every legacy name still lands somewhere ────────────────────────────────
//
// Saved projects use these. Deleting a row is a silent change to work that is
// already in somebody's account, so it has to fail here rather than there.
for (const [old, [folder, variant]] of Object.entries(LEGACY)) {
  if (!FOLDERS[folder]) throw new Error(`LEGACY['${old}'] points at folder '${folder}', which does not exist`);
  if (!FOLDERS[folder].variants[variant]) throw new Error(`LEGACY['${old}'] points at '${folder}/${variant}', which does not exist`);
  if (typeof resolve(old) !== 'function') throw new Error(`legacy kind '${old}' no longer resolves`);
}

// ── every folder declares a fallback that exists ───────────────────────────
for (const c of CATALOGUE) {
  if (!c.variants.includes(c.fallback)) {
    throw new Error(`${c.kind}: fallback '${c.fallback}' is not one of ${c.variants.join(', ')}`);
  }
}

const variants = CATALOGUE.reduce((n, c) => n + c.variants.length, 0);
console.log(`furniture ok — ${CATALOGUE.length} kinds, ${variants} variants, ${Object.keys(LEGACY).length} legacy aliases, ${placed} pieces placed across ${UNITS.length} units`);
