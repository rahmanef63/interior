// Lighting rig for the walkthrough. Three.js is injected (never imported)
// so this module is bundler-agnostic and reusable in any host.
//
// Returns the handles the engine needs to re-tune lighting for daylight
// presets (sun + hemisphere) and to re-aim the rig at whatever is on stage.

export function addLights(THREE, scene) {
  const hemi = new THREE.HemisphereLight('#fbf4e6', '#574f42', 0.52);
  scene.add(hemi);

  scene.add(new THREE.AmbientLight('#ffffff', 0.16));

  const fill = new THREE.DirectionalLight('#dfe6ef', 0.28);
  fill.position.set(-12, 9, 14);
  scene.add(fill);

  const sun = new THREE.DirectionalLight('#fff1da', 2.2);
  sun.position.set(34, 19, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.radius = 4;
  const sc = sun.shadow.camera;
  sc.left = -28;
  sc.right = 28;
  sc.top = 24;
  sc.bottom = -22;
  sc.near = 1;
  sc.far = 96;
  sun.target.position.set(11, 0, -3);
  scene.add(sun.target);
  scene.add(sun);

  return { sun, hemi, fill };
}

/**
 * Point the rig at what is actually on stage.
 *
 * The numbers above were measured against one specific scene: an L-shaped loft
 * roughly 24 m across. They stayed put when the showroom arrived, so a 6.4 m
 * studio was lit by a sun aimed at (11, 0, -3) — a point outside the flat —
 * through a shadow frustum 56 m wide. A 2048² map spread over 56 m leaves the
 * studio a few dozen texels of its own, which is why its shadows read as
 * smudges instead of window light. The same applies, harder, to an imported
 * .glb of any size: the rig had no idea the model had changed.
 *
 * Fitting costs one Box3 over the meshes and runs on build and on every import,
 * so the rig follows the subject instead of the subject having to be built
 * where the rig happens to point.
 *
 * @param {object} THREE
 * @param {{sun: object, fill?: object}} rig
 * @param {object} box  THREE.Box3 around the visible model
 */
export function fitLights(THREE, rig, box) {
  if (!box || box.isEmpty()) return;
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  // The sun rakes across the floor, so the horizontal extent is what the
  // frustum has to cover; height only contributes a little slack.
  const r = Math.max(2.5, 0.5 * Math.hypot(size.x, size.z) + size.y * 0.25);

  const { sun, fill } = rig;
  sun.target.position.set(centre.x, 0, centre.z);
  sun.target.updateMatrixWorld();
  // The DIRECTION is kept from the original rig — high, from the east-south-east
  // — because every scene was art-directed for that light. Only the distance and
  // the frustum scale with the subject.
  sun.position.set(centre.x + r * 1.55, r * 1.05, centre.z + r * 0.35);
  const sc = sun.shadow.camera;
  sc.left = -r * 1.2;
  sc.right = r * 1.2;
  sc.top = r * 1.2;
  sc.bottom = -r * 1.2;
  sc.near = Math.max(0.5, r * 0.2);
  sc.far = r * 4.5;
  sc.updateProjectionMatrix();

  if (fill) fill.position.set(centre.x - r * 1.2, r * 0.8, centre.z + r * 1.3);
}
