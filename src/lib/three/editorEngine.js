// Editor viewport engine — the "Edit" half of Edit / Present.
//
// Deliberately NOT an extension of WalkthroughEngine. That engine's whole state
// machine is the page scroll: `maxScroll()`, `introFraction`, a 720dvh body. An
// editor has a fixed viewport and a camera the user drives directly. Trying to
// serve both from one class means every method starts with "if editing". They
// share what is actually shared — the scene builders, the lights, the GLB
// loader, the project contract — and nothing else.
//
// What this adds over a plain viewer, all of it aimed at the SketchUp/AutoCAD
// muscle memory an architect already has:
//
//   • a ground grid and coloured world axes, so "which way is north" is answered
//     before the first drag;
//   • camera Scenes drawn IN the model as numbered markers with a look direction,
//     because a camera you cannot see is a camera you cannot adjust;
//   • render-on-demand — an empty viewport costs nothing, which is what lets the
//     whole thing stay responsive on the laptop an architect actually carries.

import { addLights, fitLights } from './lights.js';
import { createBuilders } from './builders.js';
import { buildScene } from './scene.js';
import { parseGLB } from './glbLoader.js';
import { SketchupControls, TOOLS } from './sketchupControls.js';

const PAL_ROLES = ['wall', 'rug', 'uph', 'wood', 'accent', 'metal', 'stone'];

/** Idle frames still cost a rAF; stop the loop when nothing is moving. */
const IDLE_AFTER_MS = 220;

export class EditorEngine {
  /**
   * @param {object} o
   * @param {object} o.THREE
   * @param {HTMLCanvasElement} o.canvas
   * @param {HTMLElement} o.viewport  sized element the canvas fills
   * @param {object} o.content        the 8 contract keys (config, CONCEPTS, ...)
   * @param {object} [o.options]      { daylight, scheme, grid, markers }
   * @param {Function} [o.onState]    mirrors "slow" state into React
   * @param {Function} [o.onDirty]    project data changed (not camera/tool)
   */
  constructor({ THREE, canvas, viewport, content, options = {}, onState = null, onDirty = null }) {
    this.THREE = THREE;
    this.canvas = canvas;
    this.viewport = viewport || canvas.parentElement;
    this.onState = onState;
    // Fired only when PROJECT DATA changes — not when the camera moves or a tool
    // is picked. "Unsaved changes" has to mean something a save would actually
    // persist, or the warning becomes noise the user learns to click through.
    this.onDirty = onDirty;

    // Cloned, not referenced. Anything the editor can CHANGE has to be its own
    // copy: `content` is the object the host holds in React state and hands to
    // other engines, and mutating it in place edits a project the user has not
    // saved yet — including, before this, the built-in showroom units, whose
    // hotspots would then follow you into the next unit you opened.
    const clone = (v, fallback) => JSON.parse(JSON.stringify(v === undefined ? fallback : v));
    this.config = clone(content.config);
    this.CONCEPTS = content.CONCEPTS;
    this.ROOMS = clone(content.ROOMS, []);
    this.HOTSPOTS = clone(content.HOTSPOTS, []);
    this.PLAN = clone(content.PLAN, []);
    this.ROOM_COLORS = content.ROOM_COLORS || ['#c2592b'];
    this.DAYLIGHT = content.DAYLIGHT;
    this.BRAND = clone(content.BRAND, {});

    this.options = Object.assign(
      { daylight: 'Soft', scheme: 'sketchup', grid: true, markers: true },
      options
    );

    this.concepts = this.ROOMS.map((_, i) => i % this.CONCEPTS.length);
    this.regList = [];
    this.modelMeshes = [];
    this.importedModel = null;
    this.selScene = 0;
    this.selHotspot = -1;   // -1 = none; hotspots are edited one at a time
    this.tool = TOOLS.ORBIT;

    this._alive = false;
    this._activeUntil = 0;
    this._lastFrame = 0;
    this._raf = 0;
  }

  // ------------------------------------------------------------------ build

