// Decorative plan-line SVGs. Pure ornament: aria-hidden, pointer-events none, no
// text. Pulled out of app/page.jsx because ~70 lines of <line>/<path> between two
// content sections is the main reason that file was hard to scan.
import { INK, ACCENT } from '../../lib/tokens.js';

/** Hero: a floor plan with door swings and a dimension line, bled off the right edge. */
export function HeroPlanMotif() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 600 600"
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 'clamp(280px, 45vw, 640px)',
        height: '100%',
        opacity: 0.5,
        pointerEvents: 'none',
      }}
    >
      <g fill="none" stroke={INK} strokeOpacity="0.12" strokeWidth="1">
        <rect x="120" y="80" width="360" height="440" />
        <rect x="120" y="80" width="220" height="200" />
        <rect x="340" y="80" width="140" height="200" />
        <rect x="120" y="280" width="360" height="240" />
        <line x1="230" y1="280" x2="230" y2="520" />
        {/* door swings */}
        <path d="M120 230 a50 50 0 0 1 50 50" />
        <path d="M340 330 a44 44 0 0 0 44 44" />
      </g>
      {/* dimension line across the top */}
      <g fill="none" stroke={ACCENT} strokeOpacity="0.5" strokeWidth="1">
        <line x1="120" y1="56" x2="480" y2="56" />
        <line x1="120" y1="48" x2="120" y2="64" />
        <line x1="480" y1="48" x2="480" y2="64" />
      </g>
    </svg>
  );
}

/** CTA: a wider, sparser three-bay plan filling the section behind the call. */
export function CtaPlanMotif() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 800 360"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.55, pointerEvents: 'none' }}
    >
      <g fill="none" stroke={INK} strokeOpacity="0.12" strokeWidth="1">
        <rect x="60" y="60" width="680" height="240" />
        <line x1="320" y1="60" x2="320" y2="300" />
        <line x1="540" y1="60" x2="540" y2="300" />
        <line x1="320" y1="180" x2="540" y2="180" />
      </g>
    </svg>
  );
}
