// Viewport navigation with SketchUp's semantics (AutoCAD's mouse map optional).
//
// Why not OrbitControls: the difference that matters to an architect is not the
// maths, it is WHAT YOU ORBIT AROUND. OrbitControls spins about a fixed target
// that the user cannot see or move, so the model swings away the moment you look
// at a corner. SketchUp picks the point under the cursor at the instant the drag
// starts and pivots about that. Same for the wheel: it zooms toward the cursor,
// not toward the screen centre. Those two behaviours are most of why SketchUp
// feels "attached" to the model, and neither is configurable in OrbitControls.
//
// Mouse map — the one thing SketchUp and AutoCAD genuinely disagree on:
//
//                      middle drag     Shift + middle drag
//   SketchUp             orbit               pan
//   AutoCAD               pan               orbit
//
// Both are offered (`scheme`) because getting this wrong makes an experienced
// user feel the tool is broken, while a beginner will not notice either way.
//
// Everything is also reachable WITHOUT a middle button: pick a tool in the
// toolbar and drag with the left button. Laptops and trackpads are the common
// case, and a viewport that requires a three-button mouse excludes half the
// audience on their first visit.
//
// The camera's quaternion is authoritative. `target` is only the anchor that
// orbit and pan work against — nothing calls lookAt(target) implicitly, because
// that would snap the view after a wheel zoom.

export const TOOLS = {
  SELECT: 'select',
  ORBIT: 'orbit',
  PAN: 'pan',
  ZOOM: 'zoom',
  LOOK: 'look',
  WALK: 'walk',
  PLACE_CAMERA: 'placeCamera',
};

/** Keyboard shortcuts, chosen to match SketchUp so muscle memory carries over. */
export const TOOL_KEYS = {
  ' ': TOOLS.SELECT,
  o: TOOLS.ORBIT,
  h: TOOLS.PAN,
  z: TOOLS.ZOOM,
  l: TOOLS.LOOK,
  w: TOOLS.WALK,
  p: TOOLS.PLACE_CAMERA,
};

const ORBIT_SPEED = 0.0045;   // rad per pixel — ~0.26°/px, SketchUp is ~0.3°/px
const LOOK_SPEED = 0.0032;
const WHEEL_STEP = 0.16;      // fraction of the distance-to-cursor per notch
const MIN_PIVOT_DIST = 0.35;  // never let a zoom put the eye inside what it aimed at
// Anything this close to the eye is not something you can navigate relative to.
// Found the hard way: the editor opens ON scene 1, whose marker cone therefore
// sits exactly at the eye. It won every raycast at distance ~0, so `pointUnder`
// returned the camera's own position, `dollyToward` bailed on a zero-length
// vector, and the wheel did nothing at all until the user happened to move first.
// Pan died with it, because target had been set onto the eye and the
// metres-per-pixel factor is derived from the eye-to-target distance.
const MIN_PICK_DIST = 0.4;
const WALK_SPEED = 3.2;       // m/s, a comfortable indoor walking pace
const PHI_EPS = 0.0009;       // keep off the poles so the up vector never flips

