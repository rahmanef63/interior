// Toolbar glyphs. Line icons on a 24-unit grid, stroked not filled, so they read
// at 18px on a laptop and stay legible against the paper background.
//
// Drawn rather than pulled from a pack: the set an architect expects (orbit,
// pan, look around, walk, position camera) is CAD-specific and no general icon
// library has all of it, so half would have been approximations anyway.

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };

const wrap = (children, size = 18) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
    <g {...S}>{children}</g>
  </svg>
);

/** Arrow cursor — Select. */
export const IconSelect = (p) => wrap(<><path d="M5 3l6.5 16 2.2-6.3L20 10.5z" /></>, p?.size);

/** Two arcs around a sphere — Orbit. */
export const IconOrbit = (p) => wrap(
  <><circle cx="12" cy="12" r="5.4" />
    <path d="M3.2 9.6c3.2-1.6 14.4-1.6 17.6 0" />
    <path d="M20.8 14.4c-3.2 1.6-14.4 1.6-17.6 0" />
    <path d="M4.4 8l-1.2 1.6L5 10.6" /></>, p?.size);

/** Hand — Pan. */
export const IconPan = (p) => wrap(
  <><path d="M9 11V5.6a1.3 1.3 0 012.6 0V11" />
    <path d="M11.6 10.6V4.9a1.3 1.3 0 012.6 0v5.7" />
    <path d="M14.2 11V6.7a1.3 1.3 0 012.6 0V13" />
    <path d="M9 11V9.2a1.3 1.3 0 00-2.6 0v5.2c0 3.3 2.3 6 5.9 6 3.3 0 5.5-2.2 5.5-5.6V13" /></>, p?.size);

/** Magnifier with a plus — Zoom. */
export const IconZoom = (p) => wrap(
  <><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /><path d="M8 10.5h5M10.5 8v5" /></>, p?.size);

/** Corner brackets around a box — Zoom Extents. */
export const IconExtents = (p) => wrap(
  <><path d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5" /><rect x="8" y="8" width="8" height="8" rx="1" /></>, p?.size);

/** Eye — Look Around. */
export const IconLook = (p) => wrap(
  <><path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" /><circle cx="12" cy="12" r="2.6" /></>, p?.size);

/** Walking figure — Walk. */
export const IconWalk = (p) => wrap(
  <><circle cx="13" cy="4.4" r="1.7" /><path d="M11 21l1.6-5.2-2.1-2.4.9-4.4" />
    <path d="M10.4 9l3.4-1.2 2 3.2 2.6 1" /><path d="M15 13.6l1.4 3.1 1.9 2.4" /><path d="M10.4 9L7.6 11l-1.4 3" /></>, p?.size);

/** Camera on a pin — Position Camera. */
export const IconPlaceCamera = (p) => wrap(
  <><path d="M4 8.6h3.1l1.3-1.8h5.4l1.3 1.8H18a1.4 1.4 0 011.4 1.4v5.2A1.4 1.4 0 0118 16.6H4a1.4 1.4 0 01-1.4-1.4V10A1.4 1.4 0 014 8.6z" />
    <circle cx="11" cy="12.6" r="2.3" /><path d="M11 16.6V21" /></>, p?.size);

/** Grid — display toggle. */
export const IconGrid = (p) => wrap(
  <><rect x="3" y="3" width="18" height="18" rx="1" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /></>, p?.size);

/** Numbered flag — Scenes. */
export const IconScene = (p) => wrap(
  <><path d="M6 21V4" /><path d="M6 4.6h11l-2.4 3.4L17 11.4H6z" /></>, p?.size);

/** Layers — model. */
export const IconModel = (p) => wrap(
  <><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></>, p?.size);

/** Play triangle — Present. */
export const IconPresent = (p) => wrap(<><path d="M7 4.5l12 7.5-12 7.5z" /></>, p?.size);

/** Floppy-less save: down arrow into a tray. */
export const IconSave = (p) => wrap(
  <><path d="M12 3v10" /><path d="M8.5 9.5L12 13l3.5-3.5" /><path d="M4 15v4a1.5 1.5 0 001.5 1.5h13A1.5 1.5 0 0020 19v-4" /></>, p?.size);

/** Ceiling / roof toggle. */
export const IconCeiling = (p) => wrap(<><path d="M3 11l9-6 9 6" /><path d="M5.5 12.5V20h13v-7.5" /></>, p?.size);
