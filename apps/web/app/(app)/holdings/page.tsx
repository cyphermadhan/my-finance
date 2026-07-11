import { requireFamily } from '@/auth/guards';
import { getHoldingsWithLatestValue, getFamilyMembers, getLatestFx } from '@/db/queries';
import { HoldingsClient } from './HoldingsClient';
import { upsertHolding, deleteHolding } from '@/actions/holdings';

export default async function HoldingsPage() {
  const session = await requireFamily();
  const [holdings, members, fx] = await Promise.all([
    getHoldingsWithLatestValue(session.user.familyId),
    getFamilyMembers(session.user.familyId),
    getLatestFx(session.user.familyId),
  ]);
  return (
    <HoldingsClient
      viewerUserId={session.user.id}
      holdings={holdings}
      members={members}
      usdInr={fx.usdInr}
      upsertHolding={upsertHolding}
      deleteHolding={deleteHolding}
    />
  );
}
