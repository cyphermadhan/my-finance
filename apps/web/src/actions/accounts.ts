'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireFamily } from '@/auth/guards';
import { db, schema } from '@/db/client';
import { ensureTodaySnapshot } from './snapshots';
import type { AccountType, Currency } from '@/types';

type UpsertAccountInput = {
  id?: string;
  institution: string;
  name: string;
  type: AccountType;
  currency: Currency;
  ownerUserId: string;
  isShared: boolean;
  openingBalance?: number;
};

export async function upsertAccount(input: UpsertAccountInput) {
  const session = await requireFamily();
  if (!db) throw new Error('DB unavailable');

  let id = input.id;
  if (id) {
    await db
      .update(schema.account)
      .set({
        institution: input.institution,
        name: input.name,
        type: input.type,
        currency: input.currency,
        ownerUserId: input.ownerUserId,
        isShared: input.isShared,
      })
      .where(and(eq(schema.account.id, id), eq(schema.account.familyId, session.user.familyId)));
  } else {
    const [row] = await db
      .insert(schema.account)
      .values({
        familyId: session.user.familyId,
        ownerUserId: input.ownerUserId,
        isShared: input.isShared,
        institution: input.institution,
        name: input.name,
        type: input.type,
        currency: input.currency,
      })
      .returning();
    id = row.id;
    // seed today's balance if provided
    if (input.openingBalance !== undefined) {
      const s = await ensureTodaySnapshot(session.user.familyId, session.user.id);
      await db.insert(schema.accountBalance).values({ snapshotId: s.id, accountId: id, balance: String(input.openingBalance) });
    }
  }

  revalidatePath('/accounts');
  return { ok: true as const, accountId: id };
}

export async function deleteAccount(id: string) {
  const session = await requireFamily();
  if (!db) throw new Error('DB unavailable');
  await db
    .update(schema.account)
    .set({ active: false })
    .where(and(eq(schema.account.id, id), eq(schema.account.familyId, session.user.familyId)));
  revalidatePath('/accounts');
  return { ok: true as const };
}

/** Manually update an account's balance for today. */
export async function setAccountBalance(accountId: string, balance: number) {
  const session = await requireFamily();
  if (!db) throw new Error('DB unavailable');
  const [row] = await db.select().from(schema.account).where(and(eq(schema.account.id, accountId), eq(schema.account.familyId, session.user.familyId))).limit(1);
  if (!row) return { ok: false as const, error: 'Not found' };
  const s = await ensureTodaySnapshot(session.user.familyId, session.user.id);
  await db
    .insert(schema.accountBalance)
    .values({ snapshotId: s.id, accountId, balance: String(balance) })
    .onConflictDoUpdate({ target: [schema.accountBalance.snapshotId, schema.accountBalance.accountId], set: { balance: String(balance) } });
  revalidatePath('/accounts');
  revalidatePath('/family');
  revalidatePath('/personal');
  return { ok: true as const };
}
