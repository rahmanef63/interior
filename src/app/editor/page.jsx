// /editor — the Edit half of Edit / Present.
//
// noindex on purpose: it is an application screen behind a sign-in wall, so a
// search result pointing here would land a stranger on a login form with no
// context. /tour and /gallery are the public faces.

import EditorGate from '../../components/EditorGate.jsx';

const description = 'Load your own 3D model, walk it with SketchUp-style navigation, and set the camera scenes your walkthrough moves through.';

export const metadata = {
  title: 'Editor',
  description,
  robots: { index: false, follow: false },
  alternates: { canonical: '/editor' },
  openGraph: { title: 'Editor · Rahman 3D Interior', description, url: '/editor' },
  twitter: { card: 'summary_large_image', title: 'Editor · Rahman 3D Interior', description },
};

export default function EditorPage() {
  return <EditorGate />;
}
