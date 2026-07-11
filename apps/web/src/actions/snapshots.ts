'use server';

import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { todayISO } from '@/util/format';
import { DEFAULT_FX_USD_INR } from '@/types';

/** Return today's snapshot for family, creating it (with copy-forward of latest fx) if missing. */
export async function ensureTodaySnapshot(familyId: string, userId: string): Promise<{ id: string; date: string }> {
  if (!db) throw new Error('DB unavailable');
  const today = todayISO();
  const [existing] = await db
    .select()
    .from(schema.snapshot)
    .where(and(eq(schema.snapshot.familyId, familyId), eq(schema.snapshot.date, today)))
    .limit(1);
  if (existing) return { id: existing.id, date: existing.date };

  const [snap] = await db.insert(schema.snapshot).values({ familyId, date: today, createdBy: userId }).returning();

  // Copy-forward FX from previous snapshot if any
  const [prev] = await db
    .select({ usdInr: schema.snapshotFx.usdInr })
    .from(schema.snapshotFx)
    .innerJoin(schema.snapshot, eq(schema.snapshot.id, schema.snapshotFx.snapshotId))
    .where(eq(schema.snapshot.familyId, familyId))
    .orderBy(desc(schema.snapshot.date))
    .limit(1);
  const usdInr = prev ? String(prev.usdInr) : String(DEFAULT_FX_USD_INR);
  await db.insert(schema.snapshotFx).values({ snapshotId: snap.id, usdInr });
  return { id: snap.id, date: snap.date };
}

export async function setFxToday(familyId: string, userId: string, usdInr: number): Promise<void> {
  if (!db) throw new Error('DB unavailable');
  const s = await ensureTodaySnapshot(familyId, userId);
  const [existing] = await db.select().from(schema.snapshotFx).where(eq(schema.snapshotFx.snapshotId, s.id)).limit(1);
  if (existing) {
    await db.update(schema.snapshotFx).set({ usdInr: String(usdInr) }).where(eq(schema.snapshotFx.snapshotId, s.id));
  } else {
    await db.insert(schema.snapshotFx).values({ snapshotId: s.id, usdInr: String(usdInr) });
  }
}
