// Guest persistence for a walkthrough bundle via native localStorage.
// SSR-safe: every entry point guards `typeof window === 'undefined'`.
// Loads pass through the contract validator, so a corrupt/stale/hostile
// stored value can never reach the engine — loadLocal() fails closed to null.

import { validateProject } from '../three/contract.js';

const KEY = 'rahman3d-project';

/**
 * Persist a bundle (or bare content) as the single guest project.
 * @param {unknown} bundle
 */
export function saveLocal(bundle) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(bundle));
  } catch {
    /* quota / serialization failure — nothing to recover, drop it */
  }
}

/**
 * Read + parse + validate the stored project.
 * @returns {import('../three/contract.js').ProjectContent | null}
 *   normalized content when valid, else null on ANY failure.
 */
export function loadLocal() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const r = validateProject(JSON.parse(raw));
    return r.ok ? r.value : null;
  } catch {
    return null;
  }
}
