import { Activity, CheckCircle, Info, ChevronDown } from 'react-feather';
import type { PortfolioHealth } from '@/analytics/health';
import { formatInrCompact } from '@/util/format';

const GRADE_LABEL: Record<PortfolioHealth['grade'], string> = {
  A: 'Excellent', B: 'Good', C: 'Fair', D: 'Needs attention', E: 'At risk',
};

export function HealthCard({ health }: { health: PortfolioHealth }) {
  return (
    <section className="card health">
      <div className="section-header">
        <h2>
          <Activity size={16} /> Portfolio health
          <span className="info-tip" tabIndex={0} role="button" aria-label="How the health score is calculated">
            <Info size={14} />
            <span className="info-tip__bubble" role="tooltip">
              <strong>How this is calculated</strong>
              <p>The score is the average of six checks, each rated 0–100:</p>
              <ul>
                <li><b>Concentration</b> — largest single holding vs. total assets</li>
                <li><b>Diversification</b> — spread across asset categories</li>
                <li><b>Metals</b> — gold + silver share (norm ~5–10%)</li>
                <li><b>Global</b> — US vs. Indian equity balance</li>
                <li><b>Cash</b> — idle cash share</li>
                <li><b>Debt</b> — liabilities vs. assets</li>
              </ul>
              <p>Grade: A ≥ 85, B ≥ 70, C ≥ 55, D ≥ 40, else E. General heuristics — not personalised financial advice.</p>
            </span>
          </span>
        </h2>
        <span className="section-header__meta">heuristic, not financial advice</span>
      </div>

      <div className="health__top">
        <div className={`health__score health__score--${health.grade.toLowerCase()}`}>
          <div className="health__score-num">{health.score}</div>
          <div className="health__score-grade">{health.grade} · {GRADE_LABEL[health.grade]}</div>
        </div>
        <div className="health__summary">
          <p className="health__summary-note">Averaged from six allocation checks on your family holdings.</p>
          <details className="health__details">
            <summary className="btn health__toggle">
              <ChevronDown size={15} />
              <span className="health__toggle-closed">View details</span>
              <span className="health__toggle-open">Hide details</span>
            </summary>
            <div className="health__dims">
              <p className="health__legend">Each factor is scored out of 100 — <b>higher is healthier</b>. <span className="health__legend-dot health__legend-dot--good" />good · <span className="health__legend-dot health__legend-dot--warn" />watch · <span className="health__legend-dot health__legend-dot--bad" />needs attention</p>
              {health.dimensions.map((d) => {
                const band = d.score >= 70 ? 'good' : d.score >= 40 ? 'warn' : 'bad';
                return (
                  <div key={d.key} className="health__dim">
                    <div className="health__dim-head">
                      <span className="health__dim-label">{d.label}</span>
                      <span className={`health__dim-score health__dim-score--${band}`}>{d.score}<span className="health__dim-score-max">/100</span></span>
                    </div>
                    <div className="health__bar"><div className={`health__bar-fill health__bar-fill--${band}`} style={{ width: `${d.score}%` }} /></div>
                    <div className="health__dim-detail">{d.detail}</div>
                  </div>
                );
              })}
            </div>
          </details>
        </div>
      </div>

      {health.goals.length > 0 && (
        <div className="health__goals">
          <div className="health__subhead">Goal coverage</div>
          {health.goals.map((g) => (
            <div key={g.name} className="health__goal">
              <div className="health__dim-head">
                <span>{g.name}</span>
                <span className="health__dim-detail">
                  {Math.round(g.fundedPct * 100)}% · {g.gapInr > 0 ? `${formatInrCompact(g.gapInr)} to go` : 'funded'}
                </span>
              </div>
              <div className="health__bar"><div className="health__bar-fill" style={{ width: `${Math.min(100, g.fundedPct * 100)}%` }} /></div>
            </div>
          ))}
        </div>
      )}

      <div className="health__recs">
        <div className="health__subhead">Recommendations</div>
        <ul>
          {health.recommendations.map((r, i) => (
            <li key={i}><CheckCircle size={14} /> <span>{r}</span></li>
          ))}
        </ul>
      </div>
    </section>
  );
}
