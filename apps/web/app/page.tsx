import { redirect } from 'next/navigation';
import { auth } from '@/auth/config';

export default async function Root() {
  const session = await auth();
  if (!session) redirect('/login');
  if (!session.user?.mfaVerified) redirect('/mfa-challenge');
  if (!session.user?.familyId) redirect('/onboarding');
  redirect('/family');
}
