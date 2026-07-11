import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from './client';
import type {
  Account,
  DashboardData,
  FamilyMember,
  Goal,
  Holding,
  Transaction,
  Scope,
  Category,
} from '@/types';
import { DEFAULT_FX_USD_INR } from '@/types';

function toNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v);
}

export async function getFamilyMembers(familyId: string): Promise<FamilyMember[]> {
  if (!db) return [];
  const rows = await db
    .select({
      userId: schema.familyMember.userId,
      email: schema.users.email,
      name: schema.users.name,
      image: schema.users.image,
      isCreator: schema.familyMember.isCreator,
    })
    .from(schema.familyMember)
    .innerJoin(schema.users, eq(schema.familyMember.userId, schema.users.id))
    .where(eq(schema.familyMember.familyId, familyId));
  return rows.map((r) => ({
    userId: r.userId,
    email: r.email,
    name: r.name ?? r.email,
    image: r.image,
    isCreator: r.isCreator,
  }));
}

export async function getAccountsWithLatestBalance(familyId: string): Promise<Account[]> {
  if (!db) return [];
  const rows = await db.select().from(schema.account).where(and(eq(schema.account.familyId, familyId), eq(schema.account.active, true)));
  if (rows.length === 0) return [];

  // Latest balance per account from account_balance joined via snapshot.date desc
  const balances = await db.execute<{ account_id: string; balance: string; date: string }>(sql`
    select ab.account_id, ab.balance, s.date
    from ${schema.accountBalance} ab
    join ${schema.snapshot} s on s.id = ab.snapshot_id
    where s.family_id = ${familyId}
    and ab.account_id in (
      select ab2.account_id
      from ${schema.accountBalance} ab2
    )
    and (ab.account_id, s.date) in (
      select ab3.account_id, max(s3.date)
      from ${schema.accountBalance} ab3
      join ${schema.snapshot} s3 on s3.id = ab3.snapshot_id
      where s3.family_id = ${familyId}
      group by ab3.account_id
    )
  `);
  const bmap = new Map<string, { balance: number; date: string }>();
  for (const r of balances.rows) bmap.set(r.account_id, { balance: toNum(r.balance), date: r.date });

  return rows.map((r) => ({
    id: r.id,
    familyId: r.familyId,
    ownerUserId: r.ownerUserId,
    isShared: r.isShared,
    institution: r.institution,
    name: r.name,
    type: r.type,
    currency: r.currency,
    latestBalance: bmap.get(r.id)?.balance ?? 0,
    latestBalanceDate: bmap.get(r.id)?.date ?? null,
  }));
}

export async function getHoldingsWithLatestValue(familyId: string): Promise<Holding[]> {
  if (!db) return [];
  const rows = await db.select().from(schema.holding).where(and(eq(schema.holding.familyId, familyId), eq(schema.holding.active, true)));
  if (rows.length === 0) return [];

  const values = await db.execute<{ holding_id: string; value: string; date: string }>(sql`
    select hv.holding_id, hv.value, hv.date
    from ${schema.holdingValue} hv
    where (hv.holding_id, hv.date) in (
      select hv2.holding_id, max(hv2.date)
      from ${schema.holdingValue} hv2
      where hv2.holding_id in (${sql.join(rows.map((r) => sql`${r.id}`), sql`, `)})
      group by hv2.holding_id
    )
  `);
  const vmap = new Map<string, { value: number; date: string }>();
  for (const r of values.rows) vmap.set(r.holding_id, { value: toNum(r.value), date: r.date });

  // Load the shared-with set per holding.
  const sharedRows = await db
    .select({ holdingId: schema.holdingSharedWith.holdingId, userId: schema.holdingSharedWith.userId })
    .from(schema.holdingSharedWith)
    .where(inArray(schema.holdingSharedWith.holdingId, rows.map((r) => r.id)));
  const sharedMap = new Map<string, string[]>();
  for (const r of sharedRows) {
    const list = sharedMap.get(r.holdingId) ?? [];
    list.push(r.userId);
    sharedMap.set(r.holdingId, list);
  }

  return rows.map((r) => ({
    id: r.id,
    familyId: r.familyId,
    ownerUserId: r.ownerUserId,
    isShared: r.isShared,
    category: r.category,
    name: r.name,
    quantity: r.quantity !== null ? toNum(r.quantity) : null,
    currency: r.currency,
    notes: r.notes,
    sharedWith: sharedMap.get(r.id) ?? [],
    latestValue: vmap.get(r.id)?.value ?? 0,
    latestValueDate: vmap.get(r.id)?.date ?? null,
  }));
}

