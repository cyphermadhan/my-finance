import { requireFamily } from '@/auth/guards';
import { getAccountsWithLatestBalance, getFamilyMembers, getRecentTransactions } from '@/db/queries';
import { AccountsClient } from './AccountsClient';
import { upsertAccount, deleteAccount, setAccountBalance } from '@/actions/accounts';
import { addTransaction, deleteTransaction } from '@/actions/transactions';

export default async function AccountsPage() {
  const session = await requireFamily();
  const [accounts, members, recent] = await Promise.all([
    getAccountsWithLatestBalance(session.user.familyId),
    getFamilyMembers(session.user.familyId),
    getRecentTransactions(session.user.familyId, { limit: 50 }),
  ]);
  return (
    <AccountsClient
      viewerUserId={session.user.id}
      accounts={accounts}
      members={members}
      recent={recent}
      upsertAccount={upsertAccount}
      deleteAccount={deleteAccount}
      setBalance={setAccountBalance}
      addTransaction={addTransaction}
      deleteTransaction={deleteTransaction}
    />
  );
}
