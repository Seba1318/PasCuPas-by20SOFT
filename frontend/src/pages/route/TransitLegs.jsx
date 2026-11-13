import { Accessibility, Footprints, MonitorSmartphone, Volume2 } from 'lucide-react';
import { legTitle } from './transitUtils.js';
import { etaText } from '../place/sheetUtils.js';

const FEATURES = [
  ['Rampă', Accessibility, (v) => v.has_ramp && v.ramp_ok !== false],
  ['Podea joasă', Footprints, (v) => v.low_floor],
  ['Anunțuri sonore', Volume2, (v) => v.has_audio_announce && v.audio_ok !== false],
  ['Afișaj', MonitorSmartphone, (v) => v.has_visual_display],
];

// D3: etapele traseului cu transport public, pe o linie verticală.
export default function TransitLegs({ legs }) {
  return (
    <>
      <ol aria-label="Pașii traseului" className="m-0 flex list-none flex-col p-0">
        {legs.map((leg, i) => {
          const transit = leg.type === 'transit';
          return (
            <li key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-10 w-10 flex-none items-center justify-center rounded-chip text-[18px] font-extrabold ${
                    transit ? 'bg-primary text-on-primary' : 'border-2 border-border-strong bg-surface'
                  }`}
                >
                  {transit ? leg.line : <Footprints aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />}
                </span>
                {i < legs.length - 1 && <span aria-hidden="true" className={`w-1 flex-1 ${transit ? 'bg-primary' : 'bg-line-soft'}`} />}
              </div>
              <div className="flex flex-1 flex-col gap-1 pb-4">
                <span className="text-[18px] font-bold">{legTitle(leg)}</span>
                {transit ? (
                  <>
                    {leg.departure && <span className="text-[17px] font-semibold text-success">Sosește {etaText(leg.departure)}</span>}
                    <span className="text-caption text-ink-muted">
                      {leg.stops_count} stații · {leg.duration_min} min · cobori la {leg.alight_stop}
                    </span>
                    {leg.vehicle && (
                      <ul aria-label="Dotările vehiculului" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                        {FEATURES.filter(([, , has]) => has(leg.vehicle)).map(([label, Icon]) => (
                          <li key={label} className="inline-flex items-center gap-1 rounded-chip bg-success-bg px-2 py-0.5 text-[15px] font-semibold text-success">
                            <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
                            {label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <span className="text-caption text-ink-muted">până la {leg.to_name}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <span className="text-caption text-ink-muted">Ore estimate după orar.</span>
    </>
  );
}
