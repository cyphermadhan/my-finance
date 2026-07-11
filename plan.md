# My Finance — v2 (Family Wealth Platform)

## Context

v1 shipped as a single-user, local-first Vite SPA with encrypted-blob cloud sync. v2 changes the audience: this is now a **family** wealth platform. Multiple household members sign in with Google, complete 2FA, and see both a **shared family dashboard** and their own **personal dashboard**. Historical data comes from CSV/XLS statements the user normalises against a template. Custom manual entries and daily price refresh (from v1) carry forward. Hosted on the user's own domain.

## What changes vs v1

| Area | v1 | v2 |
|---|---|---|
| Users | 1 | Family (invite-based) |
| Auth | Passphrase | Google OAuth + TOTP 2FA |
| Storage | localStorage + optional Supabase | Neon Postgres |
| Framework | Vite SPA | **Next.js 14 (App Router)** |
| Encryption at rest | E2E via passphrase | Dropped — Postgres + app-enforced ownership + strong auth |
| Data model | Balance snapshots only | **Accounts (transactional) + Holdings (valued) + Snapshots** |
| Ingestion | Free-form CSV | Downloadable canonical templates → upload |
| Hosting | Local | Railway (app) + Cloudflare (DNS + price proxy Worker) |

## Stack v2

- **Next.js 14** (App Router, Server Actions, Route Handlers)
- **Auth.js v5** (NextAuth) — Google provider + TOTP challenge on each session
- **Neon** (serverless Postgres) via `@neondatabase/serverless`
- **Drizzle ORM** — schema, migrations, queries
- **otplib** — TOTP
- **papaparse** — CSV; **xlsx** — XLS
- **Recharts** — charts (reused)
- **date-fns**, **uuid** (reused)
- **Cloudflare Worker** (price proxy from v1) — kept
- **Railway** — app hosting; **Cloudflare DNS** — points the custom domain

Styling stays as the current CSS-variable + light/dark tokens. No UI kit — cheap to keep.

## Reuse from v1

Everything under `apps/web/src/analytics/*`, `apps/web/src/util/format.ts`, `apps/web/src/types.ts` (extended), `apps/web/src/data/csvParser.ts` (extended for xlsx + templates), styles, seed generator, price client, proxy Worker. Roughly ~50% of the code carries over verbatim; only the shell, state store, and mutation flows change.

## Repo layout (post-migration)

```
my-finance/
├── apps/
│   ├── web/                   # Next.js 14 App Router (replaces Vite SPA)
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── mfa-challenge/page.tsx
│   │   │   ├── (app)/
│   │   │   │   ├── family/page.tsx           # family dashboard
│   │   │   │   ├── personal/page.tsx         # personal dashboard
│   │   │   │   ├── accounts/page.tsx         # bank/credit-card accounts + transactions
│   │   │   │   ├── holdings/page.tsx         # investments + custom + shared
│   │   │   │   ├── goals/page.tsx
│   │   │   │   ├── import/page.tsx           # upload CSV/XLS statements
│   │   │   │   └── settings/page.tsx         # profile, 2FA, invites, family members
│   │   │   ├── api/
│   │   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   │   ├── mfa/verify/route.ts
│   │   │   │   ├── mfa/enroll/route.ts
│   │   │   │   └── template/[kind]/route.ts  # /transactions.csv, /holdings.csv
│   │   │   ├── layout.tsx
│   │   │   └── middleware.ts                 # gate app routes on session + mfa
│   │   ├── src/
│   │   │   ├── db/
│   │   │   │   ├── client.ts                 # neon serverless driver + drizzle
│   │   │   │   ├── schema.ts                 # drizzle schema
│   │   │   │   └── queries.ts                # reusable query fns per entity
│   │   │   ├── auth/
│   │   │   │   ├── config.ts                 # authOptions
│   │   │   │   ├── mfa.ts                    # totp enroll/verify/reset
│   │   │   │   └── guards.ts                 # requireSession + requireFamily + requireMfa
│   │   │   ├── actions/                      # server actions
│   │   │   │   ├── holdings.ts
│   │   │   │   ├── accounts.ts
│   │   │   │   ├── transactions.ts
│   │   │   │   ├── goals.ts
│   │   │   │   ├── family.ts
│   │   │   │   └── snapshots.ts
│   │   │   ├── ingest/
│   │   │   │   ├── templates.ts              # canonical column defs
│   │   │   │   ├── parseCsv.ts               # papaparse wrapper
│   │   │   │   ├── parseXlsx.ts              # sheetjs wrapper
│   │   │   │   └── review.ts                 # normalise + dedupe against existing
│   │   │   ├── analytics/…                   # ported unchanged
│   │   │   ├── prices/…                      # ported from v1
│   │   │   ├── util/format.ts                # ported
│   │   │   ├── types.ts                      # extended
│   │   │   └── ui/…                          # Hero, Charts, Table, etc. — ported + adapted
│   │   ├── drizzle/                          # generated SQL migrations
│   │   ├── next.config.js
│   │   └── package.json
│   └── proxy/                                # Cloudflare Worker (unchanged from v1)
├── package.json (workspaces)
├── README.md
├── plan.md
└── retro.md
```

