// =====================================================================
//  The showroom — four apartment types, described as data.
//
//  Every listing portal already does a 360 photosphere: you stand on a tripod
//  point and spin. This is the other thing — you WALK. So the product is not
//  one demo scene any more, it is a set of unit types a developer actually
//  sells: studio, one-, two- and three-bedroom.
//
//  ── these are INDONESIAN units, and that is a specific shape ──────────────
//
//  The first version of this file was drawn from a Western brief: 38 / 53 / 76 /
//  104 m², wide frontages, kitchen islands, no balconies. Those are premium
//  Jakarta CBD numbers at best, and the plan shapes were wrong at any size.
//  Re-measured against the market this is for:
//
//    tipe      lapangan                                  here
//    studio    20–26 m²  (ITENAS study: 24–26)           24 m²
//    1BR       29–36 m²  (ITENAS: 29–34)                 33 m²
//    2BR       36–45 m²  (ITENAS: 41.08–44.00)           43 m²
//    3BR       52–70 m²  (ITENAS: 52)                    62 m²
//
//  Sources: a survey of Parahyangan Residence unit types (eprints.itenas.ac.id),
//  and the type guides at asthanakemang.co.id, strategis.id, interbox.id and
//  pinhome.id. Premium CBD stock runs larger — Asthana Kemang's own 3BR is
//  102–107 m² — so these numbers are the middle of the market, not its ceiling.
//  They are data: a developer with different unit sizes edits this table.
//
//  Three shape rules that matter more than the areas:
//
//    1. BALCONY. Every type has one, and in the mass market it is the service
//       area — where the laundry dries — as much as a view. A unit without one
//       is not an Indonesian unit, which is why the drying rack is standard kit
//       and why the tour walks out onto it rather than stopping at the glass.
//    2. NARROW FRONT, DEEP PLAN. These towers are double-loaded corridors, so a
//       unit gets a small piece of facade and runs back from it. A studio is
//       3.6 m wide, not 6.4.
//    3. SERVICE CORE AT THE DOOR. Bathroom and pantry sit by the entrance, with
//       no window; the living and sleeping space takes the facade. The first
//       version had it backwards.
//
//  Each unit is one object carrying two halves:
//    • plan     — geometry for buildApartment() (shell, partitions, windows,
//                 balconies, furniture). Deliberately low-detail: masses, not
//                 joinery.
//    • content  — the 8 project keys the engine already speaks (camera path,
//                 rooms, hotspots, plan pins). Identical in shape to a project
//                 a user saves, which is the point: a unit IS a project.
//
//  Swapping a unit for a Blender bake (or a Gaussian splat) later means
//  replacing `plan` and leaving `content` alone.
//
//  Geometry conventions (see lib/three/apartment.js):
//    x ∈ [0, w], z ∈ [0, d]; z = 0 is the entrance side, z = d is the facade,
//    and the balcony sits beyond z = d. Every coordinate is metres.
// =====================================================================

import { CONCEPTS, DAYLIGHT, BRAND } from './walkthrough.config.js';

const ROOM_COLORS = ['#e6c98a', '#8fb98f', '#d98f6a', '#8fa8c0', '#c9a2c4', '#b5c48f'];

/** Shared bits every unit repeats. Kept as a helper so a unit is only its plan. */
function unit({ key, name, area, beds, tagline, blurb, spec, plan, rooms, waypoints, intro, pins, hotspots }) {
  return {
    key,
    name,
    area,
    beds,
    tagline,
    blurb,
    spec,
    plan,
    content: {
      config: {
        unit: key,
        fov: 50,
        introFraction: 0.1,
        intro,
        waypoints,
      },
      CONCEPTS,
      ROOMS: rooms.map((n) => ({ name: n })),
      PLAN: pins,
      HOTSPOTS: hotspots,
      ROOM_COLORS: ROOM_COLORS.slice(0, rooms.length),
      DAYLIGHT,
      BRAND,
    },
  };
}

