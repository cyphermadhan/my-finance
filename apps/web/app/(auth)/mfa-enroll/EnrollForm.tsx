'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'react-feather';

type Props = {
  secret: string;
  hashedBackupCodes: string[];
  finalize: (input: { secret: string; hashedBackupCodes: string[]; code: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
  redirectTo?: string;
};

export function EnrollForm({ secret, hashedBackupCodes, finalize, redirectTo = '/onboarding' }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const res = await finalize({ secret, hashedBackupCodes, code: code.trim() });
          if (!res.ok) {
            setError(res.error);
            return;
          }
          router.replace(redirectTo);
        });
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Enter the 6-digit code from your authenticator app</label>
      <input
        className="otp-input"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        required
      />
      {error && <div className="error-msg">{error}</div>}
      <button type="submit" className="btn btn--primary" disabled={pending || code.length !== 6}>
        <Shield size={15} /> {pending ? 'Verifying…' : 'Confirm & continue'}
      </button>
    </form>
  );
}
