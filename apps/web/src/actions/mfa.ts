'use server';

import { updateSession } from '@/auth/config';
import { requireSession } from '@/auth/guards';
import { enrollTotp, getUserMfaState, verifyTotp, consumeBackupCode, updateBackupCodes } from '@/auth/mfa';

export async function finalizeMfaEnroll(input: { secret: string; hashedBackupCodes: string[]; code: string }) {
  const session = await requireSession();
  const uid = session.user.id;
  if (!uid) return { ok: false as const, error: 'No user' };
  if (!verifyTotp(input.secret, input.code)) return { ok: false as const, error: 'Invalid code — try again.' };
  await enrollTotp(uid, input.secret, input.hashedBackupCodes);
  await updateSession({ mfaEnabled: true, mfaVerifiedAt: Math.floor(Date.now() / 1000) } as never);
  return { ok: true as const };
}

export async function verifyMfaChallenge(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const uid = session.user.id;
  if (!uid) return { ok: false, error: 'No user' };
  const state = await getUserMfaState(uid);
  if (!state.enabled || !state.secret) return { ok: false, error: 'MFA not enrolled.' };

  const trimmed = code.trim();
  if (verifyTotp(state.secret, trimmed)) {
    await updateSession({ mfaVerifiedAt: Math.floor(Date.now() / 1000) } as never);
    return { ok: true };
  }
  // fall back to backup code
  const consumed = consumeBackupCode(state.backup, trimmed);
  if (consumed !== null) {
    await updateBackupCodes(uid, consumed);
    await updateSession({ mfaVerifiedAt: Math.floor(Date.now() / 1000) } as never);
    return { ok: true };
  }
  return { ok: false, error: 'Invalid code.' };
}
