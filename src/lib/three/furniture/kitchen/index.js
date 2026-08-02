// Kitchens. The counter runs `len` along x; the wall it backs onto is at −z.

import { R } from '../shared.js';

/** Base cabinets + worktop, shared by every counter variant. */
function counter(K, s, len, deep) {
  const { at, box, themedMat } = K;
  const { x, z, ry, room } = s;
  const wood = themedMat(room, 'wood', { roughness: 0.4 });
  const stone = themedMat(room, 'stone', { roughness: 0.32 });
  at(box(len, 0.86, deep), wood, x, 0.43, z, ry);
  at(box(len, 0.05, deep + 0.04), stone, x, 0.885, z, ry, { receive: false });
  return { wood, stone };
}

/** A tap at the sink position. */
function tap(K, s, off = 0) {
  const { at, cyl, themedMat } = K;
  const [tx, tz] = R(off, 0, s.ry);
  at(cyl(0.02, 0.02, 0.3), themedMat(s.room, 'metal', { metalness: 0.6, roughness: 0.3 }),
    s.x + tx, 1.05, s.z + tz, s.ry, { receive: false });
}

/** Full run: base, worktop, splashback, wall units. */
export function run(K, s) {
  const { at, box, themedMat, h } = K;
  const { x, z, ry, room } = s;
  const len = s.len || 2.6;
  const { wood } = counter(K, s, len, 0.62);
  // Splashback + upper run: the two horizontals that say "kitchen" instantly.
  const [sx, sz] = R(0, -0.3, ry);
  at(box(len, 0.52, 0.03), themedMat(room, 'accent', { roughness: 0.5 }), x + sx, 1.17, z + sz, ry, { receive: false });
  const [ux, uz] = R(0, -0.16, ry);
  at(box(len, 0.6, 0.34), wood, x + ux, Math.min(h - 0.42, 1.78), z + uz, ry);
  tap(K, s);
}

/**
 * A pantry, not a kitchen: 1.4 m of counter, a sink, no wall units.
 *
 * This is what a 24 m² studio is sold with — the developer's brochure calls it
 * a "kitchen set" and it is one cabinet. Drawing a full run there is how the
 * studio ended up looking like a 40 m² unit with the walls moved in.
 */
export function pantry(K, s) {
  const { at, box, themedMat } = K;
  const len = s.len || 1.4;
  counter(K, s, len, 0.58);
  const [sx, sz] = R(0, -0.28, s.ry);
  at(box(len, 0.4, 0.03), themedMat(s.room, 'stone', { roughness: 0.45 }),
    s.x + sx, 1.11, s.z + sz, s.ry, { receive: false });
  tap(K, s);
}

/** Island with an overhang and pendants over it. */
export function island(K, s) {
  const { at, box, cyl, hang, flex, themedMat, h } = K;
  const { x, z, ry, room } = s;
  const len = s.len || 1.9;
  at(box(len, 0.86, 0.85), themedMat(room, 'wood', { roughness: 0.42 }), x, 0.43, z, ry);
  at(box(len + 0.1, 0.06, 0.95), themedMat(room, 'stone', { roughness: 0.3 }), x, 0.89, z, ry, { receive: false });
  const met = themedMat(room, 'metal', { metalness: 0.6, roughness: 0.3 });
  for (const off of [-0.42, 0.42]) {
    const [sx, sz] = R(off * len, 0.72, ry);
    at(cyl(0.16, 0.14, 0.05, 18), met, x + sx, 0.66, z + sz, ry, { receive: false });
    K.leg(met, x + sx, z + sz, 0.64, ry);
  }
  const shade = themedMat(room, 'accent', { roughness: 0.4 });
  for (const off of [-0.36, 0.36]) {
    const [px, pz] = R(off * len, 0, ry);
    flex(x + px, z + pz, ry, met, hang(x + px, z + pz, ry, shade, 1.02));
  }
}

/**
 * The fridge. Every unit has one and none of them had one.
 *
 * Not detail for its own sake: it is 1.7 m of vertical mass at the end of a
 * counter, which is the single biggest thing in the kitchen frame after the
 * run itself. A kitchen without it reads as a showhome nobody has moved into.
 */
export function fridge(K, s) {
  const { at, box, staticMat, themedMat } = K;
  const { x, z, ry, room } = s;
  const tall = Math.min(s.h || 1.72, K.h - 0.4);
  const body = staticMat(s.color || '#cfcbc4', { roughness: 0.4, metalness: 0.25 });
  at(box(0.6, tall, 0.64), body, x, tall / 2, z, ry);
  const met = themedMat(room, 'metal', { metalness: 0.6, roughness: 0.3 });
  // The freezer split and two handles: the whole silhouette in three lines.
  const [gx, gz] = R(0, 0.33, ry);
  at(box(0.6, 0.012, 0.012), met, x + gx, tall * 0.62, z + gz, ry, { receive: false });
  for (const y of [tall * 0.72, tall * 0.42]) {
    const [hx, hz] = R(-0.2, 0.34, ry);
    at(box(0.02, 0.24, 0.02), met, x + hx, y, z + hz, ry, { receive: false });
  }
}

export const variants = { run, pantry, island, fridge };
export const fallback = 'run';
