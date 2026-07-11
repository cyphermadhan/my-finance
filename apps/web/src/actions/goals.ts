'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireFamily } from '@/auth/guards';
import { db, schema } from '@/db/client';
import type { Category, Scope } from '@/types';

type UpsertGoalInput = {
  id?: string;
  scope: Scope;
  ownerUserId?: string | null;
  name: string;
  targetInr: number;
  targetDate?: string | null;
  includeCategories: Category[];
};

export async function upsertGoal(input: UpsertGoalInput) {
  const session = await requireFamily();
  if (!db) throw new Error('DB unavailable');
  const values = {
    scope: input.scope,
    ownerUserId: input.scope === 'personal' ? input.ownerUserId ?? session.user.id : null,
    name: input.name,
    targetInr: String(input.targetInr),
    targetDate: input.targetDate ?? null,
    includeCategories: input.includeCategories,
  };
  if (input.id) {
    await db
      .update(schema.goal)
      .set(values)
      .where(and(eq(schema.goal.id, input.id), eq(schema.goal.familyId, session.user.familyId)));
    revalidatePath('/goals');
    return { ok: true as const, id: input.id };
  }
  const [row] = await db.insert(schema.goal).values({ ...values, familyId: session.user.familyId }).returning();
  revalidatePath('/goals');
  return { ok: true as const, id: row.id };
}

export async function deleteGoal(id: string) {
  const session = await requireFamily();
  if (!db) throw new Error('DB unavailable');
  await db.delete(schema.goal).where(and(eq(schema.goal.id, id), eq(schema.goal.familyId, session.user.familyId)));
  revalidatePath('/goals');
  return { ok: true as const };
}