  init() {
    const T = this.THREE;
    this._alive = true;

    const dpr = window.devicePixelRatio || 1;
    const renderer = new T.WebGLRenderer({ canvas: this.canvas, antialias: dpr < 1.5 });
    renderer.setPixelRatio(Math.min(dpr, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    this.renderer = renderer;

    const scene = new T.Scene();
    scene.background = new T.Color('#e9e3d8');
    this.scene = scene;

    const camera = new T.PerspectiveCamera(this.config.fov || 50, 1, 0.05, 400);
    this.camera = camera;

    const lights = addLights(T, scene);
    this.sun = lights.sun;
    this.hemi = lights.hemi;
    this.fill = lights.fill;

    const builders = createBuilders(T, scene, {
      getColor: (room, role) => this.colorOf(room, role),
      register: (e) => this.regList.push(e),
      onMesh: (m) => this.modelMeshes.push(m),
    });
    const built = buildScene(T, builders, this.config.unit);
    this.floorMat = built.floorMat;
    this.ceils = built.ceils;
    // Ceilings are drawn for the walkthrough's interior shots; in an editor they
    // are a lid over everything you are trying to look at. SketchUp users expect
    // to look down into a plan, so they start hidden and are toggleable.
    this.ceilsVisible = false;
    this.ceils.forEach((c) => { c.visible = false; });
    this.refitLights();

    this._buildHelpers();
    this._buildSceneMarkers();

    this.controls = new SketchupControls(T, camera, this.canvas, {
      getPickables: () => this._pickables(),
      getSelectables: () => this._selectables(),
      onChange: () => this.invalidate(),
      onPick: (hit) => this._handlePick(hit),
      onPlace: (pt) => this.controls.placeCameraAt(pt),
      grab: (e) => this._grabHandle(e),
      scheme: this.options.scheme,
    });

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();

    // Open on the first Scene if there is one, otherwise a three-quarter view of
    // the whole model — never at the origin looking at nothing.
    if (this.config.waypoints.length) this.controls.setShot(this.config.waypoints[0], false);
    else this.controls.standardView('iso', this.modelBox());

    this.applyOptions();
    renderer.render(scene, camera);
    renderer.shadowMap.autoUpdate = false;
    this.emitState();
    this.invalidate(600);
    this._kick();
  }

  /** Grid + world axes, the two things SketchUp puts on screen before anything else. */
  _buildHelpers() {
    const T = this.THREE;
    const g = new T.Group();
    g.name = '__helpers';

    const grid = new T.GridHelper(80, 80, 0x8a8172, 0xc9c1b2);
    grid.material.transparent = true;
    grid.material.opacity = 0.5;
    grid.position.y = -0.002; // under the floor slab, so it never z-fights
    g.add(grid);

    // Red = X, green = Y, blue = Z: the convention SketchUp, AutoCAD, Blender and
    // three all share. Drawn as lines rather than AxesHelper so they can be long
    // and thin without the helper's fixed size.
    const axis = (a, b, hex) => {
      const geo = new T.BufferGeometry().setFromPoints([a, b]);
      return new T.Line(geo, new T.LineBasicMaterial({ color: hex }));
    };
    const L = 26;
    g.add(axis(new T.Vector3(-L, 0, 0), new T.Vector3(L, 0, 0), 0xc2592b));
    g.add(axis(new T.Vector3(0, 0, -L), new T.Vector3(0, 0, L), 0x3f6f52));
    g.add(axis(new T.Vector3(0, 0, 0), new T.Vector3(0, 6, 0), 0x3a5f8a));

    this.helpers = g;
    this.grid = grid;
    this.scene.add(g);
  }

  /**
   * One marker per Scene: a small cone pointing the way the camera looks, plus a
   * stalk down to the floor so its height reads at a glance. Rebuilt wholesale on
   * change — a dozen cones is nothing, and incremental updates would be a source
   * of desync between the list and the viewport.
   */
  _buildSceneMarkers() {
    const T = this.THREE;
    if (this.markers) {
      this.scene.remove(this.markers);
      this._disposeTree(this.markers);
    }
    const g = new T.Group();
    g.name = '__sceneMarkers';
    const cone = new T.ConeGeometry(0.17, 0.5, 14);
    cone.rotateX(-Math.PI / 2); // point down -Z, which is where a camera looks

    this.config.waypoints.forEach((w, i) => {
      const sel = i === this.selScene;
      const color = sel ? 0xc2592b : 0x6b6357;
      const m = new T.Mesh(cone, new T.MeshBasicMaterial({ color }));
      m.position.fromArray(w.pos);
      m.lookAt(new T.Vector3().fromArray(w.look));
      m.userData.sceneIndex = i;
      m.renderOrder = 3;
      g.add(m);

      const stalk = new T.Line(
        new T.BufferGeometry().setFromPoints([
          new T.Vector3(w.pos[0], 0, w.pos[2]),
          new T.Vector3(w.pos[0], w.pos[1], w.pos[2]),
        ]),
        new T.LineBasicMaterial({ color, transparent: true, opacity: sel ? 0.9 : 0.45 })
      );
      g.add(stalk);
    });

    // The path itself, so the order of the Scenes is visible in the model.
    if (this.config.waypoints.length > 1) {
      const pts = this.config.waypoints.map((w) => new T.Vector3().fromArray(w.pos));
      const curve = new T.CatmullRomCurve3(pts);
      g.add(new T.Line(
        new T.BufferGeometry().setFromPoints(curve.getPoints(Math.max(24, pts.length * 12))),
        new T.LineDashedMaterial({ color: 0xc2592b, dashSize: 0.28, gapSize: 0.2, transparent: true, opacity: 0.75 })
      ).computeLineDistances());
    }

    // Handles for the SELECTED scene: one ball on the eye, one on the point it
    // is aimed at, and a sight line between them.
    //
    // This is the whole of "tune camera", moved out of the tour and into the
    // model where it belongs. Before this the only ways to set a shot were to
    // fly the viewport and press Update, or to type numbers into a panel that
    // lived on /tour behind a super-admin check. Neither is what an architect
    // does with a camera: they grab it and point it.
    //
    // Two handles rather than a six-arrow gizmo, because a walkthrough camera
    // has exactly two degrees of freedom that matter — where you stand and what
    // you are looking at. Roll is not one of them, and an axis gizmo would let
    // you set it by accident.
    const w = this.config.waypoints[this.selScene];
    if (w) {
      const hg = new T.Group();
      hg.name = '__camHandles';
      const ball = (pos, hex, r, kind) => {
        const m = new T.Mesh(
          new T.SphereGeometry(r, 18, 14),
          new T.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.9, depthTest: false })
        );
        m.position.copy(pos);
        m.renderOrder = 6; // over the model: a handle you cannot see is not a handle
        m.userData.handle = kind;
        hg.add(m);
        return m;
      };
      const eye = new T.Vector3().fromArray(w.pos);
      const aim = new T.Vector3().fromArray(w.look);
      ball(eye, 0xc2592b, 0.16, 'eye');
      ball(aim, 0x3a5f8a, 0.13, 'aim');
      const line = new T.Line(
        new T.BufferGeometry().setFromPoints([eye, aim]),
        new T.LineDashedMaterial({ color: 0x3a5f8a, dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: 0.8, depthTest: false })
      );
      line.computeLineDistances();
      line.renderOrder = 5;
      hg.add(line);
      g.add(hg);
      this.camHandles = hg;
    } else {
      this.camHandles = null;
    }

    // Hotspots: the material callouts a visitor taps on the tour. They shipped
    // with every unit and there was no way to move one, rename one or add one —
    // import your own model and you inherited labels pinned to furniture that is
    // no longer there. Same handle grammar as the camera so there is one gesture
    // to learn: click to select, drag to move, Shift-drag for height.
    const hs = new T.Group();
    hs.name = '__hotspots';
    this.HOTSPOTS.forEach((h, i) => {
      const on = i === this.selHotspot;
      const m = new T.Mesh(
        new T.SphereGeometry(on ? 0.15 : 0.11, 16, 12),
        new T.MeshBasicMaterial({ color: on ? 0xb8560f : 0x6b6357, transparent: true, opacity: on ? 0.95 : 0.6, depthTest: !on })
      );
      m.position.set(h.x, h.y, h.z);
      m.renderOrder = on ? 6 : 4;
      m.userData.hotspotIndex = i;
      if (on) m.userData.handle = 'hotspot';
      hs.add(m);
      // A ring on the floor under it: without one you cannot tell a hotspot
      // floating at 1 m from one sunk into the floor behind a sofa.
      const ring = new T.Line(
        new T.BufferGeometry().setFromPoints([
          new T.Vector3(h.x, 0.01, h.z), new T.Vector3(h.x, h.y, h.z),
        ]),
        new T.LineBasicMaterial({ color: on ? 0xb8560f : 0x6b6357, transparent: true, opacity: on ? 0.8 : 0.3 })
      );
      hs.add(ring);
    });
    g.add(hs);
    this.hotspotMarkers = hs;

    g.visible = this.options.markers !== false;
    this.markers = g;
    this.scene.add(g);
  }