// ---------------------------------------------------------------------
//  Tipe Studio · 24 m² (20 m² indoor + 4 m² balkon)
//  3.6 m of facade. Wet core at the door, pantry down one wall, bed at the
//  window. No sofa and no island: at this size the bed is the seating and the
//  pantry is two burners and a sink.
// ---------------------------------------------------------------------
const STUDIO = unit({
  key: 'studio',
  name: 'Tipe Studio',
  area: 24,
  beds: 0,
  tagline: 'One room, a pantry, a balcony',
  blurb: 'The size most towers sell hardest: wet core by the door, a pantry down one wall, and the whole 3.6 m facade left to the bed and the balcony.',
  spec: '24 m² · 1 KM · balkon 4 m²',
  plan: {
    shell: { w: 3.6, d: 5.6, h: 2.7 },
    doors: [{ side: 's', at: 2.9 }],
    sliders: [{ side: 'n', at: 0.7, len: 1.8, open: 'start' }],
    windows: [{ side: 'n', at: 2.6, len: 0.8 }],
    balconies: [{ side: 'n', at: 0.1, len: 3.4, depth: 1.2 }],
    partitions: [
      { x1: 1.75, z1: 0, x2: 1.75, z2: 2.0, doors: [0.7], room: 0 },
      { x1: 0, z1: 2.0, x2: 1.75, z2: 2.0, room: 0 },
    ],
    zones: [{ x1: 0, z1: 0, x2: 1.75, z2: 2.0, floor: 'tile' }],
    furniture: [
      // kamar mandi
      { kind: 'bath', x: 0.7, z: 0.55, ry: 0, room: 0 },
      { kind: 'shower', x: 0.62, z: 1.62, ry: 0, room: 0, w: 0.95 },
      { kind: 'bath', variant: 'heater', x: 1.35, z: 0.22, ry: 0, room: 0 },
      // entrance: shoes come off at the threshold, so this is where the unit
      // actually starts and the first shot of the tour is pointed at it
      { kind: 'storage', variant: 'shoeCabinet', x: 1.95, z: 0.55, ry: Math.PI / 2, room: 0, len: 0.8 },
      // pantry — a short run, no island, no upper bank down the whole wall
      { kind: 'kitchen', variant: 'pantry', x: 0.42, z: 2.95, ry: Math.PI / 2, room: 1, len: 1.4 },
      { kind: 'storage', variant: 'slidingWardrobe', x: 3.19, z: 2.6, ry: -Math.PI / 2, room: 1, len: 1.2 },
      // tidur + balkon. A divan, not a bed: at 24 m² there is no second seat in
      // the unit, so the thing you sleep on is also the thing you sit on.
      { kind: 'bed', variant: 'divan', x: 2.72, z: 4.4, ry: 0, room: 2, back: 'right' },
      { kind: 'appliance', variant: 'acSplit', x: 3.38, z: 4.6, ry: -Math.PI / 2, room: 2 },
      { kind: 'rug', x: 1.15, z: 4.5, ry: 0, room: 2, w: 0.9, d: 1.8 },
      { kind: 'plant', x: 0.5, z: 5.25, room: 2 },
      { kind: 'dryingRack', x: 1.3, z: 6.35, ry: 0, room: 2, len: 1.0 },
      { kind: 'laundry', variant: 'washer', x: 0.6, z: 6.4, ry: 0, room: 2 },
      { kind: 'laundry', variant: 'line', x: 2.5, z: 6.72, ry: 0, room: 2, len: 1.4 },
      { kind: 'chair', variant: 'plastic', x: 2.35, z: 6.05, ry: -2.3, room: 2 },
      { kind: 'plant', variant: 'palm', x: 3.15, z: 6.4, room: 2 },
      // Hung on the rail, in the line the camera walks out along. The step-out
      // shot was a deck and a railing and nothing else — two objects, which the
      // audit calls flat and a viewer calls unfinished.
      { kind: 'plant', variant: 'hanging', x: 2.0, z: 6.84, room: 2, y: 1.5 },
    ],
  },
  rooms: ['Entrance & Bath', 'The Pantry', 'Sleeping & Balcony'],
  intro: { pos: [1.8, 12, -5], look: [1.8, 0, 3.0] },
  waypoints: [
    { pos: [2.9, 1.6, 0.78], look: [2.2, 1.3, 3.8], room: 0 },
    // Aimed at the vanity and mirror, not down the middle of the room. A 1.6 m
    // bathroom has one wall opposite its door and nothing else, so the obvious
    // framing is 73% of one flat surface.
    { pos: [2.45, 1.58, 1.42], look: [0.75, 1.12, 0.62], room: 0 },
    // Aimed down the unit past the pantry, not square at it: a 1.4 m counter
    // fills two thirds of a frame that is pointed at nothing else, and the
    // audit's dominance metric said so the moment the run merged into one mass.
    { pos: [2.2, 1.6, 2.75], look: [0.72, 1.16, 4.6], room: 1 },
    { pos: [1.1, 1.58, 4.3], look: [3.0, 1.25, 3.6], room: 2 },
    // Re-aimed once merging made the audit honest about this shot. It used to
    // point straight out of the slider, which from a balcony is three rows of
    // sky and one of decking — it only ever passed because the railing was
    // twenty-seven separate balusters and each counted as a thing in the frame.
    // Turned along the balcony instead: doorway edge, washing, plant, and the
    // view still in the corner of it.
    { pos: [1.05, 1.6, 4.92], look: [2.6, 1.15, 7.3], room: 2 },
    { pos: [1.15, 1.6, 6.35], look: [1.25, 1.28, 3.4], room: 2 },
  ],
  pins: [
    { x: 2.9, z: 0.5, name: 'Entrance' },
    { x: 0.9, z: 1.0, name: 'Kamar Mandi' },
    { x: 0.9, z: 2.95, name: 'Pantry' },
    { x: 2.45, z: 4.4, name: 'Sleeping' },
    { x: 1.8, z: 6.3, name: 'Balkon' },
  ],
  hotspots: [
    { room: 0, x: 0.7, y: 1.05, z: 0.57, title: 'Compact Vanity', meta: 'Quartz top · moisture-rated carcass' },
    { room: 1, x: 0.55, y: 1.0, z: 2.95, title: 'Pantry Run', meta: '1.4 m · two burners · under-counter fridge' },
    { room: 2, x: 2.45, y: 0.8, z: 4.4, title: 'Queen Bed', meta: 'Stonewashed cotton · ash frame' },
  ],
});

