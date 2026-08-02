// Rahman 3D Interior — Convex schema. Auth tables + owned project bundles (+ optional GLB blob).
import { defineSchema, defineTable } from 'convex/server';
import { authTables } from '@convex-dev/auth/server';
import { v } from 'convex/values';

// ...authTables ships users/authAccounts/authSessions/etc. projects.ownerId → users.
export default defineSchema({
  ...authTables,
  projects: defineTable({
    ownerId: v.id('users'),
    slug: v.string(),
    name: v.string(),
    bundle: v.any(),
    glbId: v.optional(v.id('_storage')),
    featured: v.optional(v.boolean()), // super-admin curated: listed on /gallery
    updatedAt: v.number(),
  })
    .index('by_owner', ['ownerId'])
    .index('by_slug', ['slug'])
    .index('by_featured', ['featured']),

  // Super-admin role pinned to a concrete account. See convex/admin.js —
  // the SUPER_ADMIN_EMAILS allowlist alone cannot grant the role once any row
  // exists here, which closes the "register the allowlisted address first" hole
  // that open, unverified sign-up otherwise leaves open.
  superAdmins: defineTable({
    userId: v.id('users'),
    email: v.string(),
    pinnedAt: v.number(),
  }).index('by_user', ['userId']),

  // First-party, PII-free usage counters (one row per event per day).
  analytics: defineTable({
    event: v.string(),
    day: v.string(), // YYYY-MM-DD (UTC)
    count: v.number(),
  })
    .index('by_event_and_day', ['event', 'day'])
    .index('by_day', ['day']),
});
