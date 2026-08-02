// =====================================================================
//  Walkthrough configuration — the single place to author a project.
//  Everything here is plain data (no three.js), safe to import anywhere.
//
//  • config.waypoints — camera path. Each = { pos:[x,y,z], look:[x,y,z], room }
//  • config.intro     — top-down plan pose the scroll descends FROM
//  • config.fov       — field of view (deg)
//  Author the path visually in /editor (Scenes), or measure it headlessly with
//    node scripts/audit-path.mjs --suggest
//  which raycasts every waypoint and reports what the frame actually contains.
// =====================================================================

/** @typedef {{ pos:[number,number,number], look:[number,number,number], room:number }} Waypoint */

export const config = {
  fov: 50,
  introFraction: 0.1, // top portion of scroll spent descending from the plan
  intro: { pos: [7, 25, -1], look: [7.5, 0, -5] },
  /** @type {Waypoint[]} */
  waypoints: [
    { pos: [0, 1.62, 8], look: [0, 1.2, -2], room: 0 },
    // Re-aimed when the audit learned to measure how much of the frame one
    // object takes: this shot was 67% a single wall plane.
    { pos: [-0.3, 1.56, 2.9], look: [-4.26, 0.95, -0.24], room: 0 },
    { pos: [-1.0, 1.55, 0], look: [-4, 1.1, -1], room: 0 },
    { pos: [-1.2, 1.56, -2], look: [-4.5, 1.05, -1], room: 0 },
    // Re-measured when the audit started casting 16 clearance rays instead of 8:
    // the old position read as clear only because the direction that mattered
    // fell between two samples, and the camera was 2 cm off the kitchen wall.
    { pos: [-0.3, 1.6, -3.4], look: [4.58, 1.6, -2.65], room: 1 },
    { pos: [5.5, 1.6, -1.5], look: [9, 1.2, -1], room: 1 },
    { pos: [10.5, 1.55, 1.2], look: [13, 1.15, -2], room: 1 },
    { pos: [13.4, 1.58, -1.05], look: [8.82, 1.58, -4.68], room: 1 },
    // Through the kitchen/bedroom opening rather than through the wall beside
    // it. The old path crossed a solid plane at x≈12.4 — invisible in a still,
    // one frame of flat colour mid-scroll.
    { pos: [16.8, 1.58, -5], look: [14.6, 1.2, -9.2], room: 2, door: true },
    { pos: [14.4, 1.56, -7.7], look: [12, 1.1, -13], room: 2 },
    { pos: [12, 1.55, -9.5], look: [12, 1.0, -14], room: 2 },
    { pos: [10.7, 1.6, -10.6], look: [14.54, 0.91, -14.65], room: 2 },
  ],
};

// Material/colour schemes a room can switch between. `pal` keys are the
// semantic roles the scene geometry references (wall, rug, uph, wood, …).
export const CONCEPTS = [
  { name: 'Warm Minimal', pal: { wall: '#e8e1d6', rug: '#d8cdba', uph: '#cfc6b6', wood: '#b78a52', accent: '#2c2620', metal: '#7d7468', stone: '#e7e3da' } },
  { name: 'Japandi', pal: { wall: '#d6d0c4', rug: '#b6a587', uph: '#97a07f', wood: '#cba66c', accent: '#b5572f', metal: '#474640', stone: '#cfcabf' } },
  { name: 'Editorial', pal: { wall: '#39342e', rug: '#6d5942', uph: '#ece5d8', wood: '#5a3a25', accent: '#c2592b', metal: '#1b1916', stone: '#cdc7bb' } },
];

export const ROOMS = [
  { name: 'The Living Room' },
  { name: 'The Kitchen' },
  { name: 'The Bedroom' },
];

// Floor-plan pins shown during the top-down intro.
export const PLAN = [
  { x: 0, z: 7, name: 'Entrance' },
  { x: -2, z: -1.5, name: 'Living' },
  { x: 12, z: -1, name: 'Kitchen' },
  { x: 12, z: -11, name: 'Bedroom' },
];

// Clickable material callouts, anchored in world space, shown per room.
export const HOTSPOTS = [
  { room: 0, x: -4.0, y: 0.95, z: -1.0, title: 'Bouclé Sofa', meta: 'Wool blend · solid oak frame' },
  { room: 1, x: 12.0, y: 1.05, z: 0.3, title: 'Monolith Island', meta: 'Honed stone · oak cabinetry' },
  { room: 2, x: 12.0, y: 0.8, z: -12.2, title: 'Belgian Linen Bed', meta: 'Stonewashed flax · ash frame' },
];

// Per-room accent used by the path-flow keyframe chips.
export const ROOM_COLORS = ['#e6c98a', '#8fb98f', '#d98f6a'];

// Daylight presets (the engine re-bakes shadows when this changes).
export const DAYLIGHT = {
  Soft: { sun: 2.2, sunC: '#fff1da', hemi: 0.52, bg: '#e9e3d8', exp: 1.05 },
  Bright: { sun: 3.1, sunC: '#fffaf0', hemi: 0.74, bg: '#f1ece2', exp: 1.12 },
  Dusk: { sun: 1.6, sunC: '#ffc88f', hemi: 0.36, bg: '#d8ccbd', exp: 0.95 },
};

export const BRAND = {
  wordmark: 'RAHMAN 3D INTERIOR',
  tagline: 'Apartment Walkthroughs',
  accent: '#c2592b',
  ink: '#2b2620',
  paper: '#e9e3d8',
};
