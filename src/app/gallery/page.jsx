// Rahman 3D Interior — the showroom.
//
// The house units come first and are always there: four apartment types a
// developer actually sells, each one a real walkthrough rather than a render or
// a 360 you spin on the spot. Featured projects (curated by a super admin)
// follow, so the page is never an empty room on a first visit.
//
// Server component: the featured list is fetched from Convex per request so a
// newly starred project appears without a rebuild.

import Link from 'next/link';
import { fetchQuery } from 'convex/nextjs';
import { api } from '../../../convex/_generated/api';
import { INK, PAPER, ACCENT, MUTED, HAIR, label } from '../../lib/tokens.js';
import { serif, sheetX } from '../../lib/ui/sheet.js';
import SiteNav from '../../components/site/SiteNav.jsx';
import SiteFooter from '../../components/site/SiteFooter.jsx';
import UnitPlan from '../../components/site/UnitPlan.jsx';
import { UNITS } from '../../config/units.js';

// ISR: the featured list refreshes within `revalidate` seconds via the Full Route
// Cache, so Convex `featured` runs ~once/interval instead of once per visit.
// force-static is REQUIRED, not just revalidate: fetchQuery issues a cache:'no-store'
// fetch, which would otherwise bail this page to dynamic (markCurrentScopeAsDynamic).
// Under force-static that call no-ops, so the page stays cached. Safe: no searchParams/
// cookies/headers read here. ponytail: platform ISR, no cache lib.
export const dynamic = 'force-static';
export const revalidate = 300; // featuring is a rare manual super-admin act

// openGraph.title is spelled out because the layout sets an explicit one; a page
// that only overrides `title` inherits the site-wide OG title, so every share
// card looked identical. Images still fall through to app/opengraph-image.js.
const gDescription = 'Studio to three-bedroom — walk each apartment type end to end in your browser.';

export const metadata = {
  title: 'Showroom',
  description: gDescription,
  alternates: { canonical: '/gallery' },
  openGraph: { title: 'Showroom · Rahman 3D Interior', description: gDescription, url: '/gallery' },
  twitter: { card: 'summary_large_image', title: 'Showroom · Rahman 3D Interior', description: gDescription },
};

const TILE_GRADIENTS = [
  'linear-gradient(145deg, #d8cdb8 0%, #c9bca2 55%, #b7a98c 100%)',
  'linear-gradient(145deg, #c4c8bd 0%, #a9b1a4 60%, #8f9a8c 100%)',
  'linear-gradient(145deg, #d6c4b6 0%, #c2a995 60%, #a88a74 100%)',
  'linear-gradient(145deg, #ddc8ab 0%, #cdaf86 60%, #b8966a 100%)',
];

// The hairline lattice is drawn by the TILES (right + bottom), not by a HAIR-
// coloured container showing through 1px gaps. With auto-fill the row is padded
// out to the full width, and the container trick painted those empty tracks as a
// grey slab — very visible with only a couple of tiles up.
const grid = {
  marginTop: 'clamp(28px, 4vh, 48px)',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
  gap: 0,
  borderTop: `1px solid ${HAIR}`,
  borderLeft: `1px solid ${HAIR}`,
};

const tileBase = {
  textDecoration: 'none',
  color: INK,
  background: PAPER,
  padding: 'clamp(16px, 2vw, 22px)',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  borderRight: `1px solid ${HAIR}`,
  borderBottom: `1px solid ${HAIR}`,
};

/** A unit type: real plan drawing, area, and a way straight into the walk. */
function UnitTile({ unit, index }) {
  return (
    <Link href={'/tour?unit=' + unit.key} style={tileBase}>
      <div style={{ position: 'relative', aspectRatio: '4 / 3', background: TILE_GRADIENTS[index % TILE_GRADIENTS.length], border: `1px solid ${HAIR}`, padding: 10 }}>
        <UnitPlan plan={unit.plan} ink={INK} />
        <span style={{ position: 'absolute', top: 10, left: 10, ...label, fontSize: 10, color: ACCENT, background: 'rgba(233,227,216,.6)', padding: '3px 7px' }}>
          {'TYPE ' + String.fromCharCode(65 + index)}
        </span>
        <span style={{ position: 'absolute', bottom: 10, right: 10, ...label, fontSize: 10, color: INK, background: 'rgba(233,227,216,.6)', padding: '3px 7px' }}>
          {unit.area} m²
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <h2 style={{ ...serif, margin: 0, fontWeight: 500, fontSize: 'clamp(20px, 2.6vw, 27px)', lineHeight: 1.05 }}>{unit.name}</h2>
        <p style={{ ...label, fontSize: 10, color: MUTED, margin: 0 }}>{unit.spec}</p>
        <p style={{ fontFamily: 'var(--font-sans), sans-serif', fontWeight: 300, fontSize: 13, lineHeight: 1.6, color: MUTED, margin: '2px 0 0' }}>{unit.tagline}</p>
        <span style={{ ...label, fontSize: 10, color: ACCENT, marginTop: 4 }}>Walk it →</span>
      </div>
    </Link>
  );
}

