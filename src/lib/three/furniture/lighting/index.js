// Lighting. Nothing here emits: the scene is lit by a sun and a hemisphere, and
// these are the fittings you can see. A pendant that actually cast light would
// cost a shadow map per lamp for an effect the daylight presets already give.

import { R } from '../shared.js';

/** A single shade on a flex. */
export function pendant(K, s) {
  const { hang, flex, themedMat } = K;
  const { x, z, ry, room } = s;
  const met = themedMat(room, 'metal', { metalness: 0.6, roughness: 0.3 });
  flex(x, z, ry, met, hang(x, z, ry, themedMat(room, 'accent', { roughness: 0.4 }), s.drop || 1.02));
}

/** A row of them over a table or a counter. */
export function pendantRow(K, s) {
  const n = s.n || 3;
  const len = s.len || 1.2;
  for (let i = 0; i < n; i++) {
    const [px, pz] = R(-len / 2 + (len * i) / Math.max(1, n - 1), 0, s.ry);
    pendant(K, { ...s, x: s.x + px, z: s.z + pz });
  }
}

/** Standard lamp. Its shade sits at eye height — keep it out of the walk. */
export function floorLamp(K, s) {
  const { at, cyl, themedMat, staticMat } = K;
  const { x, z, ry, room } = s;
  const met = themedMat(room, 'metal', { metalness: 0.55, roughness: 0.35 });
  at(cyl(0.16, 0.17, 0.03, 20), met, x, 0.02, z, ry);
  at(cyl(0.018, 0.018, 1.42), met, x, 0.73, z, ry, { receive: false });
  at(cyl(0.14, 0.2, 0.26, 20), staticMat('#2a2723', { roughness: 0.6 }), x, 1.56, z, ry, { receive: false });
}

/** Small lamp for a nightstand or a sideboard. */
export function tableLamp(K, s) {
  const { at, cyl, themedMat, staticMat } = K;
  const { x, z, ry, room } = s;
  const base = s.y || 0.44;
  at(cyl(0.07, 0.09, 0.05, 16), themedMat(room, 'metal', { metalness: 0.55, roughness: 0.35 }),
    x, base + 0.02, z, ry, { receive: false });
  at(cyl(0.012, 0.012, 0.22, 10), themedMat(room, 'metal', { metalness: 0.55, roughness: 0.35 }),
    x, base + 0.14, z, ry, { receive: false });
  at(cyl(0.11, 0.14, 0.17, 18), staticMat('#efe7d8', { roughness: 0.85 }),
    x, base + 0.33, z, ry, { receive: false });
}

/**
 * A recessed downlight: a disc in the ceiling.
 *
 * This is what these units actually have — the pendant is the upgrade the
 * brochure photographs. Cheap enough to scatter, and a ceiling with a rhythm in
 * it stops the top third of every frame being blank plaster.
 */
export function downlight(K, s) {
  const { at, cyl, staticMat, h } = K;
  at(cyl(0.07, 0.07, 0.015, 14), staticMat('#f4efe3', { roughness: 0.5 }),
    s.x, h - 0.012, s.z, s.ry, { cast: false, receive: false });
}

/** A line of them. */
export function downlightRow(K, s) {
  const n = s.n || 3;
  const len = s.len || 2.4;
  for (let i = 0; i < n; i++) {
    const [px, pz] = R(-len / 2 + (len * i) / Math.max(1, n - 1), 0, s.ry);
    downlight(K, { ...s, x: s.x + px, z: s.z + pz });
  }
}

export const variants = { pendant, pendantRow, floorLamp, tableLamp, downlight, downlightRow };
export const fallback = 'pendant';
