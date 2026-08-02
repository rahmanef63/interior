// Chairs. Seat facing +z, back at −z.
//
// A chair is the smallest thing in the unit that still has to read at walking
// speed, which is why these are silhouettes: four legs and a back plane say
// "dining chair" from three metres, and nothing about the joinery does.
//
// table.dining calls into here rather than drawing its own seats, so changing
// the chair changes every table that uses it — which is the whole reason the
// furniture got split into folders.

import { R } from '../shared.js';

const SEAT_H = 0.45;

/** The plain four-legged dining chair. The default. */
export function dining(K, s) {
  const { at, box, legs4, themedMat } = K;
  const { x, z, ry, room } = s;
  const wood = themedMat(room, 'wood', { roughness: 0.45 });
  const w = s.w || 0.42;
  at(box(w, 0.05, 0.42), wood, x, SEAT_H, z, ry);
  legs4(wood, x, z, ry, SEAT_H - 0.03, w, 0.42, 0.05, 0.018);
  const [bx, bz] = R(0, -0.2, ry);
  at(box(w, 0.5, 0.05), wood, x + bx, 0.7, z + bz, ry, { receive: false });
}

/**
 * The stackable monobloc plastic chair.
 *
 * Not a joke and not filler: this is the chair that is actually in the unit —
 * on the balcony, at the folding table, stacked in the service area. A showroom
 * that only shows walnut dining chairs is showing a catalogue, not a home.
 */
export function plastic(K, s) {
  const { at, box, staticMat } = K;
  const { x, z, ry } = s;
  const shell = staticMat(s.color || '#dfd9cc', { roughness: 0.55 });
  at(box(0.42, 0.04, 0.4), shell, x, 0.44, z, ry);
  // Splayed legs read as plastic where straight ones read as timber.
  for (const dx of [-0.16, 0.16]) {
    for (const dz of [-0.15, 0.15]) {
      const [lx, lz] = R(dx, dz, ry);
      at(box(0.03, 0.44, 0.03), shell, x + lx, 0.22, z + lz, ry, { receive: false });
    }
  }
  const [bx, bz] = R(0, -0.19, ry);
  at(box(0.4, 0.42, 0.035), shell, x + bx, 0.66, z + bz, ry, { receive: false });
  // The two arms are what separate this from a dining chair at a glance.
  for (const side of [-1, 1]) {
    const [ax, az] = R(side * 0.21, -0.03, ry);
    at(box(0.035, 0.03, 0.32), shell, x + ax, 0.64, z + az, ry, { receive: false });
    const [px, pz] = R(side * 0.21, 0.12, ry);
    at(box(0.035, 0.2, 0.035), shell, x + px, 0.54, z + pz, ry, { receive: false });
  }
}

/** Upholstered armchair — the one seat in a studio that is not the bed. */
export function lounge(K, s) {
  const { at, box, legs4, themedMat } = K;
  const { x, z, ry, room } = s;
  const uph = themedMat(room, 'uph', { roughness: 0.88 });
  const wood = themedMat(room, 'wood', { roughness: 0.5 });
  at(box(0.7, 0.28, 0.7), uph, x, 0.34, z, ry);
  const [bx, bz] = R(0, -0.3, ry);
  at(box(0.7, 0.54, 0.16), uph, x + bx, 0.6, z + bz, ry);
  for (const side of [-1, 1]) {
    const [ax, az] = R(side * 0.31, -0.02, ry);
    at(box(0.12, 0.24, 0.62), uph, x + ax, 0.54, z + az, ry);
  }
  legs4(wood, x, z, ry, 0.2, 0.7, 0.7, 0.12, 0.022);
}

/** Bar stool for a pantry counter or an island overhang. */
export function stool(K, s) {
  const { at, cyl, box, themedMat } = K;
  const { x, z, ry, room } = s;
  const met = themedMat(room, 'metal', { metalness: 0.6, roughness: 0.3 });
  const seatY = s.y || 0.66;
  at(cyl(0.16, 0.14, 0.05, 18), themedMat(room, 'wood', { roughness: 0.5 }), x, seatY, z, ry, { receive: false });
  at(cyl(0.03, 0.03, seatY - 0.03, 12), met, x, (seatY - 0.03) / 2, z, ry, { receive: false });
  at(cyl(0.17, 0.17, 0.02, 18), met, x, 0.01, z, ry);
  // Footrest ring: the detail that makes a stool read as tall rather than as a
  // dining chair that has floated up.
  at(box(0.28, 0.02, 0.02), met, x, 0.24, z, ry, { receive: false });
}

/**
 * Task chair, for the desk. Post-2020 these units are sold with a work corner
 * drawn on the plan, so leaving the desk chairless dates the showroom.
 */
export function desk(K, s) {
  const { at, box, cyl, themedMat, staticMat } = K;
  const { x, z, ry, room } = s;
  const dark = staticMat('#3a3630', { roughness: 0.7 });
  const met = themedMat(room, 'metal', { metalness: 0.55, roughness: 0.35 });
  at(box(0.46, 0.07, 0.44), dark, x, 0.47, z, ry);
  const [bx, bz] = R(0, -0.21, ry);
  at(box(0.44, 0.52, 0.06), dark, x + bx, 0.76, z + bz, ry, { receive: false });
  at(cyl(0.035, 0.035, 0.4, 12), met, x, 0.24, z, ry, { receive: false });
  // Five-star base, as a star.
  for (let i = 0; i < 5; i++) {
    const a = ry + (i * Math.PI * 2) / 5;
    at(box(0.05, 0.03, 0.3), met, x + Math.sin(a) * 0.13, 0.05, z + Math.cos(a) * 0.13,
      a, { receive: false });
  }
}

export const variants = { dining, plastic, lounge, stool, desk };
export const fallback = 'dining';
