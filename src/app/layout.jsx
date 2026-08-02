import './globals.css';
import ConvexClientProvider from './ConvexClientProvider.jsx';
import { Cormorant_Garamond, Jost } from 'next/font/google';

// Self-hosted fonts (no render-blocking third-party request, no visitor-IP leak).
// Exposed as CSS vars so inline styles and imperative DOM markup can reference them.
const serif = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600'], style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });
const sans = Jost({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-sans', display: 'swap' });

// Preconnect to the Convex deployment so /tour's first data/auth request skips
// the cold DNS+TLS handshake. Derived at build from the public URL.
const convexOrigin = process.env.NEXT_PUBLIC_CONVEX_URL ? new URL(process.env.NEXT_PUBLIC_CONVEX_URL).origin : null;

const description = 'An apartment showroom you walk, not spin. Studio to three-bedroom, in a browser tab.';

export const metadata = {
  metadataBase: new URL('https://interior.rahmanef.com'),
  title: { default: 'Rahman 3D Interior', template: '%s · Rahman 3D Interior' },
  description,
  applicationName: 'Rahman 3D Interior',
  openGraph: {
    type: 'website',
    siteName: 'Rahman 3D Interior',
    title: 'Rahman 3D Interior',
    description,
    url: 'https://interior.rahmanef.com',
    locale: 'en_US',
  },
  twitter: { card: 'summary_large_image', title: 'Rahman 3D Interior', description },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <head>
        {convexOrigin && <link rel="preconnect" href={convexOrigin} crossOrigin="anonymous" />}
      </head>
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
