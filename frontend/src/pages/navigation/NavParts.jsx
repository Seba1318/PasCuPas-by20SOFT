import { ArrowLeft, ArrowRight, ArrowUp, Flag, Footprints, LocateFixed, Square, Volume2, VolumeX } from 'lucide-react';
import { maneuverOf } from '../../navigation/simulate.js';
import { formatDistance } from '../../lib/format.js';

const ICONS = { left: ArrowLeft, right: ArrowRight, straight: ArrowUp, cross: Footprints, arrive: Flag };

export function ManeuverIcon({ instruction, size = 'md' }) {
  const Icon = ICONS[maneuverOf(instruction)];
  const box = size === 'lg' ? 'h-32 w-32 rounded-sheet' : 'h-16 w-16 rounded-field';
  return (
    <span aria-hidden="true" className={`flex flex-none items-center justify-center bg-ink text-surface ${box}`}>
      <Icon className={size === 'lg' ? 'h-20 w-20' : 'h-10 w-10'} strokeWidth={3} />
    </span>
  );
}

// D4: următoarea manevră, mare, citită automat de cititoarele de ecran.
export function InstructionCard({ step, nextStep, toNext }) {
  return (
    <section
      aria-live="polite"
      aria-label="Următoarea manevră"
      className="flex flex-col gap-3 rounded-sheet bg-surface p-4 shadow-lg hc:border-[3px] hc:border-border"
    >
      <div className="flex items-center gap-3">
        <ManeuverIcon instruction={step.instruction} />
        <div className="flex flex-col">
          <span className="text-[34px] font-extrabold leading-[38px]">{toNext != null ? `Peste ${formatDistance(Math.round(toNext / 5) * 5)}` : 'Pornește'}</span>
          <span className="text-[20px] font-bold leading-[26px]">{step.instruction}</span>
        </div>
      </div>
      {nextStep && (
        <div className="flex items-center gap-2 border-t border-border pt-2.5 text-[17px] text-ink-muted">
          <ArrowUp aria-hidden="true" className="h-5 w-5 flex-none" strokeWidth={2.5} />
          Apoi: {nextStep.instruction.charAt(0).toLowerCase() + nextStep.instruction.slice(1)}
        </div>
      )}
    </section>
  );
}

export function VoiceButton({ on, onToggle }) {
  const Icon = on ? Volume2 : VolumeX;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className="flex h-12 items-center gap-2 rounded-field bg-surface px-3.5 text-[17px] font-bold shadow-md hc:border-2 hc:border-border"
    >
      <Icon aria-hidden="true" className="h-[22px] w-[22px]" strokeWidth={2.5} />
      Voce: {on ? 'pornită' : 'oprită'}
    </button>
  );
}

export function CenterButton({ onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex h-12 items-center gap-2 rounded-field bg-surface px-3.5 text-[17px] font-bold shadow-md hc:border-2 hc:border-border">
      <LocateFixed aria-hidden="true" className="h-[22px] w-[22px]" strokeWidth={2.5} />
      Centrează
    </button>
  );
}

// Foaia de jos cu timpul rămas și „Oprește”.
export function ProgressSheet({ sheetRef, minutes, distance, eta, onStop }) {
  return (
    <section
      ref={sheetRef}
      aria-label="Progres"
      className="absolute inset-x-0 bottom-0 z-[900] flex items-center gap-3 rounded-t-sheet bg-surface px-4 pb-6 pt-[18px] shadow-lg hc:border-t-[3px] hc:border-border"
    >
      <div className="flex flex-1 flex-col">
        <span className="text-[28px] font-extrabold leading-8">{minutes == null ? '— min' : `${minutes} min`}</span>
        <span className="text-[17px] text-ink-muted">{distance == null ? 'Timpul se actualizează imediat' : `${distance} · ajungi la ${eta}`}</span>
      </div>
      <button
        type="button"
        onClick={onStop}
        className="flex h-14 items-center gap-2 rounded-field border-2 border-error bg-error-bg px-5 text-[18px] font-bold text-error hover:bg-error hover:text-on-error"
      >
        <Square aria-hidden="true" className="h-5 w-5" strokeWidth={3} />
        Oprește
      </button>
    </section>
  );
}
