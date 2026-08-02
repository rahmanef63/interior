// Things hung on a wall, facing +z.
//
// Not decoration for its own sake. Every unit's last shot is its bedroom, and a
// bed against a bare wall gives the top half of that frame nothing to do: the
// audit counted plenty of "subjects" because it counts objects, and the shot
// still read as empty. Tilting the camera only trades blank wall for blank
// floor. Hanging something at head height is the actual fix.

import { R } from '../shared.js';

/** One framed panel. */
export function framed(K, s) {
  const { at, box, themedMat } = K;
  const { x, z, ry, room } = s;
  const w = s.w || 1.1;
  const hh = s.h || 0.78;
  const y = s.y || 1.75;
  at(box(w + 0.06, hh + 0.06, 0.035), themedMat(room, 'wood', { roughness: 0.5 }), x, y, z, ry, { receive: false });
  // The canvas takes the 'rug' role, not 'accent'. Accent is the palette's near
  // black, and a black rectangle in a wood frame does not read as a picture —
  // it reads as a switched-off television hung over the bed.
  const [fx, fz] = R(0, 0.022, ry);
  at(box(w, hh, 0.012), themedMat(room, 'rug', { roughness: 0.9 }), x + fx, y, z + fz, ry, { receive: false });
  const [ax, az] = R(-w * 0.16, 0.03, ry);
  at(box(w * 0.42, hh * 0.52, 0.008), themedMat(room, 'accent', { roughness: 0.9 }),
    x + ax, y - hh * 0.08, z + az, ry, { receive: false });
}

/** Two smaller panels side by side — a wider wall, same budget. */
export function diptych(K, s) {
  const w = s.w || 0.52;
  const gap = s.gap || 0.1;
  for (const side of [-1, 1]) {
    const [dx, dz] = R((side * (w + gap)) / 2, 0, s.ry);
    framed(K, { ...s, x: s.x + dx, z: s.z + dz, w, h: s.h || 0.68 });
  }
}

/** A leaning mirror — the standard trick for making a narrow unit read wider. */
export function mirror(K, s) {
  const { at, box, themedMat, staticMat } = K;
  const { x, z, ry, room } = s;
  const w = s.w || 0.6;
  const hh = s.h || 1.5;
  const y = s.y || hh / 2 + 0.05;
  at(box(w + 0.05, hh + 0.05, 0.04), themedMat(room, 'wood', { roughness: 0.5 }), x, y, z, ry, { receive: false });
  const [fx, fz] = R(0, 0.025, ry);
  at(box(w, hh, 0.012), staticMat('#c9d2d4', { roughness: 0.08, metalness: 0.65 }),
    x + fx, y, z + fz, ry, { receive: false });
}

/** A wall clock. Small, round, and the only circle at head height in the room. */
export function clock(K, s) {
  const { at, cyl, themedMat, staticMat } = K;
  const { x, z, ry, room } = s;
  const y = s.y || 2.0;
  at(cyl(0.16, 0.16, 0.04, 20), themedMat(room, 'wood', { roughness: 0.5 }), x, y, z, ry, { receive: false });
  const [fx, fz] = R(0, 0.026, ry);
  at(cyl(0.14, 0.14, 0.01, 20), staticMat('#f4efe3', { roughness: 0.6 }), x + fx, y, z + fz, ry, { receive: false });
}

export const variants = { framed, diptych, mirror, clock };
export const fallback = 'framed';
