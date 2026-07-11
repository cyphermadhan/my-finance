import { requireFamily } from '@/auth/guards';
import { loadDashboard } from '@/db/queries';
import { DashboardShell } from '@/ui/DashboardShell';

export default async function PersonalPage() {
  const session = await requireFamily();
  const data = await loadDashboard(session.user.familyId, session.user.id, 'personal');
  return <DashboardShell data={data} />;
}
