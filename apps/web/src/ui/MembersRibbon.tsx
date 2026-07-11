import { Users } from 'react-feather';
import type { Account, FamilyMember, Holding } from '@/types';
import { formatInrCompact } from '@/util/format';

type Props = {
  members: FamilyMember[];
  accounts: Account[];
  holdings: Holding[];
  usdInr: number;
};

/** Split shared items evenly; show each member's net contribution. */
export function MembersRibbon({ members, accounts, holdings, usdInr }: Props) {
  const n = Math.max(members.length, 1);
  const toInr = (v: number, c: 'INR' | 'USD') => (c === 'USD' ? v * usdInr : v);

  const byMember: Record<string, number> = {};
  for (const m of members) byMember[m.userId] = 0;
  for (const a of accounts) {
    const inr = toInr(a.latestBalance, a.currency);
    if (a.isShared) for (const m of members) byMember[m.userId] += inr / n;
    else byMember[a.ownerUserId] = (byMember[a.ownerUserId] ?? 0) + inr;
  }
  for (const h of holdings) {
    const inr = toInr(h.latestValue, h.currency);
    if (h.isShared && h.sharedWith && h.sharedWith.length) {
      const share = inr / h.sharedWith.length;
      for (const uid of h.sharedWith) byMember[uid] = (byMember[uid] ?? 0) + share;
    } else {
      byMember[h.ownerUserId] = (byMember[h.ownerUserId] ?? 0) + inr;
    }
  }
  const familyTotal = Object.values(byMember).reduce((s, v) => s + v, 0);

  return (
    <section className="card">
      <div className="section-header">
        <h2><Users size={16} /> Members</h2>
        <span className="section-header__meta">{members.length} in family</span>
      </div>
      <div className="member-ribbon">
        {members.map((m) => {
          const v = byMember[m.userId] ?? 0;
          const pct = familyTotal !== 0 ? (v / familyTotal) * 100 : 0;
          return (
            <div key={m.userId} className="member-card">
              <div className="member-card__name">{m.name}</div>
              <div className="member-card__value">{formatInrCompact(v)}</div>
              <div className="member-card__pct">{pct.toFixed(1)}% of family</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
