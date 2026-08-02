// Convex app components. rate-limiter backs the per-user abuse limits in projects.js.
import { defineApp } from 'convex/server';
import rateLimiter from '@convex-dev/rate-limiter/convex.config';

const app = defineApp();
app.use(rateLimiter);
export default app;
