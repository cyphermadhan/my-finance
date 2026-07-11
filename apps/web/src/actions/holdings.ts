'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireFamily } from '@/auth/guards';
import { db, schema } from '@/db/client';
import { ensureTodaySnapshot } from './snapshots';
import type { Category, Currency } from '@/types';
import { todayISO } from '@/util/format';

type UpsertHoldingInput = {
  id?: string;
  category: Category;
  name: string;
  currency: Currency;
  quantity?: number | null;
  ticker?: string | null;
  notes?: string | null;
  isShared: boolean;
  ownerUserId: string;
  value: number; // as-of today
};

export async function upsertHolding(input: UpsertHoldingInput) {
  const session = await requireFamily();
  if (!db) throw new Error('DB unavailable');
  await ensureTodaySnapshot(session.user.familyId, session.user.id);

  let holdingId = input.id;
  if (holdingId) {
    await db
      .update(schema.holding)
      .set({
        category: input.category,
        name: input.name,
        currency: input.currency,
        quantity: input.quantity !== null && input.quantity !== undefined ? String(input.quantity) : null,
        ticker: input.ticker ?? null,
        notes: input.notes ?? null,
        isShared: input.isShared,
        ownerUserId: input.ownerUserId,
      })
      .where(and(eq(schema.holding.id, holdingId), eq(schema.holding.familyId, session.user.familyId)));
  } else {
    const [row] = await db
      .insert(schema.holding)
      .values({
        familyId: session.user.familyId,
        ownerUserId: input.ownerUserId,
        isShared: input.isShared,
        category: input.category,
        name: input.name,
        currency: input.currency,
        quantity: input.quantity !== null && input.quantity !== undefined ? String(input.quantity) : null,
        ticker: input.ticker ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    holdingId = row.id;
  }

  // Upsert today's holding_value
  const today = todayISO();
  await db
    .insert(schema.holdingValue)
    .values({ holdingId, date: today, value: String(input.value) })
    .onConflictDoUpdate({ target: [schema.holdingValue.holdingId, schema.holdingValue.date], set: { value: String(input.value) } });

  revalidatePath('/family');
  revalidatePath('/personal');
  revalidatePath('/holdings');
  return { ok: true as const, holdingId };
}

export async function deleteHolding(id: string) {
  const session = await requireFamily();
  if (!db) throw new Error('DB unavailable');
  await db
    .update(schema.holding)
    .set({ active: false })
    .where(and(eq(schema.holding.id, id), eq(schema.holding.familyId, session.user.familyId)));
  revalidatePath('/holdings');
  return { ok: true as const };
}

export async function recordHoldingValue(holdingId: string, date: string, value: number) {
  const session = await requireFamily();
  if (!db) throw new Error('DB unavailable');
  // ensure holding is in the user's family
  const [row] = await db.select().from(schema.holding).where(and(eq(schema.holding.id, holdingId), eq(schema.holding.familyId, session.user.familyId))).limit(1);
  if (!row) return { ok: false as const, error: 'Not found' };
  await ensureTodaySnapshot(session.user.familyId, session.user.id);
  await db
    .insert(schema.holdingValue)
    .values({ holdingId, date, value: String(value) })
    .onConflictDoUpdate({ target: [schema.holdingValue.holdingId, schema.holdingValue.date], set: { value: String(value) } });
  revalidatePath('/holdings');
  return { ok: true as const };
}