  /**
   * Pointer-down hook for SketchupControls: if a camera handle is under the
   * cursor, take the drag.
   *
   * Plain drag moves in the horizontal plane through the handle; Shift moves it
   * vertically. Constraining with Shift is the same reflex SketchUp trains, and
   * it beats a third handle: height is the one axis you adjust deliberately, and
   * a free 3D drag would change it every time you nudged sideways.
   *
   * Dragging the EYE carries the aim point with it, so walking the camera along
   * a corridor keeps it pointing the way it was pointing. Dragging the AIM turns
   * the camera on the spot. Those two gestures are the whole camera.
   */
  _grabHandle(e) {
    if (!this.markers || !this.markers.visible) return null;
    const T = this.THREE;
    const w = this.config.waypoints[this.selScene];
    const ray = new T.Raycaster();
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new T.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    ray.setFromCamera(ndc, this.camera);
    const targets = [];
    if (this.camHandles && w) targets.push(...this.camHandles.children);
    if (this.hotspotMarkers) targets.push(...this.hotspotMarkers.children);
    const hit = ray.intersectObjects(targets, false).find((h) => h.object.userData.handle);
    if (!hit) return null;

    const kind = hit.object.userData.handle;
    if (kind !== 'hotspot' && !w) return null;
    const start = hit.object.position.clone();
    const eye0 = w ? new T.Vector3().fromArray(w.pos) : new T.Vector3();
    const aim0 = w ? new T.Vector3().fromArray(w.look) : new T.Vector3();
    const vertical = e.shiftKey;

    // Horizontal drag: a ground-parallel plane through the handle.
    // Vertical drag: a plane facing the camera, so up on screen is up in world.
    const normal = vertical
      ? this.camera.getWorldDirection(new T.Vector3()).setY(0).normalize().negate()
      : new T.Vector3(0, 1, 0);
    const plane = new T.Plane().setFromNormalAndCoplanarPoint(normal, start);
    const hitPt = new T.Vector3();
    const grabOffset = ray.ray.intersectPlane(plane, hitPt)
      ? start.clone().sub(hitPt)
      : new T.Vector3();

    const apply = (p) => {
      if (kind === 'hotspot') {
        const h = this.HOTSPOTS[this.selHotspot];
        if (!h) return;
        h.x = Math.round(p.x * 1000) / 1000;
        h.y = Math.round(p.y * 1000) / 1000;
        h.z = Math.round(p.z * 1000) / 1000;
      } else if (kind === 'eye') {
        const d = p.clone().sub(eye0);
        w.pos = [eye0.x + d.x, eye0.y + d.y, eye0.z + d.z];
        w.look = [aim0.x + d.x, aim0.y + d.y, aim0.z + d.z];
      } else {
        w.look = [p.x, p.y, p.z];
      }
      this._buildSceneMarkers();
      this._touch();
      this.invalidate();
      this.emitState();
    };

    return {
      move: (ev) => {
        const r2 = new T.Raycaster();
        const rc = this.canvas.getBoundingClientRect();
        r2.setFromCamera(new T.Vector2(
          ((ev.clientX - rc.left) / rc.width) * 2 - 1,
          -((ev.clientY - rc.top) / rc.height) * 2 + 1
        ), this.camera);
        const p = new T.Vector3();
        if (!r2.ray.intersectPlane(plane, p)) return;
        p.add(grabOffset);
        if (vertical) { p.x = start.x; p.z = start.z; p.y = Math.max(0.05, p.y); }
        else p.y = start.y;
        apply(p);
      },
      end: () => { this.invalidate(200); },
    };
  }

