// =====================================================================
//  probe-shot — what is actually in a frame.
//
//    node scripts/probe-shot.mjs <unit> "x,y,z / lx,ly,lz" ["…" …]
//    node scripts/probe-shot.mjs studio "1.05,1.6,4.92 / 2.6,1.15,7.3"
//
//  Prints the 5x3 ray fan the path audit uses, naming the object each ray hits
//  and how far away it is, then the same subjects / dominance / clearance
//  numbers `npm run audit:path` reports.
//
//  The audit tells you a shot is bad. This tells you WHY — which is the
//  difference between re-aiming a camera in one go and re-aiming it eleven
//  times. It was written after merging made the audit honest about the
//  walk-out-onto-the-balcony shots: three rows of sky and one of decking,
//  which the numbers alone could not have explained.
// =====================================================================

import * as THREE from 'three';
import { createBuilders } from '../src/lib/three/builders.js';
import { buildScene } from '../src/lib/three/scene.js';
import { UNITS } from '../src/config/units.js';
import { CONCEPTS } from '../src/config/walkthrough.config.js';

const unitKey = process.argv[2];
const scene = new THREE.Scene(); const meshes = [];
const builders = createBuilders(THREE, scene, {
  getColor: (r, role) => CONCEPTS[r % CONCEPTS.length].pal[role] || '#888',
  register: () => {}, onMesh: (m) => meshes.push(m),
});
buildScene(THREE, builders, unitKey);
scene.updateMatrixWorld(true);
const ray = new THREE.Raycaster();
const name = (o) => o.userData.part || o.name || `${o.geometry.type}@${o.position.toArray().map(v=>v.toFixed(1)).join(',')}`;

function shot(pos, look, verbose) {
  const p = new THREE.Vector3().fromArray(pos);
  const dir = new THREE.Vector3().fromArray(look).sub(p).normalize();
  const up = new THREE.Vector3(0,1,0);
  const right = new THREE.Vector3().copy(dir).cross(up).normalize();
  const trueUp = new THREE.Vector3().copy(right).cross(dir).normalize();
  const tally = new Map(); let n = 0; const rows = [];
  for (const pitch of [0.2, 0, -0.2]) {
    const row = [];
    for (const yaw of [-0.38,-0.19,0,0.19,0.38]) {
      const d = dir.clone().applyAxisAngle(trueUp, -yaw).applyAxisAngle(right, pitch).normalize();
      ray.set(p, d);
      const h = ray.intersectObjects(meshes, false).find(x => x.distance > 0.05);
      n++;
      if (h) tally.set(h.object.uuid, (tally.get(h.object.uuid)||0)+1);
      row.push(h ? `${name(h.object)}@${h.distance.toFixed(1)}` : '—sky—');
    }
    rows.push(row);
  }
  let top = 0; for (const c of tally.values()) top = Math.max(top, c);
  // clearance
  let clr = Infinity;
  for (let a=0;a<Math.PI*2;a+=Math.PI/8) {
    ray.set(p, new THREE.Vector3(Math.cos(a),0,Math.sin(a)));
    const h = ray.intersectObjects(meshes,false).find(x=>x.distance>0.02);
    if (h) clr = Math.min(clr, h.distance);
  }
  const pitchDeg = Math.asin(dir.y) * 180 / Math.PI;
  if (verbose) rows.forEach(r => console.log('   ', r.map(s=>s.padEnd(24)).join('')));
  return { subj: tally.size, dom: top/n, clr, pitch: pitchDeg };
}

for (const line of process.argv.slice(3)) {
  const [pos, look] = line.split('/').map(s => s.trim().split(',').map(Number));
  const r = shot(pos, look, true);
  console.log(`  [${pos}] -> [${look}]  subj ${r.subj}  dom ${(r.dom*100).toFixed(0)}%  clr ${r.clr.toFixed(2)}  pitch ${r.pitch.toFixed(1)}°\n`);
}
