// Parametric apartment builder — the geometry behind the showroom units.
//
// Four unit types hand-modelled would be four things to keep in step every time
// a material, a ceiling height or a window band changes. A unit is described as
// data (shell, partitions, windows, furniture) and this turns that description
// into geometry.
//
// This is explicitly the LOW-DETAIL tier. The plan is to swap individual units
// for meshes baked in Blender (or, later, Gaussian splats) without touching
// anything else: the project bundle already separates geometry from the camera
// path, the concepts and the hotspots, so a unit can be replaced by a .glb and
// keep its walkthrough.
//
// Conventions, chosen so a plan reads like a floor plan:
//   • the unit occupies x ∈ [0, w] and z ∈ [0, d], corner at the origin;
//   • z = 0 ('s') is the entrance side, z = d ('n') is the main facade;
//   • walls are solid boxes, not planes — an apartment is seen from inside AND
//     from the top-down intro, and a plane disappears edge-on in the plan view.

import { placeAll } from './furniture/index.js';

const WALL_T = 0.11;      // interior partition thickness
const SHELL_T = 0.22;     // exterior wall — reads as a real building envelope
const DOOR_W = 0.9;
const DOOR_H = 2.1;
const SILL = 0.5;         // glazing starts here
const HEAD = 2.32;        // …and stops here

/**
 * @typedef {object} UnitPlan
 * @property {{w:number,d:number,h:number}} shell
 * @property {Array}  partitions  { x1, z1, x2, z2, doors?: number[] (0..1 along the run), room?, h? }
 * @property {Array}  windows     { side: 'n'|'s'|'e'|'w', at, len }
 * @property {Array}  doors       { side, at }  — openings in the SHELL (the front door)
 * @property {Array}  zones       { x1, z1, x2, z2, floor?: 'wood'|'tile' }
 * @property {Array}  furniture   { kind, x, z, ry?, room?, … per-kit extras }
 */

/**
 * The four shell runs, described once so windows and doors work on any of them.
 * `along` is the axis a position `at` is measured on; `fixed` is the other one.
 */
const SIDES = {
  s: { along: 'x', fixed: 'z', at: () => 0 },
  n: { along: 'x', fixed: 'z', at: (p) => p.shell.d },
  w: { along: 'z', fixed: 'x', at: () => 0 },
  e: { along: 'z', fixed: 'x', at: (p) => p.shell.w },
};

/**
 * Build one apartment.
 *
 * @param {object} THREE
 * @param {object} builders  from createBuilders()
 * @param {UnitPlan} plan
 * @returns {{ floorMat: object, ceils: object[] }} handles the engine animates
 */
