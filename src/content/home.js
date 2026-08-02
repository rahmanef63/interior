// Copy and data for the marketing pages. Split out of app/page.jsx, which had
// grown to ~1000 lines with every list written inline inside the JSX — editing a
// room name meant scrolling through markup to find it.
//
// Anything that also exists in the 3D scene is DERIVED from walkthrough.config.js
// rather than retyped. Those had already drifted apart once: the concept names on
// the home page are the labels the tour actually renders, and the plan pins in the
// CTA are the pins the tour actually draws.
import { CONCEPTS } from '../config/walkthrough.config.js';
import { UNITS, DEFAULT_UNIT, UNIT_BY_KEY } from '../config/units.js';

/** Concept labels exactly as the tour renders them. */
export const CONCEPT_NAMES = CONCEPTS.map((c) => c.name);

/** Unit types exactly as the showroom sells them. */
export const UNIT_SPECS = UNITS.map((u) => `${u.name} ${u.area} m²`);

/** Floor-plan pin names exactly as the default unit's tour draws them. */
export const PLAN_NAMES = UNIT_BY_KEY[DEFAULT_UNIT].content.PLAN.map((p) => p.name);

/**
 * Primary nav. `hash` is an in-page anchor (used as-is on the home page, prefixed
 * with `/` elsewhere); `href` overrides it with a real route.
 */
export const NAV = [
  { id: 'services', hash: '#services', n: '01', t: 'Experience' },
  { id: 'work', hash: '#work', n: '02', t: 'Concepts' },
  { id: 'studio', hash: '#studio', n: '03', t: 'About' },
  { id: 'approach', hash: '#approach', n: '04', t: 'How it works' },
  { id: 'gallery', href: '/gallery', n: '05', t: 'Showroom' },
  { id: 'editor', href: '/editor', n: '06', t: 'Editor' },
];

/** §02 The Experience — what a visitor can actually do. */
export const EXPERIENCE = [
  {
    no: '01',
    t: 'Walk the Unit',
    spec: 'Scroll to move · nothing to learn',
    note: 'The camera descends from the floor plan and walks the apartment — entrance, kitchen, living, bedrooms. A 360 puts you on a tripod point; this takes you through the door.',
  },
  {
    no: '02',
    t: 'Compare the Types',
    spec: UNIT_SPECS.join(' · '),
    note: 'Four plans, switched from inside the tour. Nobody buys a floor plan without holding it against the one next door.',
  },
  {
    no: '03',
    t: 'Switch the Concept',
    spec: CONCEPT_NAMES.join(' · '),
    note: 'Retint a whole room’s materials to a different design scheme in real time, as you pass through it — and change the daylight from Soft to Dusk while you are there.',
  },
  {
    no: '04',
    t: 'Bring Your Own',
    spec: 'Upload · save · share',
    note: 'Drop in your own .glb — a unit baked in Blender, say — set your own camera path in the editor, save it to an account, and share an unlisted link.',
  },
];

/**
 * §03 Concept Studies. `style` is validated against CONCEPT_NAMES below, so a
 * renamed concept in the 3D config fails the build instead of silently leaving a
 * stale label on the home page.
 */
export const WORK = [
  { fig: 'FIG. 01', room: 'Hillside Living Room', note: 'Lime plaster · oak · travertine', style: 'Warm Minimal', chip: '#cdbfa6', g: 'linear-gradient(145deg, #d8cdb8 0%, #c9bca2 55%, #b7a98c 100%)' },
  { fig: 'FIG. 02', room: 'Galley Kitchen', note: 'Soapstone · ash · brushed brass', style: 'Japandi', chip: '#9aa79b', g: 'linear-gradient(145deg, #c4c8bd 0%, #a9b1a4 60%, #8f9a8c 100%)' },
  { fig: 'FIG. 03', room: 'Reading Bedroom', note: 'Linen · walnut · wool boucle', style: 'Editorial', chip: '#b89a86', g: 'linear-gradient(145deg, #d6c4b6 0%, #c2a995 60%, #a88a74 100%)' },
  { fig: 'FIG. 04', room: 'Garden Entrance', note: 'Lime wash · terracotta · iron', style: 'Warm Minimal', chip: '#c79a6e', g: 'linear-gradient(145deg, #ddc8ab 0%, #cdaf86 60%, #b8966a 100%)' },
  { fig: 'FIG. 05', room: 'Courtyard Dining', note: 'Microcement · elm · rattan', style: 'Japandi', chip: '#a59683', g: 'linear-gradient(145deg, #cdc2af 0%, #b6a88f 60%, #9c8d73 100%)' },
  { fig: 'FIG. 06', room: 'Quiet Study', note: 'Bookcloth · ebonised oak · brass', style: 'Editorial', chip: '#8c7d6e', g: 'linear-gradient(145deg, #c2b6a4 0%, #a3947f 60%, #847463 100%)' },
];

const unknown = WORK.map((w) => w.style).filter((s) => !CONCEPT_NAMES.includes(s));
if (unknown.length) {
  throw new Error(
    'content/home.js: WORK references concepts that do not exist in walkthrough.config.js: '
    + [...new Set(unknown)].join(', ')
    + '. Known concepts: ' + CONCEPT_NAMES.join(', ')
  );
}

/** §04 About — the spec strip. */
export const ABOUT_FACTS = [
  ['No. 04', 'About'],
  ['Built', '2026'],
  ['Made by', 'Rahman'],
  ['Stack', 'three.js · Next.js'],
];

/** §05 How it works. */
export const STEPS = [
  { n: '01', t: 'Scroll', d: 'The page scroll is the walk. Start on the floor plan, descend through the entrance, and move room to room.' },
  { n: '02', t: 'Compare', d: 'Switch unit type mid-tour — studio, one, two or three bed — and see the same walk through a different plan.' },
  { n: '03', t: 'Bring', d: 'Upload your own .glb — a unit baked in Blender, within the size and complexity limits — and it takes the shell’s place.' },
  { n: '04', t: 'Share', d: 'Set the camera path in the editor, save to an account, and copy an unlisted link. Anyone can open it and walk it.' },
];

/** Footer — off-site links. */
export const ELSEWHERE = [
  ['rahmanef.com', 'https://rahmanef.com'],
  ['GitHub', 'https://github.com/rahmanef63'],
];

export const CONTACT_EMAIL = 'rahmanef63@gmail.com';
export const SITE_NAME = 'Rahman 3D Interior';
