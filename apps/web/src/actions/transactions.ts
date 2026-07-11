'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireFamily } from '@/auth/guards';
import { db, schema } from '@/db/client';

type NewTransaction = {
  accountId: string;
  date: string;
  description: string;
  amount: number;
  category?: string | null;
  runningBalance?: number | null;
  externalId?: string | null;
  importedFrom?: string | null;
};

export async function addTransaction(input: NewTransaction) {
  const session = await requireFamily();
  if (!db) throw new Error('DB unavailable');
  const [acct] = await db.select().from(schema.account).where(and(eq(schema.account.id, input.accountId), eq(schema.account.familyId, session.user.familyId))).limit(1);
  if (!acct) return { ok: false as const, error: 'Account not found' };

  await db.insert(schema.transaction).values({
    accountId: input.accountId,
    date: input.date,
    description: input.description,
    amount: String(input.amount),
    category: input.category ?? null,
    runningBalance: input.runningBalance !== null && input.runningBalance !== undefined ? String(input.runningBalance) : null,
    externalId: input.externalId ?? null,
    importedFrom: input.importedFrom ?? null,
  });
  revalidatePath('/accounts');
  return { ok: true as const };
}

export async function deleteTransaction(id: string) {
  const session = await requireFamily();
  if (!db) throw new Error('DB unavailable');
  const [row] = await db
    .select({ familyId: schema.account.familyId })
    .from(schema.transaction)
    .innerJoin(schema.account, eq(schema.transaction.accountId, schema.account.id))
    .where(eq(schema.transaction.id, id))
    .limit(1);
  if (!row || row.familyId !== session.user.familyId) return { ok: false as const, error: 'Not found' };
  await db.delete(schema.transaction).where(eq(schema.transaction.id, id));
  revalidatePath('/accounts');
  return { ok: true as const };
}
