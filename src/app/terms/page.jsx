// Rahman 3D Interior — Terms. Static server component (no data fetch), styled
// with the shared tokens + the gallery page's header/section pattern.
// Plain-language summary, honest as-is showcase terms. NOT legal advice.

import Link from 'next/link';
import { INK, PAPER, ACCENT, MUTED, HAIR, label } from '../../lib/tokens.js';

export const metadata = {
  title: 'Terms',
  description: 'The terms for using interior.rahmanef.com — a personal 3D-interior showcase provided as-is, with an acceptable-use policy for uploads.',
};

const serif = { fontFamily: "var(--font-serif), serif" };
const sheetX = 'clamp(20px, 6vw, 100px)';

const bodyText = {
  fontFamily: "var(--font-sans), sans-serif",
  fontWeight: 300,
  fontSize: 'clamp(14px, 1.8vw, 16px)',
  color: INK,
  lineHeight: 1.7,
  margin: '14px 0 0',
};

const UPDATED = '16 July 2026';

const CLAUSES = [
  {
    no: '01',
    t: 'Accepting these terms',
    body: ['By using interior.rahmanef.com (“the site”) you accept these terms. If you don’t agree with them, please don’t use the site.'],
  },
  {
    no: '02',
    t: 'As-is, no warranty',
    body: [
      'The site is a personal showcase provided “as is” and “as available”, without warranties of any kind. It may change, break, lose data, or go offline at any time, and the owner is not liable for any loss arising from its use.',
      'Keep your own copy of anything important — use the “Export” buttons to download your project file or 3D model.',
    ],
  },
  {
    no: '03',
    t: 'Your account',
    body: ['You are responsible for activity under your account and for keeping your password safe. Use an email address you actually control so we can reach you about your account.'],
  },
  {
    no: '04',
    t: 'Your content & acceptable use',
    body: [
      'You keep ownership of the projects and 3D models you upload. By uploading, you confirm you have the right to use that content, and you grant the site permission to store and display it so its features can work.',
      'You must not upload or share anything that:',
    ],
    list: [
      'you do not own or do not have permission to use;',
      'infringes copyright, trademark, or other rights;',
      'is illegal, or is hateful, harassing, sexually explicit, or otherwise inappropriate;',
      'contains malware, or is intended to break, overload, or abuse the site.',
    ],
  },
  {
    no: '05',
    t: 'Public exposure',
    body: ['Share links are unlisted but public — anyone with the link can view them — and featured projects appear on the public gallery. Don’t upload anything you wouldn’t want seen publicly.'],
  },
  {
    no: '06',
    t: 'The owner may remove content',
    body: ['The owner may remove, unfeature, or decline any content, and may suspend accounts, at any time and for any reason — in particular anything that breaks these terms — without notice.'],
  },
  {
    no: '07',
    t: 'Changes & contact',
    body: ['These terms may change as the site evolves; the date above reflects the current version. Questions: rahmanef63@gmail.com.'],
  },
];

export default function TermsPage() {
  return (
    <main style={{ background: PAPER, color: INK, fontFamily: "var(--font-sans), sans-serif", minHeight: '100vh', WebkitFontSmoothing: 'antialiased' }}>
      <header style={{ borderBottom: `1px solid ${HAIR}` }}>
        <nav aria-label="Primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: `clamp(14px, 1.6vw, 20px) ${sheetX}`, flexWrap: 'wrap' }}>
          <Link href="/" style={{ ...label, fontSize: 'clamp(14px, 1.8vw, 17px)', letterSpacing: '.18em', color: INK, textDecoration: 'none', fontWeight: 500 }}>
            Rahman 3D Interior
          </Link>
          <Link href="/tour" style={{ ...label, color: ACCENT, textDecoration: 'none', border: `1px solid ${ACCENT}`, padding: '9px 16px' }}>
            Enter the Tour
          </Link>
        </nav>
      </header>

      <section aria-label="Terms" style={{ padding: `clamp(48px, 8vh, 96px) ${sheetX} clamp(56px, 9vh, 100px)` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap' }}>
          <span style={{ ...label, color: ACCENT }}>Terms</span>
          <span style={{ ...label, color: MUTED }}>Using this showcase</span>
          <span aria-hidden="true" style={{ flex: 1, height: 1, background: HAIR, alignSelf: 'center', minWidth: 40 }} />
        </div>
        <h1 style={{ ...serif, margin: 'clamp(16px, 3vh, 28px) 0 0', fontWeight: 500, fontSize: 'clamp(36px, 8vw, 104px)', lineHeight: 0.98, letterSpacing: '-0.01em' }}>
          Terms.
        </h1>
        <p style={{ ...label, fontSize: 10, color: MUTED, margin: '18px 0 0' }}>Last updated {UPDATED}</p>

        <div style={{ border: `1px solid ${HAIR}`, padding: 'clamp(18px, 3vw, 30px)', marginTop: 'clamp(28px, 5vh, 48px)', maxWidth: '68ch' }}>
          <p style={{ ...label, fontSize: 10, color: ACCENT, margin: 0 }}>In plain language</p>
          <p style={{ ...bodyText, marginTop: 14 }}>
            This is a personal showcase you can use for free, as-is, with no guarantees. Own whatever you upload, keep it legal and appropriate, and remember that share links and the gallery are public. The owner can remove or unfeature any content.
          </p>
          <p style={{ ...bodyText, color: MUTED, marginTop: 14 }}>
            This is a plain-language summary, not legal advice.
          </p>
        </div>

        <div>
          {CLAUSES.map((c) => (
            <div key={c.no} style={{ marginTop: 'clamp(30px, 5vh, 52px)', maxWidth: '68ch' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                <span style={{ ...label, color: ACCENT, fontSize: 10 }}>{c.no}</span>
                <h2 style={{ ...serif, margin: 0, fontWeight: 500, fontSize: 'clamp(22px, 3.4vw, 34px)', lineHeight: 1.1 }}>{c.t}</h2>
              </div>
              {c.body.map((para, i) => (
                <p key={i} style={bodyText}>{para}</p>
              ))}
              {c.list && (
                <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none' }}>
                  {c.list.map((li, i) => (
                    <li key={i} style={{ ...bodyText, margin: '8px 0 0', position: 'relative', paddingLeft: '1.3em' }}>
                      <span aria-hidden="true" style={{ position: 'absolute', left: 0, color: ACCENT }}>—</span>
                      {li}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <footer aria-label="Site footer" style={{ borderTop: `1px solid ${HAIR}`, padding: `clamp(24px, 4vh, 40px) ${sheetX}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <a href="mailto:rahmanef63@gmail.com" style={{ ...label, fontSize: 10, color: INK, textDecoration: 'none', borderBottom: `1px solid ${HAIR}`, paddingBottom: 3 }}>
          rahmanef63@gmail.com
        </a>
        <nav aria-label="Legal" style={{ display: 'flex', gap: 'clamp(14px, 3vw, 30px)', flexWrap: 'wrap' }}>
          <Link href="/privacy" style={{ ...label, fontSize: 10, color: MUTED, textDecoration: 'none' }}>Privacy</Link>
          <Link href="/" style={{ ...label, fontSize: 10, color: ACCENT, textDecoration: 'none' }}>Back to home</Link>
        </nav>
      </footer>
    </main>
  );
}
