// Measure every camera path against the actual geometry.
//
// "The framing looks off" is not something you can fix by eye from a screenshot,
// because the tour only ever shows you one waypoint at a time and the bad ones
// are the ones you scroll past. This walks every waypoint of every showroom
// unit, casts rays, and reports what the frame contains and how much room the
// camera has around it.
//
// Runs in plain Node — no browser, no WebGL. three's Raycaster works on geometry
// alone, so the scene builder can be exercised headlessly.
//
//   node scripts/audit-path.mjs                 # every unit + the legacy loft
//   node scripts/audit-path.mjs --unit=two-bed  # just one
//   node scripts/audit-path.mjs --suggest       # propose fixes for the flagged ones
//
// Four numbers matter:
//   • dist  — centre-ray hit distance. Under ~2.5 m the frame is filled by one
//     surface, which is what "staring at a wall" looks like from the seat.
//   • pitch — a look vector aimed steeply down or up reads as a stumble.
//   • subj  — distinct meshes hit by a fan of rays across the frame. This is the
//     one that catches the failure distance misses: a shot can sit a comfortable
//     4 m from its target and still be a blank wall, because *nothing else is in
//     view*. Counting how many different things the frame touches is a better
//     proxy for "is there anything to look at" than any single centre ray.
//   • clr   — horizontal clearance around the eye. An apartment is not a loft:
//     at 2.5 m between a sofa and a partition, a waypoint that reads fine on
//     paper can put the camera inside the furniture.
//
// And one whole-path check the per-waypoint numbers cannot see: the camera does
// not travel in straight lines between waypoints, it rides a Catmull-Rom, which
// overshoots on the outside of every turn. In a 6 m studio that overshoot is the
// difference between rounding a corner and passing through the wardrobe. The
// sweep samples the real curve and reports its tightest squeeze.
import * as THREE from 'three';
import { createBuilders } from '../src/lib/three/builders.js';
import { buildScene } from '../src/lib/three/scene.js';
import { config as loftConfig, CONCEPTS, ROOMS as loftRooms } from '../src/config/walkthrough.config.js';
import { UNITS } from '../src/config/units.js';

// Re-calibrated when the showroom moved to Indonesian unit sizes. 2.5 m was a
// proxy tuned against a 24 m loft; in a 24 m² studio every honest sightline is
// shorter than that, and the check started failing rooms for being the size
// they are. Below 1.6 m you are genuinely nose-to-surface. The metric that
// actually catches a blank frame is `subjects`, which is scale-free — this one
// was always the crude backstop.
const NEAR = 1.6;
const IDEAL = 4.0;  // a comfortable interior sightline
const FLAT = 3;     // fewer distinct things than this across the whole frame = blank
const DOMINANT = 0.6; // one object filling more of the frame than this = a surface, not a room
const CLEAR = 0.5;  // metres of elbow room a standing camera needs
// A 0.9 m doorway gives a dead-centre camera 0.45 m and a real one nearer 0.2,
// so the sweep cannot demand what CLEAR demands. Below this the camera is not
// threading an opening, it is inside a wall.
const SWEEP_CLEAR = 0.12;
const SWEEP_SNUG = 0.3;  // reported, not failed: worth a human's eye

const only = (process.argv.find((a) => a.startsWith('--unit=')) || '').split('=')[1];
const wantSuggest = process.argv.includes('--suggest');

/** Build one scene headlessly and return the pieces the audit needs. */
function build(unitKey) {
  const scene = new THREE.Scene();
  const meshes = [];
  const builders = createBuilders(THREE, scene, {
    getColor: (room, role) => CONCEPTS[room % CONCEPTS.length].pal[role] || '#888888',
    register: () => {},
    onMesh: (m) => meshes.push(m),
  });
  buildScene(THREE, builders, unitKey);
  scene.updateMatrixWorld(true);
  return { scene, meshes, ray: new THREE.Raycaster() };
}

/**
 * How many distinct meshes a 5x3 fan across the frame touches.
 * Half-angles are the real ones: 25° horizontal is a 50° fov, and the vertical
 * half-angle follows from a 16:9 frame.
 */
