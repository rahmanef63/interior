// Rahman 3D Interior — Convex Auth: email+password only, no email verification.
import { convexAuth } from '@convex-dev/auth/server';
import { Password } from '@convex-dev/auth/providers/Password';

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
  // ponytail: brute-force throttle is BUILT IN — a per-email failed-attempt limiter
  // (authRateLimits table, part of ...authTables). Default is 10/hr; tighten the
  // master-key surface to 5/hr. NOTE the library's spelling: `maxFailedAttempsPerHour`.
  signIn: { maxFailedAttempsPerHour: 5 },
});
