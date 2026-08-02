// Door leaves standing in their openings.
//
// The opening itself is cut by the shell/partition code in apartment.js — this
// is only the leaf. It reads as a door from the top-down intro and gives the eye
// something at head height in what would otherwise be an empty reveal.

import { R } from '../shared.js';

const LEAF_H = 2.06; // DOOR_H − 0.04: sits inside the opening, not in the header

/** A flush leaf, standing open in the reveal. */
export function leaf(K, s) {
  const { at, box, themedMat } = K;
  at(box(s.w || 0.86, LEAF_H, 0.04), themedMat(s.room, 'wood', { roughness: 0.5 }),
    s.x, LEAF_H / 2, s.z, s.ry, { receive: false });
}

/** Leaf plus a lever handle — worth it on the front door, which the tour opens on. */
export function panelled(K, s) {
  const { at, box, themedMat } = K;
  const { x, z, ry, room } = s;
  const w = s.w || 0.86;
  const wood = themedMat(room, 'wood', { roughness: 0.5 });
  at(box(w, LEAF_H, 0.04), wood, x, LEAF_H / 2, z, ry, { receive: false });
  // Two sunk panels: two rectangles proud of the leaf, which at this scale is
  // the same thing and one mesh cheaper than a rebate.
  const [px, pz] = R(0, 0.024, ry);
  for (const [y, hh] of [[1.48, 0.82], [0.55, 0.68]]) {
    at(box(w - 0.16, hh, 0.012), wood, x + px, y, z + pz, ry, { receive: false });
  }
  const [hx, hz] = R(w / 2 - 0.09, 0.04, ry);
  at(box(0.12, 0.025, 0.025), themedMat(room, 'metal', { metalness: 0.65, roughness: 0.3 }),
    x + hx, 1.02, z + hz, ry, { receive: false });
}

/** A sliding leaf parked beside its opening — bathrooms, and studio partitions. */
export function sliding(K, s) {
  const { at, box, themedMat } = K;
  const { x, z, ry, room } = s;
  const w = s.w || 0.86;
  at(box(w, LEAF_H, 0.035), themedMat(room, 'wood', { roughness: 0.5 }),
    x, LEAF_H / 2, z, ry, { receive: false });
  const [tx, tz] = R(0, 0, ry);
  at(box(w + 0.3, 0.05, 0.06), themedMat(room, 'metal', { metalness: 0.6, roughness: 0.3 }),
    x + tx, LEAF_H + 0.06, z + tz, ry, { receive: false });
}

export const variants = { leaf, panelled, sliding };
export const fallback = 'leaf';