// ---------------------------------------------------------------------
//  Tipe 1 Kamar · 33 m² (28 m² indoor + 5 m² balkon)
//  4.2 m of facade. Bedroom on one side with a corridor past it, so you do not
//  walk through the bedroom to reach the living room — the mistake the first
//  draft of this plan made.
// ---------------------------------------------------------------------
const ONE_BED = unit({
  key: 'one-bed',
  name: 'Tipe 1 Kamar',
  area: 33,
  beds: 1,
  tagline: 'A door between living and sleeping',
  blurb: 'A proper bedroom behind a door, a corridor that gets past it without going through it, and the living end opening onto the balcony.',
  spec: '33 m² · 1 KT · 1 KM · balkon 5 m²',
  plan: {
    shell: { w: 4.2, d: 6.7, h: 2.75 },
    doors: [{ side: 's', at: 3.4 }],
    sliders: [{ side: 'n', at: 1.0, len: 1.8, open: 'end' }],
    windows: [{ side: 'n', at: 2.9, len: 1.0 }],
    balconies: [{ side: 'n', at: 0.2, len: 3.8, depth: 1.2 }],
    partitions: [
      { x1: 1.9, z1: 0, x2: 1.9, z2: 2.2, doors: [0.61], room: 0 },
      { x1: 0, z1: 2.2, x2: 2.6, z2: 2.2, room: 1 },
      { x1: 2.6, z1: 2.2, x2: 2.6, z2: 4.9, doors: [0.778], room: 1 },
      { x1: 0, z1: 4.9, x2: 2.6, z2: 4.9, room: 1 },
    ],
    zones: [{ x1: 0, z1: 0, x2: 1.9, z2: 2.2, floor: 'tile' }],
    furniture: [
      { kind: 'bath', x: 0.85, z: 0.6, ry: 0, room: 0 },
      { kind: 'shower', x: 0.66, z: 1.8, ry: 0, room: 0, w: 1.0 },
      { kind: 'bath', variant: 'heater', x: 1.6, z: 0.22, ry: 0, room: 0 },
      { kind: 'storage', variant: 'shoeCabinet', x: 2.1, z: 0.55, ry: Math.PI / 2, room: 0, len: 0.8 },
      // kamar tidur
      // The bed runs ACROSS the room, not along it. Lengthwise there is no wall
      // left for a wardrobe, and the wardrobe ends up parked in front of the
      // door — which is what the doorway shot then frames: 2.3 m of plain oak.
      { kind: 'bed', x: 1.17, z: 3.35, ry: Math.PI / 2, room: 1 },
      { kind: 'art', x: 0.17, z: 3.35, ry: Math.PI / 2, room: 1, w: 0.9, h: 0.62 },
      { kind: 'storage', variant: 'slidingWardrobe', x: 1.3, z: 4.55, ry: Math.PI, room: 1, len: 1.6 },
      { kind: 'appliance', variant: 'acSplit', x: 1.3, z: 2.32, ry: 0, room: 1 },
      // living + pantry
      // The fridge goes at the FAR end of the run, against the north wall. Beside
      // the bedroom door it is 1.72 m of eye-height mass 10 cm off the camera's
      // shoulder — which is also what it would be for a person, in a corridor
      // this plan only gives 1.5 m of.
      { kind: 'kitchen', variant: 'pantry', x: 3.8, z: 5.35, ry: -Math.PI / 2, room: 2, len: 1.2 },
      { kind: 'kitchen', variant: 'fridge', x: 3.75, z: 6.25, ry: -Math.PI / 2, room: 2 },
      { kind: 'sofa', variant: 'twoSeat', x: 1.5, z: 5.45, ry: 0, room: 2, len: 1.8 },
      { kind: 'table', variant: 'side', x: 2.6, z: 5.5, room: 2, r: 0.22 },
      { kind: 'rug', x: 1.5, z: 5.95, ry: 0, room: 2, w: 2.0, d: 1.2 },
      { kind: 'plant', x: 0.45, z: 6.25, room: 2 },
      { kind: 'appliance', variant: 'ceilingFan', x: 1.7, z: 6.0, room: 2 },
      // balkon
      { kind: 'dryingRack', x: 1.5, z: 7.45, ry: 0, room: 3, len: 1.1 },
      { kind: 'laundry', variant: 'washer', x: 0.65, z: 7.5, ry: 0, room: 3 },
      { kind: 'laundry', variant: 'line', x: 3.0, z: 7.82, ry: 0, room: 3, len: 1.6 },
      { kind: 'chair', variant: 'plastic', x: 3.0, z: 6.98, ry: -2.6, room: 3 },
      { kind: 'plant', x: 3.7, z: 7.2, room: 3, tall: true },
      { kind: 'plant', variant: 'hanging', x: 2.42, z: 7.94, room: 3, y: 1.5 },
    ],
  },
  rooms: ['The Entrance', 'The Bedroom', 'Living & Pantry', 'The Balcony'],
  intro: { pos: [2.1, 14, -6], look: [2.1, 0, 3.4] },
  waypoints: [
    { pos: [3.4, 1.6, 0.95], look: [3.0, 1.25, 4.4], room: 0 },
    { pos: [2.85, 1.58, 1.5], look: [0.9, 1.3, 1.32], room: 0 },
    { pos: [3.3, 1.6, 4.3], look: [0.9, 1.28, 3.5], room: 1 },
    { pos: [2.94, 1.58, 5.4], look: [1.2, 1.3, 6.4], room: 2 },
    { pos: [2.5, 1.6, 6.2], look: [1.5, 1.15, 7.9], room: 3 },
    { pos: [2.22, 1.6, 7.28], look: [2.4, 1.3, 4.9], room: 3 },
  ],
  pins: [
    { x: 3.4, z: 0.5, name: 'Entrance' },
    { x: 1.0, z: 1.1, name: 'Kamar Mandi' },
    { x: 1.3, z: 3.6, name: 'Kamar Tidur' },
    { x: 3.7, z: 5.7, name: 'Pantry' },
    { x: 1.5, z: 5.8, name: 'Living' },
    { x: 2.1, z: 7.4, name: 'Balkon' },
  ],
  hotspots: [
    { room: 1, x: 1.05, y: 0.8, z: 3.62, title: 'Queen Bed', meta: 'Stonewashed flax · ash frame' },
    { room: 2, x: 1.5, y: 0.85, z: 5.45, title: 'Two-Seat Sofa', meta: 'Wool blend · solid oak frame' },
    { room: 2, x: 3.7, y: 1.0, z: 5.7, title: 'Pantry Run', meta: 'Quartz top · oak cabinetry' },
  ],
});