## Data model (Drizzle / Postgres)

```
users            (id, email, name, image, google_sub, totp_secret, totp_enabled_at, created_at)
family           (id, name, invite_code, created_by, created_at)
family_member    (family_id, user_id, joined_at, is_creator)
                 pk (family_id, user_id)

// Transactional accounts (bank, credit card, wallet)
account          (id, family_id, owner_user_id, is_shared, institution, name,
                  type: 'bank'|'credit_card'|'wallet', currency, opening_balance,
                  active, created_at)
transaction      (id, account_id, date, description, amount, category, running_balance,
                  imported_from, external_id, created_at)
                  index (account_id, date desc)
                  unique (account_id, external_id) where external_id is not null

// Valuation-only assets (investments, gold, silver, crypto, real estate, custom, liabilities)
holding          (id, family_id, owner_user_id, is_shared, category, name, ticker,
                  quantity, currency, notes, active, created_at)
holding_value    (id, holding_id, date, value)    // one row per snapshot date
                  index (holding_id, date desc)

// Snapshot metadata (a "day" the family took a picture)
snapshot         (id, family_id, date, note, created_by)
                  unique (family_id, date)

// Balances (per account) frozen at a snapshot
account_balance  (id, snapshot_id, account_id, balance)

// Goals
goal             (id, family_id, scope: 'personal'|'family', owner_user_id?, name,
                  target_inr, target_date, include_categories, created_at)

// FX per snapshot
snapshot_fx      (snapshot_id primary key, usd_inr)
```

**Ownership model:**
- Every `account` and `holding` has `owner_user_id` + `is_shared` boolean.
- Personal dashboard for user X = holdings/accounts where `owner_user_id = X` (100%), PLUS `is_shared` items split **evenly** across all family members and counted at 1/N in totals.
- Family dashboard = everything at 100%.

## Auth flow

1. Root route redirects to `/login` if no session.
2. `/login` shows "Sign in with Google" → Auth.js Google provider.
3. On first sign-in:
   - `users` row created (google_sub tied to their Google account).
   - Redirect to `/mfa-enroll`: TOTP QR + backup code, require one successful TOTP verification before continuing.
   - If no family yet: `/onboarding/family` → "Create a family" or "Join with invite code".
4. On subsequent sign-ins:
   - Google OAuth succeeds.
   - Middleware checks: session valid AND `mfa_verified_at` fresh? If not → `/mfa-challenge`.
   - Enter TOTP → set `mfa_verified_at` on the JWT.
5. All `/app/*` routes require: valid session + MFA verified + family membership.

**2FA reset:** Backup codes issued at enrolment. Losing both TOTP + backup codes requires manual DB intervention (documented; not built in v2).

## Import flow

Two canonical templates hosted at `/api/template/transactions.csv` and `/api/template/holdings.csv`:

**transactions.csv columns:**
```
account_name, date, description, amount, currency, category, running_balance, external_id
```
- `amount`: positive = credit, negative = debit
- `external_id`: bank's transaction reference (used for dedupe on re-import)
- `account_name`: matches an existing account for the current family, or prompts you to create one

**holdings.csv columns:**
```
date, category, name, currency, value, quantity, ticker, notes, is_shared, owner_email
```
- `owner_email`: which family member owns it (defaults to importer)
- `is_shared`: `true`/`false`

Flow:
1. `/import` shows two "Download template" buttons + a file drop zone.
2. You export the bank statement, ask Claude/AI to normalise into the template, upload back.
3. App parses (CSV via papaparse or XLS via sheetjs), validates columns and types.
4. **Review UI**: shows every row about to be imported, colour-coded for new vs. duplicate. Confirm to save.
5. `INSERT ... ON CONFLICT (account_id, external_id) DO NOTHING`. Holdings insert new `holding_value` rows per date. Balances go into `account_balance`.

## Dashboards

