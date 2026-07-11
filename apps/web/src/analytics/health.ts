import type { Category, Goal, Holding } from '@/types';
import { formatInrCompact } from '@/util/format';

/**
 * Deterministic "portfolio health" — universal-prudence heuristics only
 * (no user risk profile, no AI, no market data). Educational, not advice.
 */

const METALS: Category[] = ['gold', 'silver'];

function toInr(v: number, c: 'INR' | 'USD', usdInr: number): number {
  return c === 'USD' ? v * usdInr : v;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export type HealthDimension = { key: string; label: string; score: number; detail: string };
export type GoalCoverage = { name: string; fundedPct: number; gapInr: number; targetInr: number; targetDate?: string | null };
export type PortfolioHealth = {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  netWorth: number;
  dimensions: HealthDimension[];
  recommendations: string[];
  goals: GoalCoverage[];
};

export function portfolioHealth(holdings: Holding[], goals: Goal[], usdInr: number): PortfolioHealth | null {
  const valued = holdings.map((h) => ({ category: h.category, inr: toInr(h.latestValue, h.currency, usdInr) }));
  const assets = valued.filter((h) => h.category !== 'liability' && h.inr > 0);
  const totalAssets = assets.reduce((s, h) => s + h.inr, 0);
  const liabilities = valued.filter((h) => h.category === 'liability').reduce((s, h) => s + Math.abs(h.inr), 0);
  const netWorth = totalAssets - liabilities;
  if (totalAssets <= 0) return null;

  const byCat = new Map<Category, number>();
  for (const h of assets) byCat.set(h.category, (byCat.get(h.category) ?? 0) + h.inr);
  const weight = (c: Category) => (byCat.get(c) ?? 0) / totalAssets;
  const groupWeight = (cats: Category[]) => cats.reduce((s, c) => s + (byCat.get(c) ?? 0), 0) / totalAssets;

  const dims: HealthDimension[] = [];
  const recs: string[] = [];

  // 1. Concentration — largest single holding vs assets
  const largest = assets.reduce((m, h) => Math.max(m, h.inr), 0);
  const concPct = largest / totalAssets;
  dims.push({
    key: 'concentration',
    label: 'Concentration',
    score: Math.round(clamp(100 - (Math.max(0, concPct - 0.1) / 0.3) * 100)),
    detail: `Largest holding is ${(concPct * 100).toFixed(0)}% of assets`,
  });
  if (concPct > 0.25) recs.push(`One holding is ${(concPct * 100).toFixed(0)}% of your assets — a single position above ~10–15% concentrates risk; consider spreading it.`);

  // 2. Diversification — Herfindahl index across categories
  let hhi = 0;
  for (const c of byCat.keys()) hhi += weight(c) ** 2;
  dims.push({
    key: 'diversification',
    label: 'Diversification',
    score: Math.round(clamp(100 - ((hhi - 0.2) / 0.4) * 100)),
    detail: `${byCat.size} asset categories in use`,
  });
  if (hhi > 0.4) recs.push('Your assets sit in just a few categories — broadening across more asset classes reduces risk.');

  // 3. Metals cap
  const metalsW = groupWeight(METALS);
  dims.push({
    key: 'metals',
    label: 'Metals allocation',
    score: Math.round(clamp(100 - (Math.max(0, metalsW - 0.1) / 0.2) * 100)),
    detail: `Gold + silver = ${(metalsW * 100).toFixed(0)}%`,
  });
  if (metalsW > 0.15) recs.push(`Gold + silver is ${(metalsW * 100).toFixed(0)}% of assets — commonly capped around 5–10%; consider trimming.`);

  // 4. Home bias — global share of direct equity
  const usW = byCat.get('us_stocks') ?? 0;
  const inW = byCat.get('indian_stocks') ?? 0;
  const directEquity = usW + inW;
  if (directEquity > 0) {
    const globalShare = usW / directEquity;
    dims.push({
      key: 'homebias',
      label: 'Global diversification',
      score: Math.round(clamp(50 + (globalShare / 0.15) * 50)),
      detail: `${(globalShare * 100).toFixed(0)}% of direct equity is global`,
    });
    if (globalShare < 0.05) recs.push('Your direct stock holdings are almost entirely domestic — some global (US) exposure adds diversification.');
  }

  // 5. Cash drag
  const cashW = weight('cash');
  dims.push({
    key: 'cash',
    label: 'Cash level',
    score: Math.round(clamp(100 - (Math.max(0, cashW - 0.15) / 0.25) * 100)),
    detail: `Cash = ${(cashW * 100).toFixed(0)}%`,
  });
  if (cashW > 0.2) recs.push(`Cash is ${(cashW * 100).toFixed(0)}% of assets — beyond an emergency buffer, idle cash loses to inflation.`);

  // 6. Debt level
  const liabRatio = liabilities / totalAssets;
  dims.push({
    key: 'liabilities',
    label: 'Debt level',
    score: Math.round(clamp(100 - (liabRatio / 0.5) * 100)),
    detail: liabilities > 0 ? `Liabilities = ${(liabRatio * 100).toFixed(0)}% of assets` : 'No liabilities recorded',
  });
  if (liabRatio > 0.4) recs.push(`Liabilities are ${(liabRatio * 100).toFixed(0)}% of assets — prioritise paying down high-interest debt.`);

  const score = Math.round(dims.reduce((s, d) => s + d.score, 0) / dims.length);
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'E';

  // Goal coverage
  const goalCov: GoalCoverage[] = goals.map((g) => {
    const cats = g.includeCategories.length ? g.includeCategories : null;
    const relevant = assets.filter((h) => !cats || cats.includes(h.category)).reduce((s, h) => s + h.inr, 0);
    return {
      name: g.name,
      fundedPct: g.targetInr > 0 ? relevant / g.targetInr : 0,
      gapInr: Math.max(0, g.targetInr - relevant),
      targetInr: g.targetInr,
      targetDate: g.targetDate,
    };
  });
  for (const gc of goalCov) {
    if (gc.fundedPct < 1) recs.push(`Goal “${gc.name}” is ${Math.round(gc.fundedPct * 100)}% funded — ${formatInrCompact(gc.gapInr)} to go.`);
  }

  if (recs.length === 0) recs.push('Your allocation looks broadly balanced — keep contributing and review periodically.');

  return { score, grade, netWorth, dimensions: dims, recommendations: recs.slice(0, 6), goals: goalCov };
}
