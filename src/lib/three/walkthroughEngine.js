// =====================================================================
//  WalkthroughEngine — headless orchestrator for the scroll-driven 3D
//  interior walkthrough. Three.js is INJECTED (constructor `THREE`), so the
//  same engine runs under any host: a Next.js client component, the DC demo,
//  plain HTML, etc.
//
//  The engine owns the scene, camera, render loop, scroll mapping and concept
//  tweening. It writes the few per-frame "fast" overlay bits (hero/panel/
//  progress/nav opacity) directly to DOM nodes you pass in, and emits "slow"
//  state (room/concept changes) through `onState` so a framework overlay can
//  re-render.
//
//  It does NOT author. Camera-path editing used to live here as a super-admin
//  overlay — a second renderer for a POV window, a fly camera, an axis gizmo,
//  a path ribbon with DOM badges. All of that is the editor's job now, and the
//  editor does it better because you can grab the camera in the model. Keeping
//  a second authoring surface on the page a client sees cost every visitor the
//  bundle and a per-frame DOM write per waypoint, to render nothing.
//
//  Perf: the shadow map is baked once (static scene) and the renderer only
//  draws while scrolling / tuning — idle costs 0 GPU, but the rAF loop stays
//  alive so it resumes instantly.
//
//  Lifecycle (one-shot per instance — the host builds a fresh engine + canvas
//  per project change):
//    const engine = new WalkthroughEngine({ THREE, canvas, refs, content, options, onState });
//    engine.init();                 // build + start
//    engine.dispose();              // full teardown
// =====================================================================

import { addLights, fitLights } from './lights.js';
import { createBuilders } from './builders.js';
import { buildScene } from './scene.js';
import { createParticles } from './particles.js';
import { buildCurves, roomAt, waypointScroll, roomAnchorIndex, clamp, smoothstep } from './cameraPath.js';
import { createPlanLabels } from '../dom/planLabels.js';
import { createHotspots } from '../dom/hotspots.js';
import { PAL_ROLES } from './contract.js';
import { parseGLB } from './glbLoader.js';

export class WalkthroughEngine {
  constructor({ THREE, canvas, refs = {}, content, options = {}, onState = null }) {
    this.THREE = THREE;
    this.canvas = canvas;
    this.refs = refs; // { planLayer, hotspotLayer, infoLayer, progressEl, heroEl, panelEl, navWrapEl }
    this.onState = onState;

    this.config = content.config;
    this.CONCEPTS = content.CONCEPTS;
    this.ROOMS = content.ROOMS;
    this.PLAN = content.PLAN;
    this.HOTSPOTS = content.HOTSPOTS.map((h) => ({ ...h }));
    this.ROOM_COLORS = content.ROOM_COLORS;
    this.DAYLIGHT = content.DAYLIGHT;

    this.options = { daylight: 'Soft', dust: true, reflections: true, ...options };

    // runtime state
    // Per-room concept selection. Restored from the bundle when present
    // (contract 1.1.0); otherwise the original round-robin default. Without this
    // a saved project reopened every room at the default scheme.
    this.concepts = Array.isArray(content.config && content.config.concepts)
      && content.config.concepts.length === this.ROOMS.length
      ? content.config.concepts.slice()
      : this.ROOMS.map((_, i) => i % this.CONCEPTS.length);
    this.currentRoom = 0;
    this.regList = [];
    this.smoothP = 0;
    this.targetP = 0;
    this.mouse = { x: 0, y: 0 };
    this.activeUntil = 0;
    this._alive = false;
    this._raf = 0;
    this._disposers = [];

    // 3D import/export state (see lib/three/contract.js)
    this._content = content;       // full project bundle content (incl BRAND)
    this.modelMeshes = [];         // primitive architecture meshes (hidden when a GLB is imported)
    this.importedModel = null;     // currently imported glTF root, if any (truthy ⇒ primitives hidden)
  }

  // ---------- small helpers ----------
  maxScroll() {
    const se = document.scrollingElement || document.documentElement;
    return Math.max(1, se.scrollHeight - se.clientHeight);
  }
  invalidate(ms) { this.activeUntil = performance.now() + (ms || 250); }
  // scene.js builds a FIXED three-room shell, but the contract allows a project to
  // declare 1..64 rooms. A 1-room bundle used to throw here ("Cannot read
  // properties of undefined (reading 'pal')") and the whole engine failed to build.
  // Clamp instead: the primitives are a fallback that gets hidden the moment a
  // model is imported, so degrading is correct — crashing is not.
  colorOf(room, role) {
    const r = Math.min(Math.max(room | 0, 0), this.concepts.length - 1);
    const ci = Math.min(Math.max(this.concepts[r] | 0, 0), this.CONCEPTS.length - 1);
    return this.CONCEPTS[ci].pal[role];
  }