  // ------------------------------------------------------------------ state

  colorOf(room, role) {
    const r = Math.min(Math.max(room | 0, 0), this.concepts.length - 1);
    const ci = Math.min(Math.max(this.concepts[r] | 0, 0), this.CONCEPTS.length - 1);
    return this.CONCEPTS[ci].pal[role];
  }

  emitState() {
    if (!this.onState) return;
    this.onState({
      tool: this.tool,
      scheme: this.options.scheme,
      selScene: this.selScene,
      sceneCount: this.config.waypoints.length,
      scenes: this.config.waypoints.map((w, i) => ({
        i,
        room: w.room,
        roomName: (this.ROOMS[w.room] || this.ROOMS[0] || { name: 'Room' }).name,
        pos: w.pos.slice(),
      })),
      // The selected shot's actual numbers. The tour's tuner had these as
      // sliders behind a super-admin check; they belong next to the model you
      // are pointing the camera at, not on the page a client sees.
      sel: this.config.waypoints[this.selScene]
        ? {
          pos: this.config.waypoints[this.selScene].pos.slice(),
          look: this.config.waypoints[this.selScene].look.slice(),
        }
        : null,
      concepts: this.concepts.slice(),
      roomNames: this.ROOMS.map((r) => r.name),
      selHotspot: this.selHotspot,
      hotspots: this.HOTSPOTS.map((h, i) => ({
        i, room: h.room, title: h.title, meta: h.meta, pos: [h.x, h.y, h.z],
      })),
      grid: !!(this.grid && this.grid.visible),
      markers: !!(this.markers && this.markers.visible),
      ceilings: this.ceilsVisible,
      hasModel: !!this.importedModel,
      fov: this.config.fov,
    });
  }

