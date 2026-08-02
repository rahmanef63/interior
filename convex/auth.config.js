// Rahman 3D Interior — auth provider config. CONVEX_SITE_URL is injected by Convex at runtime.
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: 'convex',
    },
  ],
};
