import { requireMfa } from '@/auth/guards';
import { redirect } from 'next/navigation';
import { OnboardingForm } from './OnboardingForm';
import { createFamily, joinFamily } from '@/actions/family';

export default async function OnboardingPage() {
  const session = await requireMfa();
  if (session.user.familyId) redirect('/');
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">My Finance</div>
        <h1>Set up your family</h1>
        <p>Create a new family workspace, or join one someone else created with the invite code they gave you.</p>
        <OnboardingForm create={createFamily} join={joinFamily} />
      </div>
    </main>
  );
}
