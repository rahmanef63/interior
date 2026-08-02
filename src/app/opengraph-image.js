// Dynamic share image (og:image + twitter:image) generated at build via next/og.
// Paper/ink brand palette; no external assets so it renders headless.
import { ImageResponse } from 'next/og';

export const alt = 'Rahman 3D Interior — an apartment showroom you walk, not spin';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#e9e3d8',
          color: '#2b2620',
          padding: '80px 88px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, letterSpacing: 8, textTransform: 'uppercase' }}>
          <span>Apartment Walkthroughs</span>
          <span style={{ color: '#c2592b' }}>Est. MMXXVI</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 104, lineHeight: 1.02, letterSpacing: -2 }}>Rahman 3D Interior</div>
          <div style={{ display: 'flex', width: 240, height: 5, background: '#c2592b', marginTop: 36 }} />
          <div style={{ fontSize: 32, marginTop: 34, maxWidth: 860, color: 'rgba(43,38,32,0.7)' }}>
            Studio to three-bedroom, walked end to end in a browser tab. Everyone else ships a 360; this one moves.
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 24, letterSpacing: 6, textTransform: 'uppercase', color: 'rgba(43,38,32,0.55)' }}>
          interior.rahmanef.com
        </div>
      </div>
    ),
    { ...size }
  );
}
