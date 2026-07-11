import type { Account, Currency, Holding, Scope } from '@/types';

function toInr(value: number, currency: Currency, usdInr: number): number {
  return currency === 'USD' ? value * usdInr : value;
}

/** For a personal view: shared items are counted at 1/N; owned items at 100%. */
export function scopeHoldings(holdings: Holding[], scope: Scope, viewerUserId: string, memberCount: number): { list: Holding[]; sharedFactor: (h: Holding) => number } {
  if (scope === 'family') {
    return { list: holdings, sharedFactor: () => 1 };
  }
  const list = holdings.filter((h) => h.ownerUserId === viewerUserId || h.isShared);
  const sharedFactor = (h: Holding) => (h.isShared && h.ownerUserId !== viewerUserId ? 1 / Math.max(memberCount, 1) : h.isShared ? 1 / Math.max(memberCount, 1) : 1);
  return { list, sharedFactor };
}

export function scopeAccounts(accounts: Account[], scope: Scope, viewerUserId: string, memberCount: number): { list: Account[]; sharedFactor: (a: Account) => number } {
  if (scope === 'family') return { list: accounts, sharedFactor: () => 1 };
  const list = accounts.filter((a) => a.ownerUserId === viewerUserId || a.isShared);
  const sharedFactor = (a: Account) => (a.isShared ? 1 / Math.max(memberCount, 1) : 1);
  return { list, sharedFactor };
}

export function netWorthScoped(
  accounts: Account[],
  holdings: Holding[],
  usdInr: number,
  scope: Scope,
  viewerUserId: string,
  memberCount: number
): number {
  const a = scopeAccounts(accounts, scope, viewerUserId, memberCount);
  const h = scopeHoldings(holdings, scope, viewerUserId, memberCount);
  const acctTotal = a.list.reduce((s, x) => s + toInr(x.latestBalance, x.currency, usdInr) * a.sharedFactor(x), 0);
  const holdingTotal = h.list.reduce((s, x) => s + toInr(x.latestValue, x.currency, usdInr) * h.sharedFactor(x), 0);
  return acctTotal + holdingTotal;
}
