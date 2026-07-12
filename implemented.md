# Implementation Log

## 2026-07-12 — Hero banner + quote on family dashboard

- **What:** Added a full-width hero image banner with the overlaid quote "Let's build wealth together." to the top of the family dashboard.
- **Files:** `apps/web/public/hero-image.webp` (new), `apps/web/src/ui/DashboardShell.tsx`, `apps/web/src/styles/app.css`
- **Details:**
  - Banner renders only for `scope === 'family'` (Personal shares `DashboardShell`); cover image 260px tall (180px ≤640px), 14px radius, bottom gradient scrim so the white quote stays legible.
  - Image supplied as WebP (2304×520, 191KB) — exact 2× match for the 1152×260 display box (`.app` 1200px − 48px padding), so no cropping. Earlier PNG→JPEG optimization pass discarded in favor of the WebP.
  - Pushed to `main` (`3def1d9..412217f`); Railway auto-deploys.

## 2026-07-12 — Add holding / New goal forms open in a modal

- **What:** Moved the "Add holding" and goal editor forms out of inline page/row rendering into a centered modal dialog.
- **Files:** `apps/web/src/ui/Modal.tsx` (new), `apps/web/app/(app)/holdings/HoldingsClient.tsx`, `apps/web/app/(app)/goals/GoalsClient.tsx`
- **Details:**
  - New reusable `Modal` component (backdrop + Escape dismiss, sticky header with title + close) reusing the existing `.modal-*` styles from the health-details modal.
  - Holdings "Add" opens in a 560px modal; row *editing* still stays inline in the table. Goal editor (add + edit) moved into a modal, dropping its old inline `<section className="card">` chrome.
  - Pushed to `main` (`3972017..3def1d9`); Railway auto-deploys.

## 2026-07-12 — Wealth logo: favicon + clickable brand

- **What:** Added the `wealth-logo.svg` as the site favicon and as a logo left of the "Wealth" nav title, with the brand now linking home.
- **Files:** `apps/web/app/icon.svg` (new), `apps/web/public/wealth-logo.svg` (new), `apps/web/src/ui/Nav.tsx`, `apps/web/src/styles/app.css`
- **Details:**
  - `app/icon.svg` is auto-detected by Next.js App Router for the favicon `<link>` — no metadata config needed.
  - Nav brand is now a `<Link href="/family">` (home for logged-in users) with a 24px logo; `.nav__brand` restyled to flex-align logo + text and strip link underline/color.
  - Pushed to `main` (`786fa24..3972017`); Railway auto-deploys.

## 2026-07-12 — Portfolio Health card + holdings-only cleanup

- **What:** Added a deterministic Portfolio Health score/recommendations card to the family dashboard, and stripped the app down to a holdings-only workflow.
- **Files:** `src/analytics/health.ts`, `src/ui/HealthCard.tsx`, `src/ui/HealthDetails.tsx`, `src/ui/DashboardShell.tsx`, `src/ui/Nav.tsx`, `app/(app)/import/page.tsx`, `src/styles/app.css`
- **Details:**
  - **Portfolio Health** (no AI, no risk profile): six universal-prudence checks (concentration, diversification via HHI, metals cap, home bias, cash drag, debt) → 0–100 score + letter grade, rule-triggered recommendations, and per-goal coverage. Factor breakdown lives in a **View details modal** (`HealthDetails`, client); the rest is a server component. Color-coded bars (green/amber/red) with a legend.
  - **Holdings-only:** hid the Accounts nav tab and the empty dashboard Accounts panel (allocation goes full-width); import page refocused on holdings with a column guide clarifying `date` = statement as-of date (today for a current snapshot), not purchase date.
  - Shipped via branch `portfolio-health` → fast-forward merge to `main` → deployed (branch kept).
  - Known limitation surfaced (not yet fixed): `getHistoricalNetWorth` has a join fan-out double-count + no FX conversion; net-worth-over-time is only reliable for single-currency, full-snapshot data.

## 2026-07-11 — UI polish: menus, nav blur, Feather icons

- **What:** Fixed row-menu clipping/transparency, added nav backdrop-blur, a header Add button, removed button underlines, and added Feather icons across the app.
- **Files:** `src/ui/Nav.tsx`, `src/styles/app.css`, `app/(app)/holdings/HoldingsClient.tsx`, `app/(app)/{accounts,goals,import,settings}/*`, `src/ui/{DashboardShell,MembersRibbon,NetWorthChart,AllocationChart}.tsx`, auth forms; added `react-feather` dep.
- **Details:**
  - Row menu now uses **fixed positioning** (escapes table `overflow` clipping) with a solid `--bg-surface-alt` + blur background — the `--bg-surface` token is intentionally translucent (`#17171466`), which was the transparency cause.
  - Sticky nav got `backdrop-filter: blur(16px)`; `.btn` got `text-decoration: none`.
  - Done on branch `holdings-polish`, pushed to GitHub, then fast-forward merged to `main` (branch kept).

