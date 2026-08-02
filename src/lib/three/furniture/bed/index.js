// Beds. Drawn facing +z: the headboard is at −z, the foot at +z.
//
// Width is the whole variant story here. An Indonesian bedroom is sized around
// the mattress it has to take — a 3 m room fits a queen and nothing else — so
// the plan says which bed and the room follows, not the other way round.

import { R } from '../shared.js';

const PILLOW = '#efe9dd';

/** Frame + mattress + pillows, the part every bed shares. */
function berth(K, s, wide, len, deck) {
  const { at, box, themedMat, staticMat } = K;
  const { x, z, ry, room } = s;
  const uph = themedMat(room, 'uph', { roughness: 0.85 });
  const wood = themedMat(room, 'wood', { roughness: 0.5 });
  at(box(wide, deck, len), wood, x, deck / 2, z, ry);
  at(box(wide - 0.06, 0.26, len - 0.08), uph, x, deck + 0.13, z, ry);
  const pil = staticMat(PILLOW, { roughness: 0.95 });
  for (const off of wide > 1.2 ? [-0.38, 0.38] : [0]) {
    const [px, pz] = R(off, -len / 2 + 0.29, ry);
    at(box(0.56, 0.14, 0.34), pil, x + px, deck + 0.32, z + pz, ry, { receive: false });
  }
  return { uph, wood, deck };
}

/** A folded throw across the foot — the thing that stops a bed reading as a slab. */
function throwOver(K, s, wide, len, y) {
  const { at, box, themedMat } = K;
  const [tx, tz] = R(0, len / 2 - 0.43, s.ry);
  at(box(wide - 0.02, 0.06, 0.55), themedMat(s.room, 'accent', { roughness: 0.9 }),
    s.x + tx, y, s.z + tz, s.ry, { receive: false });
}

/** Double bed on a low frame with an upholstered headboard. The default. */
export function platform(K, s) {
  const wide = s.w || (s.size === 'single' ? 1.05 : 1.62);
  const len = s.len || 2.02;
  const { uph } = berth(K, s, wide, len, 0.34);
  const [hx, hz] = R(0, -len / 2 - 0.04, s.ry);
  K.at(K.box(wide + 0.12, 1.0, 0.1), uph, s.x + hx, 0.5, s.z + hz, s.ry);
  throwOver(K, s, wide, len, 0.63);
}

/** Single. Same bed, one pillow, for a child's room or a maid's room. */
export function single(K, s) {
  platform(K, { ...s, w: s.w || 1.05 });
}

/**
 * A low platform with no headboard and cushions along the back edge.
 *
 * This is the studio's bed. At 24 m² there is no room for a sofa, so the bed
 * IS the seating, and drawing it as a bedroom bed marooned in a living room is
 * how a studio ends up looking like a mistake rather than a plan.
 */
export function divan(K, s) {
  const wide = s.w || 1.4;
  const len = s.len || 2.0;
  const { at, box, themedMat } = K;
  const { x, z, ry, room } = s;
  berth(K, s, wide, len, 0.24);
  const acc = themedMat(room, 'accent', { roughness: 0.9 });
  // Cushions stood along the long back edge, so it reads as a daybed from the
  // living side and as a bed from the sleeping side. `back` picks which long
  // edge that is: the cushions have to be against the wall, and which wall the
  // bed is pushed to is the plan's business, not the bed's.
  const back = s.back === 'right' ? 1 : -1;
  for (const off of [-len * 0.26, 0, len * 0.26]) {
    const [cx, cz] = R(back * (wide / 2 - 0.14), off, ry);
    at(box(0.12, 0.42, 0.46), acc, x + cx, 0.58, z + cz, ry, { receive: false });
  }
  throwOver(K, s, wide, len, 0.53);
}

/**
 * Bunks. Two children to a bedroom is the normal case in a 2BR, and a bunk is
 * what makes a 2.4 m room work — drawing two singles instead says the unit is
 * bigger than it is.
 */
export function bunk(K, s) {
  const { at, box, themedMat, staticMat } = K;
  const { x, z, ry, room } = s;
  const wide = s.w || 1.0;
  const len = s.len || 2.0;
  const wood = themedMat(room, 'wood', { roughness: 0.5 });
  const uph = themedMat(room, 'uph', { roughness: 0.85 });
  const pil = staticMat(PILLOW, { roughness: 0.95 });
  const upper = Math.min(1.42, K.h - 1.5);
  for (const deck of [0.34, upper]) {
    at(box(wide, 0.1, len), wood, x, deck, z, ry);
    at(box(wide - 0.06, 0.2, len - 0.08), uph, x, deck + 0.15, z, ry);
    const [px, pz] = R(0, -len / 2 + 0.29, ry);
    at(box(0.5, 0.13, 0.32), pil, x + px, deck + 0.31, z + pz, ry, { receive: false });
    // Guard rail on the top bunk only.
    if (deck === upper) {
      const [gx, gz] = R(wide / 2, 0, ry);
      at(box(0.05, 0.34, len * 0.62), wood, x + gx, deck + 0.34, z + gz, ry, { receive: false });
    }
  }
  // Corner posts and a ladder at the foot.
  const met = themedMat(room, 'metal', { metalness: 0.5, roughness: 0.4 });
  for (const dx of [-wide / 2 + 0.05, wide / 2 - 0.05]) {
    for (const dz of [-len / 2 + 0.05, len / 2 - 0.05]) {
      const [lx, lz] = R(dx, dz, ry);
      at(box(0.06, upper + 0.5, 0.06), met, x + lx, (upper + 0.5) / 2, z + lz, ry, { receive: false });
    }
  }
  // Rungs as boxes, not turned cylinders: `ry` and `rx` together on one mesh is
  // a compound Euler rotation, and a rung that is right at ry = 0 quietly points
  // the wrong way at ry = π/2. A box can just be authored the length it needs.
  for (let i = 0; i < 4; i++) {
    const [rx2, rz2] = R(0, len / 2 - 0.06, ry);
    at(box(wide - 0.12, 0.03, 0.03), met, x + rx2, 0.5 + i * 0.3, z + rz2, ry, { receive: false });
  }
}

export const variants = { platform, single, divan, bunk };
export const fallback = 'platform';
