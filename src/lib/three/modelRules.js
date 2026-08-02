// GLB budget gate — runs AFTER GLTFLoader parses a model, BEFORE it enters
// the engine. Pure: it only reads parsed geometry counts and image w/h, never
// touches the DOM or the GPU. THREE is injected (matches the rest of lib/three).
//
// validateModel(gltf, THREE) -> { ok, errors[], warnings[], stats }
//   errors  -> hard block (over a limit); import must fail closed.
//   warnings-> soft heads-up (>80% of a limit); import may proceed.

import { MODEL_LIMITS } from './contract.js';

export const MODEL_RULES = {
  ext: '.glb',
  maxBytes: MODEL_LIMITS.maxBytes, // one byte cap, shared with the server-side gate
  maxTriangles: 150000,
  maxTextureDim: 2048,
  maxTextures: 16,
};

const TEXTURE_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'];

/**
 * Measure a parsed glTF against MODEL_RULES.
 * @param {{ scene?: any }} gltf  GLTFLoader result (uses gltf.scene)
 * @param {any} THREE             injected three namespace
 * @returns {{ ok: boolean, errors: string[], warnings: string[],
 *   stats: { triangles: number, meshes: number, textures: number, maxTextureDim: number } }}
 */
export function validateModel(gltf, THREE) {
  const errors = [];
  const warnings = [];
  let triangles = 0;
  let meshes = 0;
  let maxTextureDim = 0;
  /** @type {Set<any>} */
  const textures = new Set();

  const scene = gltf && gltf.scene;
  if (scene && typeof scene.traverse === 'function') {
    scene.traverse((o) => {
      // isMesh, NOT `instanceof THREE.Mesh`: if three ever resolves to two module
      // instances (monorepo, alias, duplicate dep) instanceof silently returns false
      // for every mesh and this whole budget gate becomes a no-op that reports 0.
      if (!o.isMesh) return;
      meshes++;

      const geo = o.geometry;
      if (geo) {
        let tris = 0;
        if (geo.index) tris = geo.index.count / 3;
        else if (geo.attributes && geo.attributes.position) tris = geo.attributes.position.count / 3;
        // InstancedMesh renders `count` copies — bill all of them against the budget.
        triangles += tris * (o.isInstancedMesh ? (o.count || 1) : 1);
      }

      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const mat of mats) {
        for (const slot of TEXTURE_SLOTS) {
          const tex = mat && mat[slot];
          if (!tex) continue;
          textures.add(tex);
          const img = tex.image;
          if (img) {
            if (img.width > maxTextureDim) maxTextureDim = img.width;
            if (img.height > maxTextureDim) maxTextureDim = img.height;
          }
        }
      }
    });
  }

  triangles = Math.round(triangles);
  const stats = { triangles, meshes, textures: textures.size, maxTextureDim };

  gate(triangles, MODEL_RULES.maxTriangles, 'triangles', errors, warnings);
  gate(maxTextureDim, MODEL_RULES.maxTextureDim, 'texture dimension', errors, warnings);
  gate(textures.size, MODEL_RULES.maxTextures, 'textures', errors, warnings);

  return { ok: errors.length === 0, errors, warnings, stats };
}

/** Push an error over the limit, else a warning above 80% of it. */
function gate(value, limit, label, errors, warnings) {
  if (value > limit) errors.push(`${label}: ${value} exceeds limit of ${limit}`);
  else if (value > limit * 0.8) warnings.push(`${label}: ${value} is near the limit of ${limit}`);
}
