import { redirect } from 'next/navigation';
import { auth } from './config';

export async function requireSession() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return session;
}

export async function requireMfa() {
  const session = await requireSession();
  if (!session.user.mfaVerified) redirect('/mfa-challenge');
  return session;
}

export async function requireFamily() {
  const session = await requireMfa();
  if (!session.user.familyId) redirect('/onboarding');
  return session as typeof session & { user: { familyId: string } };
}
