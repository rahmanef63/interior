// The service area. In these units that is the balcony, and it is half of what
// the balcony is for — a balcony drawn as a Western terrace, with a bistro set
// and no washing on it, is the single clearest sign a render was not made for
// this market.

import { R } from '../shared.js';

const STEEL = '#8d8880';
const CLOTH = '#e7e2d6';

/** Free-standing airer. */
export function dryingRack(K, s) {
  const { at, box, staticMat } = K;
  const { x, z, ry } = s;
  const met = staticMat(STEEL, { metalness: 0.6, roughness: 0.35 });
  const len = s.len || 1.0;
  for (const side of [-1, 1]) {
    const [ax, az] = R((side * len) / 2, 0, ry);
    at(box(0.03, 1.05, 0.03), met, x + ax, 0.525, z + az, ry, { receive: false });
    const [bx, bz] = R((side * len) / 2, 0.28, ry);
    at(box(0.03, 0.9, 0.03), met, x + bx, 0.45, z + bz, ry, { receive: false });
  }
  for (const dz of [-0.1, 0.02, 0.14]) {
    const [rx, rz] = R(0, dz, ry);
    at(box(len, 0.02, 0.02), met, x + rx, 1.02 - Math.abs(dz) * 0.4, z + rz, ry, { receive: false });
  }
  // A couple of hung sheets, so the rack reads as in use rather than as scaffolding.
  const cloth = staticMat(CLOTH, { roughness: 1 });
  for (const off of [-0.24, 0.2]) {
    const [cx, cz] = R(off, 0.02, ry);
    at(box(0.34, 0.62, 0.015), cloth, x + cx, 0.68, z + cz, ry, { receive: false });
  }
}

/**
 * A washing line with a load on it.
 *
 * Strung at 2.4 m, not at chest height, and that is not an aesthetic choice:
 * the path audit fires a ring of rays at eye level to check the camera can
 * stand somewhere, and a balcony 1.2 m deep with a washer, an airer and a line
 * across it has no standing room left at 1.6 m. Hung high it is still the first
 * thing in frame when you step out — the upper rows of the frame are exactly
 * where it belongs — and the camera walks under it, which is what you do.
 */
export function line(K, s) {
  const { at, box, staticMat } = K;
  const { x, z, ry } = s;
  const len = s.len || 1.6;
  const y = s.y || 2.4;
  const met = staticMat(STEEL, { metalness: 0.5, roughness: 0.5 });
  at(box(len, 0.012, 0.012), met, x, y, z, ry, { cast: false, receive: false });
  for (const side of [-1, 1]) {
    const [ax, az] = R((side * len) / 2, 0, ry);
    at(box(0.03, y, 0.03), met, x + ax, y / 2, z + az, ry, { receive: false });
  }
  const cloth = staticMat(CLOTH, { roughness: 1 });
  for (let i = 0; i < 4; i++) {
    const [cx, cz] = R(-len / 2 + 0.24 + (i * (len - 0.48)) / 3, 0, ry);
    const drop = 0.35 + ((i * 3) % 3) * 0.12;
    at(box(0.28, drop, 0.012), cloth, x + cx, y - drop / 2 - 0.01, z + cz, ry, { receive: false });
  }
}

/** Top-loader, which is what fits under a balcony counter here. */
export function washer(K, s) {
  const { at, box, cyl, staticMat } = K;
  const { x, z, ry } = s;
  const white = staticMat('#eceae4', { roughness: 0.4 });
  at(box(0.58, 0.9, 0.6), white, x, 0.45, z, ry);
  at(box(0.44, 0.02, 0.44), staticMat('#c9c5bd', { roughness: 0.5 }), x, 0.91, z, ry, { receive: false });
  const [px, pz] = R(0, 0.31, ry);
  at(cyl(0.03, 0.03, 0.02, 12), staticMat('#3a3630', { roughness: 0.5 }),
    x + px, 0.8, z + pz, ry, { receive: false });
}

/** A laundry basket. */
export function basket(K, s) {
  const { at, cyl, staticMat } = K;
  at(cyl(0.2, 0.16, 0.42, 16), staticMat(s.color || '#c2b190', { roughness: 0.9 }),
    s.x, 0.21, s.z, s.ry);
}

export const variants = { dryingRack, line, washer, basket };
export const fallback = 'dryingRack';
