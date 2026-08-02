// Copy three's Draco + Basis decoders into public/ so the app self-hosts them.
//
// three's DRACOLoader otherwise defaults to a gstatic.com URL. Self-hosting keeps
// model import same-origin (matching the no-external-fetch guarantee the import
// path is built around) and means the viewer still works offline / behind a proxy.
//
// Run after bumping three:  npm run vendor:decoders
// The output IS committed — the Docker build has no step that would generate it.
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIBS = path.join(ROOT, 'node_modules', 'three', 'examples', 'jsm', 'libs');

// draco_encoder.js (954 KB) is deliberately NOT copied — we only ever decode.
const JOBS = [
  ['draco/gltf/draco_decoder.js',       'public/draco/draco_decoder.js'],
  ['draco/gltf/draco_decoder.wasm',     'public/draco/draco_decoder.wasm'],
  ['draco/gltf/draco_wasm_wrapper.js',  'public/draco/draco_wasm_wrapper.js'],
  ['basis/basis_transcoder.js',         'public/basis/basis_transcoder.js'],
  ['basis/basis_transcoder.wasm',       'public/basis/basis_transcoder.wasm'],
];

let total = 0;
for (const [from, to] of JOBS) {
  const src = path.join(LIBS, from);
  const dst = path.join(ROOT, to);
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await fs.copyFile(src, dst);
  const { size } = await fs.stat(dst);
  total += size;
  console.log(`  ${to.padEnd(40)} ${(size / 1024).toFixed(0).padStart(5)} KB`);
}
console.log(`\n  ${JOBS.length} files · ${(total / 1024).toFixed(0)} KB total`);
console.log('  Fetched only when a compressed model is imported — never on first paint.\n');