export function buildApartment(THREE, builders, plan) {
  const { box, add, themedMat, staticMat, group } = builders;
  const { w, d, h } = plan.shell;

  // ---- floor ------------------------------------------------------------
  // One slab for the whole unit; zones only change the visible finish, because
  // a real apartment has one floor level and stepped slabs read as a bug.
  const floorMat = new THREE.MeshPhysicalMaterial({
    color: '#b78a5c', roughness: 0.5, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.35,
  });
  add(box(w, 0.1, d), floorMat, w / 2, -0.05, d / 2, { cast: false });

  (plan.zones || []).forEach((z) => {
    if (z.floor !== 'tile') return;
    // Wet-area tile sits 6 mm proud so it never z-fights the slab.
    add(box(z.x2 - z.x1, 0.012, z.z2 - z.z1), staticMat('#d9d5cc', { roughness: 0.72 }),
      (z.x1 + z.x2) / 2, 0.006, (z.z1 + z.z2) / 2, { cast: false });
  });

  // ---- ceiling ----------------------------------------------------------
  // Hidden during the top-down intro and in the editor; kept as a list because
  // that is the handle both of those reach for.
  const ceilMat = staticMat('#ded7c9', { roughness: 1 });
  const ceils = [add(box(w, 0.1, d), ceilMat, w / 2, h + 0.05, d / 2, { cast: false, receive: false })];

  // ---- shell ------------------------------------------------------------
  const shellMat = themedMat(0, 'wall', { roughness: 0.95 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#dce6ea', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.4,
  });
  const frameMat = staticMat('#2c2823', { roughness: 0.45, metalness: 0.3 });

  /**
   * A slab on one shell side, spanning [a,b] along that side and [y0,y1] high.
   * Everything on the envelope — solid wall, sill, header, glazing, mullion —
   * is one of these, which is why windows and doors can live on any side.
   */
  const slab = (side, a, b, y0, y1, t, mat, opts = {}) => {
    if (b - a < 0.004 || y1 - y0 < 0.004) return null;
    const S = SIDES[side];
    const mid = (a + b) / 2;
    const fixed = S.at(plan);
    const g = S.along === 'x' ? box(b - a, y1 - y0, t) : box(t, y1 - y0, b - a);
    const x = S.along === 'x' ? mid : fixed;
    const z = S.along === 'x' ? fixed : mid;
    return add(g, mat, x, (y0 + y1) / 2, z, { cast: true, receive: true, ...opts });
  };

  // One merge group per side: a wall with a window in it is a pier, a sill, a
  // header and another pier, and it is ONE wall. Merging it that way keeps the
  // audit's "how much of this frame is a single object" question answerable —
  // scene-wide merging would not.
  for (const side of ['s', 'n', 'w', 'e']) group(`shell.${side}`, () => {
    const S = SIDES[side];
    const run = S.along === 'x' ? w : d;
    // Every hole in this wall, in order along the run.
    const holes = [
      ...(plan.windows || []).filter((v) => v.side === side)
        .map((v) => ({ a: v.at, b: v.at + v.len, kind: 'window' })),
      ...(plan.sliders || []).filter((v) => v.side === side)
        .map((v) => ({ a: v.at, b: v.at + v.len, kind: 'slider', open: v.open })),
      ...(plan.doors || []).filter((v) => v.side === side)
        .map((v) => ({ a: v.at - DOOR_W / 2, b: v.at + DOOR_W / 2, kind: 'door' })),
    ].sort((p, q) => p.a - q.a);

    let cursor = 0;
    for (const hole of holes) {
      if (hole.a > cursor) slab(side, cursor, hole.a, 0, h, SHELL_T, shellMat);
      if (hole.kind === 'door') {
        slab(side, hole.a, hole.b, DOOR_H, h, SHELL_T, shellMat);          // header
        for (const edge of [hole.a, hole.b]) {                              // reveal
          slab(side, edge - 0.03, edge + 0.03, 0, DOOR_H, SHELL_T + 0.02, frameMat, { receive: false });
        }
      } else if (hole.kind === 'slider') {
        // A sliding glass door to the balcony: glazed to the floor, no sill, so
        // the camera can walk out. Indonesian units are sold on the balcony —
        // it is where the laundry dries and where the view is — and a walkthrough
        // that stops at the glass stops one step short of the thing being sold.
        slab(side, hole.a, hole.b, HEAD, h, SHELL_T, shellMat);
        // Fixed leaf on the first half, OPEN on the second. A slider modelled as
        // one continuous pane is a window with a door's proportions: the camera
        // cannot pass it, and the audit reads "wall at 0.45 m" every time a
        // waypoint stands near the glass. Half open is also just what a slider
        // looks like in a photographed unit.
        // `open` picks WHICH half slides away, because the camera has to walk
        // through it and the walk approaches from whichever side the plan puts
        // the circulation on. A slider that always opened the same way meant
        // half the units routed their exit straight into the fixed pane.
        const mid = (hole.a + hole.b) / 2;
        const fixedFrom = hole.open === 'start' ? mid : hole.a;
        const fixedTo = hole.open === 'start' ? hole.b : mid;
        slab(side, fixedFrom + 0.03, fixedTo - 0.02, 0.02, HEAD, 0.04, glassMat, { cast: false });
        for (const at of [hole.a, mid, hole.b]) {
          slab(side, at - 0.032, at + 0.032, 0.02, HEAD, 0.085, frameMat, { receive: false });
        }
        slab(side, hole.a, hole.b, HEAD - 0.04, HEAD + 0.04, 0.11, frameMat, { receive: false });
        slab(side, hole.a, hole.b, 0, 0.03, 0.14, frameMat, { receive: false }); // track
      } else {
        // Sill under, header over: that silhouette is what makes an interior
        // read as an apartment rather than a box.
        slab(side, hole.a, hole.b, 0, SILL, SHELL_T, shellMat);
        slab(side, hole.a, hole.b, HEAD, h, SHELL_T, shellMat);
        slab(side, hole.a + 0.03, hole.b - 0.03, SILL, HEAD, 0.04, glassMat, { cast: false });
        const n = Math.max(1, Math.round((hole.b - hole.a) / 1.15));
        for (let i = 0; i <= n; i++) {
          const at = hole.a + ((hole.b - hole.a) * i) / n;
          slab(side, at - 0.028, at + 0.028, SILL, HEAD, 0.075, frameMat, { receive: false });
        }
        slab(side, hole.a, hole.b, SILL - 0.035, SILL + 0.035, 0.1, frameMat, { receive: false });
        slab(side, hole.a, hole.b, HEAD - 0.035, HEAD + 0.035, 0.1, frameMat, { receive: false });
      }
      cursor = hole.b;
    }
    if (cursor < run) slab(side, cursor, run, 0, h, SHELL_T, shellMat);
  });

  // ---- balcony ----------------------------------------------------------
  // Outside the shell, so it is not part of the [0,w]x[0,d] grid the rest of the
  // plan lives on. Every Indonesian unit type has one — in the mass market it is
  // the service area as much as a view, which is why the drying rack is standard
  // kit rather than decoration.
  (plan.balconies || []).forEach((bal, bi) => group(`balcony.${bi}`, () => {
    const S = SIDES[bal.side];
    const dep = bal.depth || 1.2;
    const outward = bal.side === 'n' ? 1 : bal.side === 's' ? -1 : 0;
    const outX = bal.side === 'e' ? 1 : bal.side === 'w' ? -1 : 0;
    const fixed = S.at(plan);
    const z0 = S.along === 'x' ? fixed : bal.at;
    const midA = bal.at + bal.len / 2;
    const slabMat = staticMat('#bdb6a8', { roughness: 0.9 });
    const railMat = staticMat('#3a3630', { roughness: 0.5, metalness: 0.35 });

    // Deck.
    if (S.along === 'x') {
      const cz = fixed + outward * (dep / 2 + SHELL_T / 2);
      add(box(bal.len, 0.1, dep), slabMat, midA, -0.05, cz, { cast: false });
      const edge = fixed + outward * (dep + SHELL_T / 2);
      // Railing: a top rail and vertical balusters. Glass would disappear at this
      // distance; the vertical rhythm is what reads as a balcony from inside.
      add(box(bal.len, 0.06, 0.06), railMat, midA, 1.05, edge, { receive: false });
      add(box(bal.len, 0.05, 0.05), railMat, midA, 0.45, edge, { receive: false });
      const n = Math.max(2, Math.round(bal.len / 0.14));
      for (let i = 0; i <= n; i++) {
        add(box(0.025, 1.05, 0.025), railMat, bal.at + (bal.len * i) / n, 0.525, edge, { receive: false });
      }
      for (const sx of [bal.at, bal.at + bal.len]) {
        add(box(0.06, 1.05, dep), railMat, sx, 0.525, cz, { receive: false });
      }
    } else {
      const cx = fixed + outX * (dep / 2 + SHELL_T / 2);
      add(box(dep, 0.1, bal.len), slabMat, cx, -0.05, midA, { cast: false });
      const edge = fixed + outX * (dep + SHELL_T / 2);
      add(box(0.06, 0.06, bal.len), railMat, edge, 1.05, midA, { receive: false });
      add(box(0.05, 0.05, bal.len), railMat, edge, 0.45, midA, { receive: false });
      const n = Math.max(2, Math.round(bal.len / 0.14));
      for (let i = 0; i <= n; i++) {
        add(box(0.025, 1.05, 0.025), railMat, edge, 0.525, bal.at + (bal.len * i) / n, { receive: false });
      }
    }
  }));

  // ---- what is outside ---------------------------------------------------
  // A balcony with nothing beyond it is worse than no balcony: the tour steps
  // out and the frame goes empty, which the audit reports as 0 subjects and a
  // viewer reads as "unfinished". A unit is also, in this market, sold partly on
  // being ABOVE something — so the ground is far below and there are neighbours.
  //
  // Deliberately crude: slabs at 30–90 m, no detail, no shadows. The scene fog
  // (30–92 m) does the rest, and anything more would be modelling a city to be
  // glimpsed for two seconds past a railing.
  if (plan.context !== false) {
    const level = (plan.context && plan.context.floor) || 18; // storeys up
    const drop = -level * 3.2;
    const ground = staticMat('#9aa08f', { roughness: 1 });
    const tower = staticMat('#b3ada2', { roughness: 1 });
    add(box(620, 0.4, 620), ground, w / 2, drop, d / 2, { cast: false, receive: false, context: true });
    const cx = w / 2, cz = d / 2;
    // Scattered on every side, not just past the balcony: the bedrooms have
    // windows too, and a window onto literal nothing is the same blank frame
    // the balcony had.
    // Pushed out to 70–190 m. The first ring sat at 30–90 m and 44–66 m tall,
    // which from the top-down intro — a camera 14 m up looking down at a 4 m
    // unit — meant the neighbours filled the frame and the plan disappeared
    // behind them. At this distance the scene fog (30–92 m) does most of the
    // work and they read as what they are: other towers, a long way off.
    const blocks = [
      [-88, 132, 22, 40], [34, 154, 28, 52], [116, 88, 24, 34],
      [-124, 74, 20, 28], [62, 76, 18, 24], [-30, 186, 32, 58],
      [128, -34, 24, 36], [-116, -22, 22, 30], [92, -104, 26, 44],
      [-78, -118, 20, 26], [18, -150, 30, 48], [166, 44, 20, 28],
    ];
    group('skyline', () => {
      for (const [ox, oz, bw, bh] of blocks) {
        add(box(bw, bh, bw * 0.8), tower, cx + ox, drop + bh / 2, cz + oz, { cast: false, receive: false, context: true });
      }
    });
  }

  // ---- partitions -------------------------------------------------------
  // `doors` are openings expressed as a fraction along the run, so a plan can be
  // rescaled without recomputing door positions by hand.
  (plan.partitions || []).forEach((p, pi) => group(`partition.${pi}`, () => {
    const mat = themedMat(p.room || 0, 'wall', { roughness: 1 });
    const len = Math.hypot(p.x2 - p.x1, p.z2 - p.z1);
    const ux = (p.x2 - p.x1) / len;
    const uz = (p.z2 - p.z1) / len;
    const top = p.h || h;
    const cuts = (p.doors || []).map((t) => [t * len - DOOR_W / 2, t * len + DOOR_W / 2])
      .sort((a, b) => a[0] - b[0]);
    const seg = (a, b, y0, y1) => {
      if (b - a < 0.02 || y1 - y0 < 0.02) return;
      const x1 = p.x1 + ux * a, z1 = p.z1 + uz * a;
      const x2 = p.x1 + ux * b, z2 = p.z1 + uz * b;
      const l = Math.hypot(x2 - x1, z2 - z1);
      const horizontal = Math.abs(ux) >= Math.abs(uz);
      add(horizontal ? box(l, y1 - y0, WALL_T) : box(WALL_T, y1 - y0, l), mat,
        (x1 + x2) / 2, (y0 + y1) / 2, (z1 + z2) / 2, { cast: true, receive: true });
    };
    let at = 0;
    for (const [c0, c1] of cuts) {
      seg(at, c0, 0, top);
      seg(c0, c1, DOOR_H, top); // header above the opening
      at = c1;
    }
    seg(at, len, 0, top);
  }));

  // ---- furniture --------------------------------------------------------
  // One folder per kind of thing, variations inside it — see furniture/index.js.
  // Each piece is drawn inside its own merge group, so a dining table and its
  // four chairs is thirteen boxes and two objects.
  placeAll(THREE, builders, plan.furniture, { h });

  return { floorMat, ceils };
}

export const APARTMENT_CONSTANTS = { WALL_T, SHELL_T, DOOR_W, DOOR_H, SILL, HEAD };