export class SketchupControls {
  /**
   * @param {object}   THREE
   * @param {object}   camera        PerspectiveCamera, mutated in place
   * @param {Element}  dom           element that receives pointer/wheel events
   * @param {object}   opts
   * @param {Function} opts.getPickables     () => Object3D[] model geometry, for pivots
   * @param {Function} [opts.getSelectables] () => Object3D[] clickable things
   * @param {Function} opts.onChange      called whenever the camera moved
   * @param {Function} [opts.onPick]      (hit|null, event) for the Select tool
   * @param {Function} [opts.onPlace]     (point) for the Position Camera tool
   * @param {Function} [opts.grab]        (event) => {move(e), end()} | null.
   *        Called first on every pointerdown. Returning a handler hands the whole
   *        drag to the host — this is how direct manipulation (dragging a camera
   *        handle in the model) coexists with orbit/pan without either one having
   *        to know about the other's state.
   * @param {number}   [opts.eyeHeight]   metres; 1.6 is eye level for ~1.7 m
   * @param {'sketchup'|'autocad'} [opts.scheme]
   */
  constructor(THREE, camera, dom, opts = {}) {
    this.THREE = THREE;
    this.camera = camera;
    this.dom = dom;
    // Two lists on purpose. Pivots and zoom targets must come from the MODEL —
    // picking a UI marker would let the viewport orbit around its own overlay.
    // Selection is the opposite: markers are the whole point of clicking.
    this.getPickables = opts.getPickables || (() => []);
    this.getSelectables = opts.getSelectables || this.getPickables;
    this.onChange = opts.onChange || (() => {});
    this.onPick = opts.onPick || null;
    this.onPlace = opts.onPlace || null;
    this.grab = opts.grab || null;
    this.eyeHeight = opts.eyeHeight ?? 1.6;
    this.scheme = opts.scheme === 'autocad' ? 'autocad' : 'sketchup';

    this.enabled = true;
    this.tool = TOOLS.ORBIT;
    this.target = new THREE.Vector3(0, 1.2, 0);

    this._ray = new THREE.Raycaster();
    this._ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._ndc = new THREE.Vector2();
    this._sph = new THREE.Spherical();
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();

    this._gesture = null;   // 'orbit' | 'pan' | 'dolly' | 'look' | 'walk'
    this._pivot = new THREE.Vector3();
    this._last = { x: 0, y: 0 };
    this._pointerId = null;
    this._keys = new Set();
    this._flight = null;    // active flyTo animation
    this._panDist = 0;      // depth of the grabbed point, for the duration of a pan
    this._grabbed = null;   // host-owned drag (see opts.grab)

    this._onDown = (e) => this._down(e);
    this._onMove = (e) => this._move(e);
    this._onUp = (e) => this._up(e);
    this._onWheel = (e) => this._wheel(e);
    this._onCtx = (e) => e.preventDefault();
    this._onKeyDown = (e) => this._keys.add(e.key.toLowerCase());
    this._onKeyUp = (e) => this._keys.delete(e.key.toLowerCase());
    // A held key with no keyup (alt-tab mid-walk) would walk forever.
    this._onBlur = () => this._keys.clear();

    dom.addEventListener('pointerdown', this._onDown);
    dom.addEventListener('wheel', this._onWheel, { passive: false });
    dom.addEventListener('contextmenu', this._onCtx);
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  dispose() {
    const d = this.dom;
    d.removeEventListener('pointerdown', this._onDown);
    d.removeEventListener('wheel', this._onWheel);
    d.removeEventListener('contextmenu', this._onCtx);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onUp);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this._keys.clear();
  }

  setTool(t) { this.tool = t; }
  setScheme(s) { this.scheme = s === 'autocad' ? 'autocad' : 'sketchup'; }

  /** True while something still needs animating (walk keys held, flight running). */
  get busy() {
    return !!this._flight || (this.tool === TOOLS.WALK && this._walkVector().lengthSq() > 0);
  }

  // ---------------------------------------------------------------- picking

  _setNdc(e) {
    const r = this.dom.getBoundingClientRect();
    this._ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    return this._ndc;
  }

  /**
   * The point under the cursor, in world space.
   *
   * Falls back through geometry → ground plane → a point on the view axis, so a
   * drag started over empty sky still pivots about something sensible instead of
   * snapping to the world origin.
   */
  pointUnder(e, out) {
    const T = this.THREE;
    const p = out || new T.Vector3();
    this._ray.setFromCamera(this._setNdc(e), this.camera);
    const hits = this._ray.intersectObjects(this.getPickables(), true);
    const hit = hits.find((h) => h.distance > MIN_PICK_DIST);
    if (hit) return p.copy(hit.point);
    if (this._ray.ray.intersectPlane(this._ground, p) && p.distanceTo(this.camera.position) > MIN_PICK_DIST) return p;
    return p.copy(this.camera.position).addScaledVector(this._forward(this._v2), this.target.distanceTo(this.camera.position) || 6);
  }

  /** First geometry hit under the cursor, or null. Used by the Select tool. */
  pick(e) {
    this._ray.setFromCamera(this._setNdc(e), this.camera);
    const hits = this._ray.intersectObjects(this.getSelectables(), true);
    return hits.length ? hits[0] : null;
  }

  _forward(out) {
    return this.camera.getWorldDirection(out || this._v);
  }

  // ---------------------------------------------------------------- gestures

