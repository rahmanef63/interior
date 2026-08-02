// =====================================================================
//  Rahman 3D Interior walkthrough — project-bundle export/import contract.
//
//  A "project" is the plain-data content that authors a 3D walkthrough
//  (camera path, rooms, material concepts, hotspots, daylight, brand).
//  This module is the TRUST BOUNDARY for importing such a project from
//  an untrusted file picked on the client:
//
//    • JSON only. No eval, no Function, no dynamic import, no code paths.
//    • validateProject() is defensive and NEVER throws — every failure
//      is reported as a string in `errors[]`.
//    • Cross-references are checked: waypoint.room / hotspot.room must be
//      valid indices into ROOMS, and every CONCEPTS[i].pal must carry the
//      7 semantic roles the 3D geometry references (wall, rug, uph, wood,
//      accent, metal, stone) — see walkthroughEngine.colorOf(room, role).
//
//  No new dependencies. Plain ES module. JSDoc types (no TypeScript).
// =====================================================================

/**
 * @typedef {[number, number, number]} Vec3
 *
 * @typedef {Object} Waypoint
 * @property {Vec3} pos
 * @property {Vec3} look
 * @property {number} room  index into ROOMS
 *
 * @typedef {Object} Intro
 * @property {Vec3} pos
 * @property {Vec3} look
 *
 * @typedef {Object} WalkConfig
 * @property {number} fov
 * @property {number} introFraction
 * @property {Intro} intro
 * @property {Waypoint[]} waypoints
 *
 * @typedef {Object} Palette
 * @property {string} wall
 * @property {string} rug
 * @property {string} uph
 * @property {string} wood
 * @property {string} accent
 * @property {string} metal
 * @property {string} stone
 *
 * @typedef {Object} Concept
 * @property {string} name
 * @property {Palette} pal
 *
 * @typedef {Object} Room
 * @property {string} name
 *
 * @typedef {Object} PlanPin
 * @property {number} x
 * @property {number} z
 * @property {string} name
 *
 * @typedef {Object} Hotspot
 * @property {number} room  index into ROOMS
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {string} title
 * @property {string} meta
 *
 * @typedef {Object} DaylightPreset
 * @property {number} sun
 * @property {string} sunC
 * @property {number} hemi
 * @property {string} bg
 * @property {number} exp
 *
 * @typedef {Object} Daylight
 * @property {DaylightPreset} Soft
 * @property {DaylightPreset} Bright
 * @property {DaylightPreset} Dusk
 *
 * @typedef {Object} Brand
 * @property {string} wordmark
 * @property {string} tagline
 * @property {string} accent
 * @property {string} ink
 * @property {string} paper
 *
 * @typedef {Object} ProjectContent
 * @property {WalkConfig} config
 * @property {Concept[]} CONCEPTS
 * @property {Room[]} ROOMS
 * @property {PlanPin[]} PLAN
 * @property {Hotspot[]} HOTSPOTS
 * @property {string[]} ROOM_COLORS
 * @property {Daylight} DAYLIGHT
 * @property {Brand} BRAND
 *
 * @typedef {Object} Bundle
 * @property {string} schema
 * @property {string} version
 * @property {string} exportedAt
 * @property {ProjectContent} content
 *
 * @typedef {Object} ValidationResult
 * @property {boolean} ok
 * @property {string[]} errors
 * @property {ProjectContent} [value]  normalized content (only when ok)
 */

// 1.1.0 adds optional `config.concepts` (per-room concept selection).
// 1.2.0 adds optional `config.unit` (which showroom apartment the path belongs
// to). Minor bumps: older bundles still validate, and older readers ignore the
// new fields — a reader with no notion of units draws the loft, which is what
// those bundles were authored against anyway.
export const CONTRACT_VERSION = '1.2.0';
export const SCHEMA_ID = 'rahman3d.walkthrough';

/** Required top-level keys of a project content object, in canonical order. */
export const PROJECT_KEYS = ['config', 'CONCEPTS', 'ROOMS', 'PLAN', 'HOTSPOTS', 'ROOM_COLORS', 'DAYLIGHT', 'BRAND'];

