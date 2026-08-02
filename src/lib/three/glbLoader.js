// Shared GLTFLoader factory — the ONE place a .glb turns into a three.js scene.
//
// Why this file exists: the loader used to be `new GLTFLoader()` with no
// decoders attached, in two separate places. That silently rejected every
// compressed model — including the exact ones docs/GUIDE.md tells authors to
// produce ("Compression: Draco", `gltf-transform optimize`). A Draco/KTX2/
// meshopt file failed with a raw three.js message surfaced straight to the user.
//
// All three decoders are attached here and all three are lazy: nothing below is
// in the initial bundle, and the wasm is only fetched when a model that needs it
// actually arrives.
//
// Decoders are SELF-HOSTED from /public (see scripts/vendor-decoders.mjs).
// three's DRACOLoader defaults to a gstatic.com URL; pointing at our own origin
// keeps the "a model import never touches the network" property the import path
// is built around.

const DRACO_PATH = '/draco/';
const BASIS_PATH = '/basis/';

let cached = null;         // { loader, draco, ktx2, renderer }

/**
 * Build (or reuse) a GLTFLoader with Draco + KTX2 + meshopt attached.
 *
 * @param {any}  THREE      injected three namespace
 * @param {any} [renderer]  WebGLRenderer — required for KTX2 only. KTX2Loader
 *                          must know which GPU formats the device transcodes to;
 *                          without a renderer we skip it and let the parse fail
 *                          with a message that says so.
 * @returns {Promise<any>} GLTFLoader
 */
export async function getGLTFLoader(THREE, renderer) {
  if (cached && cached.renderer === renderer) return cached.loader;

  const [{ GLTFLoader }, { DRACOLoader }, { KTX2Loader }, { MeshoptDecoder }] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/loaders/DRACOLoader.js'),
    import('three/examples/jsm/loaders/KTX2Loader.js'),
    import('three/examples/jsm/libs/meshopt_decoder.module.js'),
  ]);

  // Renderer changed (the canvas is re-created on every content change) — the
  // old KTX2 worker pool is bound to a dead context, so tear it down first.
  if (cached) disposeGLBLoaders();

  const loader = new GLTFLoader();

  const draco = new DRACOLoader().setDecoderPath(DRACO_PATH);
  draco.setDecoderConfig({ type: 'wasm' });
  loader.setDRACOLoader(draco);

  let ktx2 = null;
  if (renderer) {
    ktx2 = new KTX2Loader().setTranscoderPath(BASIS_PATH).detectSupport(renderer);
    loader.setKTX2Loader(ktx2);
  }

  loader.setMeshoptDecoder(MeshoptDecoder);

  cached = { loader, draco, ktx2, renderer };
  return loader;
}

/**
 * Parse .glb bytes. `resourcePath` is deliberately '' so glTF never resolves an
 * external URI (no SSRF) — the decoders above are the only network the import
 * path is allowed, and they are same-origin.
 *
 * @param {ArrayBuffer} buf
 * @param {any} THREE
 * @param {any} [renderer]
 * @returns {Promise<any>} gltf
 */
export async function parseGLB(buf, THREE, renderer, timeoutMs = 45_000) {
  const loader = await getGLTFLoader(THREE, renderer);
  try {
    // A decoder worker that dies (blocked by CSP, out of memory, corrupt wasm)
    // never calls back — three has no timeout of its own, so without this the
    // promise hangs forever and the host UI stays stuck on "busy" with no message.
    return await withTimeout(
      new Promise((res, rej) => loader.parse(buf, '', res, rej)),
      timeoutMs,
      'The model decoder did not respond in time. If the model is compressed '
        + '(Draco / KTX2 / meshopt), the decoder may have been blocked from loading.'
    );
  } catch (err) {
    throw new Error(explain(err));
  }
}

/** @template T @param {Promise<T>} p @param {number} ms @param {string} msg @returns {Promise<T>} */
function withTimeout(p, ms, msg) {
  let t;
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error(msg)), ms); }),
  ]);
}

/**
 * Turn three's raw decoder errors into something a person can act on. Without
 * this the user sees "THREE.GLTFLoader: setKTX2Loader must be called before
 * loading KTX2 textures" and has no idea it means their GPU lacks a format.
 * @param {any} err
 * @returns {string}
 */
function explain(err) {
  const m = (err && err.message) || String(err);
  if (/KTX2Loader/i.test(m)) {
    return 'This model uses KTX2 textures and the viewer could not initialise the '
      + 'transcoder on this device. Re-export with plain PNG/WebP textures.';
  }
  if (/DRACOLoader|draco/i.test(m)) {
    return 'This model uses Draco compression and the decoder failed to load. '
      + 'Check that /draco/ is being served, or re-export without Draco.';
  }
  if (/meshopt/i.test(m)) {
    return 'This model uses meshopt compression and the decoder failed to load.';
  }
  if (/Unsupported .*version|Unexpected magic|not a valid/i.test(m)) {
    return 'That file is not a valid .glb (glTF binary).';
  }
  return m;
}

/** Terminate the Draco / KTX2 worker pools. Call on unmount. */
export function disposeGLBLoaders() {
  if (!cached) return;
  try { cached.draco && cached.draco.dispose(); } catch { /* already gone */ }
  try { cached.ktx2 && cached.ktx2.dispose(); } catch { /* already gone */ }
  cached = null;
}
