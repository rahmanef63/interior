// The unit's actual floor plan, drawn from the same data the 3D is built from.
//
// The gallery used to show one generic squiggle behind every tile, which meant
// four unit types looked identical until you opened them. These are the real
// walls: same shell, same partitions, same openings, same window bands. A plan
// that drifts from the model is worse than no plan, and the only way to keep
// them honest is to draw both from one source.
//
// SVG y grows downward and the model's z grows toward the facade, so the whole
// drawing is flipped: y = d - z puts the entrance at the bottom, which is where
// a floor plan expects it.

const DOOR_W = 0.9;
const SILL_GAP = 0.06;

/** Where a shell side lives, mirroring apartment.js's SIDES. */
function edge(side, w, d) {
  if (side === 's') return { horiz: true, fixed: d, from: 0, to: w };   // z=0 → y=d
  if (side === 'n') return { horiz: true, fixed: 0, from: 0, to: w };   // z=d → y=0
  if (side === 'w') return { horiz: false, fixed: 0, from: 0, to: d };
  return { horiz: false, fixed: w, from: 0, to: d };
}

/** A segment on a shell side, in SVG coordinates. */
function seg(side, a, b, w, d) {
  const e = edge(side, w, d);
  if (e.horiz) return { x1: a, y1: e.fixed, x2: b, y2: e.fixed };
  // For a vertical side the run is measured in z, which flips.
  return { x1: e.fixed, y1: d - a, x2: e.fixed, y2: d - b };
}

/**
 * @param {object} props
 * @param {import('../../config/units.js').UNITS[number]['plan']} props.plan
 * @param {string} props.ink
 * @param {number} [props.pad] metres of margin around the shell
 */
export default function UnitPlan({ plan, ink = '#2b2620', pad = 0.5 }) {
  const { w, d } = plan.shell;
  const wall = 0.16;
  const thin = 0.055;

  /** Openings on each shell side: windows draw as glazing, doors as gaps. */
  const bySide = { n: [], s: [], e: [], w: [] };
  for (const v of plan.windows || []) bySide[v.side].push({ a: v.at, b: v.at + v.len, kind: 'window' });
  for (const v of plan.doors || []) bySide[v.side].push({ a: v.at - DOOR_W / 2, b: v.at + DOOR_W / 2, kind: 'door' });

  const solids = [];
  const glazing = [];
  const swings = [];
  for (const side of ['n', 's', 'e', 'w']) {
    const run = side === 'n' || side === 's' ? w : d;
    const holes = bySide[side].slice().sort((p, q) => p.a - q.a);
    let cursor = 0;
    for (const h of holes) {
      if (h.a > cursor) solids.push(seg(side, cursor, h.a, w, d));
      if (h.kind === 'window') {
        glazing.push(seg(side, h.a + SILL_GAP, h.b - SILL_GAP, w, d));
      } else {
        // door swing: a quarter arc off the far jamb, drawn into the unit
        const e = edge(side, w, d);
        const into = side === 's' ? -1 : side === 'n' ? 1 : 0;
        const intoX = side === 'w' ? 1 : side === 'e' ? -1 : 0;
        const p = seg(side, h.a, h.b, w, d);
        swings.push({
          x: p.x1, y: p.y1,
          dx: intoX ? intoX * DOOR_W : 0,
          dy: into ? into * DOOR_W : 0,
          ex: p.x2, ey: p.y2,
        });
      }
      cursor = h.b;
    }
    if (cursor < run) solids.push(seg(side, cursor, run, w, d));
  }

  // Partitions, cut the same way the geometry cuts them.
  const parts = [];
  for (const p of plan.partitions || []) {
    const len = Math.hypot(p.x2 - p.x1, p.z2 - p.z1);
    const ux = (p.x2 - p.x1) / len;
    const uz = (p.z2 - p.z1) / len;
    const cuts = (p.doors || []).map((t) => [t * len - DOOR_W / 2, t * len + DOOR_W / 2]).sort((a, b) => a[0] - b[0]);
    const push = (a, b) => {
      if (b - a < 0.02) return;
      parts.push({
        x1: p.x1 + ux * a, y1: d - (p.z1 + uz * a),
        x2: p.x1 + ux * b, y2: d - (p.z1 + uz * b),
      });
    };
    let at = 0;
    for (const [c0, c1] of cuts) { push(at, c0); at = c1; }
    push(at, len);
  }

  return (
    <svg
      aria-hidden="true"
      viewBox={`${-pad} ${-pad} ${w + pad * 2} ${d + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      <g fill="none" stroke={ink} strokeLinecap="square">
        {solids.map((s, i) => (
          <line key={'s' + i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} strokeWidth={wall} strokeOpacity="0.5" />
        ))}
        {parts.map((s, i) => (
          <line key={'p' + i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} strokeWidth={thin * 1.6} strokeOpacity="0.42" />
        ))}
        {glazing.map((s, i) => (
          <g key={'g' + i}>
            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} strokeWidth={wall} strokeOpacity="0.14" />
            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} strokeWidth={thin * 0.8} strokeOpacity="0.55" />
          </g>
        ))}
        {swings.map((s, i) => (
          <g key={'d' + i} strokeWidth={thin} strokeOpacity="0.4">
            <line x1={s.x} y1={s.y} x2={s.x + s.dx} y2={s.y + s.dy} />
            <path d={`M ${s.ex} ${s.ey} A ${DOOR_W} ${DOOR_W} 0 0 1 ${s.x + s.dx} ${s.y + s.dy}`} strokeDasharray="0.16 0.14" />
          </g>
        ))}
      </g>
    </svg>
  );
}
