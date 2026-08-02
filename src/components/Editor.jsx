'use client';

// The Edit half of Edit / Present.
//
// Layout is the one every CAD tool uses, because an architect can already read
// it without being taught: tools across the top, model tree on the left,
// properties on the right, and a status bar at the bottom that says what the
// mouse does RIGHT NOW. That status bar is doing more for a beginner than any
// tooltip — it changes with the active tool, so the answer to "how do I move
// around" is permanently on screen instead of hidden in a help page.

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useQuery, useMutation } from 'convex/react';
import Link from 'next/link';
import { api } from '../../convex/_generated/api';
import { EditorEngine } from '../lib/three/editorEngine.js';
import { TOOLS, TOOL_KEYS } from '../lib/three/sketchupControls.js';
import { buildBundle, validateProject } from '../lib/three/contract.js';
import { MODEL_RULES, validateModel } from '../lib/three/modelRules.js';
import { parseGLB } from '../lib/three/glbLoader.js';
import { saveLocal } from '../lib/store/local.js';
import { downloadText } from '../lib/dom/download.js';
import { INK, PAPER, ACCENT, ACCENT_TEXT, MUTED, HAIR, label } from '../lib/tokens.js';
import { UNIT_BY_KEY, DEFAULT_UNIT } from '../config/units.js';
import ViewCube from './editor/ViewCube.jsx';
import {
  IconSelect, IconOrbit, IconPan, IconZoom, IconExtents, IconLook, IconWalk,
  IconPlaceCamera, IconGrid, IconScene, IconModel, IconPresent, IconSave, IconCeiling,
} from './editor/icons.jsx';

const TOOLBAR = [
  { tool: TOOLS.SELECT, Icon: IconSelect, name: 'Select', key: 'Space', hint: 'Click a scene marker to select it.' },
  { tool: TOOLS.ORBIT, Icon: IconOrbit, name: 'Orbit', key: 'O', hint: 'Drag to spin the model around the point you grabbed.' },
  { tool: TOOLS.PAN, Icon: IconPan, name: 'Pan', key: 'H', hint: 'Drag to slide the view sideways and up/down.' },
  { tool: TOOLS.ZOOM, Icon: IconZoom, name: 'Zoom', key: 'Z', hint: 'Drag up/down to move closer or further.' },
  { tool: TOOLS.LOOK, Icon: IconLook, name: 'Look Around', key: 'L', hint: 'Drag to turn your head without moving your feet.' },
  { tool: TOOLS.WALK, Icon: IconWalk, name: 'Walk', key: 'W', hint: 'W A S D to walk, drag to steer, hold Shift to go faster.' },
  { tool: TOOLS.PLACE_CAMERA, Icon: IconPlaceCamera, name: 'Position Camera', key: 'P', hint: 'Click a spot on the floor to stand there at eye height.' },
];

// A new project starts on a showroom apartment, not the legacy loft: the shell
// is the thing a first-time author is least likely to want to build from
// scratch, and every unit already has a camera path that frames it.
const BASE_CONTENT = UNIT_BY_KEY[DEFAULT_UNIT].content;

const btnBase = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
  border: `1px solid ${HAIR}`, background: PAPER, color: INK,
  cursor: 'pointer', padding: '7px 9px', lineHeight: 1,
  font: '400 11px var(--font-sans), sans-serif', letterSpacing: '0.06em',
};

const panel = {
  background: PAPER, borderRight: `1px solid ${HAIR}`,
  overflowY: 'auto', display: 'flex', flexDirection: 'column',
};

const sectionTitle = { ...label, fontSize: 9, color: ACCENT_TEXT, padding: '12px 12px 6px', margin: 0 };

