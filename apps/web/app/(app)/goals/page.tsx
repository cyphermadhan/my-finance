import { requireFamily } from '@/auth/guards';
import { getGoals, getFamilyMembers } from '@/db/queries';
import { GoalsClient } from './GoalsClient';
import { upsertGoal, deleteGoal } from '@/actions/goals';

export default async function GoalsPage() {
  const session = await requireFamily();
  const [goals, members] = await Promise.all([
    getGoals(session.user.familyId),
    getFamilyMembers(session.user.familyId),
  ]);
  return <GoalsClient viewerUserId={session.user.id} goals={goals} members={members} upsertGoal={upsertGoal} deleteGoal={deleteGoal} />;
}
