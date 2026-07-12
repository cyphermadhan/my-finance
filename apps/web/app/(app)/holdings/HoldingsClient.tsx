'use client';

import { useState, useRef, useTransition } from 'react';
import { Plus, MoreHorizontal, Edit2, Trash2, Check, X, Upload, Briefcase } from 'react-feather';
import type { Category, FamilyMember, Holding } from '@/types';
import { CATEGORIES, CATEGORY_LABELS, CATEGORY_UNITS } from '@/types';
import { formatInrCompact } from '@/util/format';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Modal } from '@/ui/Modal';

const SCOPE_OPTIONS = [
  { value: 'family' as const, label: 'Family' },
  { value: 'mine' as const, label: 'Mine' },
];

type UpsertInput = {
  id?: string;
  category: Category;
  name: string;
  currency: 'INR' | 'USD';
  quantity?: number | null;
  notes?: string | null;
  isShared: boolean;
  sharedWith?: string[];
  ownerUserId: string;
  value: number;
};

type Props = {
  viewerUserId: string;
  holdings: Holding[];
  members: FamilyMember[];
  usdInr: number;
  upsertHolding: (input: UpsertInput) => Promise<{ ok: true; holdingId: string }>;
  deleteHolding: (id: string) => Promise<{ ok: true }>;
};

function inr(v: number, c: 'INR' | 'USD', usdInr: number): number {
  return c === 'USD' ? v * usdInr : v;
}

