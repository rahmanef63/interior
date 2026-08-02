// =====================================================================
//  The furniture registry.
//
//  One folder per kind of thing, variations inside it:
//
//    chair/   dining · plastic · lounge · stool · desk
//    bed/     platform · single · divan · bunk
//    sofa/    threeSeat · twoSeat · lShape · bench
//    table/   coffee · dining · side · desk · console
//    …
//
//  A plan places furniture as `{ kind, variant, x, z, ry, room, …extras }`:
//
//    { kind: 'chair',  variant: 'plastic', x: 1.2, z: 4.4 }
//    { kind: 'table',  variant: 'dining', seats: 4, chair: 'plastic' }
//    { kind: 'bed' }                       // → bed/platform, the fallback
//
//  ── why this is not just a rename ────────────────────────────────────────
//
//  These used to be one 263-line factory of closures. Every variation was a
//  flag threaded through it (`f.size === 'single'`, `f.tall`), so adding a bunk
//  bed meant editing the bed. Now a variant is a file-local function with one
//  signature, table.dining draws its seats by calling chair.dining, and a plan
//  swaps `chair: 'plastic'` to re-seat every table in the unit.
//
//  ── backwards compatibility, which is not optional ───────────────────────
//
//  Projects saved before this existed say `kind: 'kitchenRun'` and `'coffeeTable'`,
//  and they are in users' accounts. LEGACY maps every old name onto its new
//  home, so an old plan keeps building exactly the geometry it built before.
//  Nothing here may ever remove one of those rows.
// =====================================================================

import { makeKit, spec } from './shared.js';

import * as bed from './bed/index.js';
import * as chair from './chair/index.js';
import * as sofa from './sofa/index.js';
import * as table from './table/index.js';
import * as storage from './storage/index.js';
import * as kitchen from './kitchen/index.js';
import * as bath from './bath/index.js';
import * as lighting from './lighting/index.js';
import * as appliance from './appliance/index.js';
import * as plant from './plant/index.js';
import * as art from './art/index.js';
import * as rug from './rug/index.js';
import * as door from './door/index.js';
import * as laundry from './laundry/index.js';

/** kind → the folder module. The keys here are the kinds a new plan should use. */
export const FOLDERS = {
  bed, chair, sofa, table, storage, kitchen, bath,
  lighting, appliance, plant, art, rug, door, laundry,
};

/**
 * Old kind → where it lives now. Load-bearing: saved projects use these names.
 * Adding a row is fine. Removing one silently changes somebody's saved unit.
 */
export const LEGACY = {
  nightstand: ['storage', 'nightstand'],
  wardrobe: ['storage', 'wardrobe'],
  tvUnit: ['storage', 'tvUnit'],
  coffeeTable: ['table', 'coffee'],
  diningTable: ['table', 'dining'],
  kitchenRun: ['kitchen', 'run'],
  island: ['kitchen', 'island'],
  shower: ['bath', 'shower'],
  pendant: ['lighting', 'pendant'],
  floorLamp: ['lighting', 'floorLamp'],
  dryingRack: ['laundry', 'dryingRack'],
};

/**
 * Find the draw function for a plan entry.
 * @returns {?Function} null when the kind is unknown — a plan with a typo in it
 *   should lose one object, not fail to build a flat.
 */
export function resolve(kind, variant) {
  const direct = FOLDERS[kind];
  if (direct) return direct.variants[variant] || direct.variants[direct.fallback] || null;
  const alias = LEGACY[kind];
  if (!alias) return null;
  const mod = FOLDERS[alias[0]];
  return mod.variants[variant] || mod.variants[alias[1]] || null;
}

/**
 * Draw a plan's furniture list.
 *
 * Each piece is drawn inside its own merge group, so the parts of one object
 * that share a material end up as one mesh: a dining table and its four chairs
 * is 13 boxes and 2 draw calls. See builders.group().
 *
 * @param {object} THREE
 * @param {object} builders  from createBuilders()
 * @param {Array}  list      plan.furniture
 * @param {{h:number}} env
 */
export function placeAll(THREE, builders, list, env) {
  const K = makeKit(THREE, builders, env);
  (list || []).forEach((f, i) => {
    const draw = resolve(f.kind, f.variant);
    if (!draw) return;
    const label = `${f.kind}${f.variant ? '.' + f.variant : ''}#${i}`;
    K.group(label, () => draw(K, spec(f)));
  });
}

/**
 * The catalogue, as data: every kind and what it can be.
 *
 * Exported for the editor's furniture picker and for `node scripts/check.mjs`,
 * so the list a user sees is generated from the code that draws it rather than
 * typed out a second time and left to drift.
 */
export const CATALOGUE = Object.entries(FOLDERS).map(([kind, mod]) => ({
  kind,
  fallback: mod.fallback,
  variants: Object.keys(mod.variants),
}));

/** Flat list of every `kind.variant` string that resolves. */
export const ALL_VARIANTS = CATALOGUE.flatMap((c) => c.variants.map((v) => `${c.kind}.${v}`));
