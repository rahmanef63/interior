'use client';

// Sign-in wall for /editor.
//
// The editor is where a user's own model and their own camera work lives, so it
// has to be tied to an account — there is nothing to save a project TO otherwise.
// The wall is a full page rather than a modal over a dead viewport: booting a
// WebGL context behind a form the user cannot dismiss wastes a context and makes
// the page feel broken.
//
// The sign-up form is inline. Bouncing to the home page to sign in and then
// expecting someone to find their way back to /editor loses people who were one
// click from trying the product.

import { useState } from 'react';
import Link from 'next/link';
import { useAuthActions } from '@convex-dev/auth/react';
import { Authenticated, Unauthenticated, AuthLoading } from 'convex/react';
import Editor from './Editor.jsx';
import { INK, PAPER, ACCENT, ACCENT_TEXT, MUTED, HAIR, label } from '../lib/tokens.js';
import { serif } from '../lib/ui/sheet.js';

const field = {
  fontFamily: 'var(--font-sans), sans-serif', fontWeight: 300, fontSize: 13,
  padding: '10px 12px', background: PAPER, color: INK,
  border: '1px solid rgba(43,38,32,.28)', width: '100%',
};

function Shell({ children }) {
  return (
    <main style={{ minHeight: '100dvh', background: PAPER, color: INK, fontFamily: 'var(--font-sans), sans-serif', display: 'grid', placeItems: 'center', padding: '32px 20px' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <Link href="/" style={{ ...label, fontSize: 12, letterSpacing: '.18em', color: INK, textDecoration: 'none' }}>
          Rahman 3D Interior
        </Link>
        {children}
      </div>
    </main>
  );
}

function SignInWall() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState('signUp'); // new visitors outnumber returning ones here
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await signIn('password', { email, password, flow });
    } catch (e2) {
      setErr(
        flow === 'signIn'
          ? 'That email and password did not match an account.'
          : 'Could not create the account. The email may already be registered.'
      );
      // Keep the raw reason out of the UI (it leaks whether an address exists)
      // but do not swallow it entirely — a developer needs it.
      if (typeof console !== 'undefined') console.debug('auth', e2);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <h1 style={{ ...serif, fontWeight: 500, fontSize: 'clamp(30px, 6vw, 46px)', lineHeight: 1.05, margin: '22px 0 10px' }}>
        Sign in to open the editor.
      </h1>
      <p style={{ fontWeight: 300, fontSize: 14, color: MUTED, lineHeight: 1.7, margin: '0 0 22px', maxWidth: '46ch' }}>
        The editor saves your model and your camera scenes to your account, so it needs
        one. It is free, and an email and password is all it takes.
      </p>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
        <label style={{ display: 'grid', gap: 5 }}>
          <span style={{ ...label, fontSize: 10, color: MUTED }}>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required style={field} />
        </label>
        <label style={{ display: 'grid', gap: 5 }}>
          <span style={{ ...label, fontSize: 10, color: MUTED }}>Password</span>
          <input
            value={password} onChange={(e) => setPassword(e.target.value)} type="password"
            autoComplete={flow === 'signIn' ? 'current-password' : 'new-password'}
            required minLength={8} style={field}
          />
        </label>
        {err && <p role="alert" style={{ margin: 0, fontSize: 12, color: '#8d2f16' }}>{err}</p>}
        <button
          type="submit" disabled={busy}
          style={{ ...label, fontSize: 11, background: ACCENT, color: PAPER, border: `1px solid ${ACCENT}`, padding: '12px 16px', cursor: 'pointer' }}
        >
          {busy ? '…' : flow === 'signIn' ? 'Sign in' : 'Create account'}
        </button>
        <button
          type="button"
          onClick={() => { setErr(''); setFlow(flow === 'signIn' ? 'signUp' : 'signIn'); }}
          style={{ ...label, fontSize: 10, background: 'none', border: 'none', color: ACCENT_TEXT, cursor: 'pointer', padding: 4 }}
        >
          {flow === 'signIn' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </button>
      </form>

      <p style={{ marginTop: 26, paddingTop: 16, borderTop: `1px solid ${HAIR}`, fontWeight: 300, fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
        Just want to look around? The{' '}
        <Link href="/tour?demo=living-room" style={{ color: ACCENT_TEXT }}>house sample</Link>{' '}
        and the <Link href="/gallery" style={{ color: ACCENT_TEXT }}>gallery</Link> are open to everyone.
      </p>
    </Shell>
  );
}

export default function EditorGate() {
  return (
    <>
      <AuthLoading>
        <Shell>
          <p style={{ ...label, fontSize: 11, color: MUTED, marginTop: 24 }}>Checking your session…</p>
        </Shell>
      </AuthLoading>
      <Unauthenticated><SignInWall /></Unauthenticated>
      <Authenticated><Editor /></Authenticated>
    </>
  );
}