function subjectsInFrame(ctx, pos, dir) {
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().copy(dir).cross(up).normalize();
  const trueUp = new THREE.Vector3().copy(right).cross(dir).normalize();
  const tally = new Map();
  let n = 0;
  for (const yaw of [-0.38, -0.19, 0, 0.19, 0.38]) {
    for (const pitch of [-0.2, 0, 0.2]) {
      const d = dir.clone()
        .applyAxisAngle(trueUp, -yaw)
        .applyAxisAngle(right, pitch)
        .normalize();
      ctx.ray.set(pos, d);
      const h = ctx.ray.intersectObjects(ctx.meshes, false).find((x) => x.distance > 0.05);
      n++;
      if (h) tally.set(h.object.uuid, (tally.get(h.object.uuid) || 0) + 1);
    }
  }
  // Dominance: the share of the frame taken by the single largest thing in it.
  //
  // Counting DISTINCT meshes stopped being enough once the units got small. A
  // camera 2.4 m from a 2 m kitchen run reports five subjects — counter,
  // splashback, upper cabinets, tap, wall — and passes, while the frame is 70%
  // worktop and reads as standing with your nose on it. Distance cannot catch
  // that either: 2.4 m is a normal distance in a 43 m² flat.
  let top = 0;
  for (const c of tally.values()) top = Math.max(top, c);
  return { subjects: tally.size, dominance: top / n };
}

/**
 * Nearest obstruction in the horizontal plane at eye height.
 * Without this the search happily parks the camera 13.4 m out on x — which, in
 * the loft, is the kitchen's far wall.
 */
function clearance(ctx, pos) {
  let min = Infinity;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    ctx.ray.set(pos, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
    const h = ctx.ray.intersectObjects(ctx.meshes, false).find((x) => x.distance > 0.02);
    if (h) min = Math.min(min, h.distance);
  }
  return min;
}

/**
 * Walk the Catmull-Rom the engine actually flies and find its tightest point.
 * Sampled at ~5 cm; the waist height is used rather than eye height because a
 * curve that clips a worktop still clips.
 */
function sweep(ctx, waypoints) {
  const curve = new THREE.CatmullRomCurve3(waypoints.map((w) => new THREE.Vector3().fromArray(w.pos)));
  const n = Math.max(120, Math.round(curve.getLength() / 0.05));
  let worst = { clr: Infinity, at: 0, pos: null };
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPoint(t);
    const clr = clearance(ctx, p);
    if (clr < worst.clr) worst = { clr, at: t, pos: p };
  }
  return worst;
}

