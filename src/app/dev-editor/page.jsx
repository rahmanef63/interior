// Verification harness for the editor viewport. OFF unless the build sets
// EDITOR_TEST_HARNESS=1, so it does not exist in a normal deployment.
//
// Why it has to exist at all: /editor sits behind a Convex sign-in wall, and a
// headless test container has no route to Convex, so `Authenticated` can never
// become true there. Without this, the toolbar, the navigation and the ViewCube
// could only ever be tested by hand — and hand-testing is exactly how the two
// worst bugs in this feature survived to the end (a dead mouse wheel, and a
// runaway animation loop that pinned the GPU).
//
// The gate itself is still tested against the real /editor route: an
// unauthenticated visitor must get the wall, not a canvas.
//
//   EDITOR_TEST_HARNESS=1 npm run build:next   → /dev-editor exists
//   npm run build:next                          → /dev-editor is a 404
import { notFound } from 'next/navigation';
import Editor from '../../components/Editor.jsx';

export const metadata = { title: 'Editor harness', robots: { index: false, follow: false } };

export default function DevEditorPage() {
  if (process.env.EDITOR_TEST_HARNESS !== '1') notFound();
  return <Editor />;
}