  /**
   * Bounding box of whatever is currently standing in for the architecture —
   * the primitives, or the imported model that replaced them.
   */
  modelBounds() {
    const T = this.THREE;
    const box = new T.Box3();
    if (this.importedModel) box.setFromObject(this.importedModel);
    else this.modelMeshes.filter((m) => !m.userData.context).forEach((m) => box.expandByObject(m));
    return box;
  }

  /** Re-aim the light rig and re-seed the dust for the current model. */
  refitToModel() {
    const box = this.modelBounds();
    fitLights(this.THREE, { sun: this.sun, fill: this.fill }, box);
    if (this.particles && this.particles.fit) this.particles.fit(box);
    this.shadowDirty = true;
  }

  emitState() {
    if (!this.onState) return;
    const cr = this.currentRoom;
    const sel = this.concepts[cr];
    this.onState({
      currentRoom: cr,
      concepts: this.concepts.slice(),
      conceptName: this.CONCEPTS[sel].name,
      roomName: (this.ROOMS[cr] || this.ROOMS[0]).name,
      // padStart, not '0' + n: the contract allows up to 64 rooms and
      // '0' + 10 renders as "010".
      roomNum: String(cr + 1).padStart(2, '0'),
      roomTotal: String(this.ROOMS.length).padStart(2, '0'),
    });
  }

  // ---------- public API ----------
  goRoom(i) {
    const idx = roomAnchorIndex(this.config.waypoints, i);
    window.scrollTo({ top: waypointScroll(this.config, idx) * this.maxScroll(), behavior: 'smooth' });
  }

  chooseConcept(ci) {
    const room = this.currentRoom;
    const pal = this.CONCEPTS[ci].pal;
    this.regList.forEach((e) => { if (e.room === room) e.mat.userData.target.set(pal[e.role]); });
    this.concepts[room] = ci;
    this.invalidate(1400);
    this.emitState();
  }

  setOptions(patch) {
    Object.assign(this.options, patch);
    this.applyOptions();
  }

  applyOptions() {
    const p = this.DAYLIGHT[this.options.daylight] || this.DAYLIGHT.Soft;
    if (this.sun) { this.sun.intensity = p.sun; this.sun.color.set(p.sunC); }
    if (this.hemi) this.hemi.intensity = p.hemi;
    if (this.scene) { this.scene.background.set(p.bg); if (this.scene.fog) this.scene.fog.color.set(p.bg); }
    if (this.renderer) this.renderer.toneMappingExposure = p.exp;
    if (this.particles) this.particles.points.visible = this.options.dust !== false;
    if (this.floorMat) {
      this.floorMat.clearcoat = this.options.reflections === false ? 0.0 : 0.55;
      this.floorMat.needsUpdate = true;
    }
    this.shadowDirty = true; // re-bake shadow once on lighting change
    this.invalidate(120);
  }