/** A featured project — someone else's work, so no plan drawing to be had. */
function ProjectTile({ href, index, name, meta, tag }) {
  return (
    <Link href={href} style={tileBase}>
      <div style={{ position: 'relative', aspectRatio: '4 / 3', background: TILE_GRADIENTS[index % TILE_GRADIENTS.length], border: `1px solid ${HAIR}` }}>
        <svg aria-hidden="true" viewBox="0 0 120 90" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <g fill="none" stroke={INK} strokeOpacity="0.18" strokeWidth="0.6">
            <rect x="10" y="9" width="100" height="72" />
            <line x1="56" y1="9" x2="56" y2="81" />
            <line x1="10" y1="48" x2="110" y2="48" />
            <path d="M10 30 a14 14 0 0 1 14 14" />
          </g>
        </svg>
        <span style={{ position: 'absolute', top: 10, left: 10, ...label, fontSize: 10, color: ACCENT, background: 'rgba(233,227,216,.6)', padding: '3px 7px' }}>
          {tag}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <h2 style={{ ...serif, margin: 0, fontWeight: 500, fontSize: 'clamp(20px, 2.6vw, 27px)', lineHeight: 1.05 }}>{name}</h2>
        <p style={{ ...label, fontSize: 10, color: MUTED, margin: 0 }}>{meta}</p>
        <span style={{ ...label, fontSize: 10, color: ACCENT, marginTop: 4 }}>Walk it →</span>
      </div>
    </Link>
  );
}

function SectionHead({ eyebrow, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap' }}>
      <span style={{ ...label, color: ACCENT }}>{eyebrow}</span>
      <span style={{ ...label, color: MUTED }}>{note}</span>
      <span aria-hidden="true" style={{ flex: 1, height: 1, background: HAIR, alignSelf: 'center', minWidth: 40 }} />
    </div>
  );
}

export default async function GalleryPage() {
  let items = [];
  try {
    items = await fetchQuery(api.projects.featured, {});
  } catch {
    // Convex unreachable — render the units, which need no network at all
  }

  return (
    <main style={{ background: PAPER, color: INK, fontFamily: "var(--font-sans), sans-serif", minHeight: '100vh', WebkitFontSmoothing: 'antialiased' }}>
      <SiteNav active="gallery" onHome={false} />

      <section aria-label="Apartment types" style={{ padding: `clamp(48px, 8vh, 96px) ${sheetX} clamp(40px, 6vh, 72px)` }}>
        <SectionHead eyebrow="Showroom" note="Four apartment types · walk any of them" />
        <h1 style={{ ...serif, margin: 'clamp(16px, 3vh, 28px) 0 0', fontWeight: 500, fontSize: 'clamp(36px, 8vw, 104px)', lineHeight: 0.98, letterSpacing: '-0.01em' }}>
          Walk the drawings.
        </h1>

        <p style={{ fontFamily: "var(--font-sans), sans-serif", fontWeight: 300, fontSize: 'clamp(14px, 1.8vw, 16px)', color: MUTED, lineHeight: 1.7, maxWidth: '52ch', marginTop: 'clamp(20px, 3.5vh, 34px)' }}>
          Studio to three-bedroom. Every tile below opens the real thing in your
          browser — you walk from the entrance to the window, not spin on a tripod
          point. Each plan is drawn from the same data the 3D is built from.
        </p>

        <div style={grid}>
          {UNITS.map((u, i) => <UnitTile key={u.key} unit={u} index={i} />)}
        </div>
      </section>

      <section aria-label="Featured walkthroughs" style={{ padding: `0 ${sheetX} clamp(72px, 12vh, 140px)` }}>
        <SectionHead eyebrow="Featured" note="Bring your own model · curated by the studio" />
        <p style={{ fontFamily: "var(--font-sans), sans-serif", fontWeight: 300, fontSize: 'clamp(14px, 1.8vw, 16px)', color: MUTED, lineHeight: 1.7, maxWidth: '52ch', marginTop: 'clamp(14px, 2.5vh, 22px)' }}>
          The units above are built from data, on purpose — light enough to open
          on a phone. When you want the detail, a unit baked in Blender drops
          straight in and keeps the same camera path. The first tile is exactly
          that.
        </p>
        <div style={grid}>
          {/* The baked sample stays whatever the studio has featured, so this
              section is never an empty room — and it is the honest example of
              the "swap the geometry, keep the walk" claim above. */}
          <ProjectTile
            href="/tour?demo=living-room"
            index={0}
            name="Living Room"
            tag="BAKED"
            meta="Modelled in Blender · baked AO · 3 concepts"
          />
          {items.map((p, i) => (
            <ProjectTile
              key={p.slug}
              href={'/tour?p=' + p.slug}
              index={i + 1}
              name={p.name}
              tag={'FIG. ' + String(i + 1).padStart(2, '0')}
              meta={
                new Date(p.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                + (p.hasGlb ? ' · custom model' : '')
              }
            />
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
