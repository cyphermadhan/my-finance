'use client';

import { useState, useTransition } from 'react';
import type { Category, FamilyMember, Holding } from '@/types';
import { CATEGORIES, CATEGORY_LABELS } from '@/types';
import { formatInrCompact } from '@/util/format';
import { SegmentedControl } from '@/ui/SegmentedControl';

const SCOPE_OPTIONS = [
  { value: 'family' as const, label: 'Family' },
  { value: 'mine' as const, label: 'Mine' },
];

type Props = {
  viewerUserId: string;
  holdings: Holding[];
  members: FamilyMember[];
  usdInr: number;
  upsertHolding: (input: {
    id?: string;
    category: Category;
    name: string;
    currency: 'INR' | 'USD';
    quantity?: number | null;
    ticker?: string | null;
    notes?: string | null;
    isShared: boolean;
    ownerUserId: string;
    value: number;
  }) => Promise<{ ok: true; holdingId: string }>;
  deleteHolding: (id: string) => Promise<{ ok: true }>;
};

export function HoldingsClient(p: Props) {
  const [tab, setTab] = useState<'family' | 'mine'>('family');
  const [adding, setAdding] = useState(false);
  const [, start] = useTransition();

  const filtered = tab === 'mine' ? p.holdings.filter((h) => h.ownerUserId === p.viewerUserId || h.isShared) : p.holdings;

  const grouped = new Map<Category, Holding[]>();
  for (const h of filtered) {
    if (!grouped.has(h.category)) grouped.set(h.category, []);
    grouped.get(h.category)!.push(h);
  }
  const orderedCats = CATEGORIES.filter((c) => grouped.has(c));

  return (
    <div className="app">
      <section className="card">
        <div className="section-header">
          <h2>Holdings</h2>
          <SegmentedControl ariaLabel="Holdings scope" value={tab} onChange={setTab} options={SCOPE_OPTIONS} />
        </div>
        {orderedCats.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No holdings yet. Import a holdings CSV or add one manually.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Ticker</th>
                <th>Owner</th>
                <th>Currency</th>
                <th className="table__num">Qty</th>
                <th className="table__num">Value</th>
                <th className="table__num">₹</th>
                <th className="table__actions" />
              </tr>
            </thead>
            <tbody>
              {orderedCats.map((cat) => (
                <CategoryGroup
                  key={cat}
                  category={cat}
                  holdings={grouped.get(cat)!}
                  usdInr={p.usdInr}
                  members={p.members}
                  upsert={p.upsertHolding}
                  del={p.deleteHolding}
                />
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => setAdding(true)} disabled={adding}>+ Add holding</button>
        </div>
        {adding && (
          <NewHolding
            members={p.members}
            defaultOwner={p.viewerUserId}
            onSave={async (v) => {
              await p.upsertHolding(v);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        )}
      </section>
    </div>
  );
}

function CategoryGroup({
  category,
  holdings,
  usdInr,
  members,
  upsert,
  del,
}: {
  category: Category;
  holdings: Holding[];
  usdInr: number;
  members: FamilyMember[];
  upsert: Props['upsertHolding'];
  del: Props['deleteHolding'];
}) {
  const [, start] = useTransition();
  const total = holdings.reduce((s, h) => s + inr(h.latestValue, h.currency, usdInr), 0);
  return (
    <>
      <tr className="table__group-row">
        <td colSpan={6}>
          <span className="category-dot" style={{ background: `var(--category-${category})` }} />
          {CATEGORY_LABELS[category]} <span style={{ opacity: 0.6 }}>({holdings.length})</span>
        </td>
        <td className="table__num" style={{ fontFamily: 'var(--font-numeric)' }}>{formatInrCompact(total)}</td>
        <td />
      </tr>
      {holdings.map((h) => (
        <tr key={h.id}>
          <td>{h.name} {h.isShared && <span className="badge badge--shared">shared</span>}</td>
          <td>{h.ticker ?? '—'}</td>
          <td>{members.find((m) => m.userId === h.ownerUserId)?.name ?? '—'}</td>
          <td>
            <select
              className="select"
              defaultValue={h.currency}
              onChange={(e) => start(() => upsert({ ...toInput(h), currency: e.target.value as 'INR' | 'USD' }).then(() => {}))}
            >
              <option value="INR">INR</option>
              <option value="USD">USD</option>
            </select>
          </td>
          <td className="table__num">
            <input
              className="input"
              type="number"
              step={0.0001}
              defaultValue={h.quantity ?? ''}
              style={{ textAlign: 'right' }}
              onBlur={(e) => {
                const q = e.target.value === '' ? null : Number(e.target.value);
                if (q !== h.quantity) start(() => upsert({ ...toInput(h), quantity: q }).then(() => {}));
              }}
            />
          </td>
          <td className="table__num">
            <input
              className="input"
              type="number"
              defaultValue={h.latestValue}
              style={{ textAlign: 'right' }}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v !== h.latestValue) start(() => upsert({ ...toInput(h), value: v }).then(() => {}));
              }}
            />
          </td>
          <td className="table__num">{formatInrCompact(inr(h.latestValue, h.currency, usdInr))}</td>
          <td className="table__actions">
            <button className="icon-btn" onClick={() => start(() => del(h.id).then(() => {}))}>✕</button>
          </td>
        </tr>
      ))}
    </>
  );
}

function inr(v: number, c: 'INR' | 'USD', usdInr: number): number {
  return c === 'USD' ? v * usdInr : v;
}

function toInput(h: Holding) {
  return {
    id: h.id,
    category: h.category,
    name: h.name,
    currency: h.currency,
    quantity: h.quantity ?? null,
    ticker: h.ticker ?? null,
    notes: h.notes ?? null,
    isShared: h.isShared,
    ownerUserId: h.ownerUserId,
    value: h.latestValue,
  };
}

function NewHolding({
  members,
  defaultOwner,
  onSave,
  onCancel,
}: {
  members: FamilyMember[];
  defaultOwner: string;
  onSave: (v: {
    category: Category;
    name: string;
    currency: 'INR' | 'USD';
    quantity?: number | null;
    ticker?: string | null;
    isShared: boolean;
    ownerUserId: string;
    value: number;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('cash');
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [ownerUserId, setOwner] = useState(defaultOwner);
  const [isShared, setIsShared] = useState(false);
  const [value, setValue] = useState(0);
  const [quantity, setQuantity] = useState('');
  const [ticker, setTicker] = useState('');

  return (
    <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <input className="input input--text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
      <select className="select" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
        {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
      </select>
      <input className="input input--text" placeholder="Ticker (optional)" value={ticker} onChange={(e) => setTicker(e.target.value)} style={{ width: 140 }} />
      <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value as 'INR' | 'USD')}>
        <option value="INR">INR</option>
        <option value="USD">USD</option>
      </select>
      <input className="input" type="number" step={0.0001} placeholder="Qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={{ width: 90 }} />
      <input className="input" type="number" placeholder="Value" value={value} onChange={(e) => setValue(Number(e.target.value))} style={{ width: 140 }} />
      <select className="select" value={ownerUserId} onChange={(e) => setOwner(e.target.value)}>
        {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
      </select>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
        <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} /> Shared
      </label>
      <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
        <button
          className="btn btn--primary"
          onClick={() => onSave({
            name,
            category,
            currency,
            quantity: quantity === '' ? null : Number(quantity),
            ticker: ticker || null,
            isShared,
            ownerUserId,
            value,
          })}
          disabled={!name.trim()}
        >
          Save
        </button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