  // ---------- build ----------
  // One-shot per instance: the React host constructs a fresh engine (and a fresh
  // canvas) for every project change, so there is no re-init path.
  init() {
    const T = this.THREE;
    this._alive = true;

    // At >=1.5 DPR the supersampling already hides aliasing, so MSAA is wasted
    // fragment work; cap the ratio at 1.5 to keep mid-scroll frames cheap.
    const dpr = window.devicePixelRatio || 1;
    const renderer = new T.WebGLRenderer({ canvas: this.canvas, antialias: dpr < 1.5 });
    renderer.setPixelRatio(Math.min(dpr, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    this.renderer = renderer;

    const scene = new T.Scene();
    scene.background = new T.Color('#e9e3d8');
    scene.fog = new T.Fog('#e9e3d8', 30, 92);
    this.scene = scene;

    const camera = new T.PerspectiveCamera(this.config.fov, window.innerWidth / window.innerHeight, 0.1, 260);
    this.camera = camera;

    const lights = addLights(T, scene);
    this.sun = lights.sun;
    this.hemi = lights.hemi;
    this.fill = lights.fill;

    // geometry
    const builders = createBuilders(T, scene, {
      getColor: (room, role) => this.colorOf(room, role),
      register: (entry) => this.regList.push(entry),
      onMesh: (m) => this.modelMeshes.push(m),
    });
    // config.unit selects a showroom apartment; absent (or unknown) keeps the
    // legacy loft, which is what every pre-showroom saved project expects.
    const built = buildScene(T, builders, this.config.unit);
    this.floorMat = built.floorMat;
    this.ceils = built.ceils;
    this.particles = createParticles(T, scene);
    // Aim the rig and scatter the dust inside THIS model, whatever size it is.
    this.refitToModel();

    // camera path
    const curves = buildCurves(T, this.config.waypoints);
    this.posCurve = curves.posCurve;
    this.lookCurve = curves.lookCurve;

    this.introPos = new T.Vector3().fromArray(this.config.intro.pos);
    this.introLook = new T.Vector3().fromArray(this.config.intro.look);

    // DOM overlays
    if (this.refs.planLayer) this.planLabels = createPlanLabels(this.refs.planLayer, this.PLAN);
    if (this.refs.hotspotLayer && this.refs.infoLayer) {
      this.hotspotCtl = createHotspots(this.refs.hotspotLayer, this.refs.infoLayer, this.HOTSPOTS, () => this.invalidate(60));
    }

    this.bindEvents();

    // bake shadow once then freeze
    renderer.render(scene, camera);
    renderer.shadowMap.autoUpdate = false;

    this.applyOptions();
    this.emitState();
    this.kickLoop();
  }

  // ---------- loop control ----------
  kickLoop() {
    if (!this._loop) this._loop = () => this.frame();
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(this._loop);
  }

  // ---------- events ----------
  bindEvents() {
    const onResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.invalidate(120);
    };
    const onMouse = (e) => {
      this.mouse.x = e.clientX / window.innerWidth - 0.5;
      this.mouse.y = e.clientY / window.innerHeight - 0.5;
      this.invalidate(500);
    };
    // Scroll drives the walk; update fast UI synchronously so it works even
    // when <body> is the scroller (window 'scroll' may not fire) or rAF is
    // throttled. The loop also polls scrollTop as a backstop.
    const onScroll = () => {
      const se = document.scrollingElement || document.documentElement;
      const p = clamp(se.scrollTop / this.maxScroll(), 0, 1);
      this.targetP = p;
      this.updateUI(p);
      this.invalidate(450);
      this.kickLoop();
    };
    const onVis = () => { if (!document.hidden) this.kickLoop(); };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouse);
    document.addEventListener('visibilitychange', onVis);
    this._disposers.push(
      () => window.removeEventListener('scroll', onScroll),
      () => document.removeEventListener('scroll', onScroll, { capture: true }),
      () => window.removeEventListener('resize', onResize),
      () => window.removeEventListener('mousemove', onMouse),
      () => document.removeEventListener('visibilitychange', onVis)
    );
  }

  updateUI(p) {
    const INTRO = this.config.introFraction;
    const r = this.refs;
    if (r.heroEl) {
      const o = clamp(1 - p / 0.05, 0, 1);
      r.heroEl.style.opacity = o;
      r.heroEl.style.pointerEvents = o > 0.1 ? 'auto' : 'none';
    }
    if (r.panelEl) r.panelEl.style.opacity = p < 0.06 ? '0' : '1';
    if (r.progressEl) r.progressEl.style.transform = 'scaleX(' + p + ')';
    const q2 = clamp((p - INTRO) / (1 - INTRO), 0, 1);
    const room = roomAt(this.config.waypoints, q2);
    if (room !== this.currentRoom) {
      this.currentRoom = room;
      if (this.hotspotCtl) {
        const a = this.hotspotCtl.getActive();
        if (a && a.room !== room) this.hotspotCtl.setActive(null);
      }
      this.emitState();
    }
  }