function auditOne({ label, unitKey, waypoints, rooms }) {
  const ctx = build(unitKey);
  const rows = waypoints.map((w, i) => {
    const pos = new THREE.Vector3().fromArray(w.pos);
    const look = new THREE.Vector3().fromArray(w.look);
    const dir = look.clone().sub(pos);
    const planar = Math.hypot(dir.x, dir.z);
    const pitch = (Math.atan2(dir.y, planar) * 180) / Math.PI;
    ctx.ray.set(pos, dir.clone().normalize());
    // Glass does not block a view. Counting a windowpane as the thing the shot
    // "hits" reported a wall at half a metre for every waypoint standing at a
    // balcony door — the one place in the unit with the longest sightline in it.
    const hit = ctx.ray.intersectObjects(ctx.meshes, false)
      .find((h) => h.distance > 0.05 && !(h.object.material && h.object.material.transparent));
    return {
      i,
      room: w.room,
      roomName: (rooms[w.room] || { name: '?' }).name,
      dist: hit ? hit.distance : Infinity,
      pitch,
      clr: clearance(ctx, pos),
      // A threshold shot is deliberately inside a 0.9 m opening. Exempting it
      // beats loosening CLEAR for everyone: the tight ones that matter are the
      // waypoints standing in a sofa, and those must keep failing.
      door: !!w.door,
      ...subjectsInFrame(ctx, pos, dir.clone().normalize()),
    };
  });

  const bad = rows.filter((r) => r.dist < NEAR);
  const flat = rows.filter((r) => r.subjects < FLAT || r.dominance > DOMINANT);
  const steep = rows.filter((r) => Math.abs(r.pitch) > 14);
  const tight = rows.filter((r) => r.clr < CLEAR && !r.door);
  const worst = sweep(ctx, waypoints);

  console.log(`\n  ${label}  (${ctx.meshes.length} meshes)`);
  console.log('   #  room               dist    pitch    clr   subj  dom   verdict');
  console.log('  ' + '─'.repeat(70));
  for (const r of rows) {
    const d = r.dist === Infinity ? '  ∞  ' : r.dist.toFixed(2).padStart(5);
    const verdict = r.dist < NEAR ? 'WALL'
      : r.clr < CLEAR && !r.door ? 'TIGHT'
        : r.subjects < FLAT ? 'FLAT'
          : r.dominance > DOMINANT ? 'ONE-THING'
            : Math.abs(r.pitch) > 14 ? 'steep'
            : r.door ? 'threshold'
              : r.dist < IDEAL ? 'close' : 'ok';
    console.log(
      `  ${String(r.i).padStart(2)}  ${r.roomName.padEnd(17)} ${d} m ${r.pitch.toFixed(1).padStart(6)}°  ${r.clr.toFixed(2).padStart(5)}  ${String(r.subjects).padStart(3)}  ${(r.dominance * 100).toFixed(0).padStart(3)}%  ${verdict}`
    );
  }
  const finite = rows.filter((r) => r.dist !== Infinity).map((r) => r.dist);
  const mean = finite.reduce((a, b) => a + b, 0) / (finite.length || 1);
  console.log('  ' + '─'.repeat(70));
  console.log(
    `  wall ${bad.length}  ·  blank ${flat.length}  ·  steep ${steep.length}  ·  tight ${tight.length}`
    + `  ·  mean ${mean.toFixed(2)} m / ${(rows.reduce((a, r) => a + r.subjects, 0) / rows.length).toFixed(1)} subj`
  );
  const sweepBad = worst.clr < SWEEP_CLEAR;
  console.log(
    `  curve sweep      : tightest ${worst.clr.toFixed(2)} m at t=${worst.at.toFixed(3)}`
    + ` (${worst.pos.toArray().map((v) => v.toFixed(2)).join(', ')})`
    + (sweepBad ? '   ← the flight path clips geometry'
      : worst.clr < SWEEP_SNUG ? '   (snug — a doorway, if that is where it is)' : '')
  );

  if (wantSuggest) suggest(ctx, waypoints, rows);
  return { fails: bad.length + flat.length + tight.length + (sweepBad ? 1 : 0) };
}

