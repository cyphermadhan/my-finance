export const TRANSACTIONS_TEMPLATE_HEADER = [
  'account_name',
  'date',
  'description',
  'amount',
  'currency',
  'category',
  'running_balance',
  'external_id',
] as const;

export const HOLDINGS_TEMPLATE_HEADER = [
  'date',
  'category',
  'name',
  'currency',
  'value',
  'quantity',
  'notes',
  'is_shared',
] as const;

// Header row + one empty row — no dummy data.
export const TRANSACTIONS_TEMPLATE_SAMPLE = `${TRANSACTIONS_TEMPLATE_HEADER.join(',')}
${TRANSACTIONS_TEMPLATE_HEADER.map(() => '').join(',')}
`;

export const HOLDINGS_TEMPLATE_SAMPLE = `${HOLDINGS_TEMPLATE_HEADER.join(',')}
${HOLDINGS_TEMPLATE_HEADER.map(() => '').join(',')}
`;

export type TemplateKind = 'transactions' | 'holdings';

export function templateForKind(kind: TemplateKind): string {
  return kind === 'transactions' ? TRANSACTIONS_TEMPLATE_SAMPLE : HOLDINGS_TEMPLATE_SAMPLE;
}