// ---------------------------------------------------------------------
//  Tipe 2 Kamar · 43 m² (40 m² indoor + 3.6 m² balkon)
//  6.0 m of facade. Both bedrooms stacked down the west side, service core at
//  the door, and an east strip that runs hall → kitchen → living → balcony.
//  Both bedrooms are shot from their doorways: a 2.9 m room with a 1.6 m bed in
//  it has nowhere for a camera to stand, and pretending otherwise is how you get
//  a shot of a wardrobe door.
// ---------------------------------------------------------------------
const TWO_BED = unit({
  key: 'two-bed',
  name: 'Tipe 2 Kamar',
  area: 43,
  beds: 2,
  tagline: 'Two rooms off one run',
  blurb: 'The family starter: bedrooms down one flank, wet core at the door, and a single open run from the kitchen to the balcony.',
  spec: '43 m² · 2 KT · 1 KM · balkon 3.6 m²',
  plan: {
    shell: { w: 6.0, d: 6.6, h: 2.75 },
    doors: [{ side: 's', at: 4.9 }],
    sliders: [{ side: 'n', at: 3.4, len: 1.8, open: 'end' }],
    windows: [
      { side: 'n', at: 0.4, len: 2.2 },
      { side: 'e', at: 4.9, len: 1.2 },
    ],
    balconies: [{ side: 'n', at: 3.0, len: 2.9, depth: 1.2 }],
    partitions: [
      { x1: 2.2, z1: 0, x2: 2.2, z2: 2.0, doors: [0.7], room: 0 },
      { x1: 0, z1: 2.0, x2: 3.0, z2: 2.0, room: 1 },
      { x1: 3.0, z1: 2.0, x2: 3.0, z2: 4.2, doors: [0.55], room: 1 },
      { x1: 0, z1: 4.2, x2: 3.0, z2: 4.2, room: 4 },
      { x1: 3.0, z1: 4.2, x2: 3.0, z2: 6.6, doors: [0.33], room: 4 },
    ],
    zones: [{ x1: 0, z1: 0, x2: 2.2, z2: 2.0, floor: 'tile' }],
    furniture: [
      { kind: 'bath', x: 0.95, z: 0.58, ry: 0, room: 0 },
      { kind: 'shower', x: 0.72, z: 1.7, ry: 0, room: 0, w: 1.05 },
      { kind: 'bath', variant: 'heater', x: 1.75, z: 0.22, ry: 0, room: 0 },
      { kind: 'storage', variant: 'shoeCabinet', x: 2.4, z: 0.55, ry: Math.PI / 2, room: 0, len: 0.8 },
      // kamar tidur 2 (anak) — bunks. Two children to a room is the normal case
      // at this size, and two singles would claim floor the unit does not have.
      { kind: 'bed', variant: 'bunk', x: 0.85, z: 3.05, ry: 0, room: 1 },
      { kind: 'art', x: 0.85, z: 2.12, ry: 0, room: 1, w: 0.8, h: 0.56 },
      { kind: 'storage', variant: 'wardrobe', x: 2.25, z: 3.83, ry: Math.PI, room: 1, len: 1.3 },
      // dapur + living
      { kind: 'kitchen', variant: 'run', x: 5.58, z: 3.0, ry: -Math.PI / 2, room: 2, len: 2.0 },
      { kind: 'kitchen', variant: 'fridge', x: 5.5, z: 4.4, ry: -Math.PI / 2, room: 2 },
      { kind: 'table', variant: 'dining', x: 4.3, z: 3.1, ry: 0, room: 2, len: 1.1, seats: 4 },
      { kind: 'pendant', x: 4.3, z: 3.1, room: 2 },
      { kind: 'sofa', variant: 'twoSeat', x: 4.4, z: 5.5, ry: 0, room: 3, len: 1.8 },
      { kind: 'rug', x: 4.4, z: 5.95, ry: 0, room: 3, w: 2.0, d: 1.2 },
      { kind: 'plant', variant: 'palm', x: 3.3, z: 6.2, room: 3 },
      { kind: 'appliance', variant: 'ceilingFan', x: 4.5, z: 5.9, room: 3 },
      // kamar utama
      { kind: 'bed', x: 1.55, z: 5.45, ry: 0, room: 4 },
      { kind: 'art', x: 1.55, z: 4.35, ry: 0, room: 4, w: 0.95, h: 0.66 },
      { kind: 'storage', variant: 'slidingWardrobe', x: 1.6, z: 6.28, ry: Math.PI, room: 4, len: 1.5 },
      { kind: 'appliance', variant: 'acSplit', x: 1.55, z: 4.32, ry: 0, room: 4 },
      // balkon
      { kind: 'dryingRack', x: 3.9, z: 7.35, ry: 0, room: 3, len: 1.1 },
      { kind: 'laundry', variant: 'washer', x: 3.35, z: 7.7, ry: 0, room: 3 },
      { kind: 'laundry', variant: 'line', x: 5.1, z: 7.72, ry: 0, room: 3, len: 1.3 },
      { kind: 'plant', x: 5.7, z: 7.0, room: 3, tall: true },
    ],
  },
  rooms: ['The Entrance', 'Second Bedroom', 'Kitchen & Dining', 'Living & Balcony', 'Master Bedroom'],
  intro: { pos: [3.0, 16, -6], look: [3.0, 0, 3.4] },
  waypoints: [
    { pos: [4.9, 1.6, 0.95], look: [4.4, 1.25, 4.4], room: 0 },
    { pos: [4.2, 1.58, 1.45], look: [1.1, 1.3, 1.28], room: 0 },
    { pos: [4.15, 1.58, 3.21], look: [1.1, 1.3, 3.3], room: 1 },
    { pos: [4.2, 1.6, 3.9], look: [5.6, 1.28, 2.4], room: 2 },
    { pos: [4.2, 1.58, 4.99], look: [1.2, 1.3, 5.2], room: 4 },
    { pos: [4.75, 1.6, 5.2], look: [4.85, 1.3, 7.6], room: 3 },
    { pos: [4.7, 1.6, 7.15], look: [4.2, 1.3, 4.6], room: 3 },
  ],
  pins: [
    { x: 4.9, z: 0.5, name: 'Entrance' },
    { x: 1.1, z: 1.0, name: 'Kamar Mandi' },
    { x: 1.4, z: 3.1, name: 'Kamar 2' },
    { x: 5.4, z: 3.0, name: 'Dapur' },
    { x: 4.3, z: 3.1, name: 'Dining' },
    { x: 1.5, z: 5.5, name: 'Kamar Utama' },
    { x: 4.4, z: 5.7, name: 'Living' },
    { x: 4.4, z: 7.3, name: 'Balkon' },
  ],
  hotspots: [
    { room: 1, x: 0.85, y: 0.75, z: 3.15, title: 'Single Bed', meta: 'Washed cotton · ash frame' },
    { room: 2, x: 5.4, y: 1.0, z: 3.0, title: 'Kitchen Run', meta: '2.0 m · quartz top · oak cabinetry' },
    { room: 3, x: 4.4, y: 0.85, z: 5.5, title: 'Two-Seat Sofa', meta: 'Wool blend · solid oak frame' },
    { room: 4, x: 1.55, y: 0.8, z: 5.45, title: 'Queen Bed', meta: 'Stonewashed flax · ash frame' },
  ],
});

