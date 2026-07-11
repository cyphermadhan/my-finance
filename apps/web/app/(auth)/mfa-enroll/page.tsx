import { requireSession } from '@/auth/guards';
import { generateSecret, makeOtpAuthUrl, makeQrDataUrl, generateBackupCodes } from '@/auth/mfa';
import { redirect } from 'next/navigation';
import { finalizeMfaEnroll } from '@/actions/mfa';
import { EnrollForm } from './EnrollForm';

export default async function MfaEnrollPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await requireSession();
  const isReset = searchParams?.reset === '1';
  // Block re-entry during normal onboarding, but allow an explicit reset from Settings.
  if (session.user.mfaEnabled && !isReset) redirect('/');

  // Generate secret + codes fresh for this render. The form embeds them and submits back to
  // finalizeMfaEnroll which requires the user to prove they can generate a valid TOTP first.
  const secret = generateSecret();
  const email = session.user.email;
  const otpUrl = makeOtpAuthUrl(email, secret);
  const qr = await makeQrDataUrl(otpUrl);
  const { plain, hashed } = generateBackupCodes(8);

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">Wealth · {isReset ? 'Reset' : 'Setup'}</div>
        <h1>{isReset ? 'Reset two-factor' : 'Enable two-factor'}</h1>
        <p>
          {isReset && 'This replaces your current authenticator and backup codes. Your old codes stop working once you confirm below. '}
          Scan the QR code with Google Authenticator (or 1Password / Authy). Then enter the 6-digit code shown in the app to confirm.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="TOTP QR" width={220} height={220} style={{ alignSelf: 'center', borderRadius: 8 }} />
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-tertiary)' }}>Can&apos;t scan? Enter this secret manually</summary>
          <code style={{ display: 'block', marginTop: 8, wordBreak: 'break-all', fontFamily: 'var(--font-numeric)', fontSize: 12 }}>{secret}</code>
        </details>

        <div style={{ border: '1px dashed var(--border-strong)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Backup codes — save these somewhere safe</div>
          <div style={{ fontFamily: 'var(--font-numeric)', fontSize: 12, columns: 2, columnGap: 12 }}>
            {plain.map((c) => <div key={c}>{c}</div>)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
            Losing your authenticator + these codes means locked out. There is no recovery.
          </div>
        </div>

        <EnrollForm secret={secret} hashedBackupCodes={hashed} finalize={finalizeMfaEnroll} redirectTo={isReset ? '/settings' : '/onboarding'} />
      </div>
    </main>
  );
}