/** Compact native-currency amount (₹ uses Cr/L; $ uses K/M/B). */
function money(v: number, currency: 'INR' | 'USD'): string {
  if (currency !== 'USD') return formatInrCompact(v);
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}K`;
  return `${s}$${a.toFixed(0)}`;
}

export function HoldingsClient(p: Props) {
  const [tab, setTab] = useState<'family' | 'mine'>('family');
  const [adding, setAdding] = useState(false);

  const filtered =
    tab === 'mine'
      ? p.holdings.filter((h) => (h.isShared ? (h.sharedWith ?? []).includes(p.viewerUserId) : h.ownerUserId === p.viewerUserId))
      : p.holdings;

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
          <h2><Briefcase size={16} /> Holdings</h2>
          <div className="section-header__actions">
            <SegmentedControl ariaLabel="Holdings scope" value={tab} onChange={setTab} options={SCOPE_OPTIONS} />
            <button className="btn btn--primary" onClick={() => setAdding(true)} disabled={adding}>
              <Plus size={15} /> Add
            </button>
          </div>
        </div>
        {orderedCats.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)' }}>
            <p>No holdings yet. Add one below, or import a holdings file.</p>
            <a className="btn" href="/import" style={{ marginTop: 8 }}><Upload size={15} /> Import holdings</a>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--cards">
              <thead>
                <tr>
                  <th>Name</th>
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
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => setAdding(true)} disabled={adding}><Plus size={15} /> Add holding</button>
        </div>
        {adding && (
          <Modal title="Add holding" onClose={() => setAdding(false)} maxWidth={560}>
            <HoldingForm
              members={p.members}
              defaultOwner={p.viewerUserId}
              onSave={async (v) => {
                await p.upsertHolding(v);
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          </Modal>
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const unit = CATEGORY_UNITS[category];
  const total = holdings.reduce((s, h) => s + inr(h.latestValue, h.currency, usdInr), 0);
  const memberName = (id: string) => members.find((m) => m.userId === id)?.name ?? '—';

  return (
    <>
      <tr className="table__group-row">
        <td colSpan={5}>
          <span className="category-dot" style={{ background: `var(--category-${category})` }} />
          {CATEGORY_LABELS[category]} <span style={{ opacity: 0.6 }}>({holdings.length})</span>
        </td>
        <td className="table__num" style={{ fontFamily: 'var(--font-numeric)' }}>{formatInrCompact(total)}</td>
        <td />
      </tr>
      {holdings.map((h) =>
        editingId === h.id ? (
          <tr key={h.id} className="holding-edit-row">
            <td colSpan={7} className="holding-form-cell">
              <HoldingForm
                members={members}
                defaultOwner={h.ownerUserId}
                initial={h}
                onSave={async (v) => {
                  await upsert(v);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            </td>
          </tr>
        ) : (
          <tr key={h.id}>
            <td data-label="Name">
              {h.name} {h.isShared && <span className="badge badge--shared">shared</span>}
            </td>
            <td data-label="Owner">{memberName(h.ownerUserId)}</td>
            <td data-label="Currency">{h.currency}</td>
            <td className="table__num" data-label="Qty">{h.quantity != null && unit ? `${h.quantity} ${unit}` : '—'}</td>
            <td className="table__num" data-label="Value" style={{ fontFamily: 'var(--font-numeric)' }}>{money(h.latestValue, h.currency)}</td>
            <td className="table__num" data-label="₹" style={{ fontFamily: 'var(--font-numeric)' }}>{formatInrCompact(inr(h.latestValue, h.currency, usdInr))}</td>
            <td className="table__actions">
              <RowMenu
                onEdit={() => setEditingId(h.id)}
                onDelete={() => {
                  if (confirm(`Delete "${h.name}"?`)) start(() => del(h.id).then(() => {}));
                }}
              />
            </td>
          </tr>
        )
      )}
    </>
  );
}

function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const open = pos !== null;

  function toggle() {
    if (open) {
      setPos(null);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.right });
  }

  return (
    <div className="row-menu">
      <button
        ref={btnRef}
        className="icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Row actions"
        onClick={toggle}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && pos && (
        <>
          <button className="row-menu__backdrop" aria-hidden tabIndex={-1} onClick={() => setPos(null)} />
          <div className="row-menu__menu" role="menu" style={{ top: pos.top, left: pos.left }}>
            <button role="menuitem" className="row-menu__item" onClick={() => { setPos(null); onEdit(); }}>
              <Edit2 size={14} /> Edit
            </button>
            <button role="menuitem" className="row-menu__item row-menu__item--danger" onClick={() => { setPos(null); onDelete(); }}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function HoldingForm({
  members,
  defaultOwner,
  initial,
  onSave,
  onCancel,
}: {
  members: FamilyMember[];
  defaultOwner: string;
  initial?: Holding;
  onSave: (v: UpsertInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<Category>(initial?.category ?? 'cash');
  const [currency, setCurrency] = useState<'INR' | 'USD'>(initial?.currency ?? 'INR');
  const [ownerUserId, setOwner] = useState(initial?.ownerUserId ?? defaultOwner);
  const [isShared, setIsShared] = useState(initial?.isShared ?? false);
  const [sharedWith, setSharedWith] = useState<string[]>(
    (initial?.sharedWith ?? []).filter((id) => id !== (initial?.ownerUserId ?? defaultOwner))
  );
  const [value, setValue] = useState<string>(initial ? String(initial.latestValue) : '');
  const [quantity, setQuantity] = useState<string>(initial?.quantity != null ? String(initial.quantity) : '');
  const [saving, setSaving] = useState(false);

  const unit = CATEGORY_UNITS[category];

  function toggleMember(id: string) {
    setSharedWith((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const full = isShared ? Array.from(new Set([ownerUserId, ...sharedWith])) : [];
      await onSave({
        id: initial?.id,
        name: name.trim(),
        category,
        currency,
        quantity: unit && quantity !== '' ? Number(quantity) : null,
        isShared,
        sharedWith: full,
        ownerUserId,
        value: value === '' ? 0 : Number(value),
      });
      // On success the parent unmounts this form.
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="holding-form">
      <div className="holding-form__fields">
        <input className="input input--text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value as 'INR' | 'USD')}>
          <option value="INR">INR</option>
          <option value="USD">USD</option>
        </select>
        {unit && (
          <input
            className="input"
            type="number"
            step="any"
            placeholder={`Qty (${unit})`}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        )}
        <input className="input" type="number" step="any" placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} />
        <select className="select" value={ownerUserId} onChange={(e) => setOwner(e.target.value)}>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
        </select>
        <label className="checkbox-inline">
          <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} /> Shared
        </label>
      </div>

      {isShared && (
        <div className="shared-picker">
          <div className="shared-picker__label">Shared with</div>
          <div className="shared-picker__members">
            {members.map((m) => {
              const isOwner = m.userId === ownerUserId;
              const checked = isOwner || sharedWith.includes(m.userId);
              return (
                <label key={m.userId} className="checkbox-inline">
                  <input type="checkbox" checked={checked} disabled={isOwner} onChange={() => toggleMember(m.userId)} />
                  {m.name}{isOwner ? ' (owner)' : ''}
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="holding-form__actions">
        <button className="btn btn--primary" disabled={!name.trim() || saving} onClick={handleSave}><Check size={15} /> {saving ? 'Saving…' : 'Save'}</button>
        <button className="btn" onClick={onCancel} disabled={saving}><X size={15} /> Cancel</button>
      </div>
    </div>
  );
}
