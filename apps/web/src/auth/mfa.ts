import { authenticator } from 'otplib';
import { createHash, randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import { db, schema } from '@/db/client';
import { eq } from 'drizzle-orm';

authenticator.options = { window: 1, step: 30 };

const ISSUER = 'Wealth';

export function generateSecret(): string {
  return authenticator.generateSecret();
}

export function makeOtpAuthUrl(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export async function makeQrDataUrl(otpAuthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUrl, { errorCorrectionLevel: 'M', margin: 1, width: 240 });
}

export function verifyTotp(secret: string, token: string): boolean {
  try {
    return authenticator.check(token, secret);
  } catch {
    return false;
  }
}

// --- Backup codes ---
export function generateBackupCodes(count = 8): { plain: string[]; hashed: string[] } {
  const plain: string[] = [];
  const hashed: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = randomBytes(5).toString('hex'); // 10 chars
    const formatted = `${raw.slice(0, 5)}-${raw.slice(5)}`;
    plain.push(formatted);
    hashed.push(hashOne(formatted));
  }
  return { plain, hashed };
}

function hashOne(code: string): string {
  return createHash('sha256').update(code.trim().toLowerCase()).digest('hex');
}

/** Checks a backup code, and if valid, returns the mutated hashed-list (with used code removed). Returns null if invalid. */
export function consumeBackupCode(storedJson: string | null, submitted: string): string[] | null {
  if (!storedJson) return null;
  let list: string[];
  try {
    list = JSON.parse(storedJson) as string[];
  } catch {
    return null;
  }
  const h = hashOne(submitted);
  const idx = list.indexOf(h);
  if (idx < 0) return null;
  list.splice(idx, 1);
  return list;
}

/** Ensures the current user's TOTP is set up in the DB. If secret param provided, adopts it (used at enrolment). */
export async function enrollTotp(userId: string, secret: string, backupCodesHashed: string[]): Promise<void> {
  if (!db) throw new Error('DB unavailable');
  await db
    .update(schema.users)
    .set({
      totpSecret: secret,
      totpEnabledAt: new Date(),
      backupCodesHash: JSON.stringify(backupCodesHashed),
    })
    .where(eq(schema.users.id, userId));
}

export async function getUserMfaState(userId: string): Promise<{ secret: string | null; backup: string | null; enabled: boolean }> {
  if (!db) return { secret: null, backup: null, enabled: false };
  const [row] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  return {
    secret: row?.totpSecret ?? null,
    backup: row?.backupCodesHash ?? null,
    enabled: !!row?.totpEnabledAt,
  };
}

export async function updateBackupCodes(userId: string, newList: string[]): Promise<void> {
  if (!db) return;
  await db.update(schema.users).set({ backupCodesHash: JSON.stringify(newList) }).where(eq(schema.users.id, userId));
}