export async function getGoals(familyId: string): Promise<Goal[]> {
  if (!db) return [];
  const rows = await db.select().from(schema.goal).where(eq(schema.goal.familyId, familyId));
  return rows.map((r) => ({
    id: r.id,
    familyId: r.familyId,
    scope: r.scope,
    ownerUserId: r.ownerUserId,
    name: r.name,
    targetInr: toNum(r.targetInr),
    targetDate: r.targetDate,
    includeCategories: (r.includeCategories ?? []) as Category[],
  }));
}

export async function getHistoricalNetWorth(familyId: string): Promise<Array<{ date: string; value: number }>> {
  if (!db) return [];
  // Sum account_balance + holding_value per snapshot date. Liabilities are stored as negative values.
  const rows = await db.execute<{ date: string; total: string }>(sql`
    with dates as (
      select id, date from ${schema.snapshot} where family_id = ${familyId}
    )
    select d.date, coalesce(sum(ab.balance),0) + coalesce(sum(hv.value),0) as total
    from dates d
    left join ${schema.accountBalance} ab on ab.snapshot_id = d.id
    left join ${schema.holdingValue} hv on hv.date = d.date
    left join ${schema.holding} h on h.id = hv.holding_id and h.family_id = ${familyId}
    group by d.date
    order by d.date asc
  `);
  return rows.rows.map((r) => ({ date: r.date, value: toNum(r.total) }));
}

export async function getLatestFx(familyId: string): Promise<{ usdInr: number }> {
  if (!db) return { usdInr: DEFAULT_FX_USD_INR };
  const rows = await db.execute<{ usd_inr: string }>(sql`
    select fx.usd_inr from ${schema.snapshotFx} fx
    join ${schema.snapshot} s on s.id = fx.snapshot_id
    where s.family_id = ${familyId}
    order by s.date desc
    limit 1
  `);
  return { usdInr: rows.rows[0] ? toNum(rows.rows[0].usd_inr) : DEFAULT_FX_USD_INR };
}

export async function getRecentTransactions(familyId: string, opts: { limit?: number; ownerUserId?: string } = {}): Promise<Array<Transaction & { accountName: string; ownerUserId: string; isShared: boolean }>> {
  if (!db) return [];
  const limit = opts.limit ?? 20;
  const cond = opts.ownerUserId
    ? and(eq(schema.account.familyId, familyId), eq(schema.account.ownerUserId, opts.ownerUserId))
    : eq(schema.account.familyId, familyId);
  const rows = await db
    .select({
      id: schema.transaction.id,
      accountId: schema.transaction.accountId,
      date: schema.transaction.date,
      description: schema.transaction.description,
      amount: schema.transaction.amount,
      category: schema.transaction.category,
      runningBalance: schema.transaction.runningBalance,
      externalId: schema.transaction.externalId,
      accountName: schema.account.name,
      ownerUserId: schema.account.ownerUserId,
      isShared: schema.account.isShared,
    })
    .from(schema.transaction)
    .innerJoin(schema.account, eq(schema.transaction.accountId, schema.account.id))
    .where(cond)
    .orderBy(desc(schema.transaction.date))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    accountId: r.accountId,
    date: r.date,
    description: r.description,
    amount: toNum(r.amount),
    category: r.category,
    runningBalance: r.runningBalance !== null ? toNum(r.runningBalance) : null,
    externalId: r.externalId,
    accountName: r.accountName,
    ownerUserId: r.ownerUserId,
    isShared: r.isShared,
  }));
}

export async function loadDashboard(familyId: string, viewerUserId: string, scope: Scope): Promise<DashboardData> {
  const [members, accounts, holdings, goals, history, fx] = await Promise.all([
    getFamilyMembers(familyId),
    getAccountsWithLatestBalance(familyId),
    getHoldingsWithLatestValue(familyId),
    getGoals(familyId),
    getHistoricalNetWorth(familyId),
    getLatestFx(familyId),
  ]);
  return {
    scope,
    viewerUserId,
    familyId,
    familyMembers: members,
    memberCount: members.length,
    holdings,
    accounts,
    goals: scope === 'family' ? goals.filter((g) => g.scope === 'family') : goals.filter((g) => g.scope === 'personal' && g.ownerUserId === viewerUserId),
    historicalNetWorth: history,
    latestFx: fx,
  };
}

/** Family IDs the user belongs to (currently 1). */
export async function getMyFamilyIds(userId: string): Promise<string[]> {
  if (!db) return [];
  const rows = await db.select({ familyId: schema.familyMember.familyId }).from(schema.familyMember).where(eq(schema.familyMember.userId, userId));
  return rows.map((r) => r.familyId);
}