/** JSON bundle size cap. */
export const PROJECT_LIMITS = { maxBytes: 4 * 1024 * 1024 };

/** Companion 3D-model byte cap (single source of truth — MODEL_RULES re-uses it).
 *  .glb only: self-contained, cannot reference external buffer/image URIs. */
export const MODEL_LIMITS = { maxBytes: 10 * 1024 * 1024 };

// ---- internal constants (not exported) ------------------------------

/** The 7 semantic roles a concept palette must define (referenced by geometry). */
export const PAL_ROLES = ['wall', 'rug', 'uph', 'wood', 'accent', 'metal', 'stone'];

/** The three required daylight presets. */
const DAYLIGHT_KEYS = ['Soft', 'Bright', 'Dusk'];

/** Sane array caps — defensive against pathological imports. */
const CAPS = {
  waypoints: 512,
  hotspots: 256,
  rooms: 64,
  concepts: 32,
  plan: 128,
  room_colors: 64,
};

/** Max length for any user-supplied string. */
const MAX_STR = 200;

/** #rgb or #rrggbb, case-insensitive. */
const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Lowercase slug, used for keys that select built-in content. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

// ---------------------------------------------------------------------
//  buildBundle
// ---------------------------------------------------------------------

/**
 * Wrap a content object in the versioned export envelope.
 * Only the 8 PROJECT_KEYS are carried (extra keys are dropped).
 * @param {ProjectContent} content
 * @returns {Bundle}
 */
export function buildBundle(content) {
  const c = content && typeof content === 'object' ? content : {};
  /** @type {any} */
  const picked = {};
  for (const k of PROJECT_KEYS) picked[k] = c[k];
  return {
    schema: SCHEMA_ID,
    version: CONTRACT_VERSION,
    exportedAt: new Date().toISOString(),
    content: picked,
  };
}

// ---------------------------------------------------------------------
//  validateProject
// ---------------------------------------------------------------------

/**
 * Validate an imported project (full bundle OR bare content object).
 * Never throws — all problems are collected in the returned errors[].
 * @param {unknown} input
 * @returns {ValidationResult}
 */