// ---------------------------------------------------------------------
//  Tipe 3 Kamar · 62 m² (58 m² indoor + 4.3 m² balkon)
//  7.2 m of facade and a central corridor with three doors off it — the plan
//  every family-sized Indonesian unit converges on. Living and kitchen take the
//  whole facade end.
// ---------------------------------------------------------------------
const THREE_BED = unit({
  key: 'three-bed',
  name: 'Tipe 3 Kamar',
  area: 62,
  beds: 3,
  tagline: 'A corridor with three doors',
  blurb: 'The family plan: three bedrooms off one spine, the wet core by the entrance, and an open kitchen-to-living run across the whole facade.',
  spec: '62 m² · 3 KT · 2 KM · balkon 4.3 m²',
  plan: {
    shell: { w: 7.2, d: 8.0, h: 2.8 },
    doors: [{ side: 's', at: 3.7 }],
    sliders: [{ side: 'n', at: 2.0, len: 1.8, open: 'end' }],
    windows: [
      { side: 'n', at: 4.2, len: 2.6 },
      { side: 'w', at: 2.6, len: 1.6 },
      { side: 'e', at: 0.9, len: 1.2 },
      { side: 'e', at: 3.2, len: 1.6 },
    ],
    balconies: [{ side: 'n', at: 1.6, len: 2.6, depth: 1.2 }],
    partitions: [
      // wet core + third bedroom, west of the corridor
      { x1: 3.0, z1: 0, x2: 3.0, z2: 2.0, doors: [0.62], room: 0 },
      { x1: 0, z1: 2.0, x2: 3.0, z2: 2.0, room: 2 },
      { x1: 3.0, z1: 2.0, x2: 3.0, z2: 5.0, doors: [0.5], room: 2 },
      { x1: 0, z1: 5.0, x2: 3.0, z2: 5.0, room: 4 },
      // second bedroom + master, east of the corridor
      { x1: 4.4, z1: 0, x2: 4.4, z2: 2.6, doors: [0.62], room: 1 },
      { x1: 4.4, z1: 2.6, x2: 7.2, z2: 2.6, room: 1 },
      { x1: 4.4, z1: 2.6, x2: 4.4, z2: 5.6, doors: [0.62], room: 3 },
      { x1: 4.4, z1: 5.6, x2: 7.2, z2: 5.6, room: 3 },
    ],
    zones: [{ x1: 0, z1: 0, x2: 3.0, z2: 2.0, floor: 'tile' }],
    furniture: [
      // kamar mandi
      { kind: 'bath', x: 1.0, z: 0.6, ry: 0, room: 0 },
      { kind: 'shower', x: 0.78, z: 1.7, ry: 0, room: 0, w: 1.1 },
      { kind: 'bath', variant: 'heater', x: 1.9, z: 0.22, ry: 0, room: 0 },
      { kind: 'storage', variant: 'shoeCabinet', x: 3.2, z: 0.55, ry: Math.PI / 2, room: 0, len: 0.8 },
      // kamar 2 (depan, timur) — the room that becomes the study
      { kind: 'bed', variant: 'single', x: 5.95, z: 1.4, ry: 0, room: 1 },
      { kind: 'art', x: 5.95, z: 0.38, ry: 0, room: 1, w: 0.8, h: 0.56 },
      { kind: 'storage', variant: 'wardrobe', x: 4.95, z: 2.3, ry: Math.PI, room: 1, len: 1.0 },
      { kind: 'appliance', variant: 'acSplit', x: 5.95, z: 0.28, ry: 0, room: 1 },
      // kamar 3 (barat)
      { kind: 'bed', x: 1.5, z: 3.35, ry: 0, room: 2 },
      { kind: 'art', x: 1.5, z: 2.32, ry: 0, room: 2, w: 0.95, h: 0.66 },
      { kind: 'storage', variant: 'slidingWardrobe', x: 1.5, z: 4.7, ry: Math.PI, room: 2, len: 1.5 },
      { kind: 'table', variant: 'desk', x: 2.55, z: 2.75, ry: -Math.PI / 2, room: 2, len: 1.0, d: 0.5 },
      { kind: 'chair', variant: 'desk', x: 2.05, z: 2.75, ry: -Math.PI / 2, room: 2 },
      // kamar utama (timur, belakang)
      { kind: 'bed', x: 6.0, z: 4.0, ry: 0, room: 3 },
      { kind: 'art', variant: 'diptych', x: 6.0, z: 2.9, ry: 0, room: 3, h: 0.62 },
      { kind: 'storage', variant: 'slidingWardrobe', x: 5.9, z: 5.3, ry: Math.PI, room: 3, len: 1.6 },
      { kind: 'appliance', variant: 'acSplit', x: 6.0, z: 2.78, ry: 0, room: 3 },
      { kind: 'plant', x: 6.9, z: 5.2, room: 3 },
      // dapur + living, sepanjang fasad
      { kind: 'kitchen', variant: 'run', x: 6.78, z: 6.7, ry: -Math.PI / 2, room: 4, len: 2.2 },
      { kind: 'kitchen', variant: 'fridge', x: 6.72, z: 5.35, ry: -Math.PI / 2, room: 4 },
      { kind: 'table', variant: 'dining', x: 5.2, z: 6.5, ry: 0, room: 4, len: 1.3, seats: 4 },
      { kind: 'lighting', variant: 'pendantRow', x: 5.2, z: 6.5, room: 4, n: 2, len: 0.7 },
      { kind: 'sofa', variant: 'lShape', x: 1.7, z: 5.9, ry: 0, room: 4, len: 2.2, d: 0.9, arm: 1.0, hand: 'left' },
      { kind: 'rug', x: 2.6, z: 6.9, ry: 0, room: 4, w: 2.0, d: 1.2 },
      { kind: 'storage', variant: 'shelf', x: 0.42, z: 7.3, ry: Math.PI / 2, room: 4, len: 0.9, h: 1.7 },
      { kind: 'appliance', variant: 'ceilingFan', x: 2.6, z: 6.8, room: 4 },
      // balkon
      { kind: 'dryingRack', x: 3.4, z: 8.5, ry: 0, room: 4, len: 1.0 },
      { kind: 'laundry', variant: 'washer', x: 1.95, z: 8.62, ry: 0, room: 4 },
      { kind: 'laundry', variant: 'line', x: 2.9, z: 9.12, ry: 0, room: 4, len: 1.2 },
      { kind: 'plant', variant: 'palm', x: 3.95, z: 8.98, room: 4 },
      { kind: 'plant', variant: 'hanging', x: 2.35, z: 9.24, room: 4, y: 1.5 },
    ],
  },
  rooms: ['The Entrance', 'Second Bedroom', 'Third Bedroom', 'Master Bedroom', 'Kitchen & Living'],
  intro: { pos: [3.6, 18, -7], look: [3.6, 0, 4.0] },
  waypoints: [
    { pos: [3.7, 1.6, 0.95], look: [3.7, 1.25, 4.6], room: 0 },
    { pos: [3.7, 1.58, 1.6], look: [6.6, 1.3, 1.5], room: 1 },
    { pos: [3.7, 1.58, 1.28], look: [1.0, 1.3, 1.2], room: 0 },
    { pos: [3.7, 1.58, 3.5], look: [1.0, 1.3, 3.4], room: 2 },
    { pos: [3.72, 1.58, 4.46], look: [6.6, 1.3, 4.3], room: 3 },
    { pos: [3.7, 1.6, 6.1], look: [1.8, 1.28, 7.2], room: 4 },
    { pos: [3.7, 1.6, 7.1], look: [6.4, 1.28, 6.6], room: 4 },
    { pos: [3.35, 1.6, 7.55], look: [2.2, 1.15, 9.3], room: 4 },
    { pos: [2.9, 1.6, 8.85], look: [3.4, 1.3, 6.2], room: 4 },
  ],
  pins: [
    { x: 3.7, z: 0.5, name: 'Entrance' },
    { x: 1.1, z: 1.0, name: 'Kamar Mandi' },
    { x: 6.0, z: 1.4, name: 'Kamar 2' },
    { x: 1.5, z: 3.5, name: 'Kamar 3' },
    { x: 6.0, z: 4.1, name: 'Kamar Utama' },
    { x: 6.4, z: 6.6, name: 'Dapur' },
    { x: 1.8, z: 6.9, name: 'Living' },
    { x: 2.9, z: 8.7, name: 'Balkon' },
  ],
  hotspots: [
    { room: 2, x: 1.5, y: 0.8, z: 3.5, title: 'Queen Bed', meta: 'Washed cotton · ash frame' },
    { room: 3, x: 6.0, y: 0.8, z: 4.0, title: 'Master Bed', meta: 'Stonewashed flax · ash frame' },
    { room: 4, x: 6.4, y: 1.0, z: 6.7, title: 'Kitchen Run', meta: '2.2 m · quartz top · oak cabinetry' },
    { room: 4, x: 1.6, y: 0.85, z: 6.6, title: 'Three-Seat Sofa', meta: 'Wool blend · solid oak frame' },
  ],
});

/** Every unit, in the order a showroom would walk a buyer through them. */
export const UNITS = [STUDIO, ONE_BED, TWO_BED, THREE_BED];

/** Slug → unit. */
export const UNIT_BY_KEY = Object.fromEntries(UNITS.map((u) => [u.key, u]));

/** The unit a bare /tour opens. */
export const DEFAULT_UNIT = 'one-bed';

/**
 * Resolve a unit key coming off a URL or a saved bundle.
 * Unknown keys return null rather than throwing: the caller falls back to the
 * legacy loft scene, which is what a project saved before the showroom existed
 * expects to see.
 * @param {unknown} key
 */
export function unitFor(key) {
  return (typeof key === 'string' && UNIT_BY_KEY[key]) || null;
}
