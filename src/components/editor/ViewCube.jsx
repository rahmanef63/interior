'use client';

// ViewCube — the corner widget AutoCAD, Revit, Fusion and SolidWorks all put in
// the top-right of a viewport. It is the single most transferable control in CAD:
// an architect who has never seen this app will still click the top face to get a
// plan view, because that is what it does everywhere else.
//
// Drawn as a flat isometric projection (three parallelograms) rather than a real
// 3D cube. A live cube would need a second WebGL context or a portal render pass;
// this is one SVG, costs nothing, and the whole value of the control is knowing
// where the faces are — not watching them rotate.

import { INK, ACCENT, PAPER, HAIR } from '../../lib/tokens.js';

const FACES = [
  // [name, points, label position, label]
  ['top', '60,8 112,38 60,68 8,38', [60, 42], 'TOP'],
  ['front', '8,38 60,68 60,124 8,94', [34, 96], 'FRT'],
  ['right', '112,38 112,94 60,124 60,68', [86, 96], 'RGT'],
];

/**
 * @param {{ onView: (name: string) => void, size?: number }} props
 */
export default function ViewCube({ onView, size = 108 }) {
  return (
    <div
      style={{
        position: 'absolute', top: 14, right: 14, width: size, userSelect: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        // The viewport swallows pointer events for navigation; this sits above it.
        pointerEvents: 'auto',
      }}
    >
      <svg viewBox="0 0 120 132" width={size} height={size * 1.1} role="group" aria-label="Standard views">
        {FACES.map(([name, pts, [lx, ly], label]) => (
          <g key={name} className="r3i-cube-face" onClick={() => onView(name)} style={{ cursor: 'pointer' }}>
            <title>{`${label} view`}</title>
            <polygon
              points={pts}
              fill={PAPER}
              stroke={INK}
              strokeOpacity="0.35"
              strokeWidth="1.2"
            />
            <text
              x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
              style={{ font: '500 11px var(--font-sans), sans-serif', letterSpacing: '0.16em', fill: INK, fillOpacity: 0.6, pointerEvents: 'none' }}
            >
              {label}
            </text>
          </g>
        ))}
        {/* Iso corner marker — clicking the top-front-right vertex is the CAD idiom
            for "give me the three-quarter view". */}
        <circle
          cx="60" cy="68" r="6.5" fill={ACCENT} stroke={PAPER} strokeWidth="1.6"
          onClick={() => onView('iso')} style={{ cursor: 'pointer' }}
        >
          <title>Isometric view</title>
        </circle>
      </svg>

      <div style={{ display: 'flex', gap: 4 }}>
        {[['left', 'L'], ['back', 'B'], ['bottom', 'D']].map(([n, l]) => (
          <button
            key={n}
            type="button"
            onClick={() => onView(n)}
            title={`${n[0].toUpperCase() + n.slice(1)} view`}
            style={{
              font: '400 9px var(--font-sans), sans-serif', letterSpacing: '0.18em',
              width: 24, height: 20, background: PAPER, color: INK,
              border: `1px solid ${HAIR}`, cursor: 'pointer',
            }}
          >
            {l}
          </button>
        ))}
      </div>

      <style>{`.r3i-cube-face:hover polygon { fill: #dcd4c5; }`}</style>
    </div>
  );
}
