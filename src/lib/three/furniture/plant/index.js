// Plants. Cheap mass at floor level and the one thing in the unit that is not
// a rectangle, which is most of what they are here for.

import { R } from '../shared.js';

const LEAF = '#4e6b4a';
const STEM = '#6b6142';

/** Pot, stem, canopy. `tall` picks the big one. */
export function potted(K, s) {
  const { at, cyl, sphere, themedMat, staticMat } = K;
  const { x, z, ry, room } = s;
  at(cyl(0.17, 0.13, 0.34, 18), themedMat(room, 'stone', { roughness: 0.8 }), x, 0.17, z, ry);
  const hgt = s.tall ? 1.15 : 0.6;
  at(cyl(0.02, 0.03, hgt), staticMat(STEM, { roughness: 0.9 }), x, 0.34 + hgt / 2, z, ry, { receive: false });
  at(sphere(s.tall ? 0.38 : 0.26), staticMat(LEAF, { roughness: 0.9 }), x, 0.34 + hgt, z, ry, { receive: false });
}

/** The floor-standing one, chest high. */
export function tall(K, s) {
  potted(K, { ...s, tall: true });
}

/**
 * Fan palm — three flat blades instead of a ball.
 *
 * A second silhouette matters more than a second species: nine identical
 * lollipops across four units is what makes a scene read as placeholder art.
 */
export function palm(K, s) {
  const { at, box, cyl, themedMat, staticMat } = K;
  const { x, z, ry, room } = s;
  at(cyl(0.19, 0.15, 0.4, 18), themedMat(room, 'stone', { roughness: 0.8 }), x, 0.2, z, ry);
  const leaf = staticMat(LEAF, { roughness: 0.9 });
  const stem = staticMat(STEM, { roughness: 0.9 });
  for (let i = 0; i < 5; i++) {
    const a = ry + (i * Math.PI * 2) / 5 + 0.4;
    const lean = 0.16 + (i % 3) * 0.05;
    const hgt = 0.85 + (i % 2) * 0.28;
    at(cyl(0.014, 0.018, hgt, 8), stem, x + Math.sin(a) * lean, 0.4 + hgt / 2, z + Math.cos(a) * lean,
      a, { receive: false });
    at(box(0.34, 0.02, 0.2), leaf, x + Math.sin(a) * (lean + 0.12), 0.4 + hgt, z + Math.cos(a) * (lean + 0.12),
      a, { receive: false });
  }
}

/** Trailing plant on a shelf or hung from the balcony rail. */
export function hanging(K, s) {
  const { at, cyl, sphere, staticMat } = K;
  const { x, z, ry } = s;
  const y = s.y || 1.6;
  at(cyl(0.012, 0.012, 0.4, 8), staticMat('#8d8880', { metalness: 0.5, roughness: 0.4 }),
    x, y + 0.2, z, ry, { receive: false });
  at(cyl(0.13, 0.1, 0.18, 16), staticMat('#b98d6a', { roughness: 0.8 }), x, y, z, ry, { receive: false });
  const leaf = staticMat(LEAF, { roughness: 0.9 });
  at(sphere(0.19), leaf, x, y + 0.04, z, ry, { receive: false });
  // Two trails, so it hangs rather than sits.
  for (const off of [-0.08, 0.09]) {
    const [tx, tz] = R(off, 0.02, ry);
    at(cyl(0.02, 0.012, 0.42, 8), leaf, x + tx, y - 0.24, z + tz, ry, { receive: false });
  }
}

export const variants = { potted, tall, palm, hanging };
export const fallback = 'potted';