  /** Mark the project as edited. Separate from invalidate(), which is about pixels. */
  _touch() {
    if (this.onDirty) this.onDirty();
  }

  invalidate(ms) {
    this._activeUntil = performance.now() + (ms || IDLE_AFTER_MS);
    if (!this._raf) this._kick();
  }

  /**
   * Schedule exactly one frame.
   *
   * The `this._raf` guard is not defensive tidiness, it is load-bearing. Inside
   * `_frame` the id is cleared first, so a flight calling `onChange()` mid-frame
   * (via controls.update → invalidate) schedules a callback, and then the tail of
   * `_frame` scheduled a SECOND one. Two per frame becomes four, then eight: every
   * camera flight — Zoom Extents, a ViewCube face, clicking a scene — kicked off
   * exponential rAF growth that saturated the GPU process within a second. It
   * showed up as headless screenshots timing out forever; on a real laptop it is
   * a hot fan and a viewport that stops responding.
   */
  _kick() {
    if (!this._alive || this._raf) return;
    if (!this._loop) this._loop = (t) => this._frame(t);
    this._raf = requestAnimationFrame(this._loop);
  }

  _frame(now) {
    this._raf = 0;
    if (!this._alive) return;
    const dt = this._lastFrame ? Math.min(0.1, (now - this._lastFrame) / 1000) : 0.016;
    this._lastFrame = now;

    const moving = this.controls.update(dt, now);
    this.renderer.render(this.scene, this.camera);

    if (moving || now < this._activeUntil || this.controls.busy) this._kick();
  }

