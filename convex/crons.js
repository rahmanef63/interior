// Scheduled jobs. Reclaim orphaned GLB uploads (an upload URL minted but never
// attached to a project) so storage can't grow without bound.
import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();
crons.interval('gc orphan glbs', { hours: 6 }, internal.projects.gcOrphanBlobs, {});
crons.interval('gc old analytics', { hours: 24 }, internal.analytics.gcOld, {});
export default crons;
