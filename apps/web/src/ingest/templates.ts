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
  'ticker',
  'notes',
  'is_shared',
  'owner_email',
] as const;

export const TRANSACTIONS_TEMPLATE_SAMPLE = `account_name,date,description,amount,currency,category,running_balance,external_id
HDFC Savings,2026-01-05,Salary Jan,150000,INR,Income,650000,SAL-2026-01
HDFC Savings,2026-01-08,Amazon.in,-3200,INR,Shopping,646800,AMZN-2026-01-08
HDFC Savings,2026-01-10,Electricity bill,-2100,INR,Utilities,644700,BSES-01
`;

export const HOLDINGS_TEMPLATE_SAMPLE = `date,category,name,currency,value,quantity,ticker,notes,is_shared,owner_email
2026-01-01,mutual_funds,Parag Parikh Flexi Cap,INR,480000,,122639,,false,you@example.com
2026-01-01,indian_stocks,Reliance,INR,145000,50,RELIANCE.NS,,false,you@example.com
2026-01-01,real_estate,Family apartment,INR,9500000,,,,true,you@example.com
2026-01-01,gold,SGB,INR,240000,40,,,false,partner@example.com
`;

export type TemplateKind = 'transactions' | 'holdings';

export function templateForKind(kind: TemplateKind): string {
  return kind === 'transactions' ? TRANSACTIONS_TEMPLATE_SAMPLE : HOLDINGS_TEMPLATE_SAMPLE;
}
