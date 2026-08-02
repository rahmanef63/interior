// Bathrooms. The wall is at −z; everything faces the room, at +z.
//
// These are Indonesian wet rooms: no bath, a floor drain, a shower screen at
// most. `tub` exists for the premium tier, not for the mass-market units.

import { R } from '../shared.js';

const PORCELAIN = '#f1eee7';
const CHROME = '#8d8880';

/** Vanity + mirror + WC. The whole small bathroom in one call. */
export function vanity(K, s) {
  const { at, box, cyl, staticMat } = K;
  const { x, z, ry } = s;
  const white = staticMat(PORCELAIN, { roughness: 0.35 });
  const met = staticMat(CHROME, { metalness: 0.7, roughness: 0.25 });
  at(box(0.62, 0.84, 0.4), white, x, 0.42, z, ry);                        // vanity block
  at(box(0.66, 0.05, 0.44), white, x, 0.87, z, ry, { receive: false });   // basin top
  const [tx, tz] = R(0, -0.14, ry);
  at(cyl(0.02, 0.02, 0.26), met, x + tx, 1.02, z + tz, ry, { receive: false });
  const [wx, wz] = R(0, -0.2, ry);
  at(box(0.6, 0.75, 0.03), met, x + wx, 1.5, z + wz, ry, { receive: false }); // mirror
  const [cx, cz] = R(0.85, 0.05, ry);
  at(box(0.38, 0.42, 0.6), white, x + cx, 0.21, z + cz, ry);              // wc pan
  const [bx, bz] = R(0.85, -0.18, ry);
  at(box(0.36, 0.52, 0.16), white, x + bx, 0.55, z + bz, ry, { receive: false }); // cistern
}

/** Glass screen, rail and head — a wet corner, not a cubicle. */
export function shower(K, s) {
  const { at, box, cyl, staticMat, THREE, h } = K;
  const { x, z, ry } = s;
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#dfe7ea', roughness: 0.06, transparent: true, opacity: 0.32,
  });
  const met = staticMat(CHROME, { metalness: 0.7, roughness: 0.25 });
  const sw = s.w || 0.95;
  const tall = Math.min(2.0, h - 0.4);
  at(box(sw, tall, 0.03), glass, x, tall / 2, z, ry, { cast: false });
  at(box(sw, 0.05, 0.05), met, x, tall, z, ry, { receive: false });
  at(box(0.05, tall, 0.05), met, x - sw / 2, tall / 2, z, ry, { receive: false });
  const [hx, hz] = R(0, -0.35, ry);
  at(cyl(0.09, 0.09, 0.03, 16), met, x + hx, tall + 0.08, z + hz, ry, { receive: false });
}

/**
 * Bak mandi — the tiled water tub with a dipper.
 *
 * The most Indonesian object in the whole showroom. Mid-market units still ship
 * with one, and its absence is what makes a rendered bathroom read as foreign
 * even when every dimension is right.
 */
export function tub(K, s) {
  const { at, box, cyl, staticMat, themedMat } = K;
  const { x, z, ry, room } = s;
  const tile = themedMat(room, 'stone', { roughness: 0.5 });
  const wide = s.w || 0.6;
  at(box(wide, 0.8, 0.55), tile, x, 0.4, z, ry);
  at(box(wide - 0.14, 0.06, 0.42), staticMat('#9fb6ba', { roughness: 0.1, metalness: 0.1 }),
    x, 0.79, z, ry, { receive: false });                                  // water
  const met = staticMat(CHROME, { metalness: 0.7, roughness: 0.25 });
  const [tx, tz] = R(0, -0.24, ry);
  at(cyl(0.018, 0.018, 0.2), met, x + tx, 1.0, z + tz, ry, { receive: false });
  // The dipper (gayung), floating.
  at(cyl(0.09, 0.08, 0.1, 14), staticMat('#c8543f', { roughness: 0.6 }), x, 0.84, z, ry, { receive: false });
}

/** Wall-mounted water heater — the box above the door in every wet room here. */
export function heater(K, s) {
  const { at, box, cyl, staticMat } = K;
  const { x, z, ry } = s;
  const white = staticMat(PORCELAIN, { roughness: 0.4 });
  const y = s.y || 1.95;
  at(box(0.34, 0.42, 0.22), white, x, y, z, ry, { receive: false });
  const [px, pz] = R(0, 0.12, ry);
  at(cyl(0.012, 0.012, 0.5), staticMat(CHROME, { metalness: 0.7, roughness: 0.3 }),
    x + px, y - 0.45, z + pz, ry, { receive: false });
}

export const variants = { vanity, shower, tub, heater };
export const fallback = 'vanity';
