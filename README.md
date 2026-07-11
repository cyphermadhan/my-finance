# My Finance — Family Wealth Platform

Next.js 14 app that gives a family a **shared wealth dashboard** and per-member **personal dashboards**. Google OAuth + TOTP 2FA. Neon Postgres for storage. CSV/XLS statement import via a canonical template. Runs on Railway; DNS at Cloudflare.

## Repo layout

```
my-finance/
├── apps/
│   ├── web/              # Next.js 14 app (main)
│   └── proxy/            # Cloudflare Worker for daily price refresh (optional)
├── supabase/             # (legacy — v1 stub, ignore)
├── plan.md               # v2 design doc
└── README.md             # this file
```

## First-run setup

### 1. Neon Postgres

1. Sign in at [neon.tech](https://neon.tech).
2. Create a project (`my-finance`).
3. Copy the connection string (with `?sslmode=require`).

### 2. Google OAuth client

1. Google Cloud Console → **APIs & Services → Credentials → Create Credentials → OAuth Client ID**.
2. Application type: **Web application**.
3. Authorised JavaScript origins: `https://your-domain.com` and `http://localhost:3000`.
4. Authorised redirect URIs: `https://your-domain.com/api/auth/callback/google` and `http://localhost:3000/api/auth/callback/google`.
5. Copy the Client ID + Client Secret.

### 3. Local dev

```bash
cp apps/web/.env.example apps/web/.env.local
# Fill in DATABASE_URL, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET.
# AUTH_SECRET: openssl rand -base64 32

npm install
npm run --workspace=apps/web db:push       # applies schema to Neon
npm run --workspace=apps/web dev
# open http://localhost:3000
```

The first Google sign-in creates your user row. Then:
- Enrol TOTP (Google Authenticator / 1Password / Authy) at `/mfa-enroll` — save the backup codes.
- Create a family (or join one via invite code) at `/onboarding`.
- Get the invite code from **Settings → Family** and share it with each family member. They sign in with their own Google, enrol TOTP, and enter the code.

### 4. Deploy to Railway

1. Push repo to GitHub.
2. In Railway: **New project → Deploy from GitHub repo**.
3. Railway auto-detects Next.js under `apps/web`. If not, set **Root Directory** to `apps/web` and **Build Command** to `npm run build`, **Start Command** to `npm run start`.
4. Add environment variables (Settings → Variables):
   - `DATABASE_URL` — Neon URL
   - `AUTH_SECRET` — `openssl rand -base64 32`
   - `AUTH_URL` — `https://your-domain.com`
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
   - `INVITE_CODE_SECRET` — `openssl rand -base64 24`
5. Railway gives you a `*.up.railway.app` URL.

### 5. Custom domain via Cloudflare

1. Cloudflare DNS → your domain → **Add record**.
   - Type `CNAME`, Name `@` (or `finance` for `finance.your-domain.com`), Target = your Railway URL, Proxy status **DNS only** (grey cloud) initially.
2. Railway → Settings → Domains → **Add custom domain** → enter your FQDN. Railway will give a verification target (usually the same CNAME); once verified it provisions HTTPS via Let's Encrypt.
3. Update `AUTH_URL` env var to match the final URL. Redeploy.
4. Update Google OAuth authorised origins + redirect URIs to include the final URL.
5. Once live, flip Cloudflare proxy to **orange cloud** if you want CF's edge in front (WAF, caching). Ensure SSL/TLS mode = **Full (strict)**.

### 6. (Optional) Cloudflare Worker price proxy

The v1 price proxy in `apps/proxy` still works. It refreshes crypto/stock/MF/gold prices for holdings that have a ticker + quantity. See [apps/proxy/README.md](apps/proxy/README.md).

## CSV import

Grab any bank statement or holdings CSV. Ask an AI (Claude, ChatGPT, etc.) to normalise it into one of these templates:

- Transactions: [http://localhost:3000/api/template/transactions](http://localhost:3000/api/template/transactions)
- Holdings: [http://localhost:3000/api/template/holdings](http://localhost:3000/api/template/holdings)

Then upload at `/import`. The app auto-detects which template, previews rows (colour-coded new vs. duplicate by `external_id`), and only writes on confirmation.

## Ownership & the two dashboards

- Each account and holding has an **owner** and an optional **shared** flag.
- **Family** dashboard: everything counted at 100%.
- **Personal** dashboard for user X: X's own items counted at 100%; shared items divided evenly across all family members.

## Data model

Postgres schema in [apps/web/src/db/schema.ts](apps/web/src/db/schema.ts). Migrations generated via `npm run --workspace=apps/web db:generate`.

## Non-goals

- Automatic bank connection (Plaid, Salt Edge). Statements only.
- Investment lot-level tracking / capital gains.
- Native mobile app.
- Password/2FA recovery flow. Losing both TOTP and backup codes means the user needs manual DB intervention (`update users set totp_secret = null, totp_enabled_at = null where email = ...` then re-enrol).
