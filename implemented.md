# Implementation Log

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
