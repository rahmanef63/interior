// Rahman 3D Interior — HTTP router: mounts the @convex-dev/auth routes.
import { httpRouter } from 'convex/server';
import { auth } from './auth';

const http = httpRouter();
auth.addHttpRoutes(http);

export default http;
