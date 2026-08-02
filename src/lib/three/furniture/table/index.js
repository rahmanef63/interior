// Tables. Top runs `len` along x, facing +z.

import { R } from '../shared.js';
import { variants as CHAIRS, fallback as CHAIR_DEFAULT } from '../chair/index.js';

/** Low table in front of a sofa. */
export function coffee(K, s) {
  const { at, box, cyl, legs4, themedMat } = K;
  const { x, z, ry, room } = s;
  const wood = themedMat(room, 'wood', { roughness: 0.4 });
  const met = themedMat(room, 'metal', { metalness: 0.6, roughness: 0.35 });
  const len = s.len || 1.05;
  const deep = s.d || 0.6;
  at(box(len, 0.06, deep), wood, x, 0.38, z, ry);
  legs4(met, x, z, ry, 0.36, len, deep, 0.08);
  // A tray on top. Two horizontals at slightly different heights is what stops a
  // low table reading as a step.
  at(cyl(0.13, 0.15, 0.03, 20), met, x, 0.42, z, ry, { receive: false });
}

/**
 * Dining table with chairs around it.
 *
 * The seats are `chair` variants, not shapes drawn here. That is the point of
 * the split: `{ chair: 'plastic' }` on a plan entry re-seats the whole table,
 * and the chair itself is still one definition used everywhere.
 */
export function dining(K, s) {
  const { at, box, legs4, themedMat } = K;
  const { x, z, ry, room } = s;
  const wood = themedMat(room, 'wood', { roughness: 0.4 });
  const met = themedMat(room, 'metal', { metalness: 0.55, roughness: 0.35 });
  const len = s.len || 1.5;
  const deep = s.d || 0.85;
  at(box(len, 0.06, deep), wood, x, 0.74, z, ry);
  legs4(met, x, z, ry, 0.72, len, deep, 0.12);

  const seats = s.seats == null ? 4 : s.seats;
  const draw = CHAIRS[s.chair] || CHAIRS[CHAIR_DEFAULT];
  for (let i = 0; i < seats; i++) {
    const side = i % 2 ? 1 : -1;
    const along = (Math.floor(i / 2) - (Math.ceil(seats / 2) - 1) / 2) * 0.62;
    const [cx, cz] = R(along, side * (deep / 2 + 0.28), ry);
    // Chairs on the far side face back across the table.
    draw(K, { x: x + cx, z: z + cz, ry: side > 0 ? ry + Math.PI : ry, room });
  }
}

/** Side table beside a sofa or a bed. */
export function side(K, s) {
  const { at, cyl, themedMat } = K;
  const { x, z, ry, room } = s;
  const r = s.r || 0.24;
  at(cyl(r, r, 0.04, 20), themedMat(room, 'wood', { roughness: 0.42 }), x, 0.52, z, ry);
  const met = themedMat(room, 'metal', { metalness: 0.6, roughness: 0.3 });
  at(cyl(0.025, 0.025, 0.5, 12), met, x, 0.25, z, ry, { receive: false });
  at(cyl(r * 0.8, r * 0.8, 0.02, 20), met, x, 0.01, z, ry);
}

/**
 * A work desk. These units are sold with a work corner on the plan now, and
 * an empty corner is the one thing a floor plan cannot show you is empty.
 */
export function desk(K, s) {
  const { at, box, legs4, themedMat, staticMat } = K;
  const { x, z, ry, room } = s;
  const len = s.len || 1.2;
  const deep = s.d || 0.6;
  const wood = themedMat(room, 'wood', { roughness: 0.4 });
  at(box(len, 0.05, deep), wood, x, 0.74, z, ry);
  legs4(themedMat(room, 'metal', { metalness: 0.55, roughness: 0.35 }), x, z, ry, 0.72, len, deep, 0.08);
  // A screen, so it reads as a desk and not as a narrow dining table.
  const [mx, mz] = R(0, -deep / 2 + 0.14, ry);
  at(box(0.54, 0.34, 0.02), staticMat('#1a1a1c', { roughness: 0.3, metalness: 0.4 }),
    x + mx, 0.96, z + mz, ry, { receive: false });
  at(box(0.16, 0.16, 0.02), staticMat('#3a3630', { roughness: 0.5 }), x + mx, 0.81, z + mz, ry, { receive: false });
}

/** Narrow console against a wall — entrance, or behind a floating sofa. */
export function console_(K, s) {
  const { at, box, legs4, themedMat } = K;
  const { x, z, ry, room } = s;
  const len = s.len || 1.0;
  at(box(len, 0.05, 0.32), themedMat(room, 'wood', { roughness: 0.42 }), x, 0.78, z, ry);
  legs4(themedMat(room, 'metal', { metalness: 0.6, roughness: 0.3 }), x, z, ry, 0.76, len, 0.32, 0.07, 0.02);
}

export const variants = { coffee, dining, side, desk, console: console_ };
export const fallback = 'coffee';
