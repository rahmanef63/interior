// Primitive factory shared by the scene builder. Three.js is injected.
//
// `ctx` wires the builders to engine state:
//   ctx.getColor(room, role) -> hex string for the room's current concept
//   ctx.register({ mat, room, role })  -> records a themed material so the
//        engine can tween it when a concept switches.
//   ctx.onMesh(mesh)                   -> every mesh that lands in the scene
//
// Returned helpers:
//   box, cyl            geometry shortcuts (cached — see below)
//   add(geo, mat, x,y,z, opts)   mesh + place + shadow flags
//   W(cx,cz,len,axis,mat,h)      a wall plane (axis 'x' faces ±z, 'z' faces ±x)
//   themedMat(room, role, opts)  concept-driven material (auto-registered)
//   staticMat(color, opts)       fixed material
//   group(label, fn)             merge what fn() draws — see below
//
// ── why there are caches and a merge step here ──────────────────────────────
//
// A three-bedroom unit was 199 meshes, 199 geometries and 71 materials for
// 4 100 triangles. Nothing about that is geometry-bound: it is a scene whose
// cost is entirely per-object — a draw call, a buffer bind and a uniform
// refresh each, for objects averaging twenty triangles. The counters worth
// moving are the object count and the material count, not the vertex count.
//
//   • Geometries are cached by their dimensions. A dining table's four legs, a
//     balcony's twenty-seven balusters and a window's mullions were each
//     allocating their own BoxGeometry for the same box.
//   • Materials are cached by (room, role, options). `themedMat(2,'wood',…)`
//     was called thirty times in a bedroom and returned thirty materials that
//     were identical, all of which the concept tween then had to animate
//     separately.
//   • group() merges. Everything drawn inside one group that shares a material
//     and its shadow flags becomes ONE mesh. A dining table with four chairs is
//     13 boxes and comes out as 2 objects.
//
// Merging is scoped to one named object on purpose, never scene-wide. The path
// audit measures how many distinct things a frame contains and how much of it
// one of them takes; merging every wall in the unit into a single mesh would
// make those numbers meaningless. Merging one railing into one railing makes
// them more honest.

