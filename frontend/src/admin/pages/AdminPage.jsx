// Antetul comun al paginilor de administrare.
export default function AdminPage({ title, meta, actions, children, className = '' }) {
  return (
    <div className={`flex flex-1 flex-col gap-5 p-6 ${className}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-title-2">{title}</h1>
        {meta && <span className="text-[17px] text-ink-muted">{meta}</span>}
        {actions && <div className="ml-auto flex gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Select({ id, label, value, onChange, options, className = '' }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-label">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 rounded-[14px] border-2 border-border-strong bg-surface px-3 text-[17px] text-ink"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
