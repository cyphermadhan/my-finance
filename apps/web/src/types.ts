export const CATEGORIES = [
  'cash',
  'fd_rd',
  'ppf',
  'epf',
  'nps',
  'mutual_funds',
  'indian_stocks',
  'us_stocks',
  'bonds',
  'gold',
  'silver',
  'crypto',
  'real_estate',
  'custom',
  'liability',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  cash: 'Cash',
  fd_rd: 'FD / RD',
  ppf: 'PPF',
  epf: 'EPF',
  nps: 'NPS',
  mutual_funds: 'Mutual Funds',
  indian_stocks: 'Indian Stocks',
  us_stocks: 'US Stocks',
  bonds: 'Bonds',
  gold: 'Gold',
  silver: 'Silver',
  crypto: 'Crypto',
  real_estate: 'Real Estate',
  custom: 'Custom',
  liability: 'Liability',
};

export type Currency = 'INR' | 'USD';

/** Bank/wallet accounts have transactions. Distinct from Holding. */
export type AccountType = 'bank' | 'credit_card' | 'wallet';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: 'Bank',
  credit_card: 'Credit Card',
  wallet: 'Wallet',
};

export type Scope = 'family' | 'personal';

/** In-app representation of a Holding (investment-style asset). */
export type Holding = {
  id: string;
  familyId: string;
  ownerUserId: string;
  isShared: boolean;
  category: Category;
  name: string;
  currency: Currency;
  quantity?: number | null;
  ticker?: string | null;
  notes?: string | null;
  /** latest known value; kept denormalised for quick reads */
  latestValue: number;
  latestValueDate?: string | null;
};

/** In-app representation of an Account (transactional). */
export type Account = {
  id: string;
  familyId: string;
  ownerUserId: string;
  isShared: boolean;
  institution: string;
  name: string;
  type: AccountType;
  currency: Currency;
  latestBalance: number;
  latestBalanceDate?: string | null;
};

/** A single bank transaction. */
export type Transaction = {
  id: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  category?: string | null;
  runningBalance?: number | null;
  externalId?: string | null;
};

/** A "state as-of a date" record. */
export type Snapshot = {
  id: string;
  familyId: string;
  date: string;
  note?: string | null;
};

export type Goal = {
  id: string;
  familyId: string;
  scope: Scope;
  ownerUserId?: string | null;
  name: string;
  targetInr: number;
  targetDate?: string | null;
  includeCategories: Category[];
};

export type FamilyMember = {
  userId: string;
  email: string;
  name: string;
  image?: string | null;
  isCreator: boolean;
};

/** A hydrated dashboard state for rendering. */
export type DashboardData = {
  scope: Scope;
  viewerUserId: string;
  familyId: string;
  familyMembers: FamilyMember[];
  memberCount: number;
  holdings: Holding[];
  accounts: Account[];
  goals: Goal[];
  historicalNetWorth: Array<{ date: string; value: number }>;
  latestFx: { usdInr: number };
};

export const DEFAULT_FX_USD_INR = 83.5;
