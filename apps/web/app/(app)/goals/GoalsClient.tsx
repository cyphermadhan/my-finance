'use client';

import { useState, useTransition } from 'react';
import type { Category, FamilyMember, Goal, Scope } from '@/types';
import { CATEGORIES, CATEGORY_LABELS } from '@/types';
import { formatInrCompact } from '@/util/format';

type Props = {
  viewerUserId: string;
  goals: Goal[];
  members: FamilyMember[];
  upsertGoal: (input: { id?: string; scope: Scope; ownerUserId?: string | null; name: string; targetInr: number; targetDate?: string | null; includeCategories: Category[] }) => Promise<{ ok: true; id: string }>;
  deleteGoal: (id: string) => Promise<{ ok: true }>;
};

export function GoalsClient({ viewerUserId, goals, members, upsertGoal, deleteGoal }: Props) {
  const [editing, setEditing] = useState<Goal | null>(null);
  const [, start] = useTransition();

  return (
    <div className="app">
      <section className="card">
        <div className="section-header">
          <h2>Goals</h2>
          <button className="btn" onClick={() => setEditing({ id: '', familyId: '', scope: 'family', name: '', targetInr: 0, includeCategories: [] })}>+ New goal</button>
        </div>
        {goals.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No goals yet. Create your first family or personal goal.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {goals.map((g) => (
              <li key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {g.name}{' '}
                    <span className="badge">{g.scope}</span>
                    {g.scope === 'personal' && g.ownerUserId && ' '}
                    {g.scope === 'personal' && g.ownerUserId && (
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>({members.find((m) => m.userId === g.ownerUserId)?.name})</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Target {formatInrCompact(g.targetInr)}
                    {g.targetDate && ` · by ${g.targetDate}`}
                    {g.includeCategories.length > 0 && ` · ${g.includeCategories.length} categories`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn" onClick={() => setEditing(g)}>Edit</button>
                  <button className="btn btn--danger" onClick={() => start(() => deleteGoal(g.id).then(() => {}))}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && (
        <GoalEditor
          initial={editing}
          members={members}
          viewerUserId={viewerUserId}
          onCancel={() => setEditing(null)}
          onSave={async (g) => {
            await upsertGoal(g);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function GoalEditor({
  initial,
  members,
  viewerUserId,
  onSave,
  onCancel,
}: {
  initial: Goal;
  members: FamilyMember[];
  viewerUserId: string;
  onSave: (g: { id?: string; scope: Scope; ownerUserId?: string | null; name: string; targetInr: number; targetDate?: string | null; includeCategories: Category[] }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [targetInr, setTargetInr] = useState(initial.targetInr);
  const [scope, setScope] = useState<Scope>(initial.scope);
  const [ownerUserId, setOwnerUserId] = useState(initial.ownerUserId ?? viewerUserId);
  const [targetDate, setTargetDate] = useState(initial.targetDate ?? '');
  const [cats, setCats] = useState<Category[]>(initial.includeCategories);

  function toggle(c: Category) {
    setCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  return (
    <section className="card">
      <div className="section-header"><h2>{initial.id ? 'Edit goal' : 'New goal'}</h2></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
        <input className="input input--text" placeholder="Goal name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" type="number" placeholder="Target ₹" value={targetInr} onChange={(e) => setTargetInr(Number(e.target.value))} />
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="select" value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
            <option value="family">Family</option>
            <option value="personal">Personal</option>
          </select>
          {scope === 'personal' && (
            <select className="select" value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)}>
              {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
            </select>
          )}
          <input className="input" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Categories that count (leave empty for everything)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CATEGORIES.filter((c) => c !== 'liability').map((c) => (
              <button
                key={c}
                type="button"
                className="btn"
                style={{
                  background: cats.includes(c) ? 'var(--accent)' : undefined,
                  color: cats.includes(c) ? 'var(--accent-fg)' : undefined,
                  borderColor: cats.includes(c) ? 'var(--accent)' : undefined,
                }}
                onClick={() => toggle(c)}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn--primary"
            disabled={!name.trim() || targetInr <= 0}
            onClick={() => onSave({
              id: initial.id || undefined,
              scope,
              ownerUserId: scope === 'personal' ? ownerUserId : null,
              name: name.trim(),
              targetInr,
              targetDate: targetDate || null,
              includeCategories: cats,
            })}
          >
            Save
          </button>
        </div>
      </div>
    </section>
  );
}