export default function Editor() {
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const engineRef = useRef(null);
  const fileRef = useRef(null);
  const glbBytesRef = useRef(null);
  const appliedSlugRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [note, setNote] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [cloudSlug, setCloudSlug] = useState(null);
  const [projName, setProjName] = useState(null);
  const [loadSlug, setLoadSlug] = useState(null);
  const [pendingGlbUrl, setPendingGlbUrl] = useState(null);
  const [dialog, setDialog] = useState(null); // { kind, title, body, value, onOk }

  // The active project's 8 contract keys. Opening a project REPLACES this, which
  // rebuilds the engine — hence the canvas key below.
  const [content, setContent] = useState(BASE_CONTENT);
  const [st, setSt] = useState({
    tool: TOOLS.ORBIT, scheme: 'sketchup', selScene: 0, sceneCount: 0, scenes: [],
    concepts: [], grid: true, markers: true, ceilings: false, hasModel: false, fov: 50,
    sel: null, hotspots: [], selHotspot: -1, roomNames: [],
  });

  const saveMut = useMutation(api.projects.save);
  const genUrlMut = useMutation(api.projects.generateUploadUrl);
  const attachMut = useMutation(api.projects.attachGlb);
  const removeMut = useMutation(api.projects.remove);
  const mineList = useQuery(api.projects.mine);
  const loaded = useQuery(api.projects.getBySlug, loadSlug ? { slug: loadSlug } : 'skip');

  // Each project change gets a FRESH canvas. A WebGL context cannot be recreated on
  // a canvas whose previous context was disposed — the rebuild throws "Cannot read
  // properties of null (reading 'precision')" and blanks the viewport. Same trap the
  // tour hit; same fix.
  const contentSeenRef = useRef(content);
  const canvasKeyRef = useRef(0);
  if (contentSeenRef.current !== content) {
    contentSeenRef.current = content;
    canvasKeyRef.current += 1;
  }

  // ---- engine lifecycle -----------------------------------------------
  useEffect(() => {
    if (!canvasRef.current) return undefined;
    let engine;
    try {
      engine = new EditorEngine({
        THREE,
        canvas: canvasRef.current,
        viewport: viewportRef.current,
        content,
        options: { daylight: 'Soft', scheme: 'sketchup' },
        onState: setSt,
        onDirty: () => setDirty(true),
      });
      engineRef.current = engine;
      engine.init();
      setReady(true);
    } catch (e) {
      setErr('Could not start the 3D viewport: ' + e.message);
      if (engine) { try { engine.dispose(); } catch { /* already down */ } }
      engineRef.current = null;
      return undefined;
    }
    return () => { engine.dispose(); engineRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  // The viewport owns the whole window; a scrollbar here would fight the wheel,
  // which the camera uses for zoom.
  // Locking body scroll is right for the fixed three-column layout: a scrollbar
  // there would fight the wheel, which the camera uses to zoom. On the stacked
  // narrow layout it is exactly wrong — it would hide the panels below the fold
  // with no way to reach them.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 901px)');
    const apply = () => { document.body.style.overflow = mq.matches ? 'hidden' : ''; };
    apply();
    mq.addEventListener('change', apply);
    return () => { mq.removeEventListener('change', apply); document.body.style.overflow = ''; };
  }, []);

  // ?p= is read in an effect, never in a state initialiser: the server renders one
  // value and the client another, which is a hydration mismatch.
  //
  // ?unit= is the showroom's "start from this plan" door: it seeds a NEW,
  // unsaved project on that apartment shell. ?p= wins — an existing project
  // already carries the shell it was authored against, in config.unit.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const p = q.get('p');
    if (p) { setLoadSlug(p); return; }
    const u = UNIT_BY_KEY[q.get('unit')];
    if (u) setContent(u.content);
  }, []);

  // Losing an afternoon of camera work to a stray Cmd-W is not recoverable, and
  // the browser will only show its own generic wording — that is still better
  // than silence.
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; return ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // ---- open a saved project -------------------------------------------
  useEffect(() => {
    if (!loadSlug || loaded === undefined || appliedSlugRef.current === loadSlug) return;
    appliedSlugRef.current = loadSlug;
    if (loaded === null) { setErr('That project could not be found.'); return; }
    // Same trust boundary as every other import path. A stored bundle is not
    // automatically trustworthy: it may predate a contract change.
    const r = validateProject(loaded.bundle);
    if (!r.ok) { setErr('That project failed validation:\n' + r.errors.join('\n')); return; }
    glbBytesRef.current = null;
    setContent(r.value);          // → engine rebuilds on a fresh canvas
    setPendingGlbUrl(loaded.glbUrl || null); // → model imported once it has
    setCloudSlug(loadSlug);
    setProjName(loaded.name);
    setDirty(false);
    setNote('Opened “' + loaded.name + '”.');
  }, [loadSlug, loaded]);

  // Queued model: fetch → gate → import. Depends on `content` so a rebuild
  // re-imports rather than dropping the model on the floor.
  useEffect(() => {
    const url = pendingGlbUrl;
    if (!url || !engineRef.current) return undefined;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const buf = await (await fetch(url)).arrayBuffer();
        if (buf.byteLength > MODEL_RULES.maxBytes) { setErr('That project’s model is too large to load.'); return; }
        const gltf = await parseGLB(buf, THREE, engineRef.current && engineRef.current.renderer);
        const gate = validateModel(gltf, THREE);
        if (cancelled) return;
        if (!gate.ok) { setErr('The project’s model was rejected:\n' + gate.errors.join('\n')); return; }
        if (!engineRef.current) return; // disposed while we awaited
        await engineRef.current.importGLB(buf);
        glbBytesRef.current = buf; // so "Save a copy" carries the model
        setDirty(false);           // loading is not editing
      } catch (e) {
        if (!cancelled) setErr('The project’s model failed to load: ' + e.message);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pendingGlbUrl, content]);

  // ---- keyboard --------------------------------------------------------
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      // Never steal a key from a text field — renaming a project types an "o".
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const eng2 = engineRef.current;
      if (!eng2) return;
      const k = e.key.toLowerCase();
      if (e.shiftKey && k === 'z') { e.preventDefault(); eng2.zoomExtents(); return; }
      const tool = TOOL_KEYS[e.key === ' ' ? ' ' : k];
      if (tool) { e.preventDefault(); eng2.setTool(tool); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const eng = () => engineRef.current;
  const clearMsgs = useCallback(() => { setErr(null); setNote(null); }, []);

  const ask = useCallback((opts) => new Promise((resolve) => {
    setDialog({ ...opts, onDone: (v) => { setDialog(null); resolve(v); } });
  }), []);

  // ---- scenes ----------------------------------------------------------
  const addScene = useCallback(() => {
    const e = eng(); if (!e) return;
    clearMsgs();
    e.addSceneFromView();
    setNote('Scene added from the current view.');
  }, [clearMsgs]);

  const updateScene = useCallback(() => {
    const e = eng(); if (!e) return;
    clearMsgs();
    e.updateSceneFromView();
    setNote('Scene ' + String(e.selScene + 1).padStart(2, '0') + ' now matches this view.');
  }, [clearMsgs]);

  const removeScene = useCallback(() => {
    const e = eng(); if (!e) return;
    clearMsgs();
    const r = e.removeScene();
    if (!r.ok) setErr(r.reason);
  }, [clearMsgs]);

  // ---- model -----------------------------------------------------------
  const onPickFile = useCallback(async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    const e = eng();
    if (!file || !e) return;
    clearMsgs();
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      if (buf.byteLength > MODEL_RULES.maxBytes) {
        setErr(`That file is ${(buf.byteLength / 1e6).toFixed(1)} MB — the limit is ${(MODEL_RULES.maxBytes / 1e6).toFixed(0)} MB.`);
        return;
      }
      // Same gate as the tour: parse in memory, measure, then hand the SAME bytes
      // to the engine. A model that fails here never reaches the scene.
      const gltf = await parseGLB(buf, THREE, e.renderer);
      const gate = validateModel(gltf, THREE);
      if (!gate.ok) { setErr('Model rejected:\n' + gate.errors.join('\n')); return; }
      await e.importGLB(buf);
      glbBytesRef.current = buf;
      e.zoomExtents();
      setNote(file.name + ' loaded. Zoomed to fit.');
    } catch (e2) {
      setErr('Could not read that model: ' + e2.message);
    } finally {
      setBusy(false);
    }
  }, [clearMsgs]);

  const clearModel = useCallback(() => {
    const e = eng(); if (!e) return;
    clearMsgs();
    glbBytesRef.current = null;
    e.clearImportedModel();
  }, [clearMsgs]);

  // ---- project CRUD ----------------------------------------------------
  const currentBundle = useCallback(() => {
    const e = eng();
    return e ? buildBundle(e.exportProject()) : null;
  }, []);

  /**
   * One write path for save / rename / duplicate.
   *
   * `slug` omitted mints a new project — which is exactly what "Save a copy" is.
   * The GLB is re-uploaded rather than sharing the original's storage id: two
   * documents pointing at one blob means deleting either project deletes the
   * other's model, and refcounting storage is not worth a copy button.
   */
  const writeProject = useCallback(async (name, slug, { withModel = true } = {}) => {
    const bundle = currentBundle();
    if (!bundle) return null;
    // Validate before sending. A bundle the contract rejects saves fine and then
    // fails to open — the worst possible moment to find out.
    const check = validateProject(bundle);
    if (!check.ok) { setErr('This project is not valid yet:\n' + check.errors.join('\n')); return null; }
    const res = await saveMut({ slug: slug || undefined, name, bundle });
    if (withModel && glbBytesRef.current) {
      const url = await genUrlMut({});
      const up = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'model/gltf-binary' }, body: glbBytesRef.current });
      const { storageId } = await up.json();
      await attachMut({ slug: res.slug, storageId });
    }
    return res.slug;
  }, [currentBundle, saveMut, genUrlMut, attachMut]);

  const save = useCallback(async () => {
    if (!eng() || busy) return;
    clearMsgs();
    let name = projName;
    if (!name) {
      name = await ask({
        title: 'Name this project',
        hint: 'You can rename it later.',
        value: 'Untitled walkthrough',
        ok: 'Save',
      });
      if (!name) return;
    }
    setBusy(true);
    try {
      const slug = await writeProject(name, cloudSlug);
      if (!slug) return;
      setCloudSlug(slug);
      setProjName(name);
      setDirty(false);
      setNote('Saved “' + name + '”.');
    } catch (e2) {
      setErr('Save failed: ' + (e2.message || String(e2)));
    } finally {
      setBusy(false);
    }
  }, [busy, projName, cloudSlug, clearMsgs, ask, writeProject]);

  const duplicate = useCallback(async () => {
    if (!eng() || busy) return;
    clearMsgs();
    const name = await ask({
      title: 'Save a copy',
      hint: 'The copy becomes the project you are editing.',
      value: ((projName || 'Untitled walkthrough') + ' copy').slice(0, 100),
      ok: 'Create copy',
    });
    if (!name) return;
    setBusy(true);
    try {
      const slug = await writeProject(name, null); // no slug → new project
      if (!slug) return;
      setCloudSlug(slug);
      setProjName(name);
      setDirty(false);
      setNote('Copied to “' + name + '”.');
    } catch (e2) {
      setErr('Could not copy: ' + (e2.message || String(e2)));
    } finally {
      setBusy(false);
    }
  }, [busy, projName, clearMsgs, ask, writeProject]);

  const rename = useCallback(async () => {
    if (!cloudSlug || busy) return;
    clearMsgs();
    const name = await ask({ title: 'Rename project', value: projName || '', ok: 'Rename' });
    if (!name) return;
    setBusy(true);
    try {
      // `save` is the only writer, so a rename re-sends the bundle. That is also
      // what makes it safe: the name and the data can never disagree.
      const slug = await writeProject(name, cloudSlug, { withModel: false });
      if (!slug) return;
      setProjName(name);
      setDirty(false);
      setNote('Renamed to “' + name + '”.');
    } catch (e2) {
      setErr('Rename failed: ' + (e2.message || String(e2)));
    } finally {
      setBusy(false);
    }
  }, [cloudSlug, projName, busy, clearMsgs, ask, writeProject]);

  const destroy = useCallback(async () => {
    if (!cloudSlug || busy) return;
    clearMsgs();
    const ok = await ask({
      kind: 'confirm',
      title: 'Delete this project?',
      hint: 'This removes “' + (projName || 'this project') + '” and its uploaded model for good. Any share link stops working.',
      ok: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await removeMut({ slug: cloudSlug });
      setCloudSlug(null);
      setProjName(null);
      appliedSlugRef.current = null;
      setLoadSlug(null);
      setNote('Project deleted. You are now editing an unsaved draft.');
    } catch (e2) {
      setErr('Delete failed: ' + (e2.message || String(e2)));
    } finally {
      setBusy(false);
    }
  }, [cloudSlug, projName, busy, clearMsgs, ask, removeMut]);

  const newProject = useCallback(async () => {
    if (busy) return;
    if (dirty) {
      const ok = await ask({
        kind: 'confirm',
        title: 'Start a new project?',
        hint: 'You have unsaved changes. Starting fresh discards them.',
        ok: 'Discard and start new',
        danger: true,
      });
      if (!ok) return;
    }
    clearMsgs();
    glbBytesRef.current = null;
    appliedSlugRef.current = null;
    setLoadSlug(null);
    setPendingGlbUrl(null);
    setCloudSlug(null);
    setProjName(null);
    setDirty(false);
    // A fresh object identity, not BASE_CONTENT itself: the canvas key compares by
    // reference, and reusing the same object would skip the rebuild.
    setContent({ ...BASE_CONTENT });
    setNote(`New project started from the ${UNIT_BY_KEY[DEFAULT_UNIT].name} plan.`);
  }, [busy, dirty, ask, clearMsgs]);

  const openProject = useCallback(async (slug) => {
    if (busy || slug === cloudSlug) return;
    if (dirty) {
      const ok = await ask({
        kind: 'confirm',
        title: 'Open another project?',
        hint: 'You have unsaved changes. Opening discards them.',
        ok: 'Discard and open',
        danger: true,
      });
      if (!ok) return;
    }
    clearMsgs();
    appliedSlugRef.current = null;
    setPendingGlbUrl(null);
    setLoadSlug(slug);
  }, [busy, dirty, cloudSlug, ask, clearMsgs]);

  const present = useCallback(() => {
    const b = currentBundle();
    if (!b) return;
    clearMsgs();
    // A saved and unmodified project presents from the cloud (shareable). Anything
    // else goes through the same localStorage draft the tour already restores on
    // load, so Present never shows something other than what is on screen.
    if (cloudSlug && !dirty) { window.open('/tour?p=' + encodeURIComponent(cloudSlug), '_blank', 'noopener'); return; }
    saveLocal(b);
    window.open('/tour', '_blank', 'noopener');
  }, [cloudSlug, dirty, currentBundle, clearMsgs]);

  const exportJson = useCallback(() => {
    const b = currentBundle();
    if (!b) return;
    downloadText((projName || 'walkthrough').replace(/\s+/g, '-').toLowerCase() + '.json', JSON.stringify(b, null, 2));
  }, [currentBundle, projName]);

  // ---- derived ---------------------------------------------------------
  const activeTool = TOOLBAR.find((t) => t.tool === st.tool) || TOOLBAR[1];
  const sel = st.scenes[st.selScene];
  const selHs = (st.hotspots || []).find((h) => h.i === st.selHotspot) || null;
  const mouseHint = st.scheme === 'autocad'
    ? 'Middle-drag: pan · Shift+Middle: orbit · Scroll: zoom to cursor'
    : 'Middle-drag: orbit · Shift+Middle: pan · Scroll: zoom to cursor';

  return (
    <div
      className="r3i-ed-root"
      style={{
        minHeight: '100dvh', display: 'grid',
        gridTemplateRows: 'auto 1fr auto', gridTemplateColumns: '1fr',
        background: PAPER, color: INK, fontFamily: 'var(--font-sans), sans-serif',
      }}
    >
      {/* ─────────────── toolbar ─────────────── */}
      <header style={{ borderBottom: `1px solid ${HAIR}`, display: 'flex', alignItems: 'center', gap: 14, padding: '8px 12px', flexWrap: 'wrap' }}>
        <Link href="/" style={{ ...label, fontSize: 12, letterSpacing: '.16em', color: INK, textDecoration: 'none', fontWeight: 500 }}>
          Rahman 3D
        </Link>

        <div role="toolbar" aria-label="Navigation tools" style={{ display: 'flex', gap: 2 }}>
          {TOOLBAR.map(({ tool, Icon, name, key }) => {
            const on = st.tool === tool;
            return (
              <button
                key={tool}
                type="button"
                aria-pressed={on}
                title={`${name} (${key})`}
                onClick={() => eng() && eng().setTool(tool)}
                style={{
                  ...btnBase, padding: 8,
                  background: on ? ACCENT : PAPER,
                  color: on ? PAPER : INK,
                  borderColor: on ? ACCENT : HAIR,
                }}
              >
                <Icon />
                <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{name}</span>
              </button>
            );
          })}
        </div>

        <span aria-hidden="true" style={{ width: 1, height: 22, background: HAIR }} />

        <button type="button" style={btnBase} title="Zoom Extents (Shift+Z)" onClick={() => eng() && eng().zoomExtents()}>
          <IconExtents /> Fit
        </button>
        <button
          type="button"
          style={{ ...btnBase, background: st.ceilings ? '#ded6c7' : PAPER }}
          aria-pressed={st.ceilings}
          title="Show or hide ceilings"
          onClick={() => eng() && eng().toggleCeilings()}
        >
          <IconCeiling /> Ceiling
        </button>
        <button
          type="button"
          style={{ ...btnBase, background: st.grid ? '#ded6c7' : PAPER }}
          aria-pressed={st.grid}
          title="Show or hide the ground grid and axes"
          onClick={() => eng() && eng().setOptions({ grid: !st.grid })}
        >
          <IconGrid /> Grid
        </button>

        <div style={{ flex: 1 }} />

        <input ref={fileRef} type="file" accept=".glb,model/gltf-binary" onChange={onPickFile} style={{ display: 'none' }} />
        <button type="button" style={btnBase} disabled={busy} onClick={() => fileRef.current && fileRef.current.click()}>
          <IconModel /> {busy ? 'Working…' : 'Import .glb'}
        </button>
        {st.hasModel && (
          <button type="button" style={btnBase} onClick={clearModel} title="Remove the imported model">Clear model</button>
        )}
        <button type="button" style={btnBase} onClick={exportJson} title="Download this project as JSON">Export</button>
        <button type="button" style={{ ...btnBase, borderColor: ACCENT, color: ACCENT_TEXT }} disabled={busy} onClick={save}>
          <IconSave /> {dirty ? 'Save *' : 'Save'}
        </button>
        <button
          type="button"
          style={{ ...btnBase, background: ACCENT, color: PAPER, borderColor: ACCENT }}
          onClick={present}
          title="Open the scroll walkthrough in a new tab"
        >
          <IconPresent /> Present
        </button>
      </header>

      {/* ─────────────── body ─────────────── */}
      {/* Three columns on a desktop; stacked with the viewport on top below
          900 px. A CAD layout cannot honestly become a phone layout — 472 px of
          side panels on a 390 px screen left the viewport with negative width —
          but refusing to open at all is worse than a stack you can scroll. */}
      <div className="r3i-ed-body" style={{ display: 'grid', gridTemplateColumns: '236px 1fr 236px', minHeight: 0 }}>
        {/* left: project + scenes */}
        <aside className="r3i-ed-left" style={panel} aria-label="Project and scenes">
          <p style={sectionTitle}>Project</p>
          <div style={{ padding: '0 12px 10px' }}>
            <p style={{ margin: 0, font: '400 13px var(--font-sans), sans-serif', color: INK, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {projName || 'Untitled draft'}
            </p>
            <p style={{ margin: '3px 0 0', ...label, fontSize: 9, color: dirty ? ACCENT_TEXT : MUTED }}>
              {dirty ? 'Unsaved changes' : cloudSlug ? 'Saved' : 'Not saved yet'}
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: '0 6px 10px' }}>
            <button type="button" style={btnBase} onClick={newProject} disabled={busy}>New</button>
            <button type="button" style={btnBase} onClick={duplicate} disabled={busy}>Copy</button>
            <button type="button" style={btnBase} onClick={rename} disabled={busy || !cloudSlug} title={cloudSlug ? 'Rename this project' : 'Save it first'}>Rename</button>
            <button
              type="button"
              style={{ ...btnBase, color: cloudSlug ? '#8d2f16' : INK }}
              onClick={destroy}
              disabled={busy || !cloudSlug}
              title={cloudSlug ? 'Delete this project' : 'Nothing saved to delete'}
            >
              Delete
            </button>
          </div>

          {Array.isArray(mineList) && mineList.length > 0 && (
            <>
              <p style={{ ...sectionTitle, paddingTop: 4 }}>Open</p>
              <ul style={{ listStyle: 'none', margin: 0, padding: '0 6px 12px', display: 'grid', gap: 2 }}>
                {mineList.map((p) => {
                  const on = p.slug === cloudSlug;
                  return (
                    <li key={p.slug}>
                      <button
                        type="button"
                        onClick={() => openProject(p.slug)}
                        aria-current={on ? 'true' : undefined}
                        disabled={busy}
                        style={{
                          ...btnBase, width: '100%', justifyContent: 'flex-start', gap: 6,
                          background: on ? '#ded6c7' : PAPER, borderColor: on ? ACCENT : HAIR,
                          minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap',
                        }}
                        title={p.name}
                      >
                        {p.hasGlb && <span aria-hidden="true" style={{ ...label, fontSize: 8, color: ACCENT_TEXT }}>3D</span>}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <p style={{ ...sectionTitle, borderTop: `1px solid ${HAIR}`, paddingTop: 12 }}>Scenes</p>
          <p style={{ margin: '0 12px 8px', font: '300 11px var(--font-sans), sans-serif', color: MUTED, lineHeight: 1.5 }}>
            Saved camera positions. The tour moves through them in order.
          </p>
          <ol style={{ listStyle: 'none', margin: 0, padding: '0 6px 10px', display: 'grid', gap: 2 }}>
            {st.scenes.map((s) => {
              const on = s.i === st.selScene;
              return (
                <li key={s.i} style={{ display: 'flex', alignItems: 'stretch', gap: 2 }}>
                  <button
                    type="button"
                    onClick={() => eng() && eng().gotoScene(s.i)}
                    aria-current={on ? 'true' : undefined}
                    style={{
                      ...btnBase, flex: 1, justifyContent: 'flex-start', gap: 8, padding: '7px 8px',
                      background: on ? '#ded6c7' : PAPER, borderColor: on ? ACCENT : HAIR,
                      // Without minWidth:0 a flex item refuses to shrink below its
                      // content, so a long room name pushed the reorder button off
                      // the edge of the panel where it could not be clicked.
                      minWidth: 0, overflow: 'hidden',
                    }}
                    title={`Fly to scene ${s.i + 1}`}
                  >
                    <IconScene size={13} />
                    <span style={{ ...label, fontSize: 9, color: ACCENT_TEXT }}>{String(s.i + 1).padStart(2, '0')}</span>
                    <span style={{ font: '300 11px var(--font-sans), sans-serif', color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.roomName}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => eng() && eng().moveScene(s.i, Math.max(0, s.i - 1))}
                    disabled={s.i === 0}
                    title="Move earlier"
                    style={{ ...btnBase, padding: '0 5px', opacity: s.i === 0 ? 0.35 : 1 }}
                  >
                    ↑
                  </button>
                </li>
              );
            })}
          </ol>
          <div style={{ display: 'grid', gap: 4, padding: '0 6px 14px' }}>
            <button type="button" style={{ ...btnBase, borderColor: ACCENT, color: ACCENT_TEXT }} onClick={addScene}>
              + Add scene from this view
            </button>
            <button type="button" style={btnBase} onClick={updateScene} disabled={!sel}>
              Update scene {sel ? String(st.selScene + 1).padStart(2, '0') : ''}
            </button>
            <button type="button" style={btnBase} onClick={removeScene} disabled={st.sceneCount <= 2}>
              Delete scene
            </button>
          </div>
        </aside>

        {/* centre: viewport */}
        <div ref={viewportRef} className="r3i-ed-view" style={{ position: 'relative', minWidth: 0, minHeight: 0, background: '#e9e3d8' }}>
          <canvas
            key={canvasKeyRef.current}
            ref={canvasRef}
            aria-label="3D viewport. Use the toolbar tools, or middle-drag to orbit and scroll to zoom."
            style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', cursor: cursorFor(st.tool) }}
          />
          {ready && <ViewCube onView={(n) => eng() && eng().standardView(n)} />}

          {(err || note) && (
            <div style={{ position: 'absolute', left: 14, bottom: 14, right: 14, display: 'grid', gap: 6, pointerEvents: 'none' }}>
              {err && (
                <div role="alert" style={msgBox('#8d2f16')}>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{err}</span>
                  <button type="button" onClick={() => setErr(null)} style={dismiss}>Dismiss</button>
                </div>
              )}
              {note && (
                <div role="status" style={msgBox(INK)}>
                  <span>{note}</span>
                  <button type="button" onClick={() => setNote(null)} style={dismiss}>Dismiss</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* right: inspector */}
        <aside className="r3i-ed-right" style={{ ...panel, borderRight: 'none', borderLeft: `1px solid ${HAIR}` }} aria-label="Properties">
          <p style={sectionTitle}>Selected scene</p>
          {sel ? (
            <div style={{ padding: '0 12px 12px', display: 'grid', gap: 10 }}>
              <Field label="Room">
                <select
                  value={sel.room}
                  onChange={(e2) => eng() && eng().setSceneRoom(st.selScene, Number(e2.target.value))}
                  style={input}
                >
                  {content.ROOMS.map((r, i) => <option key={r.name} value={i}>{r.name}</option>)}
                </select>
              </Field>
              <Field label={`Eye height — ${sel.pos[1].toFixed(2)} m`}>
                <input
                  type="range" min="0.4" max="12" step="0.02" value={sel.pos[1]}
                  onChange={(e2) => eng() && eng().setSceneHeight(Number(e2.target.value))}
                  style={{ width: '100%' }}
                />
              </Field>
              <p style={{ margin: 0, font: '300 10px var(--font-sans), sans-serif', color: MUTED, lineHeight: 1.6 }}>
                Standing eye level is about 1.60 m. A seated view is around 1.20 m.
              </p>

              {/* Exact coordinates, next to the handles rather than on the tour.
                  Direct manipulation is how you find a shot; typing is how you
                  say "exactly 1.60" or copy a value from the shot before. */}
              {st.sel && (
                <>
                  <Vec3Row
                    label="Eye"
                    values={st.sel.pos}
                    onSet={(axis, v) => eng() && eng().setSceneAxis('pos', axis, v)}
                  />
                  <Vec3Row
                    label="Looking at"
                    values={st.sel.look}
                    onSet={(axis, v) => eng() && eng().setSceneAxis('look', axis, v)}
                  />
                  <button
                    type="button"
                    style={{ ...btnBase, justifyContent: 'center' }}
                    onClick={() => { const e3 = eng(); if (e3) { e3.aimSceneAtView(); setNote('Scene aimed where the viewport is looking.'); } }}
                  >
                    Aim at current view
                  </button>
                  <p style={{ margin: 0, font: '300 10px var(--font-sans), sans-serif', color: MUTED, lineHeight: 1.6 }}>
                    In the viewport, drag the orange ball to move the camera and the
                    blue one to turn it. Hold Shift while dragging to change height
                    instead of sliding along the floor.
                  </p>
                </>
              )}
            </div>
          ) : (
            <p style={{ padding: '0 12px 12px', font: '300 11px var(--font-sans), sans-serif', color: MUTED }}>
              No scene selected.
            </p>
          )}

          <p style={sectionTitle}>Camera</p>
          <div style={{ padding: '0 12px 12px' }}>
            <Field label={`Field of view — ${st.fov}°`}>
              <input
                type="range" min="20" max="100" step="1" value={st.fov}
                onChange={(e2) => eng() && eng().setFov(Number(e2.target.value))}
                style={{ width: '100%' }}
              />
            </Field>
            <p style={{ margin: '6px 0 0', font: '300 10px var(--font-sans), sans-serif', color: MUTED, lineHeight: 1.6 }}>
              50–60° reads like a normal lens. Above 80° rooms look bigger than they are.
            </p>
          </div>

          <p style={sectionTitle}>Hotspots</p>
          <div style={{ padding: '0 12px 12px', display: 'grid', gap: 8 }}>
            <p style={{ margin: 0, font: '300 10px var(--font-sans), sans-serif', color: MUTED, lineHeight: 1.6 }}>
              The material callouts a visitor taps on the tour. Click one in the
              viewport to select it, then drag it like the camera.
            </p>
            <div style={{ display: 'grid', gap: 3 }}>
              {(st.hotspots || []).map((h) => {
                const on = h.i === st.selHotspot;
                return (
                  <button
                    key={h.i}
                    type="button"
                    aria-pressed={on}
                    onClick={() => eng() && eng().selectHotspot(h.i)}
                    style={{ ...btnBase, justifyContent: 'flex-start', textAlign: 'left', background: on ? ACCENT : PAPER, color: on ? PAPER : INK, borderColor: on ? ACCENT : HAIR }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</span>
                  </button>
                );
              })}
              {(st.hotspots || []).length === 0 && (
                <p style={{ margin: 0, font: '300 11px var(--font-sans), sans-serif', color: MUTED }}>None yet.</p>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              <button type="button" style={{ ...btnBase, justifyContent: 'center' }} onClick={() => eng() && eng().addHotspot()}>Add</button>
              <button
                type="button"
                style={{ ...btnBase, justifyContent: 'center' }}
                disabled={st.selHotspot < 0}
                onClick={() => eng() && eng().removeHotspot()}
              >
                Remove
              </button>
            </div>
            {selHs && (
              <div style={{ display: 'grid', gap: 8, borderTop: `1px solid ${HAIR}`, paddingTop: 8 }}>
                <Field label="Title">
                  <input
                    value={selHs.title}
                    aria-label="Hotspot title"
                    onChange={(e2) => eng() && eng().setHotspotField(selHs.i, 'title', e2.target.value)}
                    style={input}
                  />
                </Field>
                <Field label="Detail">
                  <input
                    value={selHs.meta}
                    aria-label="Hotspot detail"
                    onChange={(e2) => eng() && eng().setHotspotField(selHs.i, 'meta', e2.target.value)}
                    style={input}
                  />
                </Field>
                <Field label="Shown in room">
                  <select
                    value={selHs.room}
                    aria-label="Hotspot room"
                    onChange={(e2) => eng() && eng().setHotspotField(selHs.i, 'room', Number(e2.target.value))}
                    style={input}
                  >
                    {(st.roomNames || content.ROOMS.map((r) => r.name)).map((n, i) => (
                      <option key={i} value={i}>{n}</option>
                    ))}
                  </select>
                </Field>
                <Vec3Row
                  label="Position"
                  values={selHs.pos}
                  onSet={(axis, v) => eng() && eng().setHotspotField(selHs.i, ['x', 'y', 'z'][axis], v)}
                />
              </div>
            )}
          </div>

          <p style={sectionTitle}>Rooms</p>
          <div style={{ padding: '0 12px 12px', display: 'grid', gap: 10 }}>
            {(st.roomNames || content.ROOMS.map((r) => r.name)).map((rname, ri) => (
              <div key={ri}>
                {/* Renaming is the first thing anyone does after importing their
                    own model: "The Kitchen" is not what every plan calls that
                    space. Keyed by index, not by name — keying by the value you
                    are editing remounts the input on every keystroke and the
                    field loses focus after one character. */}
                <input
                  value={rname}
                  aria-label={`Room ${ri + 1} name`}
                  onChange={(e2) => eng() && eng().setRoomName(ri, e2.target.value)}
                  style={{ ...input, marginBottom: 5 }}
                />
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {content.CONCEPTS.map((c, ci) => {
                    const on = st.concepts[ri] === ci;
                    return (
                      <button
                        key={c.name}
                        type="button"
                        aria-pressed={on}
                        onClick={() => eng() && eng().setRoomConcept(ri, ci)}
                        style={{ ...btnBase, padding: '5px 7px', fontSize: 10, background: on ? ACCENT : PAPER, color: on ? PAPER : INK, borderColor: on ? ACCENT : HAIR }}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <p style={sectionTitle}>Mouse</p>
          <div style={{ padding: '0 12px 16px', display: 'flex', gap: 3 }}>
            {['sketchup', 'autocad'].map((s) => {
              const on = st.scheme === s;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => eng() && eng().setOptions({ scheme: s })}
                  style={{ ...btnBase, flex: 1, padding: '6px 8px', background: on ? ACCENT : PAPER, color: on ? PAPER : INK, borderColor: on ? ACCENT : HAIR }}
                >
                  {s === 'sketchup' ? 'SketchUp' : 'AutoCAD'}
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {/* ─────────────── status bar ─────────────── */}
      <footer
        style={{
          borderTop: `1px solid ${HAIR}`, padding: '7px 12px', display: 'flex',
          alignItems: 'center', gap: 16, flexWrap: 'wrap',
          font: '300 11px var(--font-sans), sans-serif', color: MUTED,
        }}
      >
        <span style={{ ...label, fontSize: 9, color: ACCENT_TEXT }}>{activeTool.name}</span>
        <span>{activeTool.hint}</span>
        <span aria-hidden="true" style={{ width: 1, height: 14, background: HAIR }} />
        <span>{mouseHint}</span>
        <div style={{ flex: 1 }} />
        <span>{st.sceneCount} scene{st.sceneCount === 1 ? '' : 's'}</span>
        {dirty ? <span style={{ color: ACCENT_TEXT }}>· unsaved</span> : cloudSlug ? <span>· saved</span> : null}
      </footer>

      {dialog && <Dialog {...dialog} />}
    </div>
  );
}

/**
 * One modal for naming and for confirming.
 *
 * `window.prompt` did the job but is the wrong control here: it cannot say WHY it
 * is asking, it is styled by the browser rather than the app, and some embedded
 * contexts suppress it entirely — which would leave Save silently doing nothing.
 */
function Dialog({ kind = 'prompt', title, hint, value = '', ok = 'OK', danger, onDone }) {
  const [text, setText] = useState(value);
  const inputRef = useRef(null);
  const okRef = useRef(null);

  useEffect(() => {
    const el = kind === 'confirm' ? okRef.current : inputRef.current;
    if (el) el.focus();
    if (kind !== 'confirm' && inputRef.current) inputRef.current.select();
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onDone(null); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (kind === 'confirm') { onDone(true); return; }
    const t = text.trim().slice(0, 100);
    if (!t) return; // the server rejects empty names; do not bother it
    onDone(t);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(43,38,32,.42)',
        display: 'grid', placeItems: 'center', zIndex: 100, padding: 20,
      }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          background: PAPER, border: `1px solid ${HAIR}`, padding: 20,
          width: 'min(100%, 420px)', display: 'grid', gap: 12,
          boxShadow: '0 18px 48px rgba(43,38,32,.22)',
        }}
      >
        <h2 style={{ margin: 0, font: '500 17px var(--font-serif), serif', color: INK }}>{title}</h2>
        {hint && <p style={{ margin: 0, font: '300 12px var(--font-sans), sans-serif', color: MUTED, lineHeight: 1.6 }}>{hint}</p>}
        {kind !== 'confirm' && (
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={100}
            style={{ ...input, padding: '9px 10px', fontSize: 13 }}
            aria-label={title}
          />
        )}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button type="button" style={btnBase} onClick={() => onDone(null)}>Cancel</button>
          <button
            ref={okRef}
            type="submit"
            style={{
              ...btnBase,
              background: danger ? '#8d2f16' : ACCENT, color: PAPER,
              borderColor: danger ? '#8d2f16' : ACCENT,
            }}
          >
            {ok}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Three number boxes, labelled X / Y / Z in the axis colours the viewport uses.
 *
 * `value` is driven from engine state, so a drag in the viewport updates these
 * live and typing here moves the handle — one source of truth, two ways in.
 */
function Vec3Row({ label: l, values, onSet }) {
  const AXES = [['X', '#c2592b'], ['Y', '#3a5f8a'], ['Z', '#3f6f52']];
  return (
    <div style={{ display: 'grid', gap: 5 }}>
      <span style={{ ...label, fontSize: 9, color: MUTED }}>{l}</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
        {AXES.map(([name, hex], i) => (
          <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span aria-hidden="true" style={{ ...label, fontSize: 9, color: hex }}>{name}</span>
            <input
              type="number"
              step="0.05"
              aria-label={`${l} ${name}`}
              value={Number(values[i]).toFixed(2)}
              onChange={(e) => onSet(i, Number(e.target.value))}
              style={{ ...input, padding: '5px 5px', minWidth: 0 }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function Field({ label: l, children }) {
  return (
    <label style={{ display: 'grid', gap: 5 }}>
      <span style={{ ...label, fontSize: 9, color: MUTED }}>{l}</span>
      {children}
    </label>
  );
}

const input = {
  width: '100%', background: PAPER, color: INK, border: `1px solid ${HAIR}`,
  padding: '6px 7px', font: '400 11px var(--font-sans), sans-serif',
};

const msgBox = (color) => ({
  pointerEvents: 'auto', display: 'flex', alignItems: 'flex-start', gap: 12,
  background: 'rgba(233,227,216,.94)', border: `1px solid ${color}`, color,
  padding: '8px 10px', font: '400 11px var(--font-sans), sans-serif', lineHeight: 1.5,
  maxWidth: 620,
});

const dismiss = {
  ...label, fontSize: 9, background: 'transparent', border: 'none',
  color: 'inherit', cursor: 'pointer', padding: 0, marginLeft: 'auto', textDecoration: 'underline',
};

/** The cursor is the cheapest possible "which tool am I holding" feedback. */
function cursorFor(tool) {
  switch (tool) {
    case TOOLS.PAN: return 'grab';
    case TOOLS.ZOOM: return 'zoom-in';
    case TOOLS.PLACE_CAMERA: return 'crosshair';
    case TOOLS.SELECT: return 'default';
    default: return 'move';
  }
}
