// Drifting dust motes in the light. Three.js injected.
// Returns { points, tick, fit } — call tick() each frame to animate.

/**
 * @param {object} THREE
 * @param {object} scene
 * @param {number} [count]
 * @param {object} [box]  THREE.Box3 to fill; defaults to the historic loft volume
 */
export function createParticles(THREE, scene, count = 520, box = null) {
  const pos = new Float32Array(count * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: '#fff4dc', size: 0.035, transparent: true, opacity: 0.5, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; // the buffer is rewritten in place; its bounds lie
  scene.add(points);

  // Volume the motes live in. Defaults to the loft's footprint, which is what
  // these numbers always were — hard-coded to one scene. In a 6.4 m studio that
  // scattered most of the dust outside the flat and thinned what was left to
  // nothing, so the one effect that says "there is air in this room" simply
  // stopped reading.
  let lo = { x: -5, y: 0.2, z: -15 };
  let span = { x: 24, y: 3.0, z: 24 };
  let ceiling = 3.4;

  const seed = () => {
    for (let i = 0; i < count; i++) {
      pos[i * 3] = lo.x + Math.random() * span.x;
      pos[i * 3 + 1] = lo.y + Math.random() * span.y;
      pos[i * 3 + 2] = lo.z + Math.random() * span.z;
    }
    geo.attributes.position.needsUpdate = true;
  };

  /** Re-seed into a new volume (called after the model is built or swapped). */
  const fit = (b) => {
    if (!b || b.isEmpty()) return;
    const min = b.min, max = b.max;
    lo = { x: min.x + 0.2, y: 0.2, z: min.z + 0.2 };
    span = {
      x: Math.max(1, max.x - min.x - 0.4),
      y: Math.max(1, Math.min(3.0, max.y - 0.4)),
      z: Math.max(1, max.z - min.z - 0.4),
    };
    ceiling = Math.max(1.4, Math.min(max.y - 0.15, lo.y + span.y + 0.4));
    seed();
  };

  seed();

  const tick = () => {
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += 0.0016;
      if (pos[i * 3 + 1] > ceiling) pos[i * 3 + 1] = lo.y;
      pos[i * 3] += Math.sin((pos[i * 3 + 1] + i) * 0.6) * 0.0008;
    }
    geo.attributes.position.needsUpdate = true;
  };

  return { points, tick, fit };
}