export function validateProject(input) {
  /** @type {string[]} */
  const errors = [];
  try {
    let value = input;

    // Reject obviously non-object inputs early.
    if (!isObj(value)) {
      errors.push('root: expected an object (bundle or content)');
      return { ok: false, errors };
    }

    // A bundle is { schema, version, content }. A bare content object has
    // the PROJECT_KEYS at top level (none of which is schema/version/content),
    // so this heuristic never misfires on valid content.
    const looksLikeBundle = 'schema' in value || 'content' in value || 'version' in value;
    if (looksLikeBundle) {
      const b = /** @type {any} */ (value);
      if (b.schema !== SCHEMA_ID) {
        errors.push(`schema: expected "${SCHEMA_ID}", got ${JSON.stringify(b.schema)}`);
      }
      if (typeof b.version !== 'string') {
        errors.push('version: expected a string');
      } else if (majorOf(b.version) !== majorOf(CONTRACT_VERSION)) {
        errors.push(`version: incompatible major (got "${b.version}", need ${majorOf(CONTRACT_VERSION)}.x)`);
      }
      if (!isObj(b.content)) {
        errors.push('content: expected an object');
        return { ok: false, errors };
      }
      value = b.content;
    }

    const content = /** @type {any} */ (value);

    // Required keys present.
    for (const k of PROJECT_KEYS) {
      if (!(k in content)) errors.push(`missing required key: ${k}`);
    }

    // ---- config -----------------------------------------------------
    if ('config' in content) {
      const cfg = content.config;
      if (!isObj(cfg)) {
        errors.push('config: expected an object');
      } else {
        // Range guards, not just finiteness: fov 0 or 500 makes the projection
        // matrix nonsense, and introFraction 1 divides by zero in the scroll map.
        range(cfg.fov, 'config.fov', 10, 140, errors);
        range(cfg.introFraction, 'config.introFraction', 0, 0.9, errors);
        if (!isObj(cfg.intro)) {
          errors.push('config.intro: expected an object');
        } else {
          vec3(cfg.intro.pos, 'config.intro.pos', errors);
          vec3(cfg.intro.look, 'config.intro.look', errors);
        }
        const wps = cfg.waypoints;
        if (!Array.isArray(wps)) {
          errors.push('config.waypoints: expected an array');
        } else if (wps.length < 2) {
          // The engine assumes a curve: roomAt() indexes waypoints[round(q*(N-1))]
          // and waypointScroll() divides by (N-1). One or zero waypoints crashes it,
          // and removeWaypoint() already enforces >= 2 at runtime — mirror it here.
          errors.push(`config.waypoints: need at least 2 (got ${wps.length})`);
        } else if (wps.length > CAPS.waypoints) {
          errors.push(`config.waypoints: too many (${wps.length} > ${CAPS.waypoints})`);
        } else {
          wps.forEach((w, i) => {
            const p = `config.waypoints[${i}]`;
            if (!isObj(w)) { errors.push(`${p}: expected an object`); return; }
            vec3(w.pos, `${p}.pos`, errors);
            vec3(w.look, `${p}.look`, errors);
            roomIndex(w.room, `${p}.room`, content.ROOMS, errors);
          });
        }
        // Optional (added in 1.2.0): which showroom apartment the waypoints were
        // authored against ('studio', 'one-bed', …). Bounded as a slug rather
        // than checked against the unit registry on purpose — this module is the
        // trust boundary and stays free of app data. An unknown-but-well-formed
        // slug is not an error: the engine falls back to the legacy loft, which
        // is exactly what a 1.0/1.1 bundle (no `unit` at all) already does.
        if (cfg.unit !== undefined) slug(cfg.unit, 'config.unit', errors);
        // Optional (added in 1.1.0): which concept each room is currently showing.
        // Absent in 1.0.0 bundles — the engine falls back to `i % CONCEPTS.length`.
        if (cfg.concepts !== undefined) {
          if (!Array.isArray(cfg.concepts)) {
            errors.push('config.concepts: expected an array');
          } else if (cfg.concepts.length > CAPS.rooms) {
            errors.push(`config.concepts: too many (${cfg.concepts.length} > ${CAPS.rooms})`);
          } else {
            cfg.concepts.forEach((c, i) => {
              if (!Number.isInteger(c) || c < 0 || !Array.isArray(content.CONCEPTS) || c >= content.CONCEPTS.length) {
                errors.push(`config.concepts[${i}]: not a valid CONCEPTS index`);
              }
            });
          }
        }
      }
    }

    // ---- CONCEPTS ---------------------------------------------------
    eachCapped(content.CONCEPTS, 'CONCEPTS', CAPS.concepts, errors, (cpt, p) => {
      if (!isObj(cpt)) { errors.push(`${p}: expected an object`); return; }
      str(cpt.name, `${p}.name`, errors);
      if (!isObj(cpt.pal)) {
        errors.push(`${p}.pal: expected an object`);
      } else {
        for (const role of PAL_ROLES) hex(cpt.pal[role], `${p}.pal.${role}`, errors);
      }
    });
    if (Array.isArray(content.CONCEPTS) && content.CONCEPTS.length < 1) errors.push('CONCEPTS: must have at least one concept');

    // ---- ROOMS ------------------------------------------------------
    eachCapped(content.ROOMS, 'ROOMS', CAPS.rooms, errors, (room, p) => {
      if (!isObj(room)) { errors.push(`${p}: expected an object`); return; }
      str(room.name, `${p}.name`, errors);
    });
    if (Array.isArray(content.ROOMS) && content.ROOMS.length < 1) errors.push('ROOMS: must have at least one room');

    // ---- PLAN -------------------------------------------------------
    eachCapped(content.PLAN, 'PLAN', CAPS.plan, errors, (pin, p) => {
      if (!isObj(pin)) { errors.push(`${p}: expected an object`); return; }
      finite(pin.x, `${p}.x`, errors);
      finite(pin.z, `${p}.z`, errors);
      str(pin.name, `${p}.name`, errors);
    });

    // ---- HOTSPOTS ---------------------------------------------------
    eachCapped(content.HOTSPOTS, 'HOTSPOTS', CAPS.hotspots, errors, (h, p) => {
      if (!isObj(h)) { errors.push(`${p}: expected an object`); return; }
      roomIndex(h.room, `${p}.room`, content.ROOMS, errors);
      finite(h.x, `${p}.x`, errors);
      finite(h.y, `${p}.y`, errors);
      finite(h.z, `${p}.z`, errors);
      str(h.title, `${p}.title`, errors);
      str(h.meta, `${p}.meta`, errors);
    });

    // ---- ROOM_COLORS ------------------------------------------------
    eachCapped(content.ROOM_COLORS, 'ROOM_COLORS', CAPS.room_colors, errors, (c, p) => {
      hex(c, p, errors);
    });

    // ---- DAYLIGHT ---------------------------------------------------
    if ('DAYLIGHT' in content) {
      const dl = content.DAYLIGHT;
      if (!isObj(dl)) {
        errors.push('DAYLIGHT: expected an object');
      } else {
        for (const k of DAYLIGHT_KEYS) {
          if (!isObj(dl[k])) {
            errors.push(`DAYLIGHT.${k}: missing or not an object`);
            continue;
          }
          const pr = dl[k];
          finite(pr.sun, `DAYLIGHT.${k}.sun`, errors);
          hex(pr.sunC, `DAYLIGHT.${k}.sunC`, errors);
          finite(pr.hemi, `DAYLIGHT.${k}.hemi`, errors);
          hex(pr.bg, `DAYLIGHT.${k}.bg`, errors);
          finite(pr.exp, `DAYLIGHT.${k}.exp`, errors);
        }
      }
    }

    // ---- BRAND ------------------------------------------------------
    if ('BRAND' in content) {
      const br = content.BRAND;
      if (!isObj(br)) {
        errors.push('BRAND: expected an object');
      } else {
        str(br.wordmark, 'BRAND.wordmark', errors);
        str(br.tagline, 'BRAND.tagline', errors);
        hex(br.accent, 'BRAND.accent', errors);
        hex(br.ink, 'BRAND.ink', errors);
        hex(br.paper, 'BRAND.paper', errors);
      }
    }

    if (errors.length) return { ok: false, errors };

    // Normalize to a clean content object carrying only the known keys.
    /** @type {any} */
    const out = {};
    for (const k of PROJECT_KEYS) out[k] = content[k];
    return { ok: true, errors, value: out };
  } catch (err) {
    // Defensive: a thrown error inside validation is itself a failure,
    // never a crash that escapes the trust boundary.
    errors.push('validation threw: ' + (err && err.message ? err.message : String(err)));
    return { ok: false, errors };
  }
}

