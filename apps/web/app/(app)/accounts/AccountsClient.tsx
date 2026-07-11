'use client';

import { useState, useTransition } from 'react';
import { CreditCard, Activity, Upload, Plus, Trash2, Check, X } from 'react-feather';
import type { Account, FamilyMember, Transaction } from '@/types';
import { ACCOUNT_TYPE_LABELS } from '@/types';
import { formatInrCompact } from '@/util/format';
import { SegmentedControl } from '@/ui/SegmentedControl';

const SCOPE_OPTIONS = [
  { value: 'family' as const, label: 'Family' },
  { value: 'mine' as const, label: 'Mine' },
];

type RecentTx = Transaction & { accountName: string; ownerUserId: string; isShared: boolean };

type Props = {
  viewerUserId: string;
  accounts: Account[];
  members: FamilyMember[];
  recent: RecentTx[];
  upsertAccount: (input: { id?: string; institution: string; name: string; type: 'bank' | 'credit_card' | 'wallet'; currency: 'INR' | 'USD'; ownerUserId: string; isShared: boolean; openingBalance?: number }) => Promise<{ ok: true; accountId: string } | { ok: false; error: string }>;
  deleteAccount: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  setBalance: (accountId: string, balance: number) => Promise<{ ok: true } | { ok: false; error: string }>;
  addTransaction: (t: { accountId: string; date: string; description: string; amount: number; category?: string | null; runningBalance?: number | null; externalId?: string | null }) => Promise<{ ok: true } | { ok: false; error: string }>;
  deleteTransaction: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

export function AccountsClient(p: Props) {
  const [tab, setTab] = useState<'family' | 'mine'>('family');
  const [adding, setAdding] = useState(false);
  const [, start] = useTransition();

  const filtered = tab === 'mine' ? p.accounts.filter((a) => a.ownerUserId === p.viewerUserId || a.isShared) : p.accounts;

  return (
    <div className="app">
      <section className="card">
        <div className="section-header">
          <h2><CreditCard size={16} /> Accounts</h2>
          <SegmentedControl ariaLabel="Accounts scope" value={tab} onChange={setTab} options={SCOPE_OPTIONS} />
        </div>
        {filtered.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)' }}>
            <p>No accounts yet. Import a bank statement to create them automatically.</p>
            <a className="btn" href="/import" style={{ marginTop: 8 }}><Upload size={15} /> Import statement</a>
          </div>
        ) : (
          <div className="table-wrap"><table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Institution</th>
                <th>Type</th>
                <th>Owner</th>
                <th className="table__num">Latest balance</th>
                <th className="table__actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td>{a.name} {a.isShared && <span className="badge badge--shared">shared</span>}</td>
                  <td>{a.institution}</td>
                  <td>{ACCOUNT_TYPE_LABELS[a.type]}</td>
                  <td>{ownerName(a.ownerUserId, p.members)}</td>
                  <td className="table__num">
                    <input
                      className="input"
                      type="number"
                      defaultValue={a.latestBalance}
                      style={{ textAlign: 'right' }}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== a.latestBalance) start(() => p.setBalance(a.id, v).then(() => {}));
                      }}
                    />
                  </td>
                  <td className="table__actions">
                    <button className="icon-btn" aria-label="Delete account" onClick={() => { if (confirm(`Delete "${a.name}"?`)) start(() => p.deleteAccount(a.id).then(() => {})); }}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => setAdding(true)} disabled={adding}><Plus size={15} /> Add account</button>
        </div>
        {adding && (
          <NewAccount
            members={p.members}
            defaultOwner={p.viewerUserId}
            onSave={async (values) => {
              await p.upsertAccount(values);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        )}
      </section>

      <section className="card">
        <div className="section-header"><h2><Activity size={16} /> Recent transactions</h2></div>
        {p.recent.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No transactions yet.</p>
        ) : (
          <div className="table-wrap"><table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th>Description</th>
                <th>Category</th>
                <th className="table__num">Amount</th>
                <th className="table__actions" />
              </tr>
            </thead>
            <tbody>
              {p.recent.map((t) => (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td>{t.accountName}</td>
                  <td>{t.description}</td>
                  <td>{t.category ?? '—'}</td>
                  <td className="table__num" style={{ color: t.amount >= 0 ? 'var(--positive)' : 'var(--negative)' }}>{formatInrCompact(t.amount)}</td>
                  <td className="table__actions">
                    <button className="icon-btn" aria-label="Delete transaction" onClick={() => start(() => p.deleteTransaction(t.id).then(() => {}))}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}

function ownerName(userId: string, members: FamilyMember[]): string {
  return members.find((m) => m.userId === userId)?.name ?? '—';
}

function NewAccount({
  members,
  defaultOwner,
  onSave,
  onCancel,
}: {
  members: FamilyMember[];
  defaultOwner: string;
  onSave: (v: { institution: string; name: string; type: 'bank' | 'credit_card' | 'wallet'; currency: 'INR' | 'USD'; ownerUserId: string; isShared: boolean; openingBalance?: number }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [type, setType] = useState<'bank' | 'credit_card' | 'wallet'>('bank');
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [ownerUserId, setOwner] = useState(defaultOwner);
  const [isShared, setIsShared] = useState(false);
  const [balance, setBalance] = useState(0);

  return (
    <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <input className="input input--text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
      <input className="input input--text" placeholder="Institution" value={institution} onChange={(e) => setInstitution(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
      <select className="select" value={type} onChange={(e) => setType(e.target.value as 'bank' | 'credit_card' | 'wallet')}>
        <option value="bank">Bank</option>
        <option value="credit_card">Credit Card</option>
        <option value="wallet">Wallet</option>
      </select>
      <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value as 'INR' | 'USD')}>
        <option value="INR">INR</option>
        <option value="USD">USD</option>
      </select>
      <select className="select" value={ownerUserId} onChange={(e) => setOwner(e.target.value)}>
        {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
      </select>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
        <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} /> Shared
      </label>
      <input className="input" type="number" placeholder="Opening balance" value={balance} onChange={(e) => setBalance(Number(e.target.value))} style={{ width: 140 }} />
      <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
        <button className="btn btn--primary" onClick={() => onSave({ name, institution, type, currency, ownerUserId, isShared, openingBalance: balance })} disabled={!name.trim() || !institution.trim()}><Check size={15} /> Save</button>
        <button className="btn" onClick={onCancel}><X size={15} /> Cancel</button>
      </div>
    </div>
  );
}
