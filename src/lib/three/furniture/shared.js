// =====================================================================
//  The kit every furniture variant is drawn with.
//
//  A variant is a plain function `(K, s) => void`:
//    K  this kit — primitives, materials, placement helpers, room height
//    s  the piece from the plan: { x, z, ry, room, …per-variant extras }
//
//  It never imports three, never touches the scene, and never reads global
//  state. That is what makes a variant reusable: `chair.plastic` draws the same
//  chair whether it is at a dining table in the 3BR or on the studio balcony,
//  and a unit that wants a different one changes a string.
//
//  AUTHORING CONVENTION, and it is load-bearing: every piece is drawn FACING
//  +z with its back at −z, centred on (0,0), then placed and turned by `ry`.
//  Offsets from the piece's own centre go through R() so they turn with it.
// =====================================================================

/**
 * Rotate a local offset (dx,dz) into world space by `ry`.
 *
 * This is three's Y-rotation, NOT the textbook 2D rotation matrix — they differ
 * by the sign of the angle, because +z→+x as ry grows. Getting it backwards
 * puts every pillow, splashback and mirror on the wrong side of its own
 * furniture the moment a piece is rotated off axis, and it looks plausible in
 * the one unit where everything happens to sit at ry = 0.
 */
export function R(dx, dz, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return [dx * c + dz * s, -dx * s + dz * c];
}

/**
 * @param {object} THREE
 * @param {object} builders  from createBuilders()
 * @param {{h:number}} env   room-scale facts a variant may need
 */
export function makeKit(THREE, builders, env) {
  const { box, cyl, add, themedMat, staticMat, group } = builders;
  const h = env.h;

  /** Place a geometry, rotated about Y. The workhorse: nearly every line is one. */
  const at = (g, mat, x, y, z, ry, o = {}) => add(g, mat, x, y, z, { ry, ...o });

  /**
   * A round leg standing on the floor, `hgt` tall.
   *
   * Ten sides, not the cylinder default of eighteen. A 24 mm leg is four pixels
   * across at walking distance and there are sixteen of them under one dining
   * set; at eighteen segments that is 1 152 triangles spent on something nobody
   * can resolve as round either way.
   */
  const leg = (mat, x, z, hgt, ry, r = 0.024) =>
    at(cyl(r, r, hgt, 10), mat, x, hgt / 2, z, ry, { receive: false });

  /** Four legs at the corners of a `w`×`d` top, inset by `in`. */
  const legs4 = (mat, x, z, ry, hgt, w, d, inset = 0.1, r = 0.024) => {
    for (const dx of [-w / 2 + inset, w / 2 - inset]) {
      for (const dz of [-d / 2 + inset, d / 2 - inset]) {
        const [lx, lz] = R(dx, dz, ry);
        leg(mat, x + lx, z + lz, hgt, ry, r);
      }
    }
  };

  /** Hang a shade from the ceiling, its top `drop` below it. Returns the shade's y. */
  const hang = (x, z, ry, shadeMat, drop) => {
    const y = h - drop;
    at(cyl(0.11, 0.13, 0.18, 16), shadeMat, x, y, z, ry, { receive: false });
    return y;
  };

  /** The flex from a hung shade up to the slab. */
  const flex = (x, z, ry, mat, y) =>
    at(box(0.012, h - y - 0.09, 0.012), mat, x, (y + 0.09 + h) / 2, z, ry, { receive: false });

  const sphere = (r, w = 14, hh = 12) => new THREE.SphereGeometry(r, w, hh);

  return {
    THREE, h, group,
    box, cyl, sphere, add, at, leg, legs4, hang, flex, R,
    themedMat, staticMat,
  };
}

/**
 * Normalise a plan entry into the shape a variant expects.
 * `ry` and `room` default rather than being checked in twenty places.
 */
export function spec(f) {
  return { ...f, x: f.x, z: f.z, ry: f.ry || 0, room: f.room || 0 };
}
