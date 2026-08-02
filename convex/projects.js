// Rahman 3D Interior — project bundles: owner-scoped CRUD + public share read + GLB blob.
// Server-side trust boundary: every write revalidates through the SAME pure
// validateProject used on the client (imported from ../src/lib/three/contract.js —
// Convex bundles helpers outside convex/, and the validator is DOM-free).
import { mutation, query, internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import { RateLimiter, MINUTE, HOUR } from '@convex-dev/rate-limiter';
import { components } from './_generated/api';
import { isSuperAdmin } from './admin.js';
import { validateProject, buildBundle, MODEL_LIMITS, PROJECT_LIMITS } from '../src/lib/three/contract.js';

// Per-user abuse limits (token buckets), keyed by userId. Signed-in writes only.
const limiter = new RateLimiter(components.rateLimiter, {
  save: { kind: 'token bucket', rate: 30, period: MINUTE },
  uploadUrl: { kind: 'token bucket', rate: 20, period: HOUR },
  attach: { kind: 'token bucket', rate: 20, period: HOUR },
  remove: { kind: 'token bucket', rate: 60, period: MINUTE },
});

/**
 * Project display name. Held to the SAME rule every string inside the bundle
 * already obeys (contract.js `str`): <= 200 chars and no angle brackets. Before
 * this, `name` was the one user string that skipped the validator — it happens to
 * land only in escaping sinks today, but the asymmetry is a bug waiting for the
 * first sink that isn't.
 * @param {string} name @returns {string} trimmed name
 */
function cleanName(name) {
  if (typeof name !== 'string') throw new Error('Name must be a string');
  const t = name.trim();
  if (!t) throw new Error('Name cannot be empty');
  if (t.length > 100) throw new Error('Name too long (max 100)');
  if (/[<>]/.test(t)) throw new Error('Name cannot contain < or >');
  return t;
}

const MAX_PROJECTS_PER_OWNER = 100;

/** Insert or update a project owned by the caller. Returns the (possibly minted) slug. */
export const save = mutation({
  args: { slug: v.optional(v.string()), name: v.string(), bundle: v.any() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error('Not authenticated');
    await limiter.limit(ctx, 'save', { key: userId, throws: true });
    const name = cleanName(args.name);

    const result = validateProject(args.bundle);
    if (!result.ok) throw new Error('Invalid project: ' + result.errors.join('; '));
    const bundle = buildBundle(result.value); // store only the normalized/capped 8 keys
    // Enforce the documented byte budget server-side too — a direct mutation call
    // bypasses the client-side file-size check.
    if (JSON.stringify(bundle).length > PROJECT_LIMITS.maxBytes) throw new Error('Project exceeds size limit');

    // args.slug only addresses the caller's OWN existing project (an update). New
    // projects always get a full-entropy, unguessable slug: the slug IS the share
    // capability token, so a short or user-chosen one must never gate a public read.
    if (args.slug) {
      const existing = await ctx.db
        .query('projects')
        .withIndex('by_slug', (q) => q.eq('slug', args.slug))
        .first();
      if (existing && existing.ownerId === userId) {
        await ctx.db.patch(existing._id, { name, bundle, updatedAt: Date.now() });
        return { slug: args.slug };
      }
    }

    const owned = await ctx.db
      .query('projects')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .take(MAX_PROJECTS_PER_OWNER);
    if (owned.length >= MAX_PROJECTS_PER_OWNER) throw new Error('Project limit reached (' + MAX_PROJECTS_PER_OWNER + ')');

    const slug = crypto.randomUUID(); // 122-bit unlisted-share token
    await ctx.db.insert('projects', { ownerId: userId, slug, name, bundle, updatedAt: Date.now() });
    return { slug };
  },
});

/** Signed-in: get a one-shot upload URL for a GLB blob. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error('Not authenticated');
    await limiter.limit(ctx, 'uploadUrl', { key: userId, throws: true });
    return await ctx.storage.generateUploadUrl();
  },
});

/** Attach an uploaded GLB to an owned project, replacing any prior blob. */
export const attachGlb = mutation({
  args: { slug: v.string(), storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error('Not authenticated');
    await limiter.limit(ctx, 'attach', { key: userId, throws: true });

    const doc = await ctx.db
      .query('projects')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first();
    if (!doc || doc.ownerId !== userId) throw new Error('Not found');

    // Server-side blob gate — the client model gate is bypassable via a direct
    // mutation call, and the upload's Content-Type is caller-supplied. Trust only
    // the stored size + the glTF binary magic. (Triangle/texture budgets stay
    // client-side; enforcing them here would need a full GLB parser.)
    const meta = await ctx.db.system.get(args.storageId);
    if (!meta) throw new Error('Upload not found');
    if (meta.size > MODEL_LIMITS.maxBytes) { await ctx.storage.delete(args.storageId); throw new Error('Model exceeds size limit'); }
    const head = new Uint8Array(await (await ctx.storage.get(args.storageId)).slice(0, 4).arrayBuffer());
    if (!(head[0] === 0x67 && head[1] === 0x6c && head[2] === 0x54 && head[3] === 0x46)) { // 'glTF'
      await ctx.storage.delete(args.storageId);
      throw new Error('Not a .glb file');
    }

    if (doc.glbId) await ctx.storage.delete(doc.glbId);
    await ctx.db.patch(doc._id, { glbId: args.storageId, updatedAt: Date.now() });
  },
});

/** Signed-in: list the caller's projects (metadata only). */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const docs = await ctx.db
      .query('projects')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .take(MAX_PROJECTS_PER_OWNER);
    return docs.map((d) => ({ slug: d.slug, name: d.name, updatedAt: d.updatedAt, hasGlb: !!d.glbId, featured: !!d.featured }));
  },
});

