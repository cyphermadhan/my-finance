/**
 * my-finance price proxy — Cloudflare Worker.
 *
 * Endpoints (all GET):
 *   /crypto?ids=bitcoin,ethereum&vs=inr
 *   /stock?symbols=RELIANCE.NS,AAPL
 *   /fx?pair=USDINR
 *   /mf?codes=120503,122639
 *   /metals?vs=inr
 *
 * Responses are normalised: { asOf, prices: [{ symbol, price, currency }] }
 * Auth: Authorization: Bearer <PROXY_TOKEN> — value set via `wrangler secret put PROXY_TOKEN`
 */

interface Env {
  PROXY_TOKEN: string;
  METALS_API_KEY?: string;
  ALLOWED_ORIGIN: string;
}

type PricePoint = { symbol: string; price: number; currency: string };
type Normalized = { asOf: string; prices: PricePoint[] };

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(env.ALLOWED_ORIGIN);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    if (env.PROXY_TOKEN) {
      const auth = req.headers.get('Authorization') ?? '';
      if (auth !== `Bearer ${env.PROXY_TOKEN}`) {
        return json({ error: 'Unauthorized' }, 401, cors);
      }
    }

    const url = new URL(req.url);
    try {
      switch (url.pathname) {
        case '/crypto':
          return json(await crypto(url), 200, cors);
        case '/stock':
          return json(await stock(url), 200, cors);
        case '/fx':
          return json(await fx(url), 200, cors);
        case '/mf':
          return json(await mf(url), 200, cors);
        case '/metals':
          return json(await metals(url, env), 200, cors);
        case '/':
          return json({ ok: true, endpoints: ['/crypto', '/stock', '/fx', '/mf', '/metals'] }, 200, cors);
        default:
          return json({ error: 'Not found' }, 404, cors);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return json({ error: message }, 500, cors);
    }
  },
};

function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Cache-Control': 'public, max-age=900',
  };
}

function json(body: unknown, status: number, headers: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

// ---------- Crypto (CoinGecko) ----------
async function crypto(url: URL): Promise<Normalized> {
  const ids = url.searchParams.get('ids') ?? '';
  const vs = url.searchParams.get('vs') ?? 'inr';
  if (!ids) throw new Error('Missing ?ids');
  const r = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(vs)}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
  const data = (await r.json()) as Record<string, Record<string, number>>;
  const prices: PricePoint[] = Object.entries(data).map(([sym, obj]) => ({
    symbol: sym,
    price: obj[vs.toLowerCase()],
    currency: vs.toUpperCase(),
  }));
  return { asOf: new Date().toISOString(), prices };
}

// ---------- Stocks (Yahoo Finance) ----------
async function stock(url: URL): Promise<Normalized> {
  const symbols = url.searchParams.get('symbols') ?? '';
  if (!symbols) throw new Error('Missing ?symbols');
  const r = await fetch(
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`,
    { headers: { 'User-Agent': 'Mozilla/5.0 my-finance/0.1' } }
  );
  if (!r.ok) throw new Error(`Yahoo ${r.status}`);
  const data = (await r.json()) as {
    quoteResponse: { result: Array<{ symbol: string; regularMarketPrice: number; currency: string }> };
  };
  const prices = data.quoteResponse.result.map((q) => ({
    symbol: q.symbol,
    price: q.regularMarketPrice,
    currency: q.currency,
  }));
  return { asOf: new Date().toISOString(), prices };
}

// ---------- FX ----------
async function fx(url: URL): Promise<Normalized> {
  const pair = (url.searchParams.get('pair') ?? 'USDINR').toUpperCase();
  const yahooSym = pair === 'USDINR' ? 'INR=X' : `${pair.slice(3)}${pair.slice(0, 3)}=X`;
  const r = await fetch(
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSym)}`,
    { headers: { 'User-Agent': 'Mozilla/5.0 my-finance/0.1' } }
  );
  if (!r.ok) throw new Error(`Yahoo FX ${r.status}`);
  const data = (await r.json()) as {
    quoteResponse: { result: Array<{ regularMarketPrice: number }> };
  };
  const price = data.quoteResponse.result[0]?.regularMarketPrice;
  if (!price) throw new Error('No FX result');
  return {
    asOf: new Date().toISOString(),
    prices: [{ symbol: pair, price, currency: pair.slice(3) }],
  };
}

// ---------- Mutual Funds (AMFI daily NAV) ----------
async function mf(url: URL): Promise<Normalized> {
  const codes = (url.searchParams.get('codes') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (codes.length === 0) throw new Error('Missing ?codes');
  const r = await fetch('https://www.amfiindia.com/spages/NAVAll.txt');
  if (!r.ok) throw new Error(`AMFI ${r.status}`);
  const text = await r.text();
  const wanted = new Set(codes);
  const prices: PricePoint[] = [];
  for (const line of text.split('\n')) {
    // format: schemeCode;ISIN1;ISIN2;schemeName;NAV;date
    const parts = line.split(';');
    if (parts.length < 5) continue;
    const [code, , , , navStr] = parts;
    if (wanted.has(code)) {
      const nav = Number(navStr);
      if (!Number.isNaN(nav)) prices.push({ symbol: code, price: nav, currency: 'INR' });
    }
  }
  return { asOf: new Date().toISOString(), prices };
}

// ---------- Metals (gold, silver INR/gram) ----------
async function metals(url: URL, env: Env): Promise<Normalized> {
  const vs = (url.searchParams.get('vs') ?? 'inr').toUpperCase();
  if (env.METALS_API_KEY) {
    // metals-api.com — free tier
    const r = await fetch(
      `https://metals-api.com/api/latest?access_key=${env.METALS_API_KEY}&base=${vs}&symbols=XAU,XAG`
    );
    if (!r.ok) throw new Error(`Metals API ${r.status}`);
    const d = (await r.json()) as { rates: Record<string, number> };
    // rates are per troy ounce; convert to per gram (1 oz = 31.1035g)
    const goldPerGram = 1 / d.rates.XAU / 31.1035;
    const silverPerGram = 1 / d.rates.XAG / 31.1035;
    return {
      asOf: new Date().toISOString(),
      prices: [
        { symbol: 'GOLD_INR_PER_GRAM', price: goldPerGram, currency: vs },
        { symbol: 'SILVER_INR_PER_GRAM', price: silverPerGram, currency: vs },
      ],
    };
  }
  // Fallback: return known-empty; frontend keeps last-known values.
  return {
    asOf: new Date().toISOString(),
    prices: [],
  };
}
