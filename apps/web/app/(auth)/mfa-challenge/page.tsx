import { requireSession } from '@/auth/guards';
import { redirect } from 'next/navigation';
import { ChallengeForm } from './ChallengeForm';
import { verifyMfaChallenge } from '@/actions/mfa';

export default async function MfaChallengePage() {
  const session = await requireSession();
  if (!session.user.mfaEnabled) redirect('/mfa-enroll');
  if (session.user.mfaVerified) redirect('/');

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">My Finance</div>
        <h1>Two-factor code</h1>
        <p>Enter the 6-digit code from your authenticator app, or a backup code.</p>
        <ChallengeForm verify={verifyMfaChallenge} />
      </div>
    </main>
  );
}
