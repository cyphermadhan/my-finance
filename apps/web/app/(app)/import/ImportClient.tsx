'use client';

import { useRef, useState, useTransition } from 'react';
import { parseFile, type HoldingRow, type TransactionRow } from '@/ingest/parse';
import { formatInrCompact } from '@/util/format';

type ImportSummary = {
  transactions?: { inserted: number; duplicates: number; createdAccounts: number };
  holdings?: { inserted: number; valuesInserted: number };
};

type Props = {
  importTransactions: (rows: TransactionRow[]) => Promise<{ ok: true; summary: ImportSummary } | { ok: false; error: string }>;
  importHoldings: (rows: HoldingRow[]) => Promise<{ ok: true; summary: ImportSummary } | { ok: false; error: string }>;
};

type Parsed =
  | { kind: 'transactions'; rows: TransactionRow[] }
  | { kind: 'holdings'; rows: HoldingRow[] };

export function ImportClient({ importTransactions, importHoldings }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function onFile(f: File) {
    setError(null);
    setResult(null);
    const buf = await f.arrayBuffer();
    const p = parseFile(f.name, f.type, buf);
    if (!p.result.ok) {
      setError(p.result.error);
      setParsed(null);
      return;
    }
    if (p.kind === 'transactions') setParsed({ kind: 'transactions', rows: p.result.rows });
    else setParsed({ kind: 'holdings', rows: p.result.rows });
  }

  function commit() {
    if (!parsed) return;
    start(async () => {
      const res = parsed.kind === 'transactions' ? await importTransactions(parsed.rows) : await importHoldings(parsed.rows);
      if (!res.ok) return setError(res.error);
      const s = res.summary;
      if (s.transactions) setResult(`Imported ${s.transactions.inserted} transactions · ${s.transactions.duplicates} duplicates skipped · ${s.transactions.createdAccounts} new accounts created`);
      if (s.holdings) setResult(`Imported ${s.holdings.inserted} new holdings · ${s.holdings.valuesInserted} value points recorded`);
      setParsed(null);
    });
  }

  return (
    <section className="card">
      <div className="section-header">
        <h2>Upload file</h2>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      {error && <div className="error-msg" style={{ marginTop: 8 }}>{error}</div>}
      {result && <div className="success-msg" style={{ marginTop: 8 }}>{result}</div>}

      {parsed && (
        <>
          <div className="review-summary" style={{ marginTop: 16 }}>
            <span>Detected: <strong>{parsed.kind}</strong></span>
            <span>Rows: <strong>{parsed.rows.length}</strong></span>
            {parsed.kind === 'transactions' && (
              <span>Accounts referenced: <strong>{new Set(parsed.rows.map((r) => r.account_name)).size}</strong></span>
            )}
          </div>
          <div style={{ marginTop: 12, maxHeight: 320, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table className="table review-table">
              <thead>
                {parsed.kind === 'transactions' ? (
                  <tr><th>Date</th><th>Account</th><th>Description</th><th className="table__num">Amount</th><th>Category</th></tr>
                ) : (
                  <tr><th>Date</th><th>Category</th><th>Name</th><th className="table__num">Value</th><th>Shared</th></tr>
                )}
              </thead>
              <tbody>
                {parsed.kind === 'transactions'
                  ? parsed.rows.slice(0, 200).map((r, i) => (
                      <tr key={i}>
                        <td>{r.date}</td>
                        <td>{r.account_name}</td>
                        <td>{r.description}</td>
                        <td className="table__num" style={{ color: r.amount >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                          {formatInrCompact(r.amount)}
                        </td>
                        <td>{r.category ?? '—'}</td>
                      </tr>
                    ))
                  : parsed.rows.slice(0, 200).map((r, i) => (
                      <tr key={i}>
                        <td>{r.date}</td>
                        <td>{r.category}</td>
                        <td>{r.name}</td>
                        <td className="table__num">{formatInrCompact(r.currency === 'USD' ? r.value * 83.5 : r.value)}</td>
                        <td>{r.is_shared ? <span className="badge badge--shared">shared</span> : ''}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {parsed.rows.length > 200 && (
            <div className="footnote">Showing first 200 rows; full set will be imported.</div>
          )}
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="btn btn--primary" onClick={commit} disabled={pending}>{pending ? 'Importing…' : 'Confirm & import'}</button>
            <button className="btn" onClick={() => { setParsed(null); if (fileRef.current) fileRef.current.value = ''; }}>Cancel</button>
          </div>
        </>
      )}
    </section>
  );
}
