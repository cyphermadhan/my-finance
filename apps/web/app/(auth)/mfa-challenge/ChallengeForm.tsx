'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'react-feather';

type Props = {
  verify: (code: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

export function ChallengeForm({ verify }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const res = await verify(code.trim());
          if (!res.ok) return setError(res.error);
          router.replace('/');
        });
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <input
        className="otp-input"
        inputMode="text"
        autoComplete="one-time-code"
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
        autoFocus
      />
      {error && <div className="error-msg">{error}</div>}
      <button type="submit" className="btn btn--primary" disabled={pending || code.length < 6}>
        <Shield size={15} /> {pending ? 'Verifying…' : 'Verify'}
      </button>
    </form>
  );
}
