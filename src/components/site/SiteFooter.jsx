// Site footer — four columns plus the colophon row. Extracted from app/page.jsx
// so /gallery (and anything added later) ends on the same sheet rather than
// stopping dead after the last section.
import Link from 'next/link';
import { INK, ACCENT, MUTED, HAIR, label } from '../../lib/tokens.js';
import { sheetX } from '../../lib/ui/sheet.js';
import { ELSEWHERE, CONTACT_EMAIL, SITE_NAME } from '../../content/home.js';

const col = { ...label, fontSize: '10px', color: ACCENT, margin: '0 0 16px' };
const fine = { ...label, fontSize: '10px', color: MUTED, margin: 0 };

export default function SiteFooter() {
  return (
    <footer aria-label="Site footer" style={{ padding: `clamp(56px, 9vh, 110px) ${sheetX} clamp(28px, 4vh, 44px)` }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: 'clamp(28px, 5vw, 64px)',
          paddingBottom: 'clamp(36px, 6vh, 64px)',
          borderBottom: `1px solid ${HAIR}`,
        }}
      >
        {/* wordmark column */}
        <div>
          <p style={{ ...label, fontSize: 'clamp(16px, 2.2vw, 22px)', letterSpacing: '.16em', margin: '0 0 14px', fontWeight: 500, color: INK }}>
            {SITE_NAME}
          </p>
          <p style={{ ...fine, lineHeight: 1.9 }}>Apartment Walkthroughs</p>
        </div>

        {/* contact column */}
        <div>
          <p style={col}>Contact</p>
          <a
            href={'mailto:' + CONTACT_EMAIL}
            style={{ ...label, fontSize: '11px', color: INK, textDecoration: 'none', borderBottom: `1px solid ${HAIR}`, paddingBottom: '3px' }}
          >
            {CONTACT_EMAIL}
          </a>
          <p style={{ ...fine, margin: '14px 0 0', lineHeight: 1.9 }}>
            Questions &amp; collaborations
            <br />
            welcome by email
          </p>
        </div>

        {/* elsewhere column */}
        <div>
          <p style={col}>Elsewhere</p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '10px' }}>
            {ELSEWHERE.map(([s, href]) => (
              <li key={s}>
                {/* rel: these leave the site, and one is a personal domain — no
                    referrer, no window.opener handle back into this tab. */}
                <a
                  href={href}
                  rel="noopener noreferrer"
                  style={{ ...label, fontSize: '11px', color: INK, textDecoration: 'none', borderBottom: '1px solid transparent' }}
                >
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* tour column */}
        <div>
          <p style={col}>The Tour</p>
          <p style={{ ...label, fontSize: '11px', color: INK, margin: 0, lineHeight: 1.9 }}>
            Walk the plan in 3D
            <br />
            from any browser
          </p>
          <Link
            href="/tour"
            style={{
              ...label,
              fontSize: '11px',
              color: ACCENT,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '18px',
              borderBottom: `1px solid ${ACCENT}`,
              paddingBottom: '3px',
            }}
          >
            Tour the studio in 3D →
          </Link>
        </div>
      </div>

      {/* fine-print + colophon row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          paddingTop: 'clamp(20px, 3vh, 30px)',
        }}
      >
        <p style={fine}>© 2026 {SITE_NAME} — All rights reserved</p>
        <nav aria-label="Legal" style={{ display: 'flex', gap: 'clamp(14px, 2vw, 24px)', flexWrap: 'wrap' }}>
          <Link href="/privacy" style={{ ...fine, textDecoration: 'none' }}>Privacy</Link>
          <Link href="/terms" style={{ ...fine, textDecoration: 'none' }}>Terms</Link>
        </nav>
        <p style={fine}>Sheet 01 / 01 · Drawn on warm paper · Scale 1:1</p>
      </div>
    </footer>
  );
}
