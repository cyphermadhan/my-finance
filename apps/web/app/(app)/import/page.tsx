import { Download } from 'react-feather';
import { requireFamily } from '@/auth/guards';
import { ImportClient } from './ImportClient';
import { importHoldings, importTransactions } from '@/actions/import';

export default async function ImportPage() {
  await requireFamily();
  return (
    <div className="app">
      <section className="card">
        <div className="section-header">
          <h2><Download size={16} /> Import</h2>
          <span className="section-header__meta">CSV or XLSX matching the canonical template</span>
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>
          Download the holdings template, ask any AI (Claude, ChatGPT, etc.) to fit your share / mutual-fund / other holdings statement into it, then upload the result.
        </p>
        <div style={{ marginTop: 12, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-alt)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Column guide</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <li>
              <b style={{ color: 'var(--text-primary)' }}>date</b> — the statement&rsquo;s <b>&ldquo;as of&rdquo; date</b> (e.g. 2024-03-31): the date these values are true. <b>Not the purchase date.</b> Your yearly statement&rsquo;s own date is exactly this — import one per period and your net-worth history is built from these dates.
            </li>
            <li><b style={{ color: 'var(--text-primary)' }}>category</b> — e.g. mutual_funds, indian_stocks, us_stocks, gold, real_estate, cash…</li>
            <li><b style={{ color: 'var(--text-primary)' }}>name</b> — the holding&rsquo;s name</li>
            <li><b style={{ color: 'var(--text-primary)' }}>currency</b> — INR or USD</li>
            <li><b style={{ color: 'var(--text-primary)' }}>value</b> — the holding&rsquo;s value on that date, in its currency</li>
            <li><b style={{ color: 'var(--text-primary)' }}>quantity</b> — optional (units / grams / shares, per category)</li>
            <li><b style={{ color: 'var(--text-primary)' }}>is_shared</b> — true / false</li>
          </ul>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <a className="btn" href="/api/template/holdings"><Download size={15} /> Download holdings template</a>
        </div>
      </section>
      <ImportClient importTransactions={importTransactions} importHoldings={importHoldings} />
    </div>
  );
}
