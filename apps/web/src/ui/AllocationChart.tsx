'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { Category, Holding } from '@/types';
import { CATEGORY_LABELS } from '@/types';
import { formatInrCompact, formatInrFull } from '@/util/format';

type Slice = { category: Category; valueInr: number; pct: number };

type Props = { slices: Slice[]; title?: string };

export function AllocationChart({ slices, title = 'Allocation' }: Props) {
  if (slices.length === 0) {
    return (
      <section className="card">
        <div className="section-header"><h2>{title}</h2></div>
        <p style={{ color: 'var(--text-secondary)' }}>Add holdings to see allocation.</p>
      </section>
    );
  }
  return (
    <section className="card">
      <div className="section-header">
        <h2>{title}</h2>
        <span className="section-header__meta">{slices.length} categories</span>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 220, height: 220 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={slices} dataKey="valueInr" nameKey="category" innerRadius={60} outerRadius={100} paddingAngle={1} stroke="var(--bg-surface)" strokeWidth={2}>
                {slices.map((s) => (<Cell key={s.category} fill={`var(--category-${s.category})`} />))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as Slice;
                  return (
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
                      <div>{CATEGORY_LABELS[p.category]}</div>
                      <div style={{ fontFamily: 'var(--font-numeric)', fontWeight: 600 }}>{formatInrFull(p.valueInr)} · {p.pct.toFixed(1)}%</div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1, minWidth: 200 }}>
          {slices.map((s) => (
            <li key={s.category} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 }}>
              <span className="category-dot" style={{ background: `var(--category-${s.category})`, marginRight: 0 }} />
              <span style={{ flex: 1 }}>{CATEGORY_LABELS[s.category]}</span>
              <span style={{ fontFamily: 'var(--font-numeric)', color: 'var(--text-secondary)' }}>{s.pct.toFixed(1)}%</span>
              <span style={{ fontFamily: 'var(--font-numeric)', minWidth: 80, textAlign: 'right' }}>{formatInrCompact(s.valueInr)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Pure helper — computes slices from a set of holdings + fx. */
export function slicesFromHoldings(holdings: Holding[], usdInr: number, weightFn?: (h: Holding) => number): Slice[] {
  const totals = new Map<Category, number>();
  for (const h of holdings) {
    if (h.category === 'liability') continue;
    const inr = h.currency === 'USD' ? h.latestValue * usdInr : h.latestValue;
    const w = weightFn ? weightFn(h) : 1;
    totals.set(h.category, (totals.get(h.category) ?? 0) + inr * w);
  }
  const sum = Array.from(totals.values()).reduce((a, b) => a + b, 0);
  return Array.from(totals.entries())
    .map(([category, valueInr]) => ({ category, valueInr, pct: sum > 0 ? (valueInr / sum) * 100 : 0 }))
    .sort((a, b) => b.valueInr - a.valueInr);
}