  frame() {
    if (!this._alive) return;
    this._raf = requestAnimationFrame(this._loop);
    const T = this.THREE;
    const INTRO = this.config.introFraction;
    const se = document.scrollingElement || document.documentElement;
    this.targetP = se.scrollTop / this.maxScroll();
    this.smoothP += (this.targetP - this.smoothP) * 0.07;
    const p = clamp(this.smoothP, 0, 1);
    const moving = Math.abs(this.targetP - this.smoothP) > 0.0002;
    const active = moving || performance.now() < this.activeUntil || this.shadowDirty;
    if (!active) return; // render-on-demand: idle = 0 GPU

    const cam = this.camera;
    const cP = this._cP || (this._cP = new T.Vector3());
    const cL = this._cL || (this._cL = new T.Vector3());
    const tmp = this._tmp || (this._tmp = new T.Vector3());

    let par;
    if (p < INTRO) {
      const e = smoothstep(p / INTRO);
      cP.lerpVectors(this.introPos, this.posCurve.getPoint(0), e);
      cL.lerpVectors(this.introLook, this.lookCurve.getPoint(0), e);
      par = e;
    } else {
      const q = (p - INTRO) / (1 - INTRO);
      cP.copy(this.posCurve.getPoint(q));
      cL.copy(this.lookCurve.getPoint(q));
      par = 1;
    }
    cam.position.set(cP.x + this.mouse.x * 0.5 * par, cP.y + this.mouse.y * 0.3 * par, cP.z);
    cam.lookAt(cL.x + this.mouse.x * 1.1 * par, cL.y + this.mouse.y * 0.6 * par, cL.z);
    if (cam.fov !== this.config.fov) { cam.fov = this.config.fov; cam.updateProjectionMatrix(); }

    const showCeil = this.importedModel ? false : p > 0.075;
    for (let i = 0; i < this.ceils.length; i++) this.ceils[i].visible = showCeil;

    this.updateUI(this.targetP);

    // concept tween
    let tweening = false;
    for (let i = 0; i < this.regList.length; i++) {
      const m = this.regList[i].mat;
      m.color.lerp(m.userData.target, 0.06);
      if (!tweening && m.color.getHex() !== m.userData.target.getHex()) tweening = true;
    }
    if (tweening) this.invalidate(120);

    // Invisible dust still cost a 520-iteration loop and a buffer upload every
    // frame. Turning the effect off should turn the work off with it.
    if (this.particles.points.visible) this.particles.tick();

    const w = window.innerWidth, h = window.innerHeight;

    // plan labels
    if (this.planLabels) {
      const planO = clamp(1 - p / 0.07, 0, 1);
      this.planLabels.forEach((pl) => {
        tmp.set(pl.x, 0.05, pl.z).project(cam);
        pl.el.style.opacity = tmp.z < 1 && planO > 0.01 ? planO : 0;
        pl.el.style.left = (tmp.x * 0.5 + 0.5) * w + 'px';
        pl.el.style.top = (-tmp.y * 0.5 + 0.5) * h + 'px';
      });
    }

    // hotspots
    if (this.hotspotCtl) {
      const info = this.refs.infoLayer;
      const active = this.hotspotCtl.getActive();
      this.hotspotCtl.hotspots.forEach((hs) => {
        tmp.set(hs.x, hs.y, hs.z).project(cam);
        // y was never bounded: hotspots above/below the viewport stayed
        // opacity:1 and clickable, just positioned off-screen.
        const onScreen = tmp.z < 1 && tmp.x > -1.1 && tmp.x < 1.1 && tmp.y > -1.1 && tmp.y < 1.1;
        const show = onScreen && hs.room === this.currentRoom && p > INTRO;
        hs.el.style.opacity = show ? '1' : '0';
        hs.el.style.pointerEvents = show ? 'auto' : 'none';
        const sx = (tmp.x * 0.5 + 0.5) * w, sy = (-tmp.y * 0.5 + 0.5) * h;
        hs.el.style.left = sx + 'px';
        hs.el.style.top = sy + 'px';
        if (active === hs && show) {
          info.style.display = 'block';
          info.style.left = clamp(sx + 18, 12, w - 250) + 'px';
          info.style.top = clamp(sy - 30, 12, h - 130) + 'px';
        } else if (active === hs && !show) info.style.display = 'none';
      });
    }

    if (this.shadowDirty) { this.renderer.shadowMap.needsUpdate = true; this.shadowDirty = false; }
    this.renderer.render(this.scene, cam);
  }

  // ---------- 3D model import / export (see lib/three/contract.js) ----------
  // Snapshot the live project (the 8 contract PROJECT_KEYS) as plain data.
  // The host wraps this with buildBundle() before download.
  exportProject() {
    // true snapshot (deep clone) — safe no matter how the caller uses it
    return JSON.parse(JSON.stringify({
      // live camera path + fov + which concept each
      // room is currently showing, so reopening restores what you saw
      config: { ...this.config, concepts: this.concepts.slice() },
      CONCEPTS: this._content.CONCEPTS,
      ROOMS: this._content.ROOMS,
      PLAN: this._content.PLAN,
      HOTSPOTS: this.HOTSPOTS.map(({ el, ...h }) => h), // strip the DOM node createHotspots attaches
      ROOM_COLORS: this._content.ROOM_COLORS,
      DAYLIGHT: this._content.DAYLIGHT,
      BRAND: this._content.BRAND,
    }));
  }

