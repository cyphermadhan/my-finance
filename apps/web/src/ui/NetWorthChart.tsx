'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { formatInrCompact, formatInrFull } from '@/util/format';

type Props = { data: Array<{ date: string; value: number }>; title?: string };

export function NetWorthChart({ data, title = 'Net worth over time' }: Props) {
  if (data.length < 2) {
    return (
      <section className="card">
        <div className="section-header"><h2>{title}</h2></div>
        <p style={{ color: 'var(--text-secondary)' }}>Import a few months of history to see the trend.</p>
      </section>
    );
  }
  return (
    <section className="card">
      <div className="section-header">
        <h2>{title}</h2>
        <span className="section-header__meta">{data.length} snapshots</span>
      </div>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickFormatter={(d) => format(new Date(d), 'MMM')} stroke="var(--border-strong)" />
            <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickFormatter={(v) => formatInrCompact(v)} stroke="var(--border-strong)" width={70} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as { date: string; value: number };
                return (
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
                    <div style={{ color: 'var(--text-tertiary)' }}>{format(new Date(p.date), 'PP')}</div>
                    <div style={{ fontFamily: 'var(--font-numeric)', fontWeight: 600 }}>{formatInrFull(p.value)}</div>
                  </div>
                );
              }}
            />
            <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="url(#nwFill)" dot={{ fill: 'var(--accent)', r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
