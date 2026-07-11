# Implementation Log

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
