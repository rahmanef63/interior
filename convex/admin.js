// Super-admin role. An email allowlist from the SUPER_ADMIN_EMAILS env var
// (comma-separated), so admins can be added/removed without a redeploy.
import { query, internalMutation } from './_generated/server';
import { getAuthUserId, modifyAccountCredentials } from '@convex-dev/auth/server';
import { v } from 'convex/values';

function superAdminEmails() {
  return (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Resolve the super-admin role for a userId.
 *
 * The email allowlist alone was a privilege-escalation hole: sign-up is open and
 * the Password provider does not verify email ownership, so anyone who knew an
 * allowlisted address could register it first and inherit the role. Whoever
 * registers first wins.
 *
 * Fix: the allowlist only ever confers the role on an account the OWNER has
 * pinned. `pinSuperAdmin` (internalMutation — dashboard/CLI only, same trust
 * boundary as adminResetPassword) records the userId. Once ANY pin exists, the
 * email allowlist stops granting on its own — a squatter registering an
 * allowlisted address gets nothing.
 *
 * Bootstrap: with no pins recorded at all, the allowlist still works, so a fresh
 * deployment isn't locked out. Pin immediately after first sign-in.
 *
 * @param {any} ctx @param {any} userId
 * @returns {Promise<boolean>}
 */
async function resolveSuperAdmin(ctx, userId) {
  if (userId === null || userId === undefined) return false;

  const pinned = await ctx.db.query('superAdmins').collect();
  if (pinned.length > 0) {
    return pinned.some((p) => p.userId === userId);
  }

  // No pins yet — bootstrap mode. Fall back to the email allowlist.
  const user = await ctx.db.get(userId);
  const email = user?.email ?? null;
  return !!email && superAdminEmails().includes(email.toLowerCase());
}

/** Whether the calling user holds the super-admin role. Reusable server helper. */
export async function isSuperAdmin(ctx) {
  const userId = await getAuthUserId(ctx);
  return resolveSuperAdmin(ctx, userId);
}

/** The signed-in user + whether they hold the super-admin role. null when signed out. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    const email = user?.email ?? null;
    return { email, isSuperAdmin: await resolveSuperAdmin(ctx, userId) };
  },
});

/**
 * Pin the super-admin role to a concrete account, by email, once.
 *
 * Run ONCE per admin after they have signed in:
 *   npx convex run --prod admin:pinSuperAdmin '{"email":"you@example.com"}'
 *
 * From that point the email allowlist alone grants nothing, so an unverified
 * sign-up on an allowlisted address can no longer inherit the role.
 * internalMutation => not reachable from any client.
 */
export const pinSuperAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const target = email.trim().toLowerCase();
    if (!superAdminEmails().includes(target)) {
      throw new Error(`"${email}" is not in SUPER_ADMIN_EMAILS — add it there first.`);
    }
    // ponytail: bounded scan — admin-only, run once, tiny user base.
    const users = await ctx.db.query('users').take(5000);
    const matches = users.filter((u) => (u.email ?? '').toLowerCase() === target);
    if (matches.length === 0) throw new Error(`No account for "${email}" — sign in once first.`);
    if (matches.length > 1) throw new Error(`Ambiguous: ${matches.length} accounts share "${email}".`);

    const userId = matches[0]._id;
    const already = await ctx.db
      .query('superAdmins')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
    if (already) return { ok: true, userId, note: 'already pinned' };

    await ctx.db.insert('superAdmins', { userId, email: target, pinnedAt: Date.now() });
    return { ok: true, userId };
  },
});

/** Remove a pin (revoke). Same trust boundary as pinSuperAdmin. */
export const unpinSuperAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const target = email.trim().toLowerCase();
    const rows = await ctx.db.query('superAdmins').collect();
    const hit = rows.filter((r) => r.email === target);
    for (const r of hit) await ctx.db.delete(r._id);
    return { ok: true, removed: hit.length };
  },
});

/** List pinned super-admins (audit). internalMutation → dashboard/CLI only. */
export const listSuperAdmins = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('superAdmins').collect();
    return {
      pinned: rows.map((r) => ({ email: r.email, userId: r.userId, pinnedAt: r.pinnedAt })),
      allowlist: superAdminEmails(),
      mode: rows.length ? 'pinned (allowlist alone grants nothing)' : 'BOOTSTRAP — allowlist still grants; pin now',
    };
  },
});

/**
 * Break-glass password reset for an EXISTING account. PATCHES the account secret
 * in place (re-hashed with the provider's Scrypt), so the user's `users` row — and
 * every project whose ownerId points at it — survives. delete+recreate would mint
 * a new userId and orphan their projects; editing the DB by hand can't (Scrypt hash).
 *
 * Also the ROTATION tool for the super-admin's own leaked password (run it on your
 * own email with a new strong password).
 *
 * internalMutation => NOT reachable from any client. Run it from the Convex prod
 * dashboard (Functions → admin:adminResetPassword) or `npx convex run --prod`;
 * dashboard/deploy access IS the trust boundary. Do NOT add an isSuperAdmin(ctx)
 * gate — dashboard/CLI runs carry no end-user identity, so getAuthUserId is null
 * and the gate would reject every call.
 */
export const adminResetPassword = internalMutation({
  args: { email: v.string(), newPassword: v.string() },
  handler: async (ctx, { email, newPassword }) => {
    if (newPassword.length < 8) throw new Error('Password must be at least 8 characters');
    // The Password provider stores providerAccountId as the email exactly as typed
    // at sign-up (no case normalization), so match case-insensitively.
    const target = email.trim().toLowerCase();
    // ponytail: bounded scan of password accounts — admin-only, rare, tiny user base.
    // Switch to an exact .eq('providerAccountId', ...) lookup if emails ever normalize.
    const accounts = await ctx.db
      .query('authAccounts')
      .withIndex('providerAndAccountId', (q) => q.eq('provider', 'password'))
      .take(2000);
    const account = accounts.find((a) => (a.providerAccountId ?? '').toLowerCase() === target);
    if (!account) throw new Error(`No password account for "${email}"`);
    // Reuse the library's own credential update (its runtime ctx calls — db + runMutation
    // — both exist on a mutation ctx; verified against @convex-dev/auth dist).
    await modifyAccountCredentials(ctx, {
      provider: 'password',
      account: { id: account.providerAccountId, secret: newPassword },
    });
    return { ok: true, userId: account.userId };
  },
});
