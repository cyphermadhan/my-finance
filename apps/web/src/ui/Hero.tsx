import { formatInrCompact, formatInrFull } from '@/util/format';

type Props = {
  label: string;
  value: number;
  deltas?: Array<{ label: string; value: number }>;
};

export function Hero({ label, value, deltas = [] }: Props) {
  return (
    <section className="card hero">
      <div className="hero__label">{label}</div>
      <div className="hero__value" title={formatInrFull(value)}>{formatInrCompact(value)}</div>
      {deltas.length > 0 && (
        <div className="hero__deltas">
          {deltas.map((d, i) => (
            <span key={i} className={`delta ${classFor(d.value)}`}>
              <span className="delta__label">{d.label}</span>
              <span className="delta__value">{formatInrCompact(d.value)}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function classFor(v: number) {
  if (v > 0) return 'delta--positive';
  if (v < 0) return 'delta--negative';
  return 'delta--neutral';
}
