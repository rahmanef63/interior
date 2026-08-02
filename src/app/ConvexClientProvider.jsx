// Convex + auth client provider. Replaces ConvexProvider — never nest both.
'use client';

import { ConvexReactClient } from 'convex/react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL);

export default function ConvexClientProvider({ children }) {
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}
