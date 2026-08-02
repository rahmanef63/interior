'use client';

// Route-level error boundary. Without one, any exception thrown inside a client
// component (the whole tour is one) unmounts the tree and leaves a blank page
// with no way back.
import { INK, PAPER, ACCENT_TEXT, MUTED, label } from '../lib/tokens';

export default function Error({ error, reset }) {
  return (
    <main
      style={{
        minHeight: '100dvh', background: PAPER, color: INK,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 20, padding: '40px 24px', textAlign: 'center',
      }}
    >
      <div style={{ ...label, color: ACCENT_TEXT }}>Something broke</div>
      <h1 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontWeight: 300, fontSize: 'clamp(28px, 5vw, 44px)', lineHeight: 1.1, margin: 0 }}>
        The drawing didn’t load
      </h1>
      <p style={{ color: MUTED, maxWidth: 460, lineHeight: 1.7, fontSize: 14, margin: 0 }}>
        This is a showcase, so the odd rough edge is expected. Try again — if it
        keeps happening, the 3D scene may not be supported on this device.
      </p>
      {error?.digest && (
        <code style={{ ...label, fontSize: 10, color: MUTED }}>ref {error.digest}</code>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={reset} style={btn(true)}>Try again</button>
        <a href="/" style={{ ...btn(false), textDecoration: 'none' }}>Back to the plan</a>
      </div>
    </main>
  );
}

const btn = (solid) => ({
  fontFamily: 'var(--font-sans), sans-serif', fontSize: 11, letterSpacing: '.14em',
  textTransform: 'uppercase', padding: '11px 20px', borderRadius: 999, cursor: 'pointer',
  background: solid ? INK : 'transparent', color: solid ? PAPER : INK,
  border: `1px solid ${INK}`,
});
