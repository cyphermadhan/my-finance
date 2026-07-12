import { CreditCard } from 'react-feather';
import type { DashboardData, Scope } from '@/types';
import { Hero } from './Hero';
import { NetWorthChart } from './NetWorthChart';
import { AllocationChart } from './AllocationChart';
import { MembersRibbon } from './MembersRibbon';
import { HealthCard } from './HealthCard';
import { netWorthScoped, scopeAccounts, scopeHoldings, slicesFromHoldings } from '@/analytics/scoping';
import { portfolioHealth } from '@/analytics/health';

type Props = { data: DashboardData };

export function DashboardShell({ data }: Props) {
  const { scope, viewerUserId, familyMembers, memberCount, accounts, holdings, goals, historicalNetWorth, latestFx } = data;
  const nw = netWorthScoped(accounts, holdings, latestFx.usdInr, scope, viewerUserId, memberCount);
  const health = scope === 'family' ? portfolioHealth(holdings, goals, latestFx.usdInr) : null;

  const holdingScope = scopeHoldings(holdings, scope, viewerUserId);
  const slices = slicesFromHoldings(holdingScope.list, latestFx.usdInr, holdingScope.sharedFactor);

  const acctScope = scopeAccounts(accounts, scope, viewerUserId, memberCount);
  const acctInr = (v: number, c: 'INR' | 'USD') => (c === 'USD' ? v * latestFx.usdInr : v);

  const acctByType = new Map<string, number>();
  for (const a of acctScope.list) {
    const v = acctInr(a.latestBalance, a.currency) * acctScope.sharedFactor(a);
    acctByType.set(a.type, (acctByType.get(a.type) ?? 0) + v);
  }

  const label = scope === 'family' ? 'Family net worth' : 'My net worth';
  const historicalScoped = scaleHistory(historicalNetWorth, scope, memberCount);

  return (
    <div className="app">
      {scope === 'family' && (
        <section className="hero-banner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero-image.webp" alt="" className="hero-banner__img" />
          <div className="hero-banner__overlay">
            <p className="hero-banner__quote">Let&rsquo;s build wealth together.</p>
          </div>
        </section>
      )}
      <Hero label={label} value={nw} />
      <NetWorthChart data={historicalScoped} title={scope === 'family' ? 'Family net worth over time' : 'My net worth over time'} />

      {scope === 'family' && health && <HealthCard health={health} />}

      {scope === 'family' && (
        <MembersRibbon members={familyMembers} accounts={accounts} holdings={holdings} usdInr={latestFx.usdInr} />
      )}

      {acctScope.list.length > 0 ? (
        <div className="grid-two">
          <AllocationChart slices={slices} title={scope === 'family' ? 'Family allocation' : 'My allocation'} />

          <section className="card">
            <div className="section-header"><h2><CreditCard size={16} /> Accounts</h2></div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {acctScope.list.map((a) => {
                const v = acctInr(a.latestBalance, a.currency) * acctScope.sharedFactor(a);
                return (
                  <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                    <span>{a.name} <small style={{ color: 'var(--text-tertiary)' }}>· {a.institution}</small>{a.isShared && ' '}{a.isShared && <span className="badge badge--shared">shared</span>}</span>
                    <span style={{ fontFamily: 'var(--font-numeric)', color: v < 0 ? 'var(--negative)' : undefined }}>{formatInr(v)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      ) : (
        <AllocationChart slices={slices} title={scope === 'family' ? 'Family allocation' : 'My allocation'} />
      )}
    </div>
  );
}

function formatInr(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

/** Scale historical net worth for personal scope: rough approximation = family / N. */
function scaleHistory(data: Array<{ date: string; value: number }>, scope: Scope, memberCount: number) {
  if (scope === 'family') return data;
  return data.map((d) => ({ date: d.date, value: d.value / Math.max(memberCount, 1) }));
}
