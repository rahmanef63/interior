// Per-project Open Graph card for shared walkthrough links (/tour?p=<slug>).
// GET /api/og?slug=<slug> → a 1200×630 PNG naming the project. No external
// assets, so it renders in the standalone Docker runtime.
import { ImageResponse } from 'next/og';
import { fetchQuery } from 'convex/nextjs';
import { api } from '../../../../convex/_generated/api';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Slugs are minted with crypto.randomUUID() (convex/projects.js). Anything that
// isn't a UUID cannot name a project, so it never reaches Convex — this alone
// turns "GET /api/og?slug=<anything>" from an unbounded backend fan-out into a
// cheap string test.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Second bound: a tiny in-process LRU. A scraper hammering distinct valid-looking
// UUIDs still costs one Convex call each, so cap how many we'll make per minute
// and serve the generic card past that. Per-instance and deliberately dumb — it
// exists to blunt a cost spike, not to be a real rate limiter.
const CACHE = new Map();          // slug → { name, at }
const CACHE_TTL = 5 * 60 * 1000;
const CACHE_MAX = 500;
let windowStart = 0;
let windowCount = 0;
const MAX_LOOKUPS_PER_MIN = 120;

function cached(slug) {
  const hit = CACHE.get(slug);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL) { CACHE.delete(slug); return undefined; }
  return hit.name;
}

function remember(slug, name) {
  if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value); // evict oldest
  CACHE.set(slug, { name, at: Date.now() });
}

function budgetOk() {
  const now = Date.now();
  if (now - windowStart > 60_000) { windowStart = now; windowCount = 0; }
  return ++windowCount <= MAX_LOOKUPS_PER_MIN;
}

export async function GET(request) {
  const slug = new URL(request.url).searchParams.get('slug');
  let name = null;
  if (slug && UUID.test(slug)) {
    const hit = cached(slug);
    if (hit !== undefined) {
      name = hit;
    } else if (budgetOk()) {
      try {
        name = await fetchQuery(api.projects.getPublicName, { slug });
        remember(slug, name);
      } catch { /* fall back to generic card */ }
    }
  }
  const title = name || 'A shared walkthrough';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#e9e3d8',
          color: '#2b2620',
          padding: '80px 88px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, letterSpacing: 8, textTransform: 'uppercase' }}>
          <span>Rahman 3D Interior</span>
          <span style={{ color: '#c2592b' }}>Shared walkthrough</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: name ? 92 : 104, lineHeight: 1.02, letterSpacing: -2 }}>{title}</div>
          <div style={{ display: 'flex', width: 240, height: 5, background: '#c2592b', marginTop: 36 }} />
          <div style={{ fontSize: 32, marginTop: 34, maxWidth: 900, color: 'rgba(43,38,32,0.7)' }}>
            Walk this 3D interior in your browser — glide between rooms and switch each room’s concept live.
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 24, letterSpacing: 6, textTransform: 'uppercase', color: 'rgba(43,38,32,0.55)' }}>
          interior.rahmanef.com
        </div>
      </div>
    ),
    // ponytail: next/og already sets `public, immutable, max-age=31536000` in prod.
    // We override to a bounded window because the card is slug-keyed and a project
    // can be renamed — so a renamed card refreshes within ~a day instead of a year.
    { ...size, headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800' } }
  );
}
