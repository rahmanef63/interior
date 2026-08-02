/** @type {import('next').NextConfig} */

// Security headers. The app renders user-supplied project names and fetches GLB
// blobs from Convex storage, so the origin is worth pinning down.
//
// CSP notes — each relaxation below is load-bearing, not boilerplate:
//   'unsafe-inline' (style): the whole UI is inline style objects (page.jsx et al)
//                            and three writes inline styles to overlay nodes.
//   'wasm-unsafe-eval'     : the Draco + Basis decoders are WebAssembly.
//   blob: (worker/child)   : GLTFLoader's Draco/KTX2 worker pools are blob workers.
//   connect-src convex     : the Convex client (wss for live queries) + storage blobs.
const base = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https://*.convex.cloud",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "connect-src 'self' blob: https://*.convex.cloud wss://*.convex.cloud https://*.convex.site",
  "media-src 'self'",
  "manifest-src 'self'",
];

// Everywhere except the tour.
const csp = [...base, "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'"].join('; ');

// /tour and /editor. The Basis (KTX2) transcoder is emscripten glue that calls
// `new Function` during start-up; under a policy without 'unsafe-eval' its worker
// dies and KTX2 textures never decode — verified, not assumed: the import promise
// simply never settles and the UI hangs on "busy".
//
// Scoped to this one route on purpose. It is a smaller concession than it looks:
// 'unsafe-inline' is already required here (Next's hydration bootstrap + the
// app's inline style objects), and an attacker who can inject a <script> does not
// need eval. The controls actually carrying weight on this route are
// frame-ancestors 'none', object-src 'none', base-uri 'self', and the fact that
// every user string reaches the DOM through a React text node or textContent —
// plus contract.js rejecting < and > outright.
const cspTour = [...base, "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' 'unsafe-eval'"].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  // Only meaningful over HTTPS; harmless on localhost because browsers ignore
  // HSTS from a non-secure origin.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // more specific rule must come after: later entries override earlier ones
      // for the same header key
      // Both routes decode user-supplied GLBs, so both need the Basis transcoder.
      // Listed explicitly rather than as a pattern: this relaxes a security header,
      // and a regex here would quietly widen the moment a route name rhymes.
      // /dev-editor is the editor's test harness (EDITOR_TEST_HARNESS=1 only, 404
      // otherwise). It MUST carry the same policy as /editor: without it the
      // Basis transcoder dies under the strict CSP and the KTX2 regression test
      // fails for a reason that has nothing to do with the code it is testing —
      // which is exactly what happened when this list was first written.
      ...['/tour', '/editor', '/dev-editor'].map((source) => ({
        source,
        headers: [...securityHeaders.filter((x) => x.key !== 'Content-Security-Policy'),
          { key: 'Content-Security-Policy', value: cspTour }],
      })),
      // The decoders are versioned with three and only change when three does.
      {
        source: '/:dir(draco|basis)/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

module.exports = nextConfig;
