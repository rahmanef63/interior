// Header auth — compact Sign in / Sign up dropdown for the site nav (client).
// Convex Auth Password provider. Signed-in state persists across / and /tour,
// so a user signs in here once and the tour's cloud controls light up.
'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { Authenticated, Unauthenticated, AuthLoading, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { INK, PAPER, ACCENT, MUTED, label } from '../lib/tokens.js';

const pill = { ...label, background: 'transparent', color: INK, cursor: 'pointer', border: '1px solid rgba(43,38,32,.28)', padding: '9px 16px' };
const field = { fontFamily: "var(--font-sans), sans-serif", fontWeight: 300, fontSize: 12, letterSpacing: '.02em', padding: '9px 11px', borderRadius: 4, background: PAPER, color: INK, border: '1px solid rgba(43,38,32,.28)', width: '100%' };
// NOTE: no `outline: 'none'` here. It used to be, with nothing replacing it, so a
// keyboard user could not see which field had focus. globals.css draws the ring.

export default function HeaderAuth() {
  const { signIn, signOut } = useAuthActions();
  const me = useQuery(api.admin.me);
  const [open, setOpen] = useState(false);
  const [flow, setFlow] = useState('signIn'); // 'signIn' | 'signUp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const emailRef = useRef(null);

  // Dialog a11y: focus the first field on open; Escape and outside-click close
  // it (restoring focus to the trigger). Listeners live only while open.
  useEffect(() => {
    if (!open) return undefined;
    emailRef.current?.focus();
    const close = () => { setOpen(false); triggerRef.current?.focus(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const onDown = (e) => {
      if (!panelRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await signIn('password', { email, password, flow });
      setOpen(false);
      setEmail('');
      setPassword('');
    } catch (e2) {
      setErr(
        flow === 'signIn'
          ? 'Could not sign in — check your email and password, or switch to “Need an account? Sign up” if you’re new.'
          : 'Could not create the account — that email may already be registered, or the password is under 8 characters.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <AuthLoading>
        <span style={{ ...label, color: MUTED }} aria-live="polite">…</span>
      </AuthLoading>

      <Unauthenticated>
        <button ref={triggerRef} type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog" style={pill}>
          Sign in
        </button>
        {open && (
          <form
            ref={panelRef}
            onSubmit={onSubmit}
            role="dialog"
            aria-label="Sign in or create an account"
            style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, zIndex: 60, width: 248, display: 'flex', flexDirection: 'column', gap: 8, padding: 16, background: 'rgba(233,227,216,.98)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(43,38,32,.16)', boxShadow: '0 16px 40px rgba(43,38,32,.18)' }}
          >
            <div style={{ fontFamily: "var(--font-serif), serif", fontWeight: 500, fontSize: 20, color: INK }}>
              {flow === 'signIn' ? 'Sign in' : 'Create account'}
            </div>
            <label style={{ ...label, fontSize: 9, color: MUTED }}>
              Email
              <input ref={emailRef} value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required style={{ ...field, marginTop: 5 }} />
            </label>
            <label style={{ ...label, fontSize: 9, color: MUTED }}>
              Password
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete={flow === 'signIn' ? 'current-password' : 'new-password'} required minLength={8} style={{ ...field, marginTop: 5 }} />
            </label>
            {err && <p role="alert" style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: 10, lineHeight: 1.5, color: '#9a2b14', margin: 0 }}>{err}</p>}
            <button type="submit" disabled={busy} style={{ ...pill, background: ACCENT, color: PAPER, border: `1px solid ${ACCENT}`, opacity: busy ? 0.6 : 1, textAlign: 'center' }}>
              {busy ? '…' : flow === 'signIn' ? 'Sign in' : 'Sign up'}
            </button>
            <button type="button" onClick={() => { setErr(''); setFlow(flow === 'signIn' ? 'signUp' : 'signIn'); }} style={{ ...label, fontSize: 10, background: 'none', border: 'none', color: MUTED, cursor: 'pointer', padding: 0, textAlign: 'center' }}>
              {flow === 'signIn' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
            </button>
          </form>
        )}
      </Unauthenticated>

      <Authenticated>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {me?.isSuperAdmin && <span style={{ ...label, fontSize: 9, color: ACCENT }}>Super admin</span>}
          <button type="button" onClick={() => void signOut()} style={pill}>Sign out</button>
        </div>
      </Authenticated>
    </div>
  );
}
