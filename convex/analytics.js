// First-party, cookie-free, PII-free usage counters. One row per (event, day);
// track() only increments. No third-party script, no visitor identifiers, so no
// consent banner is required (aggregate first-party counts only).
import { mutation, query, internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { RateLimiter, MINUTE } from '@convex-dev/rate-limiter';
import { components } from './_generated/api';
import { isSuperAdmin } from './admin.js';

// The only event names that get stored — an unknown name is a silent no-op, so
// the table's key space is bounded no matter what a client sends.
const EVENTS = new Set(['tour_start', 'concept_switch', 'daylight_switch', 'project_saved', 'share_copied']);

// ponytail: one GLOBAL token bucket caps total write cost from an open endpoint.
// Over the cap, track() drops silently — worst case is lost counts, never a bill
// or storage blowup. Per-visitor limits would need an identifier we deliberately don't collect.
const limiter = new RateLimiter(components.rateLimiter, {
  track: { kind: 'token bucket', rate: 600, period: MINUTE },
});

const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

/** PUBLIC, best-effort: bump the counter for an allowlisted event. */
export const track = mutation({
  args: { event: v.string() },
  handler: async (ctx, { event }) => {
    if (!EVENTS.has(event)) return;
    const { ok } = await limiter.limit(ctx, 'track');
    if (!ok) return;
    const day = dayKey(Date.now());
    const existing = await ctx.db
      .query('analytics')
      .withIndex('by_event_and_day', (q) => q.eq('event', event).eq('day', day))
      .first();
    if (existing) await ctx.db.patch(existing._id, { count: existing.count + 1 });
    else await ctx.db.insert('analytics', { event, day, count: 1 });
  },
});

/** Super admin only: totals-per-event + daily rows for the last 30 days. */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSuperAdmin(ctx))) return null;
    const cutoff = dayKey(Date.now() - 30 * 86400000);
    const rows = await ctx.db
      .query('analytics')
      .withIndex('by_day', (q) => q.gte('day', cutoff))
      .collect();
    const byEvent = {};
    for (const r of rows) byEvent[r.event] = (byEvent[r.event] || 0) + r.count;
    rows.sort((a, b) => (a.day < b.day ? 1 : -1));
    return { byEvent, days: rows };
  },
});

/** Cron GC: drop counter rows older than 180 days. */
export const gcOld = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = dayKey(Date.now() - 180 * 86400000);
    const old = await ctx.db
      .query('analytics')
      .withIndex('by_day', (q) => q.lt('day', cutoff))
      .collect();
    for (const r of old) await ctx.db.delete(r._id);
  },
});
