// Rahman 3D Interior — an apartment showroom you walk (showcase, not a firm).
// "The Plan": presented like an architect's drawing set printed on warm paper.
// Server component. Inline styles only. Auth lives in the nav via a client island.
//
// Chrome (nav, footer), the ornamental plan SVGs and every copy list now live
// outside this file — see components/site/ and content/home.js. What is left is
// the page's own sections in order.

import Link from 'next/link';
import { INK, PAPER, ACCENT, MUTED, HAIR, label } from '../lib/tokens.js';
import { serif, sheetX, PAPER_MUTED } from '../lib/ui/sheet.js';
import SiteNav from '../components/site/SiteNav.jsx';
import SiteFooter from '../components/site/SiteFooter.jsx';
import SectionHead from '../components/site/SectionHead.jsx';
import { HeroPlanMotif, CtaPlanMotif } from '../components/site/PlanMotif.jsx';
import { EXPERIENCE, WORK, ABOUT_FACTS, STEPS, PLAN_NAMES } from '../content/home.js';
import { UNITS } from '../config/units.js';

export default function Page() {
  return (
    <main
      style={{
        background: PAPER,
        color: INK,
        fontFamily: "var(--font-sans), sans-serif",
        minHeight: '100vh',
        WebkitFontSmoothing: 'antialiased',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      <SiteNav active="services" onHome />

      <span id="top" />

      {/* ============================ HERO ============================ */}
      <section
        aria-label="Introduction"
        style={{
          position: 'relative',
          minHeight: 'calc(100vh - 70px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          alignContent: 'center',
          gap: '0',
          padding: `clamp(40px, 7vh, 96px) ${sheetX}`,
          borderBottom: `1px solid ${HAIR}`,
          overflow: 'hidden',
        }}
      >
        {/* faint plan-line motif anchoring the architectural frame */}
        <HeroPlanMotif />

        {/* margin caption — No. 01 / FIG label */}
        <div
          style={{
            gridColumn: '1 / -1',
            display: 'flex',
            alignItems: 'baseline',
            gap: '18px',
            marginBottom: 'clamp(28px, 5vh, 56px)',
          }}
        >
          <span style={{ ...label, color: ACCENT }}>No. 01</span>
          <span style={{ ...label, color: MUTED }}>Apartment Walkthroughs</span>
          <span aria-hidden="true" style={{ flex: 1, height: 1, background: HAIR, alignSelf: 'center' }} />
          <span style={{ ...label, color: MUTED, fontSize: '10px' }}>Est. MMXXVI</span>
        </div>

        {/* Grid-hung headline */}
        <h1
          style={{
            ...serif,
            gridColumn: '1 / -1',
            margin: 0,
            fontWeight: 500,
            fontSize: 'clamp(48px, 11vw, 168px)',
            lineHeight: 0.96,
            letterSpacing: '-0.01em',
            maxWidth: '15ch',
            position: 'relative',
            zIndex: 1,
          }}
        >
          A 360 spins. This walks.
        </h1>

        {/* single accent keyline under hero headline */}
        <div
          aria-hidden="true"
          style={{
            gridColumn: '1 / -1',
            height: 2,
            width: 'clamp(120px, 22vw, 280px)',
            background: ACCENT,
            marginTop: 'clamp(28px, 4vh, 48px)',
          }}
        />

        {/* sub + scroll dimension */}
        <div
          style={{
            gridColumn: '1 / -1',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: '24px',
            flexWrap: 'wrap',
            marginTop: 'clamp(22px, 4vh, 40px)',
          }}
        >
          <p
            style={{
              ...serif,
              margin: 0,
              fontWeight: 400,
              fontSize: 'clamp(17px, 2.4vw, 24px)',
              color: MUTED,
              maxWidth: '42ch',
              lineHeight: 1.4,
            }}
          >
            Every listing already has a 360: you stand on one spot and turn.
            These are apartments you walk — studio to three-bedroom, entrance to
            window, in a browser tab. No app, no headset, no download.
          </p>
          <Link
            href="/tour"
            style={{
              ...label,
              fontSize: 'clamp(11px, 1.5vw, 13px)',
              color: INK,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              borderBottom: `1px solid ${ACCENT}`,
              paddingBottom: '4px',
            }}
          >
            Walk a Unit
            <span aria-hidden="true" style={{ color: ACCENT }}>→</span>
          </Link>
        </div>
      </section>

      {/* ============================ SERVICES ============================ */}
      <section
        id="services"
        aria-label="The experience"
        style={{ padding: `clamp(64px, 10vh, 128px) ${sheetX}`, borderBottom: `1px solid ${HAIR}` }}
      >
        <SectionHead n="02" fig="A" title="The Experience" caption="What you can do" />

        <div role="list" style={{ marginTop: 'clamp(36px, 6vh, 72px)' }}>
          {EXPERIENCE.map((row, i) => (
            <div
              role="listitem"
              key={row.no}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(48px, 0.8fr) minmax(0, 5fr) minmax(0, 5fr)',
                gap: 'clamp(16px, 3vw, 48px)',
                alignItems: 'baseline',
                padding: 'clamp(20px, 3.4vh, 34px) 0',
                borderTop: i === 0 ? `1px solid ${HAIR}` : 'none',
                borderBottom: `1px solid ${HAIR}`,
              }}
            >
              <span style={{ ...label, color: ACCENT, fontSize: 'clamp(11px,1.6vw,14px)' }}>
                {row.no}
              </span>
              <h3
                style={{
                  ...serif,
                  margin: 0,
                  fontWeight: 500,
                  fontSize: 'clamp(24px, 4.4vw, 46px)',
                  lineHeight: 1.04,
                }}
              >
                {row.t}
              </h3>
              <div>
                <p style={{ ...label, color: MUTED, margin: '0 0 10px', lineHeight: 1.7 }}>
                  {row.spec}
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-sans), sans-serif",
                    fontWeight: 300,
                    margin: 0,
                    fontSize: 'clamp(14px, 1.8vw, 16px)',
                    color: INK,
                    lineHeight: 1.6,
                    maxWidth: '40ch',
                  }}
                >
                  {row.note}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================ SELECTED WORK ============================ */}
      <section
        id="work"
        aria-label="Selected work"
        style={{ padding: `clamp(64px, 10vh, 128px) ${sheetX}`, borderBottom: `1px solid ${HAIR}` }}
      >
        <SectionHead n="03" fig="B" title="Concept Studies" caption="Design concepts, not built" />

        <div
          style={{
            marginTop: 'clamp(36px, 6vh, 72px)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
            gap: '1px',
            background: HAIR,
            border: `1px solid ${HAIR}`,
          }}
        >
          {WORK.map((w) => (
            <article
              key={w.fig}
              style={{
                background: PAPER,
                padding: 'clamp(16px, 2vw, 22px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {/* plan-like tile: color block with a faint plan corner mark */}
              <div
                style={{
                  position: 'relative',
                  aspectRatio: '4 / 3',
                  background: w.g,
                  border: `1px solid ${HAIR}`,
                }}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 120 90"
                  preserveAspectRatio="none"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                >
                  <g fill="none" stroke={INK} strokeOpacity="0.18" strokeWidth="0.6">
                    <rect x="10" y="9" width="100" height="72" />
                    <line x1="56" y1="9" x2="56" y2="81" />
                    <line x1="10" y1="48" x2="110" y2="48" />
                    <path d="M10 30 a14 14 0 0 1 14 14" />
                  </g>
                </svg>
                {/* corner figure pin */}
                <span
                  style={{
                    position: 'absolute',
                    top: 10,
                    left: 10,
                    ...label,
                    fontSize: '10px',
                    color: ACCENT,
                    background: PAPER_MUTED,
                    padding: '3px 7px',
                  }}
                >
                  {w.fig}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <h3
                  style={{
                    ...serif,
                    margin: 0,
                    fontWeight: 500,
                    fontSize: 'clamp(20px, 2.6vw, 27px)',
                    lineHeight: 1.05,
                  }}
                >
                  {w.room}
                </h3>
                <p style={{ ...label, fontSize: '10px', color: MUTED, margin: 0 }}>{w.note}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 11,
                      height: 11,
                      background: w.chip,
                      border: `1px solid ${HAIR}`,
                      flex: '0 0 auto',
                    }}
                  />
                  <span style={{ ...label, fontSize: '10px', color: MUTED }}>{w.style}</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div style={{ marginTop: 'clamp(28px, 4vh, 44px)' }}>
          <Link
            href="/tour"
            style={{
              ...label,
              fontSize: 'clamp(11px, 1.5vw, 13px)',
              color: INK,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              borderBottom: `1px solid ${ACCENT}`,
              paddingBottom: '4px',
            }}
          >
            See these concepts in 3D
            <span aria-hidden="true" style={{ color: ACCENT }}>→</span>
          </Link>
        </div>
      </section>

      {/* ============================ STUDIO ============================ */}
      <section
        id="studio"
        aria-label="About"
        style={{
          padding: `clamp(64px, 10vh, 128px) ${sheetX}`,
          borderBottom: `1px solid ${HAIR}`,
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: 'clamp(24px, 4vw, 56px)',
          alignItems: 'start',
        }}
      >
        {/* margin metadata — title block on a drawing sheet */}
        <div
          style={{
            gridColumn: 'span 12',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0',
            border: `1px solid ${HAIR}`,
          }}
        >
          {ABOUT_FACTS.map(([k, v], i) => (
            <div
              key={k}
              style={{
                flex: '1 1 160px',
                padding: 'clamp(14px, 2vw, 22px)',
                borderLeft: i === 0 ? 'none' : `1px solid ${HAIR}`,
              }}
            >
              <p style={{ ...label, fontSize: '10px', color: i === 0 ? ACCENT : MUTED, margin: '0 0 8px' }}>
                {k}
              </p>
              <p
                style={{
                  ...serif,
                  margin: 0,
                  fontWeight: 500,
                  fontSize: 'clamp(17px, 2.2vw, 23px)',
                  lineHeight: 1.1,
                }}
              >
                {v}
              </p>
            </div>
          ))}
        </div>

        {/* Cormorant statement hangs from the grid */}
        <div style={{ gridColumn: 'span 12' }}>
          <p
            style={{
              ...serif,
              margin: '0',
              fontWeight: 400,
              fontSize: 'clamp(26px, 4.6vw, 56px)',
              lineHeight: 1.18,
              letterSpacing: '-0.005em',
              maxWidth: '24ch',
            }}
          >
            It treats a room like a{' '}
            <span style={{ fontStyle: 'italic', color: ACCENT }}>drawing</span> — every
            wall, join, and fall of light placed on purpose, then rendered until it
            stops feeling like a demo and starts feeling like a place.
          </p>
          <p
            style={{
              fontFamily: "var(--font-sans), sans-serif",
              fontWeight: 300,
              fontSize: 'clamp(14px, 1.8vw, 16px)',
              color: MUTED,
              lineHeight: 1.7,
              maxWidth: '52ch',
              marginTop: 'clamp(22px, 3vh, 36px)',
            }}
          >
            Rahman 3D Interior is a showcase, not a firm — a hand-built three.js
            walkthrough by Rahman that turns a floor plan into a space you can move
            through, restyle, and share. Made to be explored, not sold.
          </p>
        </div>
      </section>

      {/* ============================ APPROACH (inverted ink ground) ============================ */}
      <section
        id="approach"
        aria-label="How it works"
        style={{
          background: INK,
          color: PAPER,
          padding: `clamp(72px, 12vh, 150px) ${sheetX}`,
        }}
      >
        {/* inverted section head */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '18px', flexWrap: 'wrap' }}>
          <span style={{ ...label, color: ACCENT }}>No. 05</span>
          <span style={{ ...label, color: 'rgba(233,227,216,.6)' }}>FIG. C · How to use it</span>
          <span aria-hidden="true" style={{ flex: 1, height: 1, background: 'rgba(233,227,216,.18)', alignSelf: 'center', minWidth: '40px' }} />
        </div>
        <h2
          style={{
            ...serif,
            margin: 'clamp(18px, 3vh, 30px) 0 0',
            fontWeight: 500,
            fontSize: 'clamp(34px, 7vw, 92px)',
            lineHeight: 0.98,
            color: PAPER,
          }}
        >
          How It Works
        </h2>

        <ol
          style={{
            listStyle: 'none',
            margin: 'clamp(40px, 7vh, 80px) 0 0',
            padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
            gap: '1px',
            background: 'rgba(233,227,216,.16)',
            border: '1px solid rgba(233,227,216,.16)',
          }}
        >
          {STEPS.map((step) => (
            <li
              key={step.n}
              style={{
                background: INK,
                padding: 'clamp(22px, 3vw, 36px) clamp(18px, 2.4vw, 30px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                minHeight: 'clamp(220px, 28vh, 300px)',
              }}
            >
              <span style={{ ...label, fontSize: 'clamp(11px,1.6vw,13px)', color: ACCENT }}>
                {step.n}
              </span>
              <h3
                style={{
                  ...serif,
                  margin: 0,
                  fontWeight: 500,
                  fontSize: 'clamp(26px, 3.6vw, 40px)',
                  color: PAPER,
                }}
              >
                {step.t}
              </h3>
              <p
                style={{
                  fontFamily: "var(--font-sans), sans-serif",
                  fontWeight: 300,
                  margin: 0,
                  fontSize: 'clamp(13px, 1.6vw, 15px)',
                  color: 'rgba(233,227,216,.72)',
                  lineHeight: 1.65,
                }}
              >
                {step.d}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* ============================ CREDO ============================ */}
      <section
        aria-label="Studio credo"
        style={{ padding: `clamp(80px, 14vh, 170px) ${sheetX}`, borderBottom: `1px solid ${HAIR}` }}
      >
        <span style={{ ...label, color: ACCENT }}>No. 06 · FIG. D</span>
        <figure style={{ margin: 'clamp(28px, 5vh, 56px) 0 0' }}>
          <blockquote style={{ margin: 0 }}>
            <p
              style={{
                ...serif,
                margin: 0,
                fontWeight: 400,
                fontSize: 'clamp(30px, 6vw, 80px)',
                lineHeight: 1.12,
                letterSpacing: '-0.005em',
                maxWidth: '20ch',
              }}
            >
              A space you can{' '}
              <span style={{ fontStyle: 'italic' }}>walk</span> — and restyle as you
              move through it — lands differently than a render you only look at.
            </p>
          </blockquote>
          <figcaption
            style={{
              marginTop: 'clamp(32px, 5vh, 56px)',
              paddingTop: 'clamp(16px, 2.4vh, 22px)',
              borderTop: `1px solid ${HAIR}`,
              display: 'flex',
              alignItems: 'baseline',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ ...label, color: INK }}>The whole idea</span>
            <span style={{ ...label, color: MUTED, fontSize: '10px' }}>
              Why it’s a walkthrough, not a picture
            </span>
          </figcaption>
        </figure>
      </section>

      {/* ============================ CTA — TOUR ============================ */}
      <section
        aria-label="Enter the 3D walkthrough"
        style={{
          position: 'relative',
          padding: `clamp(80px, 14vh, 180px) ${sheetX}`,
          borderBottom: `1px solid ${HAIR}`,
          overflow: 'hidden',
        }}
      >
        {/* floor-plan pin geometry framing the call */}
        <CtaPlanMotif />

        {/* plan-pin labels */}
        <div
          aria-hidden="true"
          style={{
            position: 'relative',
            display: 'flex',
            gap: 'clamp(12px, 3vw, 40px)',
            flexWrap: 'wrap',
            marginBottom: 'clamp(28px, 5vh, 48px)',
          }}
        >
          {PLAN_NAMES.map((p, i) => (
            <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: i === 0 ? ACCENT : 'transparent',
                  border: `1px solid ${i === 0 ? ACCENT : MUTED}`,
                }}
              />
              <span style={{ ...label, fontSize: '10px', color: i === 0 ? INK : MUTED }}>{p}</span>
            </span>
          ))}
        </div>

        {/* Every unit type, one click from the close. The CTA below opens the
            default; a buyer who already knows they want the two-bed should not
            have to land somewhere else first and switch. */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: 'clamp(24px, 4vh, 40px)',
          }}
        >
          {UNITS.map((u) => (
            <Link
              key={u.key}
              href={'/tour?unit=' + u.key}
              style={{
                ...label,
                fontSize: '10px',
                color: INK,
                textDecoration: 'none',
                border: `1px solid ${HAIR}`,
                padding: '9px 14px',
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: '8px',
              }}
            >
              {u.name}
              <span style={{ color: MUTED }}>{u.area} m²</span>
            </Link>
          ))}
        </div>

        <div style={{ position: 'relative', maxWidth: '24ch' }}>
          <span style={{ ...label, color: ACCENT }}>No. 07 · The Showroom</span>
          <h2
            style={{
              ...serif,
              margin: 'clamp(16px, 3vh, 26px) 0 0',
              fontWeight: 500,
              fontSize: 'clamp(40px, 9vw, 120px)',
              lineHeight: 0.97,
              letterSpacing: '-0.01em',
            }}
          >
            Walk the plan.
          </h2>
        </div>

        <div
          style={{
            position: 'relative',
            marginTop: 'clamp(28px, 5vh, 48px)',
            display: 'flex',
            alignItems: 'center',
            gap: 'clamp(20px, 4vw, 44px)',
            flexWrap: 'wrap',
          }}
        >
          <Link
            href="/tour"
            style={{
              ...label,
              fontSize: 'clamp(12px, 1.6vw, 14px)',
              color: PAPER,
              background: ACCENT,
              textDecoration: 'none',
              padding: 'clamp(15px, 2vw, 19px) clamp(26px, 3.4vw, 40px)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            Enter the Walkthrough
            <span aria-hidden="true" style={{ fontSize: '15px', lineHeight: 1 }}>→</span>
          </Link>
          <p
            style={{
              fontFamily: "var(--font-sans), sans-serif",
              fontWeight: 300,
              margin: 0,
              fontSize: 'clamp(13px, 1.7vw, 15px)',
              color: MUTED,
              maxWidth: '34ch',
              lineHeight: 1.6,
            }}
          >
            Scroll is the walk. Switch unit type, concept and daylight without
            leaving the room you are standing in.
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
