// The drawing-sheet layout constants. These were duplicated verbatim at the top
// of every page file, so a margin tweak meant editing three files and remembering
// the third. Server-safe: plain objects, no React.

/** Page outer padding — the sheet margin. */
export const sheetX = 'clamp(20px, 6vw, 100px)';

/** Cormorant, for display type. Paired with `label` (Jost) from tokens.js. */
export const serif = { fontFamily: 'var(--font-serif), serif' };

/** PAPER at 60% — the translucent backing behind the sticky nav. */
export const PAPER_MUTED = 'rgba(233,227,216,.6)';