## 2026-07-11 — Holdings overhaul + mobile pass

- **What:** Reworked the Holdings model/UX (remove ticker, per-category units, member-level sharing, read-only rows + row menu), simplified import, and made the whole app responsive.
- **Files:** `src/types.ts`, `src/db/schema.ts`, `src/db/queries.ts`, `src/analytics/scoping.ts`, `src/actions/holdings.ts`, `src/actions/import.ts`, `src/ingest/{parse,templates}.ts`, `app/(app)/holdings/HoldingsClient.tsx`, `app/(app)/{accounts,import}/*`, `src/ui/{MembersRibbon,Nav}.tsx`, `src/styles/app.css`, `app/layout.tsx`
- **Details:**
  - New `holding_shared_with` join table + `sharedWith[]` on Holding; "Shared" now takes a member multi-select and splits value 1/|set| in each member's Mine view. `drizzle-kit push --force` also dropped `holding.ticker`.
  - `CATEGORY_UNITS` map drives a unit-aware quantity field (gold→grams, stocks→shares, real estate→acres; cash/PPF/EPF/etc. have none). Holdings rows are read-only with a ⋯ Edit/Delete menu; edit opens an inline form.
  - Import dropped `owner_email` (defaults to importer); templates are now header + one empty row. Empty-state copy fixed + Import buttons added.
  - Responsive: hamburger nav, holdings table reflows to cards ≤640px, single-column dashboard, stacked forms; explicit `viewport` export.

## 2026-07-11 — Fix RSC boundary crash on family/personal dashboard

- **What:** Fixed a production-only `TypeError: c is not a function` that crashed the dashboard render after creating/joining a family.
- **Files:** `apps/web/src/analytics/scoping.ts`, `apps/web/src/ui/AllocationChart.tsx`, `apps/web/src/ui/DashboardShell.tsx`
- **Details:**
  - Root cause: `slicesFromHoldings` (pure helper) + `Slice` type lived in `AllocationChart.tsx` (`'use client'`); the Server Component `DashboardShell` called it. Exports of a `'use client'` module are client references, not callable functions server-side.
  - Fix: moved the helper + type into the server-safe `analytics/scoping.ts`; both server and client files import from there.
  - Only surfaced on `/family` render (login/MFA/onboarding were unaffected), and only in the minified prod build.

## 2026-07-11 — Neon schema migration + auth config fixes

- **What:** Created the production DB schema and fixed two auth misconfigurations blocking sign-in.
- **Files:** `apps/web/.env` (local, untracked); Neon Postgres (11 tables via `drizzle-kit push`)
- **Details:**
  - Ran `db:push` → created all 11 tables (`users`, `family`, `family_member`, `account`, `transaction`, `holding`, `holding_value`, `snapshot`, `snapshot_fx`, `account_balance`, `goal`). Empty DB was causing NextAuth "Access Denied" (signIn callback threw on missing `users` table).
  - `AUTH_SECRET` was a literal placeholder (`<openssl rand...>`) → replaced with a real generated secret.
  - `AUTH_URL` was pointed at the prod domain locally → set to `http://localhost:3000` for local dev; production `AUTH_URL` set in Railway.

## 2026-07-11 — Production deploy: Railway + custom domain (wealth.arknet.click)

- **What:** Stood up production hosting on Railway with GitHub auto-deploy and a custom Cloudflare domain.
- **Files:** `railway.json` (new), `apps/web/package.json` (start script), `plan.md`
- **Details:**
  - Railway project `courteous-spontaneity`, service `my-finance`, GitHub auto-deploy from `cyphermadhan/my-finance`; builds via `apps/web/Dockerfile` (`railway.json` sets Dockerfile path for the monorepo).
  - Changed prod `start` to `next start` (binds Railway's dynamic `$PORT`); set 5 env vars (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET`, `AUTH_URL`) via CLI.
  - Custom domain `wealth.arknet.click`; Cloudflare record set to **DNS-only** (grey cloud) to resolve a Flexible-SSL redirect loop. Google OAuth redirect URIs updated to the new domain + localhost.