// ---------------------------------------------------------------------
//  internal validators (pure, side-effect = push to errors)
// ---------------------------------------------------------------------

/** @param {unknown} v @returns {v is Record<string, unknown>} */
function isObj(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Major component of a semver-ish string ("1.2.3" -> "1"). */
function majorOf(v) {
  return String(v).split('.')[0];
}

/** Require a finite number. */
/**
 * Finite AND inside [lo, hi]. Used where an out-of-band number does not just look
 * wrong but breaks maths downstream (projection matrix, division by zero).
 * @param {unknown} v @param {string} path @param {number} lo @param {number} hi @param {string[]} errors
 */
function range(v, path, lo, hi, errors) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    errors.push(`${path}: expected a finite number`);
  } else if (v < lo || v > hi) {
    errors.push(`${path}: out of range (${v}, expected ${lo}..${hi})`);
  }
}

function finite(v, path, errors) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    errors.push(`${path}: expected a finite number`);
    return false;
  }
  return true;
}

/** Require a string within MAX_STR chars. */
function str(v, path, errors) {
  if (typeof v !== 'string') {
    errors.push(`${path}: expected a string`);
    return false;
  }
  if (v.length > MAX_STR) {
    errors.push(`${path}: string too long (${v.length} > ${MAX_STR})`);
    return false;
  }
  if (/[<>]/.test(v)) {
    // defense-in-depth vs. stored XSS; the load-bearing fix is textContent at the DOM sink
    errors.push(`${path}: must not contain angle brackets`);
    return false;
  }
  return true;
}

