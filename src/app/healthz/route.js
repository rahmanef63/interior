// Liveness probe for uptime monitors (e.g. UptimeRobot on /healthz).
// Dependency-free: native Response.json + fetch + AbortSignal.timeout only, no
// convex client import. ponytail: default GET is a static 200 answering "is the
// web server up?"; Convex reachability is opt-in via /healthz?convex=1 so a
// backend blip does NOT flip the site's uptime signal.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const body = { ok: true, ts: Date.now() };

  if (new URL(request.url).searchParams.get('convex') === '1') {
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_CONVEX_URL + '/version', {
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      });
      body.convex = res.ok;
    } catch {
      body.convex = false;
    }
  }

  // 200 when everything asked about is healthy; 503 when Convex was asked about
  // and is down. A plain GET stays 200 — it only answers "is the web server up?".
  //
  // Previously this always returned 200, so an uptime monitor pointed at
  // /healthz?convex=1 could never alarm: the failure only showed as
  // {"convex": false} inside the body, which most monitors do not inspect.
  const degraded = body.convex === false;
  return Response.json(degraded ? { ...body, ok: false } : body, { status: degraded ? 503 : 200 });
}
