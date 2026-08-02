import Walkthrough from '../../components/Walkthrough.jsx';
import { fetchQuery } from 'convex/nextjs';
import { api } from '../../../convex/_generated/api';
import { UNIT_BY_KEY } from '../../config/units.js';

const description = 'Walk an apartment unit end to end in your browser — not a 360 photo you spin on the spot.';

// Three shapes of link land here and they want three different share cards:
//   /tour                → the showroom's default unit
//   /tour?unit=<key>     → a specific unit type (studio, one-bed, …)
//   /tour?p=<slug>       → somebody's saved project
// Reading searchParams makes this route render per request.
export async function generateMetadata({ searchParams }) {
  const q = (await searchParams) || {};
  const p = q.p;
  if (!p) {
    const u = UNIT_BY_KEY[q.unit];
    // Spelling out openGraph matters: the layout sets an explicit OG title, so
    // overriding `title` alone leaves the share card generic.
    const title = u ? `${u.name} · ${u.spec}` : 'Apartment Walkthrough';
    const desc = u ? `${u.blurb} Walk it in your browser.` : description;
    const url = u ? '/tour?unit=' + u.key : '/tour';
    return {
      title,
      description: desc,
      alternates: { canonical: url },
      openGraph: { title: title + ' · Rahman 3D Interior', description: desc, url },
      twitter: { card: 'summary_large_image', title: title + ' · Rahman 3D Interior', description: desc },
    };
  }
  let name = null;
  try { name = await fetchQuery(api.projects.getPublicName, { slug: p }); } catch { /* generic card */ }
  const title = name || 'Shared walkthrough';
  const ogUrl = '/api/og?slug=' + encodeURIComponent(p);
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: ogUrl, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: [ogUrl] },
  };
}

// Client component owning a WebGL canvas + scroll listeners. There is no
// authoring here at all any more — camera work happens in /editor, where you can
// grab the camera in the model instead of typing at it through an overlay. `io`
// enables the viewer bar (messages + the owner's way back to the editor).
export default function TourPage() {
  // dust={false}: the motes read as haze on a phone screen and as dirt on a
  // projector, and this page is what a buyer is shown. The engine still supports
  // them — one prop away — they are just not what a sales preview wants.
  return <Walkthrough daylight="Soft" dust={false} reflections io />;
}
