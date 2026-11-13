// Glisor: <input type="range"> real (tastatură, cititoare de ecran), desenat peste.
// `format(v)` dă textul afișat și aria-valuetext („3 cm”, „6 %”).
export default function Slider({ id, label, min, max, step = 1, value, onChange, format = String, minText, maxText, hint }) {
  const pct = `${((value - min) / (max - min)) * 100}%`;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-label">
          {label}
        </label>
        <span className="text-[22px] font-extrabold" aria-hidden="true">
          {format(value)}
        </span>
      </div>
      <div className="relative flex h-12 items-center">
        <div className="absolute inset-x-0 h-2.5 rounded-chip border border-route-blocked bg-border" />
        <div className="absolute left-0 h-2.5 rounded-chip bg-primary" style={{ width: pct }} />
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={format(value)}
          aria-describedby={hintId}
          onChange={(e) => onChange(Number(e.target.value))}
          className="peer absolute inset-0 z-10 m-0 h-12 w-full cursor-pointer opacity-0"
        />
        <div
          aria-hidden="true"
          className="absolute -ml-4 h-8 w-8 rounded-chip border-[3px] border-ink bg-surface shadow-sm peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-[3px] peer-focus-visible:outline-focus"
          style={{ left: pct }}
        />
      </div>
      {(minText || maxText) && (
        <div className="flex justify-between text-caption text-ink-muted" aria-hidden="true">
          <span>{minText}</span>
          <span>{maxText}</span>
        </div>
      )}
      {hint && (
        <span id={hintId} className="text-caption text-ink-muted">
          {hint}
        </span>
      )}
    </div>
  );
}
