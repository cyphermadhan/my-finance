import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  numeric,
  date,
  primaryKey,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';

// --- Enums ---
export const accountTypeEnum = pgEnum('account_type', ['bank', 'credit_card', 'wallet']);
export const currencyEnum = pgEnum('currency', ['INR', 'USD']);
export const scopeEnum = pgEnum('goal_scope', ['personal', 'family']);
export const categoryEnum = pgEnum('category', [
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
]);

// --- Users ---
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  googleSub: text('google_sub').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  totpSecret: text('totp_secret'), // base32
  totpEnabledAt: timestamp('totp_enabled_at'),
  backupCodesHash: text('backup_codes_hash'), // JSON string of hashed codes
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Family (household) ---
export const family = pgTable('family', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  inviteCode: text('invite_code').notNull().unique(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const familyMember = pgTable(
  'family_member',
  {
    familyId: uuid('family_id').notNull().references(() => family.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    isCreator: boolean('is_creator').default(false).notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.familyId, t.userId] }),
    userIdx: index('family_member_user_idx').on(t.userId),
  })
);

// --- Accounts (transactional: bank/credit-card/wallet) ---
export const account = pgTable(
  'account',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familyId: uuid('family_id').notNull().references(() => family.id, { onDelete: 'cascade' }),
    ownerUserId: uuid('owner_user_id').notNull().references(() => users.id),
    isShared: boolean('is_shared').default(false).notNull(),
    institution: text('institution').notNull(),
    name: text('name').notNull(),
    type: accountTypeEnum('type').notNull(),
    currency: currencyEnum('currency').notNull().default('INR'),
    active: boolean('active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    familyIdx: index('account_family_idx').on(t.familyId),
    familyNameIdx: uniqueIndex('account_family_name_idx').on(t.familyId, t.name),
  })
);

// --- Transactions (per account) ---
export const transaction = pgTable(
  'transaction',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id').notNull().references(() => account.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    description: text('description').notNull(),
    amount: numeric('amount', { precision: 20, scale: 2 }).notNull(),
    category: text('category'),
    runningBalance: numeric('running_balance', { precision: 20, scale: 2 }),
    externalId: text('external_id'),
    importedFrom: text('imported_from'), // e.g. filename
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    accountDateIdx: index('transaction_account_date_idx').on(t.accountId, t.date),
    externalIdx: uniqueIndex('transaction_external_idx').on(t.accountId, t.externalId),
  })
);

// --- Holdings (valuation-only) ---
export const holding = pgTable(
  'holding',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familyId: uuid('family_id').notNull().references(() => family.id, { onDelete: 'cascade' }),
    ownerUserId: uuid('owner_user_id').notNull().references(() => users.id),
    isShared: boolean('is_shared').default(false).notNull(),
    category: categoryEnum('category').notNull(),
    name: text('name').notNull(),
    ticker: text('ticker'),
    quantity: numeric('quantity', { precision: 20, scale: 8 }),
    currency: currencyEnum('currency').notNull().default('INR'),
    notes: text('notes'),
    active: boolean('active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    familyIdx: index('holding_family_idx').on(t.familyId),
  })
);

// One row per (holding, snapshot date) capturing that day's value in the holding's currency.
export const holdingValue = pgTable(
  'holding_value',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    holdingId: uuid('holding_id').notNull().references(() => holding.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    value: numeric('value', { precision: 20, scale: 2 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    holdingDateIdx: uniqueIndex('holding_value_holding_date_idx').on(t.holdingId, t.date),
  })
);

// --- Snapshots (metadata; one per family per date) ---
export const snapshot = pgTable(
  'snapshot',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familyId: uuid('family_id').notNull().references(() => family.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    note: text('note'),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    familyDateIdx: uniqueIndex('snapshot_family_date_idx').on(t.familyId, t.date),
  })
);

// --- Account balances (per snapshot) ---
export const accountBalance = pgTable(
  'account_balance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    snapshotId: uuid('snapshot_id').notNull().references(() => snapshot.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id').notNull().references(() => account.id, { onDelete: 'cascade' }),
    balance: numeric('balance', { precision: 20, scale: 2 }).notNull(),
  },
  (t) => ({
    snapshotAccountIdx: uniqueIndex('account_balance_snapshot_account_idx').on(t.snapshotId, t.accountId),
  })
);

// --- FX per snapshot ---
export const snapshotFx = pgTable('snapshot_fx', {
  snapshotId: uuid('snapshot_id')
    .primaryKey()
    .references(() => snapshot.id, { onDelete: 'cascade' }),
  usdInr: numeric('usd_inr', { precision: 10, scale: 4 }).notNull(),
});

// --- Goals ---
export const goal = pgTable('goal', {
  id: uuid('id').primaryKey().defaultRandom(),
  familyId: uuid('family_id').notNull().references(() => family.id, { onDelete: 'cascade' }),
  scope: scopeEnum('scope').notNull().default('family'),
  ownerUserId: uuid('owner_user_id').references(() => users.id),
  name: text('name').notNull(),
  targetInr: numeric('target_inr', { precision: 20, scale: 2 }).notNull(),
  targetDate: date('target_date'),
  includeCategories: text('include_categories').array().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Session/mfa staging (used to persist mfa-verified across requests server-side; JWT-only alt is possible) ---
// We use JWT session, so no session table needed. Auth.js manages via cookies.

// --- Types (inferred) ---
export type UserRow = typeof users.$inferSelect;
export type FamilyRow = typeof family.$inferSelect;
export type AccountRow = typeof account.$inferSelect;
export type TransactionRow = typeof transaction.$inferSelect;
export type HoldingRow = typeof holding.$inferSelect;
export type HoldingValueRow = typeof holdingValue.$inferSelect;
export type GoalRow = typeof goal.$inferSelect;
export type SnapshotRow = typeof snapshot.$inferSelect;

// Little-known bit: numeric() returns string in drizzle. Convert with Number() at the boundary.
export const toNum = (v: string | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));
