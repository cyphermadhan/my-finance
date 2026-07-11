'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, LogIn } from 'react-feather';
import { SegmentedControl } from '@/ui/SegmentedControl';

type Props = {
  create: (name: string) => Promise<{ ok: true; familyId: string } | { ok: false; error: string }>;
  join: (code: string) => Promise<{ ok: true; familyId: string } | { ok: false; error: string }>;
};

export function OnboardingForm({ create, join }: Props) {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) return setError(res.error);
      router.replace('/family');
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SegmentedControl
        ariaLabel="Create or join a family"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'create', label: 'Create' },
          { value: 'join', label: 'Join with code' },
        ]}
      />

      {tab === 'create' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(() => create(name));
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Family name</label>
          <input className="input input--text" value={name} onChange={(e) => setName(e.target.value)} placeholder="The Rajs" required />
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="btn btn--primary" disabled={pending || !name.trim()}><Plus size={15} /> {pending ? 'Creating…' : 'Create family'}</button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(() => join(code));
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Invite code</label>
          <input
            className="input"
            style={{ fontFamily: 'var(--font-numeric)', textTransform: 'uppercase', letterSpacing: '0.1em' }}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            required
          />
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="btn btn--primary" disabled={pending || code.length < 4}><LogIn size={15} /> {pending ? 'Joining…' : 'Join family'}</button>
        </form>
      )}
    </div>
  );
}
