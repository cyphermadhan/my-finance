'use server';

import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { updateSession } from '@/auth/config';
import { requireMfa } from '@/auth/guards';
import { db, schema } from '@/db/client';
import type { FamilyMember } from '@/types';

function newInviteCode(): string {
  // 8-char base36 (~40 bits) — plenty for family scale; we also enforce uniqueness.
  return randomBytes(6).toString('base64url').slice(0, 10).toUpperCase();
}

export async function createFamily(name: string): Promise<{ ok: true; familyId: string } | { ok: false; error: string }> {
  const session = await requireMfa();
  const uid = session.user.id;
  if (!uid) return { ok: false, error: 'No user' };
  if (!db) return { ok: false, error: 'DB unavailable' };
  if (!name.trim()) return { ok: false, error: 'Name required' };

  // Guard: user must not already be in a family.
  const [existing] = await db.select().from(schema.familyMember).where(eq(schema.familyMember.userId, uid)).limit(1);
  if (existing) return { ok: false, error: 'You are already in a family.' };

  let inviteCode = newInviteCode();
  for (let i = 0; i < 5; i++) {
    const [dup] = await db.select().from(schema.family).where(eq(schema.family.inviteCode, inviteCode)).limit(1);
    if (!dup) break;
    inviteCode = newInviteCode();
  }

  const [fam] = await db.insert(schema.family).values({ name: name.trim(), inviteCode, createdBy: uid }).returning();
  await db.insert(schema.familyMember).values({ familyId: fam.id, userId: uid, isCreator: true });
  await updateSession({ familyId: fam.id } as never);
  return { ok: true, familyId: fam.id };
}

export async function joinFamily(code: string): Promise<{ ok: true; familyId: string } | { ok: false; error: string }> {
  const session = await requireMfa();
  const uid = session.user.id;
  if (!uid) return { ok: false, error: 'No user' };
  if (!db) return { ok: false, error: 'DB unavailable' };
  const clean = code.trim().toUpperCase();
  if (!clean) return { ok: false, error: 'Invite code required' };

  const [existing] = await db.select().from(schema.familyMember).where(eq(schema.familyMember.userId, uid)).limit(1);
  if (existing) return { ok: false, error: 'You are already in a family.' };

  const [fam] = await db.select().from(schema.family).where(eq(schema.family.inviteCode, clean)).limit(1);
  if (!fam) return { ok: false, error: 'Invalid invite code.' };

  await db.insert(schema.familyMember).values({ familyId: fam.id, userId: uid, isCreator: false });
  await updateSession({ familyId: fam.id } as never);
  return { ok: true, familyId: fam.id };
}

export async function rotateInviteCode(): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const session = await requireMfa();
  if (!session.user.familyId || !db) return { ok: false, error: 'No family' };
  let code = newInviteCode();
  for (let i = 0; i < 5; i++) {
    const [dup] = await db.select().from(schema.family).where(eq(schema.family.inviteCode, code)).limit(1);
    if (!dup) break;
    code = newInviteCode();
  }
  await db.update(schema.family).set({ inviteCode: code }).where(eq(schema.family.id, session.user.familyId));
  return { ok: true, code };
}

export async function listFamilyMembers(familyId: string): Promise<FamilyMember[]> {
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

export async function leaveFamily(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireMfa();
  if (!session.user.familyId || !session.user.id || !db) return { ok: false, error: 'No family' };
  await db
    .delete(schema.familyMember)
    .where(and(eq(schema.familyMember.familyId, session.user.familyId), eq(schema.familyMember.userId, session.user.id)));
  await updateSession({ familyId: null } as never);
  return { ok: true };
}
