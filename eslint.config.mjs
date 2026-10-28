import coreWebVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...coreWebVitals,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      'convex/_generated/**',
      // Vendored third-party decoders (Draco / Basis). Shipped as-is.
      'public/**',
    ],
  },
];

export default config;
