// 404. Kept in the same drawing-set language as the rest of the site.
import { INK, PAPER, ACCENT_TEXT, MUTED, label } from '../lib/tokens';

export const metadata = { title: 'Not found — Rahman 3D Interior' };

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100dvh', background: PAPER, color: INK,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 20, padding: '40px 24px', textAlign: 'center',
      }}
    >
      <div style={{ ...label, color: ACCENT_TEXT }}>Sheet not in this set</div>
      <h1 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontWeight: 300, fontSize: 'clamp(28px, 5vw, 44px)', lineHeight: 1.1, margin: 0 }}>
        Nothing drawn here
      </h1>
      <p style={{ color: MUTED, maxWidth: 440, lineHeight: 1.7, fontSize: 14, margin: 0 }}>
        That page doesn’t exist. A shared walkthrough link that stopped working
        usually means the project was deleted by its author.
      </p>
      <a
        href="/tour"
        style={{
          fontFamily: 'var(--font-sans), sans-serif', fontSize: 11, letterSpacing: '.14em',
          textTransform: 'uppercase', padding: '11px 20px', borderRadius: 999,
          background: INK, color: PAPER, border: `1px solid ${INK}`, textDecoration: 'none',
        }}
      >
        Enter the tour
      </a>
    </main>
  );
}