  resize() {
    const el = this.viewport || this.canvas;
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  applyOptions() {
    const p = (this.DAYLIGHT && this.DAYLIGHT[this.options.daylight]) || (this.DAYLIGHT && this.DAYLIGHT.Soft);
    if (p) {
      if (this.sun) { this.sun.intensity = p.sun; this.sun.color.set(p.sunC); }
      if (this.hemi) this.hemi.intensity = p.hemi;
      this.scene.background.set(p.bg);
      this.renderer.toneMappingExposure = p.exp;
    }
    this.renderer.shadowMap.needsUpdate = true;
    this.invalidate();
  }

  setOptions(patch) {
    Object.assign(this.options, patch);
    if (patch.scheme && this.controls) this.controls.setScheme(patch.scheme);
    if (this.grid && patch.grid !== undefined) { this.grid.visible = !!patch.grid; this.helpers.visible = !!patch.grid; }
    if (this.markers && patch.markers !== undefined) this.markers.visible = !!patch.markers;
    this.applyOptions();
    this.emitState();
  }

  toggleCeilings(on) {
    this.ceilsVisible = on === undefined ? !this.ceilsVisible : !!on;
    this.ceils.forEach((c) => { c.visible = this.ceilsVisible; });
    this.renderer.shadowMap.needsUpdate = true;
    this.invalidate();
    this.emitState();
  }

  // ------------------------------------------------------------------ tools

  setTool(t) {
    this.tool = t;
    this.controls.setTool(t);
    this.emitState();
  }

  /** Model geometry only — what orbit pivots and wheel zoom aim at. */
  _pickables() {
    if (this.importedModel) return [this.importedModel];
    return this.modelMeshes.filter((m) => m.visible && !m.userData.context);
  }

  /** Model plus the scene markers — what a click with the Select tool can hit. */
  _selectables() {
    const list = this._pickables();
    return this.markers && this.markers.visible ? list.concat(this.markers) : list;
  }

  _handlePick(hit) {
    if (!hit) return;
    // Clicking a marker selects it — the viewport and the list are the same
    // control surface, which is the part beginners actually find.
    let o = hit.object;
    while (o && o.userData.sceneIndex === undefined && o.userData.hotspotIndex === undefined) o = o.parent;
    if (!o) return;
    if (o.userData.hotspotIndex !== undefined) this.selectHotspot(o.userData.hotspotIndex);
    else if (o.userData.sceneIndex !== undefined) this.selectScene(o.userData.sceneIndex, true);
  }

  /** World-space bounds of the model (not the helpers) — for Zoom Extents. */
  modelBox() {
    const T = this.THREE;
    const box = new T.Box3();
    const src = this.importedModel
      ? [this.importedModel]
      : this.modelMeshes.filter((m) => m.visible && !m.userData.context);
    src.forEach((o) => box.expandByObject(o));
    if (box.isEmpty()) box.set(new T.Vector3(-6, 0, -6), new T.Vector3(6, 3, 6));
    return box;
  }

  zoomExtents() { this.controls.zoomExtents(this.modelBox()); this.invalidate(700); }
  standardView(name) { this.controls.standardView(name, this.modelBox()); this.invalidate(700); }

  // ----------------------------------------------------------------- scenes

  selectScene(i, dontFly) {
    if (i < 0 || i >= this.config.waypoints.length) return;
    this.selScene = i;
    this._buildSceneMarkers();
    if (!dontFly) this.controls.setShot(this.config.waypoints[i], true);
    this.invalidate(700);
    this.emitState();
  }

  /** Jump the viewport to a Scene without changing selection semantics. */
  gotoScene(i) {
    if (i < 0 || i >= this.config.waypoints.length) return;
    this.selScene = i;
    this.controls.setShot(this.config.waypoints[i], true);
    this._buildSceneMarkers();
    this.invalidate(700);
    this.emitState();
  }

  /** "Add Scene" — capture exactly what is on screen. This is the WYSIWYG bit. */
  addSceneFromView(room) {
    const shot = this.controls.getShot();
    const at = this.selScene + 1;
    const r = Number.isInteger(room)
      ? room
      : (this.config.waypoints[this.selScene] ? this.config.waypoints[this.selScene].room : 0);
    this.config.waypoints.splice(at, 0, { ...shot, room: Math.min(Math.max(r, 0), this.ROOMS.length - 1) });
    this.selScene = at;
    this._buildSceneMarkers();
    this._touch();
    this.invalidate();
    this.emitState();
    return at;
  }

  /** "Update Scene" — overwrite the selected Scene with the current view. */
  updateSceneFromView(i) {
    const idx = i === undefined ? this.selScene : i;
    const w = this.config.waypoints[idx];
    if (!w) return;
    Object.assign(w, this.controls.getShot());
    this._buildSceneMarkers();
    this._touch();
    this.invalidate();
    this.emitState();
  }

  removeScene(i) {
    const idx = i === undefined ? this.selScene : i;
    // The contract needs >= 2 waypoints: the path divides by (N-1) and roomAt()
    // indexes round(q*(N-1)). Refuse rather than save a bundle that cannot load.
    if (this.config.waypoints.length <= 2) return { ok: false, reason: 'A walkthrough needs at least 2 scenes.' };
    this.config.waypoints.splice(idx, 1);
    this.selScene = Math.max(0, Math.min(this.selScene, this.config.waypoints.length - 1));
    this._buildSceneMarkers();
    this._touch();
    this.invalidate();
    this.emitState();
    return { ok: true };
  }

  moveScene(from, to) {
    const wps = this.config.waypoints;
    if (from < 0 || from >= wps.length || to < 0 || to >= wps.length || from === to) return;
    const [w] = wps.splice(from, 1);
    wps.splice(to, 0, w);
    this.selScene = to;
    this._buildSceneMarkers();
    this._touch();
    this.invalidate();
    this.emitState();
  }

  // -------------------------------------------------------------- hotspots

  selectHotspot(i) {
    this.selHotspot = i >= 0 && i < this.HOTSPOTS.length ? i : -1;
    this._buildSceneMarkers();
    this.invalidate();
    this.emitState();
  }

  /**
   * Drop a hotspot where the viewport is looking, not at the origin.
   *
   * "Add" that puts the thing 12 m away in a corner means every add is followed
   * by a hunt. The camera is already pointing at whatever the user wants to
   * label, so that is where it goes.
   */
  addHotspot() {
    const shot = this.controls.getShot();
    const room = this.config.waypoints[this.selScene]
      ? this.config.waypoints[this.selScene].room : 0;
    this.HOTSPOTS.push({
      room: Math.min(Math.max(room, 0), Math.max(0, this.ROOMS.length - 1)),
      x: Math.round(shot.look[0] * 100) / 100,
      y: Math.round(Math.max(0.2, shot.look[1]) * 100) / 100,
      z: Math.round(shot.look[2] * 100) / 100,
      title: 'New callout',
      meta: 'Material · finish',
    });
    this.selHotspot = this.HOTSPOTS.length - 1;
    this._buildSceneMarkers();
    this._touch();
    this.invalidate();
    this.emitState();
    return this.selHotspot;
  }

  removeHotspot(i) {
    const idx = i === undefined ? this.selHotspot : i;
    if (idx < 0 || idx >= this.HOTSPOTS.length) return;
    this.HOTSPOTS.splice(idx, 1);
    this.selHotspot = Math.min(idx, this.HOTSPOTS.length - 1);
    this._buildSceneMarkers();
    this._touch();
    this.invalidate();
    this.emitState();
  }

  /**
   * Edit one field of a hotspot. Strings are trimmed to the contract's limits
   * HERE rather than at save time: a bundle that fails validation after twenty
   * minutes of work is a worse error message than a field that stops accepting
   * characters.
   */
  setHotspotField(i, key, value) {
    const h = this.HOTSPOTS[i];
    if (!h) return;
    if (key === 'title' || key === 'meta') {
      h[key] = String(value).replace(/[<>]/g, '').slice(0, 200);
    } else if (key === 'room') {
      h.room = Math.min(Math.max(value | 0, 0), Math.max(0, this.ROOMS.length - 1));
    } else if (key === 'x' || key === 'y' || key === 'z') {
      if (!Number.isFinite(value)) return;
      h[key] = Math.round(value * 1000) / 1000;
    }
    this._buildSceneMarkers();
    this._touch();
    this.invalidate();
    this.emitState();
  }

  // ---------------------------------------------------------------- rooms

  /**
   * Rename a room. Cheap, and the single most likely thing someone wants to
   * change after importing their own model — "The Kitchen" is not what every
   * plan calls that space.
   */
  setRoomName(i, name) {
    const r = this.ROOMS[i];
    if (!r) return;
    r.name = String(name).replace(/[<>]/g, '').slice(0, 200) || r.name;
    this._buildSceneMarkers();
    this._touch();
    this.emitState();
  }

  setSceneRoom(i, room) {
    const w = this.config.waypoints[i];
    if (!w) return;
    w.room = Math.min(Math.max(room | 0, 0), this.ROOMS.length - 1);
    this._buildSceneMarkers();
    this._touch();
    this.emitState();
  }

  setFov(v) {
    this.config.fov = Math.min(140, Math.max(10, v));
    this.camera.fov = this.config.fov;
    this.camera.updateProjectionMatrix();
    this._touch();
    this.invalidate();
    this.emitState();
  }

  /**
   * Set one coordinate of the selected shot from a typed number.
   * `which` is 'pos' or 'look'; `axis` is 0|1|2.
   *
   * Typing is the fallback, not the main event — but it is the only way to say
   * "exactly 1.60 m" or to copy a value between two shots, and every CAD tool
   * has it next to the direct manipulation for exactly that reason.
   */
  setSceneAxis(which, axis, value) {
    const w = this.config.waypoints[this.selScene];
    if (!w || !Number.isFinite(value)) return;
    const v = which === 'look' ? w.look.slice() : w.pos.slice();
    v[axis] = Math.round(value * 1000) / 1000;
    if (which === 'look') w.look = v; else w.pos = v;
    this._buildSceneMarkers();
    this._touch();
    this.invalidate();
    this.emitState();
  }

  /** Point the selected shot at whatever the viewport is currently looking at. */
  aimSceneAtView() {
    const w = this.config.waypoints[this.selScene];
    if (!w) return;
    const shot = this.controls.getShot();
    w.look = shot.look.slice();
    this._buildSceneMarkers();
    this._touch();
    this.invalidate();
    this.emitState();
  }

  /** Nudge the selected Scene's eye height — the one number people always tweak. */
  setSceneHeight(metres) {
    const w = this.config.waypoints[this.selScene];
    if (!w) return;
    const dy = metres - w.pos[1];
    w.pos[1] = metres;
    w.look[1] += dy * 0.5; // keep roughly the same downward tilt
    this.controls.setShot(w, false);
    this._buildSceneMarkers();
    this._touch();
    this.invalidate();
    this.emitState();
  }

  // --------------------------------------------------------------- concepts

  setRoomConcept(room, ci) {
    const pal = this.CONCEPTS[ci].pal;
    this.regList.forEach((e) => {
      if (e.room !== room) return;
      e.mat.color.set(pal[e.role]);
      if (e.mat.userData && e.mat.userData.target) e.mat.userData.target.set(pal[e.role]);
    });
    this.concepts[room] = ci;
    this._touch();
    this.invalidate();
    this.emitState();
  }

  // ------------------------------------------------------------------ model

  async importGLB(arrayBuffer) {
    const T = this.THREE;
    const gltf = await parseGLB(arrayBuffer, T, this.renderer);
    if (this.importedModel) { this.scene.remove(this.importedModel); this._disposeTree(this.importedModel); }
    this.regList = this.regList.filter((e) => !e.imported);
    const root = gltf.scene;
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const room = o.userData && o.userData.room;
      const role = o.userData && o.userData.role;
      if (Number.isInteger(room) && room >= 0 && room < this.ROOMS.length
          && PAL_ROLES.includes(role) && o.material && o.material.color) {
        const mat = o.material.clone();
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
    this.refitLights();
    this._touch();
    this.invalidate(500);
    this.emitState();
  }

  /**
   * Aim the light rig at whatever is on stage. The rig's numbers were authored
   * for the original loft, so a 6 m studio — or any imported model — was lit by
   * a sun pointed at a spot outside it, through a shadow frustum wide enough to
   * leave the subject a few dozen texels of the 2048² map.
   */
  refitLights() {
    const T = this.THREE;
    const box = new T.Box3();
    if (this.importedModel) box.setFromObject(this.importedModel);
    else this.modelMeshes.filter((m) => !m.userData.context).forEach((m) => box.expandByObject(m));
    fitLights(T, { sun: this.sun, fill: this.fill }, box);
    this.renderer.shadowMap.needsUpdate = true;
  }

  clearImportedModel() {
    if (!this.importedModel) return;
    this.scene.remove(this.importedModel);
    this._disposeTree(this.importedModel);
    this.importedModel = null;
    this.regList = this.regList.filter((e) => !e.imported);
    this.modelMeshes.forEach((m) => { m.visible = true; });
    this.ceils.forEach((c) => { c.visible = this.ceilsVisible; });
    this.renderer.shadowMap.needsUpdate = true;
    this._touch();
    this.invalidate(400);
    this.emitState();
  }

  // ----------------------------------------------------------------- export

  /** The 8 contract keys, ready for buildBundle(). */
  exportProject() {
    return {
      config: JSON.parse(JSON.stringify(this.config)),
      CONCEPTS: this.CONCEPTS,
      ROOMS: this.ROOMS,
      PLAN: this.PLAN,
      HOTSPOTS: this.HOTSPOTS,
      ROOM_COLORS: this.ROOM_COLORS,
      DAYLIGHT: this.DAYLIGHT,
      BRAND: this.BRAND,
    };
  }

  // ---------------------------------------------------------------- cleanup

  _disposeTree(root) {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      if (!m) return;
      (Array.isArray(m) ? m : [m]).forEach((mm) => {
        Object.values(mm).forEach((v) => { if (v && v.isTexture) v.dispose(); });
        mm.dispose();
      });
    });
  }

  dispose() {
    this._alive = false;
    cancelAnimationFrame(this._raf);
    this._raf = 0;
    window.removeEventListener('resize', this._onResize);
    if (this.controls) this.controls.dispose();
    if (this.scene) this._disposeTree(this.scene);
    if (this.renderer) {
      this.renderer.dispose();
      // Force-lose the context: browsers cap live WebGL contexts, and an editor
      // the user opens and closes repeatedly is exactly how that cap gets hit.
      const ext = this.renderer.getContext && this.renderer.getContext().getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
    this.renderer = null;
    this.scene = null;
  }
}

export { TOOLS };
