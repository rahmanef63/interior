// Appliances — the things that are mounted rather than placed.

import { R } from '../shared.js';

/**
 * Wall-mounted split air conditioner.
 *
 * If you had to name one object that makes an interior read as Indonesian, it
 * is this: a white box high on the wall, in every room that is sold as a
 * bedroom. Every unit here had bare wall where one belongs, which is the kind
 * of absence nobody points at and everybody registers.
 */
export function acSplit(K, s) {
  const { at, box, staticMat, h } = K;
  const { x, z, ry } = s;
  const white = staticMat('#f2f0ea', { roughness: 0.35 });
  const y = s.y || Math.min(h - 0.38, 2.42);
  const len = s.len || 0.82;
  at(box(len, 0.28, 0.2), white, x, y, z, ry, { receive: false });
  // The louvre: one darker slot along the bottom front, angled down.
  const [lx, lz] = R(0, 0.085, ry);
  at(box(len - 0.08, 0.05, 0.05), staticMat('#c9c5bd', { roughness: 0.6 }),
    x + lx, y - 0.11, z + lz, ry, { receive: false });
}

/** Ceiling fan. Cheaper than running the AC, so most of these rooms have both. */
export function ceilingFan(K, s) {
  const { at, box, cyl, staticMat, h } = K;
  const { x, z, ry } = s;
  const met = staticMat('#d8d3c9', { roughness: 0.45, metalness: 0.2 });
  const drop = s.drop || 0.3;
  const y = h - drop;
  at(cyl(0.018, 0.018, drop, 10), met, x, h - drop / 2, z, ry, { receive: false });
  at(cyl(0.11, 0.13, 0.14, 16), met, x, y, z, ry, { receive: false });
  for (let i = 0; i < 4; i++) {
    const a = ry + (i * Math.PI) / 2;
    at(box(0.14, 0.02, 0.62), met, x + Math.sin(a) * 0.38, y - 0.03, z + Math.cos(a) * 0.38,
      a, { receive: false });
  }
}

/** A wall-hung television, for a bedroom or above a sideboard. */
export function tv(K, s) {
  const { at, box, staticMat } = K;
  const { x, z, ry } = s;
  const len = s.len || 1.1;
  at(box(len, len * 0.58, 0.05), staticMat('#1a1a1c', { roughness: 0.3, metalness: 0.4 }),
    x, s.y || 1.4, z, ry, { receive: false });
}

export const variants = { acSplit, ceilingFan, tv };
export const fallback = 'acSplit';
