// Section header in the drawing-set idiom: "No. 02 · FIG. A" on a hairline, then
// the display title. Server component — no state, no client bundle cost.
import { INK, ACCENT, MUTED, HAIR, label } from '../../lib/tokens.js';
import { serif } from '../../lib/ui/sheet.js';

/**
 * @param {{ n: string, fig: string, title: string, caption: string }} props
 */
export default function SectionHead({ n, fig, title, caption }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '18px', flexWrap: 'wrap' }}>
        <span style={{ ...label, color: ACCENT }}>No. {n}</span>
        <span style={{ ...label, color: MUTED }}>FIG. {fig} · {caption}</span>
        <span
          aria-hidden="true"
          style={{ flex: 1, height: 1, background: HAIR, alignSelf: 'center', minWidth: '40px' }}
        />
      </div>
      <h2
        style={{
          ...serif,
          color: INK,
          margin: 'clamp(16px, 3vh, 28px) 0 0',
          fontWeight: 500,
          fontSize: 'clamp(36px, 8vw, 104px)',
          lineHeight: 0.98,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h2>
    </div>
  );
}
