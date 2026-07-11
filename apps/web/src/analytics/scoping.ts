import type { Account, Category, Currency, Holding, Scope } from '@/types';

export type Slice = { category: Category; valueInr: number; pct: number };

function toInr(value: number, currency: Currency, usdInr: number): number {
  return currency === 'USD' ? value * usdInr : value;
}

/** Pure helper — computes allocation slices from a set of holdings + fx. Server-safe. */
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

/** Number of people a holding is split between (the shared-with set, min 1). */
function holdingSplit(h: Holding): number {
  return Math.max(h.sharedWith?.length ?? 1, 1);
}

/**
 * For a personal view: a holding is included if the viewer owns it (unshared) or
 * is in its shared-with set. Shared holdings are counted at 1/|shared-with|.
 */
export function scopeHoldings(holdings: Holding[], scope: Scope, viewerUserId: string): { list: Holding[]; sharedFactor: (h: Holding) => number } {
  if (scope === 'family') {
    return { list: holdings, sharedFactor: () => 1 };
  }
  const list = holdings.filter((h) =>
    h.isShared ? (h.sharedWith ?? []).includes(viewerUserId) : h.ownerUserId === viewerUserId
  );
  const sharedFactor = (h: Holding) => (h.isShared ? 1 / holdingSplit(h) : 1);
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
  const h = scopeHoldings(holdings, scope, viewerUserId);
  const acctTotal = a.list.reduce((s, x) => s + toInr(x.latestBalance, x.currency, usdInr) * a.sharedFactor(x), 0);
  const holdingTotal = h.list.reduce((s, x) => s + toInr(x.latestValue, x.currency, usdInr) * h.sharedFactor(x), 0);
  return acctTotal + holdingTotal;
}
