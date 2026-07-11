import { signIn, auth } from '@/auth/config';
import { redirect } from 'next/navigation';

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect('/');

  async function signInGoogle() {
    'use server';
    await signIn('google', { redirectTo: '/' });
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">My Finance</div>
        <h1>Sign in</h1>
        <p>Family wealth dashboard. Sign in with the Google account tied to your household.</p>
        <form action={signInGoogle}>
          <button type="submit" className="google-btn">
            <GoogleGlyph /> Continue with Google
          </button>
        </form>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          Two-factor authentication is required. You&apos;ll set it up on first sign-in.
        </p>
      </div>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.75 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.15-4.53H2.17v2.85A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.85 14.11a6.6 6.6 0 0 1 0-4.22V7.04H2.17a11 11 0 0 0 0 9.92l3.68-2.85z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.17 7.04l3.68 2.85C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
