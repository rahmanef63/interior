// Rugs. Flat, 2 cm proud of the slab, never casting.
//
// A rug is the cheapest thing in the kit and does the most work: it is what
// tells you where a room's edges are when there is no wall between the living
// area and the dining area, which in an open-plan 33 m² unit is most of them.

/** Rectangle. The default. */
export function rectangle(K, s) {
  K.at(K.box(s.w || 2.4, 0.02, s.d || 1.7), K.themedMat(s.room, 'rug', { roughness: 0.96 }),
    s.x, 0.015, s.z, s.ry, { cast: false });
}

/** Runner — a corridor, or the strip beside a bed. */
export function runner(K, s) {
  rectangle(K, { ...s, w: s.w || 0.8, d: s.d || 2.2 });
}

/** Round. */
export function round(K, s) {
  const r = s.r || 1.0;
  K.at(K.cyl(r, r, 0.02, 32), K.themedMat(s.room, 'rug', { roughness: 0.96 }),
    s.x, 0.015, s.z, s.ry, { cast: false });
}

/**
 * A woven mat (tikar) — the one you unroll to sit on the floor.
 *
 * Different role from a rug on purpose: it takes the 'stone' colour, which in
 * every concept is the pale neutral, because a pandan mat is straw-coloured and
 * a rug that changed with the palette would be a rug.
 */
export function mat(K, s) {
  K.at(K.box(s.w || 1.6, 0.014, s.d || 1.1), K.themedMat(s.room, 'stone', { roughness: 1 }),
    s.x, 0.012, s.z, s.ry, { cast: false });
}

export const variants = { rectangle, runner, round, mat };
export const fallback = 'rectangle';
