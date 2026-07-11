import { Activity, CheckCircle } from 'react-feather';
import type { PortfolioHealth } from '@/analytics/health';
import { HealthDetails } from './HealthDetails';
import { formatInrCompact } from '@/util/format';

const GRADE_LABEL: Record<PortfolioHealth['grade'], string> = {
  A: 'Excellent', B: 'Good', C: 'Fair', D: 'Needs attention', E: 'At risk',
};

export function HealthCard({ health }: { health: PortfolioHealth }) {
  return (
    <section className="card health">
      <div className="section-header">
        <div className="section-header__titles">
          <h2><Activity size={16} /> Portfolio health</h2>
          <p className="section-desc">Heuristic, not financial advice.</p>
        </div>
        <HealthDetails dimensions={health.dimensions} />
      </div>

      <div className="health__top">
        <div className={`health__score health__score--${health.grade.toLowerCase()}`}>
          <div className="health__score-num">{health.score}</div>
          <div className="health__score-grade">{health.grade} · {GRADE_LABEL[health.grade]}</div>
        </div>
        <p className="health__summary-note">Averaged from six allocation checks on your family holdings. Open “View details” for the breakdown.</p>
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
