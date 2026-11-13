import { Check } from 'lucide-react';

/**
 * Pași numerotați (raport: Categorie → Detalii → Trimite).
 * steps: [{ label, state: 'done' | 'current' | 'next' }]. Pasul curent are aria-current="step".
 */
export default function Stepper({ steps, label = 'Pașii', className = '' }) {
  const current = steps.findIndex((s) => s.state === 'current');
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <p className="m-0 text-[18px] font-bold" aria-hidden="true">
        Pasul {current + 1} din {steps.length}
      </p>
      <ol aria-label={label} className="m-0 grid list-none p-0" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => {
          const done = s.state === 'done';
          const cur = s.state === 'current';
          return (
            <li key={s.label} aria-current={cur ? 'step' : undefined} className="relative flex flex-col items-center gap-2">
              <div className="absolute inset-x-0 top-[21px] flex h-1" aria-hidden="true">
                <span className={`flex-1 ${i === 0 ? '' : done || cur ? 'bg-success' : 'bg-line-soft'}`} />
                <span className={`flex-1 ${i === steps.length - 1 ? '' : done ? 'bg-success' : 'bg-line-soft'}`} />
              </div>
              <span
                className={[
                  'relative flex h-[46px] w-[46px] items-center justify-center rounded-chip border-[3px] text-[18px] font-extrabold text-ink',
                  done ? 'border-success bg-success-bg' : cur ? 'border-ink bg-primary text-on-primary' : 'border-border-strong bg-surface',
                ].join(' ')}
              >
                {done ? <Check aria-hidden="true" className="h-[22px] w-[22px] text-success" strokeWidth={3} /> : i + 1}
              </span>
              <span className={`text-[17px] ${cur ? 'font-extrabold' : 'font-semibold'} ${s.state === 'next' ? 'text-ink-muted' : ''}`}>
                {s.label}
                <span className="sr-only">{done ? ', gata' : cur ? ', pasul curent' : ', urmează'}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