export function createBuilders(THREE, scene, ctx) {
  // ---- material cache ----------------------------------------------------
  // Keyed by everything that distinguishes one material from another. Safe
  // because nothing mutates a material per-mesh: the only writes are the
  // concept tween (which sets the same colour for the same room+role) and the
  // loft's two emissive lamps, which apply identical values to identical keys.
  const mats = new Map();

  const themedMat = (room, role, o = {}) => {
    const key = `t|${room}|${role}|${sig(o)}`;
    const hit = mats.get(key);
    if (hit) return hit;
    const c = ctx.getColor(room, role);
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7, metalness: 0.0 }, o));
    m.userData.target = new THREE.Color(c);
    ctx.register({ mat: m, room, role });
    mats.set(key, m);
    return m;
  };

  const staticMat = (c, o = {}) => {
    const key = `s|${c}|${sig(o)}`;
    const hit = mats.get(key);
    if (hit) return hit;
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6, metalness: 0.0 }, o));
    mats.set(key, m);
    return m;
  };

  // ---- geometry cache ----------------------------------------------------
  // Dimensions rounded to a tenth of a millimetre: two boxes that differ by a
  // float rounding error are the same box.
  const geos = new Map();
  const k = (n) => Math.round(n * 10000) / 10000;
  const cached = (key, make) => {
    let g = geos.get(key);
    if (!g) { g = make(); geos.set(key, g); }
    return g;
  };

  const box = (w, h, d) => cached(`b|${k(w)}|${k(h)}|${k(d)}`, () => new THREE.BoxGeometry(w, h, d));
  const cyl = (r1, r2, h, s = 18) =>
    cached(`c|${k(r1)}|${k(r2)}|${k(h)}|${s}`, () => new THREE.CylinderGeometry(r1, r2, h, s));

  // ---- placement ---------------------------------------------------------
  // While a group is open, meshes are collected instead of added: they have to
  // all exist before we know which of them can be merged.
  let pending = null;

  const add = (geo, mat, x, y, z, opts = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = opts.cast !== false;
    m.receiveShadow = opts.receive !== false;
    if (opts.ry) m.rotation.y = opts.ry;
    if (opts.rx) m.rotation.x = opts.rx;
    // `context` marks scenery that is NOT the model: the ground far below and
    // the neighbouring towers. It still has to be raycastable — that is the
    // whole point of putting a view out of the window — but anything that asks
    // "how big is this model" must ignore it, or a 24 m² studio measures 620 m
    // across and every fit, every shadow frustum and every dust cloud is sized
    // for a city block.
    if (opts.context) m.userData.context = true;
    if (pending) { pending.push(m); return m; }
    scene.add(m);
    if (ctx.onMesh) ctx.onMesh(m);
    return m;
  };

  /**
   * Draw one object and merge its parts.
   *
   * Everything `fn` adds that shares a material AND its shadow flags comes out
   * as a single mesh named `label`. Parts that are alone in their bucket are
   * added unchanged, so a one-mesh object costs nothing extra.
   *
   * Caveat worth knowing before using the return value of add() inside a group:
   * the mesh you get back may not be the mesh that ends up in the scene. Draw
   * things you need a handle on (the floor, the ceilings) outside any group.
   */
  const group = (label, fn) => {
    if (pending) { fn(); return; }   // no nesting: the outer group owns the merge
    pending = [];
    let list;
    try { fn(); } finally { list = pending; pending = null; }

    const buckets = new Map();
    for (const m of list) {
      const key = `${m.material.uuid}|${m.castShadow ? 1 : 0}|${m.receiveShadow ? 1 : 0}|${m.userData.context ? 1 : 0}`;
      const b = buckets.get(key);
      if (b) b.push(m); else buckets.set(key, [m]);
    }

    for (const parts of buckets.values()) {
      if (parts.length === 1) {
        scene.add(parts[0]);
        if (ctx.onMesh) ctx.onMesh(parts[0]);
        continue;
      }
      const merged = new THREE.Mesh(weld(THREE, parts), parts[0].material);
      merged.castShadow = parts[0].castShadow;
      merged.receiveShadow = parts[0].receiveShadow;
      if (parts[0].userData.context) merged.userData.context = true;
      merged.userData.part = label;
      merged.name = label;
      scene.add(merged);
      if (ctx.onMesh) ctx.onMesh(merged);
    }
  };

  const W = (cx, cz, len, axis, mat, h) => {
    h = h || 3.4;
    const m = new THREE.Mesh(cached(`p|${k(len)}|${k(h)}`, () => new THREE.PlaneGeometry(len, h)), mat);
    m.position.set(cx, h / 2, cz);
    if (axis === 'z') m.rotation.y = Math.PI / 2;
    m.receiveShadow = true;
    m.castShadow = false;
    scene.add(m);
    if (ctx.onMesh) ctx.onMesh(m);
    return m;
  };

  return { THREE, box, cyl, add, W, themedMat, staticMat, group };
}

/** Stable signature for a material options object. */
function sig(o) {
  const keys = Object.keys(o).sort();
  let s = '';
  for (const key of keys) s += `${key}:${o[key]}|`;
  return s;
}

/**
 * Bake a list of meshes into one geometry.
 *
 * Hand-rolled rather than pulled from BufferGeometryUtils, because builders.js
 * takes three by injection — importing an examples/jsm module here would put a
 * second, statically-bundled copy of three next to the injected one. It is also
 * a narrower problem than the general merge: every geometry these builders make
 * is indexed and has exactly position, normal and uv.
 */
function weld(THREE, meshes) {
  let verts = 0, indices = 0;
  const baked = [];
  for (const m of meshes) {
    m.updateMatrix();
    const g = m.geometry.clone().applyMatrix4(m.matrix);   // clone: the source is shared
    baked.push(g);
    verts += g.attributes.position.count;
    indices += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(verts * 3);
  const nor = new Float32Array(verts * 3);
  const uv = new Float32Array(verts * 2);
  const idx = verts > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);

  let vo = 0, io = 0;
  for (const g of baked) {
    const p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv;
    pos.set(p.array, vo * 3);
    if (n) nor.set(n.array, vo * 3);
    if (t) uv.set(t.array, vo * 2);
    if (g.index) {
      const a = g.index.array;
      for (let i = 0; i < a.length; i++) idx[io + i] = a[i] + vo;
      io += a.length;
    } else {
      for (let i = 0; i < p.count; i++) idx[io + i] = vo + i;
      io += p.count;
    }
    vo += p.count;
    g.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}
