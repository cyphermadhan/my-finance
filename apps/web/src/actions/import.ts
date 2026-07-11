'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireFamily } from '@/auth/guards';
import { db, schema } from '@/db/client';
import { ensureTodaySnapshot } from './snapshots';
import type { HoldingRow, TransactionRow } from '@/ingest/parse';

type ImportSummary = {
  transactions?: { inserted: number; duplicates: number; createdAccounts: number };
  holdings?: { inserted: number; valuesInserted: number };
};

export async function importTransactions(rows: TransactionRow[]): Promise<{ ok: true; summary: ImportSummary } | { ok: false; error: string }> {
  const session = await requireFamily();
  if (!db) return { ok: false, error: 'DB unavailable' };
  const familyId = session.user.familyId;

  const accountsMap = new Map<string, string>(); // name -> id
  const existing = await db.select().from(schema.account).where(eq(schema.account.familyId, familyId));
  for (const a of existing) accountsMap.set(a.name, a.id);

  let createdAccounts = 0;
  const newNames = new Set(rows.map((r) => r.account_name).filter((n) => !accountsMap.has(n)));
  for (const name of newNames) {
    const sample = rows.find((r) => r.account_name === name)!;
    const [row] = await db.insert(schema.account).values({
      familyId,
      ownerUserId: session.user.id,
      isShared: false,
      institution: name,
      name,
      type: 'bank',
      currency: sample.currency,
    }).returning();
    accountsMap.set(name, row.id);
    createdAccounts++;
  }

  // Dedupe by (account_id, external_id) when external_id present.
  const withExt = rows.filter((r) => r.external_id);
  const dedupe = new Map<string, Set<string>>(); // accountId -> set(externalId)
  if (withExt.length) {
    const grouped = new Map<string, string[]>();
    for (const r of withExt) {
      const aid = accountsMap.get(r.account_name)!;
      const arr = grouped.get(aid) ?? [];
      arr.push(r.external_id!);
      grouped.set(aid, arr);
    }
    for (const [aid, ids] of grouped) {
      const found = await db
        .select({ eid: schema.transaction.externalId })
        .from(schema.transaction)
        .where(and(eq(schema.transaction.accountId, aid), inArray(schema.transaction.externalId, ids)));
      dedupe.set(aid, new Set(found.map((r) => r.eid!).filter(Boolean)));
    }
  }

  let inserted = 0;
  let duplicates = 0;
  const toInsert: (typeof schema.transaction.$inferInsert)[] = [];
  for (const r of rows) {
    const aid = accountsMap.get(r.account_name)!;
    if (r.external_id && dedupe.get(aid)?.has(r.external_id)) { duplicates++; continue; }
    toInsert.push({
      accountId: aid,
      date: r.date,
      description: r.description,
      amount: String(r.amount),
      category: r.category ?? null,
      runningBalance: r.running_balance !== undefined ? String(r.running_balance) : null,
      externalId: r.external_id ?? null,
      importedFrom: 'template',
    });
  }
  if (toInsert.length) {
    // Insert in chunks of 500 to stay under neon param limits.
    for (let i = 0; i < toInsert.length; i += 500) {
      const chunk = toInsert.slice(i, i + 500);
      await db.insert(schema.transaction).values(chunk).onConflictDoNothing();
      inserted += chunk.length;
    }
  }

  // Also freeze running_balance as today's account_balance for accounts that had at least one row with running_balance.
  const latestByAccount = new Map<string, { date: string; balance: number }>();
  for (const r of rows) {
    if (r.running_balance === undefined) continue;
    const aid = accountsMap.get(r.account_name)!;
    const cur = latestByAccount.get(aid);
    if (!cur || r.date > cur.date) latestByAccount.set(aid, { date: r.date, balance: r.running_balance });
  }
  if (latestByAccount.size) {
    const s = await ensureTodaySnapshot(familyId, session.user.id);
    for (const [aid, { balance }] of latestByAccount) {
      await db
        .insert(schema.accountBalance)
        .values({ snapshotId: s.id, accountId: aid, balance: String(balance) })
        .onConflictDoUpdate({ target: [schema.accountBalance.snapshotId, schema.accountBalance.accountId], set: { balance: String(balance) } });
    }
  }

  revalidatePath('/accounts');
  revalidatePath('/family');
  revalidatePath('/personal');
  return { ok: true, summary: { transactions: { inserted, duplicates, createdAccounts } } };
}

