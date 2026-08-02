// Rahman 3D Interior — Privacy. Static server component (no data fetch), styled
// with the shared tokens + the gallery page's header/section pattern.
// Plain-language summary, honest to what the code actually stores. NOT legal advice.

import Link from 'next/link';
import { INK, PAPER, ACCENT, MUTED, HAIR, label } from '../../lib/tokens.js';

export const metadata = {
  title: 'Privacy',
  description: 'What interior.rahmanef.com stores, how usage is measured, and how to delete your data — no cookies, no third-party trackers.',
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
    t: 'Who runs this site',
    body: ['interior.rahmanef.com (“the site”) is a personal 3D-interior showcase run by the studio owner. For any question or request about your data, email rahmanef63@gmail.com.'],
  },
  {
    no: '02',
    t: 'What we store',
    body: [
      'Account: if you create an account we store your email address and a securely hashed password — nothing else. No name, no phone number, no payment details.',
      'Projects you save: when you save a walkthrough to your account we store its name, its design settings, and — only if you upload one — your 3D model file (.glb). These are tied to your account and are visible only to you unless you share them or the studio features them (see “Sharing & public exposure”).',
      'Guest work: if you use the tour without signing in, your work is kept only in your own browser (localStorage). It never reaches our servers until you sign in and choose “Save to cloud”. Clearing your browser data erases it.',
    ],
  },
  {
    no: '03',
    t: 'How we measure usage',
    body: [
      'We count how the site is used with first-party, aggregate counters only. Each stored record is a single running total, per day, for one of a fixed set of actions: starting the tour, switching a room concept, switching daylight, saving a project, and copying a share link.',
      'There are no visitor identifiers, no IP logging in these counters, no profiles, and no way to trace a count back to you. The totals auto-delete after 180 days and are visible only to the studio owner.',
    ],
  },
  {
    no: '04',
    t: 'Cookies & third-party trackers',
    body: [
      'This site sets no cookies and loads no third-party analytics, advertising, or social scripts. Fonts are served from the site itself, so simply viewing a page never hands your IP address to an outside font CDN.',
      'Your login session is kept as a token in your browser’s localStorage — not in a cookie. Because there are no cookies or cross-site trackers, there is no consent banner.',
    ],
  },
  {
    no: '05',
    t: 'Sharing & public exposure',
    body: ['A share link is unlisted, not private: anyone who has the link can open and view that walkthrough. If the studio features your project, it is listed on the public gallery for everyone to see. Only save, share, or upload things you are comfortable being viewed publicly.'],
  },
  {
    no: '06',
    t: 'Where your data lives',
    body: ['Accounts, saved projects, and uploaded models are hosted on Convex, the backend and database provider that processes this data on our behalf. Your data is never sold or shared for advertising.'],
  },
  {
    no: '07',
    t: 'Deleting your data',
    body: [
      'Signed-in users can delete any saved project from the tour’s project panel using its “×” button; deleting a project also removes its uploaded model from our storage.',
      'To delete your entire account and email address, or to ask any other privacy question, email rahmanef63@gmail.com and we will action it.',
    ],
  },
  {
    no: '08',
    t: 'Children & changes',
    body: ['This site is not directed at children. We may update this page as the site changes; the date above reflects the current version.'],
  },
];

export default function PrivacyPage() {
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

      <section aria-label="Privacy" style={{ padding: `clamp(48px, 8vh, 96px) ${sheetX} clamp(56px, 9vh, 100px)` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap' }}>
          <span style={{ ...label, color: ACCENT }}>Privacy</span>
          <span style={{ ...label, color: MUTED }}>How this site handles your data</span>
          <span aria-hidden="true" style={{ flex: 1, height: 1, background: HAIR, alignSelf: 'center', minWidth: 40 }} />
        </div>
        <h1 style={{ ...serif, margin: 'clamp(16px, 3vh, 28px) 0 0', fontWeight: 500, fontSize: 'clamp(36px, 8vw, 104px)', lineHeight: 0.98, letterSpacing: '-0.01em' }}>
          Privacy.
        </h1>
        <p style={{ ...label, fontSize: 10, color: MUTED, margin: '18px 0 0' }}>Last updated {UPDATED}</p>

        <div style={{ border: `1px solid ${HAIR}`, padding: 'clamp(18px, 3vw, 30px)', marginTop: 'clamp(28px, 5vh, 48px)', maxWidth: '68ch' }}>
          <p style={{ ...label, fontSize: 10, color: ACCENT, margin: 0 }}>In plain language</p>
          <p style={{ ...bodyText, marginTop: 14 }}>
            We keep almost nothing. There are no cookies and no third-party trackers. Usage is measured only as anonymous day-by-day counts that cannot identify you. If you make an account we store your email and the projects you save; if you don’t, your work stays in your own browser. You can delete your projects yourself at any time.
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
            </div>
          ))}
        </div>
      </section>

      <footer aria-label="Site footer" style={{ borderTop: `1px solid ${HAIR}`, padding: `clamp(24px, 4vh, 40px) ${sheetX}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <a href="mailto:rahmanef63@gmail.com" style={{ ...label, fontSize: 10, color: INK, textDecoration: 'none', borderBottom: `1px solid ${HAIR}`, paddingBottom: 3 }}>
          rahmanef63@gmail.com
        </a>
        <nav aria-label="Legal" style={{ display: 'flex', gap: 'clamp(14px, 3vw, 30px)', flexWrap: 'wrap' }}>
          <Link href="/terms" style={{ ...label, fontSize: 10, color: MUTED, textDecoration: 'none' }}>Terms</Link>
          <Link href="/" style={{ ...label, fontSize: 10, color: ACCENT, textDecoration: 'none' }}>Back to home</Link>
        </nav>
      </footer>
    </main>
  );
}
