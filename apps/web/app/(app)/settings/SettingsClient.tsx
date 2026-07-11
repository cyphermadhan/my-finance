'use client';

import { useState, useTransition } from 'react';
import type { FamilyMember } from '@/types';

type Props = {
  family: { id: string; name: string; inviteCode: string } | null;
  members: FamilyMember[];
  viewerUserId: string;
  viewerEmail: string;
  rotateInviteCode: () => Promise<{ ok: true; code: string } | { ok: false; error: string }>;
  leaveFamily: () => Promise<{ ok: true } | { ok: false; error: string }>;
};

export function SettingsClient({ family, members, viewerUserId, viewerEmail, rotateInviteCode, leaveFamily }: Props) {
  const [code, setCode] = useState(family?.inviteCode ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [, start] = useTransition();

  return (
    <div className="app">
      <section className="card">
        <div className="section-header"><h2>Family</h2></div>
        {family ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div><strong>{family.name}</strong></div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Invite code</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ fontFamily: 'var(--font-numeric)', fontSize: 18, padding: '6px 10px', background: 'var(--bg-surface-alt)', borderRadius: 6 }}>{code}</code>
                <button
                  className="btn"
                  onClick={() => start(async () => {
                    setMsg(null);
                    const r = await rotateInviteCode();
                    if (r.ok) { setCode(r.code); setMsg('Invite code rotated. Old code no longer works.'); }
                    else setMsg(r.error);
                  })}
                >
                  Rotate
                </button>
                <button
                  className="btn"
                  onClick={() => { navigator.clipboard.writeText(code); setMsg('Copied.'); }}
                >
                  Copy
                </button>
              </div>
              {msg && <div className="success-msg" style={{ marginTop: 6 }}>{msg}</div>}
            </div>
          </>
        ) : <p>No family found.</p>}
      </section>

      <section className="card">
        <div className="section-header"><h2>Members</h2></div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map((m) => (
            <li key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
              <div className="nav__avatar">{(m.name || m.email).slice(0, 1).toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{m.name} {m.userId === viewerUserId && <span className="badge">you</span>} {m.isCreator && <span className="badge">creator</span>}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{m.email}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="section-header"><h2>Account</h2></div>
        <p>Signed in as <strong>{viewerEmail}</strong>. Two-factor authentication is enabled.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/mfa-enroll" className="btn">Reset 2FA (generates new secret + backup codes)</a>
          <button
            className="btn btn--danger"
            onClick={() => {
              if (confirm('Leave this family? Your holdings and accounts remain in the family; you lose access.')) {
                start(async () => {
                  const r = await leaveFamily();
                  if (r.ok) window.location.href = '/onboarding';
                });
              }
            }}
          >
            Leave family
          </button>
        </div>
      </section>
    </div>
  );
}
