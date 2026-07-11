import { requireFamily } from '@/auth/guards';
import { loadDashboard } from '@/db/queries';
import { DashboardShell } from '@/ui/DashboardShell';

export default async function FamilyPage() {
  const session = await requireFamily();
  const data = await loadDashboard(session.user.familyId, session.user.id, 'family');
  return <DashboardShell data={data} />;
}