// ---------------------------------------------------------------------------
// `--suggest`: local search for better framing on the flagged waypoints.
//
// Guessing coordinates by eye is how the bad ones got there. This keeps the
// path's SHAPE — the eye may drift at most `POS_R` metres and stays at head
// height — and only hunts for a look direction that puts more of the room in
// frame at a sane distance. It prints candidates; a human still decides.
function suggest(ctx, waypoints, rows) {
  const POS_R = 0.9;
  const targets = rows.filter((r) => r.dist < NEAR || r.subjects < FLAT || r.dominance > DOMINANT
    || r.clr < CLEAR || Math.abs(r.pitch) > 14);
  if (!targets.length) return;

  /**
   * Direction of travel through this waypoint. A shot that scores well by facing
   * BACK down the path is not a better shot — the tour is a walk, and turning
   * round mid-corridor reads as a mistake, however much furniture it frames.
   */
  const travelAt = (i) => {
    const a = waypoints[Math.max(0, i - 1)].pos;
    const b = waypoints[Math.min(waypoints.length - 1, i + 1)].pos;
    const v = new THREE.Vector3(b[0] - a[0], 0, b[2] - a[2]);
    return v.lengthSq() < 1e-6 ? null : v.normalize();
  };

  // Ideal sightline scaled to the unit. Asking a 43 m² flat for the 5.5 m shot
  // that suited a 24 m loft just moves the camera into a corner to buy distance
  // the plan does not contain.
  const bb = new THREE.Box3();
  ctx.meshes.forEach((m) => bb.expandByObject(m));
  const sz = bb.getSize(new THREE.Vector3());
  const span = Math.max(3, Math.hypot(Math.min(sz.x, 24), Math.min(sz.z, 24)) * 0.45);
  const score = (dist, subjects, pitch, dominance) => {
    if (dist < NEAR) return -1e6;
    if (dominance > DOMINANT) return -1e5;
    const d = dist === Infinity ? span : dist;
    return subjects * 100 - Math.abs(Math.min(d, span * 1.6) - span) * 6 - Math.abs(pitch) * 1.5;
  };

  console.log('  ── suggestions ───────────────────────────────────────────────');
  for (const r of targets) {
    const w = waypoints[r.i];
    const base = new THREE.Vector3().fromArray(w.pos);
    const baseDir = new THREE.Vector3().fromArray(w.look).sub(base).normalize();
    const travel = travelAt(r.i);
    let best = null;

    for (const dx of [-POS_R, -0.6, -0.3, 0, 0.3, 0.6, POS_R]) {
      for (const dz of [-POS_R, -0.6, -0.3, 0, 0.3, 0.6, POS_R]) {
        const pos = base.clone().add(new THREE.Vector3(dx, 0, dz));
        if (clearance(ctx, pos) < CLEAR + 0.05) continue; // standing in a wall
        for (const yaw of [-1.2, -0.9, -0.6, -0.35, -0.15, 0, 0.15, 0.35, 0.6, 0.9, 1.2]) {
          for (const drop of [-0.05, 0, 0.06, 0.12, 0.18]) {
            const dir = baseDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
            dir.y = -drop;
            dir.normalize();
            // Keep facing broadly the way the walk is going.
            if (travel && new THREE.Vector3(dir.x, 0, dir.z).normalize().dot(travel) < 0.1) continue;
            ctx.ray.set(pos, dir);
            const h = ctx.ray.intersectObjects(ctx.meshes, false).find((x) => x.distance > 0.05);
            const dist = h ? h.distance : Infinity;
            const pitch = (Math.atan2(dir.y, Math.hypot(dir.x, dir.z)) * 180) / Math.PI;
            const { subjects: subj, dominance: dom } = subjectsInFrame(ctx, pos, dir);
            const sc = score(dist, subj, pitch, dom);
            if (!best || sc > best.sc) {
              const at = Math.min(dist === Infinity ? 8 : dist * 0.92, 9);
              best = { sc, pos, look: pos.clone().addScaledVector(dir, at), dist, subj, pitch, dom };
            }
          }
        }
      }
    }
    if (!best) { console.log(`  #${r.i}  no candidate clears ${CLEAR} m — the plan itself is too tight here`); continue; }
    const f = (v) => [v.x, v.y, v.z].map((n) => Math.round(n * 100) / 100);
    console.log(
      `  #${r.i}  was dist ${r.dist === Infinity ? '∞' : r.dist.toFixed(2)} subj ${r.subjects} dom ${(r.dominance * 100).toFixed(0)}%`
      + `  ->  dist ${best.dist === Infinity ? '∞' : best.dist.toFixed(2)} subj ${best.subj} dom ${(best.dom * 100).toFixed(0)}% pitch ${best.pitch.toFixed(1)}°`
    );
    console.log(`      { pos: [${f(best.pos)}], look: [${f(best.look)}], room: ${w.room} },`);
  }
  console.log('');
}

const jobs = [];
for (const u of UNITS) {
  if (only && only !== u.key) continue;
  jobs.push({ label: `${u.name} · ${u.area} m² (${u.key})`, unitKey: u.key, waypoints: u.content.config.waypoints, rooms: u.content.ROOMS });
}
// The loft still ships every pre-showroom saved project, so it stays audited.
if (!only || only === 'loft') {
  jobs.push({ label: 'The Loft (legacy scene)', unitKey: undefined, waypoints: loftConfig.waypoints, rooms: loftRooms });
}

let fails = 0;
for (const job of jobs) fails += auditOne(job).fails;
console.log(`\n  ${fails === 0 ? 'all paths clean' : fails + ' problem(s) across ' + jobs.length + ' path(s)'}\n`);
process.exit(fails ? 1 : 0);
