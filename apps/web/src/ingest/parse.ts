import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { CATEGORIES, type Category, type Currency } from '@/types';

const CATEGORY_SET = new Set<string>(CATEGORIES);

export type TransactionRow = {
  account_name: string;
  date: string;
  description: string;
  amount: number;
  currency: Currency;
  category?: string;
  running_balance?: number;
  external_id?: string;
};

export type HoldingRow = {
  date: string;
  category: Category;
  name: string;
  currency: Currency;
  value: number;
  quantity?: number;
  ticker?: string;
  notes?: string;
  is_shared: boolean;
  owner_email: string;
};

export type ParseResult<T> = { ok: true; rows: T[]; skipped: number } | { ok: false; error: string };

/** Detect kind by columns present. */
function normaliseKey(k: string): string {
  return k.trim().toLowerCase().replace(/\s+/g, '_');
}

function readAsRecords(input: ArrayBuffer, mime: string): Record<string, string>[] {
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('officedocument')) {
    const wb = XLSX.read(input, { type: 'array', cellDates: false, cellNF: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '', raw: false });
    // normalise keys
    return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [normaliseKey(k), String(v ?? '').trim()])));
  }
  // CSV/TSV
  const text = new TextDecoder('utf-8').decode(input);
  const parsed = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normaliseKey(h),
  });
  if (parsed.errors.length > 0) {
    throw new Error(`Parse error: ${parsed.errors[0].message}`);
  }
  return parsed.data;
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function num(v: string | number | undefined | null): number {
  if (v === undefined || v === null || v === '') return NaN;
  return Number(String(v).replace(/,/g, ''));
}

export function parseFile(name: string, mime: string, buffer: ArrayBuffer): { kind: 'transactions'; result: ParseResult<TransactionRow> } | { kind: 'holdings'; result: ParseResult<HoldingRow> } {
  let records: Record<string, string>[];
  try {
    records = readAsRecords(buffer, mime || nameToMime(name));
  } catch (e) {
    return { kind: 'transactions', result: { ok: false, error: (e as Error).message } };
  }
  if (records.length === 0) return { kind: 'transactions', result: { ok: false, error: 'No rows found.' } };

  const cols = new Set(Object.keys(records[0] ?? {}));
  if (cols.has('account_name') && cols.has('amount')) {
    return { kind: 'transactions', result: parseTransactions(records) };
  }
  if (cols.has('value') && cols.has('is_shared')) {
    return { kind: 'holdings', result: parseHoldings(records) };
  }
  return { kind: 'transactions', result: { ok: false, error: 'Could not detect template. Expected columns of transactions or holdings template.' } };
}

function nameToMime(n: string): string {
  const l = n.toLowerCase();
  if (l.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (l.endsWith('.xls')) return 'application/vnd.ms-excel';
  return 'text/csv';
}

function parseTransactions(records: Record<string, string>[]): ParseResult<TransactionRow> {
  const rows: TransactionRow[] = [];
  let skipped = 0;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const account_name = (r.account_name ?? '').trim();
    if (!account_name) { skipped++; continue; }
    const date = (r.date ?? '').trim();
    if (!isValidDate(date)) return { ok: false, error: `Row ${i + 2}: bad date "${date}".` };
    const description = (r.description ?? '').trim();
    if (!description) return { ok: false, error: `Row ${i + 2}: description required.` };
    const amount = num(r.amount);
    if (Number.isNaN(amount)) return { ok: false, error: `Row ${i + 2}: amount is not a number.` };
    const currency: Currency = (r.currency ?? 'INR').toUpperCase() === 'USD' ? 'USD' : 'INR';
    const category = r.category?.trim() || undefined;
    const running_balance = r.running_balance ? num(r.running_balance) : undefined;
    if (running_balance !== undefined && Number.isNaN(running_balance)) return { ok: false, error: `Row ${i + 2}: running_balance is not a number.` };
    const external_id = r.external_id?.trim() || undefined;
    rows.push({ account_name, date, description, amount, currency, category, running_balance, external_id });
  }
  return { ok: true, rows, skipped };
}

function parseHoldings(records: Record<string, string>[]): ParseResult<HoldingRow> {
  const rows: HoldingRow[] = [];
  let skipped = 0;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const date = (r.date ?? '').trim();
    if (!isValidDate(date)) return { ok: false, error: `Row ${i + 2}: bad date "${date}".` };
    const rawCat = (r.category ?? '').trim().toLowerCase();
    const category: Category = CATEGORY_SET.has(rawCat) ? (rawCat as Category) : 'custom';
    const name = (r.name ?? '').trim();
    if (!name) { skipped++; continue; }
    const currency: Currency = (r.currency ?? 'INR').toUpperCase() === 'USD' ? 'USD' : 'INR';
    const value = num(r.value);
    if (Number.isNaN(value)) return { ok: false, error: `Row ${i + 2}: value is not a number.` };
    const quantity = r.quantity ? num(r.quantity) : undefined;
    if (quantity !== undefined && Number.isNaN(quantity)) return { ok: false, error: `Row ${i + 2}: quantity is not a number.` };
    const ticker = r.ticker?.trim() || undefined;
    const notes = r.notes?.trim() || undefined;
    const isShared = ['true', '1', 'yes'].includes((r.is_shared ?? 'false').toLowerCase());
    const owner_email = (r.owner_email ?? '').trim();
    if (!owner_email) return { ok: false, error: `Row ${i + 2}: owner_email required.` };
    rows.push({ date, category, name, currency, value, quantity, ticker, notes, is_shared: isShared, owner_email });
  }
  return { ok: true, rows, skipped };
}
