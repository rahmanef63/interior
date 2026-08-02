// Shared brand tokens for the site chrome (server + client components).
// Mirrors BRAND in walkthrough.config.js — change both when rebranding.

export const INK = '#2b2620';
export const PAPER = '#e9e3d8';
export const ACCENT = '#c2592b';

// ACCENT on PAPER is 3.46:1 — fine for rules, fills and 24px+ display type, but
// it fails WCAG AA as body/label text (the tour CTA used it at 12px). This darker
// sibling measures 4.51:1 on PAPER; use it wherever accent becomes small text.
export const ACCENT_TEXT = '#a54c25';

// .66 measured 4.46:1 — just under AA, and it is used at 10-12px. .70 clears it.
export const MUTED = 'rgba(43,38,32,.70)';
// Minimum alpha that still passes AA on PAPER — anything lighter is decoration only.
export const MUTED_MIN = 'rgba(43,38,32,.67)';
export const HAIR = 'rgba(43,38,32,.14)'; // hairline rule ~14%

// Jost, uppercase, wide tracking — the "dimension label" style.
export const label = {
  fontFamily: "var(--font-sans), sans-serif",
  fontWeight: 400,
  fontSize: 'clamp(10px, 1.4vw, 12px)',
  letterSpacing: '.3em',
  textTransform: 'uppercase',
};
