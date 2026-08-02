// Sticky site header. Was inline in app/page.jsx, which meant /gallery grew its
// own cut-down copy with a different link set — two navs to keep in step.
//
// Server component wrapping one client island (HeaderAuth), so the nav itself
// costs nothing on the wire.
import Link from 'next/link';
import HeaderAuth from '../HeaderAuth.jsx';
import { INK, ACCENT, MUTED, HAIR, label } from '../../lib/tokens.js';
import { sheetX, PAPER_MUTED } from '../../lib/ui/sheet.js';
import { NAV, SITE_NAME } from '../../content/home.js';

/**
 * @param {object}  props
 * @param {string}  [props.active]  NAV id to mark current (also sets aria-current).
 * @param {boolean} [props.onHome]  true on `/`, where anchors resolve in-page;
 *                                  elsewhere they are rewritten to `/#anchor`.
 */
export default function SiteNav({ active = 'services', onHome = true }) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: PAPER_MUTED,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderBottom: `1px solid ${HAIR}`,
      }}
    >
      <nav
        aria-label="Primary"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: `clamp(14px, 1.6vw, 20px) ${sheetX}`,
          flexWrap: 'wrap',
        }}
      >
        {/* Wordmark. On the home page it jumps to the top anchor; elsewhere it is
            a real link home, which is what a visitor on /gallery expects. */}
        {onHome ? (
          <a
            href="#top"
            aria-label={`${SITE_NAME} — home`}
            style={{ ...label, fontSize: 'clamp(14px, 1.8vw, 17px)', letterSpacing: '.18em', color: INK, textDecoration: 'none', fontWeight: 500 }}
          >
            {SITE_NAME}
          </a>
        ) : (
          <Link
            href="/"
            aria-label={`${SITE_NAME} — home`}
            style={{ ...label, fontSize: 'clamp(14px, 1.8vw, 17px)', letterSpacing: '.18em', color: INK, textDecoration: 'none', fontWeight: 500 }}
          >
            {SITE_NAME}
          </Link>
        )}

        {/* Section index — dimension labels, accent marks current */}
        <ul
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'clamp(14px, 2.4vw, 34px)',
            listStyle: 'none',
            margin: 0,
            padding: 0,
            flexWrap: 'wrap',
          }}
        >
          {NAV.map((s) => {
            const href = s.href || (onHome ? s.hash : '/' + s.hash);
            const is = s.id === active;
            return (
              <li key={s.id} style={{ display: 'flex', alignItems: 'baseline', gap: '7px' }}>
                <span style={{ ...label, fontSize: '10px', color: is ? ACCENT : MUTED }}>{s.n}</span>
                <a
                  href={href}
                  aria-current={is ? 'page' : undefined}
                  style={{
                    ...label,
                    fontSize: 'clamp(10px, 1.4vw, 12px)',
                    color: is ? INK : MUTED,
                    textDecoration: 'none',
                    borderBottom: is ? `1px solid ${ACCENT}` : '1px solid transparent',
                    paddingBottom: '2px',
                  }}
                >
                  {s.t}
                </a>
              </li>
            );
          })}
        </ul>

        {/* Auth + standing CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(12px, 2vw, 20px)' }}>
          <HeaderAuth />
          <Link
            href="/tour"
            style={{
              ...label,
              fontSize: 'clamp(10px, 1.4vw, 12px)',
              color: ACCENT,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              border: `1px solid ${ACCENT}`,
              padding: '9px 16px',
            }}
          >
            <span aria-hidden="true" style={{ fontSize: '13px', lineHeight: 1 }}>↳</span>
            Enter the Tour
          </Link>
        </div>
      </nav>
    </header>
  );
}