  /**
   * Which gesture a pointerdown means.
   *
   * Middle button is the "always available" path and follows `scheme`. Left
   * button follows the active toolbar tool, which is what makes the whole thing
   * usable on a trackpad.
   */
  _gestureFor(e) {
    if (e.button === 1) {
      const alt = e.shiftKey;
      if (this.scheme === 'autocad') return alt ? 'orbit' : 'pan';
      return alt ? 'pan' : 'orbit';
    }
    if (e.button !== 0) return null;
    switch (this.tool) {
      case TOOLS.ORBIT: return 'orbit';
      case TOOLS.PAN: return 'pan';
      case TOOLS.ZOOM: return 'dolly';
      case TOOLS.LOOK: return 'look';
      case TOOLS.WALK: return 'look'; // in Walk, dragging steers; keys move
      default: return null;           // Select / Position Camera act on click
    }
  }

  _down(e) {
    if (!this.enabled) return;
    // A handle under the cursor wins over every gesture: if the user aimed at the
    // camera marker, they meant to move the camera, not orbit the building.
    if (e.button === 0 && this.grab) {
      const h = this.grab(e);
      if (h) {
        e.preventDefault();
        this._flight = null;
        this._grabbed = h;
        this._pointerId = e.pointerId;
        try { this.dom.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
        return;
      }
    }
    const g = this._gestureFor(e);
    if (!g) {
      // Click tools fire on pointerdown so a click never needs a steady hand.
      if (e.button === 0 && this.tool === TOOLS.SELECT && this.onPick) this.onPick(this.pick(e), e);
      if (e.button === 0 && this.tool === TOOLS.PLACE_CAMERA && this.onPlace) {
        this.onPlace(this.pointUnder(e, new this.THREE.Vector3()));
      }
      return;
    }
    e.preventDefault();
    this._flight = null;                       // a drag cancels any running flight
    this._gesture = g;
    this._pointerId = e.pointerId;
    this._last.x = e.clientX;
    this._last.y = e.clientY;
    // Pivot is frozen for the whole drag — re-picking every move makes the model
    // squirm, because the point under the cursor changes as the camera turns.
    if (g === 'orbit' || g === 'dolly') this.pointUnder(e, this._pivot);
    // Pan speed comes from the depth of what you GRABBED, captured once at the
    // start of the drag. Deriving it from `target` instead looks equivalent until
    // a wheel zoom has parked the target 0.35 m away on a wall — then every
    // subsequent pan crawls, and the viewport feels stuck for no visible reason.
    if (g === 'pan') {
      this.pointUnder(e, this._v2);
      this._panDist = Math.max(0.4, this.camera.position.distanceTo(this._v2));
    }
    try { this.dom.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
  }

  _move(e) {
    if (this._grabbed && e.pointerId === this._pointerId) {
      this._grabbed.move(e);
      return;
    }
    if (!this._gesture || e.pointerId !== this._pointerId) return;
    const dx = e.clientX - this._last.x;
    const dy = e.clientY - this._last.y;
    this._last.x = e.clientX;
    this._last.y = e.clientY;
    if (!dx && !dy) return;

    if (this._gesture === 'orbit') this.orbit(dx, dy, this._pivot);
    else if (this._gesture === 'pan') this.pan(dx, dy);
    else if (this._gesture === 'look') this.look(dx, dy);
    else if (this._gesture === 'dolly') this.dollyToward(this._pivot, -dy * 0.006);
    this.onChange();
  }

  _up(e) {
    if (e.pointerId !== this._pointerId) return;
    try { this.dom.releasePointerCapture(e.pointerId); } catch { /* already gone */ }
    if (this._grabbed) { this._grabbed.end(); this._grabbed = null; }
    this._gesture = null;
    this._pointerId = null;
    this._panDist = 0;
  }

  _wheel(e) {
    if (!this.enabled) return;
    e.preventDefault();
    this._flight = null;
    const hit = this.pointUnder(e, this._v2.clone());
    // deltaMode 1 is lines (Firefox), 0 is pixels. Normalise to "notches".
    const notches = e.deltaMode === 1 ? e.deltaY / 3 : e.deltaY / 100;
    this.dollyToward(hit, -notches * WHEEL_STEP);
    // Only adopt the zoomed-at point as the next pivot if it is actually somewhere
    // else; a target sitting on the eye makes pan's metres-per-pixel zero.
    if (hit.distanceTo(this.camera.position) > MIN_PICK_DIST) this.target.copy(hit);
    this.onChange();
  }

  // ---------------------------------------------------------------- motions

  /** Rotate the camera about `pivot`, then aim at it. */
  orbit(dx, dy, pivot) {
    const off = this._v.copy(this.camera.position).sub(pivot);
    this._sph.setFromVector3(off);
    this._sph.theta -= dx * ORBIT_SPEED;
    this._sph.phi -= dy * ORBIT_SPEED;
    this._sph.phi = Math.max(PHI_EPS, Math.min(Math.PI - PHI_EPS, this._sph.phi));
    this._sph.makeSafe();
    this.camera.position.copy(pivot).add(off.setFromSpherical(this._sph));
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(pivot);
    this.target.copy(pivot);
  }

  /**
   * Screen-space drag of the whole view.
   *
   * The metres-per-pixel factor is derived from the frustum height at the target
   * distance, so the point you grabbed stays under the cursor whether you are
   * across the room or nose-against-a-wall.
   */
  pan(dx, dy) {
    const cam = this.camera;
    const dist = this._panDist || Math.max(0.4, cam.position.distanceTo(this.target));
    const h = 2 * Math.tan((cam.fov * Math.PI) / 360) * dist;
    const perPx = h / this.dom.clientHeight;
    const right = this._v.setFromMatrixColumn(cam.matrix, 0);
    const up = this._v2.setFromMatrixColumn(cam.matrix, 1);
    const move = right.multiplyScalar(-dx * perPx).add(up.multiplyScalar(dy * perPx));
    cam.position.add(move);
    this.target.add(move);
  }

  /**
   * Move the eye along the line to `point` by a fraction of the gap.
   * Proportional, so approach slows as you get close and never overshoots
   * through the surface you were aiming at.
   */
  dollyToward(point, amount) {
    const to = this._v.copy(point).sub(this.camera.position);
    const dist = to.length();
    if (dist < 1e-4) return;
    let step = dist * amount;
    // Clamp toward the surface, never through it — and when already closer than
    // the guard, "zoom in" must be a no-op rather than a shove backwards, which
    // is what an unguarded `dist - MIN_PIVOT_DIST` produces for small dist.
    if (step > 0 && step > dist - MIN_PIVOT_DIST) step = Math.max(0, dist - MIN_PIVOT_DIST);
    if (dist - step > 4000) step = dist - 4000; // and never fly off to infinity
    this.camera.position.addScaledVector(to.normalize(), step);
  }

  /** First-person head turn: yaw about world up, pitch about the camera's right. */
  look(dx, dy) {
    const cam = this.camera;
    const dist = Math.max(0.5, cam.position.distanceTo(this.target));
    const dir = this._forward(this._v).clone();
    const yaw = -dx * LOOK_SPEED;
    const pitch = -dy * LOOK_SPEED;
    dir.applyAxisAngle(this._v2.set(0, 1, 0), yaw);
    const right = this._v2.copy(dir).cross(this.camera.up).normalize();
    dir.applyAxisAngle(right, pitch);
    // Stop just short of vertical; past it the horizon rolls and beginners get lost.
    const up = dir.y / dir.length();
    if (up > 0.995 || up < -0.995) return;
    cam.up.set(0, 1, 0);
    cam.lookAt(this._v.copy(cam.position).add(dir));
    this.target.copy(cam.position).addScaledVector(dir.normalize(), dist);
  }

  _walkVector() {
    const v = this._v2.set(0, 0, 0);
    if (this.tool !== TOOLS.WALK) return v;
    const k = this._keys;
    if (k.has('w') || k.has('arrowup')) v.z += 1;
    if (k.has('s') || k.has('arrowdown')) v.z -= 1;
    if (k.has('a') || k.has('arrowleft')) v.x -= 1;
    if (k.has('d') || k.has('arrowright')) v.x += 1;
    return v;
  }

  /** Ground-plane walk. Called from the render loop; dt in seconds. */
  walk(dt) {
    const wish = this._walkVector();
    if (!wish.lengthSq()) return false;
    const fwd = this._forward(this._v).clone();
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) return false;
    fwd.normalize();
    const right = new this.THREE.Vector3().copy(fwd).cross(new this.THREE.Vector3(0, 1, 0)).normalize().negate();
    const speed = WALK_SPEED * (this._keys.has('shift') ? 2.5 : 1) * dt;
    const move = fwd.multiplyScalar(wish.z * speed).add(right.multiplyScalar(wish.x * speed));
    this.camera.position.add(move);
    this.target.add(move);
    return true;
  }

  // ---------------------------------------------------------------- framing

  /** Drop the eye to standing height at `point`, keeping the current heading. */
  placeCameraAt(point) {
    const dir = this._forward(this._v).clone();
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    const eye = new this.THREE.Vector3(point.x, (point.y || 0) + this.eyeHeight, point.z);
    this.flyTo(eye, eye.clone().addScaledVector(dir, 4));
  }

  /**
   * Frame `box` from the current viewing direction — SketchUp's Zoom Extents.
   * Keeps the direction so it reads as "step back", not "jump somewhere new".
   */
  zoomExtents(box, pad = 1.35) {
    if (!box || box.isEmpty()) return;
    const T = this.THREE;
    const c = box.getCenter(new T.Vector3());
    const size = box.getSize(new T.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;
    const fit = (radius * pad) / Math.tan((this.camera.fov * Math.PI) / 360);
    let dir = this._forward(this._v).clone();
    if (dir.lengthSq() < 1e-6) dir.set(-0.6, -0.45, -0.65).normalize();
    this.flyTo(c.clone().addScaledVector(dir, -fit), c);
  }

  /** Named orthographic-style viewpoints (the ViewCube faces). */
  standardView(name, box) {
    const T = this.THREE;
    const c = box && !box.isEmpty() ? box.getCenter(new T.Vector3()) : this.target.clone();
    const size = box && !box.isEmpty() ? box.getSize(new T.Vector3()) : new T.Vector3(10, 3, 10);
    const radius = Math.max(size.x, size.y, size.z) * 0.5 || 6;
    const d = (radius * 1.5) / Math.tan((this.camera.fov * Math.PI) / 360);
    const dirs = {
      top: [0, 1, 0.0001], bottom: [0, -1, 0.0001],
      front: [0, 0, 1], back: [0, 0, -1],
      right: [1, 0, 0], left: [-1, 0, 0],
      iso: [0.72, 0.55, 0.72],
    };
    const v = dirs[name] || dirs.iso;
    const eye = c.clone().add(new T.Vector3(v[0], v[1], v[2]).normalize().multiplyScalar(d));
    this.flyTo(eye, c);
  }

  /**
   * Animated move. SketchUp animates between scenes rather than cutting, and the
   * reason is not polish: a cut leaves the viewer with no idea which way the
   * model turned. The ease matches the tour's own smoothstep.
   */
  flyTo(pos, look, ms = 520) {
    const T = this.THREE;
    const fromPos = this.camera.position.clone();
    const fromTarget = this.target.clone();
    this._flight = {
      t0: null, ms,
      fromPos, toPos: pos.clone(),
      fromTarget, toTarget: look.clone(),
      _v: new T.Vector3(),
    };
  }

  /** Advance flight + walk. Returns true if another frame is needed. */
  update(dt, now) {
    let live = false;
    const f = this._flight;
    if (f) {
      if (f.t0 == null) f.t0 = now;
      const raw = Math.min(1, (now - f.t0) / f.ms);
      const t = raw * raw * (3 - 2 * raw);
      this.camera.position.lerpVectors(f.fromPos, f.toPos, t);
      const tgt = f._v.lerpVectors(f.fromTarget, f.toTarget, t);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(tgt);
      this.target.copy(tgt);
      if (raw >= 1) this._flight = null;
      live = true;
    }
    if (this.walk(dt)) live = true;
    if (live) this.onChange();
    return live;
  }

  /** Camera state in the shape the project contract stores (`pos` + `look`). */
  getShot() {
    const look = this.target.clone();
    // A degenerate look point (target sitting on the eye) produces NaNs downstream.
    if (look.distanceToSquared(this.camera.position) < 1e-6) {
      look.copy(this.camera.position).addScaledVector(this._forward(this._v), 4);
    }
    return {
      pos: [this.camera.position.x, this.camera.position.y, this.camera.position.z].map(r3),
      look: [look.x, look.y, look.z].map(r3),
    };
  }

  /** Move to a stored shot. `animate: false` for the initial load. */
  setShot(shot, animate = true) {
    const T = this.THREE;
    const pos = new T.Vector3().fromArray(shot.pos);
    const look = new T.Vector3().fromArray(shot.look);
    if (!animate) {
      this._flight = null;
      this.camera.position.copy(pos);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(look);
      this.target.copy(look);
      this.onChange();
      return;
    }
    this.flyTo(pos, look);
  }
}

const r3 = (n) => Math.round(n * 1000) / 1000;
