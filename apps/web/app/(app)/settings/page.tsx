import { requireFamily } from '@/auth/guards';
import { db, schema } from '@/db/client';
import { eq } from 'drizzle-orm';
import { getFamilyMembers } from '@/db/queries';
import { SettingsClient } from './SettingsClient';
import { leaveFamily, rotateInviteCode } from '@/actions/family';

export default async function SettingsPage() {
  const session = await requireFamily();
  let family: { id: string; name: string; inviteCode: string } | null = null;
  if (db) {
    const [row] = await db.select().from(schema.family).where(eq(schema.family.id, session.user.familyId));
    if (row) family = { id: row.id, name: row.name, inviteCode: row.inviteCode };
  }
  const members = await getFamilyMembers(session.user.familyId);
  return (
    <SettingsClient
      family={family}
      members={members}
      viewerUserId={session.user.id}
      viewerEmail={session.user.email}
      rotateInviteCode={rotateInviteCode}
      leaveFamily={leaveFamily}
    />
  );
}
