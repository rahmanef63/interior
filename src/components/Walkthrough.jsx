'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { WalkthroughEngine } from '../lib/three/walkthroughEngine.js';
import { UNITS, UNIT_BY_KEY, DEFAULT_UNIT } from '../config/units.js';
import { buildBundle, validateProject, PROJECT_LIMITS } from '../lib/three/contract.js';
import { useQuery, useMutation, Authenticated } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { saveLocal, loadLocal } from '../lib/store/local.js';
import { MODEL_RULES, validateModel } from '../lib/three/modelRules.js';
import { parseGLB, disposeGLBLoaders } from '../lib/three/glbLoader.js';

/**
 * Parse a .glb ArrayBuffer (in-memory, never fetches an external URI) and
 * measure it against MODEL_RULES. Pure gate — the parsed gltf is discarded;
 * the engine re-parses the same bytes when it accepts them.
 *
 * `renderer` is forwarded so KTX2 textures can be transcoded; without it a
 * KTX2 model is rejected with a message that explains why instead of a raw
 * three.js internal error.
 *
 * @param {ArrayBuffer} buf
 * @param {any} [renderer]
 * @returns {Promise<ReturnType<typeof validateModel>>}
 */
async function parseAndGate(buf, renderer) {
  const gltf = await parseGLB(buf, THREE, renderer);
  return validateModel(gltf, THREE);
}

// Built-in demo models, so a first-time visitor can try the import without owning
// a model file.
//
// A sample may carry a `project` bundle alongside its geometry. That matters:
// the default camera path is authored for the built-in three-room loft, so
// dropping a differently-shaped model in on its own frames the wrong things.
// With a project the sample brings its own waypoints, hotspots and concepts —
// the whole walkthrough, not just the mesh.
// `key` is the public handle: /tour?demo=living-room opens that sample directly,
// which is what the gallery links to while nothing has been featured yet.
const SAMPLES = [
  { key: 'living-room', name: 'Living Room', glb: 'rahman-living-room.glb', project: 'rahman-living-room.json' },
];

/** The unit /tour opens with, and the fallback for an unknown ?unit=. */
const BASE_UNIT = UNIT_BY_KEY[DEFAULT_UNIT];

/**
 * Scroll-driven 3D interior walkthrough.
 *
 * The heavy lifting lives in the framework-agnostic WalkthroughEngine; this
 * client component mounts a canvas + overlay DOM, injects `three`, and mirrors
 * the engine's "slow" state (room / concept) into React. The active project
 * content lives in React state so importing a project rebuilds the engine.
 *
 * Props:
 *   daylight: 'Soft' | 'Bright' | 'Dusk'   (default 'Soft')
 *   dust: boolean                          (default true)
 *   reflections: boolean                   (default true)
 *   io: boolean                            (default true — export/import 3D panel)
 */
