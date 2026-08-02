// =====================================================================
//  buildScene — the geometry a project walks through.
//
//  Two tiers meet here:
//    • a showroom unit key ('studio', 'one-bed', …) builds the parametric
//      apartment described in config/units.js;
//    • no key builds the original L-shaped loft below.
//
//  The loft is NOT dead code and must not be deleted: every project saved
//  before the showroom existed — including the ones in public/models and
//  anything a user has in the cloud — has camera waypoints authored against
//  its coordinates. Dropping it would silently reframe their work.
//
//  `builders` comes from createBuilders(); `THREE` is injected.
//  Returns handles the engine animates: { floorMat, ceils }.
// =====================================================================

import { buildApartment } from './apartment.js';
import { unitFor } from '../../config/units.js';

/**
 * @param {object} THREE
 * @param {object} builders
 * @param {string} [unitKey]  a showroom unit; anything unknown falls back to the loft
 */
export function buildScene(THREE, builders, unitKey) {
  const u = unitFor(unitKey);
  if (u) return buildApartment(THREE, builders, u.plan);
  return buildLoft(THREE, builders);
}

function buildLoft(THREE, builders) {
  const { box, cyl, add, W, themedMat, staticMat } = builders;
  const DS = THREE.DoubleSide;

  // ---- floor (L-shape: two slabs) ----
  const floorMat = new THREE.MeshPhysicalMaterial({
    color: '#bd9560', roughness: 0.46, metalness: 0.0, clearcoat: 0.55, clearcoatRoughness: 0.34,
  });
  add(box(10.2, 0.1, 14.2), floorMat, 0, -0.05, 2, { cast: false });
  add(box(14.2, 0.1, 20.2), floorMat, 12, -0.05, -5, { cast: false });

  // ---- walls ----
  const neutral = staticMat('#e7e1d5', { roughness: 1, side: DS });
  const neutral2 = staticMat('#ded7c9', { roughness: 1, side: DS });
  W(-5, 2, 14, 'z', themedMat(0, 'wall', { roughness: 0.96, side: DS }));
  W(0, -5, 10, 'x', neutral);
  W(-3.1, 9, 3.8, 'x', neutral);
  W(3.1, 9, 3.8, 'x', neutral);
  W(5, -3.5, 3, 'z', neutral);
  W(12, 5, 14, 'x', neutral);
  // Kitchen → bedroom. This used to be one unbroken 12 m plane, and the camera
  // path went straight through it: on screen that is a single frame of wall,
  // gone before you can name it, which is why nobody caught it by eye. The
  // opening goes EAST of the kitchen run (x 10.5–15.5) — putting it mid-wall
  // would have left a doorway standing behind a worktop and a splashback.
  const kitchenWall = themedMat(1, 'wall', { roughness: 0.96, side: DS });
  W(11.45, -5, 8.9, 'x', kitchenWall);
  W(18.35, -5, 1.3, 'x', kitchenWall);
  add(box(1.8, 1.2, 0.12), neutral, 16.8, 2.8, -5, { cast: false });
  W(12, -15, 14, 'x', themedMat(2, 'wall', { roughness: 0.96, side: DS }));
  W(19, -10, 10, 'z', neutral);
  W(5, -10, 10, 'z', neutral);

  // ---- door frame + window mullions ----
  const frame = staticMat('#2c2823', { roughness: 0.5, metalness: 0.25 });
  add(box(0.14, 2.5, 0.14), frame, -1.2, 1.25, 9, { receive: false });
  add(box(0.14, 2.5, 0.14), frame, 1.2, 1.25, 9, { receive: false });
  add(box(2.5, 0.14, 0.14), frame, 0, 2.5, 9, { receive: false });
  for (let z = -4; z <= 4; z += 1.5) add(box(0.08, 3.2, 0.08), frame, 18.95, 1.6, z, { receive: false });
  [0.4, 1.6, 2.9].forEach((y) => add(box(0.08, 0.08, 8.4), frame, 18.95, y, 0, { receive: false }));
  for (let x = 6; x <= 18; x += 2) add(box(0.07, 0.9, 0.07), frame, x, 2.85, -14.92, { receive: false });

  // ---- ceilings (hidden during the top-down intro) ----
  const ceils = [];
  ceils.push(add(box(10.2, 0.1, 14.2), neutral2, 0, 3.45, 2, { cast: false, receive: false }));
  ceils.push(add(box(14.2, 0.1, 20.2), neutral2, 12, 3.45, -5, { cast: false, receive: false }));

  // ---- LIVING (room 0) ----
  add(box(3.6, 0.04, 2.8), themedMat(0, 'rug', { roughness: 0.95 }), -2.3, 0.02, -1, { cast: false });
  add(box(0.95, 0.45, 2.7), themedMat(0, 'uph', { roughness: 0.85 }), -4.2, 0.32, -1);
  add(box(0.24, 0.6, 2.7), themedMat(0, 'uph', { roughness: 0.85 }), -4.6, 0.6, -1);
  add(box(0.95, 0.52, 0.24), themedMat(0, 'uph'), -4.2, 0.44, -2.32);
  add(box(0.95, 0.52, 0.24), themedMat(0, 'uph'), -4.2, 0.44, 0.32);
  add(box(0.2, 0.5, 0.55), themedMat(0, 'accent', { roughness: 0.85 }), -4.35, 0.66, -1.55);
  add(box(0.2, 0.5, 0.55), themedMat(0, 'accent', { roughness: 0.85 }), -4.35, 0.66, -0.45);
  add(box(0.75, 0.08, 1.35), themedMat(0, 'wood', { roughness: 0.45 }), -2.2, 0.42, -1);
  [[-0.3, -0.55], [0.3, -0.55], [-0.3, 0.55], [0.3, 0.55]].forEach(([dx, dz]) =>
    add(cyl(0.03, 0.03, 0.42), themedMat(0, 'metal', { roughness: 0.4, metalness: 0.6 }), -2.2 + dx, 0.21, -1 + dz));
  add(cyl(0.21, 0.23, 0.04), themedMat(0, 'metal', { metalness: 0.5, roughness: 0.4 }), -2.2, 0.48, -1);
  add(cyl(0.2, 0.16, 0.4), themedMat(0, 'wood', { roughness: 0.7 }), -3.9, 0.2, -3.7);
  add(new THREE.SphereGeometry(0.46, 18, 14), staticMat('#5d6b4f', { roughness: 1 }), -3.9, 0.86, -3.7);
  // Floor lamp. Moved 0.7 m off the old spot: its shade sits at 1.62 m, which is
  // eye height, and the camera curve passed straight through it on the way from
  // the living room to the kitchen. Nothing looked wrong in a still — you only
  // see it as a frame of pure lampshade mid-scroll.
  add(cyl(0.18, 0.2, 0.04), themedMat(0, 'metal', { metalness: 0.5, roughness: 0.4 }), 0.35, 0.04, -4.25);
  add(cyl(0.02, 0.02, 1.5), themedMat(0, 'metal', { metalness: 0.5, roughness: 0.4 }), 0.35, 0.78, -4.25);
  add(cyl(0.15, 0.23, 0.3), themedMat(0, 'accent', { roughness: 0.9 }), 0.35, 1.62, -4.25);
  add(new THREE.PlaneGeometry(0.95, 1.35), themedMat(0, 'accent', { roughness: 0.95 }), -4.92, 1.9, -1, { ry: Math.PI / 2, cast: false, receive: false });

  // ---- KITCHEN (room 1) ----
  add(box(3.0, 0.85, 1.3), themedMat(1, 'wood', { roughness: 0.5 }), 12, 0.45, 0.3);
  add(box(3.22, 0.08, 1.46), themedMat(1, 'stone', { roughness: 0.28, metalness: 0.05 }), 12, 0.91, 0.3);
  add(box(5.0, 0.85, 0.62), themedMat(1, 'wood', { roughness: 0.5 }), 13, 0.45, -4.4);
  add(box(5.2, 0.06, 0.72), themedMat(1, 'stone', { roughness: 0.28 }), 13, 0.9, -4.4);
  add(box(4.6, 0.7, 0.36), themedMat(1, 'wood', { roughness: 0.55 }), 13, 2.45, -4.55);
  add(new THREE.PlaneGeometry(5.0, 1.15), themedMat(1, 'accent', { roughness: 0.55, metalness: 0.12 }), 13, 1.55, -4.78, { cast: false, receive: false });
  for (let i = -1; i <= 1; i++) {
    add(cyl(0.22, 0.22, 0.06), themedMat(1, 'uph', { roughness: 0.8 }), 12 + i * 1.0, 0.62, 1.5);
    add(cyl(0.02, 0.02, 0.58), themedMat(1, 'metal', { metalness: 0.6, roughness: 0.4 }), 12 + i * 1.0, 0.31, 1.5);
  }
  [-0.85, 0.85].forEach((dx) => {
    add(cyl(0.012, 0.012, 0.85), staticMat('#26221d'), 12 + dx, 2.95, 0.3, { cast: false });
    const pm = themedMat(1, 'accent', { roughness: 0.4, metalness: 0.3 });
    pm.emissive = new THREE.Color('#3a2a18');
    pm.emissiveIntensity = 0.35;
    add(new THREE.SphereGeometry(0.16, 18, 14), pm, 12 + dx, 2.45, 0.3);
  });

  // ---- BEDROOM (room 2) ----
  add(box(4.2, 0.04, 3.4), themedMat(2, 'rug', { roughness: 0.95 }), 12, 0.02, -11.4, { cast: false });
  add(box(2.5, 0.32, 2.4), themedMat(2, 'wood', { roughness: 0.55 }), 12, 0.18, -12.4);
  add(box(2.35, 0.34, 2.25), themedMat(2, 'uph', { roughness: 0.92 }), 12, 0.46, -12.3);
  add(box(0.95, 0.2, 0.5), themedMat(2, 'accent', { roughness: 0.9 }), 11.45, 0.66, -13.2);
  add(box(0.95, 0.2, 0.5), themedMat(2, 'accent', { roughness: 0.9 }), 12.55, 0.66, -13.2);
  add(box(2.62, 1.2, 0.16), themedMat(2, 'uph', { roughness: 0.85 }), 12, 0.95, -13.62);
  [-1.65, 1.65].forEach((dx) => {
    add(box(0.6, 0.5, 0.45), themedMat(2, 'wood', { roughness: 0.45 }), 12 + dx, 0.25, -13.4);
    const lm = themedMat(2, 'metal', { metalness: 0.35, roughness: 0.5 });
    lm.emissive = new THREE.Color('#2a2012');
    lm.emissiveIntensity = 0.3;
    add(cyl(0.13, 0.17, 0.28), lm, 12 + dx, 0.64, -13.4);
  });
  add(box(0.55, 2.4, 1.8), themedMat(2, 'wood', { roughness: 0.5 }), 18.4, 1.2, -10);
  add(new THREE.PlaneGeometry(0.95, 1.35), themedMat(2, 'accent', { roughness: 0.95 }), 5.08, 1.7, -10, { ry: Math.PI / 2, cast: false, receive: false });

  return { floorMat, ceils };
}