/** Require a hex color (#rgb or #rrggbb). */
function hex(v, path, errors) {
  if (typeof v !== 'string') {
    errors.push(`${path}: expected a hex color string`);
    return false;
  }
  if (!HEX_RE.test(v)) {
    errors.push(`${path}: invalid hex color ${JSON.stringify(v)}`);
    return false;
  }
  return true;
}

/** Require a lowercase slug (selects built-in content by key). */
function slug(v, path, errors) {
  if (typeof v !== 'string' || !SLUG_RE.test(v)) {
    errors.push(`${path}: expected a lowercase slug`);
    return false;
  }
  return true;
}

/** Require a [x,y,z] tuple of finite numbers. */
function vec3(v, path, errors) {
  if (!Array.isArray(v) || v.length !== 3) {
    errors.push(`${path}: expected [x,y,z]`);
    return false;
  }
  let ok = true;
  for (let i = 0; i < 3; i++) ok = finite(v[i], `${path}[${i}]`, errors) && ok;
  return ok;
}

/** Require an integer index in range of the ROOMS array. */
function roomIndex(v, path, rooms, errors) {
  if (!Number.isInteger(v)) {
    errors.push(`${path}: expected an integer room index`);
    return false;
  }
  const n = Array.isArray(rooms) ? rooms.length : 0;
  if (v < 0 || v >= n) {
    errors.push(`${path}: room index ${v} out of range [0..${n - 1}]`);
    return false;
  }
  return true;
}

/**
 * Iterate an array key with a cap, pushing structured errors. If the key
 * is absent (already reported as a missing key) or not an array, that is
 * reported once and iteration is skipped.
 */
function eachCapped(arr, name, cap, errors, fn) {
  if (arr === undefined) return; // missing-key error already pushed upstream
  if (!Array.isArray(arr)) {
    errors.push(`${name}: expected an array`);
    return;
  }
  if (arr.length > cap) {
    errors.push(`${name}: too many entries (${arr.length} > ${cap})`);
    return;
  }
  arr.forEach((item, i) => fn(item, `${name}[${i}]`));
}

// ---------------------------------------------------------------------
//  demo — runnable self-check
// ---------------------------------------------------------------------

/**
 * Run assert-based self-checks: a valid bundle passes, and a tampered
 * copy fails for each enforced rule. Logs 'contract demo ok' on success.
 * Uses Node's assert if available, else a tiny local assert.
 */