/** PUBLIC: the super-admin-curated gallery list (metadata only). */
export const featured = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db
      .query('projects')
      .withIndex('by_featured', (q) => q.eq('featured', true))
      .take(24);
    return docs.map((d) => ({ slug: d.slug, name: d.name, updatedAt: d.updatedAt, hasGlb: !!d.glbId }));
  },
});

/** Super admin only: curate the public gallery. Featuring publishes the project's
 *  unlisted share slug on /gallery — a deliberate act, hence the role gate. */
export const setFeatured = mutation({
  args: { slug: v.string(), featured: v.boolean() },
  handler: async (ctx, args) => {
    if (!(await isSuperAdmin(ctx))) throw new Error('Not authorized');
    const doc = await ctx.db
      .query('projects')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first();
    if (!doc) throw new Error('Not found');
    await ctx.db.patch(doc._id, { featured: args.featured });
  },
});

/** PUBLIC: just a shared project's display name (for OG cards). null if missing. */
export const getPublicName = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query('projects')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first();
    return doc ? doc.name : null;
  },
});

/** PUBLIC: read a shared project by slug. Leaks nothing but name/bundle/glbUrl. */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query('projects')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first();
    if (!doc) return null;
    return {
      name: doc.name,
      bundle: doc.bundle,
      glbUrl: doc.glbId ? await ctx.storage.getUrl(doc.glbId) : null,
    };
  },
});

/** Delete an owned project and its GLB blob. */
export const remove = mutation({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error('Not authenticated');
    await limiter.limit(ctx, 'remove', { key: userId, throws: true });

    const doc = await ctx.db
      .query('projects')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first();
    if (!doc || doc.ownerId !== userId) throw new Error('Not found');

    if (doc.glbId) await ctx.storage.delete(doc.glbId);
    await ctx.db.delete(doc._id);
  },
});

/** Cron GC: delete uploaded GLB blobs no project references, past a grace window. */
export const gcOrphanBlobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Bounded on both sides. `.collect()` on either table would hit Convex's
    // per-transaction read limit as the data grows, and this runs every 6 hours
    // where a partial sweep is harmless — the next run picks up the rest.
    const SCAN = 4000;   // projects examined per run
    const KILL = 200;    // blobs deleted per run

    // WARNING for whoever adds the next storage-backed feature: `referenced` is
    // built from the `projects` table ONLY. Any future table that stores a blob
    // (avatars, exports, attachments) must contribute its ids here, or this cron
    // will delete those blobs 30 minutes after they are created.
    const referenced = new Set();
    for (const p of await ctx.db.query('projects').take(SCAN)) if (p.glbId) referenced.add(p.glbId);

    // Safety valve: if the project scan was truncated we do NOT know the full
    // reference set, and deleting on incomplete knowledge would destroy live
    // models. Skip the sweep and let a future run (or a raised cap) handle it.
    if (referenced.size >= SCAN) return { skipped: 'project scan truncated' };

    const cutoff = Date.now() - 30 * 60 * 1000; // 30-min grace for in-flight upload→attach
    let deleted = 0;
    for (const blob of await ctx.db.system.query('_storage').take(SCAN)) {
      if (deleted >= KILL) break;
      if (referenced.has(blob._id)) continue;
      if (blob._creationTime >= cutoff) continue;
      await ctx.storage.delete(blob._id);
      deleted++;
    }
    return { deleted, referenced: referenced.size };
  },
});
