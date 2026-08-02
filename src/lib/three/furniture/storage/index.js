// Storage. Fronts face +z, backs at −z, so a piece placed against the north
// wall is turned by π.

import { R } from '../shared.js';

/** Full-height wardrobe run with vertical pulls. */
export function wardrobe(K, s) {
  const { at, box, themedMat, h } = K;
  const { x, z, ry, room } = s;
  const wood = themedMat(room, 'wood', { roughness: 0.42 });
  const len = s.len || 1.8;
  const tall = Math.min(s.h || 2.3, h - 0.3);
  at(box(len, tall, 0.6), wood, x, tall / 2, z, ry);
  const met = themedMat(room, 'metal', { metalness: 0.6, roughness: 0.3 });
  const n = Math.max(2, Math.round(len / 0.6));
  for (let i = 0; i < n; i++) {
    const [hx, hz] = R(-len / 2 + (len * (i + 0.5)) / n, 0.32, ry);
    at(box(0.02, 0.5, 0.02), met, x + hx, tall * 0.48, z + hz, ry, { receive: false });
  }
}

/** Sliding-door wardrobe: two panels, one handle channel. Cheaper and, in a
 *  1.2 m-wide bedroom aisle, the only kind that opens. */
export function slidingWardrobe(K, s) {
  const { at, box, themedMat, h } = K;
  const { x, z, ry, room } = s;
  const len = s.len || 1.8;
  const tall = Math.min(s.h || 2.3, h - 0.3);
  at(box(len, tall, 0.6), themedMat(room, 'wood', { roughness: 0.42 }), x, tall / 2, z, ry);
  const met = themedMat(room, 'metal', { metalness: 0.6, roughness: 0.3 });
  // One leaf proud of the other — the offset IS the read.
  const [ax, az] = R(-len / 4, 0.315, ry);
  at(box(len / 2 - 0.01, tall - 0.06, 0.03), themedMat(room, 'stone', { roughness: 0.5 }),
    x + ax, tall / 2, z + az, ry, { receive: false });
  const [cx, cz] = R(0, 0.33, ry);
  at(box(0.02, tall - 0.12, 0.02), met, x + cx, tall / 2, z + cz, ry, { receive: false });
}

/** Bedside. */
export function nightstand(K, s) {
  const { at, box, themedMat } = K;
  const { x, z, ry, room } = s;
  at(box(0.44, 0.42, 0.4), themedMat(room, 'wood', { roughness: 0.45 }), x, 0.21, z, ry);
  at(box(0.2, 0.02, 0.2), themedMat(room, 'metal', { metalness: 0.55, roughness: 0.35 }),
    x, 0.44, z, ry, { receive: false });
}

/** Low unit with the television over it. */
export function tvUnit(K, s) {
  const { at, box, themedMat, staticMat } = K;
  const { x, z, ry, room } = s;
  const len = s.len || 1.7;
  at(box(len, 0.42, 0.4), themedMat(room, 'wood', { roughness: 0.42 }), x, 0.21, z, ry);
  const [sx, sz] = R(0, -0.1, ry);
  at(box(len * 0.74, 0.7, 0.05), staticMat('#1a1a1c', { roughness: 0.3, metalness: 0.4 }),
    x + sx, 1.12, z + sz, ry, { receive: false });
}

/** Open shelving — a room divider in a studio, a bookcase anywhere else. */
export function shelf(K, s) {
  const { at, box, themedMat } = K;
  const { x, z, ry, room } = s;
  const len = s.len || 0.9;
  const tall = s.h || 1.8;
  const wood = themedMat(room, 'wood', { roughness: 0.45 });
  const decks = Math.max(2, Math.round(tall / 0.42));
  for (let i = 0; i <= decks; i++) {
    at(box(len, 0.03, 0.32), wood, x, (tall * i) / decks, z, ry);
  }
  for (const dx of [-len / 2 + 0.015, len / 2 - 0.015]) {
    const [px, pz] = R(dx, 0, ry);
    at(box(0.03, tall, 0.32), wood, x + px, tall / 2, z + pz, ry);
  }
  // Books as blocks. Empty shelves read as a shop fitting.
  const acc = themedMat(room, 'accent', { roughness: 0.9 });
  const rug = themedMat(room, 'rug', { roughness: 0.9 });
  for (let i = 0; i < decks; i++) {
    const wdt = 0.1 + ((i * 7) % 3) * 0.06;
    const [bx, bz] = R(-len / 2 + 0.09 + ((i * 5) % 3) * 0.16, 0, ry);
    at(box(wdt, 0.24, 0.22), i % 2 ? acc : rug, x + bx, (tall * i) / decks + 0.135, z + bz,
      ry, { receive: false });
  }
}

/** Sideboard / credenza. */
export function sideboard(K, s) {
  const { at, box, themedMat } = K;
  const { x, z, ry, room } = s;
  const len = s.len || 1.4;
  at(box(len, 0.72, 0.42), themedMat(room, 'wood', { roughness: 0.42 }), x, 0.4, z, ry);
  const met = themedMat(room, 'metal', { metalness: 0.6, roughness: 0.3 });
  for (const off of [-len / 4, len / 4]) {
    const [hx, hz] = R(off, 0.22, ry);
    at(box(len / 3, 0.02, 0.02), met, x + hx, 0.6, z + hz, ry, { receive: false });
  }
}

/**
 * Shoe cabinet by the front door.
 *
 * Shoes come off at the threshold here, so this is where the entrance sequence
 * of every one of these units actually starts. The tour opens on the entry and
 * without it the first thing a viewer sees is an empty lobby.
 */
export function shoeCabinet(K, s) {
  const { at, box, themedMat } = K;
  const { x, z, ry, room } = s;
  const len = s.len || 0.8;
  const wood = themedMat(room, 'wood', { roughness: 0.45 });
  at(box(len, 0.95, 0.34), wood, x, 0.48, z, ry);
  const met = themedMat(room, 'metal', { metalness: 0.6, roughness: 0.3 });
  for (const y of [0.28, 0.6, 0.88]) {
    const [hx, hz] = R(0, 0.18, ry);
    at(box(len * 0.5, 0.015, 0.015), met, x + hx, y, z + hz, ry, { receive: false });
  }
  // A tray of keys on top, because a bare 0.95 m box is a plinth.
  at(box(0.2, 0.03, 0.14), themedMat(room, 'stone', { roughness: 0.5 }), x, 0.97, z, ry, { receive: false });
}

export const variants = { wardrobe, slidingWardrobe, nightstand, tvUnit, shelf, sideboard, shoeCabinet };
export const fallback = 'wardrobe';