  // Export the live scene as a binary glTF (.glb). Dust and scene markers
  // are hidden first so only the architecture+model exports (onlyVisible).
  async exportGLB() {
    const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
    const hidden = [];
    const hide = (o) => { if (o && o.visible) { o.visible = false; hidden.push(o); } };
    // frame() re-asserts overlay visibility every tick. Without this flag a
    // mouse move during the await turns them back on mid-export and the path ribbon
    // and camera markers end up baked into the user's .glb.
    this._exporting = true;
    hide(this.particles && this.particles.points);
    try {
      return await new GLTFExporter().parseAsync(this.scene, { binary: true, onlyVisible: true });
    } finally {
      this._exporting = false;
      hidden.forEach((o) => { o.visible = true; });
      this.invalidate(120);
    }
  }

  // Import a .glb/.gltf ArrayBuffer: add it to the scene and hide the primitive
  // architecture so the imported model takes its place. glTF is DATA, not code.
  async importGLB(arrayBuffer) {
    const T = this.THREE;
    // Shared loader: Draco + KTX2 + meshopt attached, resource path '' so glTF
    // never resolves an external URI. See lib/three/glbLoader.js.
    const gltf = await parseGLB(arrayBuffer, T, this.renderer);
    if (this.importedModel) { this.scene.remove(this.importedModel); this._disposeTree(this.importedModel); }
    this.regList = this.regList.filter((e) => !e.imported); // drop a prior import's themed mats
    const root = gltf.scene;
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      // opt-in concept theming: tag a mesh with userData = { room, role }
      const room = o.userData && o.userData.room;
      const role = o.userData && o.userData.role;
      if (Number.isInteger(room) && room >= 0 && room < this.ROOMS.length && PAL_ROLES.includes(role) && o.material && o.material.color) {
        const mat = o.material.clone(); // own copy so shared glTF materials don't collide in regList
        o.material = mat;
        const col = this.colorOf(room, role);
        mat.color.set(col);
        mat.userData = mat.userData || {};
        mat.userData.target = new T.Color(col);
        this.regList.push({ mat, room, role, imported: true });
      }
    });
    this.scene.add(root);
    this.importedModel = root;
    this.modelMeshes.forEach((m) => { m.visible = false; });
    // The imported model is a different size and in a different place from the
    // primitives it replaces, so the rig has to follow it. Without this an
    // imported .glb was lit by a sun aimed at the built-in loft.
    this.refitToModel();
    this.invalidate(400);
  }

  // Drop the imported model and restore the primitive architecture.
  clearImportedModel() {
    if (this.importedModel) { this.scene.remove(this.importedModel); this._disposeTree(this.importedModel); this.importedModel = null; }
    this.regList = this.regList.filter((e) => !e.imported);
    this.modelMeshes.forEach((m) => { m.visible = true; });
    this.refitToModel();
    this.invalidate(400);
  }

  _disposeTree(root) {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
  }

  // ---------- teardown ----------
  // The host builds a fresh engine per project change, so every allocation made
  // in init() has to go here. Previously only the renderers were released: all the
  // scene geometry/materials and the particle buffer
  // stayed alive on the CPU side until the whole engine happened to be collected.
  dispose() {
    this._alive = false;
    this._exporting = false;
    cancelAnimationFrame(this._raf);
    this._disposers.forEach((d) => { try { d(); } catch (e) { /* listener already gone */ } });
    this._disposers = [];

    if (this.refs.planLayer) this.refs.planLayer.innerHTML = '';
    if (this.refs.hotspotLayer) this.refs.hotspotLayer.innerHTML = '';
    if (this.refs.infoLayer) this.refs.infoLayer.style.display = 'none';

    // one walk of the graph frees geometry + materials + textures for everything
    // ever added to the scene, imported model included
    if (this.scene) this._disposeTree(this.scene);
    if (this.particles && this.particles.points) {
      const pts = this.particles.points;
      if (pts.geometry) pts.geometry.dispose();
      if (pts.material) pts.material.dispose();
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss && this.renderer.forceContextLoss();
      this.renderer = null;
    }

    // drop the references that would otherwise pin the whole graph
    this.scene = null;
    this.camera = null;
    this.importedModel = null;
    this.modelMeshes = [];
    this.regList = [];
    this.particles = null;
    this.hotspotCtl = null;
    this.planCtl = null;
  }
}

export default WalkthroughEngine;
