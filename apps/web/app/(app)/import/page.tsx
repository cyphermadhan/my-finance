import { requireFamily } from '@/auth/guards';
import { ImportClient } from './ImportClient';
import { importHoldings, importTransactions } from '@/actions/import';

export default async function ImportPage() {
  await requireFamily();
  return (
    <div className="app">
      <section className="card">
        <div className="section-header">
          <h2>Import</h2>
          <span className="section-header__meta">CSV or XLSX matching the canonical template</span>
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>
          Grab your bank/broker statement, ask any AI (Claude, ChatGPT, etc.) to fit it into one of the templates below, then upload the result.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <a className="btn" href="/api/template/transactions">Download transactions template</a>
          <a className="btn" href="/api/template/holdings">Download holdings template</a>
        </div>
      </section>
      <ImportClient importTransactions={importTransactions} importHoldings={importHoldings} />
    </div>
  );
}