export function demo() {
  const assert = pickAssert();

  /** Fresh valid content every call (so mutations don't leak between cases). */
  const fresh = () => ({
    config: {
      fov: 50,
      introFraction: 0.1,
      intro: { pos: [7, 25, -1], look: [7.5, 0, -5] },
      waypoints: [
        { pos: [0, 1.62, 8], look: [0, 1.2, -2], room: 0 },
        { pos: [1.5, 1.6, -2.5], look: [4, 1.2, -3], room: 1 },
      ],
    },
    CONCEPTS: [
      { name: 'Warm Minimal', pal: { wall: '#e8e1d6', rug: '#d8cdba', uph: '#cfc6b6', wood: '#b78a52', accent: '#2c2620', metal: '#7d7468', stone: '#e7e3da' } },
    ],
    ROOMS: [{ name: 'The Living Room' }, { name: 'The Kitchen' }],
    PLAN: [{ x: 0, z: 7, name: 'Entrance' }],
    HOTSPOTS: [{ room: 1, x: 12, y: 1.05, z: 0.3, title: 'Island', meta: 'Stone' }],
    ROOM_COLORS: ['#e6c98a', '#8fb98f'],
    DAYLIGHT: {
      Soft: { sun: 2.2, sunC: '#fff1da', hemi: 0.52, bg: '#e9e3d8', exp: 1.05 },
      Bright: { sun: 3.1, sunC: '#fffaf0', hemi: 0.74, bg: '#f1ece2', exp: 1.12 },
      Dusk: { sun: 1.6, sunC: '#ffc88f', hemi: 0.36, bg: '#d8ccbd', exp: 0.95 },
    },
    BRAND: { wordmark: 'RAHMAN 3D INTERIOR', tagline: '3D Interior Studio', accent: '#c2592b', ink: '#2b2620', paper: '#e9e3d8' },
  });

  // 1) round-trip: build a bundle from valid content, validate it back.
  const bundle = buildBundle(fresh());
  assert.strictEqual(bundle.schema, SCHEMA_ID, 'bundle schema');
  assert.strictEqual(bundle.version, CONTRACT_VERSION, 'bundle version');
  assert.ok(typeof bundle.exportedAt === 'string' && bundle.exportedAt.length > 0, 'bundle exportedAt');
  const okBundle = validateProject(bundle);
  assert.ok(okBundle.ok, 'valid bundle passes: ' + okBundle.errors.join('; '));
  assert.ok(okBundle.value && okBundle.value.BRAND.wordmark === 'RAHMAN 3D INTERIOR', 'value normalized');

  // 2b) 1.1.0 additions + the guards added with them.
  const withConcepts = fresh();
  withConcepts.config.concepts = [0, 0];
  assert.ok(validateProject(withConcepts).ok, 'config.concepts (1.1.0) passes');
  // 1.2.0: config.unit. A well-formed slug passes even if this build has no such
  // unit — the engine degrades to the loft. Only malformed input fails.
  const withUnit = fresh();
  withUnit.config.unit = 'two-bed';
  assert.ok(validateProject(withUnit).ok, 'config.unit (1.2.0) passes');
  const futureUnit = fresh();
  futureUnit.config.unit = 'penthouse-not-built-yet';
  assert.ok(validateProject(futureUnit).ok, 'unknown but well-formed unit passes');
  // a 1.0.0 bundle (no config.concepts, older version string) still validates
  const old = { schema: SCHEMA_ID, version: '1.0.0', exportedAt: 'x', content: fresh() };
  assert.ok(validateProject(old).ok, '1.0.0 bundle still accepted');

  // 2) bare content (no envelope) also passes.
  assert.ok(validateProject(fresh()).ok, 'bare content passes');

  // Each tampered case MUST fail. `mut` mutates a fresh content object.
  const fails = (label, mut) => {
    const c = fresh();
    mut(c);
    const r = validateProject(c);
    assert.ok(!r.ok, `expected failure: ${label}`);
    assert.ok(r.errors.length > 0, `expected errors for: ${label}`);
  };

  // ---- guards added in 1.1.0 (each of these used to slip through) ----
  fails('single waypoint (engine divides by N-1)', (c) => { c.config.waypoints = [c.config.waypoints[0]]; });
  fails('zero waypoints', (c) => { c.config.waypoints = []; });
  fails('fov zero', (c) => { c.config.fov = 0; });
  fails('fov absurd', (c) => { c.config.fov = 500; });
  fails('introFraction 1 (divides by zero)', (c) => { c.config.introFraction = 1; });
  fails('introFraction negative', (c) => { c.config.introFraction = -0.2; });
  fails('config.unit with a path separator', (c) => { c.config.unit = '../../etc'; });
  fails('config.unit not a string', (c) => { c.config.unit = 3; });
  fails('config.unit uppercase', (c) => { c.config.unit = 'Two-Bed'; });
  fails('config.concepts not an array', (c) => { c.config.concepts = 3; });
  fails('config.concepts index out of range', (c) => { c.config.concepts = [0, 9]; });
  fails('config.concepts non-integer', (c) => { c.config.concepts = [0, 1.5]; });

  // wrong schema id (bundle form)
  (() => {
    const b = buildBundle(fresh());
    b.schema = 'evil.schema';
    assert.ok(!validateProject(b).ok, 'wrong schema id fails');
  })();

  // major-version mismatch
  (() => {
    const b = buildBundle(fresh());
    b.version = '2.0.0';
    assert.ok(!validateProject(b).ok, 'major version mismatch fails');
  })();

  // minor/patch bump still OK within same major
  (() => {
    const b = buildBundle(fresh());
    b.version = '1.9.9';
    assert.ok(validateProject(b).ok, 'same-major version passes');
  })();

  fails('missing required key (BRAND)', (c) => { delete c.BRAND; });
  fails('wrong type: config not object', (c) => { c.config = 'nope'; });
  fails('wrong type: ROOMS not array', (c) => { c.ROOMS = {}; });
  fails('non-finite fov', (c) => { c.config.fov = NaN; });
  fails('non-finite Infinity in pos', (c) => { c.config.waypoints[0].pos[1] = Infinity; });
  fails('vec3 wrong arity', (c) => { c.config.intro.pos = [1, 2]; });
  fails('non-numeric plan coord', (c) => { c.PLAN[0].x = '0'; });
  fails('bad hex in palette', (c) => { c.CONCEPTS[0].pal.wall = 'e8e1d6'; });
  fails('missing palette role', (c) => { delete c.CONCEPTS[0].pal.stone; });
  fails('bad hex in ROOM_COLORS', (c) => { c.ROOM_COLORS[0] = '#xyz'; });
  fails('bad hex in DAYLIGHT', (c) => { c.DAYLIGHT.Soft.sunC = 'white'; });
  fails('DAYLIGHT missing Dusk', (c) => { delete c.DAYLIGHT.Dusk; });
  fails('waypoint.room out of range', (c) => { c.config.waypoints[0].room = 9; });
  fails('waypoint.room negative', (c) => { c.config.waypoints[0].room = -1; });
  fails('hotspot.room out of range', (c) => { c.HOTSPOTS[0].room = 5; });
  fails('hotspot.room non-integer', (c) => { c.HOTSPOTS[0].room = 1.5; });
  fails('string too long', (c) => { c.BRAND.wordmark = 'x'.repeat(MAX_STR + 1); });
  fails('too many waypoints', (c) => {
    c.config.waypoints = new Array(CAPS.waypoints + 1).fill(0).map(() => ({ pos: [0, 0, 0], look: [0, 0, 0], room: 0 }));
  });
  fails('too many rooms', (c) => {
    c.ROOMS = new Array(CAPS.rooms + 1).fill(0).map((_, i) => ({ name: 'R' + i }));
  });

  // non-object / junk inputs never throw, always fail.
  for (const junk of [null, undefined, 42, 'str', [], true]) {
    const r = validateProject(junk);
    assert.ok(!r.ok, 'junk input fails: ' + String(junk));
  }

  // cyclic / pathological input never throws — fails closed.
  (() => {
    const weird = {};
    weird.self = weird;
    const r = validateProject(weird);
    assert.ok(!r.ok, 'cyclic input fails closed without throwing');
  })();

  // eslint-disable-next-line no-console
  console.log('contract demo ok');
  return true;
}

/** Pick Node's assert if present (in any module shape), else a tiny shim. */
function pickAssert() {
  const g = /** @type {any} */ (globalThis);
  if (g.assert && typeof g.assert.ok === 'function' && typeof g.assert.strictEqual === 'function') {
    return g.assert;
  }
  const ok = (cond, msg) => { if (!cond) throw new Error('assert failed: ' + (msg || '')); };
  const strictEqual = (a, b, msg) => { if (a !== b) throw new Error(`assert.strictEqual failed (${String(a)} !== ${String(b)}): ${msg || ''}`); };
  return { ok, strictEqual };
}
