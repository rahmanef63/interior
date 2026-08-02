// Camera-path helpers built from config.waypoints. Three.js injected.

export function buildCurves(THREE, waypoints) {
  const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  return {
    posCurve: new THREE.CatmullRomCurve3(waypoints.map((w) => V(w.pos))),
    lookCurve: new THREE.CatmullRomCurve3(waypoints.map((w) => V(w.look))),
  };
}

// Which room a normalized path position q∈[0,1] falls in (nearest waypoint).
export function roomAt(waypoints, q) {
  const N = waypoints.length;
  const idx = Math.max(0, Math.min(N - 1, Math.round(q * (N - 1))));
  return waypoints[idx].room;
}

// Scroll fraction (0..1 of the whole page) that frames waypoint i.
export function waypointScroll(config, i) {
  const q = i / (config.waypoints.length - 1);
  return config.introFraction + q * (1 - config.introFraction);
}

// Middle waypoint index of a given room — a settled framing for room nav.
export function roomAnchorIndex(waypoints, room) {
  const same = waypoints.map((w, k) => (w.room === room ? k : -1)).filter((k) => k >= 0);
  if (!same.length) return 0;
  return same[Math.floor(same.length / 2)];
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smoothstep = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