export default function Walkthrough({
  daylight = 'Soft',
  dust = true,
  reflections = true,
  io = true,
}) {
  const canvasRef = useRef(null);
  const planRef = useRef(null);
  const hotspotRef = useRef(null);
  const infoRef = useRef(null);
  const heroRef = useRef(null);
  const panelRef = useRef(null);
  const progressRef = useRef(null);
  const navWrapRef = useRef(null);
  const engineRef = useRef(null);
  const lastGoodContentRef = useRef(null);
  const glbBytesRef = useRef(null);      // GLB bytes imported this session (uploadable on cloud save)
  const didRestoreRef = useRef(false);   // guest restore attempted (gates autosave)
  const appliedSlugRef = useRef(null);   // last shared/My-projects slug applied (apply once)

  // Active project content (the 8 contract PROJECT_KEYS). Importing replaces it.
  // Seeded from a showroom unit rather than the legacy loft: /tour with no
  // params is the showroom's front door, not a demo of the old sample scene.
  const [content, setContent] = useState(() => BASE_UNIT.content);
  const { CONCEPTS, ROOMS, BRAND } = content;

  // Each project change gets a FRESH canvas. A WebGL context can't be recreated on
  // a canvas whose prior context was disposed/force-lost — the rebuild would throw
  // "Cannot read properties of null (reading 'precision')" and blank the tour (this
  // fires for any returning visitor whose saved draft triggers a rebuild on mount).
  const contentSeenRef = useRef(content);
  const canvasKeyRef = useRef(0);
  if (contentSeenRef.current !== content) {
    contentSeenRef.current = content;
    canvasKeyRef.current += 1;
  }

  const [ioError, setIoError] = useState(null);
  // Successes used to be pushed through setIoError, so "Share link copied" showed
  // up in a red box announced as an alert. Separate channel, separate role.
  const [ioNote, setIoNote] = useState(null);
  const clearIo = useCallback(() => { setIoError(null); setIoNote(null); }, []);
  const [busy, setBusy] = useState(false);
  const [dl, setDl] = useState(daylight); // user-switchable daylight preset
  const dlRef = useRef(daylight);
  dlRef.current = dl;
  // prefers-reduced-motion: hold the scroll-driven tour behind an explicit opt-in
  const [motionOk, setMotionOk] = useState(false);
  const [motionGate, setMotionGate] = useState(false);

  const [state, setState] = useState(() => ({
    currentRoom: 0,
    concepts: BASE_UNIT.content.ROOMS.map((_, i) => i % BASE_UNIT.content.CONCEPTS.length),
    conceptName: BASE_UNIT.content.CONCEPTS[0].name,
    roomName: BASE_UNIT.content.ROOMS[0].name,
    roomNum: '01',
    roomTotal: String(BASE_UNIT.content.ROOMS.length).padStart(2, '0'),
  }));

  // Cloud + shared-link state. `loadSlug` seeds from the ?p= share param and is
  // reused when opening one of "My projects"; `cloudSlug` is this author's saved slug.
  // Read ?p= in an effect, never in the state initialiser: the server renders
  // null and the client would render the slug, so `viewingShared` differed
  // between the two passes and React logged a hydration mismatch.
  const [loadSlug, setLoadSlug] = useState(null);
  const [cloudSlug, setCloudSlug] = useState(null);
  // GLB queued for import once the engine has (re)built. Used by shared links and
  // by samples that ship a project bundle — both need the same "content first,
  // model second" ordering.
  const [pendingGlbUrl, setPendingGlbUrl] = useState(null);
  // ?demo=<sample key> — deep link into a bundled sample (the gallery uses it).
  const [demoKey, setDemoKey] = useState(null);
  const appliedDemoRef = useRef(null);
  // Which showroom unit is on screen. Null once a shared project, a demo or an
  // imported bundle takes over — the switcher is only meaningful while we are
  // still looking at a house unit.
  const [unitKey, setUnitKey] = useState(DEFAULT_UNIT);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const p = q.get('p');
    if (p) { setLoadSlug(p); setUnitKey(null); return; }
    // ?p= wins: a shared project is somebody's actual work, a demo is a sample.
    if (q.get('demo')) { setDemoKey(q.get('demo')); setUnitKey(null); return; }
    const u = UNIT_BY_KEY[q.get('unit')];
    if (u) { setUnitKey(u.key); setContent(u.content); }
  }, []);

  /**
   * Switch showroom unit. Rebuilds the engine (fresh content identity → fresh
   * canvas) and rewrites the URL so the shot on screen is the one you can send
   * someone. replaceState, not push: four units and a back button that walks
   * you through every one you glanced at is not a feature.
   */
  const chooseUnit = useCallback((key) => {
    const u = UNIT_BY_KEY[key];
    if (!u || key === unitKey) return;
    setUnitKey(key);
    setContent(u.content);
    window.scrollTo(0, 0);
    const q = new URLSearchParams(window.location.search);
    q.set('unit', key);
    window.history.replaceState(null, '', window.location.pathname + '?' + q.toString());
  }, [unitKey]);

  const loaded = useQuery(api.projects.getBySlug, loadSlug ? { slug: loadSlug } : 'skip');
  const trackMut = useMutation(api.analytics.track);
  // First-party, best-effort usage counter — never blocks or surfaces errors.
  const track = useCallback((event) => { trackMut({ event }).catch(() => {}); }, [trackMut]);

  // (Re)build the engine whenever the project content changes (e.g. an import).
  useEffect(() => {
    if (!canvasRef.current) return undefined;
    if (!motionOk && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMotionGate(true); // reduced-motion visitors opt in before the engine builds
      return undefined;
    }
    setMotionGate(false);
    window.scrollTo(0, 0);
    let engine;
    try {
      engine = new WalkthroughEngine({
        THREE,
        canvas: canvasRef.current,
        refs: {
          planLayer: planRef.current,
          hotspotLayer: hotspotRef.current,
          infoLayer: infoRef.current,
          progressEl: progressRef.current,
          heroEl: heroRef.current,
          panelEl: panelRef.current,
          navWrapEl: navWrapRef.current,
        },
        content,
        options: { daylight, dust, reflections },
        onState: setState,
      });
      engineRef.current = engine;
      engine.init();
      engine.setOptions({ daylight: dlRef.current }); // apply the user's preset across rebuilds
      lastGoodContentRef.current = content;
    } catch (err) {
      if (engine) { try { engine.dispose(); } catch (e) {} }
      engineRef.current = null;
      setIoError('Could not build scene: ' + err.message);
      // revert to the last project that built cleanly so the tour stays alive
      if (lastGoodContentRef.current && lastGoodContentRef.current !== content) setContent(lastGoodContentRef.current);
      return undefined;
    }
    return () => { engine.dispose(); engineRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, motionOk]);

  // live-update render options without rebuilding the scene
  useEffect(() => {
    if (engineRef.current) engineRef.current.setOptions({ daylight: dl, dust, reflections });
  }, [dl, dust, reflections]);

  // GUEST restore: once on mount, unless a shared link (?p=) or a demo deep link
  // (?demo=) takes priority — both are an explicit request for specific content,
  // so restoring the visitor's own draft on top of them would be wrong.
  //
  // Reads the params directly rather than loadSlug/demoKey: those are set by an
  // effect, and this effect runs in the same commit, before either has landed.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (!q.get('p') && !q.get('demo') && !q.get('unit')) {
      const local = loadLocal();
      if (local) { setContent(local); setUnitKey(null); }
    }
    didRestoreRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // GUEST autosave: debounced snapshot to localStorage. Skipped while viewing a
  // shared/cloud-loaded project so it never overwrites the guest's own draft.
  // A house unit is not the visitor's work, so browsing the showroom must not
  // overwrite the draft they left here last time.
  useEffect(() => {
    if (loadSlug || demoKey || unitKey || !didRestoreRef.current) return undefined;
    const id = setTimeout(() => saveLocal(buildBundle(content)), 800);
    return () => clearTimeout(id);
  }, [content, loadSlug, demoKey, unitKey]);

  // SHARED link / My-projects: apply a fetched bundle once per slug (validated
  // through the same trust boundary), then queue its GLB (if any) for import.
  useEffect(() => {
    if (!loadSlug || loaded === undefined || appliedSlugRef.current === loadSlug) return;
    appliedSlugRef.current = loadSlug;
    if (loaded === null) { setIoError('Shared project not found.'); return; }
    const r = validateProject(loaded.bundle);
    if (!r.ok) { setIoError('Shared project invalid:\n' + r.errors.join('\n')); return; }
    setContent(r.value); // → engine rebuilds with the shared content
    setPendingGlbUrl(loaded.glbUrl || null);
  }, [loadSlug, loaded]);

  // PENDING GLB: fetch → validateModel gate → import into the (rebuilt) engine.
  // Depends on `content` so a rebuild re-imports the model rather than dropping it.
  useEffect(() => {
    const url = pendingGlbUrl;
    if (!url || !engineRef.current) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const buf = await (await fetch(url)).arrayBuffer();
        if (buf.byteLength > MODEL_RULES.maxBytes) { setIoError('Model too large.'); return; }
        const gate = await parseAndGate(buf, engineRef.current && engineRef.current.renderer);
        if (cancelled) return;
        if (!gate.ok) { setIoError('Model rejected:\n' + gate.errors.join('\n')); return; }
        // re-check after the awaits: the engine may have been disposed meanwhile
        if (!engineRef.current) return;
        await engineRef.current.importGLB(buf);
        // keep the bytes so "Save a copy" carries the model instead of dropping it
        glbBytesRef.current = buf;
      } catch (err) {
        if (!cancelled) setIoError('Model failed to load: ' + err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [pendingGlbUrl, content]);

  // Count one tour open per mount (not per engine rebuild).
  useEffect(() => { track('tour_start'); }, [track]);

  const goRoom = useCallback((i) => engineRef.current && engineRef.current.goRoom(i), []);
  const chooseConcept = useCallback((ci) => { track('concept_switch'); return engineRef.current && engineRef.current.chooseConcept(ci); }, [track]);

  // Load a bundled demo through the same gate + import path a user upload took.
  // No longer reachable from a button — /tour has no sample picker since the
  // authoring tools moved to /editor — but ?demo= still uses it, and /gallery
  // links straight at it.
  //
  // Two shapes. A bare sample is just geometry, imported into the current scene.
  // A sample with a `project` swaps the whole walkthrough first — waypoints,
  // hotspots, concepts — and only then queues its model, because setContent
  // rebuilds the engine and would otherwise drop the import on the floor.
  // Queuing via pendingGlbUrl reuses the ordering the shared-link path relies on.
  const loadSample = useCallback(async (sample) => {
    const e = engineRef.current;
    if (!e || busy) return;
    clearIo();
    setBusy(true);
    try {
      if (sample.project) {
        const res = await fetch('/models/' + sample.project);
        if (!res.ok) throw new Error('project ' + res.status);
        const parsed = validateProject(await res.json());
        if (!parsed.ok) { setIoError('Sample project invalid:\n' + parsed.errors.join('\n')); return; }
        glbBytesRef.current = null;      // the incoming project brings its own model
        setContent(parsed.value);        // → engine rebuilds
        setPendingGlbUrl('/models/' + sample.glb); // → imported once it has
        return;                          // the pending-GLB effect finishes the job
      }
      const buf = await (await fetch('/models/' + sample.glb)).arrayBuffer();
      if (buf.byteLength > MODEL_RULES.maxBytes) { setIoError('Sample too large.'); return; }
      const gate = await parseAndGate(buf, e.renderer);
      if (!gate.ok) { setIoError('Sample rejected:\n' + gate.errors.join('\n')); return; }
      await e.importGLB(buf);
      glbBytesRef.current = buf; // signed-in users can then save the sample to the cloud
    } catch (err) {
      setIoError('Sample failed to load: ' + err.message);
    } finally {
      setBusy(false);
    }
  }, [busy, clearIo]);

  // ?demo= deep link. Waits for the engine (loadSample needs it) and fires once
  // per key — loadSample calls setContent, which rebuilds the engine and re-runs
  // this effect, so without the ref guard a project-carrying sample would loop.
  useEffect(() => {
    if (!demoKey || !engineRef.current || appliedDemoRef.current === demoKey) return;
    const sample = SAMPLES.find((s) => s.key === demoKey);
    appliedDemoRef.current = demoKey;
    if (!sample) { setIoError('Unknown demo: ' + demoKey); return; }
    loadSample(sample);
    // motionOk: a reduced-motion visitor has no engine until they opt in, so the
    // first pass finds engineRef null and this must run again after they do.
  }, [demoKey, content, motionOk, loadSample]);


  const cr = Math.min(state.currentRoom, ROOMS.length - 1);
  const sel = state.concepts[cr] ?? 0;
  const activeUnit = unitKey ? UNIT_BY_KEY[unitKey] : null;
  // Arrived via someone else's share link (never re-saved as our own yet). ponytail:
  // saving from this state always creates a NEW project under the viewer — owners
  // wanting to update in place open the project from "My projects" instead.
  const viewingShared = !!loadSlug && cloudSlug !== loadSlug;
  const dismissBtn = { position: 'absolute', top: 4, right: 4, width: 18, height: 18, lineHeight: '16px', textAlign: 'center', border: 0, background: 'none', color: 'inherit', fontSize: 14, cursor: 'pointer', opacity: 0.65, padding: 0 };
  const editLink = { fontFamily: "var(--font-sans),sans-serif", fontWeight: 400, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '8px 13px', borderRadius: 999, background: 'rgba(255,255,255,0.44)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', color: BRAND.accent, border: `1px solid ${BRAND.accent}`, textDecoration: 'none' };
  const msgStyle = (color, border) => ({ position: 'relative', fontFamily: "var(--font-sans),sans-serif", fontSize: 10, lineHeight: 1.5, color, background: 'rgba(243,239,231,0.94)', border: `1px solid ${border}`, borderRadius: 4, padding: '8px 24px 8px 10px', whiteSpace: 'pre-line', maxWidth: 260, wordBreak: 'break-word' });

  return (
    <div style={{ position: 'relative', width: '100%', height: '720dvh', minHeight: '720vh', background: BRAND.paper }}>
      <canvas
        key={canvasKeyRef.current}
        ref={canvasRef}
        role="img"
        aria-label={'Interactive 3D walkthrough of ' + (ROOMS[state.currentRoom]?.name || 'the interior')
          + '. Scroll to move through the rooms; the room and concept controls below do the same without scrolling.'}
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
      />

      {/* projected-overlay layers (filled imperatively by the engine) */}
      <div ref={planRef} style={{ position: 'fixed', inset: 0, zIndex: 7, pointerEvents: 'none' }} />
      <div ref={hotspotRef} style={{ position: 'fixed', inset: 0, zIndex: 8, pointerEvents: 'none' }} />
      <div ref={infoRef} style={{ position: 'fixed', zIndex: 12, display: 'none', pointerEvents: 'auto' }} />

      {/* scrims */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: 170, zIndex: 6, pointerEvents: 'none', background: 'linear-gradient(to bottom,rgba(233,227,216,.7),rgba(233,227,216,0))' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, width: '62%', height: '42%', zIndex: 6, pointerEvents: 'none', background: 'linear-gradient(to top right,rgba(233,227,216,.82),rgba(233,227,216,0))' }} />

      {/* wordmark + escape nav — the fixed-overlay tour has no site header, so the
          wordmark links home and a small row exits to the other routes. */}
      <div className="r3i-wordmark" style={{ position: 'fixed', top: 30, left: 38, zIndex: 11, pointerEvents: 'none' }}>
        <a href="/" aria-label="Rahman 3D Interior — home" style={{ display: 'inline-block', textDecoration: 'none', pointerEvents: 'auto' }}>
          <div className="r3i-mark" style={{ fontFamily: "var(--font-serif),serif", fontWeight: 500, fontSize: 21, letterSpacing: '0.16em', color: BRAND.ink, lineHeight: 1 }}>{BRAND.wordmark}</div>
          <div className="r3i-tag" style={{ fontFamily: "var(--font-sans),sans-serif", fontWeight: 400, fontSize: 10, letterSpacing: '0.34em', textTransform: 'uppercase', color: 'rgba(43,38,32,.55)', marginTop: 7 }}>{BRAND.tagline}</div>
        </a>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, pointerEvents: 'auto' }}>
          {[['↤ Home', '/'], ['Gallery', '/gallery']].map(([t, href]) => (
            <a key={href} href={href} style={{ fontFamily: "var(--font-sans),sans-serif", fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: BRAND.accent, textDecoration: 'none', borderBottom: `1px solid ${BRAND.accent}`, paddingBottom: 2 }}>{t}</a>
          ))}
        </div>
      </div>

      {/* hero */}
      <div ref={heroRef} style={{ position: 'fixed', inset: 0, zIndex: 9, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: BRAND.ink, pointerEvents: 'none', padding: '0 24px' }}>
        {/* Scrim. The hero sits over the top-down plan, and the plan draws its own
            room labels — "EST. MMXXVI" was landing directly on "BEDROOM", and the
            headline read against whatever furniture happened to be under it. A
            soft paper wash lifts the type off the drawing without hiding it, and
            it fades out well before the plan's edges so the drawing still frames
            the words. */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 64% 54% at 50% 47%, rgba(233,227,216,.94) 0%, rgba(233,227,216,.82) 42%, rgba(233,227,216,0) 76%)' }} />
        <div style={{ position: 'relative', fontFamily: "var(--font-sans),sans-serif", fontWeight: 400, fontSize: 11, letterSpacing: '0.46em', textTransform: 'uppercase', color: 'rgba(43,38,32,.6)', marginBottom: 26 }}>
          {activeUnit ? 'Unit Type · ' + activeUnit.spec : 'Interactive 3D Walkthrough · Est. MMXXVI'}
        </div>
        <h1 style={{ position: 'relative', fontFamily: "var(--font-serif),serif", fontWeight: 500, fontSize: 'clamp(46px,8.2vw,128px)', lineHeight: 0.96, letterSpacing: '-0.01em', margin: 0, maxWidth: '14ch', textWrap: 'balance' }}>
          {activeUnit ? activeUnit.name : 'Walk through your next space.'}
        </h1>
        <p style={{ position: 'relative', fontFamily: "var(--font-sans),sans-serif", fontWeight: 300, fontSize: 'clamp(14px,1.5vw,18px)', lineHeight: 1.6, color: 'rgba(43,38,32,.72)', margin: '30px auto 0', maxWidth: '48ch' }}>
          {activeUnit ? activeUnit.blurb : 'Start with the floor plan. Scroll to descend through the entrance and orbit each room — switching its concept as you pass through.'}
        </p>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 58 }}>
          <span style={{ fontFamily: "var(--font-sans),sans-serif", fontSize: 10, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(43,38,32,.55)' }}>Scroll to enter</span>
          <div style={{ width: 1, height: 34, background: 'rgba(43,38,32,.4)', animation: 'r3i-bounce 2.2s ease-in-out infinite' }} />
        </div>
      </div>

      {/* Viewer bar.
          /tour is the PRESENT half of Edit / Present, so it carries no authoring
          tools any more: export, import, reset and the sample picker all moved to
          /editor, where a project can actually be saved. What is left is what a
          client needs — plus one door back to the editor for the person who owns
          the project. Messages stay, because ?p= and ?demo= can still fail and
          failing silently is worse than a box in the corner. */}
      {io && (
        <div className="r3i-io" style={{ position: 'fixed', top: 24, right: 28, zIndex: 13, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, pointerEvents: 'auto', maxWidth: 'min(78vw, 300px)' }}>
          {viewingShared && (
            <div style={{ fontFamily: "var(--font-sans),sans-serif", fontWeight: 400, fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: BRAND.accent }}>Shared walkthrough</div>
          )}
          <Authenticated>
            <a href={cloudSlug ? '/editor?p=' + encodeURIComponent(cloudSlug) : '/editor'} style={editLink}>
              Edit this walkthrough →
            </a>
          </Authenticated>

          {ioNote && (
            <div role="status" style={msgStyle('#2b2620', 'rgba(43,38,32,0.28)')}>
              {ioNote}
              <button onClick={() => setIoNote(null)} aria-label="Dismiss message" style={dismissBtn}>×</button>
            </div>
          )}
          {ioError && (
            <div role="alert" style={msgStyle('#8f2712', 'rgba(143,39,18,0.45)')}>
              {ioError}
              <button onClick={() => setIoError(null)} aria-label="Dismiss error" style={dismissBtn}>×</button>
            </div>
          )}
        </div>
      )}

      {/* room nav */}
      <div ref={navWrapRef} className="r3i-nav" style={{ position: 'fixed', right: 36, top: '50%', transform: 'translateY(-50%)', zIndex: 11, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 210, pointerEvents: 'auto', transition: 'opacity .3s' }}>
        {ROOMS.map((r, i) => {
          const active = i === cr;
          return (
            <button key={r.name} type="button" onClick={() => goRoom(i)} aria-current={active ? 'true' : undefined} aria-label={'Go to ' + r.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 13, cursor: 'pointer', background: 'none', border: 'none', padding: 0, font: 'inherit' }}>
              <span style={{ fontFamily: "var(--font-sans),sans-serif", fontWeight: 400, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: active ? BRAND.ink : 'rgba(43,38,32,.42)', transition: 'all .3s', opacity: active ? 1 : 0.85 }}>{r.name.replace('The ', '')}</span>
              <span style={{ width: active ? 11 : 8, height: active ? 11 : 8, borderRadius: '50%', border: active ? 'none' : '1px solid rgba(43,38,32,.45)', background: active ? BRAND.ink : 'transparent', transition: 'all .3s', flex: 'none' }} />
            </button>
          );
        })}
      </div>

      {/* concept panel */}
      <div ref={panelRef} className="r3i-panel" style={{ position: 'fixed', left: 38, bottom: 40, zIndex: 11, pointerEvents: 'auto', maxWidth: 440, transition: 'opacity .5s ease' }}>
        <div style={{ fontFamily: "var(--font-sans),sans-serif", fontWeight: 400, fontSize: 11, letterSpacing: '0.34em', color: 'rgba(43,38,32,.55)' }}>{state.roomNum} <span style={{ opacity: 0.45 }}>/ {state.roomTotal}</span></div>
        <h2 style={{ fontFamily: "var(--font-serif),serif", fontWeight: 500, fontSize: 'clamp(34px,4.4vw,58px)', lineHeight: 1, letterSpacing: '-0.01em', color: BRAND.ink, margin: '8px 0 4px' }}>{state.roomName}</h2>
        <div style={{ fontFamily: "var(--font-sans),sans-serif", fontWeight: 300, fontSize: 12, letterSpacing: '0.06em', color: 'rgba(43,38,32,.62)', marginBottom: 20 }}>Concept · {state.conceptName}</div>

        {/* Unit switcher. The showroom's whole point is that a buyer compares
            plans, so the four types live in the tour itself rather than only on
            the gallery page — walking out to a listing and back in loses the
            thing you were comparing. Hidden the moment the tour is showing
            somebody's own project: there is nothing to switch between then. */}
        {unitKey && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            <span style={{ fontFamily: "var(--font-sans),sans-serif", fontWeight: 400, fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(43,38,32,.7)', marginRight: 4 }}>Unit</span>
            {UNITS.map((u) => {
              const on = u.key === unitKey;
              return (
                <button
                  key={u.key}
                  type="button"
                  onClick={() => { chooseUnit(u.key); track('unit_switch'); }}
                  aria-pressed={on}
                  title={`${u.name} · ${u.spec}`}
                  style={{ fontFamily: "var(--font-sans),sans-serif", fontWeight: 400, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '6px 11px', borderRadius: 999, cursor: 'pointer', transition: 'all .3s ease', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', background: on ? BRAND.accent : 'rgba(255,255,255,0.18)', color: on ? '#f6f2ea' : BRAND.ink, border: `1px solid ${on ? BRAND.accent : 'rgba(43,38,32,0.28)'}` }}
                >
                  {u.beds === 0 ? 'Studio' : u.beds + ' Bed'}
                  <span style={{ opacity: 0.7, marginLeft: 6 }}>{u.area} m²</span>
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {CONCEPTS.map((c, i) => {
            const on = i === sel;
            return (
              <button key={c.name} onClick={() => chooseConcept(i)} aria-pressed={on} style={{ fontFamily: "var(--font-sans),sans-serif", fontWeight: 400, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '9px 15px', borderRadius: 999, cursor: 'pointer', transition: 'all .3s ease', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', background: on ? BRAND.ink : 'rgba(255,255,255,0.18)', color: on ? '#f3efe7' : BRAND.ink, border: on ? `1px solid ${BRAND.ink}` : '1px solid rgba(43,38,32,0.28)' }}>{c.name}</button>
            );
          })}
        </div>
        {/* daylight presets — the engine re-bakes the shadow once per switch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
          <span style={{ fontFamily: "var(--font-sans),sans-serif", fontWeight: 400, fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(43,38,32,.7)', marginRight: 4 }}>Light</span>
          {Object.keys(content.DAYLIGHT).map((k) => {
            const on = k === dl;
            return (
              <button key={k} onClick={() => { setDl(k); track('daylight_switch'); }} aria-pressed={on} style={{ fontFamily: "var(--font-sans),sans-serif", fontWeight: 400, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '6px 12px', borderRadius: 999, cursor: 'pointer', transition: 'all .3s ease', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', background: on ? 'rgba(43,38,32,0.85)' : 'rgba(255,255,255,0.18)', color: on ? '#f3efe7' : BRAND.ink, border: '1px solid rgba(43,38,32,0.28)' }}>{k}</button>
            );
          })}
        </div>
      </div>

      {/* progress */}
      <div style={{ position: 'fixed', left: 0, bottom: 0, width: '100%', height: 2, zIndex: 11, background: 'rgba(43,38,32,.12)', pointerEvents: 'none' }}>
        <div ref={progressRef} style={{ height: '100%', width: '100%', background: BRAND.ink, transform: 'scaleX(0)', transformOrigin: 'left center' }} />
      </div>

      {/* prefers-reduced-motion gate — the engine only builds after an explicit opt-in */}
      {motionGate && !motionOk && (
        <div role="dialog" aria-label="Motion notice" style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, background: BRAND.paper, color: BRAND.ink, textAlign: 'center', padding: '0 24px' }}>
          <div style={{ fontFamily: "var(--font-sans),sans-serif", fontWeight: 400, fontSize: 10, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(43,38,32,.55)' }}>{BRAND.wordmark}</div>
          <h1 style={{ fontFamily: "var(--font-serif),serif", fontWeight: 500, fontSize: 'clamp(30px,5vw,54px)', maxWidth: '18ch', lineHeight: 1.1, margin: 0 }}>This tour moves with your scroll.</h1>
          <p style={{ fontFamily: "var(--font-sans),sans-serif", fontWeight: 300, fontSize: 14, color: 'rgba(43,38,32,.7)', maxWidth: '46ch', lineHeight: 1.6, margin: 0 }}>Your system prefers reduced motion, and this 3D walkthrough is camera-motion heavy. Enter only if you’re comfortable.</p>
          <button onClick={() => setMotionOk(true)} style={{ fontFamily: "var(--font-sans),sans-serif", fontWeight: 400, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', padding: '12px 22px', borderRadius: 999, cursor: 'pointer', background: BRAND.ink, color: '#f3efe7', border: `1px solid ${BRAND.ink}` }}>Enter the tour</button>
          <a href="/" style={{ fontFamily: "var(--font-sans),sans-serif", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: BRAND.accent, textDecoration: 'none', borderBottom: `1px solid ${BRAND.accent}`, paddingBottom: 2 }}>Back to home</a>
        </div>
      )}
    </div>
  );
}