**Family** (`/family`):
- Hero: family net worth (sum of accounts' latest balances + holdings' latest values − liabilities).
- Members ribbon: each member's contribution.
- Net-worth-over-time chart.
- Allocation donut.
- Insights panel (movers, concentration, savings rate).
- Family goals ribbon.
- Recent activity: last 20 transactions across all accounts.

**Personal** (`/personal`):
- Hero: my net worth = mine + share of shared (1/N).
- Sections: my accounts, my holdings, shared holdings I'm a part of (labelled).
- Personal goals ribbon.
- Personal net-worth-over-time.
- My recent activity.

**Accounts** (`/accounts`):
- Tabs: Family / Mine.
- List of accounts, each expandable to show transactions.
- Add manual transaction; delete transaction.

**Holdings** (`/holdings`):
- v1 holdings table extended with `Owner` column and `Shared` toggle.

## Snapshots (transactions edition)

- Any mutation ensures a `snapshot` exists for today per family.
- Store `account_balance` per account and `holding_value` per holding for that snapshot's date.
- Transactions accumulate independently — balances are the derived snapshot state, transactions are the log.

## Rollout order

1. **Retire v1 shell.** Delete `apps/web/index.html`, `src/main.tsx`, `vite.config.ts`, `App.tsx`. Keep reusable modules (analytics, format, types, csvParser, prices, styles).
2. **Next.js scaffold.** `next`, `next.config.js`, `app/layout.tsx`, root `page.tsx` (redirect logic), `middleware.ts`. Reuse existing CSS.
3. **Drizzle + Neon.** `src/db/schema.ts`, `drizzle.config.ts`, first migration, `client.ts` (neon http driver).
4. **Auth.js + Google.** Provider config, JWT session with `familyId` + `mfaVerifiedAt`, upsert `users` on first sign-in.
5. **TOTP.** `mfa.ts` (enroll, verify), `mfa-challenge` + `mfa-enroll` pages, backup codes, middleware gate.
6. **Family workspace.** Onboarding page (create or join with invite code), invite-code UI in settings.
7. **Server actions** for CRUD on holdings, accounts, transactions, goals; port v1 UI to forms backed by actions.
8. **Import subsystem.** Template routes, upload page, parser, review UI, dedupe.
9. **Personal vs family scoping.** Analytics accept a `scope`; queries filter by owner/family/shared. Split-evenly math for shared items in personal view.
10. **Layout / nav.** Family / Personal / Accounts / Holdings / Goals / Import / Settings.
11. **Deploy.** Push to git, Railway auto-deploys Next.js; env vars documented (DATABASE_URL, AUTH_SECRET, GOOGLE_CLIENT_ID/SECRET, NEXTAUTH_URL, INVITE_CODE_SECRET). Neon migration run. Cloudflare DNS → Railway.
12. **Cutover from v1** (optional): export v1 state as CSV → import into v2 via holdings template.

## Verification per step

- 3: `drizzle-kit push` to Neon, tables visible in Neon dashboard; smoke query returns.
- 4: Sign in with Google → user row appears; sign out clears cookie.
- 5: Enrol TOTP → row updated with `totp_secret`; wrong code fails; correct code + backup code both work.
- 6: Two Google accounts on same browser (sequentially) → user A creates family → user B joins via code → both see it in `/settings`.
- 7: Add/edit/delete a holding via UI; DB reflects change; two members see the same view.
- 8: Download `transactions.csv`, fill 3 rows, upload → review shows 3 new + 0 dupes → confirm → visible on accounts page.
- 9: With family = A + B, mark a holding shared → both personal dashboards show half in totals, family dashboard shows full.
- 10: Nav switches routes cleanly, MFA guards block deep-links from unauthenticated tabs.
- 11: Production URL works with Google login end-to-end on your domain.
- 12: Roundtrip v1 export → v2 import produces the same net worth.

## Explicit non-goals (v2)

- Roles beyond "member" — everyone equal, as requested.
- Automatic bank connection (Plaid, Salt Edge). Statements only.
- Investment lot-level tracking / capital gains reports.
- Native mobile app.
- Password recovery flow for TOTP loss — deferred, documented as a known limitation.
- Spending category ML/auto-tag — categories set at import time.

## Open questions before I start coding

1. **Domain** — ✅ Resolved: FQDN is `wealth.arknet.click` (root domain `arknet.click` owned by user, DNS at Cloudflare). Production `AUTH_URL=https://wealth.arknet.click`.
2. **Neon project** — provisioned already? If yes, do you want me to write against a dev branch or main?
3. **Google OAuth client** — I'll include a walkthrough in README; ok?
4. **Family size** — 2 members? 4? 8? Just so nav/dashboard density fits.
