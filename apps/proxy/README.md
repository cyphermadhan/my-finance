# my-finance proxy (Cloudflare Worker)

Small edge proxy that fetches price data on behalf of the web app so the browser doesn't hit CORS walls.

## Endpoints

All GET, all return `{ asOf: iso, prices: [{ symbol, price, currency }] }`.

- `/crypto?ids=bitcoin,ethereum&vs=inr` — CoinGecko free
- `/stock?symbols=RELIANCE.NS,AAPL` — Yahoo Finance
- `/fx?pair=USDINR` — Yahoo Finance
- `/mf?codes=120503,122639` — AMFI daily NAV text file
- `/metals?vs=inr` — gold/silver per gram (needs `METALS_API_KEY` secret; empty prices if unset)

Cache: edge-cached 15 minutes.

Auth: Bearer token via `PROXY_TOKEN` secret. The client sends `Authorization: Bearer <token>`.

## Setup

```bash
cd apps/proxy
npm install
npx wrangler login          # first time only
npx wrangler secret put PROXY_TOKEN
# (optional) npx wrangler secret put METALS_API_KEY
npm run dev                 # local dev at http://localhost:8787
npm run deploy              # production deploy
```

## Wiring to the web app

Set the following in the web app's `.env.local`:

```
VITE_PROXY_URL=https://my-finance-proxy.<your-subdomain>.workers.dev
VITE_PROXY_TOKEN=<the PROXY_TOKEN you set above>
```

The client in `apps/web/src/prices/client.ts` picks these up automatically. If unset, price refresh is a no-op.
