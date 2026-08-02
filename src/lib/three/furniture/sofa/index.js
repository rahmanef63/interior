// Sofas. Seat facing +z, back at −z, `len` runs along x.

import { R } from '../shared.js';

/** Seat slab, back, two arms, two cushions — the shape every variant shares. */
function body(K, s, len, deep) {
  const { at, box, themedMat } = K;
  const { x, z, ry, room } = s;
  const uph = themedMat(room, 'uph', { roughness: 0.88 });
  at(box(len, 0.4, deep), uph, x, 0.28, z, ry);
  const [bx, bz] = R(0, -deep / 2 + 0.06, ry);
  at(box(len, 0.62, 0.2), uph, x + bx, 0.6, z + bz, ry);
  for (const side of [-1, 1]) {
    const [ax, az] = R((side * len) / 2 - side * 0.09, 0, ry);
    at(box(0.18, 0.5, deep - 0.02), uph, x + ax, 0.4, z + az, ry);
  }
  const acc = themedMat(room, 'accent', { roughness: 0.9 });
  for (const off of [-0.5, 0.5]) {
    const [px, pz] = R(off * (len / 3), -deep / 4, ry);
    at(box(0.36, 0.36, 0.12), acc, x + px, 0.66, z + pz, ry, { receive: false });
  }
  return uph;
}

/** Three-seater. The default. */
export function threeSeat(K, s) {
  body(K, s, s.len || 2.1, s.d || 0.88);
}

/** Two-seater, for a 1BR living room where 2.1 m of sofa would block the walk. */
export function twoSeat(K, s) {
  body(K, s, s.len || 1.55, s.d || 0.85);
}

/**
 * L-shaped sectional. The most-sold living-room piece in this market, and the
 * one that actually explains the room: it is what a 2.6 m-wide living area is
 * shaped around, and the tour's living-room shot is mostly this object.
 */
export function lShape(K, s) {
  const { at, box, themedMat } = K;
  const { x, z, ry, room } = s;
  const len = s.len || 2.3;
  const deep = s.d || 0.9;
  const arm = s.arm || 1.5;          // the returning leg
  const hand = s.hand === 'left' ? -1 : 1;
  const uph = body(K, s, len, deep);
  // The chaise returns from one end, toward +z.
  const [cx, cz] = R(hand * (len / 2 - deep / 2), deep / 2 + arm / 2 - 0.02, ry);
  at(box(deep, 0.4, arm), uph, x + cx, 0.28, z + cz, ry);
  const acc = themedMat(room, 'accent', { roughness: 0.9 });
  const [px, pz] = R(hand * (len / 2 - deep / 2), deep / 2 + arm - 0.3, ry);
  at(box(0.34, 0.34, 0.12), acc, x + px, 0.62, z + pz, ry, { receive: false });
}

/** Backless bench — entrance, or the foot of a bed. */
export function bench(K, s) {
  const { at, box, legs4, themedMat } = K;
  const { x, z, ry, room } = s;
  const len = s.len || 1.1;
  at(box(len, 0.16, 0.4), themedMat(room, 'uph', { roughness: 0.9 }), x, 0.44, z, ry);
  legs4(themedMat(room, 'wood', { roughness: 0.45 }), x, z, ry, 0.36, len, 0.4, 0.1, 0.022);
}

export const variants = { threeSeat, twoSeat, lShape, bench };
export const fallback = 'threeSeat';
