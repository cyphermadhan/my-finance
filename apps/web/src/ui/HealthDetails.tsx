'use client';

import { useState, useEffect } from 'react';
import { X } from 'react-feather';
import type { HealthDimension } from '@/analytics/health';

export function HealthDetails({ dimensions }: { dimensions: HealthDimension[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>View details</button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Portfolio health factors" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>Health factors</h3>
              <button className="icon-btn" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            <div className="modal__body">
              <p className="health__legend">
                Each factor is scored out of 100 — <b>higher is healthier</b>.{' '}
                <span className="health__legend-dot health__legend-dot--good" />good ·{' '}
                <span className="health__legend-dot health__legend-dot--warn" />watch ·{' '}
                <span className="health__legend-dot health__legend-dot--bad" />needs attention
              </p>
              {dimensions.map((d) => {
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
              <p className="modal__note">Score is the average of these factors. Grade: A ≥ 85, B ≥ 70, C ≥ 55, D ≥ 40, else E. General heuristics — not personalised financial advice.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