export async function importHoldings(rows: HoldingRow[]): Promise<{ ok: true; summary: ImportSummary } | { ok: false; error: string }> {
  const session = await requireFamily();
  if (!db) return { ok: false, error: 'DB unavailable' };
  const familyId = session.user.familyId;

  // Resolve owner_email → userId (must be family member)
  const memberRows = await db
    .select({ userId: schema.familyMember.userId, email: schema.users.email })
    .from(schema.familyMember)
    .innerJoin(schema.users, eq(schema.familyMember.userId, schema.users.id))
    .where(eq(schema.familyMember.familyId, familyId));
  const emailToUser = new Map(memberRows.map((r) => [r.email.toLowerCase(), r.userId]));

  const unknownEmails = new Set<string>();
  for (const r of rows) {
    if (!emailToUser.has(r.owner_email.toLowerCase())) unknownEmails.add(r.owner_email);
  }
  if (unknownEmails.size) {
    return { ok: false, error: `Unknown owner emails (not in family): ${[...unknownEmails].join(', ')}` };
  }

  // Group rows into a holding identity: (owner, category, name, ticker). All rows for that holding
  // share one holding row; each date/value becomes a holding_value row.
  const groupKey = (r: HoldingRow) => `${emailToUser.get(r.owner_email.toLowerCase())}::${r.category}::${r.name}::${r.ticker ?? ''}`;
  const groups = new Map<string, { sample: HoldingRow; entries: HoldingRow[] }>();
  for (const r of rows) {
    const k = groupKey(r);
    if (!groups.has(k)) groups.set(k, { sample: r, entries: [] });
    groups.get(k)!.entries.push(r);
  }

  // Find existing holdings matching these identities so we can upsert.
  const existing = await db.select().from(schema.holding).where(eq(schema.holding.familyId, familyId));
  const existingByKey = new Map(existing.map((h) => [`${h.ownerUserId}::${h.category}::${h.name}::${h.ticker ?? ''}`, h]));

  let inserted = 0;
  let valuesInserted = 0;
  for (const [key, { sample, entries }] of groups) {
    let holdingId = existingByKey.get(key)?.id;
    if (!holdingId) {
      const [row] = await db.insert(schema.holding).values({
        familyId,
        ownerUserId: emailToUser.get(sample.owner_email.toLowerCase())!,
        isShared: sample.is_shared,
        category: sample.category,
        name: sample.name,
        currency: sample.currency,
        quantity: sample.quantity !== undefined ? String(sample.quantity) : null,
        ticker: sample.ticker ?? null,
        notes: sample.notes ?? null,
      }).returning();
      holdingId = row.id;
      inserted++;
    }
    // ensure a snapshot per date exists at family level
    for (const e of entries) {
      // ensure snapshot per date (create if missing)
      const [snapRow] = await db
        .select()
        .from(schema.snapshot)
        .where(and(eq(schema.snapshot.familyId, familyId), eq(schema.snapshot.date, e.date)))
        .limit(1);
      if (!snapRow) {
        await db.insert(schema.snapshot).values({ familyId, date: e.date, createdBy: session.user.id });
      }
      await db
        .insert(schema.holdingValue)
        .values({ holdingId, date: e.date, value: String(e.value) })
        .onConflictDoUpdate({ target: [schema.holdingValue.holdingId, schema.holdingValue.date], set: { value: String(e.value) } });
      valuesInserted++;
    }
  }

  revalidatePath('/holdings');
  revalidatePath('/family');
  revalidatePath('/personal');
  return { ok: true, summary: { holdings: { inserted, valuesInserted } } };
}
